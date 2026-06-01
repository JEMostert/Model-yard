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
  };
};

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

export type ActiveTab = "chat" | "compare" | "bench" | "history";

