import { useMemo, useState } from "react";
import {
  ArrowDownToLine,
  ArrowUpDown,
  Brain,
  Code2,
  Eye,
  Hash,
  Search,
  Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { CatalogModel, CatalogTag, OllamaModel, PullProgress, RunningModel } from "@/lib/types";
import { ModelCatalogColumn } from "@/src/model-yard/model-catalog-column";
import { ModelTagColumn } from "@/src/model-yard/model-tag-column";
import { describeCapability, parsePullCount } from "@/src/model-yard/shared";

export function ModelBrowserWorkspace({
  catalogBusy,
  catalogQuery,
  catalogResults,
  catalogTagFilter,
  catalogTags,
  models,
  pullProgress,
  selectedModel,
  selectedCatalogModel,
  running,
  onCatalogQueryChange,
  onCatalogTagFilterChange,
  onDownloadCatalogTag,
  onLoadCatalogTags,
  onRefresh,
  onSearchCatalog,
  onSelectModel,
}: {
  catalogBusy: string;
  catalogQuery: string;
  catalogResults: CatalogModel[];
  catalogTagFilter: string;
  catalogTags: CatalogTag[];
  models: OllamaModel[];
  pullProgress: PullProgress[];
  selectedModel: string;
  selectedCatalogModel: string;
  running: RunningModel[];
  onCatalogQueryChange: (query: string) => void;
  onCatalogTagFilterChange: (query: string) => void;
  onDownloadCatalogTag: (name: string) => void;
  onLoadCatalogTags: (model: string) => void;
  onRefresh: () => void;
  onSearchCatalog: () => void;
  onSelectModel: (model: string) => void;
}) {
  const [capabilityFilter, setCapabilityFilter] = useState<string[]>([]);
  const [installedFilter, setInstalledFilter] = useState<"all" | "available" | "installed">("all");
  const [sortBy, setSortBy] = useState<"pulls" | "updated" | "name">("pulls");

  const localNames = useMemo(() => new Set(models.map((model) => model.name)), [models]);
  const localBaseNames = useMemo(
    () => new Set(models.map((model) => model.name.split(":")[0])),
    [models],
  );

  const filteredResults = useMemo(() => {
    let out = catalogResults;
    if (capabilityFilter.length) {
      out = out.filter((model) =>
        capabilityFilter.every((cap) =>
          model.capabilities.some((c) => describeCapability(c)?.label === cap),
        ),
      );
    }
    if (installedFilter !== "all") {
      out = out.filter((model) => {
        const base = model.name.split(":")[0];
        const isInstalled = localBaseNames.has(base);
        return installedFilter === "installed" ? isInstalled : !isInstalled;
      });
    }
    const sorted = [...out];
    if (sortBy === "name") {
      sorted.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortBy === "updated") {
      sorted.sort((a, b) => (b.updated ?? "").localeCompare(a.updated ?? ""));
    } else {
      sorted.sort((a, b) => {
        const pa = parsePullCount(a.pulls);
        const pb = parsePullCount(b.pulls);
        return pb - pa;
      });
    }
    return sorted;
  }, [catalogResults, capabilityFilter, installedFilter, sortBy, localNames, localBaseNames]);

  const filteredTags = useMemo(() => {
    const query = catalogTagFilter.trim().toLowerCase();
    if (!query) return catalogTags;
    return catalogTags.filter((tag) =>
      [tag.name, tag.quant, tag.variant, tag.size, tag.context, tag.input]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(query)),
    );
  }, [catalogTagFilter, catalogTags]);

  const selectedCatalog = catalogResults.find((m) => m.name === selectedCatalogModel);
  const latestProgress = pullProgress[pullProgress.length - 1];

  const toggleCapability = (label: string) => {
    setCapabilityFilter((current) =>
      current.includes(label) ? current.filter((c) => c !== label) : [...current, label],
    );
  };

  const popularSuggestions = ["llama3.2", "qwen2.5", "gemma3", "phi3", "mistral", "deepseek-r1"];

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <div className="flex items-end justify-between gap-3">
          <h1 className="text-sm font-semibold text-foreground">Models</h1>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground">
              {catalogResults.length} results
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 rounded-md px-2 text-[10px] text-muted-foreground"
              onClick={onRefresh}
            >
              <ArrowDownToLine className="size-3" />
              Refresh
            </Button>
          </div>
        </div>

        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={catalogQuery}
              onChange={(event) => onCatalogQueryChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") onSearchCatalog();
              }}
              className="h-8 rounded-md border-border/80 bg-background pl-8 text-xs"
              placeholder="Search models — llama, qwen, deepseek…"
            />
          </div>
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
            <SelectTrigger className="h-8 w-[130px] rounded-md text-[10px]">
              <ArrowUpDown className="mr-1 size-3 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pulls">Popular</SelectItem>
              <SelectItem value="updated">Recent</SelectItem>
              <SelectItem value="name">A → Z</SelectItem>
            </SelectContent>
          </Select>
          <Button
            className="h-8 rounded-md text-[10px]"
            onClick={onSearchCatalog}
            disabled={catalogBusy === "catalog-search"}
          >
            {catalogBusy === "catalog-search" ? (
              <span className="size-3 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" />
            ) : (
              <Search className="size-3" />
            )}
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {[
            { id: "all", label: "All" },
            { id: "available", label: "Not installed" },
            { id: "installed", label: "Installed" },
          ].map((opt) => (
            <button
              key={opt.id}
              onClick={() => setInstalledFilter(opt.id as typeof installedFilter)}
              className={cn(
                "h-6 rounded-md border px-2 text-[10px] font-medium transition-colors",
                installedFilter === opt.id
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {opt.label}
            </button>
          ))}
          <span className="mx-1 text-border">·</span>
          {[
            { id: "vision", label: "vision", Icon: Eye },
            { id: "tools", label: "tools", Icon: Wrench },
            { id: "code", label: "code", Icon: Code2 },
            { id: "thinking", label: "thinking", Icon: Brain },
            { id: "embeddings", label: "embeddings", Icon: Hash },
          ].map((opt) => {
            const active = capabilityFilter.includes(opt.id);
            return (
              <button
                key={opt.id}
                onClick={() => toggleCapability(opt.id)}
                className={cn(
                  "inline-flex h-6 items-center gap-1 rounded-md border px-1.5 text-[10px] font-medium transition-colors",
                  active
                    ? "border-primary/40 bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:text-foreground",
                )}
              >
                <opt.Icon className="size-2.5" />
                {opt.label}
              </button>
            );
          })}
        </div>

        {!catalogResults.length && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] text-muted-foreground">Try:</span>
            {popularSuggestions.map((suggestion) => (
              <button
                key={suggestion}
                onClick={() => {
                  onCatalogQueryChange(suggestion);
                }}
                className="rounded-md border border-border px-2 py-0.5 text-[10px] text-muted-foreground transition-colors hover:border-primary/30 hover:text-foreground"
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="grid min-h-[480px] gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
        <ModelCatalogColumn
          busy={catalogBusy === "catalog-search"}
          results={filteredResults}
          totalCount={catalogResults.length}
          localBaseNames={localBaseNames}
          selectedModel={selectedCatalogModel}
          onLoadTags={onLoadCatalogTags}
        />

        <ModelTagColumn
          busy={catalogBusy === `catalog-tags-${selectedCatalogModel}`}
          selectedCatalog={selectedCatalog}
          tags={filteredTags}
          tagFilter={catalogTagFilter}
          onTagFilterChange={onCatalogTagFilterChange}
          pullBusy={catalogBusy === "pull"}
          localNames={localNames}
          onDownloadTag={onDownloadCatalogTag}
          latestStatus={latestProgress?.status}
        />
      </div>
    </div>
  );
}
