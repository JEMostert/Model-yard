import { memo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Bot,
  BrainCircuit,
  ChevronRight,
  MessageSquare,
  Circle,
  User,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { msFromNs } from "@/lib/format";
import type { ActiveTab, RunResult } from "@/lib/types";
import { formatTime } from "@/src/model-yard/shared";

export function ChatThread({
  results,
  activeTab,
  busy,
}: {
  results: RunResult[];
  activeTab: ActiveTab;
  busy: string;
}) {
  if (!results.length) {
    return (
      <div className="grid min-h-[300px] place-items-center text-center">
        <div>
          <MessageSquare className="mx-auto mb-3 size-7 text-muted-foreground" />
          <p className="text-xs font-medium">Select a model and press Run</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {activeTab === "history"
              ? "Saved chats will appear here."
              : "Responses will appear here."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {results.map((item, index) => (
        <div key={`${item.created_at}-${index}`} className="space-y-2.5">
          <ThreadMessage
            role="user"
            title="You"
            time={formatTime(item.created_at)}
            body={item.prompt}
          />
          <ThreadMessage
            role="model"
            title={item.model}
            time={formatTime(item.created_at)}
            body={item.response}
            thinking={item.thinking}
            stats={`${item.tokens_per_second?.toFixed(1) ?? "n/a"} tok/s · ${msFromNs(item.total_duration)}`}
            streaming={busy === "chat" && activeTab !== "history" && index === 0}
          />
        </div>
      ))}
    </div>
  );
}

const ThreadMessage = memo(function ThreadMessage({
  role,
  title,
  time,
  body,
  thinking,
  stats,
  streaming = false,
}: {
  role: "user" | "model";
  title: string;
  time: string;
  body: string;
  thinking?: string;
  stats?: string;
  streaming?: boolean;
}) {
  const Icon = role === "user" ? User : Bot;
  const isUser = role === "user";
  const isTyping = !isUser && streaming;
  return (
    <div
      className={cn(
        "grid gap-2.5",
        isUser
          ? "grid-cols-[minmax(0,1fr)_24px]"
          : "grid-cols-[24px_minmax(0,1fr)]",
      )}
    >
      {isUser ? null : (
        <div
          className={cn(
            "grid size-6 place-items-center rounded-md border border-border bg-background text-muted-foreground",
            isTyping && "border-primary/60 text-primary shadow-[0_0_18px_rgba(99,102,241,0.25)]",
          )}
        >
          <Icon className="size-3.5" />
        </div>
      )}
      <div className={cn(isUser && "justify-self-end")}>
        <div
          className={cn(
            "mb-1 flex items-center gap-2 text-[11px]",
            isUser && "justify-end",
          )}
        >
          <strong>{title}</strong>
          <span className="text-muted-foreground">{time}</span>
        </div>
        {isUser ? (
          <Card className="max-w-[520px] rounded-[10px] border-border bg-background">
            <CardContent className="p-2.5">
              <pre className="whitespace-pre-wrap text-xs leading-5">{body}</pre>
            </CardContent>
          </Card>
        ) : (
          <div className={cn("max-w-none", isTyping && "relative")}>
            {thinking && <ThinkingBlock content={thinking} streaming={isTyping && !body} />}
            {isTyping ? (
              <pre className="streaming-content whitespace-pre-wrap break-words text-xs leading-5 font-sans">
                {body}
              </pre>
            ) : (
              <MarkdownMessage>{body}</MarkdownMessage>
            )}
            {isTyping && (
              <span className="ml-0.5 inline-block h-4 w-[2px] animate-[blink_1s_ease-in-out_infinite] bg-primary align-text-bottom" />
            )}
            {stats && !isTyping && (
              <div className="mt-2 flex items-center gap-2 text-[10px] text-muted-foreground">
                <span>{stats}</span>
              </div>
            )}
          </div>
        )}
      </div>
      {isUser ? (
      <div className="grid size-6 place-items-center rounded-md border border-border bg-background text-muted-foreground">
        <Icon className="size-3.5" />
      </div>
      ) : null}
    </div>
  );
});

function MarkdownMessage({ children }: { children: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        p: ({ children: paragraphChildren }) => (
          <p className="mb-2 last:mb-0 text-xs leading-5">{paragraphChildren}</p>
        ),
        ul: ({ children: listChildren }) => (
          <ul className="mb-2 ml-4 list-disc space-y-1 text-xs leading-5">
            {listChildren}
          </ul>
        ),
        ol: ({ children: listChildren }) => (
          <ol className="mb-2 ml-4 list-decimal space-y-1 text-xs leading-5">
            {listChildren}
          </ol>
        ),
        li: ({ children: itemChildren }) => <li>{itemChildren}</li>,
        code: ({ children: codeChildren }) => (
          <code className="rounded bg-muted px-1 py-0.5 text-[11px] text-foreground">
            {codeChildren}
          </code>
        ),
        pre: ({ children: preChildren }) => (
          <pre className="mb-2 overflow-x-auto rounded-lg border border-border bg-muted p-3 text-[11px] leading-5">
            {preChildren}
          </pre>
        ),
        blockquote: ({ children: quoteChildren }) => (
          <blockquote className="mb-2 border-l-2 border-border pl-3 text-xs leading-5 text-muted-foreground">
            {quoteChildren}
          </blockquote>
        ),
        a: ({ children: linkChildren, href }) => (
          <a
            href={href}
            className="text-primary underline underline-offset-2"
            target="_blank"
            rel="noreferrer"
          >
            {linkChildren}
          </a>
        ),
      }}
    >
      {children}
    </ReactMarkdown>
  );
}

function ThinkingBlock({
  content,
  streaming = false,
}: {
  content: string;
  streaming?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const preview = content.trimStart();

  return (
    <Card className="mb-3 w-full overflow-hidden rounded-lg border-border bg-muted/25">
      <button
        type="button"
        onClick={() => setExpanded((open) => !open)}
        className="flex h-6 w-full items-center gap-1.5 border-b border-border/80 px-2.5 text-[9px] font-semibold uppercase tracking-[0.05em] text-muted-foreground transition-colors hover:bg-muted/50"
      >
        <BrainCircuit className="size-3" />
        <span>Thinking</span>
        {streaming && (
          <span className="ml-0.5 size-1 animate-pulse rounded-full bg-primary" />
        )}
        <ChevronRight
          className={cn(
            "ml-auto size-3 transition-transform duration-200",
            expanded && "rotate-90",
          )}
        />
      </button>
      <div className="relative">
        {!expanded && (
          <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-5 bg-gradient-to-b from-background/70 to-transparent" />
        )}
        <div
          className={cn(
            "overflow-y-auto px-3 py-2 text-[11px] leading-5 text-muted-foreground",
            expanded ? "max-h-[360px]" : "h-12",
          )}
        >
          <pre className="whitespace-pre-wrap font-sans">{preview}</pre>
          {streaming && (
            <span className="ml-0.5 inline-block h-3 w-1 animate-pulse rounded-full bg-muted-foreground/60 align-bottom" />
          )}
        </div>
      </div>
    </Card>
  );
}

export function BenchTable({ results }: { results: RunResult[] }) {
  if (!results.length) {
    return (
      <div className="grid min-h-[300px] place-items-center text-center">
        <div>
          <Circle className="mx-auto mb-3 size-7 text-muted-foreground" />
          <p className="text-xs font-medium">
            Benchmark results will appear here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <Card className="rounded-sm">
      <CardContent className="p-0">
        <div className="grid grid-cols-[1fr_2fr_88px_72px] border-b border-border px-3 py-2 text-xs font-semibold text-muted-foreground">
          <span>Model</span>
          <span>Prompt</span>
          <span>Time</span>
          <span>Tok/s</span>
        </div>
        {results.map((item, index) => (
          <div
            key={`${item.created_at}-${index}`}
            className="grid grid-cols-[1fr_2fr_88px_72px] border-b border-border px-3 py-2 text-xs last:border-0"
          >
            <span className="truncate">{item.model}</span>
            <span className="truncate text-muted-foreground">
              {item.prompt}
            </span>
            <span>{msFromNs(item.total_duration)}</span>
            <span>{item.tokens_per_second?.toFixed(2) ?? "n/a"}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
