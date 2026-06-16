import { describe, expect, it } from "vitest";
import {
  calculatePullOverall,
  describeCapability,
  formatCount,
  formatModelLabel,
  formatUpdatedLabel,
  getModelCreator,
  getModelCreatorInitials,
  normalizeSettings,
  parsePullCount,
  quantKey,
} from "./shared";

describe("model-yard shared helpers", () => {
  it("normalizes legacy seed zero to random seed", () => {
    expect(normalizeSettings({ seed: 0 }, true).seed).toBe(-1);
  });

  it("keeps an explicit seed when no migration is requested", () => {
    expect(normalizeSettings({ seed: 42 }, false).seed).toBe(42);
  });

  it("calculates pull progress by latest layer digest", () => {
    expect(
      calculatePullOverall([
        { status: "pulling layer", digest: "a", total: 100, completed: 20 },
        { status: "pulling layer", digest: "a", total: 100, completed: 80 },
        { status: "pulling layer", digest: "b", total: 300, completed: 150 },
      ]),
    ).toEqual({ completed: 230, total: 400, ratio: 0.575 });
  });

  it("returns null when pull progress has no byte totals", () => {
    expect(calculatePullOverall([{ status: "verifying sha256 digest" }])).toBeNull();
  });

  it("formats model labels and counts for compact UI surfaces", () => {
    expect(formatModelLabel("library/minicpm5:latest")).toBe("minicpm5");
    expect(formatCount(131072)).toBe("131,072");
    expect(formatCount()).toBe("unknown");
  });

  it("derives local model creator names and initials", () => {
    expect(getModelCreator("qwen2.5-coder:latest")).toBe("qwen");
    expect(getModelCreatorInitials("qwen2.5-coder:latest")).toBe("QW");
    expect(getModelCreator("library/gemma3:latest")).toBe("gemma");
    expect(getModelCreatorInitials("library/gemma3:latest")).toBe("GE");
    expect(getModelCreatorInitials("deep-seek-r1:8b")).toBe("DS");
  });

  it("parses abbreviated pull counts", () => {
    expect(parsePullCount("2.5M")).toBe(2_500_000);
    expect(parsePullCount("900K")).toBe(900_000);
    expect(parsePullCount()).toBe(0);
  });

  it("maps capabilities and quantization labels", () => {
    expect(describeCapability("vision model")?.label).toBe("vision");
    expect(describeCapability("tool-use")?.label).toBe("tools");
    expect(describeCapability("unknown")).toBeNull();
    expect(quantKey("Q4_K_M")).toBe("Q4 — balanced");
    expect(quantKey("F16")).toBe("F16 — full precision");
  });

  it("compacts relative updated labels", () => {
    expect(formatUpdatedLabel("12 days ago")).toBe("12d ago");
    expect(formatUpdatedLabel("recently")).toBe("recently");
  });
});
