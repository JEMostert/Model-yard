import { invoke } from "@tauri-apps/api/core";

export async function call<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  if (!isTauriRuntime()) {
    throw new Error("Tauri runtime is unavailable. Start the desktop app with npm run tauri:dev to use Ollama commands.");
  }

  try {
    return await invoke<T>(command, args);
  } catch (error) {
    throw new Error(formatError(error));
  }
}

export function formatError(error: unknown) {
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  if (typeof Event !== "undefined" && error instanceof Event) {
    return error.type ? `Request failed: ${error.type}` : "Request failed";
  }
  if (error && typeof error === "object") {
    const record = error as Record<string, unknown>;
    const message = record.message ?? record.error ?? record.reason;
    if (typeof message === "string") return message;

    try {
      return JSON.stringify(error);
    } catch {
      return Object.prototype.toString.call(error);
    }
  }
  return String(error);
}

export function isTauriRuntime() {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}
