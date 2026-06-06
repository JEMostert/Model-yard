import { Activity, ChevronRight, Download, Gauge, Server, Settings2, Trash2 } from "lucide-react";
import { formatBytes } from "@/lib/format";
import type { GenerateSettings, LabStatus, OllamaModel, PullProgress, RunningModel } from "@/lib/types";

type Props = {
  busy: string;
  models: OllamaModel[];
  open: boolean;
  pullName: string;
  pullProgress: PullProgress[];
  running: RunningModel[];
  selectedDetails?: OllamaModel;
  settings: GenerateSettings;
  status: LabStatus | null;
  onDeleteModel: (name: string) => void;
  onPullModel: () => void;
  onSetPullName: (name: string) => void;
  onSettingsChange: (settings: GenerateSettings) => void;
  onToggle: () => void;
};

export function Inspector(props: Props) {
  if (!props.open) return <aside className="right-rail"><button className="icon-button" onClick={props.onToggle}><Settings2 size={17} /></button></aside>;

  return (
    <aside className="right-pane">
      <div className="inspector-head">
        <strong>Inspector</strong>
        <button className="icon-button ghost" onClick={props.onToggle} title="Collapse inspector">
          <ChevronRight size={16} />
        </button>
      </div>
      <Panel title="Ollama" icon={<Activity size={15} />}>
        <Fact label="API" value={props.status?.api_ok ? "reachable" : "offline"} tone={props.status?.api_ok ? "good" : "bad"} />
        <Fact label="Service" value={props.status?.service_state ?? "unknown"} tone={props.status?.service_active ? "good" : "bad"} />
        <Fact label="GPU" value={props.status?.gpu_hint ?? "unknown"} />
      </Panel>
      <Panel title="Pull Model" icon={<Download size={15} />}>
        <div className="pull-control">
          <input value={props.pullName} onChange={(event) => props.onSetPullName(event.target.value)} />
          <button onClick={props.onPullModel} disabled={props.busy === "pull"}>Pull</button>
        </div>
        <div className="mini-log">{props.pullProgress.slice(-4).map((item, index) => <span key={index}>{item.status}</span>)}</div>
      </Panel>
      <Panel title="Parameters" icon={<Settings2 size={15} />}>
        <Setting label="Temperature" value={props.settings.temperature} min={0} max={2} step={0.1} onChange={(temperature) => props.onSettingsChange({ ...props.settings, temperature })} />
        <Setting label="Top P" value={props.settings.top_p} min={0} max={1} step={0.05} onChange={(top_p) => props.onSettingsChange({ ...props.settings, top_p })} />
        <Setting label="Top K" value={props.settings.top_k} min={1} max={200} step={1} onChange={(top_k) => props.onSettingsChange({ ...props.settings, top_k })} />
        <Setting label="Repeat" value={props.settings.repeat_penalty} min={0.8} max={2} step={0.05} onChange={(repeat_penalty) => props.onSettingsChange({ ...props.settings, repeat_penalty })} />
        <Setting label="Seed" value={props.settings.seed} min={-1} max={999999} step={1} onChange={(seed) => props.onSettingsChange({ ...props.settings, seed })} />
        <Setting label="Context" value={props.settings.num_ctx} min={512} max={32768} step={512} onChange={(num_ctx) => props.onSettingsChange({ ...props.settings, num_ctx })} />
        <Setting label="Max tokens" value={props.settings.num_predict} min={32} max={4096} step={32} onChange={(num_predict) => props.onSettingsChange({ ...props.settings, num_predict })} />
      </Panel>
      <Panel title="Selected" icon={<Gauge size={15} />}>
        <Fact label="Name" value={props.selectedDetails?.name ?? "none"} />
        <Fact label="Size" value={formatBytes(props.selectedDetails?.size)} />
        <Fact label="Family" value={props.selectedDetails?.details?.family ?? "unknown"} />
        <Fact label="Quant" value={props.selectedDetails?.details?.quantization_level ?? "unknown"} />
        {props.selectedDetails && <button className="danger-button" onClick={() => props.onDeleteModel(props.selectedDetails!.name)}><Trash2 size={15} /> Delete</button>}
      </Panel>
      <Panel title="Loaded" icon={<Server size={15} />}>
        {props.running.map((item) => <Fact key={item.name} label={item.name} value={`VRAM ${formatBytes(item.size_vram)}`} />)}
        {!props.running.length && <p className="subtle">No loaded models.</p>}
      </Panel>
    </aside>
  );
}

function Panel({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return <section className="inspector-panel"><h3>{icon}{title}</h3>{children}</section>;
}

function Fact({ label, value, tone }: { label: string; value: string; tone?: "good" | "bad" }) {
  return <div className="fact"><span>{label}</span><strong className={tone ?? ""}>{value}</strong></div>;
}

function Setting({ label, value, min, max, step, onChange }: { label: string; value: number; min: number; max: number; step: number; onChange: (value: number) => void }) {
  return (
    <label className="setting">
      <span>{label}<input type="number" value={value} min={min} max={max} step={step} onChange={(event) => onChange(Number(event.target.value))} /></span>
      <input type="range" value={value} min={min} max={max} step={step} onChange={(event) => onChange(Number(event.target.value))} />
    </label>
  );
}
