use chrono::Utc;
use futures_util::StreamExt;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::process::Stdio;
use tauri::Manager;
use tokio::process::Command;

const OLLAMA_URL: &str = "http://localhost:11434";

#[derive(Debug, Serialize, Deserialize)]
struct ModelDetails {
    family: Option<String>,
    parameter_size: Option<String>,
    quantization_level: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
struct OllamaModel {
    name: String,
    model: Option<String>,
    modified_at: Option<String>,
    size: Option<u64>,
    digest: Option<String>,
    details: Option<ModelDetails>,
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
    model: String,
    prompt: String,
    system_prompt: String,
    options: GenerateSettings,
}

#[derive(Debug, Serialize)]
struct RunResult {
    model: String,
    prompt: String,
    response: String,
    total_duration: Option<u64>,
    eval_count: Option<u64>,
    eval_duration: Option<u64>,
    tokens_per_second: Option<f64>,
    created_at: String,
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

fn client() -> Client {
    Client::builder()
        .timeout(std::time::Duration::from_secs(900))
        .build()
        .expect("valid reqwest client")
}

#[tauri::command]
async fn ollama_status() -> Result<LabStatus, String> {
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
    })
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
async fn chat_model(request: ChatRequest) -> Result<RunResult, String> {
    let mut messages = Vec::new();
    if !request.system_prompt.trim().is_empty() {
        messages.push(json!({ "role": "system", "content": request.system_prompt }));
    }
    messages.push(json!({ "role": "user", "content": request.prompt }));

    let payload = json!({
        "model": request.model,
        "stream": false,
        "messages": messages,
        "options": {
            "temperature": request.options.temperature,
            "top_p": request.options.top_p,
            "top_k": request.options.top_k,
            "repeat_penalty": request.options.repeat_penalty,
            "seed": request.options.seed,
            "num_ctx": request.options.num_ctx,
            "num_predict": request.options.num_predict
        }
    });

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

    let value = response
        .json::<Value>()
        .await
        .map_err(|error| error.to_string())?;
    let response_text = value
        .get("message")
        .and_then(|message| message.get("content"))
        .and_then(Value::as_str)
        .unwrap_or_default()
        .to_string();
    let total_duration = value.get("total_duration").and_then(Value::as_u64);
    let eval_count = value.get("eval_count").and_then(Value::as_u64);
    let eval_duration = value.get("eval_duration").and_then(Value::as_u64);
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
            list_models,
            running_models,
            chat_model,
            pull_model,
            delete_model
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
