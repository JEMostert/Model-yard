import { Activity, BarChart3, History, MessageSquare, PanelRight, Play, SlidersHorizontal } from "lucide-react";
import type { ActiveTab } from "@/lib/types";

type Props = {
  activeTab: ActiveTab;
  busy: string;
  modelNames: string[];
  rightOpen: boolean;
  selectedModel: string;
  onRunBench: () => void;
  onRunChat: () => void;
  onRunCompare: () => void;
  onSelectModel: (model: string) => void;
  onSetTab: (tab: ActiveTab) => void;
  onToggleInspector: () => void;
};

const tabs = [
  ["chat", MessageSquare, "Chat"],
  ["compare", BarChart3, "Compare"],
  ["bench", Activity, "Bench"],
  ["history", History, "History"]
] as const;

export function AppHeader(props: Props) {
  const runAction = props.activeTab === "compare" ? props.onRunCompare : props.activeTab === "bench" ? props.onRunBench : props.onRunChat;
  const canRun = props.activeTab !== "history";

  return (
    <header className="topbar">
      <div className="tabs-compact">
        {tabs.map(([id, Icon, label]) => (
          <button key={id} className={props.activeTab === id ? "active" : ""} onClick={() => props.onSetTab(id)}>
            <Icon size={16} />
            <span>{label}</span>
          </button>
        ))}
      </div>
      <select value={props.selectedModel} onChange={(event) => props.onSelectModel(event.target.value)}>
        <option value="">No model</option>
        {props.modelNames.map((name) => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
      </select>
      <button className="icon-button" onClick={props.onToggleInspector} title="Toggle inspector">
        {props.rightOpen ? <PanelRight size={17} /> : <SlidersHorizontal size={17} />}
      </button>
      {canRun && (
        <button className="run-button" onClick={runAction} disabled={Boolean(props.busy)}>
          <Play size={16} />
          Run
        </button>
      )}
    </header>
  );
}

