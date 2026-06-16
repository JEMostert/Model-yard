import {
  ArrowUp,
  Bookmark,
  BrainCircuit,
  Check,
  ChevronDown,
  Search,
  Star,
  Square,
  X,
} from "lucide-react";
import type { ComponentType } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import type { OllamaModel, Preset, ReasoningMode } from "@/lib/types";
import { formatBytes } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  formatModelLabel,
  getModelCreator,
  getModelCreatorInitials,
} from "@/src/model-yard/shared";

type ChatInputProps = {
  value: string;
  onChange: (value: string) => void;
  models: OllamaModel[];
  selectedModel: string;
  busy: string;
  reasoningMode: ReasoningMode;
  reasoningModes: ReasoningMode[];
  favoriteModelNames: string[];
  presets: Preset[];
  onSelectModel: (value: string) => void;
  onToggleFavoriteModel: (value: string) => void;
  onReasoningModeChange: (value: ReasoningMode) => void;
  onSavePreset: (name?: string) => void;
  onDeletePreset: (id: string) => void;
  onRun: () => void;
  onStop: () => void;
};

export function ChatInput({
  value,
  onChange,
  models,
  selectedModel,
  busy,
  reasoningMode,
  reasoningModes,
  favoriteModelNames,
  presets,
  onSelectModel,
  onToggleFavoriteModel,
  onReasoningModeChange,
  onSavePreset,
  onDeletePreset,
  onRun,
  onStop,
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [modelPickerOpen, setModelPickerOpen] = useState(false);
  const [modelSearch, setModelSearch] = useState("");
  const [activeCreator, setActiveCreator] = useState<string | null>(null);
  const [presetPickerOpen, setPresetPickerOpen] = useState(false);
  const [presetName, setPresetName] = useState("");
  const [presetSaved, setPresetSaved] = useState(false);
  const [reasoningPickerOpen, setReasoningPickerOpen] = useState(false);
  const selectedModelLabel = selectedModel
    ? formatTriggerModelLabel(selectedModel)
    : "Model";
  const previousBusyRef = useRef(busy);
  const canRun =
    !busy && Boolean(selectedModel) && value.trim().length > 0;
  const canStop = busy === "chat";
  const reasoningSupported = reasoningModes.length > 0;
  const reasoningLabel = reasoningSupported
    ? reasoningMode[0].toUpperCase() + reasoningMode.slice(1)
    : "No reasoning";
  const favoriteModelSet = useMemo(
    () => new Set(favoriteModelNames),
    [favoriteModelNames],
  );
  const creatorGroups = useMemo(() => groupModelsByCreator(models), [models]);
  const favoriteModels = useMemo(
    () => models.filter((model) => favoriteModelSet.has(model.name)),
    [favoriteModelSet, models],
  );
  const selectedCreator = selectedModel ? getModelCreator(selectedModel) : "";
  const favoritesActive = activeCreator === FAVORITES_CREATOR;
  const currentCreator =
    favoritesActive
      ? FAVORITES_CREATOR
      : activeCreator && creatorGroups.some((group) => group.creator === activeCreator)
      ? activeCreator
      : creatorGroups.find((group) => group.creator === selectedCreator)?.creator
        ?? creatorGroups[0]?.creator
        ?? "";
  const currentGroup =
    currentCreator === FAVORITES_CREATOR
      ? { creator: FAVORITES_CREATOR, models: favoriteModels }
      : creatorGroups.find((group) => group.creator === currentCreator);
  const searchingModels = modelSearch.trim().length > 0;
  const filteredModels = useMemo(() => {
    const query = modelSearch.trim().toLowerCase();
    const groupModels = query ? models : currentGroup?.models ?? [];
    if (!query) return groupModels;
    return groupModels.filter((model) =>
      [
        model.name,
        getModelCreator(model.name),
        model.details?.family,
        model.details?.parameter_size,
        model.details?.quantization_level,
      ]
        .filter(Boolean)
        .some((value) => value?.toLowerCase().includes(query)),
    );
  }, [currentGroup, modelSearch, models]);

  useEffect(() => {
    if (previousBusyRef.current && !busy) {
      textareaRef.current?.focus();
    }
    previousBusyRef.current = busy;
  }, [busy]);

  return (
    <div className="mx-auto w-full max-w-190 overflow-hidden rounded-2xl border border-border bg-background transition-colors focus-within:border-primary/70">
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key !== "Enter" || event.shiftKey) return;
          event.preventDefault();
          if (canRun) onRun();
        }}
        disabled={canStop || Boolean(busy)}
        placeholder="Enter a prompt for the selected model"
        className="min-h-14 resize-none rounded-b-none rounded-t-lg border-0 bg-transparent px-3.5 pb-2.5 pt-3 !text-xs !leading-5 text-foreground shadow-none placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-0"
      />
      <div className="flex min-h-10 items-center justify-between gap-2 bg-background px-2 py-1.5">
        <div className="flex min-w-0 items-center gap-1 overflow-hidden">
          <Popover open={modelPickerOpen} onOpenChange={setModelPickerOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                className="h-7 max-w-[170px] justify-start gap-1.5 rounded-md border-0 bg-transparent px-2 text-[10px] font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <span className="truncate">{selectedModelLabel}</span>
                <ChevronDown className="ml-auto size-3 shrink-0 opacity-70" />
              </Button>
            </PopoverTrigger>
            <PopoverContent
              align="start"
              side="top"
              className="w-[420px] p-0 max-[460px]:w-[calc(100vw-32px)]"
            >
              <div className="grid max-h-[340px] grid-cols-[48px_minmax(0,1fr)] overflow-hidden">
                <div className="flex flex-col items-center gap-1 border-r border-border bg-card/40 p-2">
                  <button
                    className={cn(
                      "grid size-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
                      searchingModels && "pointer-events-none opacity-40",
                      currentCreator === FAVORITES_CREATOR && "bg-accent text-primary",
                    )}
                    title={`Favorites (${favoriteModels.length})`}
                    onClick={() => {
                      setActiveCreator(FAVORITES_CREATOR);
                      setModelSearch("");
                    }}
                    type="button"
                  >
                    <Star
                      className={cn(
                        "size-4",
                        currentCreator === FAVORITES_CREATOR && "fill-current",
                      )}
                    />
                  </button>
                  {creatorGroups.map((group) => (
                    <button
                      key={group.creator}
                      className={cn(
                        "grid size-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
                        searchingModels && "pointer-events-none opacity-40",
                        currentCreator === group.creator && "bg-accent text-foreground",
                      )}
                      title={`${group.creator} (${group.models.length})`}
                      onClick={() => {
                        setActiveCreator(group.creator);
                        setModelSearch("");
                      }}
                      type="button"
                    >
                      <ModelCreatorAvatar creator={group.creator} />
                    </button>
                  ))}
                </div>
                <div className="min-w-0 p-2">
                  <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-2">
                    <Search className="size-3.5 shrink-0 text-muted-foreground" />
                    <Input
                      value={modelSearch}
                      onChange={(event) => setModelSearch(event.target.value)}
                      placeholder={`Search ${currentCreator === FAVORITES_CREATOR ? "favorite" : currentCreator || "local"} models`}
                      className="h-8 border-0 bg-transparent px-0 text-xs focus-visible:ring-0"
                    />
                  </div>
                  <div className="mt-2 max-h-[280px] space-y-1 overflow-y-auto">
                    {filteredModels.map((model) => (
                      <div
                        key={model.name}
                        role="button"
                        tabIndex={0}
                        className={cn(
                          "grid w-full cursor-pointer grid-cols-[minmax(0,1fr)_auto] gap-2 rounded-lg border border-border/60 bg-[#121a12] px-2.5 py-2 text-left shadow-sm transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                          selectedModel === model.name && "bg-accent",
                        )}
                        onClick={() => {
                          onSelectModel(model.name);
                          setModelPickerOpen(false);
                          setModelSearch("");
                        }}
                        onKeyDown={(event) => {
                          if (event.key !== "Enter" && event.key !== " ") return;
                          event.preventDefault();
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
                            <span>{getModelCreator(model.name)}</span>
                            {model.details?.quantization_level && (
                              <span>{model.details.quantization_level}</span>
                            )}
                          </span>
                        </span>
                        <span className="flex items-start gap-1">
                          <button
                            className={cn(
                              "grid size-5 place-items-center rounded-md text-muted-foreground hover:bg-background hover:text-foreground",
                              favoriteModelSet.has(model.name) && "text-primary",
                            )}
                            title={
                              favoriteModelSet.has(model.name)
                                ? "Remove from favorites"
                                : "Add to favorites"
                            }
                            onClick={(event) => {
                              event.stopPropagation();
                              onToggleFavoriteModel(model.name);
                            }}
                            type="button"
                          >
                            <Star
                              className={cn(
                                "size-3.5",
                                favoriteModelSet.has(model.name) && "fill-current",
                              )}
                            />
                          </button>
                          {selectedModel === model.name && (
                            <Check className="mt-0.5 size-3.5 text-primary" />
                          )}
                        </span>
                      </div>
                    ))}
                    {!filteredModels.length && (
                      <p className="px-2 py-6 text-center text-xs text-muted-foreground">
                        {currentCreator === FAVORITES_CREATOR
                          ? "No favorite models yet."
                          : "No matching models."}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </PopoverContent>
          </Popover>
          <Popover open={presetPickerOpen} onOpenChange={(open) => {
            setPresetPickerOpen(open);
            if (!open) { setPresetName(""); setPresetSaved(false); }
          }}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-7 rounded-md border-0 bg-transparent text-muted-foreground hover:bg-accent hover:text-foreground"
                title="Prompt presets"
              >
                <Bookmark className="size-3.5" />
              </Button>
            </PopoverTrigger>
            <PopoverContent
              align="start"
              side="top"
              className="w-[320px] p-2 max-[460px]:w-[calc(100vw-32px)]"
            >
              <div className="space-y-1.5">
                <p className="px-2.5 text-[10px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
                  Save current prompt
                </p>
                <div className="flex gap-1.5 px-1">
                  <Input
                    value={presetName}
                    onChange={(event) => {
                      setPresetName(event.target.value);
                      setPresetSaved(false);
                    }}
                    placeholder="Preset name"
                    className="h-7 flex-1 rounded-md border border-border bg-background px-2 text-xs focus-visible:ring-0"
                    onKeyDown={(event) => {
                      if (event.key !== "Enter") return;
                      event.preventDefault();
                      onSavePreset(presetName);
                      setPresetName("");
                      setPresetSaved(true);
                      setTimeout(() => setPresetSaved(false), 1500);
                    }}
                  />
                  <Button
                    type="button"
                    size="sm"
                    className="h-7 rounded-md px-2.5 text-[10px]"
                    onClick={() => {
                      onSavePreset(presetName);
                      setPresetName("");
                      setPresetSaved(true);
                      setTimeout(() => setPresetSaved(false), 1500);
                    }}
                  >
                    {presetSaved ? (
                      <><Check className="mr-1 size-3" /> Saved</>
                    ) : (
                      <><Bookmark className="mr-1 size-3" /> Save</>
                    )}
                  </Button>
                </div>
              </div>
              <div className="my-2 border-t border-border" />
              <div className="max-h-[200px] space-y-0.5 overflow-y-auto">
                {presets.map((preset) => (
                  <div
                    key={preset.id}
                    className="group flex w-full items-center gap-1.5 rounded-md bg-background px-2.5 py-1.5 hover:bg-accent"
                  >
                    <button
                      type="button"
                      className="flex min-w-0 flex-1 items-center gap-2 text-left"
                      onClick={() => {
                        onChange(preset.prompt);
                        setPresetPickerOpen(false);
                      }}
                    >
                      <Bookmark className="size-3 shrink-0 text-muted-foreground" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-medium text-foreground">
                          {preset.name}
                        </span>
                        <span className="block truncate text-[10px] leading-4 text-muted-foreground">
                          {preset.prompt}
                        </span>
                      </span>
                    </button>
                    <button
                      type="button"
                      className="grid size-5 shrink-0 place-items-center rounded text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/15 hover:text-destructive group-hover:opacity-100"
                      title="Delete preset"
                      onClick={(event) => {
                        event.stopPropagation();
                        onDeletePreset(preset.id);
                      }}
                    >
                      <X className="size-3" />
                    </button>
                  </div>
                ))}
                {!presets.length && (
                  <p className="px-2 py-5 text-center text-xs text-muted-foreground">
                    No saved presets.
                  </p>
                )}
              </div>
            </PopoverContent>
          </Popover>
          <Popover open={reasoningPickerOpen} onOpenChange={setReasoningPickerOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                className="h-7 shrink-0 gap-1.5 rounded-md border-0 bg-transparent px-2 text-[10px] font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
                disabled={!reasoningSupported}
                title={reasoningSupported ? "Reasoning" : "Reasoning unavailable for this model"}
              >
                <BrainCircuit className="size-3.5" />
                <span>{reasoningLabel}</span>
                <ChevronDown className="size-3 opacity-70" />
              </Button>
            </PopoverTrigger>
            <PopoverContent
              align="start"
              side="top"
              className="w-[240px] p-2 max-[460px]:w-[calc(100vw-32px)]"
            >
              <div className="space-y-1">
                {reasoningModes.map((mode) => (
                  <ReasoningOption
                    key={mode}
                    active={reasoningMode === mode}
                    description={reasoningModeDescription(mode)}
                    label={reasoningModeLabel(mode)}
                    onClick={() => {
                      onReasoningModeChange(mode);
                      setReasoningPickerOpen(false);
                    }}
                  />
                ))}
              </div>
            </PopoverContent>
          </Popover>
        </div>
        <Button
          type="button"
          size="icon"
          className={cn(
            "size-8 rounded-full shadow-md shadow-black/30",
            canStop
              ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
              : "bg-primary text-primary-foreground hover:bg-primary/90",
          )}
          onPointerDown={(event) => {
            event.preventDefault();
            if (canStop) {
              onStop();
            } else if (canRun) {
              onRun();
            }
          }}
          disabled={canStop ? false : !canRun}
          title={canStop ? "Stop response" : "Send prompt"}
        >
          {canStop ? <Square className="size-3.5 fill-current" /> : <ArrowUp className="size-3.5" />}
        </Button>
      </div>
    </div>
  );
}

const FAVORITES_CREATOR = "__favorites";

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

function ReasoningOption({
  active,
  description,
  label,
  onClick,
}: {
  active: boolean;
  description: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className={cn(
        "grid w-full grid-cols-[minmax(0,1fr)_auto] gap-2 rounded-lg px-2.5 py-2 text-left hover:bg-accent",
        active && "bg-accent",
      )}
      onClick={onClick}
      type="button"
    >
      <span className="min-w-0">
        <span className="block text-xs font-medium text-foreground">{label}</span>
        <span className="mt-0.5 block text-[10px] leading-4 text-muted-foreground">
          {description}
        </span>
      </span>
      {active && <Check className="mt-0.5 size-3.5 text-primary" />}
    </button>
  );
}

function reasoningModeLabel(mode: ReasoningMode) {
  return mode === "off" || mode === "on"
    ? mode[0].toUpperCase() + mode.slice(1)
    : `${mode[0].toUpperCase()}${mode.slice(1)} effort`;
}

function reasoningModeDescription(mode: ReasoningMode) {
  switch (mode) {
    case "off":
      return "Fast replies without a thinking trace.";
    case "on":
      return "Use the model's default reasoning mode.";
    case "low":
      return "Shorter reasoning for quick answers.";
    case "medium":
      return "Balanced reasoning for everyday prompts.";
    case "high":
      return "More reasoning for harder prompts.";
  }
}

function ModelCreatorAvatar({
  compact = false,
  creator,
  modelName,
}: {
  compact?: boolean;
  creator?: string;
  modelName?: string;
}) {
  const label = creator ?? (modelName ? getModelCreator(modelName) : "Local");
  const initials = creator
    ? getModelCreatorInitials(creator)
    : getModelCreatorInitials(modelName ?? label);

  return (
    <Avatar
      className={cn(
        "border border-border bg-card font-semibold text-muted-foreground",
        compact ? "size-4 text-[8px]" : "size-7 text-[10px]",
      )}
      title={label}
    >
      <AvatarFallback>{initials}</AvatarFallback>
    </Avatar>
  );
}

function groupModelsByCreator(models: OllamaModel[]) {
  const groups = new Map<string, OllamaModel[]>();

  for (const model of models) {
    const creator = getModelCreator(model.name);
    groups.set(creator, [...(groups.get(creator) ?? []), model]);
  }

  return Array.from(groups, ([creator, groupModels]) => ({
    creator,
    models: groupModels,
  }));
}

function formatTriggerModelLabel(value: string) {
  return formatModelLabel(value).split(":")[0];
}
