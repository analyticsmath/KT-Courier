"use client";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";

export type ModifierOptionDraft = {
  name: string;
  priceDelta: string;
  currency: "ZAR";
  displayOrder: number;
};

export type ModifierGroupDraft = {
  name: string;
  description?: string;
  minimumSelections: number;
  maximumSelections: number;
  isRequired: boolean;
  options: ModifierOptionDraft[];
};

export function readModifierGroupDrafts(raw: string): ModifierGroupDraft[] | null {
  if (!raw.trim()) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed.map((group) => {
      const rec = group && typeof group === "object" && !Array.isArray(group)
        ? (group as Record<string, unknown>)
        : {};
      const opts = Array.isArray(rec.options) ? rec.options : [];
      const isRequired = Boolean(rec.isRequired);
      const min = typeof rec.minimumSelections === "number" && Number.isInteger(rec.minimumSelections)
        ? rec.minimumSelections
        : isRequired
          ? 1
          : 0;
      const max = typeof rec.maximumSelections === "number" && Number.isInteger(rec.maximumSelections)
        ? Math.max(1, rec.maximumSelections)
        : 1;
      return {
        name: typeof rec.name === "string" ? rec.name : "",
        ...(typeof rec.description === "string" && rec.description
          ? { description: rec.description }
          : {}),
        minimumSelections: min,
        maximumSelections: Math.max(min || 1, max),
        isRequired,
        options: opts.map((opt, idx) => {
          const optRec = opt && typeof opt === "object" && !Array.isArray(opt)
            ? (opt as Record<string, unknown>)
            : {};
          return {
            name: typeof optRec.name === "string" ? optRec.name : "",
            priceDelta: typeof optRec.priceDelta === "string" ? optRec.priceDelta : "0.00",
            currency: "ZAR" as const,
            displayOrder:
              typeof optRec.displayOrder === "number" && Number.isInteger(optRec.displayOrder)
                ? optRec.displayOrder
                : idx,
          };
        }),
      };
    });
  } catch {
    return null;
  }
}

export function CatalogModifierBuilder({
  rawJson,
  onChangeJson,
  existingGroups = [],
}: {
  rawJson: string;
  onChangeJson: (next: string) => void;
  existingGroups?: ModifierGroupDraft[];
}) {
  const groups = readModifierGroupDrafts(rawJson);

  function commit(next: ModifierGroupDraft[]) {
    if (next.length === 0) {
      onChangeJson("");
      return;
    }
    const clean = next.map((group) => ({
      name: group.name,
      ...(group.description?.trim() ? { description: group.description } : {}),
      minimumSelections: group.minimumSelections,
      maximumSelections: group.maximumSelections,
      isRequired: group.isRequired,
      options: group.options.map((opt, idx) => ({
        name: opt.name,
        priceDelta: opt.priceDelta,
        currency: "ZAR" as const,
        displayOrder: idx,
      })),
    }));
    onChangeJson(JSON.stringify(clean, null, 2));
  }

  const list = groups ?? [];

  return (
    <section className="space-y-4" aria-label="Product add-ons and modifiers">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h4 className="text-sm font-extrabold">Add-on and customisation groups</h4>
          <p className="text-xs text-[var(--kt-text-muted)]">
            Optional buyer choices such as gift wrapping, sauces, or toppings with extra ZAR pricing.
          </p>
        </div>
        <Button
          type="button"
          variant="secondary"
          disabled={list.length >= 20}
          onClick={() =>
            commit([
              ...list,
              {
                name: "",
                minimumSelections: 0,
                maximumSelections: 1,
                isRequired: false,
                options: [{ name: "", priceDelta: "0.00", currency: "ZAR", displayOrder: 0 }],
              },
            ])
          }
        >
          Add modifier group
        </Button>
      </div>

      {existingGroups.length > 0 ? (
        <div className="space-y-2 rounded-xl border border-[var(--kt-soft-border)] p-3">
          <p className="text-xs font-bold text-[var(--kt-text-muted)]">
            Reuse an existing store add-on group
          </p>
          <div className="flex flex-wrap gap-2">
            {existingGroups.map((existing) => {
              const alreadyAdded = list.some(
                (item) =>
                  item.name.trim().toLocaleLowerCase("en-ZA") ===
                  existing.name.trim().toLocaleLowerCase("en-ZA"),
              );
              return (
                <Button
                  key={existing.name}
                  type="button"
                  variant="secondary"
                  disabled={alreadyAdded || list.length >= 20}
                  onClick={() =>
                    commit([
                      ...list,
                      {
                        ...existing,
                        options: existing.options.map((opt, idx) => ({
                          ...opt,
                          currency: "ZAR" as const,
                          displayOrder: idx,
                        })),
                      },
                    ])
                  }
                >
                  Reuse {existing.name}
                </Button>
              );
            })}
          </div>
        </div>
      ) : null}

      {groups === null ? (
        <p role="alert" className="text-sm text-red-700">
          The current modifier JSON could not be parsed. Edit the JSON below or add a fresh group.
        </p>
      ) : null}

      {list.map((group, groupIndex) => (
        <fieldset
          key={groupIndex}
          className="space-y-4 rounded-xl border border-[var(--kt-soft-border)] p-4"
        >
          <legend className="px-2 text-sm font-bold">
            {group.name || `Modifier group ${groupIndex + 1}`}
          </legend>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="min-w-0">
              <label
                htmlFor={`mod-group-${groupIndex}-name`}
                className="mb-1 block text-sm font-bold"
              >
                Group name
              </label>
              <Input
                id={`mod-group-${groupIndex}-name`}
                value={group.name}
                maxLength={120}
                placeholder="e.g. Flavour"
                onChange={(event) =>
                  commit(
                    list.map((item, idx) =>
                      idx === groupIndex ? { ...item, name: event.target.value } : item,
                    ),
                  )
                }
              />
            </div>
            <div className="min-w-0">
              <label
                htmlFor={`mod-group-${groupIndex}-max`}
                className="mb-1 block text-sm font-bold"
              >
                Maximum choices allowed
              </label>
              <Input
                id={`mod-group-${groupIndex}-max`}
                inputMode="numeric"
                value={String(group.maximumSelections)}
                onChange={(event) => {
                  const n = Number(event.target.value.replace(/\D/g, "")) || 1;
                  commit(
                    list.map((item, idx) =>
                      idx === groupIndex
                        ? {
                            ...item,
                            maximumSelections: Math.max(
                              item.isRequired ? Math.max(1, item.minimumSelections) : 1,
                              Math.min(100, n),
                            ),
                          }
                        : item,
                    ),
                  );
                }}
              />
            </div>
          </div>

          <label className="flex min-h-11 items-center gap-3 text-sm font-bold">
            <input
              type="checkbox"
              checked={group.isRequired}
              onChange={(event) => {
                const req = event.target.checked;
                commit(
                  list.map((item, idx) =>
                    idx === groupIndex
                      ? {
                          ...item,
                          isRequired: req,
                          minimumSelections: req ? Math.max(1, item.minimumSelections) : 0,
                          maximumSelections: Math.max(
                            req ? Math.max(1, item.minimumSelections) : 1,
                            item.maximumSelections,
                          ),
                        }
                      : item,
                  ),
                );
              }}
            />
            <span>Customer must pick at least one option</span>
          </label>

          <div className="space-y-3">
            {group.options.map((opt, optIndex) => (
              <div
                key={optIndex}
                className="grid gap-3 rounded-lg border border-[var(--kt-line-soft)] p-3 sm:grid-cols-[1fr_10rem_auto]"
              >
                <div className="min-w-0">
                  <label
                    htmlFor={`mod-${groupIndex}-opt-${optIndex}-name`}
                    className="mb-1 block text-xs font-bold"
                  >
                    Option label
                  </label>
                  <Input
                    id={`mod-${groupIndex}-opt-${optIndex}-name`}
                    value={opt.name}
                    maxLength={120}
                    placeholder="e.g. Caramel drizzle"
                    onChange={(event) =>
                      commit(
                        list.map((g, gi) =>
                          gi === groupIndex
                            ? {
                                ...g,
                                options: g.options.map((o, oi) =>
                                  oi === optIndex ? { ...o, name: event.target.value } : o,
                                ),
                              }
                            : g,
                        ),
                      )
                    }
                  />
                </div>
                <div className="min-w-0">
                  <label
                    htmlFor={`mod-${groupIndex}-opt-${optIndex}-price`}
                    className="mb-1 block text-xs font-bold"
                  >
                    Add-on price (ZAR)
                  </label>
                  <Input
                    id={`mod-${groupIndex}-opt-${optIndex}-price`}
                    inputMode="decimal"
                    value={opt.priceDelta}
                    placeholder="0.00"
                    onChange={(event) =>
                      commit(
                        list.map((g, gi) =>
                          gi === groupIndex
                            ? {
                                ...g,
                                options: g.options.map((o, oi) =>
                                  oi === optIndex ? { ...o, priceDelta: event.target.value } : o,
                                ),
                              }
                            : g,
                        ),
                      )
                    }
                  />
                </div>
                <div className="flex items-end">
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={group.options.length <= 1}
                    onClick={() =>
                      commit(
                        list.map((g, gi) =>
                          gi === groupIndex
                            ? { ...g, options: g.options.filter((_, oi) => oi !== optIndex) }
                            : g,
                        ),
                      )
                    }
                  >
                    Remove option
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-3">
            <Button
              type="button"
              variant="secondary"
              disabled={group.options.length >= 100}
              onClick={() =>
                commit(
                  list.map((g, gi) =>
                    gi === groupIndex
                      ? {
                          ...g,
                          options: [
                            ...g.options,
                            {
                              name: "",
                              priceDelta: "0.00",
                              currency: "ZAR",
                              displayOrder: g.options.length,
                            },
                          ],
                        }
                      : g,
                  ),
                )
              }
            >
              Add option to {group.name || `group ${groupIndex + 1}`}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => commit(list.filter((_, gi) => gi !== groupIndex))}
            >
              Remove group {groupIndex + 1}
            </Button>
          </div>
        </fieldset>
      ))}

      <details className="rounded-lg border border-[var(--kt-soft-border)] p-3">
        <summary className="cursor-pointer text-sm font-bold">
          Advanced modifier groups JSON
        </summary>
        <div className="mt-3">
          <label htmlFor="modifier-groups" className="mb-1 block text-sm font-extrabold">
            Modifier groups
          </label>
          <Textarea
            id="modifier-groups"
            value={rawJson}
            onChange={(event) => onChangeJson(event.target.value)}
            rows={6}
            className="font-mono text-xs"
          />
          <p className="mt-1 text-xs text-[var(--kt-text-muted)]">
            Optional JSON array of groups with name, minimumSelections, maximumSelections, isRequired and ZAR options.
          </p>
        </div>
      </details>
    </section>
  );
}
