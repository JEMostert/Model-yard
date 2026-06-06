# Model Storage

Ollama stores models in a content-addressed layout:

- Manifests map a model name/tag to blobs.
- Blobs hold model weights, templates, parameters, and config layers.
- The same blobs can be shared across models.

Typical shape:

```text
<ollama-model-root>/
  manifests/
    registry.ollama.ai/
      <namespace>/
        <model>/
          <tag>
  blobs/
    sha256-...
```

Example manifest observed locally:

```text
/var/lib/ollama/manifests/registry.ollama.ai/openbmb/minicpm5/latest
```

That manifest referenced:

- a model blob
- a template blob
- a params blob
- a config digest

## Where The Root Lives

The model root depends on how Ollama is started.

Common cases:

- User-run Ollama: usually under the user's home directory.
- Linux system service: often under the service user's home or configured path.
- Docker: volume-mounted path inside the container.
- Custom path: `OLLAMA_MODELS`.

This machine:

```text
systemd service: /usr/lib/systemd/system/ollama.service
User: ollama
Environment: HOME=/var/lib/ollama OLLAMA_MODELS=/var/lib/ollama
```

So this install stores model data under:

```text
/var/lib/ollama
```

The user home `~/.ollama/models` was empty on this machine because the running server is a system service, not a user-scoped process.

## App Rule

Do not use direct filesystem reads as the normal app data source.

Reasons:

- Path varies by OS, service manager, Docker, and `OLLAMA_MODELS`.
- Permissions may block reading service-owned files.
- Direct blob parsing couples the app to internal storage details.
- Ollama already resolves manifests/templates/parameters through `/api/show`.

Use filesystem inspection only for diagnostics or developer documentation. App features should use:

- `/api/tags` for installed model inventory.
- `/api/show` for model metadata/template/parameters.
- `/api/ps` for loaded model/runtime state.

Sources:

- Ollama Modelfile reference: https://docs.ollama.com/modelfile
- Ollama FAQ/environment behavior: https://docs.ollama.com/faq
- Ollama API docs: https://docs.ollama.com/api

