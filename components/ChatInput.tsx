import { ArrowUp, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type ChatInputProps = {
  value: string;
  onChange: (value: string) => void;
  modelNames: string[];
  selectedModel: string;
  activeTab: string;
  busy: string;
  onSelectModel: (value: string) => void;
  onRefresh: () => void;
  onRun: () => void;
};

export function ChatInput({
  value,
  onChange,
  modelNames,
  selectedModel,
  activeTab,
  busy,
  onSelectModel,
  onRefresh,
  onRun,
}: ChatInputProps) {
  const selectedModelLabel = selectedModel
    ? formatModelLabel(selectedModel)
    : "Model";

  return (
    <div className="mx-auto w-full max-w-190 overflow-hidden rounded-2xl border border-border bg-background">
      <Textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Ask anything, @tag files/folders, $use skills, or / for commands"
        className="min-h-14 resize-none rounded-b-none rounded-t-lg border-0 bg-transparent px-3.5 pb-2.5 pt-3 !text-xs !leading-5 text-foreground shadow-none placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-0"
      />
      <div className="flex min-h-10 items-center justify-between gap-2 border-t border-border bg-background px-2 py-1.5">
        <div className="flex items-center gap-1">
          <Select
            value={selectedModel || "none"}
            onValueChange={(nextValue) =>
              onSelectModel(nextValue === "none" ? "" : nextValue)
            }
          >
            <SelectTrigger className="h-7 max-w-[140px] gap-1.5 rounded-md border-0 bg-transparent px-2 text-[9px] font-medium text-muted-foreground hover:bg-accent hover:text-foreground data-[placeholder]:text-muted-foreground">
              <span className="truncate">{selectedModelLabel}</span>
            </SelectTrigger>
            <SelectContent className="text-[9px]">
              <SelectItem value="none" className="py-1 text-[9px]">
                Model
              </SelectItem>
              {modelNames.map((name) => (
                <SelectItem key={name} value={name} className="py-1 text-[9px]">
                  {formatModelLabel(name)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="ghost"
            size="icon"
            className="size-7 rounded-md border-0 bg-transparent text-muted-foreground hover:bg-accent hover:text-foreground"
            onClick={onRefresh}
          >
            <RefreshCw className="size-3.5" />
          </Button>
        </div>
        <Button
          size="icon"
          className="size-8 rounded-full bg-primary text-primary-foreground shadow-md shadow-black/30 hover:bg-primary/90"
          onClick={onRun}
          disabled={Boolean(busy) || activeTab === "history"}
        >
          <ArrowUp className="size-3.5" />
        </Button>
      </div>
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
