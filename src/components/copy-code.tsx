"use client";

import { useState } from "react";

/** Code block with a Copy button. The code is this project's real source, passed in from the server. */
export function CopyCode({ code, label }: { code: string; label: string }) {
  const [copied, setCopied] = useState<"idle" | "copied" | "failed">("idle");

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied("copied");
    } catch {
      setCopied("failed");
    }
    setTimeout(() => setCopied("idle"), 1500);
  }

  return (
    <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950">
      <div className="flex items-center justify-between gap-2 border-b border-zinc-800 px-4 py-2">
        <span className="truncate font-mono text-[11px] text-zinc-400">{label}</span>
        <button
          type="button"
          onClick={copy}
          className="shrink-0 rounded-md border border-zinc-700 px-2 py-0.5 text-[11px] font-medium text-zinc-200 transition hover:bg-zinc-800"
          aria-live="polite"
        >
          {copied === "copied" ? "Copied ✓" : copied === "failed" ? "Copy failed" : "Copy"}
        </button>
      </div>
      <pre className="max-h-[30rem] overflow-auto p-4 font-mono text-xs leading-relaxed text-zinc-100">
        <code>{code}</code>
      </pre>
    </div>
  );
}

/** Tabs over several copyable code blocks. */
export function CodeTabs({ items }: { items: { title: string; label: string; code: string; note?: string }[] }) {
  const [active, setActive] = useState(0);
  const item = items[active];
  return (
    <div className="flex flex-col gap-3">
      <div role="tablist" className="flex gap-1 overflow-x-auto">
        {items.map((entry, index) => (
          <button
            key={entry.title}
            type="button"
            role="tab"
            aria-selected={index === active}
            onClick={() => setActive(index)}
            className={`shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              index === active
                ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
            }`}
          >
            {index + 1}. {entry.title}
          </button>
        ))}
      </div>
      {item.note && <p className="text-sm text-zinc-600 dark:text-zinc-400">{item.note}</p>}
      <CopyCode code={item.code} label={item.label} />
    </div>
  );
}
