# Ollama API Endpoints

Default local base URL:

```text
http://localhost:11434/api
```

Ollama documents the API as stable and backwards-compatible, though not strictly versioned.

## Core App Endpoints

### `POST /api/chat`

Purpose: generate the next assistant message for a conversation.

Use for:

- Chat tab
- Compare tab
- Bench tab
- Thinking-capable model runs
- Tool calling later
- Structured output later

Important request fields:

- `model`: selected model name, including namespace/tag if present.
- `messages`: chat history as `{ role, content }` objects.
- `options`: generation/runtime settings such as `temperature`, `top_p`, `top_k`, `repeat_penalty`, `seed`, `num_ctx`, `num_predict`.
- `stream`: defaults to `true` in the REST API. Use `true` for chat UI.
- `think`: `true`/`false` for most thinking models; some models can accept levels such as `"low"`, `"medium"`, `"high"`.
- `keep_alive`: controls how long the model remains loaded.
- `format`: `json` or a JSON schema for structured output.
- `tools`: future tool-calling support.

Important response fields:

- `message.content`: assistant answer text.
- `message.thinking`: separate reasoning trace for thinking-capable models.
- `message.tool_calls`: function/tool requests.
- `done`: final chunk marker.
- `done_reason`: stop reason.
- `total_duration`, `load_duration`, `prompt_eval_duration`, `eval_duration`: nanoseconds.
- `prompt_eval_count`, `eval_count`: token counts.

Implementation guidance:

- Use streaming for interactive chat.
- Accumulate `message.content` and `message.thinking` separately.
- Only persist final assembled messages to history.
- Compute tokens/sec from `eval_count / (eval_duration / 1_000_000_000)`.

Source: https://docs.ollama.com/api/chat

### `GET /api/tags`

Purpose: list locally available models.

Use for:

- Sidebar model list
- Model picker
- Default selected model
- Basic size/quantization/family labels

Important response fields:

- `models[].name`
- `models[].model`
- `models[].modified_at`
- `models[].size`
- `models[].digest`
- `models[].details.format`
- `models[].details.family`
- `models[].details.families`
- `models[].details.parameter_size`
- `models[].details.quantization_level`
- Some current Ollama builds may include extra fields such as `context_length`, `embedding_length`, or `capabilities`.

Implementation guidance:

- Treat this as the fast inventory endpoint.
- Do not use it as the only source for feature support; call `/api/show` for full model metadata.

Source: https://docs.ollama.com/api/tags

### `POST /api/show`

Purpose: inspect a single model in detail.

Use for:

- Model details panel
- Thinking support detection
- Context length discovery
- Template/system/parameter inspection
- Capability badges
- Future model cards

Important response fields observed/documented:

- `modelfile`: generated Modelfile representation.
- `parameters`: effective Modelfile parameters.
- `template`: resolved prompt template.
- `details`: family, format, quantization, parameter size.
- `model_info`: architecture-specific GGUF metadata such as context length, basename, organization, parameter count, tokenizer details.

Implementation guidance:

- Prefer `/api/show` over reading manifests/blobs.
- Detect thinking support from template/config signals such as `enable_thinking`, `message.thinking`, `reasoning_content`, or `<think>` handling.
- Cache metadata per model name during a refresh cycle; update after pull/delete.

Source: https://github.com/ollama/ollama/blob/main/docs/api.md and current `/api/show` behavior.

### `GET /api/ps`

Purpose: list models currently loaded/running in memory.

Use for:

- Loaded model status
- VRAM size display
- Keep-alive state
- Context allocation display where available

Important response fields:

- `models[].name`
- `models[].model`
- `models[].size`
- `models[].size_vram`
- `models[].expires_at`
- `models[].details`
- `models[].context_length` on current versions.

Implementation guidance:

- Use this for runtime state, not installed-model inventory.
- Refresh after generation, pull, delete, or manual refresh.

Source: https://docs.ollama.com/api/ps

### `POST /api/pull`

Purpose: download a model.

Use for:

- Pull model workflow
- Progress display

Important request fields:

- `model`: model name.
- `stream`: defaults to `true`; progress is streamed.
- `insecure`: allow insecure connections.

Important response fields:

- `status`
- `digest`, `total`, `completed` may appear in streamed progress chunks.

Implementation guidance:

- Stream progress if possible.
- After a successful pull, refresh `/api/tags`, `/api/show`, and `/api/ps`.

Source: https://docs.ollama.com/api/pull

## Other Endpoints To Consider Later

- `POST /api/generate`: prompt-completion style generation; useful for raw prompt/template experiments.
- `POST /api/embed`: embeddings/RAG.
- `POST /api/create`: create local models from Modelfiles.
- `POST /api/copy`: duplicate/rename local model references.
- `DELETE /api/delete`: remove local model.
- `GET /api/version`: server version display and compatibility checks.

