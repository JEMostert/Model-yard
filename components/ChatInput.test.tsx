import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ChatInput } from "./ChatInput";
import type { OllamaModel, ReasoningMode } from "@/lib/types";

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
  {
    name: "qwen2.5-coder:latest",
    size: 5_000_000_000,
    details: {
      family: "qwen",
      parameter_size: "7B",
      quantization_level: "Q4_K_M",
    },
  },
  {
    name: "qwen3:8b",
    size: 6_000_000_000,
    details: {
      family: "qwen",
      parameter_size: "8B",
      quantization_level: "Q8_0",
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
    reasoningMode: "off" as ReasoningMode,
    reasoningModes: ["off", "on"] as ReasoningMode[],
    favoriteModelNames: [],
    presets: [{ id: "preset-1", name: "Attention", prompt: "Explain attention." }],
    onSelectModel: vi.fn(),
    onToggleFavoriteModel: vi.fn(),
    onReasoningModeChange: vi.fn(),
    onSavePreset: vi.fn(),
    onDeletePreset: vi.fn(),
    onRun: vi.fn(),
    onStop: vi.fn(),
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

  it("does not run empty or whitespace-only prompts", async () => {
    const props = renderChatInput({ value: "   \n  " });
    const send = screen.getByTitle("Send prompt");

    expect(send).toBeDisabled();

    await userEvent.click(send);

    expect(props.onRun).not.toHaveBeenCalled();
  });

  it("shows only the base selected model name in the picker trigger", () => {
    renderChatInput({ selectedModel: "lfm2.5:8b-a1b-q8_0" });

    expect(screen.getByRole("button", { name: /lfm2.5/i })).toBeInTheDocument();
    expect(screen.queryByText(/8b-a1b/i)).not.toBeInTheDocument();
  });

  it("submits with Enter and inserts newline with Shift+Enter", async () => {
    const props = renderChatInput();
    const prompt = screen.getByPlaceholderText(/selected model/i);

    await userEvent.type(prompt, "{Shift>}{Enter}{/Shift}");
    expect(props.onRun).not.toHaveBeenCalled();

    await userEvent.type(prompt, "{Enter}");
    expect(props.onRun).toHaveBeenCalledTimes(1);
  });

  it("allows selecting a local model from the picker", async () => {
    const props = renderChatInput();

    await userEvent.click(screen.getByRole("button", { name: /llama3.2/i }));
    expect(screen.getByTitle("qwen (2)")).toHaveTextContent("QW");
    await userEvent.click(screen.getByTitle("qwen (2)"));
    expect(screen.getByText("qwen2.5-coder")).toBeInTheDocument();
    expect(screen.getByText("qwen3:8b")).toBeInTheDocument();
    await userEvent.click(screen.getByTitle("minicpm (1)"));
    await userEvent.type(screen.getByPlaceholderText(/Search .* models/), "mini");
    await userEvent.click(screen.getByText("minicpm5"));

    expect(props.onSelectModel).toHaveBeenCalledWith("minicpm5:latest");
  });

  it("groups favorited models under the favorites rail entry", async () => {
    const props = renderChatInput({
      favoriteModelNames: ["qwen3:8b"],
    });

    await userEvent.click(screen.getByRole("button", { name: /llama3.2/i }));
    await userEvent.click(screen.getByTitle("Favorites (1)"));

    expect(screen.getByPlaceholderText("Search favorite models")).toBeInTheDocument();
    expect(screen.getByText("qwen3:8b")).toBeInTheDocument();
    expect(screen.queryByText("qwen2.5-coder")).not.toBeInTheDocument();

    await userEvent.click(screen.getByTitle("Remove from favorites"));

    expect(props.onToggleFavoriteModel).toHaveBeenCalledWith("qwen3:8b");
  });

  it("searches all models instead of only the active creator group", async () => {
    renderChatInput();

    await userEvent.click(screen.getByRole("button", { name: /llama3.2/i }));
    await userEvent.click(screen.getByTitle("minicpm (1)"));
    await userEvent.type(screen.getByPlaceholderText(/Search .* models/), "qwen");

    expect(screen.getByText("qwen2.5-coder")).toBeInTheDocument();
    expect(screen.getByText("qwen3:8b")).toBeInTheDocument();
    expect(screen.queryByText("minicpm5")).not.toBeInTheDocument();
  });

  it("changes reasoning mode from the toolbar popup", async () => {
    const props = renderChatInput();

    await userEvent.click(screen.getByTitle("Reasoning"));
    await userEvent.click(screen.getByText("On"));

    expect(props.onReasoningModeChange).toHaveBeenCalledWith("on");
  });

  it("shows model-specific reasoning effort levels", async () => {
    const props = renderChatInput({
      reasoningMode: "medium",
      reasoningModes: ["low", "medium", "high"],
    });

    const trigger = screen.getByTitle("Reasoning");
    expect(trigger).toHaveTextContent("Medium");
    expect(trigger).not.toHaveClass("bg-accent");

    await userEvent.click(trigger);
    await userEvent.click(screen.getByText("High effort"));

    expect(props.onReasoningModeChange).toHaveBeenCalledWith("high");
  });

  it("applies a saved prompt preset", async () => {
    const props = renderChatInput({
      presets: [{ id: "preset-2", name: "Shell task", prompt: "List files." }],
    });

    await userEvent.click(screen.getByTitle("Prompt presets"));
    await userEvent.click(screen.getByText("Shell task"));

    expect(props.onChange).toHaveBeenCalledWith("List files.");
  });

  it("saves the current prompt from the preset menu", async () => {
    const props = renderChatInput();

    await userEvent.click(screen.getByTitle("Prompt presets"));
    await userEvent.click(screen.getByRole("button", { name: /save$/i }));

    expect(props.onSavePreset).toHaveBeenCalledTimes(1);
  });

  it("stops the current response while chat is busy", async () => {
    const props = renderChatInput({ busy: "chat" });
    const prompt = screen.getByPlaceholderText(/selected model/i);

    expect(prompt).toBeDisabled();

    await userEvent.click(screen.getByTitle("Stop response"));

    expect(props.onRun).not.toHaveBeenCalled();
    expect(props.onStop).toHaveBeenCalledTimes(1);
  });

  it("does not run while another action is busy", async () => {
    const props = renderChatInput({ busy: "pull" });
    const prompt = screen.getByPlaceholderText(/selected model/i);

    expect(prompt).toBeDisabled();

    await userEvent.click(screen.getByTitle("Send prompt"));

    expect(props.onRun).not.toHaveBeenCalled();
    expect(props.onStop).not.toHaveBeenCalled();
  });

  it("refocuses the prompt after a busy run finishes", () => {
    const { rerender } = render(
      <ChatInput
        value=""
        onChange={vi.fn()}
        models={models}
        selectedModel="llama3.2:latest"
        busy="chat"
        reasoningMode="off"
        reasoningModes={["off", "on"]}
        favoriteModelNames={[]}
        presets={[]}
        onSelectModel={vi.fn()}
        onToggleFavoriteModel={vi.fn()}
        onReasoningModeChange={vi.fn()}
        onSavePreset={vi.fn()}
        onDeletePreset={vi.fn()}
        onRun={vi.fn()}
        onStop={vi.fn()}
      />,
    );

    const prompt = screen.getByPlaceholderText(/selected model/i);
    expect(prompt).toBeDisabled();

    rerender(
      <ChatInput
        value=""
        onChange={vi.fn()}
        models={models}
        selectedModel="llama3.2:latest"
        busy=""
        reasoningMode="off"
        reasoningModes={["off", "on"]}
        favoriteModelNames={[]}
        presets={[]}
        onSelectModel={vi.fn()}
        onToggleFavoriteModel={vi.fn()}
        onReasoningModeChange={vi.fn()}
        onSavePreset={vi.fn()}
        onDeletePreset={vi.fn()}
        onRun={vi.fn()}
        onStop={vi.fn()}
      />,
    );

    expect(screen.getByPlaceholderText(/selected model/i)).toHaveFocus();
  });
});
