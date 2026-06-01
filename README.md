# Ollama Model Lab

Tauri 2 + Next.js desktop app for testing local Ollama models at `http://localhost:11434`.

## Current V1

- Ollama API and systemd status panel
- Installed model list from `/api/tags`
- Loaded model/VRAM view from `/api/ps`
- Pull and delete models
- Single-model chat
- Multi-model comparison
- Small benchmark suite
- Generation parameter controls
- Prompt presets and run history in browser local storage
- Markdown and JSON export for run results

## Requirements

- Node.js and npm
- Rust and Cargo
- Ollama running locally
- Tauri Linux WebKit dependencies

On CachyOS/Arch, install the missing Tauri system packages if `cargo check` reports `webkit2gtk-4.1` or `javascriptcoregtk-4.1`:

```bash
sudo pacman -S webkit2gtk-4.1
```

Depending on the local install, Tauri may also need common GTK build dependencies:

```bash
sudo pacman -S base-devel curl wget file openssl appmenu-gtk-module gtk3 librsvg
```

## Run

```bash
npm install
npm run tauri:dev
```

The dev script sets `WEBKIT_DISABLE_DMABUF_RENDERER=1` so WebKitGTK stays stable on NVIDIA Wayland.

For the exported frontend only:

```bash
npm run build
```

The frontend calls Tauri commands through `@tauri-apps/api`, so normal browser preview is useful for layout only. Full Ollama behavior is available through `npm run tauri:dev`.
