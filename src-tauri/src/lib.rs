use chrono::Utc;
use futures_util::StreamExt;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::process::Stdio;
use tauri::{Emitter, Manager};
use tokio::process::Command;

const OLLAMA_URL: &str = "http://localhost:11434";

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
struct ChatRequest {
    run_id: Option<String>,
    model: String,
    prompt: String,
    system_prompt: String,
    options: GenerateSettings,
    think: Option<bool>,
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
    context_length: Option<u64>,
    parameter_size: Option<String>,
    quantization_level: Option<String>,
    family: Option<String>,
    architecture: Option<String>,
    basename: Option<String>,
    organization: Option<String>,
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
            thinking_text.get_or_insert_with(String::new).push_str(reasoning);
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

#[derive(Debug, Serialize, Deserialize)]
struct PullProgress {
    status: String,
    digest: Option<String>,
    total: Option<u64>,
    completed: Option<u64>,
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
    Client::builder()
        .timeout(std::time::Duration::from_secs(900))
        .build()
        .expect("valid reqwest client")
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
    .map(|(program, args)| {
        (
            program,
            args.into_iter().map(ToString::to_string).collect(),
        )
    })
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
    let mut metadata = Vec::new();

    for name in names {
        let response = client
            .post(format!("{OLLAMA_URL}/api/show"))
            .json(&json!({ "model": name }))
            .send()
            .await
            .map_err(|error| format!("Could not inspect Ollama model: {error}"))?;
        if !response.status().is_success() {
            continue;
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

        metadata.push(ModelMetadata {
            name,
            supports_thinking: supports_thinking(&show),
            context_length,
            parameter_size,
            quantization_level,
            family,
            architecture: string_model_info(&show.model_info, "general.architecture"),
            basename: string_model_info(&show.model_info, "general.basename"),
            organization: string_model_info(&show.model_info, "general.organization"),
        });
    }

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

#[tauri::command]
async fn chat_model(app: tauri::AppHandle, request: ChatRequest) -> Result<RunResult, String> {
    let mut messages = Vec::new();
    if !request.system_prompt.trim().is_empty() {
        messages.push(json!({ "role": "system", "content": request.system_prompt }));
    }
    messages.push(json!({ "role": "user", "content": request.prompt }));

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

    while let Some(chunk) = stream.next().await {
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

    let final_line = String::from_utf8_lossy(&pending).trim().to_string();
    if !final_line.is_empty() {
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

    let tokens_per_second = match (eval_count, eval_duration) {
        (Some(count), Some(duration)) if duration > 0 => {
            Some(count as f64 / (duration as f64 / 1_000_000_000.0))
        }
        _ => None,
    };

    Ok(RunResult {
        model: request.model,
        prompt: request.prompt,
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
async fn pull_model(name: String) -> Result<Vec<PullProgress>, String> {
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
            chat_model,
            pull_model,
            install_ollama,
            delete_model
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
