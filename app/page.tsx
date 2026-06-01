"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  Bot,
  ChevronRight,
  Circle,
  FileJson,
  FileText,
  FolderOpen,
  MessageSquare,
  PanelRightClose,
  PanelRightOpen,
  Search,
  Settings,
  Trash2,
  User,
} from "lucide-react";
import { DEFAULT_PRESETS, DEFAULT_SETTINGS } from "@/lib/constants";
import { formatBytes, msFromNs } from "@/lib/format";
import { storage } from "@/lib/storage";
import { call, formatError } from "@/lib/tauri";
import { ChatInput } from "@/components/ChatInput";
import type {
  ActiveTab,
  GenerateSettings,
  LabStatus,
  OllamaModel,
  Preset,
  PullProgress,
  RunningModel,
  RunResult,
} from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const tabs: ActiveTab[] = ["chat", "compare", "bench", "history"];

export default function Home() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("chat");
  const [status, setStatus] = useState<LabStatus | null>(null);
  const [models, setModels] = useState<OllamaModel[]>([]);
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

  const modelNames = useMemo(() => models.map((model) => model.name), [models]);
  const selectedDetails = models.find((model) => model.name === selectedModel);
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
    setSettings(storage.get("model-yard-settings", DEFAULT_SETTINGS));
    refreshAll();
  }, []);

  useEffect(
    () => storage.set("model-yard-history", history.slice(0, 100)),
    [history],
  );
  useEffect(() => storage.set("model-yard-presets", presets), [presets]);
  useEffect(() => storage.set("model-yard-settings", settings), [settings]);

  async function refreshAll() {
    setError("");
    try {
      const [nextStatus, nextModels, nextRunning] = await Promise.all([
        call<LabStatus>("ollama_status"),
        call<OllamaModel[]>("list_models"),
        call<RunningModel[]>("running_models"),
      ]);
      setStatus(nextStatus);
      setModels(nextModels);
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
  ): Promise<RunResult> {
    return call<RunResult>("chat_model", {
      request: {
        model,
        prompt: runPrompt,
        system_prompt: systemPrompt,
        options: settings,
      },
    });
  }

  async function runChat() {
    if (!selectedModel) return;
    setBusy("chat");
    setError("");
    try {
      const next = await runModel(selectedModel);
      setResult(next);
      setHistory((items) => [next, ...items].slice(0, 100));
      refreshAll();
    } catch (err) {
      setError(formatError(err));
    } finally {
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

  const runAction =
    activeTab === "compare"
      ? runCompare
      : activeTab === "bench"
        ? runBench
        : runChat;

  return (
    <main
      className={cn(
        "grid h-screen grid-rows-[minmax(0,1fr)_auto] gap-3 overflow-hidden bg-background p-3 text-foreground transition-[grid-template-columns] duration-300 ease-out max-[760px]:flex max-[760px]:h-auto max-[760px]:min-h-screen max-[760px]:flex-col max-[760px]:gap-2 max-[760px]:overflow-visible max-[760px]:p-2",
        configOpen
          ? "grid-cols-[260px_minmax(520px,1fr)_280px] max-[1080px]:grid-cols-[240px_minmax(420px,1fr)]"
          : "grid-cols-[260px_minmax(520px,1fr)_0px] max-[1080px]:grid-cols-[240px_minmax(420px,1fr)]",
      )}
    >
      <aside className="row-start-1 min-h-0 min-w-0 max-[760px]:hidden">
        <Card className="flex h-full min-w-0 flex-col overflow-hidden rounded-xl">
          <div className="flex h-[52px] shrink-0 items-center border-b border-border bg-card px-5 text-[13px] font-semibold leading-none text-foreground">
            <span>model-yard</span>
          </div>
          <ScrollArea className="min-h-0 flex-1" type="auto">
            <CardContent className="flex flex-col gap-4 p-3">
              <div className="flex h-8 items-center gap-2 rounded-lg border border-border bg-background px-2.5 text-[11px] text-muted-foreground">
                <Search className="size-3.5" />
                <span>Search (Ctrl+K)</span>
              </div>

              <NavSection title="Models">
                {models.map((model) => (
                  <button
                    key={model.name}
                    className={cn(
                      "grid min-h-7 w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-md px-2 py-1 text-left text-[11px] hover:bg-accent",
                      selectedModel === model.name && "bg-accent",
                    )}
                    onClick={() => setSelectedModel(model.name)}
                  >
                    <span className="truncate text-[11px] leading-4">
                      {model.name}
                    </span>
                    <small className="text-[11px] leading-4 text-muted-foreground">
                      {model.details?.parameter_size ?? formatBytes(model.size)}
                    </small>
                  </button>
                ))}
                {!models.length && (
                  <p className="px-1 py-2 text-[11px] text-muted-foreground">
                    No models found.
                  </p>
                )}
                <div className="grid min-h-7 w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-md px-2 py-1 text-left text-[11px] text-muted-foreground">
                  <span className="truncate text-[11px] leading-4">
                    Pull model
                  </span>
                  <ChevronRight className="size-3.5" />
                </div>
              </NavSection>
              <NavSection title="History">
                {history.slice(0, 5).map((item, index) => (
                  <button
                    key={`${item.created_at}-${index}`}
                    className="grid min-h-7 w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-md px-2 py-1 text-left text-[11px] hover:bg-accent"
                    onClick={() => setActiveTab("history")}
                  >
                    <span className="truncate text-[11px] leading-4">
                      {item.prompt || item.model}
                    </span>
                    <ChevronRight className="size-3.5" />
                  </button>
                ))}
                {!history.length && (
                  <p className="px-1 py-2 text-[11px] text-muted-foreground">
                    No recent chats.
                  </p>
                )}
              </NavSection>
            </CardContent>
          </ScrollArea>
        </Card>
      </aside>

      <section className="row-start-1 flex min-h-0 min-w-0 flex-col overflow-hidden max-[760px]:min-h-screen">
        {error && (
          <div className="mx-4 mt-2.5 rounded-lg border border-destructive/45 bg-destructive/15 px-2.5 py-2 text-[13px] text-destructive">
            {error}
          </div>
        )}

        <ScrollArea className="min-h-0 flex-1" type="auto">
          <div className="mx-auto w-full max-w-[760px] px-[22px] pb-8 pt-[22px]">
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
              <ChatThread results={visibleResults} activeTab={activeTab} />
            )}
          </div>
        </ScrollArea>

        <footer className="shrink-0 border-border">
          <ChatInput
            value={prompt}
            onChange={setPrompt}
            modelNames={modelNames}
            selectedModel={selectedModel}
            activeTab={activeTab}
            busy={busy}
            onSelectModel={setSelectedModel}
            onRefresh={refreshAll}
            onRun={runAction}
          />
          <div className="mx-auto flex w-full max-w-[760px] items-center justify-between gap-3 py-1 text-[10px] text-muted-foreground">
            <div className="flex items-center gap-1 text-[10px]">
              <FolderOpen className="size-2.5" />
              <span>Local checkout</span>
            </div>
            <span>main</span>
          </div>
        </footer>
      </section>

      <aside className="row-start-1 min-h-0 min-w-0 overflow-visible max-[1080px]:hidden">
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
          <ScrollArea className="min-h-0 flex-1">
            <CardContent className="space-y-5 p-4">
              <InspectorSection title="System Prompt">
                <Textarea
                  value={systemPrompt}
                  onChange={(event) => setSystemPrompt(event.target.value)}
                  placeholder="You are a helpful assistant..."
                  className="min-h-[100px] resize-none rounded-lg border border-border bg-background p-3 !text-xs !leading-5"
                />
              </InspectorSection>

              <InspectorSection title="Parameters">
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
                  label="Max Tokens"
                  value={settings.num_predict}
                  min={32}
                  max={4096}
                  step={32}
                  onChange={(num_predict) =>
                    setSettings({ ...settings, num_predict })
                  }
                />
              </InspectorSection>

              <InspectorSection title="Model Info">
                <Fact label="Name" value={selectedDetails?.name ?? "none"} />
                <Fact label="Size" value={formatBytes(selectedDetails?.size)} />
                <Fact
                  label="Quant"
                  value={
                    selectedDetails?.details?.quantization_level ?? "unknown"
                  }
                />
                {selectedDetails && (
                  <Button
                    variant="destructive"
                    size="sm"
                    className="w-full rounded-lg"
                    onClick={() => deleteModel(selectedDetails.name)}
                    disabled={busy === `delete-${selectedDetails.name}`}
                  >
                    <Trash2 className="size-4" /> Delete
                  </Button>
                )}
              </InspectorSection>

              <InspectorSection title="Pull Model">
                <div className="flex gap-2">
                  <Input
                    value={pullName}
                    onChange={(event) => setPullName(event.target.value)}
                    className="h-9 rounded-lg"
                  />
                  <Button
                    className="h-9 rounded-lg"
                    onClick={pullModel}
                    disabled={busy === "pull"}
                  >
                    Pull
                  </Button>
                </div>
                {pullProgress.slice(-3).map((item, index) => (
                  <p key={index} className="text-xs text-muted-foreground">
                    {item.status}
                  </p>
                ))}
              </InspectorSection>

              <InspectorSection title={`Loaded (${running.length})`}>
                {running.map((item) => (
                  <Fact
                    key={item.name}
                    label={item.name}
                    value={formatBytes(item.size_vram)}
                  />
                ))}
                {!running.length && (
                  <p className="text-xs text-muted-foreground">
                    No loaded models.
                  </p>
                )}
              </InspectorSection>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 rounded-lg"
                  onClick={() => exportResults("md")}
                >
                  <FileText className="size-4" /> MD
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 rounded-lg"
                  onClick={() => exportResults("json")}
                >
                  <FileJson className="size-4" /> JSON
                </Button>
              </div>
            </CardContent>
          </ScrollArea>
        </Card>
      </aside>

      <Card className="col-span-full row-start-2 grid h-10 grid-cols-[1fr_auto_1fr] items-center rounded-xl px-3 text-[11px] text-muted-foreground">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-fit gap-1.5 rounded-md px-2 text-[11px] text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <Settings className="size-3.5" />
          <span>Settings</span>
        </Button>
        <div className="flex items-center gap-1 justify-self-center">
          {tabs.map((tab) => (
            <button
              key={tab}
              className={cn(
                "flex h-7 items-center rounded-md px-3.5 text-xs font-medium capitalize text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
                activeTab === tab &&
                  "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground",
              )}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1 justify-self-end">
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "size-7 rounded-md text-muted-foreground hover:bg-accent hover:text-foreground",
              configOpen && "bg-accent text-foreground",
            )}
            onClick={() => setConfigOpen((open) => !open)}
            title={configOpen ? "Hide configuration" : "Show configuration"}
          >
            {configOpen ? (
              <PanelRightClose className="size-3.5" />
            ) : (
              <PanelRightOpen className="size-3.5" />
            )}
          </Button>
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

function ChatThread({
  results,
  activeTab,
}: {
  results: RunResult[];
  activeTab: ActiveTab;
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
            time={`${formatTime(item.created_at)} · ${item.tokens_per_second?.toFixed(1) ?? "n/a"} tok/s · ${msFromNs(item.total_duration)}`}
            body={item.response}
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
}: {
  role: "user" | "model";
  title: string;
  time: string;
  body: string;
}) {
  const Icon = role === "user" ? User : Bot;
  return (
    <div className="grid grid-cols-[24px_minmax(0,1fr)] gap-2.5">
      <div className="grid size-6 place-items-center rounded-md border border-border bg-background text-muted-foreground">
        <Icon className="size-3.5" />
      </div>
      <div>
        <div className="mb-1 flex items-center gap-2 text-[11px]">
          <strong>{title}</strong>
          <span className="text-muted-foreground">{time}</span>
        </div>
        <Card
          className={cn(
            "rounded-[10px] border-border bg-background",
            role === "user" && "max-w-[520px]",
          )}
        >
          <CardContent className="p-2.5">
            <pre className="whitespace-pre-wrap text-xs leading-5">{body}</pre>
          </CardContent>
        </Card>
      </div>
    </div>
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

function InspectorSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h2 className="border-b border-border pb-2 text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
        {title}
      </h2>
      <div className="space-y-2">{children}</div>
    </section>
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
    <div className="space-y-1">
      <div className="grid grid-cols-[1fr_72px] items-center gap-2 text-xs">
        <span className="text-muted-foreground">{label}</span>
        <Input
          className="h-7 rounded-sm text-right"
          type="number"
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={(event) => onChange(Number(event.target.value))}
        />
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

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}
