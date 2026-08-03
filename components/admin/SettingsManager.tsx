"use client";

import { useState } from "react";
import { SystemSettingType } from "@/types/db";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import type { SystemSettingDto } from "@/lib/dto/settings.dto";

interface SettingRowProps {
  setting: SystemSettingDto;
}

function SettingRow({ setting }: SettingRowProps) {
  const [rawValue, setRawValue] = useState(() => {
    if (setting.type === SystemSettingType.JSON) {
      return JSON.stringify(setting.value, null, 2);
    }
    if (setting.type === SystemSettingType.BOOLEAN) {
      return String(setting.value);
    }
    return String(setting.value ?? "");
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSave() {
    setLoading(true);
    setError(null);
    setSuccess(false);

    let value: unknown = rawValue;
    if (setting.type === SystemSettingType.JSON) {
      try {
        value = JSON.parse(rawValue);
      } catch {
        setError("Invalid JSON.");
        setLoading(false);
        return;
      }
    } else if (setting.type === SystemSettingType.BOOLEAN) {
      value = rawValue === "true" ? true : rawValue === "false" ? false : rawValue;
    } else if (setting.type === SystemSettingType.NUMBER) {
      value = rawValue;
    }

    try {
      const res = await fetch(`/api/admin/settings/${encodeURIComponent(setting.key)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value }),
      });

      const data = (await res.json()) as { error?: string };

      if (data.error) {
        setError(data.error);
        return;
      }

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const inputId = `setting-${setting.key}`;

  return (
    <div className="border border-[--kt-border] rounded-xl p-4 space-y-3">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <label htmlFor={inputId} className="block text-sm font-semibold text-[--kt-text]">
            {setting.label}
          </label>
          {setting.description && (
            <p className="text-xs text-[--kt-text-muted] mt-0.5">{setting.description}</p>
          )}
          <p className="text-xs text-[--kt-text-muted] mt-0.5 font-mono">{setting.key}</p>
        </div>
        <span className="shrink-0 text-xs font-medium text-[--kt-text-muted] bg-[--kt-surface-muted] px-2 py-0.5 rounded">
          {setting.type}
        </span>
      </div>

      {setting.type === SystemSettingType.BOOLEAN ? (
        <div className="flex gap-3">
          {["true", "false"].map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setRawValue(v)}
              className={`px-3 py-1.5 rounded-lg text-sm font-semibold border transition-colors ${
                rawValue === v
                  ? "border-[--kt-brand-blue] bg-[--kt-blue-soft] text-[--kt-brand-blue]"
                  : "border-[--kt-border] text-[--kt-text-soft] hover:border-[--kt-brand-blue]"
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      ) : setting.type === SystemSettingType.JSON ? (
        <Textarea
          id={inputId}
          value={rawValue}
          onChange={(e) => setRawValue(e.target.value)}
          rows={4}
          className="font-mono text-xs"
        />
      ) : (
        <Input
          id={inputId}
          type={setting.type === SystemSettingType.NUMBER ? "number" : "text"}
          value={rawValue}
          onChange={(e) => setRawValue(e.target.value)}
        />
      )}

      {error && (
        <p className="text-xs text-[--kt-red]">{error}</p>
      )}

      {success && (
        <p className="text-xs text-green-600">Saved.</p>
      )}

      <div className="flex justify-end">
        <Button variant="primary" size="sm" onClick={handleSave} disabled={loading}>
          {loading ? "Saving…" : "Save"}
        </Button>
      </div>
    </div>
  );
}

interface SettingsManagerProps {
  settings: SystemSettingDto[];
}

export function SettingsManager({ settings }: SettingsManagerProps) {
  if (settings.length === 0) {
    return (
      <p className="text-sm text-[--kt-text-muted]">
        No system settings have been configured yet.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {settings.map((setting) => (
        <SettingRow key={setting.key} setting={setting} />
      ))}
    </div>
  );
}
