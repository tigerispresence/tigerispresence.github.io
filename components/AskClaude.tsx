"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { ExternalLink, Send, Sparkles, Square, X } from "lucide-react";
import { AskError, askClaude, type AskContext, type AskTurn } from "@/lib/api/client";

interface Message {
  role: "user" | "assistant";
  content: string;
  sources?: { title: string; url: string }[];
  error?: string;
}

interface Props {
  context: AskContext;
  /** What the panel is about, e.g. "NVDA" or "Sectors". */
  subject: string;
  suggestions: string[];
}

const CODE_KEY = "ask-claude-access-code";

const readCode = () => {
  try {
    return localStorage.getItem(CODE_KEY) ?? "";
  } catch {
    return "";
  }
};

/** Renders **bold** inline; everything else is plain text with line breaks kept. */
function Rich({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
        part.startsWith("**") && part.endsWith("**") ? (
          <strong key={i} className="text-white">{part.slice(2, -2)}</strong>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </>
  );
}

/**
 * Completed question/answer pairs for the follow-up request. A failed or
 * empty answer drops its question too, so the turns always alternate.
 */
function toHistory(messages: Message[]): AskTurn[] {
  const turns: AskTurn[] = [];
  for (let i = 0; i + 1 < messages.length; i += 2) {
    const [q, a] = [messages[i], messages[i + 1]];
    if (q.role === "user" && a.role === "assistant" && a.content && !a.error) {
      turns.push({ role: "user", content: q.content }, { role: "assistant", content: a.content });
    }
  }
  return turns.slice(-12);
}

/** A floating "Ask Claude" button and chat panel about what is on screen. */
export default function AskClaude({ context, subject, suggestions }: Props) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [streaming, setStreaming] = useState(false);
  const [needCode, setNeedCode] = useState(false);
  const [code, setCode] = useState("");
  const abort = useRef<AbortController | null>(null);
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => () => abort.current?.abort(), []);
  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [messages, status]);

  const updateLast = (patch: (m: Message) => Message) =>
    setMessages((prev) => [...prev.slice(0, -1), patch(prev[prev.length - 1])]);

  async function ask(question: string) {
    const q = question.trim();
    if (!q || streaming) return;
    const history = toHistory(messages);
    setMessages((prev) => [...prev, { role: "user", content: q }, { role: "assistant", content: "" }]);
    setInput("");
    setStreaming(true);
    setStatus("Reading the data…");
    abort.current = new AbortController();

    try {
      await askClaude(
        { question: q, context, history },
        (event) => {
          if (event.type === "status") setStatus(event.text);
          else if (event.type === "text") {
            setStatus(null);
            updateLast((m) => ({ ...m, content: m.content + event.text }));
          } else if (event.type === "sources") updateLast((m) => ({ ...m, sources: event.sources }));
          else if (event.type === "error") updateLast((m) => ({ ...m, error: event.message }));
        },
        { signal: abort.current.signal, accessCode: readCode() || undefined },
      );
    } catch (e) {
      if (abort.current?.signal.aborted) {
        updateLast((m) => ({ ...m, error: m.content ? undefined : "Stopped." }));
      } else {
        if (e instanceof AskError && e.code === "access_code") setNeedCode(true);
        updateLast((m) => ({ ...m, error: e instanceof Error ? e.message : "Something went wrong." }));
      }
    } finally {
      setStreaming(false);
      setStatus(null);
    }
  }

  const saveCode = () => {
    try {
      localStorage.setItem(CODE_KEY, code.trim());
    } catch {
      // Private mode: the code works for this page view only.
    }
    setNeedCode(false);
    const lastQuestion = [...messages].reverse().find((m) => m.role === "user");
    if (lastQuestion) {
      setMessages((prev) => prev.slice(0, -2));
      void ask(lastQuestion.content);
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-50 flex items-center gap-2 px-4 py-3 rounded-full bg-blue-600 hover:bg-blue-500 text-white font-semibold shadow-2xl shadow-blue-500/30 transition-colors"
      >
        <Sparkles className="w-4 h-4" /> Ask Claude
      </button>
    );
  }

  return (
    <div
      role="dialog"
      aria-label={`Ask Claude about ${subject}`}
      className="fixed z-50 inset-x-0 bottom-0 h-[85dvh] md:inset-x-auto md:right-5 md:bottom-5 md:w-[440px] md:h-[640px] flex flex-col bg-gray-950 border border-gray-800 rounded-t-3xl md:rounded-3xl shadow-2xl"
    >
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
        <div>
          <div className="text-white font-semibold flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-blue-400" /> Ask Claude
          </div>
          <div className="text-xs text-gray-500">About {subject}, with live data and web search</div>
        </div>
        <button onClick={() => setOpen(false)} aria-label="Close" className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 text-sm">
        {messages.length === 0 && (
          <div className="space-y-3">
            <p className="text-gray-400">Ask anything about {subject}. Claude sees the figures on this page and can search recent news.</p>
            <div className="flex flex-col gap-2">
              {suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => ask(s)}
                  className="text-left px-3 py-2 rounded-xl border border-gray-800 bg-gray-900/60 text-gray-300 hover:border-blue-500/50 hover:text-white transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) =>
          m.role === "user" ? (
            <div key={i} className="ml-8 px-3 py-2 rounded-2xl rounded-br-md bg-blue-600 text-white whitespace-pre-wrap">
              {m.content}
            </div>
          ) : (
            <div key={i} className="mr-4 text-gray-200 leading-relaxed">
              {m.content && <div className="whitespace-pre-wrap"><Rich text={m.content} /></div>}
              {m.error && <div className="mt-1 text-red-400">{m.error}</div>}
              {m.sources && m.sources.length > 0 && (
                <div className="mt-3 space-y-1">
                  <div className="text-[11px] uppercase tracking-wider text-gray-500">Sources</div>
                  {m.sources.map((s) => (
                    <a key={s.url} href={s.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-blue-400 hover:underline truncate">
                      <ExternalLink className="w-3 h-3 shrink-0" /> <span className="truncate">{s.title}</span>
                    </a>
                  ))}
                </div>
              )}
            </div>
          ),
        )}

        {status && <div className="text-gray-500 animate-pulse">{status}</div>}

        {needCode && (
          <div className="p-3 rounded-xl border border-gray-800 bg-gray-900/60 space-y-2">
            <div className="text-gray-300">This server requires an access code for Ask Claude.</div>
            <div className="flex gap-2">
              <input
                type="password"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && saveCode()}
                placeholder="Access code"
                className="flex-1 bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-white text-base md:text-sm outline-none focus:border-blue-500"
              />
              <button onClick={saveCode} className="px-3 py-2 rounded-lg bg-blue-600 text-white font-semibold">Save</button>
            </div>
          </div>
        )}
        <div ref={bottom} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void ask(input);
        }}
        className="flex items-end gap-2 p-3 border-t border-gray-800"
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              void ask(input);
            }
          }}
          rows={1}
          maxLength={1000}
          placeholder={`Ask about ${subject}…`}
          // 16px on phones so iOS doesn't zoom the page on focus.
          className="flex-1 resize-none max-h-32 bg-gray-900 border border-gray-700 rounded-2xl px-4 py-3 text-white text-base md:text-sm outline-none focus:border-blue-500"
        />
        {streaming ? (
          <button type="button" onClick={() => abort.current?.abort()} aria-label="Stop" className="p-3 rounded-full bg-gray-700 text-white">
            <Square className="w-4 h-4" />
          </button>
        ) : (
          <button type="submit" disabled={!input.trim()} aria-label="Send" className="p-3 rounded-full bg-blue-600 text-white disabled:opacity-40">
            <Send className="w-4 h-4" />
          </button>
        )}
      </form>
    </div>
  );
}
