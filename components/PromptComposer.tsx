import { Copy, Save } from "lucide-react";

type Props = {
  prompt: string;
  systemPrompt: string;
  onPromptChange: (value: string) => void;
  onSavePreset: () => void;
  onSystemPromptChange: (value: string) => void;
};

export function PromptComposer(props: Props) {
  return (
    <section className="composer">
      <textarea value={props.prompt} onChange={(event) => props.onPromptChange(event.target.value)} spellCheck={false} />
      <div className="composer-footer">
        <input value={props.systemPrompt} onChange={(event) => props.onSystemPromptChange(event.target.value)} placeholder="System prompt" />
        <button onClick={() => navigator.clipboard.writeText(props.prompt)} title="Copy prompt">
          <Copy size={15} />
        </button>
        <button onClick={props.onSavePreset} title="Save preset">
          <Save size={15} />
        </button>
      </div>
    </section>
  );
}

