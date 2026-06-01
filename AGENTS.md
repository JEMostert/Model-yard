# Model Yard

Local-first desktop workbench for testing, comparing, benchmarking, and managing Ollama models.

## Stack

- Next.js + React + TypeScript
- Tauri 2 + Rust
- Tailwind CSS
- shadcn-style Radix UI components

## User Preference

When building UI, use existing shadcn-style components as much as possible when appropriate, and compose layout/styling with Tailwind utilities.

For fast validation, prefer:

```bash
npm run typecheck
```

For UI/runtime smoke tests or reproducing browser-visible errors, run the dev command:

```bash
npm run dev
```

Do not use `npm run build` as the default test command unless explicitly requested.
