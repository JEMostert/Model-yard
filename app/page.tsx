"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Activity,
  Bot,
  BrainCircuit,
  ChevronRight,
  Circle,
  Cpu,
  Download,
  FileJson,
  FileText,
  MessageSquare,
  PanelRightClose,
  PanelRightOpen,
  Search,
  Settings,
  ShieldCheck,
  Trash2,
  User,
} from "lucide-react";
import { DEFAULT_PRESETS, DEFAULT_SETTINGS } from "@/lib/constants";
import { formatBytes, msFromNs } from "@/lib/format";
import { storage } from "@/lib/storage";
import { call, formatError, isTauriRuntime } from "@/lib/tauri";
import { ChatInput } from "@/components/ChatInput";
import type {
  ActiveTab,
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
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const tabs: ActiveTab[] = ["chat", "compare", "bench", "history"];
const SETTINGS_SEED_MIGRATION_KEY = "model-yard-seed-negative-one-migrated";
type WorkspaceMode = "lab" | "settings" | "models";
type SettingsSectionId = "styling" | "application" | "ollama" | "data";
type ChatTokenPayload = {
  run_id: string;
  content: string;
};
type ChatThinkingPayload = {
  run_id: string;
  content: string;
};

function normalizeSettings(
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

const tabStyles: Record<ActiveTab, { active: string; glow: string }> = {
  chat: {
    active: "bg-cyan-400 text-slate-950 shadow-cyan-950/40",
    glow: "shadow-[inset_0_1px_0_rgba(255,255,255,0.55),0_1px_0_rgba(255,255,255,0.18),0_7px_14px_rgba(34,211,238,0.24)]",
  },
  compare: {
    active: "bg-emerald-400 text-slate-950 shadow-emerald-950/40",
    glow: "shadow-[inset_0_1px_0_rgba(255,255,255,0.5),0_1px_0_rgba(255,255,255,0.16),0_7px_14px_rgba(52,211,153,0.22)]",
  },
  bench: {
    active: "bg-amber-400 text-slate-950 shadow-amber-950/40",
    glow: "shadow-[inset_0_1px_0_rgba(255,255,255,0.5),0_1px_0_rgba(255,255,255,0.16),0_7px_14px_rgba(251,191,36,0.22)]",
  },
  history: {
    active: "bg-violet-400 text-slate-950 shadow-violet-950/40",
    glow: "shadow-[inset_0_1px_0_rgba(255,255,255,0.5),0_1px_0_rgba(255,255,255,0.16),0_7px_14px_rgba(167,139,250,0.22)]",
  },
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
  const [pullName, setPullName] = useState("llama3.2:latest");
  const [pullProgress, setPullProgress] = useState<PullProgress[]>([]);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [statusOpen, setStatusOpen] = useState(false);
  const [configOpen, setConfigOpen] = useState(true);
  const [thinkingEnabled, setThinkingEnabled] = useState(false);
  const streamingRunIdRef = useRef<string | null>(null);
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
    const unlistenToken = listen<ChatTokenPayload>("chat-token", (event) => {
      if (event.payload.run_id !== streamingRunIdRef.current) return;
      setResult((current) =>
        current
          ? {
              ...current,
              response: current.response + event.payload.content,
            }
          : current,
      );
    });
    const unlistenThinking = listen<ChatThinkingPayload>("chat-thinking", (event) => {
      if (event.payload.run_id !== streamingRunIdRef.current) return;
      setResult((current) =>
        current
          ? {
              ...current,
              thinking: (current.thinking ?? "") + event.payload.content,
            }
          : current,
      );
    });

    return () => {
      unlistenToken.then((unlisten) => unlisten());
      unlistenThinking.then((unlisten) => unlisten());
    };
  }, []);

  useEffect(
    () => storage.set("model-yard-history", history.slice(0, 100)),
    [history],
  );
  useEffect(() => storage.set("model-yard-presets", presets), [presets]);
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
    setBusy("pull");
    setPullProgress([]);
    setError("");
    try {
      const progress = await call<PullProgress[]>("pull_model", {
        name: pullName.trim(),
      });
      setPullProgress(progress);
      await refreshAll();
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

  return (
    <main
      className={cn(
        "grid h-screen grid-rows-[minmax(0,1fr)_auto] gap-3 overflow-hidden bg-background p-3 text-foreground transition-[grid-template-columns] duration-300 ease-out max-[760px]:flex max-[760px]:h-auto max-[760px]:min-h-screen max-[760px]:flex-col max-[760px]:gap-2 max-[760px]:overflow-visible max-[760px]:p-2",
        rightPanelVisible
          ? "grid-cols-[260px_minmax(520px,1fr)_280px] max-[1080px]:grid-cols-[240px_minmax(420px,1fr)]"
          : "grid-cols-[260px_minmax(520px,1fr)_0px] max-[1080px]:grid-cols-[240px_minmax(420px,1fr)]",
      )}
    >
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
                  selectedModel={selectedModel}
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
            {workspace === "settings" ? (
              <SettingsWorkspace
                activeSection={activeSettingsSection}
                historyCount={history.length}
                modelCount={models.length}
                installBusy={busy === "install-ollama"}
                status={status}
                onInstallOllama={installOllama}
              />
            ) : workspace === "models" ? (
              <ModelBrowserWorkspace
                models={models}
                selectedModel={selectedModel}
                running={running}
                onRefresh={refreshAll}
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
          </div>
        </div>

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
              onSelectModel={setSelectedModel}
              onThinkingChange={setThinkingEnabled}
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
      <aside className="row-span-2 row-start-1 min-h-0 min-w-0 overflow-visible max-[1080px]:hidden">
        <Card
          className={cn(
            "flex h-full w-[280px] min-w-0 flex-col overflow-hidden rounded-xl transition-transform duration-300 ease-out",
            configOpen
              ? "translate-x-0"
              : "pointer-events-none translate-x-[calc(100%+12px)]",
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
                  onChange={(event) => setSystemPrompt(event.target.value)}
                  placeholder="You are a helpful assistant..."
                  className="min-h-[88px] resize-none rounded-lg border border-border bg-background p-2.5 !text-xs !leading-5"
                />
              </ConfigSection>

              <ConfigSection title="Sampling" defaultOpen>
                <div className="space-y-3">
                  <Setting
                    label="Temperature"
                    value={settings.temperature}
                    min={0}
                    max={2}
                    step={0.1}
                    onChange={(temperature) =>
                      setSettings({ ...settings, temperature })
                    }
                  />
                  <Setting
                    label="Max Tokens"
                    value={settings.num_predict}
                    min={32}
                    max={4096}
                    step={32}
                    onChange={(num_predict) =>
                      setSettings({ ...settings, num_predict })
                    }
                  />
                  <Setting
                    label="Context"
                    value={settings.num_ctx}
                    min={512}
                    max={selectedMetadata?.context_length ?? 131072}
                    step={512}
                    onChange={(num_ctx) =>
                      setSettings({ ...settings, num_ctx })
                    }
                  />
                </div>
              </ConfigSection>

              <ConfigSection title="Advanced Sampling">
                <div className="space-y-3">
                  <Setting
                    label="Top P"
                    value={settings.top_p}
                    min={0}
                    max={1}
                    step={0.05}
                    onChange={(top_p) => setSettings({ ...settings, top_p })}
                  />
                  <Setting
                    label="Top K"
                    value={settings.top_k}
                    min={1}
                    max={200}
                    step={1}
                    onChange={(top_k) => setSettings({ ...settings, top_k })}
                  />
                  <Setting
                    label="Repeat Pen."
                    value={settings.repeat_penalty}
                    min={0.8}
                    max={2}
                    step={0.05}
                    onChange={(repeat_penalty) =>
                      setSettings({ ...settings, repeat_penalty })
                    }
                  />
                  <Setting
                    label="Seed"
                    value={settings.seed}
                    min={-1}
                    max={999999}
                    step={1}
                    onChange={(seed) => setSettings({ ...settings, seed })}
                  />
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
                  <Fact
                    label="Thinking"
                    value={selectedMetadata?.supports_thinking ? "supported" : "not exposed"}
                    tone={selectedMetadata?.supports_thinking ? "good" : undefined}
                  />
                </div>
                <div className="mt-3 space-y-1.5">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
                    Loaded ({running.length})
                  </p>
                  {running.map((item) => (
                    <Fact
                      key={item.name}
                      label={formatModelLabel(item.name)}
                      value={formatBytes(item.size_vram)}
                    />
                  ))}
                  {!running.length && (
                    <p className="text-xs text-muted-foreground">
                      No loaded models.
                    </p>
                  )}
                </div>
              </ConfigSection>

              <ConfigSection title="Library">
                <div className="space-y-2">
                  <Input
                    value={pullName}
                    onChange={(event) => setPullName(event.target.value)}
                    className="h-8 rounded-lg text-xs"
                    placeholder="namespace/model:tag"
                  />
                  <Button
                    className="h-8 w-full rounded-lg text-xs"
                    onClick={pullModel}
                    disabled={busy === "pull"}
                  >
                    <Download className="size-3.5" />
                    Pull Model
                  </Button>
                  {pullProgress.slice(-3).map((item, index) => (
                    <p key={index} className="text-[10px] text-muted-foreground">
                      {item.status}
                    </p>
                  ))}
                </div>
                <div className="mt-3">
                  <Button
                    variant="destructive"
                    size="sm"
                    className="h-8 w-full rounded-lg text-xs"
                    onClick={() => selectedDetails && deleteModel(selectedDetails.name)}
                    disabled={!selectedDetails || busy === `delete-${selectedDetails.name}`}
                  >
                    <Trash2 className="size-3.5" />
                    Delete Selected Model
                  </Button>
                </div>
              </ConfigSection>

              <ConfigSection title="Export">
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 rounded-lg text-xs"
                    onClick={() => exportResults("md")}
                  >
                    <FileText className="size-3.5" />
                    Markdown
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 rounded-lg text-xs"
                    onClick={() => exportResults("json")}
                  >
                    <FileJson className="size-3.5" />
                    JSON
                  </Button>
                </div>
                <div className="mt-3 space-y-1.5">
                  <Fact label="History" value={`${history.length} runs`} />
                  <Fact label="Compare" value={`${compareResults.length} results`} />
                  <Fact label="Current" value={result ? "available" : "empty"} />
                </div>
              </ConfigSection>
            </CardContent>
          </div>
        </Card>
      </aside>
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

function NavSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
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

function OllamaInstallNotice({
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

function LabNavigation({
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

const settingsSections: Array<{
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

function SettingsNavigation({
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

function ModelBrowserNavigation({
  models,
  selectedModel,
  onSelectModel,
}: {
  models: OllamaModel[];
  selectedModel: string;
  onSelectModel: (model: string) => void;
}) {
  return (
    <>
      <div className="flex h-8 items-center gap-2 rounded-lg border border-border bg-background px-2.5 text-[11px] text-muted-foreground">
        <Search className="size-3.5" />
        <span>Model browser</span>
      </div>
      <NavSection title="Local Models">
        {models.map((model) => (
          <NavRow
            key={model.name}
            active={selectedModel === model.name}
            onClick={() => onSelectModel(model.name)}
          >
            <span className="truncate text-[11px] leading-4">{model.name}</span>
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
      </NavSection>
    </>
  );
}

function SettingsWorkspace({
  activeSection,
  historyCount,
  installBusy,
  modelCount,
  status,
  onInstallOllama,
}: {
  activeSection: SettingsSectionId;
  historyCount: number;
  installBusy: boolean;
  modelCount: number;
  status: LabStatus | null;
  onInstallOllama: () => void;
}) {
  return (
    <div className="space-y-5">
      <div className="border-b border-border pb-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
          Settings
        </p>
        <h1 className="mt-1 text-lg font-semibold text-foreground">
          {settingsSections.find((section) => section.id === activeSection)?.title}
        </h1>
      </div>

      {activeSection === "styling" && (
        <SettingsPanel>
          <div className="space-y-3">
            <p className="text-xs leading-5 text-muted-foreground">
              Styling preferences will live here. This section is intentionally
              a placeholder for now.
            </p>
            <div className="grid gap-2 md:grid-cols-3">
              <PreviewSwatch label="Theme" value="Planned" />
              <PreviewSwatch label="Accent" value="Planned" />
              <PreviewSwatch label="Density" value="Planned" />
            </div>
          </div>
        </SettingsPanel>
      )}

      {activeSection === "application" && (
        <SettingsPanel>
          <div className="grid gap-2 md:grid-cols-2">
            <Fact label="Workspace" value="shared shell" tone="good" />
            <Fact label="Configuration" value="lab only" />
            <Fact label="Models" value={`${modelCount} local`} />
          </div>
        </SettingsPanel>
      )}

      {activeSection === "ollama" && (
        <SettingsPanel>
          <div className="space-y-4">
            <div className="grid gap-2 md:grid-cols-2">
              <Fact
                label="Installation"
                value={status?.ollama_installed ? "installed" : "not installed"}
                tone={status?.ollama_installed ? "good" : "bad"}
              />
              <Fact
                label="Version"
                value={status?.ollama_version ?? "not available"}
              />
            <Fact
              label="API"
              value={status?.api_ok ? "reachable" : "offline"}
              tone={status?.api_ok ? "good" : "bad"}
            />
            <Fact
              label="Service"
              value={status?.service_state ?? "unknown"}
              tone={status?.service_active ? "good" : "bad"}
            />
            <Fact label="GPU" value={status?.gpu_hint ?? "unknown"} />
            </div>
            {!status?.ollama_installed && (
              <Button
                className="h-8 rounded-lg text-xs"
                onClick={onInstallOllama}
                disabled={installBusy}
              >
                <Download className="size-3.5" />
                {installBusy ? "Opening terminal" : "Install Ollama"}
              </Button>
            )}
          </div>
        </SettingsPanel>
      )}

      {activeSection === "data" && (
        <SettingsPanel>
          <div className="grid gap-2 md:grid-cols-2">
            <Fact label="History" value={`${historyCount} runs`} />
            <Fact label="Application settings" value="stored locally" tone="good" />
            <Fact label="Presets" value="stored locally" tone="good" />
          </div>
        </SettingsPanel>
      )}
    </div>
  );
}

function PreviewSwatch({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-background p-3">
      <span className="block text-[10px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
        {label}
      </span>
      <strong className="mt-2 block text-xs font-medium text-foreground">
        {value}
      </strong>
    </div>
  );
}

function SettingsPanel({ children }: { children: React.ReactNode }) {
  return (
    <Card className="rounded-xl border-border bg-card">
      <CardContent className="p-4">{children}</CardContent>
    </Card>
  );
}

function ModelBrowserWorkspace({
  models,
  selectedModel,
  running,
  onRefresh,
  onSelectModel,
}: {
  models: OllamaModel[];
  selectedModel: string;
  running: RunningModel[];
  onRefresh: () => void;
  onSelectModel: (model: string) => void;
}) {
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 border-b border-border pb-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
            Models
          </p>
          <h1 className="mt-1 text-lg font-semibold text-foreground">
            Browser
          </h1>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-8 rounded-lg text-xs"
          onClick={onRefresh}
        >
          Refresh
        </Button>
      </div>
      <div className="grid gap-2">
        {models.map((model) => {
          const loaded = running.some(
            (item) => item.name === model.name || item.model === model.name,
          );
          return (
            <button
              key={model.name}
              className={cn(
                "grid min-h-14 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-border bg-card px-3 py-2 text-left hover:bg-accent",
                selectedModel === model.name && "border-primary bg-accent",
              )}
              onClick={() => onSelectModel(model.name)}
            >
              <span className="min-w-0">
                <span className="block truncate text-xs font-medium">
                  {model.name}
                </span>
                <span className="mt-1 flex flex-wrap gap-2 text-[10px] text-muted-foreground">
                  <span>{model.details?.parameter_size ?? formatBytes(model.size)}</span>
                  {model.details?.family && <span>{model.details.family}</span>}
                  {model.details?.quantization_level && (
                    <span>{model.details.quantization_level}</span>
                  )}
                </span>
              </span>
              <span className="text-[10px] text-muted-foreground">
                {loaded ? "loaded" : "idle"}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ChatThread({
  results,
  activeTab,
  busy,
}: {
  results: RunResult[];
  activeTab: ActiveTab;
  busy: string;
}) {
  if (!results.length) {
    return (
      <div className="grid min-h-[300px] place-items-center text-center">
        <div>
          <MessageSquare className="mx-auto mb-3 size-7 text-muted-foreground" />
          <p className="text-xs font-medium">Select a model and press Run</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {activeTab === "history"
              ? "Saved chats will appear here."
              : "Responses will appear here."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {results.map((item, index) => (
        <div key={`${item.created_at}-${index}`} className="space-y-2.5">
          <ThreadMessage
            role="user"
            title="You"
            time={formatTime(item.created_at)}
            body={item.prompt}
          />
          <ThreadMessage
            role="model"
            title={item.model}
            time={formatTime(item.created_at)}
            body={item.response}
            thinking={item.thinking}
            stats={`${item.tokens_per_second?.toFixed(1) ?? "n/a"} tok/s · ${msFromNs(item.total_duration)}`}
            streaming={busy === "chat" && activeTab !== "history" && index === 0}
          />
        </div>
      ))}
    </div>
  );
}

function ThreadMessage({
  role,
  title,
  time,
  body,
  thinking,
  stats,
  streaming = false,
}: {
  role: "user" | "model";
  title: string;
  time: string;
  body: string;
  thinking?: string;
  stats?: string;
  streaming?: boolean;
}) {
  const Icon = role === "user" ? User : Bot;
  const isUser = role === "user";
  const isTyping = !isUser && streaming;
  return (
    <div
      className={cn(
        "grid gap-2.5",
        isUser
          ? "grid-cols-[minmax(0,1fr)_24px]"
          : "grid-cols-[24px_minmax(0,1fr)]",
      )}
    >
      {isUser ? null : (
        <div
          className={cn(
            "grid size-6 place-items-center rounded-md border border-border bg-background text-muted-foreground",
            isTyping && "border-primary/60 text-primary shadow-[0_0_18px_rgba(99,102,241,0.25)]",
          )}
        >
          <Icon className="size-3.5" />
        </div>
      )}
      <div className={cn(isUser && "justify-self-end")}>
        <div
          className={cn(
            "mb-1 flex items-center gap-2 text-[11px]",
            isUser && "justify-end",
          )}
        >
          <strong>{title}</strong>
          <span className="text-muted-foreground">{time}</span>
        </div>
        {isUser ? (
          <Card className="max-w-[520px] rounded-[10px] border-border bg-background">
            <CardContent className="p-2.5">
              <pre className="whitespace-pre-wrap text-xs leading-5">{body}</pre>
            </CardContent>
          </Card>
        ) : (
          <div className={cn("max-w-none", isTyping && "relative")}>
            {thinking && <ThinkingBlock content={thinking} streaming={isTyping && !body} />}
            <div className={cn(isTyping && "streaming-content")}>
              <MarkdownMessage>{body}</MarkdownMessage>
            </div>
            {isTyping && (
              <span className="ml-0.5 inline-block h-4 w-[2px] animate-[blink_1s_ease-in-out_infinite] bg-primary align-text-bottom" />
            )}
            {stats && !isTyping && (
              <div className="mt-2 flex items-center gap-2 text-[10px] text-muted-foreground">
                <span>{stats}</span>
              </div>
            )}
          </div>
        )}
      </div>
      {isUser ? (
      <div className="grid size-6 place-items-center rounded-md border border-border bg-background text-muted-foreground">
        <Icon className="size-3.5" />
      </div>
      ) : null}
    </div>
  );
}

function MarkdownMessage({ children }: { children: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        p: ({ children: paragraphChildren }) => (
          <p className="mb-2 last:mb-0 text-xs leading-5">{paragraphChildren}</p>
        ),
        ul: ({ children: listChildren }) => (
          <ul className="mb-2 ml-4 list-disc space-y-1 text-xs leading-5">
            {listChildren}
          </ul>
        ),
        ol: ({ children: listChildren }) => (
          <ol className="mb-2 ml-4 list-decimal space-y-1 text-xs leading-5">
            {listChildren}
          </ol>
        ),
        li: ({ children: itemChildren }) => <li>{itemChildren}</li>,
        code: ({ children: codeChildren }) => (
          <code className="rounded bg-muted px-1 py-0.5 text-[11px] text-foreground">
            {codeChildren}
          </code>
        ),
        pre: ({ children: preChildren }) => (
          <pre className="mb-2 overflow-x-auto rounded-lg border border-border bg-muted p-3 text-[11px] leading-5">
            {preChildren}
          </pre>
        ),
        blockquote: ({ children: quoteChildren }) => (
          <blockquote className="mb-2 border-l-2 border-border pl-3 text-xs leading-5 text-muted-foreground">
            {quoteChildren}
          </blockquote>
        ),
        a: ({ children: linkChildren, href }) => (
          <a
            href={href}
            className="text-primary underline underline-offset-2"
            target="_blank"
            rel="noreferrer"
          >
            {linkChildren}
          </a>
        ),
      }}
    >
      {children}
    </ReactMarkdown>
  );
}

function ThinkingBlock({
  content,
  streaming = false,
}: {
  content: string;
  streaming?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const preview = content.trimStart();

  return (
    <Card className="mb-3 w-full overflow-hidden rounded-lg border-border bg-muted/25">
      <button
        type="button"
        onClick={() => setExpanded((open) => !open)}
        className="flex h-6 w-full items-center gap-1.5 border-b border-border/80 px-2.5 text-[9px] font-semibold uppercase tracking-[0.05em] text-muted-foreground transition-colors hover:bg-muted/50"
      >
        <BrainCircuit className="size-3" />
        <span>Thinking</span>
        {streaming && (
          <span className="ml-0.5 size-1 animate-pulse rounded-full bg-primary" />
        )}
        <ChevronRight
          className={cn(
            "ml-auto size-3 transition-transform duration-200",
            expanded && "rotate-90",
          )}
        />
      </button>
      <div className="relative">
        {!expanded && (
          <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-5 bg-gradient-to-b from-background/70 to-transparent backdrop-blur-[2px]" />
        )}
        <div
          className={cn(
            "overflow-y-auto px-3 py-2 text-[11px] leading-5 text-muted-foreground",
            expanded ? "max-h-[360px]" : "h-12",
          )}
        >
          <pre className="whitespace-pre-wrap font-sans">{preview}</pre>
          {streaming && (
            <span className="ml-0.5 inline-block h-3 w-1 animate-pulse rounded-full bg-muted-foreground/60 align-bottom" />
          )}
        </div>
      </div>
    </Card>
  );
}

function BenchTable({ results }: { results: RunResult[] }) {
  if (!results.length) {
    return (
      <div className="grid min-h-[300px] place-items-center text-center">
        <div>
          <Circle className="mx-auto mb-3 size-7 text-muted-foreground" />
          <p className="text-xs font-medium">
            Benchmark results will appear here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <Card className="rounded-sm">
      <CardContent className="p-0">
        <div className="grid grid-cols-[1fr_2fr_88px_72px] border-b border-border px-3 py-2 text-xs font-semibold text-muted-foreground">
          <span>Model</span>
          <span>Prompt</span>
          <span>Time</span>
          <span>Tok/s</span>
        </div>
        {results.map((item, index) => (
          <div
            key={`${item.created_at}-${index}`}
            className="grid grid-cols-[1fr_2fr_88px_72px] border-b border-border px-3 py-2 text-xs last:border-0"
          >
            <span className="truncate">{item.model}</span>
            <span className="truncate text-muted-foreground">
              {item.prompt}
            </span>
            <span>{msFromNs(item.total_duration)}</span>
            <span>{item.tokens_per_second?.toFixed(2) ?? "n/a"}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function ConfigSection({
  title,
  children,
  defaultOpen = false,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details
      className="group"
      open={defaultOpen || undefined}
    >
      <summary className="flex cursor-pointer list-none items-center justify-between border-b border-border px-2 pb-2 pt-2 text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground select-none">
        {title}
        <ChevronRight className="size-3.5 transition-transform duration-200 group-open:rotate-90" />
      </summary>
      <div className="px-2 pb-2 pt-2">
        {children}
      </div>
    </details>
  );
}

function Fact({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "good" | "bad";
}) {
  return (
    <div className="flex min-h-6 items-center justify-between gap-3 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <strong
        className={cn(
          "truncate text-right font-medium",
          tone === "good" && "text-emerald-700",
          tone === "bad" && "text-destructive",
        )}
      >
        {value}
      </strong>
    </div>
  );
}

function Setting({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] text-muted-foreground">{label}</span>
        <span className="tabular-nums text-[11px] font-medium text-foreground">{value}</span>
      </div>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={([next]) => onChange(next)}
      />
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

function formatCount(value?: number) {
  if (!value) return "unknown";
  return value.toLocaleString();
}

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}
