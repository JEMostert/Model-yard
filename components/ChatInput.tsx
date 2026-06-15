import {
  ArrowUp,
  BrainCircuit,
  Check,
  ChevronDown,
  Cpu,
  PowerOff,
  RefreshCw,
  Search,
} from "lucide-react";
import type { ComponentType } from "react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { OllamaModel } from "@/lib/types";
import { formatBytes } from "@/lib/format";
import { cn } from "@/lib/utils";

type ChatInputProps = {
  value: string;
  onChange: (value: string) => void;
  models: OllamaModel[];
  selectedModel: string;
  activeTab: string;
  busy: string;
  thinkingEnabled: boolean;
  thinkingSupported: boolean;
  selectedModelLoaded: boolean;
  onSelectModel: (value: string) => void;
  onThinkingChange: (value: boolean) => void;
  onEjectSelectedModel: () => void;
  onRefresh: () => void;
  onRun: () => void;
};

export function ChatInput({
  value,
  onChange,
  models,
  selectedModel,
  activeTab,
  busy,
  thinkingEnabled,
  thinkingSupported,
  selectedModelLoaded,
  onSelectModel,
  onThinkingChange,
  onEjectSelectedModel,
  onRefresh,
  onRun,
}: ChatInputProps) {
  const [modelPickerOpen, setModelPickerOpen] = useState(false);
  const [modelSearch, setModelSearch] = useState("");
  const selectedModelLabel = selectedModel
    ? formatModelLabel(selectedModel)
    : "Model";
  const modeLabel =
    activeTab === "bench" ? "Bench" : activeTab === "compare" ? "Compare" : "Chat";
  const canRun = !busy && activeTab !== "history";
  const filteredModels = useMemo(() => {
    const query = modelSearch.trim().toLowerCase();
    if (!query) return models;
    return models.filter((model) =>
      [
        model.name,
        model.details?.family,
        model.details?.parameter_size,
        model.details?.quantization_level,
      ]
        .filter(Boolean)
        .some((value) => value?.toLowerCase().includes(query)),
    );
  }, [modelSearch, models]);

  return (
    <div className="mx-auto w-full max-w-190 overflow-hidden rounded-2xl border border-border bg-background transition-colors focus-within:border-primary/70">
      <Textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key !== "Enter" || event.shiftKey) return;
          event.preventDefault();
          if (canRun) onRun();
        }}
        placeholder="Ask anything, @tag files/folders, $use skills, or / for commands"
        className="min-h-14 resize-none rounded-b-none rounded-t-lg border-0 bg-transparent px-3.5 pb-2.5 pt-3 !text-xs !leading-5 text-foreground shadow-none placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-0"
      />
      <div className="flex min-h-10 items-center justify-between gap-2 bg-background px-2 py-1.5">
        <div className="flex min-w-0 items-center gap-1 overflow-hidden">
          <Popover open={modelPickerOpen} onOpenChange={setModelPickerOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                className="h-7 max-w-[170px] justify-start gap-1.5 rounded-md border-0 bg-transparent px-2 text-[10px] font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <Cpu className="size-3.5 shrink-0" />
                <span className="truncate">{selectedModelLabel}</span>
                <ChevronDown className="ml-auto size-3 shrink-0 opacity-70" />
              </Button>
            </PopoverTrigger>
            <PopoverContent
              align="start"
              side="top"
              className="w-[360px] p-2 max-[460px]:w-[calc(100vw-32px)]"
            >
              <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-2">
                <Search className="size-3.5 shrink-0 text-muted-foreground" />
                <Input
                  value={modelSearch}
                  onChange={(event) => setModelSearch(event.target.value)}
                  placeholder="Search local models"
                  className="h-8 border-0 bg-transparent px-0 text-xs focus-visible:ring-0"
                />
              </div>
              <div className="mt-2 max-h-[280px] space-y-1 overflow-y-auto">
                {filteredModels.map((model) => (
                  <button
                    key={model.name}
                    className={cn(
                      "grid w-full grid-cols-[minmax(0,1fr)_auto] gap-2 rounded-lg px-2.5 py-2 text-left hover:bg-accent",
                      selectedModel === model.name && "bg-accent",
                    )}
                    onClick={() => {
                      onSelectModel(model.name);
                      setModelPickerOpen(false);
                      setModelSearch("");
                    }}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-xs font-medium text-foreground">
                        {formatModelLabel(model.name)}
                      </span>
                      <span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[10px] text-muted-foreground">
                        <span>{model.details?.parameter_size ?? formatBytes(model.size)}</span>
                        {model.details?.family && <span>{model.details.family}</span>}
                        {model.details?.quantization_level && (
                          <span>{model.details.quantization_level}</span>
                        )}
                      </span>
                    </span>
                    {selectedModel === model.name && (
                      <Check className="mt-0.5 size-3.5 text-primary" />
                    )}
                  </button>
                ))}
                {!filteredModels.length && (
                  <p className="px-2 py-6 text-center text-xs text-muted-foreground">
                    No matching models.
                  </p>
                )}
              </div>
            </PopoverContent>
          </Popover>
          <ControlChip icon={BrainCircuit} label={modeLabel} />
          {thinkingSupported && (
            <label
              className={cn(
                "flex h-7 shrink-0 items-center gap-2 rounded-md px-2 text-[10px] font-medium text-muted-foreground",
                thinkingEnabled && "bg-accent text-foreground",
              )}
            >
              <BrainCircuit className="size-3.5" />
              <span>Think</span>
              <Switch checked={thinkingEnabled} onCheckedChange={onThinkingChange} />
            </label>
          )}
          {selectedModelLoaded && (
            <Button
              variant="ghost"
              size="icon"
              className="size-7 rounded-md border-0 bg-transparent text-muted-foreground hover:bg-destructive/15 hover:text-destructive"
              onClick={onEjectSelectedModel}
              disabled={Boolean(busy)}
              title="Eject loaded model"
            >
              <PowerOff className="size-3.5" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="size-7 rounded-md border-0 bg-transparent text-muted-foreground hover:bg-accent hover:text-foreground"
            onClick={onRefresh}
            title="Refresh models"
          >
            <RefreshCw className="size-3.5" />
          </Button>
        </div>
        <Button
          size="icon"
          className="size-8 rounded-full bg-primary text-primary-foreground shadow-md shadow-black/30 hover:bg-primary/90"
          onClick={onRun}
          disabled={!canRun}
          title="Send prompt"
        >
          <ArrowUp className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}

function ControlChip({
  icon: Icon,
  label,
  className = "",
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  className?: string;
}) {
  return (
    <div
      className={`flex h-7 shrink-0 items-center gap-1.5 rounded-md px-2 text-[10px] font-medium text-muted-foreground ${className}`}
    >
      <Icon className="size-3.5" />
      <span>{label}</span>
    </div>
  );
}

function formatModelLabel(value: string) {
  return (
    value
      .split("/")
      .pop()
      ?.replace(/:latest$/, "") ?? value
  );
}
