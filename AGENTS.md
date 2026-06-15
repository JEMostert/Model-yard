# Model Yard

Local-first desktop workbench for testing, comparing, benchmarking, and managing Ollama models.

## Stack

- Vite + React + TypeScript
- Tauri 2 + Rust
- Tailwind CSS
- shadcn-style Radix UI components
- Vitest + Testing Library for frontend tests

## User Preference

When building UI, use existing shadcn-style components as much as possible when appropriate, and compose layout/styling with Tailwind utilities.

When a requested implementation can be handled at a deeper or more correct product/architecture level, push back briefly before implementing the shallow version. Prefer the real capability over a visual approximation when the stack supports it.

Develop test-based. For behavior changes, add or update focused tests before or alongside the implementation. Prefer Vitest/Testing Library for frontend behavior and Rust unit tests for Tauri command logic. Avoid brittle visual snapshots unless explicitly requested.

For fast validation, prefer:

```bash
pnpm run typecheck
```

For behavior validation, run:

```bash
pnpm test
```

For UI/runtime smoke tests or reproducing browser-visible errors, run the dev command:

```bash
pnpm run dev
```

Do not use `pnpm run build` as the default test command unless explicitly requested.
