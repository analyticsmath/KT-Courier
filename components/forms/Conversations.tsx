"use client";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
type Conversation = {
  id: string;
  subject: string;
  kind: string;
  orderId: string | null;
  closedAt: string | null;
};
type Message = {
  id: string;
  body: string;
  createdAt: string;
  mine: boolean;
  senderName: string;
};
export function Conversations({
  scope = "personal",
  initialConversations = [],
  deliveryOrderId,
}: {
  scope?: "personal" | "STORE" | "admin";
  initialConversations?: Conversation[];
  deliveryOrderId?: string;
}) {
  const [conversations, setConversations] = useState(initialConversations),
    [selected, setSelected] = useState<string | undefined>(
      initialConversations[0]?.id,
    ),
    [messages, setMessages] = useState<Message[]>([]),
    [hasOlder, setHasOlder] = useState(false),
    [subject, setSubject] = useState(""),
    [body, setBody] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const last = useRef<string | undefined>(undefined),
    generation = useRef(0),
    pending = useRef<{ body: string; operationId: string } | null>(null);
  const current = conversations.find((c) => c.id === selected);
  useEffect(() => {
    if (!selected) return;
    const controller = new AbortController();
    const stamp = ++generation.current;
    last.current = undefined;
    async function read(initial = false) {
      if (document.hidden && !initial) return;
      try {
        const query = new URLSearchParams({ scope });
        if (!initial && last.current) query.set("after", last.current);
        const r = await fetch(
          `/api/platform/conversations/${selected}/messages?${query}`,
          { cache: "no-store", signal: controller.signal },
        );
        const b = await r.json();
        if (!r.ok) throw Error(b.error ?? "Messages could not be loaded.");
        if (generation.current !== stamp) return;
        const rows = b.messages as Message[];
        if (initial) {
          setMessages(rows);
          setHasOlder(b.hasMore);
        } else
          setMessages((old) => [
            ...new Map([...old, ...rows].map((m) => [m.id, m])).values(),
          ]);
        last.current = rows.at(-1)?.id ?? last.current;
        setError("");
      } catch (e) {
        if (!controller.signal.aborted)
          setError(
            e instanceof Error ? e.message : "Messages could not be loaded.",
          );
      }
    }
    void Promise.resolve().then(() => read(true));
    const timer = setInterval(() => void read(), 5000);
    return () => {
      controller.abort();
      clearInterval(timer);
    };
  }, [selected, scope]);
  async function older() {
    if (!selected || !messages.length) return;
    setBusy(true);
    try {
      const q = new URLSearchParams({ scope, before: messages[0].id });
      const r = await fetch(
        `/api/platform/conversations/${selected}/messages?${q}`,
        { cache: "no-store" },
      );
      const b = await r.json();
      if (!r.ok) throw Error(b.error);
      setMessages((old) => [
        ...new Map(
          [...(b.messages as Message[]), ...old].map((m) => [m.id, m]),
        ).values(),
      ]);
      setHasOlder(b.hasMore);
    } catch (e) {
      setError(e instanceof Error ? e.message : "History could not be loaded.");
    } finally {
      setBusy(false);
    }
  }
  async function start() {
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/platform/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: deliveryOrderId ? "DELIVERY" : "SUPPORT",
          subject: deliveryOrderId ? "Delivery conversation" : subject,
          business: scope === "STORE",
          ...(deliveryOrderId ? { orderId: deliveryOrderId } : {}),
        }),
      });
      const c = await r.json();
      if (!r.ok) throw Error(c.error);
      setConversations((old) => [c, ...old.filter((x) => x.id !== c.id)]);
      setSelected(c.id);
      setSubject("");
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "The conversation could not be started.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function send() {
    if (!selected) return;
    setBusy(true);
    setError("");
    if (!pending.current || pending.current.body !== body.trim())
      pending.current = { body: body.trim(), operationId: crypto.randomUUID() };
    try {
      const q = new URLSearchParams({ scope });
      const r = await fetch(
        `/api/platform/conversations/${selected}/messages?${q}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(pending.current),
        },
      );
      const b = await r.json();
      if (!r.ok) throw Error(b.error);
      pending.current = null;
      setBody("");
      const next = await fetch(
        `/api/platform/conversations/${selected}/messages?${q}`,
        { cache: "no-store" },
      );
      const history = await next.json();
      if (next.ok) {
        setMessages(history.messages);
        setHasOlder(history.hasMore);
        last.current = (history.messages as Message[]).at(-1)?.id;
      }
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Your message could not be sent. Retry to use the same operation.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-6">
      {scope !== "admin" && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void start();
          }}
          className="flex flex-wrap gap-3 items-end"
        >
          {!deliveryOrderId && (
            <div className="flex-1 min-w-48">
              <Label htmlFor="conversation-subject">Support subject</Label>
              <Input
                id="conversation-subject"
                required
                minLength={3}
                maxLength={150}
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="How can we help?"
              />
            </div>
          )}
          <Button type="submit" loading={busy}>
            {deliveryOrderId
              ? "Open delivery chat"
              : "Start support conversation"}
          </Button>
        </form>
      )}
      <div className="grid gap-6 md:grid-cols-[minmax(180px,1fr)_3fr]">
        <nav aria-label="Conversations" className="space-y-2">
          {conversations.length ? (
            conversations.map((c) => (
              <button
                key={c.id}
                type="button"
                aria-current={c.id === selected ? "true" : undefined}
                disabled={busy}
                onClick={() => {
                  setSelected(c.id);
                  setMessages([]);
                  setBody("");
                  pending.current = null;
                }}
                className={`w-full text-left px-4 py-3 border rounded-[var(--eo-radius-control)] ${c.id === selected ? "border-[var(--eo-signal)]" : "border-[var(--eo-border)]"}`}
              >
                <span className="block text-xs uppercase tracking-wide text-[var(--eo-text-muted)]">
                  {c.kind === "SUPPORT" ? "KT support" : "Delivery chat"}
                </span>
                <span className="block mt-1 font-medium">{c.subject}</span>
              </button>
            ))
          ) : (
            <p className="text-sm text-[var(--eo-text-secondary)]">
              No conversations yet.
            </p>
          )}
        </nav>
        <section
          className="space-y-4"
          aria-label={current?.subject ?? "Messages"}
        >
          {selected ? (
            <>
              <h2 className="text-xl font-semibold">{current?.subject}</h2>
              {hasOlder && (
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={busy}
                  onClick={() => void older()}
                >
                  Earlier messages
                </Button>
              )}
              <ol
                className="space-y-4 max-h-[32rem] overflow-auto"
                aria-live="polite"
                aria-relevant="additions"
              >
                {messages.map((m) => (
                  <li
                    key={m.id}
                    className={`border border-[var(--eo-border)] rounded-[var(--eo-radius-panel)] p-4 ${m.mine ? "ml-6" : "mr-6"}`}
                  >
                    <div className="flex flex-wrap justify-between gap-2 text-xs text-[var(--eo-text-muted)]">
                      <strong>{m.mine ? "You" : m.senderName}</strong>
                      <time dateTime={m.createdAt}>
                        {new Date(m.createdAt).toLocaleString()}
                      </time>
                    </div>
                    <p className="mt-2 whitespace-pre-wrap break-words">
                      {m.body}
                    </p>
                  </li>
                ))}
              </ol>
              {!current?.closedAt && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void send();
                  }}
                  className="space-y-3"
                >
                  <Label htmlFor="conversation-message">Message</Label>
                  <textarea
                    id="conversation-message"
                    required
                    maxLength={4000}
                    rows={4}
                    className="w-full border border-[var(--eo-border)] rounded-[var(--eo-radius-control)] p-3"
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    placeholder="Write your message"
                  />
                  <Button type="submit" loading={busy} disabled={!body.trim()}>
                    Send message
                  </Button>
                </form>
              )}
              {current?.closedAt && (
                <p>
                  This conversation is closed. You can still read its history.
                </p>
              )}
            </>
          ) : (
            <p>Select a conversation to read its history.</p>
          )}
        </section>
      </div>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
