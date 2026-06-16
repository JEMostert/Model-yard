"use client";

import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import {
  Activity,
  Circle,
  Cpu,
  Download,
  PanelRightClose,
  PanelRightOpen,
  ShieldCheck,
} from "lucide-react";
import { DEFAULT_PRESETS, DEFAULT_SETTINGS } from "@/lib/constants";
import { midnightGardenBackground } from "@/lib/static-backgrounds";
import { storage } from "@/lib/storage";
import { buildChatMessages } from "@/lib/chat";
import { call, formatError, isTauriRuntime } from "@/lib/tauri";
import { BackgroundPicture } from "@/components/BackgroundPicture";
import { ChatInput } from "@/components/ChatInput";
import type {
  CatalogModel,
  CatalogTag,
  ChatRequest,
  GenerateSettings,
  LabStatus,
  ModelMetadata,
  OllamaModel,
  Preset,
  PullProgress,
  ReasoningMode,
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

const SETTINGS_SEED_MIGRATION_KEY = "model-yard-seed-negative-one-migrated";
const EMPTY_REASONING_MODES: ReasoningMode[] = [];
const backgroundImageEnabled = import.meta.env.VITE_BACKGROUND_IMAGE !== "false";
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
const MAX_PULL_PROGRESS_ITEMS = 80;

function pullProgressKey(progress: PullProgress) {
  return progress.digest ?? progress.status;
}

function compactPullProgress(current: PullProgress[], next: PullProgress) {
  const nextKey = pullProgressKey(next);
  const deduped = current.filter((item) => pullProgressKey(item) !== nextKey);
  return [...deduped, next].slice(-MAX_PULL_PROGRESS_ITEMS);
}

function compactPullProgressList(progress: PullProgress[]) {
  return progress.reduce<PullProgress[]>(compactPullProgress, []);
}

function LlamaIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M8 3c-1 0-2 1-2 2v2c-2 0-3 1-3 3 0 2 1 3 3 4v3a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2v-3c2-1 3-2 3-4 0-2-1-3-3-3V5c0-1-1-2-2-2" />
      <circle cx="9" cy="10" r="1" fill="currentColor" />
      <circle cx="15" cy="10" r="1" fill="currentColor" />
      <path d="M10 14h4" />
      <path d="M8 3c0-1 1-1 1-1" />
      <path d="M16 3c0-1-1-1-1-1" />
    </svg>
  );
}

export default function Home() {
  const [workspace, setWorkspace] = useState<WorkspaceMode>("lab");
  const [activeSettingsSection, setActiveSettingsSection] =
    useState<SettingsSectionId>("styling");
  const [status, setStatus] = useState<LabStatus | null>(null);
  const [models, setModels] = useState<OllamaModel[]>([]);
  const [modelMetadata, setModelMetadata] = useState<Record<string, ModelMetadata>>({});
  const [running, setRunning] = useState<RunningModel[]>([]);
  const [selectedModel, setSelectedModel] = useState("");
  const [prompt, setPrompt] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [settings, setSettings] = useState<GenerateSettings>(DEFAULT_SETTINGS);
  const [chatResults, setChatResults] = useState<RunResult[]>([]);
  const [history, setHistory] = useState<RunResult[]>([]);
  const [favoriteModelNames, setFavoriteModelNames] = useState<string[]>([]);
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
  const [reasoningMode, setReasoningMode] = useState<ReasoningMode>("off");
  const catalogSeededRef = useRef(false);
  const streamingRunIdRef = useRef<string | null>(null);
  const streamBufferRef = useRef({ response: "", thinking: "" });
  const streamFlushTimerRef = useRef<number | null>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const chatShouldStickToBottomRef = useRef(true);
  const streamingChatIndexRef = useRef(-1);

  const modelsByName = useMemo(
    () => new Map(models.map((model) => [model.name, model])),
    [models],
  );
  const runningByName = useMemo(() => {
    const map = new Map<string, RunningModel>();
    for (const model of running) {
      map.set(model.name, model);
      if (model.model) map.set(model.model, model);
    }
    return map;
  }, [running]);
  const selectedDetails = modelsByName.get(selectedModel);
  const selectedMetadata = selectedModel ? modelMetadata[selectedModel] : undefined;
  const reasoningModes = selectedMetadata?.reasoning_modes ?? EMPTY_REASONING_MODES;
  const selectedModelLabel =
    selectedModel
      .split("/")
      .pop()
      ?.replace(/:latest$/, "") || "No model";
  const selectedRunningModel = runningByName.get(selectedModel);
  const selectedModelLoaded = Boolean(selectedRunningModel);
  const ollamaInstalled = status?.ollama_installed ?? true;
  const rightPanelVisible = workspace === "lab" && configOpen;

  const flushStreamingBuffers = useCallback(() => {
    streamFlushTimerRef.current = null;
    const { response, thinking } = streamBufferRef.current;
    if (!response && !thinking) return;
    streamBufferRef.current = { response: "", thinking: "" };
    setChatResults((current) => {
      const idx = streamingChatIndexRef.current;
      if (idx < 0 || idx >= current.length) return current;
      const target = current[idx];
      return [
        ...current.slice(0, idx),
        {
          ...target,
          response: response ? target.response + response : target.response,
          thinking: thinking
            ? (target.thinking ?? "") + thinking
            : target.thinking,
        },
        ...current.slice(idx + 1),
      ];
    });
  }, []);

  useEffect(() => {
    setHistory(storage.get("model-yard-history", []));
    setFavoriteModelNames(storage.get("model-yard-favorite-models", []));
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
      setPullProgress((current) => compactPullProgress(current, event.payload.progress));
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
  }, [flushStreamingBuffers]);

  useEffect(
    () => storage.set("model-yard-history", history.slice(0, 100)),
    [history],
  );
  useEffect(
    () => storage.set("model-yard-favorite-models", favoriteModelNames),
    [favoriteModelNames],
  );
  useEffect(() => storage.set("model-yard-presets", presets), [presets]);
  useEffect(
    () => storage.set("model-yard-styling-preset", stylingPreset),
    [stylingPreset],
  );
  useEffect(() => storage.set("model-yard-settings", settings), [settings]);
  useEffect(() => {
    setChatResults([]);
  }, [selectedModel]);
  useEffect(() => {
    if (!reasoningModes.length) {
      setReasoningMode("off");
      return;
    }
    if (!reasoningModes.includes(reasoningMode)) setReasoningMode(reasoningModes[0]);
  }, [reasoningMode, reasoningModes]);
  const latestChatResult = chatResults[chatResults.length - 1];
  useEffect(() => {
    if (busy !== "chat") return;
    const element = chatScrollRef.current;
    if (!element) return;
    if (!chatShouldStickToBottomRef.current) return;
    element.scrollTop = element.scrollHeight;
  }, [latestChatResult?.response, latestChatResult?.thinking, busy]);
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
    } catch (err) {
      setError(formatError(err));
    }
  }

  async function runModel(
    model: string,
    runPrompt = prompt,
    history: RunResult[] = [],
    runId?: string,
  ): Promise<RunResult> {
    const request: ChatRequest = {
      run_id: runId,
      model,
      messages: buildChatMessages(systemPrompt, history, runPrompt),
      options: settings,
    };
    const selectedReasoningModes = modelMetadata[model]?.reasoning_modes ?? [];
    if (selectedReasoningModes.includes(reasoningMode)) {
      request.think =
        reasoningMode === "off" ? false : reasoningMode === "on" ? true : reasoningMode;
    }
    return call<RunResult>("chat_model", {
      request,
    });
  }

  async function runChat(runPrompt = prompt) {
    if (!selectedModel) return;
    const submittedPrompt = runPrompt.trim();
    if (!submittedPrompt) return;
    const runId = crypto.randomUUID();
    streamingRunIdRef.current = runId;
    chatShouldStickToBottomRef.current = true;
    streamBufferRef.current = { response: "", thinking: "" };
    if (streamFlushTimerRef.current !== null) {
      window.clearTimeout(streamFlushTimerRef.current);
      streamFlushTimerRef.current = null;
    }
    setBusy("chat");
    setError("");
    setPrompt("");
    const placeholder: RunResult = {
      model: selectedModel,
      prompt: submittedPrompt,
      response: "",
      created_at: new Date().toISOString(),
    };
    setChatResults((current) => [...current, placeholder]);
    streamingChatIndexRef.current = chatResults.length;
    try {
      const history = chatResults;
      const next = await runModel(selectedModel, submittedPrompt, history, runId);
      if (streamingRunIdRef.current !== runId) return;
      streamBufferRef.current = { response: "", thinking: "" };
      if (streamFlushTimerRef.current !== null) {
        window.clearTimeout(streamFlushTimerRef.current);
        streamFlushTimerRef.current = null;
      }
      setChatResults((current) => {
        const nextResults = [...current];
        nextResults[nextResults.length - 1] = next;
        return nextResults;
      });
      setHistory((items) => [next, ...items].slice(0, 100));
      refreshAll();
    } catch (err) {
      if (streamingRunIdRef.current !== runId) return;
      setError(formatError(err));
      setChatResults((current) => current.slice(0, -1));
    } finally {
      if (streamingRunIdRef.current === runId) {
        streamingRunIdRef.current = null;
        streamingChatIndexRef.current = -1;
        setBusy("");
      }
    }
  }

  function stopChat() {
    if (busy !== "chat") return;
    const runId = streamingRunIdRef.current;
    streamingRunIdRef.current = null;
    streamingChatIndexRef.current = -1;
    if (runId) {
      void call("cancel_chat", { runId }).catch(() => undefined);
    }
    if (streamFlushTimerRef.current !== null) {
      window.clearTimeout(streamFlushTimerRef.current);
      streamFlushTimerRef.current = null;
    }
    flushStreamingBuffers();
    setBusy("");
  }

  async function rerunChat(index: number) {
    if (!selectedModel) return;
    if (busy) return;
    const existing = chatResults[index];
    if (!existing) return;
    const runId = crypto.randomUUID();
    streamingRunIdRef.current = runId;
    streamingChatIndexRef.current = index;
    chatShouldStickToBottomRef.current = true;
    streamBufferRef.current = { response: "", thinking: "" };
    if (streamFlushTimerRef.current !== null) {
      window.clearTimeout(streamFlushTimerRef.current);
      streamFlushTimerRef.current = null;
    }
    setBusy("chat");
    setError("");
    setChatResults((current) => {
      const target = current[index];
      if (!target) return current;
      return [
        ...current.slice(0, index),
        { ...target, response: "", thinking: undefined },
        ...current.slice(index + 1),
      ];
    });
    try {
      const history = chatResults.slice(0, index);
      const next = await runModel(selectedModel, existing.prompt, history, runId);
      if (streamingRunIdRef.current !== runId) return;
      streamBufferRef.current = { response: "", thinking: "" };
      if (streamFlushTimerRef.current !== null) {
        window.clearTimeout(streamFlushTimerRef.current);
        streamFlushTimerRef.current = null;
      }
      setChatResults((current) => {
        if (index >= current.length) return current;
        return [
          ...current.slice(0, index),
          next,
          ...current.slice(index + 1),
        ];
      });
      setHistory((items) => [next, ...items].slice(0, 100));
      refreshAll();
    } catch (err) {
      if (streamingRunIdRef.current !== runId) return;
      setError(formatError(err));
    } finally {
      if (streamingRunIdRef.current === runId) {
        streamingRunIdRef.current = null;
        streamingChatIndexRef.current = -1;
        setBusy("");
      }
    }
  }

  function deleteChatTurn(index: number) {
    setChatResults((current) => current.filter((_, i) => i !== index));
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
      setPullProgress(compactPullProgressList(progress));
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
      setFavoriteModelNames((items) => items.filter((item) => item !== name));
      await refreshAll();
    } catch (err) {
      setError(formatError(err));
    } finally {
      setBusy("");
    }
  }

  function toggleFavoriteModel(name: string) {
    setFavoriteModelNames((items) =>
      items.includes(name)
        ? items.filter((item) => item !== name)
        : [...items, name],
    );
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

  function savePreset(name?: string) {
    const presetName = name?.trim() || prompt.slice(0, 42).trim() || "Untitled prompt";
    setPresets((items) =>
      [{ id: crypto.randomUUID(), name: presetName, prompt }, ...items].slice(0, 30),
    );
  }

  function deletePreset(id: string) {
    setPresets((items) => items.filter((item) => item.id !== id));
  }

  function exportResults(kind: "json" | "md") {
    const payload = chatResults;
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

  const runAction = runChat;
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
      {backgroundImageEnabled && (
        <BackgroundPicture
          image={midnightGardenBackground}
          pictureClassName="model-yard-background pointer-events-none fixed inset-0 z-0 overflow-hidden"
          className="h-full w-full object-cover object-left"
        />
      )}

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
                  onSelectModel={setSelectedModel}
                />
              ) : (
                <LabNavigation
                  history={history}
                  models={models}
                  selectedModel={selectedModel}
                  selectedRunningModel={selectedRunningModel}
                  onOpenModels={() => setWorkspace("models")}
                  onSelectModel={setSelectedModel}
                  onSelectHistoryPrompt={setPrompt}
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
          onScroll={(event) => {
            const element = event.currentTarget;
            const distanceFromBottom =
              element.scrollHeight - element.scrollTop - element.clientHeight;
            chatShouldStickToBottomRef.current = distanceFromBottom < 80;
          }}
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
                  <ChatThread
                    results={chatResults}
                    busy={busy}
                    streamingIndex={streamingChatIndexRef.current}
                    onRerun={rerunChat}
                    onDelete={deleteChatTurn}
                  />
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
              busy={busy}
              reasoningMode={reasoningMode}
              reasoningModes={reasoningModes}
              favoriteModelNames={favoriteModelNames}
              presets={presets}
              onSelectModel={setSelectedModel}
              onToggleFavoriteModel={toggleFavoriteModel}
              onReasoningModeChange={setReasoningMode}
              onSavePreset={savePreset}
              onDeletePreset={deletePreset}
              onRun={runAction}
              onStop={stopChat}
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
          configOpen={configOpen}
          historyCount={history.length}
          pullName={pullName}
          pullProgress={pullProgress}
          result={chatResults[chatResults.length - 1] ?? null}
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
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="size-7 rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
            title="Check for app updates"
          >
            <Download className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "size-7 rounded-md text-muted-foreground hover:bg-accent hover:text-foreground",
              !ollamaInstalled && "text-amber-400",
            )}
            title={ollamaInstalled ? "Ollama" : "Install Ollama"}
            disabled={ollamaInstalled}
            onClick={installOllama}
          >
            <LlamaIcon className="size-3.5" />
          </Button>
        </div>
        <div className="justify-self-center">
          <div className="relative flex items-center gap-0.5 rounded-full border border-white/[0.04] bg-[#1a1a1a] p-[3px] shadow-[inset_0_3px_6px_rgba(0,0,0,0.8),inset_0_1px_2px_rgba(0,0,0,0.6),0_1px_0_rgba(255,255,255,0.05)]">
            {(["lab", "models", "settings"] as const).map((ws) => {
              const label = ws === "lab" ? "Chat" : ws === "models" ? "Models" : "Settings";
              const dotColor = ws === "lab" ? "bg-cyan-400" : ws === "models" ? "bg-emerald-400" : "bg-violet-400";
              const active = workspace === ws;
              return (
                <button
                  key={ws}
                  className={cn(
                    "relative flex h-6 items-center gap-1.5 rounded-full px-3 text-[10px] font-semibold tracking-wide transition-all duration-200 ease-out",
                    active
                      ? "bg-gradient-to-b from-white/[0.15] to-white/[0.07] text-foreground shadow-[0_2px_6px_rgba(0,0,0,0.5),0_1px_2px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.15)] -translate-y-[0.5px]"
                      : "text-muted-foreground hover:text-foreground shadow-[inset_0_2px_3px_rgba(0,0,0,0.4),inset_0_0_1px_rgba(0,0,0,0.3)] hover:shadow-[inset_0_1px_2px_rgba(0,0,0,0.25)]",
                  )}
                  onClick={() => setWorkspace(ws)}
                >
                  <span
                    className={cn(
                      "size-1.5 rounded-full transition-all duration-200",
                      dotColor,
                      active ? "opacity-100 shadow-[0_0_6px_currentColor]" : "opacity-40",
                    )}
                  />
                  {label}
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
