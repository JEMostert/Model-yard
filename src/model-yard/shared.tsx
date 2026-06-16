import {
  Brain,
  Code2,
  Eye,
  Globe,
  Hash,
  Image as ImageIcon,
  Wand2,
  Wrench,
} from "lucide-react";
import type { GenerateSettings, PullProgress } from "@/lib/types";
import { DEFAULT_SETTINGS } from "@/lib/constants";

export type StylingPresetId = "midnight-garden";
export type WorkspaceMode = "lab" | "settings" | "models";
export type SettingsSectionId = "styling" | "application" | "ollama" | "data";

const CAPABILITY_ICON: Array<{
  match: (cap: string) => boolean;
  label: string;
  Icon: typeof Eye;
  tone: string;
}> = [
  { match: (c) => /vision|image|multimodal/i.test(c), label: "vision", Icon: Eye, tone: "text-violet-300 bg-violet-400/10 border-violet-400/20" },
  { match: (c) => /tool|function/i.test(c), label: "tools", Icon: Wrench, tone: "text-amber-300 bg-amber-400/10 border-amber-400/20" },
  { match: (c) => /code/i.test(c), label: "code", Icon: Code2, tone: "text-sky-300 bg-sky-400/10 border-sky-400/20" },
  { match: (c) => /thinking|reasoning|think/i.test(c), label: "thinking", Icon: Brain, tone: "text-pink-300 bg-pink-400/10 border-pink-400/20" },
  { match: (c) => /embed/i.test(c), label: "embeddings", Icon: Hash, tone: "text-cyan-300 bg-cyan-400/10 border-cyan-400/20" },
  { match: (c) => /audio|speech|tts|asr/i.test(c), label: "audio", Icon: Wand2, tone: "text-emerald-300 bg-emerald-400/10 border-emerald-400/20" },
  { match: (c) => /image.gen|txt2img|diffusion/i.test(c), label: "image-gen", Icon: ImageIcon, tone: "text-rose-300 bg-rose-400/10 border-rose-400/20" },
  { match: (c) => /web|browse|search/i.test(c), label: "web", Icon: Globe, tone: "text-teal-300 bg-teal-400/10 border-teal-400/20" },
];

export const stylingPresets: Array<{
  id: StylingPresetId;
  name: string;
  description: string;
}> = [
  {
    id: "midnight-garden",
    name: "Midnight Garden",
    description: "Default dark glass garden workspace.",
  },
];

export const settingsSections: Array<{
  id: SettingsSectionId;
  title: string;
  description: string;
}> = [
  {
    id: "styling",
    title: "Application Styling",
    description: "Theme, density, and visual preferences.",
  },
  {
    id: "application",
    title: "Application",
    description: "Workspace and app behavior.",
  },
  {
    id: "ollama",
    title: "Ollama",
    description: "Service and local runtime status.",
  },
  {
    id: "data",
    title: "Data",
    description: "Local history and storage.",
  },
];

export function describeCapability(cap: string): { label: string; Icon: typeof Eye; tone: string } | null {
  const hit = CAPABILITY_ICON.find((entry) => entry.match(cap));
  if (!hit) return null;
  return { label: hit.label, Icon: hit.Icon, tone: hit.tone };
}

export function formatUpdatedLabel(updated?: string): string {
  if (!updated) return "";
  const match = updated.match(/(\d+)\s*(\w+)\s*ago/i);
  if (!match) return updated;
  return `${match[1]}${match[2][0]} ago`;
}

export function quantKey(quant?: string): string {
  if (!quant) return "Standard";
  const q = quant.toUpperCase();
  if (/^Q4/.test(q)) return "Q4 — balanced";
  if (/^Q5/.test(q)) return "Q5 — quality";
  if (/^Q6/.test(q)) return "Q6 — high quality";
  if (/^Q8/.test(q)) return "Q8 — near lossless";
  if (/^F16|FP16|BF16/.test(q)) return "F16 — full precision";
  if (/^F32|FP32/.test(q)) return "F32 — full precision";
  if (/Q2|Q3/.test(q)) return "Lower precision";
  if (q.includes("MLX")) return "MLX";
  return "Other";
}

export function normalizeSettings(
  settings: Partial<Omit<GenerateSettings, "seed">> & { seed?: number | null },
  migrateLegacyZeroSeed = false,
): GenerateSettings {
  return {
    ...DEFAULT_SETTINGS,
    ...settings,
    seed:
      migrateLegacyZeroSeed && settings.seed === 0
        ? -1
        : settings.seed ?? -1,
  };
}

export function calculatePullOverall(
  progress: PullProgress[],
): { completed: number; total: number; ratio: number } | null {
  const layers = new Map<string, { completed: number; total: number }>();

  for (const item of progress) {
    if (!item.total) continue;
    const key = item.digest ?? item.status;
    layers.set(key, {
      completed: item.completed ?? 0,
      total: item.total,
    });
  }

  const totals = Array.from(layers.values()).reduce(
    (acc, layer) => ({
      completed: acc.completed + Math.min(layer.completed, layer.total),
      total: acc.total + layer.total,
    }),
    { completed: 0, total: 0 },
  );

  if (!totals.total) return null;
  return {
    ...totals,
    ratio: totals.completed / totals.total,
  };
}

export function parsePullCount(value?: string): number {
  if (!value) return 0;
  const match = value.match(/([\d.]+)\s*([KMB]?)/i);
  if (!match) return 0;
  const num = parseFloat(match[1]);
  const mult = { "": 1, K: 1_000, M: 1_000_000, B: 1_000_000_000 }[match[2].toUpperCase()] ?? 1;
  return num * mult;
}

export function formatModelLabel(value: string) {
  return (
    value
      .split("/")
      .pop()
      ?.replace(/:latest$/, "") ?? value
  );
}

export function getModelCreator(value: string) {
  const localName = formatModelLabel(value);
  const [baseName] = localName.split(":");
  const normalized = baseName
    .replace(/[-_.]?v?\d.*$/i, "")
    .replace(/[-_.]+$/g, "")
    .trim();

  return normalized || baseName || localName || "Local";
}

export function getModelCreatorInitials(value: string) {
  const creator = getModelCreator(value);
  const tokens = creator
    .split(/[-_.\s]+/)
    .map((token) => token.replace(/[^a-z0-9]/gi, ""))
    .filter(Boolean);

  if (tokens.length >= 2) {
    return `${tokens[0][0]}${tokens[1][0]}`.toUpperCase();
  }

  return (tokens[0] ?? creator).slice(0, 2).toUpperCase();
}

export function formatCount(value?: number) {
  if (!value) return "unknown";
  return value.toLocaleString();
}

export function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}
