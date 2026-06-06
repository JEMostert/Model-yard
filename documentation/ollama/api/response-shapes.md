# Response Shapes And App Mapping

This file maps Ollama fields to Model Yard state.

## Model Inventory: `/api/tags`

```ts
type TagsResponse = {
  models: Array<{
    name: string;
    model?: string;
    modified_at?: string;
    size?: number;
    digest?: string;
    details?: {
      parent_model?: string;
      format?: string;
      family?: string;
      families?: string[];
      parameter_size?: string;
      quantization_level?: string;
      context_length?: number;
      embedding_length?: number;
    };
    capabilities?: string[];
  }>;
};
```

Use in UI:

- `name`: model picker primary label.
- `size`: disk size badge.
- `details.parameter_size`: compact model scale badge.
- `details.quantization_level`: quantization badge.
- `details.family`: model family badge.
- `capabilities`: useful, but not sufficient alone for all UI feature gates.

## Model Details: `/api/show`

```ts
type ShowResponse = {
  modelfile?: string;
  parameters?: string;
  template?: string;
  details?: ModelDetails;
  model_info?: Record<string, unknown>;
};
```

Important `model_info` keys observed for MiniCPM5:

- `general.architecture`
- `general.basename`
- `general.organization`
- `general.parameter_count`
- `general.size_label`
- `llama.context_length`
- `llama.embedding_length`
- tokenizer keys such as `tokenizer.ggml.model`

Use in UI:

- Context slider max/default hints.
- Thinking toggle support.
- Model cards and inspector details.
- Capability/compatibility warnings.

## Chat Streaming: `/api/chat`

Streaming response chunks are newline-delimited JSON objects. Chunks can contain partial `message.content`, partial `message.thinking`, tool calls, and final metrics.

Suggested frontend state:

```ts
type StreamingAssistantMessage = {
  runId: string;
  model: string;
  prompt: string;
  content: string;
  thinking: string;
  createdAt: string;
  done: boolean;
  stats?: {
    totalDuration?: number;
    evalCount?: number;
    evalDuration?: number;
    tokensPerSecond?: number;
  };
};
```

Current app note:

- Model Yard currently streams `message.content` through Tauri events.
- Next improvement: also emit and render `message.thinking` separately.

## Duration Units

Ollama returns durations in nanoseconds. Convert for display:

```ts
seconds = ns / 1_000_000_000
tokensPerSecond = eval_count / (eval_duration / 1_000_000_000)
```

