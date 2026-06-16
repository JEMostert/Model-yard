import type { ReactNode } from "react";
import {
  ChevronRight,
  Cpu,
  Database,
  Download,
  MessageSquare,
  Settings,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatBytes } from "@/lib/format";
import type { LabStatus, OllamaModel, RunningModel, RunResult } from "@/lib/types";
import { settingsSections, type SettingsSectionId } from "@/src/model-yard/shared";

function NavSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-2">
      <h2 className="border-b border-border pb-2 text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
        {title}
      </h2>
      <div className="space-y-1">{children}</div>
    </section>
  );
}

export function OllamaInstallNotice({
  busy,
  onInstall,
}: {
  busy: boolean;
  onInstall: () => void;
}) {
  return (
    <div className="shrink-0 border-t border-border bg-card p-3">
      <div className="rounded-lg border border-primary/30 bg-primary/10 p-3">
        <div className="flex items-start gap-2">
          <Download className="mt-0.5 size-3.5 shrink-0 text-primary" />
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-foreground">
              Ollama is not installed
            </p>
            <p className="mt-1 text-[10px] leading-4 text-muted-foreground">
              Install Ollama to run local models in Model Yard.
            </p>
          </div>
        </div>
        <Button
          className="mt-3 h-7 w-full rounded-md text-[11px]"
          onClick={onInstall}
          disabled={busy}
        >
          <Download className="size-3.5" />
          {busy ? "Opening terminal" : "Install"}
        </Button>
      </div>
    </div>
  );
}

function NavRow({
  active = false,
  children,
  onClick,
}: {
  active?: boolean;
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      className={cn(
        "grid min-h-7 w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-md px-2 py-1 text-left text-[11px] hover:bg-accent",
        active && "bg-accent text-foreground",
      )}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export function LabNavigation({
  history,
  models,
  selectedModel,
  selectedRunningModel,
  onOpenModels,
  onSelectModel,
  onSelectHistoryPrompt,
}: {
  history: RunResult[];
  models: OllamaModel[];
  selectedModel: string;
  selectedRunningModel?: RunningModel;
  onOpenModels: () => void;
  onSelectModel: (model: string) => void;
  onSelectHistoryPrompt: (prompt: string) => void;
}) {
  const selectedDetails = models.find((m) => m.name === selectedModel);
  return (
    <>
      <NavSection title="Current model">
        <div className="rounded-lg border border-border bg-background p-2.5">
          {selectedModel ? (
            <>
              <div className="flex items-center gap-2">
                <Cpu className={cn("size-3.5", selectedRunningModel ? "text-primary" : "text-muted-foreground")} />
                <span className="truncate text-[11px] font-medium text-foreground">
                  {selectedModel.split("/").pop()}
                </span>
              </div>
              <div className="mt-1.5 flex items-center gap-2 text-[10px] text-muted-foreground">
                <span>{selectedDetails?.details?.parameter_size ?? formatBytes(selectedDetails?.size)}</span>
                <span className="text-border">·</span>
                <span className={cn(selectedRunningModel ? "text-primary" : "")}>
                  {selectedRunningModel ? "loaded" : "idle"}
                </span>
                {selectedRunningModel?.size_vram && (
                  <>
                    <span className="text-border">·</span>
                    <span>{formatBytes(selectedRunningModel.size_vram)} VRAM</span>
                  </>
                )}
              </div>
            </>
          ) : (
            <p className="text-[11px] text-muted-foreground">No model selected</p>
          )}
        </div>
      </NavSection>

      <NavSection title="Switch model">
        {models.map((model) => (
          <NavRow
            key={model.name}
            active={selectedModel === model.name}
            onClick={() => onSelectModel(model.name)}
          >
            <span className="truncate text-[11px] leading-4">
              {model.name.split("/").pop()}
            </span>
            <small className="text-[10px] leading-4 text-muted-foreground">
              {model.details?.parameter_size ?? ""}
            </small>
          </NavRow>
        ))}
        {!models.length && (
          <p className="px-1 py-2 text-[11px] text-muted-foreground">No models found.</p>
        )}
        <NavRow onClick={onOpenModels}>
          <span className="truncate text-[11px] leading-4 text-muted-foreground">
            Browse models
          </span>
          <ChevronRight className="size-3.5 text-muted-foreground" />
        </NavRow>
      </NavSection>

      <NavSection title="Recent">
        {history.slice(0, 5).map((item, index) => (
          <NavRow
            key={`${item.created_at}-${index}`}
            onClick={() => onSelectHistoryPrompt(item.prompt)}
          >
            <span className="flex min-w-0 items-center gap-1.5">
              <MessageSquare className="size-3 shrink-0 text-muted-foreground/60" />
              <span className="truncate text-[11px] leading-4">
                {item.prompt || item.model}
              </span>
            </span>
          </NavRow>
        ))}
        {!history.length && (
          <p className="px-1 py-2 text-[11px] text-muted-foreground">No recent chats.</p>
        )}
      </NavSection>
    </>
  );
}

export function SettingsNavigation({
  activeSection,
  onSelectSection,
}: {
  activeSection: SettingsSectionId;
  onSelectSection: (section: SettingsSectionId) => void;
}) {
  return (
    <>
      <div className="flex h-8 items-center gap-2 rounded-lg border border-border bg-background px-2.5 text-[11px] text-muted-foreground">
        <Settings className="size-3.5" />
        <span>Settings</span>
      </div>
      <NavSection title="Sections">
        {settingsSections.map((section) => (
          <NavRow
            key={section.id}
            active={activeSection === section.id}
            onClick={() => onSelectSection(section.id)}
          >
            <span className="min-w-0">
              <span className="block truncate text-[11px] leading-4">
                {section.title}
              </span>
              <span className="block truncate text-[10px] leading-4 text-muted-foreground">
                {section.description}
              </span>
            </span>
            <ChevronRight className="size-3.5 text-muted-foreground" />
          </NavRow>
        ))}
      </NavSection>
    </>
  );
}

export function ModelBrowserNavigation({
  models,
  running,
  selectedModel,
  onSelectModel,
}: {
  models: OllamaModel[];
  running: RunningModel[];
  selectedModel: string;
  onSelectModel: (model: string) => void;
}) {
  const totalSize = models.reduce((acc, model) => acc + (model.size ?? 0), 0);
  const runningNames = new Set(
    running.flatMap((item) => [item.name, item.model].filter(Boolean)),
  );
  return (
    <>
      <NavSection title={`Installed · ${models.length}`}>
        <div className="flex items-center gap-2 rounded-md bg-background px-2 py-1.5 text-[10px] text-muted-foreground">
          <Database className="size-3" />
          <span>{formatBytes(totalSize)} total</span>
          <span className="text-border">·</span>
          <span>{running.length} loaded</span>
        </div>
        <div className="space-y-0.5">
          {models.map((model) => {
            const loaded = runningNames.has(model.name);
            return (
              <button
                key={model.name}
                onClick={() => onSelectModel(model.name)}
                className={cn(
                  "group flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors",
                  "hover:bg-accent",
                  selectedModel === model.name && "bg-accent",
                )}
              >
                <span
                  className={cn(
                    "size-1.5 shrink-0 rounded-full",
                    loaded
                      ? "bg-primary shadow-[0_0_6px_rgba(159,189,85,0.6)]"
                      : "bg-muted-foreground/30",
                  )}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[11px] font-medium text-foreground">
                    {model.name.split("/").pop()}
                  </span>
                  <span className="block text-[10px] text-muted-foreground">
                    {model.details?.parameter_size ?? ""}
                    {model.details?.quantization_level ? ` · ${model.details.quantization_level}` : ""}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
        {!models.length && (
          <div className="rounded-md border border-dashed border-border p-3 text-center">
            <p className="text-[11px] text-muted-foreground">No local models yet.</p>
          </div>
        )}
      </NavSection>
    </>
  );
}
