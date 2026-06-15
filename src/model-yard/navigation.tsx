import type { ReactNode } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Database,
  Download,
  Search,
  Settings,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatBytes } from "@/lib/format";
import type { ActiveTab, LabStatus, OllamaModel, RunningModel, RunResult } from "@/lib/types";
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
  onOpenModels,
  onSelectModel,
  onSetTab,
}: {
  history: RunResult[];
  models: OllamaModel[];
  selectedModel: string;
  onOpenModels: () => void;
  onSelectModel: (model: string) => void;
  onSetTab: (tab: ActiveTab) => void;
}) {
  return (
    <>
      <div className="flex h-8 items-center gap-2 rounded-lg border border-border bg-background px-2.5 text-[11px] text-muted-foreground">
        <Search className="size-3.5" />
        <span>Search (Ctrl+K)</span>
      </div>

      <NavSection title="Models">
        {models.slice(0, 8).map((model) => (
          <NavRow
            key={model.name}
            active={selectedModel === model.name}
            onClick={() => onSelectModel(model.name)}
          >
            <span className="truncate text-[11px] leading-4">
              {model.name}
            </span>
            <small className="text-[11px] leading-4 text-muted-foreground">
              {model.details?.parameter_size ?? formatBytes(model.size)}
            </small>
          </NavRow>
        ))}
        {!models.length && (
          <p className="px-1 py-2 text-[11px] text-muted-foreground">
            No models found.
          </p>
        )}
        <NavRow onClick={onOpenModels}>
          <span className="truncate text-[11px] leading-4 text-muted-foreground">
            Browse models
          </span>
          <ChevronRight className="size-3.5 text-muted-foreground" />
        </NavRow>
      </NavSection>

      <NavSection title="History">
        {history.slice(0, 5).map((item, index) => (
          <NavRow
            key={`${item.created_at}-${index}`}
            onClick={() => onSetTab("history")}
          >
            <span className="truncate text-[11px] leading-4">
              {item.prompt || item.model}
            </span>
            <ChevronRight className="size-3.5 text-muted-foreground" />
          </NavRow>
        ))}
        {!history.length && (
          <p className="px-1 py-2 text-[11px] text-muted-foreground">
            No recent chats.
          </p>
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
  onBack,
  onSelectModel,
}: {
  models: OllamaModel[];
  running: RunningModel[];
  selectedModel: string;
  onBack: () => void;
  onSelectModel: (model: string) => void;
}) {
  const totalSize = models.reduce((acc, model) => acc + (model.size ?? 0), 0);
  const loadedCount = new Set(
    running.map((item) => item.name || item.model || ""),
  ).size;
  return (
    <>
      <button
        onClick={onBack}
        className="group flex h-8 items-center gap-2 self-start rounded-lg border border-border bg-background px-2.5 text-[11px] text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
      >
        <ChevronLeft className="size-3.5 transition-transform group-hover:-translate-x-0.5" />
        <span>Back to lab</span>
      </button>

      <div className="rounded-lg border border-border bg-background p-2.5">
        <div className="flex items-center gap-2 text-foreground">
          <Database className="size-3.5 text-primary" />
          <span className="text-[11px] font-semibold">Library</span>
        </div>
        <div className="mt-2 grid grid-cols-3 gap-1.5 text-center">
          <div className="rounded-md bg-card/60 px-1.5 py-1.5">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Local</p>
            <p className="text-xs font-semibold tabular-nums">{models.length}</p>
          </div>
          <div className="rounded-md bg-card/60 px-1.5 py-1.5">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Loaded</p>
            <p className="text-xs font-semibold tabular-nums text-primary">{loadedCount}</p>
          </div>
          <div className="rounded-md bg-card/60 px-1.5 py-1.5">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Size</p>
            <p className="text-xs font-semibold tabular-nums">{formatBytes(totalSize)}</p>
          </div>
        </div>
      </div>

      <NavSection title={`Local models · ${models.length}`}>
        <div className="space-y-1">
          {models.map((model) => {
            const loaded = running.some(
              (item) => item.name === model.name || item.model === model.name,
            );
            return (
              <button
                key={model.name}
                onClick={() => onSelectModel(model.name)}
                className={cn(
                  "group grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-md border border-transparent px-2 py-1.5 text-left transition-colors",
                  "hover:border-border hover:bg-accent",
                  selectedModel === model.name && "border-primary/40 bg-accent",
                )}
              >
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5">
                    {loaded && (
                      <span
                        className="size-1.5 shrink-0 rounded-full bg-primary shadow-[0_0_8px_rgba(159,189,85,0.7)]"
                        aria-label="loaded"
                      />
                    )}
                    <span className="truncate text-[11px] font-medium text-foreground">
                      {model.name.split("/").pop()}
                    </span>
                  </span>
                  <span className="mt-0.5 flex flex-wrap gap-1.5 text-[10px] text-muted-foreground">
                    {model.details?.parameter_size && <span>{model.details.parameter_size}</span>}
                    {model.details?.quantization_level && <span>· {model.details.quantization_level}</span>}
                  </span>
                </span>
                <ChevronRight
                  className={cn(
                    "size-3 shrink-0 text-muted-foreground opacity-0 transition-opacity",
                    "group-hover:opacity-100",
                    selectedModel === model.name && "opacity-100",
                  )}
                />
              </button>
            );
          })}
        </div>
        {!models.length && (
          <div className="rounded-md border border-dashed border-border bg-card/40 p-3 text-center">
            <p className="text-[11px] text-muted-foreground">No local models yet.</p>
            <p className="mt-1 text-[10px] text-muted-foreground/80">Pull one from the catalog to get started.</p>
          </div>
        )}
      </NavSection>
    </>
  );
}
