use chrono::Utc;
use futures_util::{
    future::{select, Either},
    pin_mut, stream, StreamExt,
};
use regex::Regex;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::{HashMap, HashSet};
use std::{process::Stdio, sync::LazyLock};
use tauri::{Emitter, Manager};
use tokio::process::Command;
use tokio::sync::{Mutex, Notify};

const OLLAMA_URL: &str = "http://localhost:11434";
const OLLAMA_LIBRARY_URL: &str = "https://ollama.com";
const METADATA_CONCURRENCY: usize = 6;

static HTTP_CLIENT: LazyLock<Client> = LazyLock::new(|| {
    Client::builder()
        .timeout(std::time::Duration::from_secs(900))
        .build()
        .expect("valid reqwest client")
});
static CANCELLED_CHAT_RUNS: LazyLock<Mutex<HashSet<String>>> =
    LazyLock::new(|| Mutex::new(HashSet::new()));
static CHAT_CANCEL_NOTIFY: LazyLock<Notify> = LazyLock::new(Notify::new);

#[derive(Debug, Serialize, Deserialize)]
struct ModelDetails {
    parent_model: Option<String>,
    format: Option<String>,
    family: Option<String>,
    families: Option<Vec<String>>,
    parameter_size: Option<String>,
    quantization_level: Option<String>,
    context_length: Option<u64>,
    embedding_length: Option<u64>,
}

#[derive(Debug, Serialize, Deserialize)]
struct OllamaModel {
    name: String,
    model: Option<String>,
    modified_at: Option<String>,
    size: Option<u64>,
    digest: Option<String>,
    details: Option<ModelDetails>,
    capabilities: Option<Vec<String>>,
}

#[derive(Debug, Serialize, Deserialize)]
struct RunningModel {
    name: String,
    model: Option<String>,
    size: Option<u64>,
    size_vram: Option<u64>,
    expires_at: Option<String>,
}

#[derive(Debug, Serialize)]
struct LabStatus {
    api_ok: bool,
    service_active: bool,
    service_state: String,
    gpu_hint: String,
    ollama_installed: bool,
    ollama_version: Option<String>,
}

#[derive(Debug, Deserialize)]
struct TagsResponse {
    models: Vec<OllamaModel>,
}

#[derive(Debug, Deserialize)]
struct PsResponse {
    models: Vec<RunningModel>,
}

#[derive(Debug, Serialize, Deserialize)]
struct GenerateSettings {
    temperature: f64,
    top_p: f64,
    top_k: i64,
    repeat_penalty: f64,
    seed: i64,
    num_ctx: i64,
    num_predict: i64,
}

#[derive(Debug, Deserialize)]
struct ChatMessage {
    role: String,
    content: String,
}

#[derive(Debug, Deserialize)]
struct ChatRequest {
    run_id: Option<String>,
    model: String,
    messages: Vec<ChatMessage>,
    options: GenerateSettings,
    think: Option<Value>,
}

#[derive(Debug, Deserialize)]
struct ShowResponse {
    modelfile: Option<String>,
    parameters: Option<String>,
    template: Option<String>,
    details: Option<ModelDetails>,
    model_info: Option<HashMap<String, Value>>,
}

#[derive(Debug, Serialize)]
struct ModelMetadata {
    name: String,
    supports_thinking: bool,
    reasoning_modes: Vec<String>,
    context_length: Option<u64>,
    parameter_size: Option<String>,
    quantization_level: Option<String>,
    family: Option<String>,
    architecture: Option<String>,
    basename: Option<String>,
    organization: Option<String>,
}

#[derive(Debug, Serialize)]
struct CatalogModel {
    name: String,
    description: Option<String>,
    pulls: Option<String>,
    tag_count: Option<String>,
    updated: Option<String>,
    capabilities: Vec<String>,
    sizes: Vec<String>,
}

#[derive(Debug, Serialize)]
struct CatalogTag {
    name: String,
    size: Option<String>,
    context: Option<String>,
    input: Option<String>,
    digest: Option<String>,
    updated: Option<String>,
    quant: Option<String>,
    variant: Option<String>,
}

#[derive(Debug, Serialize)]
struct RunResult {
    model: String,
    prompt: String,
    response: String,
    thinking: Option<String>,
    total_duration: Option<u64>,
    eval_count: Option<u64>,
    eval_duration: Option<u64>,
    tokens_per_second: Option<f64>,
    created_at: String,
}

#[derive(Debug, Serialize, Clone)]
struct ChatTokenEvent {
    run_id: String,
    content: String,
}

#[derive(Debug, Serialize, Clone)]
struct ChatThinkingEvent {
    run_id: String,
    content: String,
}

fn process_chat_stream_line(
    line: &str,
    app: &tauri::AppHandle,
    run_id: &Option<String>,
    response_text: &mut String,
    thinking_text: &mut Option<String>,
    total_duration: &mut Option<u64>,
    eval_count: &mut Option<u64>,
    eval_duration: &mut Option<u64>,
) -> Result<(), String> {
    if line.is_empty() {
        return Ok(());
    }

    let value: Value = serde_json::from_str(line).map_err(|error| error.to_string())?;
    if let Some(message) = value.get("message") {
        if let Some(content) = message.get("content").and_then(Value::as_str) {
            response_text.push_str(content);
            if let Some(run_id) = run_id {
                let _ = app.emit(
                    "chat-token",
                    ChatTokenEvent {
                        run_id: run_id.clone(),
                        content: content.to_string(),
                    },
                );
            }
        }
        if let Some(reasoning) = message
            .get("thinking")
            .or_else(|| message.get("reasoning_content"))
            .and_then(Value::as_str)
        {
            thinking_text
                .get_or_insert_with(String::new)
                .push_str(reasoning);
            if let Some(run_id) = run_id {
                let _ = app.emit(
                    "chat-thinking",
                    ChatThinkingEvent {
                        run_id: run_id.clone(),
                        content: reasoning.to_string(),
                    },
                );
            }
        }
    }
    if value.get("done").and_then(Value::as_bool).unwrap_or(false) {
        *total_duration = value.get("total_duration").and_then(Value::as_u64);
        *eval_count = value.get("eval_count").and_then(Value::as_u64);
        *eval_duration = value.get("eval_duration").and_then(Value::as_u64);
    }

    Ok(())
}

async fn mark_chat_cancelled(run_id: String) {
    CANCELLED_CHAT_RUNS.lock().await.insert(run_id);
    CHAT_CANCEL_NOTIFY.notify_waiters();
}

async fn clear_chat_cancelled(run_id: &Option<String>) {
    if let Some(run_id) = run_id {
        CANCELLED_CHAT_RUNS.lock().await.remove(run_id);
    }
}

async fn is_chat_cancelled(run_id: &Option<String>) -> bool {
    let Some(run_id) = run_id else {
        return false;
    };
    CANCELLED_CHAT_RUNS.lock().await.contains(run_id)
}

async fn wait_for_chat_cancel(run_id: &Option<String>) {
    while !is_chat_cancelled(run_id).await {
        CHAT_CANCEL_NOTIFY.notified().await;
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct PullProgress {
    status: String,
    digest: Option<String>,
    total: Option<u64>,
    completed: Option<u64>,
}

#[derive(Debug, Serialize, Clone)]
struct PullProgressEvent {
    model: String,
    progress: PullProgress,
}

async fn command_output(program: &str, args: &[&str]) -> Option<String> {
    let output = Command::new(program)
        .args(args)
        .stdin(Stdio::null())
        .stderr(Stdio::null())
        .output()
        .await
        .ok()?;
    Some(String::from_utf8_lossy(&output.stdout).trim().to_string())
}

async fn command_success(program: &str, args: &[&str]) -> bool {
    Command::new(program)
        .args(args)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .await
        .map(|status| status.success())
        .unwrap_or(false)
}

fn spawn_terminal_owned(program: &str, args: &[String]) -> bool {
    Command::new(program)
        .args(args)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .is_ok()
}

fn client() -> Client {
    HTTP_CLIENT.clone()
}

fn string_model_info(model_info: &Option<HashMap<String, Value>>, key: &str) -> Option<String> {
    model_info
        .as_ref()
        .and_then(|info| info.get(key))
        .and_then(Value::as_str)
        .map(ToString::to_string)
}

fn number_model_info(model_info: &Option<HashMap<String, Value>>, key: &str) -> Option<u64> {
    model_info
        .as_ref()
        .and_then(|info| info.get(key))
        .and_then(Value::as_u64)
}

fn supports_thinking(show: &ShowResponse) -> bool {
    [&show.template, &show.modelfile, &show.parameters]
        .iter()
        .filter_map(|value| value.as_ref())
        .any(|value| {
            let lower = value.to_lowercase();
            lower.contains("enable_thinking")
                || lower.contains("reasoning_content")
                || lower.contains("<think>")
        })
}

fn reasoning_modes(name: &str, show: &ShowResponse) -> Vec<String> {
    if !supports_thinking(show) {
        return Vec::new();
    }

    let mut sources = vec![name.to_string()];
    sources.extend(
        [&show.template, &show.modelfile, &show.parameters]
            .iter()
            .filter_map(|value| value.as_ref().cloned()),
    );
    if let Some(model_info) = &show.model_info {
        for key in [
            "general.basename",
            "general.organization",
            "general.architecture",
        ] {
            if let Some(value) = model_info.get(key).and_then(Value::as_str) {
                sources.push(value.to_string());
            }
        }
    }

    let combined = sources.join("\n").to_lowercase();
    if combined.contains("gpt-oss")
        || combined.contains("reasoning_effort")
        || combined.contains("reasoning effort")
    {
        return ["low", "medium", "high"]
            .into_iter()
            .map(ToString::to_string)
            .collect();
    }

    ["off", "on"].into_iter().map(ToString::to_string).collect()
}

async fn inspect_model_metadata(
    client: Client,
    name: String,
) -> Result<Option<ModelMetadata>, String> {
    let response = client
        .post(format!("{OLLAMA_URL}/api/show"))
        .json(&json!({ "model": name }))
        .send()
        .await
        .map_err(|error| format!("Could not inspect Ollama model: {error}"))?;
    if !response.status().is_success() {
        return Ok(None);
    }

    let show = response
        .json::<ShowResponse>()
        .await
        .map_err(|error| error.to_string())?;
    let context_length = show
        .details
        .as_ref()
        .and_then(|details| details.context_length)
        .or_else(|| number_model_info(&show.model_info, "llama.context_length"));
    let parameter_size = show
        .details
        .as_ref()
        .and_then(|details| details.parameter_size.clone())
        .or_else(|| string_model_info(&show.model_info, "general.size_label"));
    let quantization_level = show
        .details
        .as_ref()
        .and_then(|details| details.quantization_level.clone());
    let family = show
        .details
        .as_ref()
        .and_then(|details| details.family.clone());

    let reasoning_modes = reasoning_modes(&name, &show);
    Ok(Some(ModelMetadata {
        name,
        supports_thinking: supports_thinking(&show),
        reasoning_modes,
        context_length,
        parameter_size,
        quantization_level,
        family,
        architecture: string_model_info(&show.model_info, "general.architecture"),
        basename: string_model_info(&show.model_info, "general.basename"),
        organization: string_model_info(&show.model_info, "general.organization"),
    }))
}

fn strip_html(value: &str) -> String {
    let tag_re = Regex::new(r"(?s)<[^>]+>").expect("valid regex");
    decode_html_entities(tag_re.replace_all(value, " ").as_ref())
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}

fn decode_html_entities(value: &str) -> String {
    value
        .replace("&#39;", "'")
        .replace("&quot;", "\"")
        .replace("&amp;", "&")
        .replace("&nbsp;", " ")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
}

fn encode_query(value: &str) -> String {
    value
        .bytes()
        .flat_map(|byte| match byte {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                vec![byte as char]
            }
            b' ' => vec!['+'],
            _ => format!("%{byte:02X}").chars().collect(),
        })
        .collect()
}

fn captures_text(block: &str, pattern: &str) -> Option<String> {
    Regex::new(pattern)
        .ok()?
        .captures(block)
        .and_then(|captures| captures.get(1))
        .map(|match_| strip_html(match_.as_str()))
        .filter(|value| !value.is_empty())
}

fn captures_many(block: &str, pattern: &str) -> Vec<String> {
    let Ok(regex) = Regex::new(pattern) else {
        return Vec::new();
    };
    regex
        .captures_iter(block)
        .filter_map(|captures| captures.get(1))
        .map(|match_| strip_html(match_.as_str()))
        .filter(|value| !value.is_empty())
        .collect()
}

fn infer_quant(name: &str) -> Option<String> {
    let tag = name.split(':').nth(1)?;
    let lower = tag.to_lowercase();
    for marker in [
        "q2_k", "q3_k_s", "q3_k_m", "q3_k_l", "q4_0", "q4_1", "q4_k_s", "q4_k_m", "q5_0", "q5_1",
        "q5_k_s", "q5_k_m", "q6_k", "q8_0", "fp16", "f16",
    ] {
        if lower.contains(marker) {
            return Some(marker.to_uppercase());
        }
    }
    None
}

fn infer_variant(name: &str) -> Option<String> {
    let tag = name.split(':').nth(1)?;
    let cleaned = tag
        .replace("-instruct", "")
        .replace("-text", "")
        .replace("-q2_K", "")
        .replace("-q3_K_S", "")
        .replace("-q3_K_M", "")
        .replace("-q3_K_L", "")
        .replace("-q4_0", "")
        .replace("-q4_1", "")
        .replace("-q4_K_S", "")
        .replace("-q4_K_M", "")
        .replace("-q5_0", "")
        .replace("-q5_1", "")
        .replace("-q5_K_S", "")
        .replace("-q5_K_M", "")
        .replace("-q6_K", "")
        .replace("-q8_0", "")
        .replace("-fp16", "");
    if cleaned.is_empty() || cleaned == "latest" {
        None
    } else {
        Some(cleaned)
    }
}

fn parse_catalog_search(html: &str) -> Vec<CatalogModel> {
    let block_re = Regex::new(r#"(?s)<li x-test-model.*?</li>"#).expect("valid regex");
    let href_re = Regex::new(r#"href="/library/([^":]+)""#).expect("valid regex");

    block_re
        .find_iter(html)
        .filter_map(|block_match| {
            let block = block_match.as_str();
            let name = href_re
                .captures(block)
                .and_then(|captures| captures.get(1))
                .map(|match_| decode_html_entities(match_.as_str()))?;
            Some(CatalogModel {
                name,
                description: captures_text(block, r#"(?s)<p class="max-w-lg[^"]*">(.*?)</p>"#),
                pulls: captures_text(block, r#"(?s)<span x-test-pull-count>(.*?)</span>"#),
                tag_count: captures_text(block, r#"(?s)<span x-test-tag-count>(.*?)</span>"#),
                updated: captures_text(block, r#"(?s)<span x-test-updated>(.*?)</span>"#),
                capabilities: captures_many(
                    block,
                    r#"(?s)<span x-test-capability[^>]*>(.*?)</span>"#,
                ),
                sizes: captures_many(block, r#"(?s)<span x-test-size[^>]*>(.*?)</span>"#),
            })
        })
        .collect()
}

fn parse_catalog_tags(html: &str) -> Vec<CatalogTag> {
    let mobile_re = Regex::new(r#"(?s)<a href="/library/([^"]+)" class="md:hidden.*?</a>"#)
        .expect("valid regex");
    let name_re = Regex::new(r#"/library/([^"]+)""#).expect("valid regex");
    let digest_re = Regex::new(r#">([a-f0-9]{12})</span>"#).expect("valid regex");
    let size_context_re =
        Regex::new(r#"•\s*([^•<]+?)\s*•\s*([^•<]+?)\s+context window"#).expect("valid regex");
    let input_re = Regex::new(r#"context window\s*•\s*([^•<]+?)\s+input"#).expect("valid regex");
    let updated_re = Regex::new(r#"input\s*•\s*([^<]+?)\s*<"#).expect("valid regex");

    let mut tags = Vec::new();
    for block_match in mobile_re.find_iter(html) {
        let block = block_match.as_str();
        let Some(name) = name_re
            .captures(block)
            .and_then(|captures| captures.get(1))
            .map(|match_| decode_html_entities(match_.as_str()))
        else {
            continue;
        };
        if tags.iter().any(|tag: &CatalogTag| tag.name == name) {
            continue;
        }

        let size_context = size_context_re.captures(block);
        tags.push(CatalogTag {
            quant: infer_quant(&name),
            variant: infer_variant(&name),
            name,
            size: size_context
                .as_ref()
                .and_then(|captures| captures.get(1))
                .map(|match_| strip_html(match_.as_str())),
            context: size_context
                .as_ref()
                .and_then(|captures| captures.get(2))
                .map(|match_| strip_html(match_.as_str())),
            input: input_re
                .captures(block)
                .and_then(|captures| captures.get(1))
                .map(|match_| strip_html(match_.as_str())),
            digest: digest_re
                .captures(block)
                .and_then(|captures| captures.get(1))
                .map(|match_| match_.as_str().to_string()),
            updated: updated_re
                .captures(block)
                .and_then(|captures| captures.get(1))
                .map(|match_| strip_html(match_.as_str())),
        });
    }

    tags
}

#[tauri::command]
async fn install_ollama() -> Result<(), String> {
    let script = "curl -fsSL https://ollama.com/install.sh | sh; status=$?; echo; if [ $status -eq 0 ]; then echo 'Ollama installer finished.'; else echo \"Ollama installer failed with status $status.\"; fi; read -r -p 'Press Enter to close...'; exit $status";
    let escaped_script = script.replace('"', "\\\"");
    let candidates: Vec<(&str, Vec<String>)> = vec![
        ("x-terminal-emulator", vec!["-e", "bash", "-lc", script]),
        ("gnome-terminal", vec!["--", "bash", "-lc", script]),
        ("kgx", vec!["--", "bash", "-lc", script]),
        ("konsole", vec!["-e", "bash", "-lc", script]),
        (
            "xfce4-terminal",
            vec!["--command", &format!("bash -lc \"{escaped_script}\"")],
        ),
        ("mate-terminal", vec!["--", "bash", "-lc", script]),
        ("alacritty", vec!["-e", "bash", "-lc", script]),
        ("xterm", vec!["-e", "bash", "-lc", script]),
    ]
    .into_iter()
    .map(|(program, args)| (program, args.into_iter().map(ToString::to_string).collect()))
    .collect();

    for (program, args) in candidates.iter() {
        if spawn_terminal_owned(program, args) {
            return Ok(());
        }
    }

    Err("Could not find a supported terminal emulator to run the Ollama installer.".to_string())
}

#[tauri::command]
async fn ollama_status() -> Result<LabStatus, String> {
    let ollama_version = command_output("ollama", &["--version"])
        .await
        .filter(|value| !value.is_empty());
    let ollama_installed = ollama_version.is_some();

    let api_ok = client()
        .get(format!("{OLLAMA_URL}/api/tags"))
        .send()
        .await
        .map(|response| response.status().is_success())
        .unwrap_or(false);

    let user_active =
        command_success("systemctl", &["--user", "is-active", "--quiet", "ollama"]).await;
    let system_active = command_success("systemctl", &["is-active", "--quiet", "ollama"]).await;
    let service_active = user_active || system_active;

    let service_state = if service_active {
        "active".to_string()
    } else {
        command_output("systemctl", &["--user", "is-active", "ollama"])
            .await
            .filter(|state| !state.is_empty())
            .unwrap_or_else(|| "inactive".to_string())
    };

    let gpu_hint = if command_success("nvidia-smi", &["-L"]).await {
        command_output(
            "nvidia-smi",
            &[
                "--query-gpu=name,memory.used",
                "--format=csv,noheader,nounits",
            ],
        )
        .await
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| "nvidia available".to_string())
    } else {
        "unknown".to_string()
    };

    Ok(LabStatus {
        api_ok,
        service_active,
        service_state,
        gpu_hint,
        ollama_installed,
        ollama_version,
    })
}

#[tauri::command]
async fn model_metadata(names: Vec<String>) -> Result<Vec<ModelMetadata>, String> {
    let client = client();
    let metadata = stream::iter(names.into_iter().map(|name| {
        let client = client.clone();
        async move { inspect_model_metadata(client, name).await }
    }))
    .buffer_unordered(METADATA_CONCURRENCY)
    .filter_map(|result| async move { result.ok().flatten() })
    .collect()
    .await;

    Ok(metadata)
}

#[tauri::command]
async fn list_models() -> Result<Vec<OllamaModel>, String> {
    let response = client()
        .get(format!("{OLLAMA_URL}/api/tags"))
        .send()
        .await
        .map_err(|error| format!("Could not reach Ollama /api/tags: {error}"))?;
    if !response.status().is_success() {
        return Err(format!("Ollama returned {}", response.status()));
    }
    let tags = response
        .json::<TagsResponse>()
        .await
        .map_err(|error| error.to_string())?;
    Ok(tags.models)
}

#[tauri::command]
async fn running_models() -> Result<Vec<RunningModel>, String> {
    let response = client()
        .get(format!("{OLLAMA_URL}/api/ps"))
        .send()
        .await
        .map_err(|error| format!("Could not reach Ollama /api/ps: {error}"))?;
    if !response.status().is_success() {
        return Ok(Vec::new());
    }
    let ps = response
        .json::<PsResponse>()
        .await
        .map_err(|error| error.to_string())?;
    Ok(ps.models)
}

fn running_model_identifier(model: &RunningModel) -> &str {
    model.model.as_deref().unwrap_or(&model.name)
}

fn other_running_model_names<'a>(models: &'a [RunningModel], target: &str) -> Vec<&'a str> {
    models
        .iter()
        .map(running_model_identifier)
        .filter(|name| *name != target)
        .collect()
}

fn unload_model_payload(name: &str) -> Value {
    json!({ "model": name, "prompt": "", "stream": false, "keep_alive": 0 })
}

fn load_model_payload(name: &str) -> Value {
    json!({ "model": name, "prompt": "", "stream": false, "keep_alive": "-1" })
}

async fn unload_model_inner(name: &str) -> Result<(), String> {
    let response = client()
        .post(format!("{OLLAMA_URL}/api/generate"))
        .json(&unload_model_payload(name))
        .send()
        .await
        .map_err(|error| format!("Unload request failed: {error}"))?;

    if response.status().is_success() {
        Ok(())
    } else {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        Err(format!("Ollama returned {status}: {body}"))
    }
}

async fn unload_other_models(target: &str) -> Result<(), String> {
    let models = running_models().await?;
    for name in other_running_model_names(&models, target) {
        unload_model_inner(name).await?;
    }
    Ok(())
}

#[tauri::command]
async fn unload_model(name: String) -> Result<Vec<RunningModel>, String> {
    let name = name.trim();
    if name.is_empty() {
        return running_models().await;
    }
    unload_model_inner(name).await?;
    running_models().await
}

#[tauri::command]
async fn load_model(name: String) -> Result<Vec<RunningModel>, String> {
    let name = name.trim();
    if name.is_empty() {
        return running_models().await;
    }
    unload_other_models(name).await?;

    let response = client()
        .post(format!("{OLLAMA_URL}/api/generate"))
        .json(&load_model_payload(name))
        .send()
        .await
        .map_err(|error| format!("Load request failed: {error}"))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(format!("Ollama returned {status}: {body}"));
    }

    running_models().await
}

#[tauri::command]
async fn search_catalog(query: String) -> Result<Vec<CatalogModel>, String> {
    let query = query.trim();
    if query.is_empty() {
        return Ok(Vec::new());
    }

    let response = client()
        .get(format!(
            "{OLLAMA_LIBRARY_URL}/search?q={}",
            encode_query(query)
        ))
        .send()
        .await
        .map_err(|error| format!("Could not search Ollama catalog: {error}"))?;
    if !response.status().is_success() {
        return Err(format!("Ollama catalog returned {}", response.status()));
    }

    let html = response.text().await.map_err(|error| error.to_string())?;
    Ok(parse_catalog_search(&html))
}

#[tauri::command]
async fn catalog_model_tags(model: String) -> Result<Vec<CatalogTag>, String> {
    let model = model
        .trim()
        .trim_start_matches("library/")
        .trim_matches('/');
    if model.is_empty() || model.contains(':') {
        return Ok(Vec::new());
    }

    let response = client()
        .get(format!("{OLLAMA_LIBRARY_URL}/library/{model}/tags"))
        .send()
        .await
        .map_err(|error| format!("Could not load Ollama tags: {error}"))?;
    if !response.status().is_success() {
        return Err(format!("Ollama catalog returned {}", response.status()));
    }

    let html = response.text().await.map_err(|error| error.to_string())?;
    Ok(parse_catalog_tags(&html))
}

#[tauri::command]
async fn cancel_chat(run_id: String) -> Result<(), String> {
    mark_chat_cancelled(run_id).await;
    Ok(())
}

#[tauri::command]
async fn chat_model(app: tauri::AppHandle, request: ChatRequest) -> Result<RunResult, String> {
    clear_chat_cancelled(&request.run_id).await;
    unload_other_models(&request.model).await?;

    let prompt = request
        .messages
        .last()
        .map(|message| message.content.clone())
        .unwrap_or_default();

    let messages: Vec<Value> = request
        .messages
        .into_iter()
        .map(|message| json!({ "role": message.role, "content": message.content }))
        .collect();

    let options = json!({
            "temperature": request.options.temperature,
            "top_p": request.options.top_p,
            "top_k": request.options.top_k,
            "repeat_penalty": request.options.repeat_penalty,
            "seed": request.options.seed,
            "num_ctx": request.options.num_ctx,
            "num_predict": request.options.num_predict
    });

    let mut payload = json!({
        "model": request.model,
        "stream": true,
        "messages": messages,
        "options": options
    });
    if let Some(think) = request.think {
        payload["think"] = json!(think);
    }

    let response = client()
        .post(format!("{OLLAMA_URL}/api/chat"))
        .json(&payload)
        .send()
        .await
        .map_err(|error| format!("Chat request failed: {error}"))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(format!("Ollama returned {status}: {body}"));
    }

    let run_id = request.run_id.clone();
    let mut stream = response.bytes_stream();
    let mut pending = Vec::new();
    let mut response_text = String::new();
    let mut thinking_text: Option<String> = None;
    let mut total_duration = None;
    let mut eval_count = None;
    let mut eval_duration = None;

    loop {
        let next_chunk = stream.next();
        let cancel = wait_for_chat_cancel(&run_id);
        pin_mut!(next_chunk, cancel);
        let chunk = match select(next_chunk, cancel).await {
            Either::Left((chunk, _)) => chunk,
            Either::Right((_, _)) => break,
        };

        let Some(chunk) = chunk else {
            break;
        };
        let chunk = chunk.map_err(|error| format!("Ollama stream failed: {error}"))?;
        pending.extend_from_slice(&chunk);

        while let Some(newline_index) = pending.iter().position(|byte| *byte == b'\n') {
            let line_bytes: Vec<u8> = pending.drain(..=newline_index).collect();
            let line = String::from_utf8_lossy(&line_bytes).trim().to_string();
            process_chat_stream_line(
                &line,
                &app,
                &run_id,
                &mut response_text,
                &mut thinking_text,
                &mut total_duration,
                &mut eval_count,
                &mut eval_duration,
            )?;
        }
    }
    let was_cancelled = is_chat_cancelled(&run_id).await;

    let final_line = String::from_utf8_lossy(&pending).trim().to_string();
    if !was_cancelled && !final_line.is_empty() {
        process_chat_stream_line(
            &final_line,
            &app,
            &run_id,
            &mut response_text,
            &mut thinking_text,
            &mut total_duration,
            &mut eval_count,
            &mut eval_duration,
        )?;
    }
    clear_chat_cancelled(&run_id).await;

    let tokens_per_second = match (eval_count, eval_duration) {
        (Some(count), Some(duration)) if duration > 0 => {
            Some(count as f64 / (duration as f64 / 1_000_000_000.0))
        }
        _ => None,
    };

    Ok(RunResult {
        model: request.model,
        prompt,
        response: response_text,
        thinking: thinking_text,
        total_duration,
        eval_count,
        eval_duration,
        tokens_per_second,
        created_at: Utc::now().to_rfc3339(),
    })
}

#[tauri::command]
async fn pull_model(app: tauri::AppHandle, name: String) -> Result<Vec<PullProgress>, String> {
    let response = client()
        .post(format!("{OLLAMA_URL}/api/pull"))
        .json(&json!({ "name": name, "stream": true }))
        .send()
        .await
        .map_err(|error| format!("Pull request failed: {error}"))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(format!("Ollama returned {status}: {body}"));
    }

    let mut progress = Vec::new();
    let mut stream = response.bytes_stream();
    let mut buffer = Vec::new();

    while let Some(chunk) = stream.next().await {
        buffer.extend_from_slice(&chunk.map_err(|error| error.to_string())?);
        while let Some(position) = buffer.iter().position(|byte| *byte == b'\n') {
            let line: Vec<u8> = buffer.drain(..=position).collect();
            let text = String::from_utf8_lossy(&line);
            let trimmed = text.trim();
            if trimmed.is_empty() {
                continue;
            }
            if let Ok(item) = serde_json::from_str::<PullProgress>(trimmed) {
                let _ = app.emit(
                    "pull-progress",
                    PullProgressEvent {
                        model: name.clone(),
                        progress: item.clone(),
                    },
                );
                progress.push(item);
            }
        }
    }

    Ok(progress)
}

#[tauri::command]
async fn delete_model(name: String) -> Result<(), String> {
    let response = client()
        .delete(format!("{OLLAMA_URL}/api/delete"))
        .json(&json!({ "name": name }))
        .send()
        .await
        .map_err(|error| format!("Delete request failed: {error}"))?;

    if response.status().is_success() {
        Ok(())
    } else {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        Err(format!("Ollama returned {status}: {body}"))
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let window = app.get_webview_window("main").expect("main window exists");
            window.set_title("Ollama Model Lab")?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            ollama_status,
            model_metadata,
            list_models,
            running_models,
            load_model,
            unload_model,
            search_catalog,
            catalog_model_tags,
            cancel_chat,
            chat_model,
            pull_model,
            install_ollama,
            delete_model
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::*;

    fn running(name: &str, model: Option<&str>) -> RunningModel {
        RunningModel {
            name: name.to_string(),
            model: model.map(str::to_string),
            size: None,
            size_vram: None,
            expires_at: None,
        }
    }

    #[test]
    fn unload_payload_uses_keep_alive_zero() {
        assert_eq!(
            unload_model_payload("llama3.2:latest"),
            json!({
                "model": "llama3.2:latest",
                "prompt": "",
                "stream": false,
                "keep_alive": 0
            })
        );
    }

    #[test]
    fn load_payload_keeps_model_loaded_indefinitely() {
        assert_eq!(
            load_model_payload("llama3.2:latest"),
            json!({
                "model": "llama3.2:latest",
                "prompt": "",
                "stream": false,
                "keep_alive": "-1"
            })
        );
    }

    #[test]
    fn running_model_identifier_prefers_model_field() {
        let item = running("display-name", Some("actual-model:latest"));
        assert_eq!(running_model_identifier(&item), "actual-model:latest");
    }

    #[test]
    fn running_model_identifier_falls_back_to_name() {
        let item = running("actual-model:latest", None);
        assert_eq!(running_model_identifier(&item), "actual-model:latest");
    }

    #[test]
    fn other_running_model_names_excludes_target_model() {
        let models = vec![
            running("llama3.2:latest", None),
            running("display-minicpm", Some("minicpm5:latest")),
            running("qwen2.5:latest", None),
        ];

        assert_eq!(
            other_running_model_names(&models, "minicpm5:latest"),
            vec!["llama3.2:latest", "qwen2.5:latest"]
        );
    }

    #[test]
    fn other_running_model_names_keeps_all_when_target_absent() {
        let models = vec![
            running("llama3.2:latest", None),
            running("qwen2.5:latest", None),
        ];

        assert_eq!(
            other_running_model_names(&models, "minicpm5:latest"),
            vec!["llama3.2:latest", "qwen2.5:latest"]
        );
    }
}
