import { memo, useCallback, useState } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  BrainCircuit,
  Check,
  ChevronRight,
  Copy,
  MessageSquare,
  RotateCcw,
  Trash2,
  User,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { msFromNs } from "@/lib/format";
import type { RunResult } from "@/lib/types";
import { formatTime } from "@/src/model-yard/shared";

const markdownPlugins = [remarkGfm];

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = useCallback(() => {
    navigator.clipboard?.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [text]);
  return (
    <button
      type="button"
      className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      onClick={handleCopy}
    >
      {copied ? (
        <><Check className="size-3" /> Copied</>
      ) : (
        <><Copy className="size-3" /> Copy</>
      )}
    </button>
  );
}

const markdownComponents: Components = {
  p: ({ children }) => (
    <p className="mb-2 last:mb-0 text-xs leading-5 text-foreground">
      {children}
    </p>
  ),
  ul: ({ children }) => (
    <ul className="mb-2 ml-4 list-disc space-y-1 text-xs leading-5 text-foreground">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="mb-2 ml-4 list-decimal space-y-1 text-xs leading-5 text-foreground">
      {children}
    </ol>
  ),
  li: ({ children }) => <li>{children}</li>,
  code: ({ children, className }) => {
    const isBlock = className?.includes("language-");
    if (isBlock) {
      return <code className={className}>{children}</code>;
    }
    return (
      <code className="rounded bg-muted px-1 py-0.5 text-[11px] text-foreground">
        {children}
      </code>
    );
  },
  pre: ({ children }) => {
    const codeElement = children as React.ReactElement<{
      className?: string;
      children?: string;
    }>;
    const language =
      codeElement?.props?.className?.match(/language-(\w+)/)?.[1] ?? "";
    const code =
      typeof codeElement?.props?.children === "string"
        ? codeElement.props.children
        : "";
    return (
      <div className="group/code mb-2 overflow-hidden rounded-lg border border-border bg-muted">
        <div className="flex items-center justify-between border-b border-border bg-muted/50 px-3 py-1">
          <span className="text-[10px] text-muted-foreground">{language || "code"}</span>
          <CopyButton text={code} />
        </div>
        <pre className="overflow-x-auto p-3 text-[11px] leading-5">
          <code>{code}</code>
        </pre>
      </div>
    );
  },
  blockquote: ({ children }) => (
    <blockquote className="mb-2 border-l-2 border-border pl-3 text-xs leading-5 text-muted-foreground">
      {children}
    </blockquote>
  ),
  a: ({ children, href }) => (
    <a
      href={href}
      className="text-primary underline underline-offset-2"
      target="_blank"
      rel="noreferrer"
    >
      {children}
    </a>
  ),
  table: ({ children }) => (
    <div className="mb-2 overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-xs">{children}</table>
    </div>
  ),
  thead: ({ children }) => (
    <thead className="bg-muted/50 text-left text-[11px] font-semibold text-foreground">
      {children}
    </thead>
  ),
  tbody: ({ children }) => (
    <tbody className="divide-y divide-border text-foreground">
      {children}
    </tbody>
  ),
  tr: ({ children }) => (
    <tr className="border-b border-border last:border-0">{children}</tr>
  ),
  th: ({ children }) => (
    <th className="whitespace-nowrap px-3 py-1.5 text-[11px] font-semibold text-foreground">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="px-3 py-1.5 text-[11px] text-foreground">{children}</td>
  ),
  hr: () => <hr className="my-3 border-border" />,
  strong: ({ children }) => (
    <strong className="font-semibold text-foreground">{children}</strong>
  ),
  em: ({ children }) => (
    <em className="italic text-muted-foreground">{children}</em>
  ),
};

export function ChatThread({
  results,
  busy,
  streamingIndex,
  onRerun,
  onDelete,
}: {
  results: RunResult[];
  busy: string;
  streamingIndex?: number;
  onRerun?: (index: number) => void;
  onDelete?: (index: number) => void;
}) {
  if (!results.length) {
    return (
      <div className="grid min-h-[300px] place-items-center text-center">
        <div>
          <MessageSquare className="mx-auto mb-3 size-7 text-muted-foreground" />
          <p className="text-xs font-medium">Select a model and press Run</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Responses will appear here.
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
            streaming={busy === "chat" && index === streamingIndex}
            onRerun={onRerun ? () => onRerun(index) : undefined}
            onDelete={onDelete ? () => onDelete(index) : undefined}
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
  onRerun,
  onDelete,
}: {
  role: "user" | "model";
  title: string;
  time: string;
  body: string;
  thinking?: string;
  stats?: string;
  streaming?: boolean;
  onRerun?: () => void;
  onDelete?: () => void;
}) {
  const isUser = role === "user";
  const isTyping = !isUser && streaming;
  return (
    <div
      className={cn(
        "grid gap-2.5",
        isUser ? "grid-cols-[minmax(0,1fr)_24px]" : "grid-cols-1",
      )}
    >
      <div className={cn(isUser && "justify-self-end")}>
        {isUser ? (
          <>
            <div className="mb-1 flex items-center justify-end gap-2 text-[11px]">
              <strong>{title}</strong>
              <span className="text-muted-foreground">{time}</span>
            </div>
            <Card className="max-w-[520px] rounded-[10px] border-border bg-background">
              <CardContent className="p-2.5">
                <pre className="whitespace-pre-wrap text-xs leading-5">{body}</pre>
              </CardContent>
            </Card>
          </>
        ) : (
          <Card className="border-border/85 bg-card/80 shadow-sm">
            <CardContent className="p-3.5">
              <div className={cn("max-w-none", isTyping && "relative")}>
                {thinking && <ThinkingBlock content={thinking} streaming={isTyping && !body} />}
                {isTyping ? (
                  <pre className="streaming-content whitespace-pre-wrap break-words text-xs leading-5 text-foreground font-sans">
                    {body}
                  </pre>
                ) : (
                  <MarkdownMessage>{body}</MarkdownMessage>
                )}
                {isTyping && (
                  <span className="ml-0.5 inline-block h-4 w-[2px] animate-[blink_1s_ease-in-out_infinite] bg-primary align-text-bottom" />
                )}
              </div>
              <div className="mt-3 flex items-center justify-between gap-3 border-t border-border/80 pt-2 text-[10px] text-muted-foreground">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    className="grid size-6 place-items-center rounded-md border border-border bg-background text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                    title="Copy response"
                    onClick={() => navigator.clipboard?.writeText(body)}
                  >
                    <Copy className="size-3" />
                  </button>
                  <button
                    type="button"
                    className="grid size-6 place-items-center rounded-md border border-border bg-background text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-45"
                    title="Rerun prompt"
                    disabled={!onRerun || isTyping}
                    onClick={onRerun}
                  >
                    <RotateCcw className="size-3" />
                  </button>
                  <button
                    type="button"
                    className="grid size-6 place-items-center rounded-md border border-border bg-background text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-45"
                    title="Delete turn"
                    disabled={!onDelete || isTyping}
                    onClick={onDelete}
                  >
                    <Trash2 className="size-3" />
                  </button>
                </div>
                <div className="flex min-w-0 items-center justify-end gap-2">
                  <strong className="truncate text-foreground">{title}</strong>
                  <span className="shrink-0">{time}</span>
                  {stats && !isTyping && (
                    <>
                      <span className="shrink-0 text-border">|</span>
                      <span className="shrink-0">{stats}</span>
                    </>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
      {isUser ? (
      <div className="grid size-6 place-items-center rounded-md border border-border bg-background text-muted-foreground">
        <User className="size-3.5" />
      </div>
      ) : null}
    </div>
  );
});

function MarkdownMessage({ children }: { children: string }) {
  return (
    <ReactMarkdown remarkPlugins={markdownPlugins} components={markdownComponents}>
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
    <div className="mb-3 w-full overflow-hidden rounded-lg border border-border bg-muted/25">
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
    </div>
  );
}


