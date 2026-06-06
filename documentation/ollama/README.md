# Ollama Development Notes

This folder documents Ollama behavior that matters for Model Yard development.

The guiding rule: use Ollama's HTTP API as the source of truth for app behavior. Do not depend on model names, local filesystem paths, or inferred conventions when an API endpoint exposes the information.

## Files

- [api/endpoints.md](api/endpoints.md): API endpoints we use or should support.
- [api/response-shapes.md](api/response-shapes.md): Important response fields and how to map them into app state.
- [capabilities/streaming-and-thinking.md](capabilities/streaming-and-thinking.md): Streaming chunks, thinking traces, and UI handling.
- [storage/model-storage.md](storage/model-storage.md): How Ollama stores models and why the app should avoid direct filesystem coupling.
- [app-development/model-metadata.md](app-development/model-metadata.md): Metadata strategy for feature detection and UI controls.
- [app-development/product-guidance.md](app-development/product-guidance.md): Practical guidance for building Model Yard features on top of Ollama.
- [local-observations/current-machine.md](local-observations/current-machine.md): Facts observed on this development machine.

## Primary Sources

- Ollama API introduction: https://docs.ollama.com/api
- Chat endpoint: https://docs.ollama.com/api/chat
- Tags endpoint: https://docs.ollama.com/api/tags
- Running models endpoint: https://docs.ollama.com/api/ps
- Pull endpoint: https://docs.ollama.com/api/pull
- Streaming capability: https://docs.ollama.com/capabilities/streaming
- Thinking capability: https://docs.ollama.com/capabilities/thinking
- Modelfile reference: https://docs.ollama.com/modelfile
- Context length: https://docs.ollama.com/context-length
- FAQ: https://docs.ollama.com/faq

