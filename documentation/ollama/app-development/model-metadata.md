# Model Metadata Strategy

## Problem

Model names are not reliable capability data.

Bad:

```ts
model.name.includes("qwen") || model.name.includes("minicpm")
```

Why:

- Names vary by namespace and tag.
- Fine-tunes can add/remove template features.
- Hugging Face imports may use arbitrary names.
- Capabilities are model/template/config behavior, not branding.

## Correct Source

Use `/api/show` for each installed model.

The response exposes:

- `template`: prompt template used by Ollama.
- `parameters`: effective parameters from Modelfile layers.
- `modelfile`: generated Modelfile representation.
- `details`: family/format/parameter/quantization metadata.
- `model_info`: GGUF metadata such as architecture, context length, tokenizer, organization, basename.

## Thinking Support Detection

Preferred detection order:

1. Explicit official capability field if Ollama exposes one for thinking.
2. Template markers:
   - `enable_thinking`
   - `reasoning_content`
   - `<think>` / `</think>` handling
3. Modelfile/parameters markers.
4. Name heuristic only as a temporary fallback during development, not in product logic.

Current app direction:

- Rust command `model_metadata(names)` calls `/api/show`.
- React stores `Record<string, ModelMetadata>`.
- The `Think` toggle appears only when `supports_thinking` is true.
- The chat request sends `think` only for models with `supports_thinking`.

## Context Length

Context length can appear in different places:

- `/api/tags`: some versions include `details.context_length`.
- `/api/show`: `model_info` keys such as `llama.context_length`.
- `/api/ps`: allocated runtime context for loaded models.

Use cases:

- Model metadata card: max/native context from `/api/show`.
- Active runtime status: allocated context from `/api/ps`.
- Generation settings: `options.num_ctx`, bounded by model/server constraints.

Source: https://docs.ollama.com/context-length

## Metadata Cache

Suggested app flow:

1. Fetch `/api/tags`.
2. Fetch `/api/show` for each model in tags.
3. Store metadata keyed by model name.
4. Refresh after pull/delete/copy/create.
5. Do not persist metadata long-term unless versioned by digest.

Digest-aware cache key:

```text
<model-name>@<digest>
```

This avoids stale metadata after a tag is updated.

