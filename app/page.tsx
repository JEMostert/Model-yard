"use client";

import { useEffect, useMemo, useState } from "react";
import { DEFAULT_PRESETS, DEFAULT_SETTINGS } from "@/lib/constants";
import { call } from "@/lib/tauri";
import { storage } from "@/lib/storage";
import type { ActiveTab, GenerateSettings, LabStatus, OllamaModel, Preset, PullProgress, RunningModel, RunResult } from "@/lib/types";
import { AppHeader } from "@/components/AppHeader";
import { LeftSidebar } from "@/components/LeftSidebar";
import { Inspector } from "@/components/Inspector";
import { PromptComposer } from "@/components/PromptComposer";
import { ResultCard } from "@/components/ResultCard";
import { BenchTable } from "@/components/BenchTable";

export default function Home() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("chat");
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const [status, setStatus] = useState<LabStatus | null>(null);
  const [models, setModels] = useState<OllamaModel[]>([]);
  const [running, setRunning] = useState<RunningModel[]>([]);
  const [selectedModel, setSelectedModel] = useState("");
  const [compareModels, setCompareModels] = useState<string[]>([]);
  const [prompt, setPrompt] = useState("Explain why local-first model testing is useful in one concise paragraph.");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [settings, setSettings] = useState<GenerateSettings>(DEFAULT_SETTINGS);
  const [result, setResult] = useState<RunResult | null>(null);
  const [compareResults, setCompareResults] = useState<RunResult[]>([]);
  const [history, setHistory] = useState<RunResult[]>([]);
  const [presets, setPresets] = useState<Preset[]>(DEFAULT_PRESETS);
  const [pullName, setPullName] = useState("openbmb/minicpm5");
  const [pullProgress, setPullProgress] = useState<PullProgress[]>([]);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const modelNames = useMemo(() => models.map((model) => model.name), [models]);
  const selectedDetails = models.find((model) => model.name === selectedModel);

  useEffect(() => {
    setHistory(storage.get("ollama-lab-history", []));
    setPresets(storage.get("ollama-lab-presets", DEFAULT_PRESETS));
    setSettings(storage.get("ollama-lab-settings", DEFAULT_SETTINGS));
    refreshAll();
  }, []);

  useEffect(() => storage.set("ollama-lab-history", history.slice(0, 100)), [history]);
  useEffect(() => storage.set("ollama-lab-presets", presets), [presets]);
  useEffect(() => storage.set("ollama-lab-settings", settings), [settings]);

  async function refreshAll() {
    setError("");
    try {
      const [nextStatus, nextModels, nextRunning] = await Promise.all([
        call<LabStatus>("ollama_status"),
        call<OllamaModel[]>("list_models"),
        call<RunningModel[]>("running_models")
      ]);
      setStatus(nextStatus);
      setModels(nextModels);
      setRunning(nextRunning);
      if (!selectedModel && nextModels[0]) setSelectedModel(nextModels[0].name);
      if (!compareModels.length && nextModels.length) setCompareModels(nextModels.slice(0, 2).map((model) => model.name));
    } catch (err) {
      setError(String(err));
    }
  }

  async function runModel(model: string, runPrompt = prompt): Promise<RunResult> {
    return call<RunResult>("chat_model", {
      request: { model, prompt: runPrompt, system_prompt: systemPrompt, options: settings }
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
      setError(String(err));
    } finally {
      setBusy("");
    }
  }

  async function runCompare(modelsToRun = compareModels, runPrompt = prompt) {
    if (!modelsToRun.length) return;
    setBusy("compare");
    setError("");
    setCompareResults([]);
    try {
      const results = await Promise.all(modelsToRun.map((model) => runModel(model, runPrompt)));
      setCompareResults(results);
      setHistory((items) => [...results, ...items].slice(0, 100));
      refreshAll();
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy("");
    }
  }

  async function runBench() {
    const suite = [
      "Return a JSON object with keys summary and risk for running local LLMs.",
      "Explain the difference between temperature and top_p in two paragraphs.",
      "Write a bash command to list the ten largest files under the current directory."
    ];
    const targets = compareModels.length ? compareModels : selectedModel ? [selectedModel] : [];
    setBusy("bench");
    setError("");
    try {
      const results: RunResult[] = [];
      for (const benchPrompt of suite) {
        results.push(...(await Promise.all(targets.map((model) => runModel(model, benchPrompt)))));
      }
      setCompareResults(results);
      setHistory((items) => [...results, ...items].slice(0, 100));
    } catch (err) {
      setError(String(err));
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
      const progress = await call<PullProgress[]>("pull_model", { name: pullName.trim() });
      setPullProgress(progress);
      await refreshAll();
    } catch (err) {
      setError(String(err));
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
      setError(String(err));
    } finally {
      setBusy("");
    }
  }

  function savePreset() {
    const name = prompt.slice(0, 42).trim() || "Untitled prompt";
    setPresets((items) => [{ id: crypto.randomUUID(), name, prompt }, ...items].slice(0, 30));
  }

  function exportResults(kind: "json" | "md") {
    const payload = activeTab === "chat" && result ? [result] : compareResults;
    if (!payload.length) return;
    const data =
      kind === "json"
        ? JSON.stringify(payload, null, 2)
        : payload.map((item) => `## ${item.model}\n\n${item.response}`).join("\n\n");
    const blob = new Blob([data], { type: kind === "json" ? "application/json" : "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ollama-lab-${new Date().toISOString().slice(0, 19)}.${kind}`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className={`app-shell ${leftOpen ? "" : "left-collapsed"} ${rightOpen ? "" : "right-collapsed"}`}>
      <LeftSidebar
        open={leftOpen}
        models={models}
        presets={presets}
        selectedModel={selectedModel}
        onToggle={() => setLeftOpen(!leftOpen)}
        onRefresh={refreshAll}
        onSelectModel={setSelectedModel}
        onSelectPreset={(preset) => setPrompt(preset.prompt)}
      />

      <section className="center-pane">
        <AppHeader
          activeTab={activeTab}
          busy={busy}
          modelNames={modelNames}
          rightOpen={rightOpen}
          selectedModel={selectedModel}
          onRunBench={runBench}
          onRunChat={runChat}
          onRunCompare={() => runCompare()}
          onSelectModel={setSelectedModel}
          onSetTab={setActiveTab}
          onToggleInspector={() => setRightOpen(!rightOpen)}
        />

        {error && <div className="error-line">{error}</div>}

        <div className="work-scroll">
          {activeTab === "history" ? (
            <section className="history-stream">
              <div className="section-bar">
                <span>History</span>
                <button onClick={() => setHistory([])}>Clear</button>
              </div>
              {history.map((item, index) => (
                <ResultCard key={`${item.created_at}-${index}`} result={item} compact />
              ))}
              {!history.length && <div className="empty-state">No saved runs yet.</div>}
            </section>
          ) : (
            <>
              <PromptComposer
                prompt={prompt}
                systemPrompt={systemPrompt}
                onPromptChange={setPrompt}
                onSavePreset={savePreset}
                onSystemPromptChange={setSystemPrompt}
              />

              {activeTab === "chat" && <ResultCard result={result} />}

              {activeTab === "compare" && (
                <section className="compare-layout">
                  <div className="model-chips">
                    {models.map((model) => (
                      <label key={model.name} className={compareModels.includes(model.name) ? "chip active" : "chip"}>
                        <input
                          type="checkbox"
                          checked={compareModels.includes(model.name)}
                          onChange={(event) =>
                            setCompareModels((items) =>
                              event.target.checked ? [...items, model.name] : items.filter((item) => item !== model.name)
                            )
                          }
                        />
                        {model.name}
                      </label>
                    ))}
                  </div>
                  <div className="compare-grid">
                    {compareResults.map((item, index) => (
                      <ResultCard key={`${item.model}-${index}`} result={item} />
                    ))}
                  </div>
                </section>
              )}

              {activeTab === "bench" && <BenchTable results={compareResults} />}
            </>
          )}
        </div>

        <footer className="bottom-actions">
          <button onClick={() => exportResults("md")}>Export MD</button>
          <button onClick={() => exportResults("json")}>Export JSON</button>
          <div className="status-pill">{status?.api_ok ? "Ollama online" : "Ollama offline"}</div>
        </footer>
      </section>

      <Inspector
        busy={busy}
        models={models}
        open={rightOpen}
        pullName={pullName}
        pullProgress={pullProgress}
        running={running}
        selectedDetails={selectedDetails}
        settings={settings}
        status={status}
        onDeleteModel={deleteModel}
        onPullModel={pullModel}
        onSetPullName={setPullName}
        onSettingsChange={setSettings}
        onToggle={() => setRightOpen(!rightOpen)}
      />
    </main>
  );
}
