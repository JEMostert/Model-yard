import { CheckCircle2, Cpu, Download, FileJson, FileText, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatBytes } from "@/lib/format";
import type { GenerateSettings, ModelMetadata, OllamaModel, PullProgress, RunningModel, RunResult } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ConfigSection, Fact, Setting } from "@/src/model-yard/controls";
import { formatCount, formatModelLabel } from "@/src/model-yard/shared";

export function ConfigSidebar({
  busy,
  compareResultCount,
  configOpen,
  historyCount,
  pullName,
  pullProgress,
  result,
  running,
  selectedDetails,
  selectedMetadata,
  selectedModel,
  selectedModelLabel,
  selectedModelLoaded,
  selectedRunningModel,
  settings,
  systemPrompt,
  onDeleteModel,
  onEjectSelectedModel,
  onExportResults,
  onLoadSelectedModel,
  onPullModel,
  onPullNameChange,
  onSettingsChange,
  onSystemPromptChange,
}: {
  busy: string;
  compareResultCount: number;
  configOpen: boolean;
  historyCount: number;
  pullName: string;
  pullProgress: PullProgress[];
  result: RunResult | null;
  running: RunningModel[];
  selectedDetails: OllamaModel | undefined;
  selectedMetadata: ModelMetadata | undefined;
  selectedModel: string;
  selectedModelLabel: string;
  selectedModelLoaded: boolean;
  selectedRunningModel: RunningModel | undefined;
  settings: GenerateSettings;
  systemPrompt: string;
  onDeleteModel: (name: string) => void;
  onEjectSelectedModel: () => void;
  onExportResults: (kind: "json" | "md") => void;
  onLoadSelectedModel: () => void;
  onPullModel: () => void;
  onPullNameChange: (name: string) => void;
  onSettingsChange: (settings: GenerateSettings) => void;
  onSystemPromptChange: (prompt: string) => void;
}) {
  return (
    <aside className="row-span-2 row-start-1 min-h-0 min-w-0 overflow-visible max-[1080px]:hidden">
      <Card
        className={cn(
          "flex h-full w-[280px] min-w-0 flex-col overflow-hidden rounded-xl transition-transform duration-300 ease-out",
          configOpen ? "translate-x-0" : "pointer-events-none translate-x-[calc(100%+12px)]",
        )}
      >
        <div className="flex h-[52px] shrink-0 items-center justify-between border-b border-border bg-card px-5 text-[13px] font-semibold leading-none text-foreground">
          <span>Configuration</span>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <CardContent className="flex flex-col gap-1 p-2">
            <ConfigSection title="System Prompt" defaultOpen>
              <Textarea
                value={systemPrompt}
                onChange={(event) => onSystemPromptChange(event.target.value)}
                placeholder="You are a helpful assistant..."
                className="min-h-[88px] resize-none rounded-lg border border-border bg-background p-2.5 !text-xs !leading-5"
              />
            </ConfigSection>

            <ConfigSection title="Sampling" defaultOpen>
              <div className="space-y-3">
                <Setting label="Temperature" value={settings.temperature} min={0} max={2} step={0.1} onChange={(temperature) => onSettingsChange({ ...settings, temperature })} />
                <Setting label="Max Tokens" value={settings.num_predict} min={32} max={4096} step={32} onChange={(num_predict) => onSettingsChange({ ...settings, num_predict })} />
                <Setting label="Context" value={settings.num_ctx} min={512} max={selectedMetadata?.context_length ?? 131072} step={512} onChange={(num_ctx) => onSettingsChange({ ...settings, num_ctx })} />
              </div>
            </ConfigSection>

            <ConfigSection title="Advanced Sampling">
              <div className="space-y-3">
                <Setting label="Top P" value={settings.top_p} min={0} max={1} step={0.05} onChange={(top_p) => onSettingsChange({ ...settings, top_p })} />
                <Setting label="Top K" value={settings.top_k} min={1} max={200} step={1} onChange={(top_k) => onSettingsChange({ ...settings, top_k })} />
                <Setting label="Repeat Pen." value={settings.repeat_penalty} min={0.8} max={2} step={0.05} onChange={(repeat_penalty) => onSettingsChange({ ...settings, repeat_penalty })} />
                <Setting label="Seed" value={settings.seed} min={-1} max={999999} step={1} onChange={(seed) => onSettingsChange({ ...settings, seed })} />
              </div>
            </ConfigSection>

            <ConfigSection title="Model Info">
              <div className="space-y-1.5">
                <Fact label="Name" value={selectedDetails?.name ?? "none"} />
                <Fact label="Size" value={formatBytes(selectedDetails?.size)} />
                <Fact label="Family" value={selectedMetadata?.family ?? selectedDetails?.details?.family ?? "unknown"} />
                <Fact label="Arch" value={selectedMetadata?.architecture ?? "unknown"} />
                <Fact label="Params" value={selectedMetadata?.parameter_size ?? selectedDetails?.details?.parameter_size ?? "unknown"} />
                <Fact label="Quant" value={selectedMetadata?.quantization_level ?? selectedDetails?.details?.quantization_level ?? "unknown"} />
                <Fact label="Context" value={formatCount(selectedMetadata?.context_length ?? selectedDetails?.details?.context_length)} />
                <Fact label="Thinking" value={selectedMetadata?.supports_thinking ? "supported" : "not exposed"} tone={selectedMetadata?.supports_thinking ? "good" : undefined} />
              </div>
              <div className="mt-3 space-y-1.5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
                  Loaded ({running.length})
                </p>
                {running.map((item) => <Fact key={item.name} label={formatModelLabel(item.name)} value={formatBytes(item.size_vram)} />)}
                {!running.length && <p className="text-xs text-muted-foreground">No loaded models.</p>}
              </div>
            </ConfigSection>

            <ConfigSection title="Library">
              <div className="space-y-2">
                <Input value={pullName} onChange={(event) => onPullNameChange(event.target.value)} className="h-8 rounded-lg text-xs" placeholder="namespace/model:tag" />
                <Button className="h-8 w-full rounded-lg text-xs" onClick={onPullModel} disabled={busy === "pull"}>
                  <Download className="size-3.5" />
                  Pull Model
                </Button>
                {pullProgress.slice(-3).map((item, index) => <p key={index} className="text-[10px] text-muted-foreground">{item.status}</p>)}
              </div>
              <div className="mt-3">
                <Button variant="destructive" size="sm" className="h-8 w-full rounded-lg text-xs" onClick={() => selectedDetails && onDeleteModel(selectedDetails.name)} disabled={!selectedDetails || busy === `delete-${selectedDetails.name}`}>
                  <Trash2 className="size-3.5" />
                  Delete Selected Model
                </Button>
              </div>
            </ConfigSection>

            <ConfigSection title="Export">
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" size="sm" className="h-8 rounded-lg text-xs" onClick={() => onExportResults("md")}>
                  <FileText className="size-3.5" />
                  Markdown
                </Button>
                <Button variant="outline" size="sm" className="h-8 rounded-lg text-xs" onClick={() => onExportResults("json")}>
                  <FileJson className="size-3.5" />
                  JSON
                </Button>
              </div>
              <div className="mt-3 space-y-1.5">
                <Fact label="History" value={`${historyCount} runs`} />
                <Fact label="Compare" value={`${compareResultCount} results`} />
                <Fact label="Current" value={result ? "available" : "empty"} />
              </div>
            </ConfigSection>
          </CardContent>
        </div>
        <div className="shrink-0 border-t border-border bg-card p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">Current model</p>
              <p className="mt-1 truncate text-xs font-medium text-foreground">{selectedModelLabel}</p>
              <p className="mt-0.5 truncate text-[10px] text-muted-foreground">
                {busy === "load-model" ? "Loading into memory" : selectedModelLoaded ? `${formatBytes(selectedRunningModel?.size_vram)} VRAM` : "Not loaded"}
              </p>
            </div>
            <div className={cn("grid size-8 shrink-0 place-items-center rounded-lg border", selectedModelLoaded ? "border-primary/30 bg-primary/10 text-primary" : "border-border bg-background text-muted-foreground")}>
              {selectedModelLoaded ? <CheckCircle2 className="size-4" /> : <Cpu className="size-4" />}
            </div>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-background">
            <div
              className={cn("h-full rounded-full transition-[width] duration-300", selectedModelLoaded ? "bg-primary" : "bg-muted-foreground/40", busy === "load-model" && "w-1/2 animate-pulse bg-primary")}
              style={busy === "load-model" ? undefined : { width: selectedModelLoaded ? "100%" : "0%" }}
            />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button size="sm" className="h-8 rounded-lg text-xs" onClick={onLoadSelectedModel} disabled={!selectedModel || selectedModelLoaded || Boolean(busy)}>
              <Cpu className="size-3.5" />
              {busy === "load-model" ? "Loading" : "Load"}
            </Button>
            <Button size="sm" variant="outline" className="h-8 rounded-lg text-xs" onClick={onEjectSelectedModel} disabled={!selectedModelLoaded || Boolean(busy)}>
              Eject
            </Button>
          </div>
        </div>
      </Card>
    </aside>
  );
}
