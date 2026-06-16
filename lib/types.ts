export type OllamaModel = {
  name: string;
  model?: string;
  modified_at?: string;
  size?: number;
  digest?: string;
  details?: {
    family?: string;
    parameter_size?: string;
    quantization_level?: string;
    context_length?: number;
    embedding_length?: number;
  };
  capabilities?: string[];
};

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type ChatRequest = {
  run_id?: string;
  model: string;
  messages: ChatMessage[];
  options: GenerateSettings;
  think?: boolean | "low" | "medium" | "high";
};

export type ModelMetadata = {
  name: string;
  supports_thinking: boolean;
  reasoning_modes: ReasoningMode[];
  context_length?: number;
  parameter_size?: string;
  quantization_level?: string;
  family?: string;
  architecture?: string;
  basename?: string;
  organization?: string;
};

export type ReasoningMode = "off" | "on" | "low" | "medium" | "high";

export type RunningModel = {
  name: string;
  model?: string;
  size?: number;
  size_vram?: number;
  expires_at?: string;
};

export type LabStatus = {
  api_ok: boolean;
  service_active: boolean;
  service_state: string;
  gpu_hint: string;
  ollama_installed: boolean;
  ollama_version?: string;
};

export type CatalogModel = {
  name: string;
  description?: string;
  pulls?: string;
  tag_count?: string;
  updated?: string;
  capabilities: string[];
  sizes: string[];
};

export type CatalogTag = {
  name: string;
  size?: string;
  context?: string;
  input?: string;
  digest?: string;
  updated?: string;
  quant?: string;
  variant?: string;
};

export type GenerateSettings = {
  temperature: number;
  top_p: number;
  top_k: number;
  repeat_penalty: number;
  seed: number;
  num_ctx: number;
  num_predict: number;
};

export type RunResult = {
  model: string;
  prompt: string;
  response: string;
  thinking?: string;
  total_duration?: number;
  eval_count?: number;
  eval_duration?: number;
  tokens_per_second?: number;
  created_at: string;
};

export type Preset = {
  id: string;
  name: string;
  prompt: string;
};

export type PullProgress = {
  status: string;
  digest?: string;
  total?: number;
  completed?: number;
};


