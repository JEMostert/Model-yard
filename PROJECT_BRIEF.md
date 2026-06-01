# Ollama Model Lab

Date: 2026-06-01

## Idea

Build a Tauri desktop wrapper around a local Ollama install for general model testing. The app should feel like a focused lab bench for trying models, comparing outputs, and checking practical behavior without living in the terminal.

## Goal

Create a native desktop app that talks to the local Ollama API at `http://localhost:11434`, detects installed models, lets me run prompts quickly, and makes it easy to compare models side by side.

## Target User

Me, on CachyOS/Linux with an RTX 4090 and `ollama-cuda` installed. The app should assume local-first usage and should not require cloud accounts.

## Core Features

- Detect whether Ollama is running.
- Start or guide starting `ollama.service` if it is stopped.
- List installed Ollama models.
- Pull a model by name, with progress.
- Delete local models.
- Run a simple chat against one selected model.
- Compare two or more models with the same prompt.
- Show response time, tokens per second if available, model size, and whether GPU is being used.
- Save prompt presets for repeatable testing.
- Keep lightweight test history.
- Let me edit generation parameters:
  - temperature
  - top_p
  - top_k
  - repeat_penalty
  - seed
  - context size
  - max tokens
- Export a comparison result as Markdown or JSON.

## Nice-To-Have Features

- Model tags/favorites.
- Quick benchmark mode with a small fixed prompt suite.
- Prompt templates for coding, reasoning, summarizing, creative writing, and tool-call tests.
- Chat template visibility where Ollama exposes it.
- Model memory footprint display.
- System prompt editor.
- Raw API inspector for debugging.
- Support remote Ollama endpoints later, but local should come first.

## Non-Goals For V1

- No full ChatGPT clone.
- No multi-user auth.
- No RAG/document library at first.
- No agent framework.
- No built-in model training or fine-tuning.
- No cloud sync.

## Suggested Stack

- Tauri 2
- Rust backend commands for system/service checks
- TypeScript frontend
- Vite
- React or Svelte, depending on what feels faster to build
- Local app settings stored in Tauri app data

## Ollama API Notes

Primary local endpoint:

```text
http://localhost:11434
```

Useful endpoints:

```text
GET  /api/tags
POST /api/pull
POST /api/delete
POST /api/generate
POST /api/chat
GET  /api/ps
```

Current tested model:

```text
openbmb/minicpm5
```

The Hugging Face repo `openbmb/MiniCPM5-1B` is SafeTensors and is not directly usable by Ollama. For Ollama, use `openbmb/minicpm5` or a compatible GGUF/Ollama model.

## First Build Plan

1. Scaffold Tauri app.
2. Build an Ollama connection status panel.
3. Add model list from `/api/tags`.
4. Add single-model prompt runner using `/api/chat`.
5. Add model comparison view.
6. Add parameter controls.
7. Add saved prompt presets and local history.
8. Polish enough that it is comfortable for daily model testing.

## UX Direction

Quiet, dense, practical desktop tool. No landing page. First screen should be the testing workspace:

- Left sidebar: models and saved prompt presets.
- Main area: prompt editor and response panels.
- Right panel: run settings, performance stats, and Ollama status.
- Tabs: Chat, Compare, Bench, History.

## Open Questions

- Use React or Svelte?
- Should the app manage `ollama.service`, or only show status and commands?
- Should V1 support remote Ollama URLs?
- Should benchmark results be stored in SQLite or a simple JSON file?
- Should comparison support streaming responses side by side from the start?
