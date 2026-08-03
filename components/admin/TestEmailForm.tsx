"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";

interface TestEmailFormProps {
  defaultRecipient?: string;
}

interface TestResult {
  delivered: boolean;
  logId?: string | null;
  providerMessageId?: string | null;
  error?: string;
  message: string;
}

export function TestEmailForm({ defaultRecipient }: TestEmailFormProps) {
  const [recipient, setRecipient] = useState(defaultRecipient ?? "");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TestResult | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!recipient.trim()) return;
    setLoading(true);
    setResult(null);
    setFormError(null);

    try {
      const res = await fetch("/api/admin/emails/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipient: recipient.trim() }),
      });

      const data = (await res.json()) as TestResult & { error?: string };

      if (!res.ok) {
        setFormError(data.error ?? "Request failed.");
        return;
      }

      setResult(data);
    } catch {
      setFormError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="test_recipient">Recipient email</Label>
        <Input
          id="test_recipient"
          type="email"
          value={recipient}
          onChange={(e) => setRecipient(e.target.value)}
          placeholder="you@example.com"
          required
        />
      </div>

      {formError && (
        <p className="text-sm text-[--kt-red]">{formError}</p>
      )}

      {result && (
        <div className={`rounded-xl px-4 py-3 ${result.delivered ? "bg-[--kt-green-soft] border border-green-200" : "bg-red-50 border border-red-200"}`}>
          <p className={`text-sm font-medium ${result.delivered ? "text-green-700" : "text-red-700"}`}>
            {result.message}
          </p>
          {result.logId && (
            <p className="text-xs text-[--kt-text-muted] mt-1 font-mono">Log ID: {result.logId}</p>
          )}
          {result.error && (
            <p className="text-xs text-red-600 mt-1">{result.error}</p>
          )}
        </div>
      )}

      <Button type="submit" variant="primary" size="sm" disabled={loading}>
        {loading ? "Sending…" : "Send test email"}
      </Button>
    </form>
  );
}
