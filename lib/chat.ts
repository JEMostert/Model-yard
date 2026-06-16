import type { ChatMessage, RunResult } from "./types";

export function buildChatMessages(
  systemPrompt: string,
  history: RunResult[],
  prompt: string,
): ChatMessage[] {
  const messages: ChatMessage[] = [];
  const system = systemPrompt.trim();
  if (system) {
    messages.push({ role: "system", content: system });
  }
  for (const turn of history) {
    messages.push({ role: "user", content: turn.prompt });
    if (turn.response) {
      messages.push({ role: "assistant", content: turn.response });
    }
  }
  messages.push({ role: "user", content: prompt.trim() });
  return messages;
}
