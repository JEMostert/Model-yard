# Product Guidance For Model Yard

Model Yard is a local-first Ollama workbench. The app should make local model behavior inspectable instead of hiding it behind generic chat UI.

## UI Surfaces

### Chat Composer

Controls inside the composer should affect the next run directly:

- Model picker
- Mode: chat / compare / bench
- Thinking toggle or thinking level, if supported by selected model metadata
- Refresh models
- Send/stop

Controls outside the composer should describe environment/session state:

- Local-only status
- Ollama connection status
- Loaded/idle selected model state
- Runtime processor/context status

### Model Picker

Use `/api/tags` plus `/api/show` metadata.

Show:

- Model display name
- Namespace/tag
- Parameter size
- Quantization
- Family/architecture
- Context length
- Thinking support badge
- Loaded state from `/api/ps`

### Inspector

Expose data that helps users understand model behavior:

- Modelfile parameters
- Template preview
- Context length
- Stop sequences
- Native model info
- Runtime loaded state
- VRAM usage

## Streaming Chat

Use real streaming, not replay.

Backend:

- Call `/api/chat` with `stream: true`.
- Parse NDJSON line by line.
- Emit content chunks and thinking chunks through Tauri events.
- Return final stats when done.

Frontend:

- Append content chunks live.
- Render markdown progressively.
- Render thinking trace separately and optionally collapsed.
- Show stats after final chunk.

## Thinking UX

Thinking is a model capability and sometimes a user preference.

Recommended UI:

- If unsupported: hide thinking controls.
- If boolean: show `Think` toggle.
- If level-based: show segmented control `Low / Medium / High`.
- If thinking streams: show a collapsible "Thinking" region above the final answer.
- Consider a user preference for whether thinking traces are saved to history.

## Avoid

- Name-based feature gates.
- Reading Ollama model blobs directly for normal app behavior.
- Fake typewriter replay when real streaming is available.
- Treating `/api/tags` as full model metadata.
- Showing generation settings only in a hidden side panel when they directly affect the next run.

