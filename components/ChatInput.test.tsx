import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ChatInput } from "./ChatInput";
import type { OllamaModel } from "@/lib/types";

const models: OllamaModel[] = [
  {
    name: "llama3.2:latest",
    size: 2_000_000_000,
    details: {
      family: "llama",
      parameter_size: "3B",
      quantization_level: "Q4_K_M",
    },
  },
  {
    name: "minicpm5:latest",
    size: 4_000_000_000,
    details: {
      family: "minicpm",
      parameter_size: "8B",
      quantization_level: "Q5_K_M",
    },
  },
];

function renderChatInput(overrides: Partial<Parameters<typeof ChatInput>[0]> = {}) {
  const props = {
    value: "Explain attention.",
    onChange: vi.fn(),
    models,
    selectedModel: "llama3.2:latest",
    activeTab: "chat",
    busy: "",
    thinkingEnabled: false,
    thinkingSupported: true,
    selectedModelLoaded: false,
    onSelectModel: vi.fn(),
    onThinkingChange: vi.fn(),
    onEjectSelectedModel: vi.fn(),
    onRefresh: vi.fn(),
    onRun: vi.fn(),
    ...overrides,
  };

  render(<ChatInput {...props} />);
  return props;
}

describe("ChatInput", () => {
  it("runs on send button click", async () => {
    const props = renderChatInput();

    await userEvent.click(screen.getByTitle("Send prompt"));

    expect(props.onRun).toHaveBeenCalledTimes(1);
  });

  it("submits with Enter and inserts newline with Shift+Enter", async () => {
    const props = renderChatInput();
    const prompt = screen.getByPlaceholderText(/Ask anything/i);

    await userEvent.type(prompt, "{Shift>}{Enter}{/Shift}");
    expect(props.onRun).not.toHaveBeenCalled();

    await userEvent.type(prompt, "{Enter}");
    expect(props.onRun).toHaveBeenCalledTimes(1);
  });

  it("allows selecting a local model from the picker", async () => {
    const props = renderChatInput();

    await userEvent.click(screen.getByRole("button", { name: /llama3.2/i }));
    const popover = screen.getByPlaceholderText("Search local models").closest("div")!
      .parentElement!;
    await userEvent.type(screen.getByPlaceholderText("Search local models"), "mini");
    await userEvent.click(within(popover).getByText("minicpm5"));

    expect(props.onSelectModel).toHaveBeenCalledWith("minicpm5:latest");
  });

  it("shows eject only when the selected model is loaded", async () => {
    const props = renderChatInput({ selectedModelLoaded: true });

    await userEvent.click(screen.getByTitle("Eject loaded model"));

    expect(props.onEjectSelectedModel).toHaveBeenCalledTimes(1);
  });

  it("does not run while busy", async () => {
    const props = renderChatInput({ busy: "chat" });

    await userEvent.click(screen.getByTitle("Send prompt"));

    expect(props.onRun).not.toHaveBeenCalled();
  });
});
