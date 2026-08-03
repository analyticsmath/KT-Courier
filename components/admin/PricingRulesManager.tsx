"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { PricingRuleForm } from "./PricingRuleForm";
import { getDeliveryTypeConfig } from "@/lib/constants/statuses";
import type { PricingRuleDto } from "@/lib/dto/order.dto";

interface PricingRulesManagerProps {
  rules: PricingRuleDto[];
  regions: Array<{ id: string; name: string }>;
}

export function PricingRulesManager({ rules, regions }: PricingRulesManagerProps) {
  const router = useRouter();
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deactivating, setDeactivating] = useState<string | null>(null);
  const [deactivateError, setDeactivateError] = useState<string | null>(null);

  async function handleDeactivate(ruleId: string, revision: number) {
    const changeReason = window.prompt("Why is this pricing rule being archived?")?.trim();
    if (!changeReason || changeReason.length < 3) {
      setDeactivateError("An archive reason of at least three characters is required.");
      return;
    }
    setDeactivating(ruleId);
    setDeactivateError(null);
    try {
      const res = await fetch(`/api/admin/pricing/rules/${ruleId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expectedRevision: revision, changeReason }),
      });
      const data = await res.json() as { error?: string };
      if (data.error) {
        setDeactivateError(data.error);
      } else {
        router.refresh();
      }
    } catch {
      setDeactivateError("Failed to deactivate rule.");
    } finally {
      setDeactivating(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* Create new rule */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-[--kt-text]">
            {showCreate ? "New pricing rule" : "Add pricing rule"}
          </h2>
          {!showCreate && (
            <Button variant="primary" size="sm" onClick={() => setShowCreate(true)}>
              + New rule
            </Button>
          )}
        </div>
        {showCreate && (
          <PricingRuleForm regions={regions} onCancel={() => setShowCreate(false)} />
        )}
      </Card>

      {/* Rules list */}
      {deactivateError && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          <p className="text-sm text-red-700">{deactivateError}</p>
        </div>
      )}

      {rules.length === 0 ? (
        <Card>
          <p className="text-sm text-[--kt-text-muted] text-center py-4">
            No pricing rules yet. Create the first rule above.
          </p>
        </Card>
      ) : (
        <Card padding="none">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[--kt-border] bg-[--kt-surface-muted]">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[--kt-text-muted] uppercase tracking-wide">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[--kt-text-muted] uppercase tracking-wide hidden sm:table-cell">Delivery type</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[--kt-text-muted] uppercase tracking-wide">Amount</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[--kt-text-muted] uppercase tracking-wide">Status</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-[--kt-text-muted] uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[--kt-border]">
                {rules.map((rule) => (
                  <>
                    <tr key={rule.id} className="bg-[--kt-surface]">
                      <td className="px-4 py-3">
                        <p className="font-semibold text-[--kt-text]">{rule.name}</p>
                        <p className="text-xs text-[--kt-text-muted]">Revision {rule.revision}{rule.archivedAt ? " · archived" : ""}</p>
                        {rule.description && (
                          <p className="text-xs text-[--kt-text-muted]">{rule.description}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        {rule.deliveryType ? (
                          <Badge variant="blue">{getDeliveryTypeConfig(rule.deliveryType).label}</Badge>
                        ) : (
                          <span className="text-[--kt-text-muted]">Any</span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-semibold text-[--kt-text]">
                        {rule.currency} {rule.amount.toFixed(2)}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={rule.active ? "green" : "gray"}>
                          {rule.active ? "Active" : "Inactive"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setEditingId(editingId === rule.id ? null : rule.id)}
                            className="text-xs font-semibold text-[--kt-brand-blue] hover:underline"
                          >
                            Edit
                          </button>
                          {rule.active && (
                            <button
                              type="button"
                              onClick={() => handleDeactivate(rule.id, rule.revision)}
                              disabled={deactivating === rule.id}
                              className="text-xs font-semibold text-red-600 hover:underline disabled:opacity-50"
                            >
                              {deactivating === rule.id ? "…" : "Deactivate"}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {editingId === rule.id && (
                      <tr key={`${rule.id}-edit`} className="bg-[--kt-surface-muted]">
                        <td colSpan={5} className="px-4 py-4">
                          <PricingRuleForm
                            rule={rule}
                            regions={regions}
                            onCancel={() => setEditingId(null)}
                          />
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
