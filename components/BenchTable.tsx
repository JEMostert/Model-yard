import { msFromNs } from "@/lib/format";
import type { RunResult } from "@/lib/types";

export function BenchTable({ results }: { results: RunResult[] }) {
  if (!results.length) return <div className="empty-state">Benchmark results will appear here.</div>;

  return (
    <div className="bench-table">
      <div className="bench-row head">
        <span>Model</span>
        <span>Prompt</span>
        <span>Time</span>
        <span>Tok/s</span>
      </div>
      {results.map((item, index) => (
        <div className="bench-row" key={`${item.created_at}-${index}`}>
          <span>{item.model}</span>
          <span>{item.prompt}</span>
          <span>{msFromNs(item.total_duration)}</span>
          <span>{item.tokens_per_second?.toFixed(2) ?? "n/a"}</span>
        </div>
      ))}
    </div>
  );
}

