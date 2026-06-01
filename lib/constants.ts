import type { GenerateSettings, Preset } from "@/lib/types";

export const DEFAULT_SETTINGS: GenerateSettings = {
  temperature: 0.7,
  top_p: 0.9,
  top_k: 40,
  repeat_penalty: 1.1,
  seed: 0,
  num_ctx: 4096,
  num_predict: 512
};

export const DEFAULT_PRESETS: Preset[] = [
  {
    id: "coding",
    name: "Coding",
    prompt: "Write a small Rust function that validates whether a string is a palindrome. Include edge cases."
  },
  {
    id: "reasoning",
    name: "Reasoning",
    prompt: "Solve this carefully: a bat and ball cost $1.10 together. The bat costs $1.00 more than the ball. What does the ball cost?"
  },
  {
    id: "summary",
    name: "Summary",
    prompt: "Summarize the following text into five practical bullets:\n\n"
  }
];

