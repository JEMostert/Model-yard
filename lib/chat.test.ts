import { describe, expect, it } from "vitest";
import { buildChatMessages } from "./chat";
import type { RunResult } from "./types";

function makeTurn(prompt: string, response: string): RunResult {
  return {
    model: "llama3.2:latest",
    prompt,
    response,
    created_at: new Date().toISOString(),
  };
}

describe("buildChatMessages", () => {
  it("returns only the user prompt when system and history are empty", () => {
    expect(buildChatMessages("", [], "Hello")).toEqual([
      { role: "user", content: "Hello" },
    ]);
  });

  it("prepends a trimmed system message when provided", () => {
    expect(buildChatMessages("  Be helpful.  ", [], "Hello")).toEqual([
      { role: "system", content: "Be helpful." },
      { role: "user", content: "Hello" },
    ]);
  });

  it("interleaves prior turns as user/assistant pairs", () => {
    const history = [
      makeTurn("First", "First reply"),
      makeTurn("Second", "Second reply"),
    ];

    expect(buildChatMessages("", history, "Third")).toEqual([
      { role: "user", content: "First" },
      { role: "assistant", content: "First reply" },
      { role: "user", content: "Second" },
      { role: "assistant", content: "Second reply" },
      { role: "user", content: "Third" },
    ]);
  });

  it("skips empty assistant content for incomplete turns", () => {
    const history = [makeTurn("First", "")];

    expect(buildChatMessages("", history, "Second")).toEqual([
      { role: "user", content: "First" },
      { role: "user", content: "Second" },
    ]);
  });

  it("trims the submitted prompt", () => {
    expect(buildChatMessages("", [], "  Hello  ")).toEqual([
      { role: "user", content: "Hello" },
    ]);
  });
});
