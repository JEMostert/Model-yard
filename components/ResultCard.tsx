import { msFromNs } from "@/lib/format";
import type { RunResult } from "@/lib/types";

export function ResultCard({ result, compact = false }: { result: RunResult | null; compact?: boolean }) {
  if (!result) return <div className="empty-state">Run a prompt to inspect the response.</div>;

  return (
    <article className={compact ? "response-card compact" : "response-card"}>
      <header>
        <h2>{result.model}</h2>
        <div>
          <span>{msFromNs(result.total_duration)}</span>
          <span>{result.tokens_per_second?.toFixed(2) ?? "n/a"} tok/s</span>
        </div>
      </header>
      {compact && <p>{result.prompt}</p>}
      <pre>{result.response}</pre>
    </article>
  );
}

