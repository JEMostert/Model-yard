# Streaming And Thinking

## Streaming

The REST API streams by default. For `POST /api/chat`, set `stream: true` explicitly in Model Yard so behavior is intentional.

Why streaming matters:

- The UI can render output as the model generates it.
- Users see hardware speed directly.
- Long responses feel responsive.
- Thinking traces and tool calls can appear before the final answer.

The stream is newline-delimited JSON. Each line should be parsed independently after a newline boundary. Do not split UTF-8 strings manually; buffer bytes until a newline.

Source: https://docs.ollama.com/capabilities/streaming

## Thinking

Thinking-capable models can return reasoning trace separately from final answer.

Request shape:

```json
{
  "model": "qwen3",
  "messages": [{ "role": "user", "content": "What is 17 x 23?" }],
  "think": true,
  "stream": true
}
```

For most supported thinking models, `think` can be boolean. GPT-OSS is special: Ollama documents `think` levels `"low"`, `"medium"`, and `"high"` instead of simple full disable/enable behavior.

Response handling:

- `message.thinking`: reasoning trace.
- `message.content`: final answer.
- Thinking chunks may arrive before answer chunks.
- The UI should accumulate thinking and content separately.

Source: https://docs.ollama.com/capabilities/thinking

## Feature Detection

Do not infer thinking support from the model name. Use `/api/show`.

Useful signals:

- Template references to `enable_thinking`.
- Template or content handling for `reasoning_content`.
- Template handling for `<think>` / `</think>`.
- Official `capabilities` if Ollama exposes a thinking capability in future versions.

MiniCPM5 example observed on this machine:

- `/api/show` template contains `enable_thinking`.
- This is a stronger signal than the model name.

## Model Yard Implementation Guidance

Current implemented direction:

- Rust calls Ollama with `stream: true`.
- Rust emits `chat-token` Tauri events for `message.content`.
- React appends chunks live.

Next improvement:

- Emit separate `chat-thinking` events for `message.thinking`.
- Render a collapsible "Thinking" block above the final answer.
- Persist thinking only if the user explicitly chooses to keep traces.
- Add level support for models that require `"low"`, `"medium"`, or `"high"`.

