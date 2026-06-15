import type { ReactNode } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { LabStatus } from "@/lib/types";
import { Fact } from "@/src/model-yard/controls";
import {
  settingsSections,
  stylingPresets,
  type SettingsSectionId,
  type StylingPresetId,
} from "@/src/model-yard/shared";

export function SettingsWorkspace({
  activeSection,
  historyCount,
  installBusy,
  modelCount,
  status,
  stylingPreset,
  onInstallOllama,
  onStylingPresetChange,
}: {
  activeSection: SettingsSectionId;
  historyCount: number;
  installBusy: boolean;
  modelCount: number;
  status: LabStatus | null;
  stylingPreset: StylingPresetId;
  onInstallOllama: () => void;
  onStylingPresetChange: (preset: StylingPresetId) => void;
}) {
  const selectedStylingPreset = stylingPresets.find(
    (preset) => preset.id === stylingPreset,
  );

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
            <div className="space-y-1.5">
              <label className="text-[11px] text-muted-foreground">
                Preset
              </label>
              <Select
                value={stylingPreset}
                onValueChange={(value) =>
                  onStylingPresetChange(value as StylingPresetId)
                }
              >
                <SelectTrigger className="h-8 rounded-lg text-xs">
                  <SelectValue placeholder="Select styling preset" />
                </SelectTrigger>
                <SelectContent>
                  {stylingPresets.map((preset) => (
                    <SelectItem key={preset.id} value={preset.id}>
                      {preset.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="rounded-lg border border-border bg-background p-3">
              <span className="block text-[10px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
                Active Style
              </span>
              <strong className="mt-2 block text-xs font-medium text-foreground">
                {selectedStylingPreset?.name ?? "Midnight Garden"}
              </strong>
              <p className="mt-1 text-[11px] leading-4 text-muted-foreground">
                {selectedStylingPreset?.description}
              </p>
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

function SettingsPanel({ children }: { children: ReactNode }) {
  return (
    <Card className="rounded-xl border-border bg-card">
      <CardContent className="p-4">{children}</CardContent>
    </Card>
  );
}
