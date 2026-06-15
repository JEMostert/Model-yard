"use client";

import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import {
  Activity,
  ArrowDownToLine,
  Check,
  ChevronRight,
  Circle,
  Clock,
  Cpu,
  Database,
  HardDrive,
  MessageSquare,
  Package,
  PanelRightClose,
  PanelRightOpen,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Star,
} from "lucide-react";
import { DEFAULT_PRESETS, DEFAULT_SETTINGS } from "@/lib/constants";
import { formatBytes } from "@/lib/format";
import { midnightGardenBackground } from "@/lib/static-backgrounds";
import { storage } from "@/lib/storage";
import { call, formatError, isTauriRuntime } from "@/lib/tauri";
import { BackgroundPicture } from "@/components/BackgroundPicture";
import { ChatInput } from "@/components/ChatInput";
import type {
  ActiveTab,
  CatalogModel,
  CatalogTag,
  ChatRequest,
  GenerateSettings,
  LabStatus,
  ModelMetadata,
  OllamaModel,
  Preset,
  PullProgress,
  RunningModel,
  RunResult,
} from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { ConfigSidebar } from "@/src/model-yard/config-sidebar";
import { DownloadProgressPopup } from "@/src/model-yard/download-progress";
import {
  LabNavigation,
  ModelBrowserNavigation,
  OllamaInstallNotice,
  SettingsNavigation,
} from "@/src/model-yard/navigation";
import {
  calculatePullOverall,
  normalizeSettings,
  tabStyles,
  tabs,
  type SettingsSectionId,
  type StylingPresetId,
  type WorkspaceMode,
} from "@/src/model-yard/shared";

const SettingsWorkspace = lazy(() =>
  import("@/src/model-yard/settings-workspace").then((module) => ({
    default: module.SettingsWorkspace,
  })),
);

const ModelBrowserWorkspace = lazy(() =>
  import("@/src/model-yard/model-browser").then((module) => ({
    default: module.ModelBrowserWorkspace,
  })),
);

const ChatThread = lazy(() =>
  import("@/src/model-yard/chat-thread").then((module) => ({
    default: module.ChatThread,
  })),
);

const BenchTable = lazy(() =>
  import("@/src/model-yard/chat-thread").then((module) => ({
    default: module.BenchTable,
  })),
);

const SETTINGS_SEED_MIGRATION_KEY = "model-yard-seed-negative-one-migrated";
type ChatTokenPayload = {
  run_id: string;
  content: string;
};
type ChatThinkingPayload = {
  run_id: string;
  content: string;
};
type PullProgressPayload = {
  model: string;
  progress: PullProgress;
};

export default function Home() {
  const [workspace, setWorkspace] = useState<WorkspaceMode>("lab");
  const [activeSettingsSection, setActiveSettingsSection] =
    useState<SettingsSectionId>("styling");
  const [activeTab, setActiveTab] = useState<ActiveTab>("chat");
  const [status, setStatus] = useState<LabStatus | null>(null);
  const [models, setModels] = useState<OllamaModel[]>([]);
  const [modelMetadata, setModelMetadata] = useState<Record<string, ModelMetadata>>({});
  const [running, setRunning] = useState<RunningModel[]>([]);
  const [selectedModel, setSelectedModel] = useState("");
  const [compareModels, setCompareModels] = useState<string[]>([]);
  const [prompt, setPrompt] = useState(
    "Explain how attention works in transformers.",
  );
  const [systemPrompt, setSystemPrompt] = useState("");
  const [settings, setSettings] = useState<GenerateSettings>(DEFAULT_SETTINGS);
  const [result, setResult] = useState<RunResult | null>(null);
  const [compareResults, setCompareResults] = useState<RunResult[]>([]);
  const [history, setHistory] = useState<RunResult[]>([]);
  const [presets, setPresets] = useState<Preset[]>(DEFAULT_PRESETS);
  const [stylingPreset, setStylingPreset] =
    useState<StylingPresetId>("midnight-garden");
  const [pullName, setPullName] = useState("llama3.2:latest");
  const [pullProgress, setPullProgress] = useState<PullProgress[]>([]);
  const [activePullModel, setActivePullModel] = useState("");
  const [downloadPopupOpen, setDownloadPopupOpen] = useState(false);
  const [catalogQuery, setCatalogQuery] = useState("llama3.2");
  const [catalogResults, setCatalogResults] = useState<CatalogModel[]>([]);
  const [catalogTags, setCatalogTags] = useState<Record<string, CatalogTag[]>>({});
  const [selectedCatalogModel, setSelectedCatalogModel] = useState("llama3.2");
  const [catalogTagFilter, setCatalogTagFilter] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [statusOpen, setStatusOpen] = useState(false);
  const [configOpen, setConfigOpen] = useState(true);
  const [thinkingEnabled, setThinkingEnabled] = useState(false);
  const catalogSeededRef = useRef(false);
  const streamingRunIdRef = useRef<string | null>(null);
  const streamBufferRef = useRef({ response: "", thinking: "" });
  const streamFlushTimerRef = useRef<number | null>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  const modelNames = useMemo(() => models.map((model) => model.name), [models]);
  const selectedDetails = models.find((model) => model.name === selectedModel);
  const selectedMetadata = selectedModel ? modelMetadata[selectedModel] : undefined;
  const thinkingSupported = Boolean(selectedMetadata?.supports_thinking);
  const selectedModelLabel =
    selectedModel
      .split("/")
      .pop()
      ?.replace(/:latest$/, "") || "No model";
  const selectedModelLoaded = running.some(
    (model) => model.name === selectedModel || model.model === selectedModel,
  );
  const selectedRunningModel = running.find(
    (model) => model.name === selectedModel || model.model === selectedModel,
  );
  const ollamaInstalled = status?.ollama_installed ?? true;
  const rightPanelVisible = workspace === "lab" && configOpen;
  const visibleResults =
    activeTab === "history"
      ? history
      : activeTab === "chat"
        ? result
          ? [result]
          : []
        : compareResults;

  useEffect(() => {
    setHistory(storage.get("model-yard-history", []));
    setPresets(storage.get("model-yard-presets", DEFAULT_PRESETS));
    setStylingPreset(
      storage.get<StylingPresetId>("model-yard-styling-preset", "midnight-garden"),
    );
    const storedSettings = storage.get<Partial<GenerateSettings>>(
      "model-yard-settings",
      DEFAULT_SETTINGS,
    );
    const migrateLegacyZeroSeed =
      window.localStorage.getItem(SETTINGS_SEED_MIGRATION_KEY) !== "true";
    setSettings(normalizeSettings(storedSettings, migrateLegacyZeroSeed));
    window.localStorage.setItem(SETTINGS_SEED_MIGRATION_KEY, "true");
    refreshAll();
  }, []);
  useEffect(() => {
    if (!isTauriRuntime()) return;
    const flushStreamingBuffers = () => {
      streamFlushTimerRef.current = null;
      const { response, thinking } = streamBufferRef.current;
      if (!response && !thinking) return;
      streamBufferRef.current = { response: "", thinking: "" };
      setResult((current) =>
        current
          ? {
              ...current,
              response: response ? current.response + response : current.response,
              thinking: thinking ? (current.thinking ?? "") + thinking : current.thinking,
            }
          : current,
      );
    };
    const scheduleStreamingFlush = () => {
      if (streamFlushTimerRef.current !== null) return;
      streamFlushTimerRef.current = window.setTimeout(flushStreamingBuffers, 50);
    };
    const unlistenToken = listen<ChatTokenPayload>("chat-token", (event) => {
      if (event.payload.run_id !== streamingRunIdRef.current) return;
      streamBufferRef.current.response += event.payload.content;
      scheduleStreamingFlush();
    });
    const unlistenThinking = listen<ChatThinkingPayload>("chat-thinking", (event) => {
      if (event.payload.run_id !== streamingRunIdRef.current) return;
      streamBufferRef.current.thinking += event.payload.content;
      scheduleStreamingFlush();
    });
    const unlistenPull = listen<PullProgressPayload>("pull-progress", (event) => {
      setActivePullModel(event.payload.model);
      setDownloadPopupOpen(true);
      setPullProgress((current) => [...current, event.payload.progress]);
    });

    return () => {
      if (streamFlushTimerRef.current !== null) {
        window.clearTimeout(streamFlushTimerRef.current);
        streamFlushTimerRef.current = null;
      }
      streamBufferRef.current = { response: "", thinking: "" };
      unlistenToken.then((unlisten) => unlisten());
      unlistenThinking.then((unlisten) => unlisten());
      unlistenPull.then((unlisten) => unlisten());
    };
  }, []);

  useEffect(
    () => storage.set("model-yard-history", history.slice(0, 100)),
    [history],
  );
  useEffect(() => storage.set("model-yard-presets", presets), [presets]);
  useEffect(
    () => storage.set("model-yard-styling-preset", stylingPreset),
    [stylingPreset],
  );
  useEffect(() => storage.set("model-yard-settings", settings), [settings]);
  useEffect(() => {
    if (!thinkingSupported) setThinkingEnabled(false);
  }, [thinkingSupported]);
  useEffect(() => {
    if (busy !== "chat") return;
    const element = chatScrollRef.current;
    if (!element) return;
    element.scrollTop = element.scrollHeight;
  }, [result?.response, result?.thinking, busy]);
  useEffect(() => {
    if (workspace !== "models" || catalogSeededRef.current) return;
    catalogSeededRef.current = true;
    searchCatalog(catalogQuery);
  }, [workspace]);

  async function refreshAll() {
    setError("");
    try {
      const [nextStatus, nextModels, nextRunning] = await Promise.all([
        call<LabStatus>("ollama_status"),
        call<OllamaModel[]>("list_models"),
        call<RunningModel[]>("running_models"),
      ]);
      const nextMetadata = await call<ModelMetadata[]>("model_metadata", {
        names: nextModels.map((model) => model.name),
      }).catch(() => []);
      setStatus(nextStatus);
      setModels(nextModels);
      setModelMetadata(
        Object.fromEntries(nextMetadata.map((metadata) => [metadata.name, metadata])),
      );
      setRunning(nextRunning);
      if (!selectedModel && nextModels[0]) setSelectedModel(nextModels[0].name);
      if (!compareModels.length && nextModels.length)
        setCompareModels(nextModels.slice(0, 2).map((model) => model.name));
    } catch (err) {
      setError(formatError(err));
    }
  }

  async function runModel(
    model: string,
    runPrompt = prompt,
    runId?: string,
  ): Promise<RunResult> {
    const request: ChatRequest = {
      run_id: runId,
      model,
      prompt: runPrompt,
      system_prompt: systemPrompt,
      options: settings,
    };
    if (modelMetadata[model]?.supports_thinking) request.think = thinkingEnabled;
    return call<RunResult>("chat_model", {
      request,
    });
  }

  async function runChat() {
    if (!selectedModel) return;
    const runId = crypto.randomUUID();
    streamingRunIdRef.current = runId;
    streamBufferRef.current = { response: "", thinking: "" };
    if (streamFlushTimerRef.current !== null) {
      window.clearTimeout(streamFlushTimerRef.current);
      streamFlushTimerRef.current = null;
    }
    setBusy("chat");
    setError("");
    setResult({
      model: selectedModel,
      prompt,
      response: "",
      created_at: new Date().toISOString(),
    });
    try {
      const next = await runModel(selectedModel, prompt, runId);
      streamBufferRef.current = { response: "", thinking: "" };
      if (streamFlushTimerRef.current !== null) {
        window.clearTimeout(streamFlushTimerRef.current);
        streamFlushTimerRef.current = null;
      }
      setResult(next);
      setHistory((items) => [next, ...items].slice(0, 100));
      refreshAll();
    } catch (err) {
      setError(formatError(err));
    } finally {
      streamingRunIdRef.current = null;
      setBusy("");
    }
  }

  async function runCompare() {
    if (!compareModels.length) return;
    setBusy("compare");
    setError("");
    setCompareResults([]);
    try {
      const results = await Promise.all(
        compareModels.map((model) => runModel(model)),
      );
      setCompareResults(results);
      setHistory((items) => [...results, ...items].slice(0, 100));
      refreshAll();
    } catch (err) {
      setError(formatError(err));
    } finally {
      setBusy("");
    }
  }

  async function runBench() {
    const suite = [
      "Return a JSON object with keys summary and risk for running local LLMs.",
      "Explain the difference between temperature and top_p in two paragraphs.",
      "Write a bash command to list the ten largest files under the current directory.",
    ];
    const targets = compareModels.length
      ? compareModels
      : selectedModel
        ? [selectedModel]
        : [];
    setBusy("bench");
    setError("");
    try {
      const results: RunResult[] = [];
      for (const benchPrompt of suite)
        results.push(
          ...(await Promise.all(
            targets.map((model) => runModel(model, benchPrompt)),
          )),
        );
      setCompareResults(results);
      setHistory((items) => [...results, ...items].slice(0, 100));
    } catch (err) {
      setError(formatError(err));
    } finally {
      setBusy("");
    }
  }

  async function pullModel() {
    if (!pullName.trim()) return;
    await pullModelByName(pullName.trim());
  }

  async function pullModelByName(name: string) {
    if (!name.trim()) return;
    const nextName = name.trim();
    setBusy("pull");
    setActivePullModel(nextName);
    setDownloadPopupOpen(true);
    setPullProgress([]);
    setError("");
    try {
      const progress = await call<PullProgress[]>("pull_model", {
        name: nextName,
      });
      setPullProgress(progress);
      await refreshAll();
    } catch (err) {
      setError(formatError(err));
    } finally {
      setBusy("");
    }
  }

  async function searchCatalog(query = catalogQuery) {
    const nextQuery = query.trim();
    if (!nextQuery) return;
    setBusy("catalog-search");
    setError("");
    try {
      const results = await call<CatalogModel[]>("search_catalog", {
        query: nextQuery,
      });
      setCatalogResults(results);
      const firstModel = results[0]?.name;
      if (firstModel) {
        setSelectedCatalogModel(firstModel);
        await loadCatalogTags(firstModel);
      }
    } catch (err) {
      setError(formatError(err));
    } finally {
      setBusy("");
    }
  }

  async function loadCatalogTags(model: string) {
    if (!model.trim()) return;
    setSelectedCatalogModel(model);
    if (catalogTags[model]) return;
    setBusy(`catalog-tags-${model}`);
    setError("");
    try {
      const tags = await call<CatalogTag[]>("catalog_model_tags", { model });
      setCatalogTags((items) => ({ ...items, [model]: tags }));
    } catch (err) {
      setError(formatError(err));
    } finally {
      setBusy("");
    }
  }

  async function deleteModel(name: string) {
    setBusy(`delete-${name}`);
    setError("");
    try {
      await call("delete_model", { name });
      if (selectedModel === name) setSelectedModel("");
      setCompareModels((items) => items.filter((item) => item !== name));
      await refreshAll();
    } catch (err) {
      setError(formatError(err));
    } finally {
      setBusy("");
    }
  }

  async function loadSelectedModel() {
    if (!selectedModel) return;
    setBusy("load-model");
    setError("");
    try {
      const nextRunning = await call<RunningModel[]>("load_model", {
        name: selectedModel,
      });
      setRunning(nextRunning);
    } catch (err) {
      setError(formatError(err));
    } finally {
      setBusy("");
    }
  }

  async function ejectSelectedModel() {
    if (!selectedModel) return;
    setBusy("eject-model");
    setError("");
    try {
      const nextRunning = await call<RunningModel[]>("unload_model", {
        name: selectedModel,
      });
      setRunning(nextRunning);
    } catch (err) {
      setError(formatError(err));
    } finally {
      setBusy("");
    }
  }

  function savePreset() {
    const name = prompt.slice(0, 42).trim() || "Untitled prompt";
    setPresets((items) =>
      [{ id: crypto.randomUUID(), name, prompt }, ...items].slice(0, 30),
    );
  }

  function exportResults(kind: "json" | "md") {
    const payload = activeTab === "chat" && result ? [result] : compareResults;
    if (!payload.length) return;
    const data =
      kind === "json"
        ? JSON.stringify(payload, null, 2)
        : payload
            .map((item) => `## ${item.model}\n\n${item.response}`)
            .join("\n\n");
    const blob = new Blob([data], {
      type: kind === "json" ? "application/json" : "text/markdown",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `model-yard-${new Date().toISOString().slice(0, 19)}.${kind}`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function installOllama() {
    setBusy("install-ollama");
    setError("");
    try {
      await call("install_ollama");
    } catch (err) {
      setError(formatError(err));
    } finally {
      setBusy("");
    }
  }

  const runAction =
    activeTab === "compare"
      ? runCompare
      : activeTab === "bench"
        ? runBench
        : runChat;
  const centerMaxWidth = workspace === "lab" ? "max-w-[760px]" : "max-w-[920px]";
  const latestPullProgress = pullProgress[pullProgress.length - 1];
  const pullOverallProgress = useMemo(
    () => calculatePullOverall(pullProgress),
    [pullProgress],
  );

  return (
    <main
      data-style-preset={stylingPreset}
      data-streaming={busy === "chat" ? "true" : "false"}
      className={cn(
        "model-yard-shell group/model-yard grid h-screen grid-rows-[minmax(0,1fr)_auto] gap-3 overflow-hidden bg-background p-3 text-foreground transition-[grid-template-columns] duration-300 ease-out max-[760px]:flex max-[760px]:h-auto max-[760px]:min-h-screen max-[760px]:flex-col max-[760px]:gap-2 max-[760px]:overflow-visible max-[760px]:p-2",
        rightPanelVisible
          ? "grid-cols-[260px_minmax(520px,1fr)_280px] max-[1080px]:grid-cols-[240px_minmax(420px,1fr)]"
          : "grid-cols-[260px_minmax(520px,1fr)_0px] max-[1080px]:grid-cols-[240px_minmax(420px,1fr)]",
      )}
    >
      <BackgroundPicture
        image={midnightGardenBackground}
        pictureClassName="model-yard-background pointer-events-none absolute inset-0 z-0 overflow-hidden"
        className="h-full w-full object-cover object-left"
      />

      <aside className="row-start-1 min-h-0 min-w-0 max-[760px]:hidden">
        <Card className="flex h-full min-w-0 flex-col overflow-hidden rounded-xl">
          <div className="flex h-[52px] shrink-0 items-center border-b border-border bg-card px-5 text-[13px] font-semibold leading-none text-foreground">
            <span>model-yard</span>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            <CardContent className="flex flex-col gap-4 p-3">
              {workspace === "settings" ? (
                <SettingsNavigation
                  activeSection={activeSettingsSection}
                  onSelectSection={setActiveSettingsSection}
                />
              ) : workspace === "models" ? (
                <ModelBrowserNavigation
                  models={models}
                  running={running}
                  selectedModel={selectedModel}
                  onBack={() => setWorkspace("lab")}
                  onSelectModel={setSelectedModel}
                />
              ) : (
                <LabNavigation
                  history={history}
                  models={models}
                  selectedModel={selectedModel}
                  onOpenModels={() => setWorkspace("models")}
                  onSelectModel={setSelectedModel}
                  onSetTab={setActiveTab}
                />
              )}
            </CardContent>
          </div>
          {workspace === "lab" && !ollamaInstalled && (
            <OllamaInstallNotice
              busy={busy === "install-ollama"}
              onInstall={installOllama}
            />
          )}
        </Card>
      </aside>

      <section className="row-start-1 flex min-h-0 min-w-0 flex-col overflow-hidden max-[760px]:min-h-screen">
        {error && (
          <div className="mx-4 mt-2.5 rounded-lg border border-destructive/45 bg-destructive/15 px-2.5 py-2 text-[13px] text-destructive">
            {error}
          </div>
        )}

        <div
          ref={chatScrollRef}
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
        >
          <div className={cn("mx-auto w-full px-[22px] pb-8 pt-[22px]", centerMaxWidth)}>
            <Suspense
              fallback={
                <div className="grid min-h-[320px] place-items-center text-xs text-muted-foreground">
                  Loading workspace...
                </div>
              }
            >
              {workspace === "settings" ? (
                <SettingsWorkspace
                  activeSection={activeSettingsSection}
                  historyCount={history.length}
                  modelCount={models.length}
                  installBusy={busy === "install-ollama"}
                  status={status}
                  stylingPreset={stylingPreset}
                  onInstallOllama={installOllama}
                  onStylingPresetChange={setStylingPreset}
                />
              ) : workspace === "models" ? (
                <ModelBrowserWorkspace
                  catalogBusy={busy}
                  catalogQuery={catalogQuery}
                  catalogResults={catalogResults}
                  catalogTagFilter={catalogTagFilter}
                  catalogTags={catalogTags[selectedCatalogModel] ?? []}
                  models={models}
                  pullProgress={pullProgress}
                  selectedModel={selectedModel}
                  selectedCatalogModel={selectedCatalogModel}
                  running={running}
                  onCatalogQueryChange={setCatalogQuery}
                  onCatalogTagFilterChange={setCatalogTagFilter}
                  onDownloadCatalogTag={(name) => {
                    setPullName(name);
                    pullModelByName(name);
                  }}
                  onLoadCatalogTags={loadCatalogTags}
                  onRefresh={refreshAll}
                  onSearchCatalog={() => searchCatalog()}
                  onSelectModel={setSelectedModel}
                />
              ) : (
              <>
                {activeTab === "compare" && (
                  <div className="flex flex-wrap gap-1.5 pb-[18px]">
                    {models.map((model) => (
                      <button
                        key={model.name}
                        className={cn(
                          "rounded-full border border-border bg-background px-3 py-1.5 text-xs text-muted-foreground",
                          compareModels.includes(model.name) &&
                            "border-primary bg-accent text-foreground",
                        )}
                        onClick={() =>
                          setCompareModels((items) =>
                            items.includes(model.name)
                              ? items.filter((item) => item !== model.name)
                              : [...items, model.name],
                          )
                        }
                      >
                        {model.name}
                      </button>
                    ))}
                  </div>
                )}
                {activeTab === "bench" ? (
                  <BenchTable results={visibleResults} />
                ) : (
                  <ChatThread
                    results={visibleResults}
                    activeTab={activeTab}
                    busy={busy}
                  />
                )}
              </>
              )}
            </Suspense>
          </div>
        </div>

        <DownloadProgressPopup
          model={activePullModel || pullName}
          open={downloadPopupOpen && (busy === "pull" || pullProgress.length > 0)}
          pullBusy={busy === "pull"}
          progress={pullProgress}
          overallProgress={pullOverallProgress}
          latestStatus={latestPullProgress?.status}
          onClose={() => setDownloadPopupOpen(false)}
        />

        {workspace === "lab" && (
          <footer className="shrink-0 border-border">
            <ChatInput
              value={prompt}
              onChange={setPrompt}
              models={models}
              selectedModel={selectedModel}
              activeTab={activeTab}
              busy={busy}
              thinkingEnabled={thinkingEnabled}
              thinkingSupported={thinkingSupported}
              selectedModelLoaded={selectedModelLoaded}
              onSelectModel={setSelectedModel}
              onThinkingChange={setThinkingEnabled}
              onEjectSelectedModel={ejectSelectedModel}
              onRefresh={refreshAll}
              onRun={runAction}
            />
            <div className="mx-auto flex w-full max-w-[760px] items-center justify-between gap-3 py-1 text-[10px] text-muted-foreground">
              <div className="flex items-center gap-1 text-[10px]">
                <ShieldCheck className="size-2.5" />
                <span>Local only</span>
                <span className="mx-1 text-border">|</span>
                <span
                  className={cn(
                    "size-1.5 rounded-full",
                    status?.api_ok ? "bg-emerald-500" : "bg-muted-foreground",
                  )}
                />
                <span>{status?.api_ok ? "Ollama connected" : "Ollama offline"}</span>
              </div>
              <div className="flex min-w-0 items-center gap-1 text-[10px]">
                <Cpu className="size-2.5 shrink-0" />
                <span className="truncate">{selectedModelLabel}</span>
                <span className="text-muted-foreground/70">
                  {selectedModelLoaded ? "loaded" : "idle"}
                </span>
              </div>
            </div>
          </footer>
        )}
      </section>

      {workspace === "lab" && (
        <ConfigSidebar
          busy={busy}
          compareResultCount={compareResults.length}
          configOpen={configOpen}
          historyCount={history.length}
          pullName={pullName}
          pullProgress={pullProgress}
          result={result}
          running={running}
          selectedDetails={selectedDetails}
          selectedMetadata={selectedMetadata}
          selectedModel={selectedModel}
          selectedModelLabel={selectedModelLabel}
          selectedModelLoaded={selectedModelLoaded}
          selectedRunningModel={selectedRunningModel}
          settings={settings}
          systemPrompt={systemPrompt}
          onDeleteModel={deleteModel}
          onEjectSelectedModel={ejectSelectedModel}
          onExportResults={exportResults}
          onLoadSelectedModel={loadSelectedModel}
          onPullModel={pullModel}
          onPullNameChange={setPullName}
          onSettingsChange={setSettings}
          onSystemPromptChange={setSystemPrompt}
        />
      )}

      <Card className="col-start-1 col-end-3 row-start-2 grid h-10 grid-cols-[1fr_auto_1fr] items-center rounded-xl px-3 text-[11px] text-muted-foreground max-[760px]:col-auto">
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "h-7 w-fit gap-1.5 rounded-md px-2 text-[11px] text-muted-foreground hover:bg-accent hover:text-foreground",
            workspace === "settings" && "bg-accent text-foreground",
          )}
          onClick={() =>
            setWorkspace((mode) => (mode === "settings" ? "lab" : "settings"))
          }
        >
          <Settings className="size-3.5" />
          <span>Settings</span>
        </Button>
        <div className="justify-self-center rounded-lg border border-black/30 bg-black/25 p-1 shadow-[inset_0_1px_3px_rgba(0,0,0,0.75),inset_0_-1px_0_rgba(255,255,255,0.06)]">
          <div className="flex items-center gap-0.5">
            {tabs.map((tab) => {
              const isActive = activeTab === tab;
              return (
                <button
                  key={tab}
                  className={cn(
                    "relative flex h-6 items-center rounded-md px-3 text-[11px] font-semibold capitalize transition-all duration-150",
                    "text-muted-foreground hover:bg-white/5 hover:text-foreground",
                    "active:translate-y-px",
                    isActive &&
                      cn(
                        "translate-y-[-1px]",
                        tabStyles[tab].active,
                        tabStyles[tab].glow,
                      ),
                  )}
                  onClick={() => {
                    setWorkspace("lab");
                    setActiveTab(tab);
                  }}
                >
                  <span
                    className={cn(
                      "mr-1.5 size-1.5 rounded-full",
                      tab === "chat" && "bg-cyan-400",
                      tab === "compare" && "bg-emerald-400",
                      tab === "bench" && "bg-amber-400",
                      tab === "history" && "bg-violet-400",
                      isActive && "bg-slate-950/80",
                    )}
                  />
                  {tab}
                </button>
              );
            })}
          </div>
        </div>
        <div className="flex items-center gap-1 justify-self-end">
          <Popover open={statusOpen} onOpenChange={setStatusOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-7 rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
                onMouseEnter={() => setStatusOpen(true)}
                onMouseLeave={() => setStatusOpen(false)}
                onFocus={() => setStatusOpen(true)}
                onBlur={() => setStatusOpen(false)}
              >
                <Activity className="size-3.5" />
              </Button>
            </PopoverTrigger>
            <PopoverContent
              align="end"
              side="top"
              className="space-y-3 text-xs"
              onMouseEnter={() => setStatusOpen(true)}
              onMouseLeave={() => setStatusOpen(false)}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Ollama</span>
                <span className="flex items-center gap-1.5 font-medium">
                  <Circle className="size-2 fill-emerald-500 text-emerald-500" />
                  {status?.service_state ?? "unknown"}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Models</span>
                <span className="font-medium">{models.length}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">GPU</span>
                <span className="truncate text-right font-medium">
                  {status?.gpu_hint ?? "GPU"}
                </span>
              </div>
            </PopoverContent>
          </Popover>
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "size-7 rounded-md text-muted-foreground hover:bg-accent hover:text-foreground",
              workspace !== "lab" && "pointer-events-none opacity-30",
              rightPanelVisible && "bg-accent text-foreground",
            )}
            onClick={() => setConfigOpen((open) => !open)}
            disabled={workspace !== "lab"}
            title={
              workspace === "lab"
                ? configOpen
                  ? "Hide configuration"
                  : "Show configuration"
                : "Configuration is hidden outside the lab"
            }
          >
            {rightPanelVisible ? (
              <PanelRightClose className="size-3.5" />
            ) : (
              <PanelRightOpen className="size-3.5" />
            )}
          </Button>
        </div>
      </Card>
    </main>
  );
}
