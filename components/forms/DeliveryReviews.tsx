"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Label } from "@/components/ui/Label";
type Review = {
  id: string;
  rating: number;
  body: string;
  response: string | null;
  createdAt: string;
  orderNumber: string;
  authorName: string;
};
export function DeliveryReviewForm({
  orderId,
  existing,
}: {
  orderId: string;
  existing?: { rating: number; body: string } | null;
}) {
  const router = useRouter();
  const [rating, setRating] = useState(5),
    [body, setBody] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [saved, setSaved] = useState(false);
  async function submit() {
    setBusy(true);
    try {
      const r = await fetch("/api/platform/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, rating, body }),
      });
      const b = await r.json();
      if (!r.ok) throw Error(b.error);
      setSaved(true);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Review could not be saved.");
    } finally {
      setBusy(false);
    }
  }
  if (existing)
    return (
      <div>
        <p>Your rating: {existing.rating}/5</p>
        <p className="mt-2 whitespace-pre-wrap">{existing.body}</p>
      </div>
    );
  if (saved) return <p role="status">Thank you. Your review has been saved.</p>;
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
      className="space-y-4"
    >
      <div>
        <Label htmlFor="delivery-rating">Rating</Label>
        <select
          id="delivery-rating"
          className="border rounded-[var(--eo-radius-control)] min-h-11 px-3"
          value={rating}
          onChange={(e) => setRating(Number(e.target.value))}
        >
          {[5, 4, 3, 2, 1].map((n) => (
            <option key={n} value={n}>
              {n} out of 5
            </option>
          ))}
        </select>
      </div>
      <div>
        <Label htmlFor="delivery-review">Your experience</Label>
        <textarea
          id="delivery-review"
          required
          minLength={3}
          maxLength={2000}
          rows={4}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          className="w-full border border-[var(--eo-border)] rounded-[var(--eo-radius-control)] p-3"
        />
      </div>
      <Button type="submit" loading={busy}>
        Submit review
      </Button>
      {error && <p role="alert">{error}</p>}
    </form>
  );
}
export function DeliveryReviews({
  reviews,
  business = false,
}: {
  reviews: Review[];
  business?: boolean;
}) {
  const router = useRouter();
  const [reply, setReply] = useState<Record<string, string>>({}),
    [busy, setBusy] = useState<string | null>(null),
    [error, setError] = useState("");
  async function respond(id: string) {
    setBusy(id);
    try {
      const r = await fetch(`/api/store/reviews/${id}/response`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ response: reply[id] }),
      });
      const b = await r.json();
      if (!r.ok) throw Error(b.error);
      setError("");
      router.refresh();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "The response could not be saved.",
      );
    } finally {
      setBusy(null);
    }
  }
  return (
    <div className="space-y-6">
      {reviews.length ? (
        reviews.map((r) => (
          <article
            key={r.id}
            className="space-y-3 border-b border-[var(--eo-border)] py-5"
          >
            <div className="flex flex-wrap justify-between gap-2">
              <h2 className="font-semibold">
                {r.orderNumber} · {r.rating}/5
              </h2>
              <time dateTime={r.createdAt}>
                {new Date(r.createdAt).toLocaleDateString()}
              </time>
            </div>
            <p className="text-sm">{r.authorName}</p>
            <p className="whitespace-pre-wrap">{r.body}</p>
            {r.response && (
              <div className="border-l-2 border-[var(--eo-border)] pl-4">
                <p className="font-medium">Business response</p>
                <p className="mt-2 whitespace-pre-wrap">{r.response}</p>
              </div>
            )}
            {business && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void respond(r.id);
                }}
                className="space-y-3"
              >
                <Label htmlFor={`review-reply-${r.id}`}>
                  {r.response ? "Update response" : "Reply to review"}
                </Label>
                <textarea
                  id={`review-reply-${r.id}`}
                  required
                  minLength={3}
                  maxLength={2000}
                  rows={3}
                  value={reply[r.id] ?? r.response ?? ""}
                  onChange={(e) =>
                    setReply((old) => ({ ...old, [r.id]: e.target.value }))
                  }
                  className="w-full border rounded-[var(--eo-radius-control)] p-3"
                />
                <Button size="sm" type="submit" loading={busy === r.id}>
                  Save response
                </Button>
              </form>
            )}
          </article>
        ))
      ) : (
        <p>No delivery reviews yet.</p>
      )}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
