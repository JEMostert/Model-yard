import { Bot, ChevronLeft, ChevronRight, Folder, RefreshCw, Search, Star } from "lucide-react";
import { formatBytes } from "@/lib/format";
import type { OllamaModel, Preset } from "@/lib/types";

type Props = {
  open: boolean;
  models: OllamaModel[];
  presets: Preset[];
  selectedModel: string;
  onToggle: () => void;
  onRefresh: () => void;
  onSelectModel: (model: string) => void;
  onSelectPreset: (preset: Preset) => void;
};

export function LeftSidebar(props: Props) {
  return (
    <aside className="left-pane">
      <div className="app-mark">
        <Bot size={20} />
        <strong>Ollama Lab</strong>
        <span>V1</span>
        <button className="icon-button ghost" onClick={props.onToggle} title="Toggle sidebar">
          {props.open ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
        </button>
      </div>

      {props.open && (
        <>
          <div className="search-box">
            <Search size={15} />
            <span>Search models and presets</span>
            <kbd>Ctrl K</kbd>
          </div>
          <div className="nav-section">
            <div className="nav-title">
              <Folder size={15} />
              Models
              <button className="icon-button ghost" onClick={props.onRefresh} title="Refresh models">
                <RefreshCw size={14} />
              </button>
            </div>
            {props.models.map((model) => (
              <button key={model.name} className={props.selectedModel === model.name ? "nav-row active" : "nav-row"} onClick={() => props.onSelectModel(model.name)}>
                <span>{model.name}</span>
                <small>{model.details?.parameter_size ?? formatBytes(model.size)}</small>
              </button>
            ))}
            {!props.models.length && <p className="subtle">No models found.</p>}
          </div>
          <div className="nav-section">
            <div className="nav-title">
              <Star size={15} />
              Presets
            </div>
            {props.presets.map((preset) => (
              <button key={preset.id} className="nav-row compact" onClick={() => props.onSelectPreset(preset)}>
                <span>{preset.name}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </aside>
  );
}

