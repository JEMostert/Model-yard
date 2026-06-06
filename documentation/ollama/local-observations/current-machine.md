# Local Machine Observations

Date: 2026-06-06

These notes describe this development machine only. Do not hard-code these paths into the app.

## Ollama Server

Observed systemd service:

```text
FragmentPath=/usr/lib/systemd/system/ollama.service
ExecStart=/usr/bin/ollama serve
Environment=HOME=/var/lib/ollama OLLAMA_MODELS=/var/lib/ollama
User=ollama
```

Implication:

- The active model store is `/var/lib/ollama`.
- `~/.ollama/models` for the desktop user may be empty.

## Installed Models

Observed through `ollama list`:

```text
openbmb/minicpm5:latest
```

Observed `/api/tags` details:

```json
{
  "name": "openbmb/minicpm5:latest",
  "size": 688066595,
  "details": {
    "format": "gguf",
    "family": "llama",
    "parameter_size": "1.1B",
    "quantization_level": "Q4_K_M",
    "context_length": 131072,
    "embedding_length": 1536
  },
  "capabilities": ["completion"]
}
```

## Storage Files

Observed manifest:

```text
/var/lib/ollama/manifests/registry.ollama.ai/openbmb/minicpm5/latest
```

Observed blobs:

```text
/var/lib/ollama/blobs/sha256-81b64d05a23b17b34c475f42b3e72fbde62d4b92cc34541f7a8031d0752deafa
/var/lib/ollama/blobs/sha256-e4cdf07bba38b2ccc4e1aef22dd90e16ee50cc0418fbeea3aa08c3b6988c0423
/var/lib/ollama/blobs/sha256-1ec0a7ff023b5eaf6a6442bb93a38188042521e3d0de7663b16712b36edb6fc1
/var/lib/ollama/blobs/sha256-e33850f4b8dc5490d0d5b22d01d0e2f33a268be21afbc10c2a7b5a4578a08898
```

The manifest maps model/template/parameter layers to these blobs. Use `/api/show` instead of reading them in app code.

## MiniCPM5 Thinking Signal

Observed `/api/show` result:

- `template` contains `enable_thinking`.
- `model_info.general.basename` is `MiniCPM5`.
- `model_info.general.organization` is `Openbmb`.
- `model_info.llama.context_length` is `131072`.

This confirms the app should detect thinking support from `/api/show` template/config data.

