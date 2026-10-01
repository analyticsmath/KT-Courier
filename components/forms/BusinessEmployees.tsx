"use client";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import {
  STORE_MODULES,
  STORE_ROLE_PRESETS,
  type StoreModule,
} from "@/lib/client-platform/store-permissions";
export type BusinessEmployee = {
  id: string;
  email: string;
  roleLabel: string;
  permissions: StoreModule[];
  status: string;
  inviteExpiresAt: string | null;
};
export function BusinessEmployees({initialEmployees}:{initialEmployees:BusinessEmployee[]}) {
  const [rows, setRows] = useState<BusinessEmployee[]>(initialEmployees),
    [editing, setEditing] = useState<BusinessEmployee | null>(null),
    [email, setEmail] = useState(""),
    [role, setRole] = useState("Operations"),
    [permissions, setPermissions] = useState<StoreModule[]>([
      "orders",
      "deliveries",
    ]),
    [message, setMessage] = useState(""),
    [link, setLink] = useState(""),
    [busy, setBusy] = useState(false);
  async function refresh() {
    const r = await fetch("/api/store/employees", { cache: "no-store" });
    const b = await r.json();
    if (!r.ok) throw Error(b.error ?? "Employees could not be loaded.");
    setRows(b.employees);
  }
  async function save(
    status?: "ACTIVE" | "DISABLED" | "REMOVED",
    employee = editing,
  ) {
    setBusy(true);
    setMessage("");
    setLink("");
    try {
      const r = await fetch("/api/store/employees", {
        method: employee ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          employee
            ? {
                id: employee.id,
                roleLabel: status ? employee.roleLabel : role,
                permissions: status ? employee.permissions : permissions,
                status: status ?? employee.status,
              }
            : { email, roleLabel: role, permissions },
        ),
      });
      const b = await r.json();
      if (!r.ok) throw Error(b.error ?? "Employee access could not be saved.");
      if (b.invitationPath)
        setLink(new URL(b.invitationPath, window.location.origin).href);
      setMessage(
        employee
          ? "Employee access updated."
          : "Invitation created. Share the link with the invited employee.",
      );
      setEditing(null);
      setEmail("");
      await refresh();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Please retry.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-8">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
        className="space-y-5 max-w-2xl"
      >
        <h2 className="text-xl font-semibold">
          {editing ? "Edit employee access" : "Invite an employee"}
        </h2>
        <div>
          <Label htmlFor="employee-email">Email address</Label>
          <Input
            id="employee-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={!!editing}
          />
        </div>
        <div>
          <Label htmlFor="employee-role">Role</Label>
          <Input
            id="employee-role"
            required
            minLength={2}
            maxLength={80}
            value={role}
            onChange={(e) => setRole(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {Object.entries(STORE_ROLE_PRESETS).map(([label, modules]) => (
            <Button
              key={label}
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => {
                setRole(label);
                setPermissions([...modules]);
              }}
            >
              {label}
            </Button>
          ))}
        </div>
        <fieldset className="grid grid-cols-2 gap-3">
          <legend className="mb-3 font-medium">Allowed modules</legend>
          {STORE_MODULES.map((m) => (
            <label
              key={m}
              className="flex items-center gap-3 min-h-11 capitalize"
            >
              <input
                type="checkbox"
                checked={permissions.includes(m)}
                onChange={(e) =>
                  setPermissions((old) =>
                    e.target.checked ? [...old, m] : old.filter((x) => x !== m),
                  )
                }
              />
              {m}
            </label>
          ))}
        </fieldset>
        <p className="text-sm text-[var(--eo-text-secondary)]">
          Employees use their own verified account. Only the owner can invite
          employees or change access.
        </p>
        <div className="flex gap-3">
          <Button type="submit" loading={busy}>
            {editing ? "Save access" : "Create invitation"}
          </Button>
          {editing && (
            <Button
              variant="secondary"
              type="button"
              onClick={() => {
                setEditing(null);
                setEmail("");
              }}
            >
              Cancel edit
            </Button>
          )}
        </div>
      </form>
      {message && <p role="status">{message}</p>}
      {link && (
        <div className="space-y-2">
          <Label htmlFor="invitation-link">
            Private invitation link — expires in seven days
          </Label>
          <Input
            id="invitation-link"
            value={link}
            readOnly
            onFocus={(e) => e.target.select()}
          />
          <Button
            variant="secondary"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(link);
                setMessage("Invitation link copied.");
              } catch {
                setMessage("Select and copy the invitation link.");
              }
            }}
          >
            Copy link
          </Button>
        </div>
      )}
      <div className="space-y-4">
        {rows.map((row) => (
          <article
            key={row.id}
            className="border-t border-[var(--eo-border)] py-5 space-y-3"
          >
            <div className="flex flex-wrap justify-between gap-2">
              <h3 className="font-semibold">{row.email}</h3>
              <span>{row.status.toLowerCase()}</span>
            </div>
            <p>
              {row.roleLabel} ·{" "}
              {row.permissions.length
                ? row.permissions.join(", ")
                : "No modules assigned"}
            </p>
            <div className="flex flex-wrap gap-2">
              {["ACTIVE", "DISABLED"].includes(row.status) && (
                <>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={busy}
                    onClick={() => {
                      setEditing(row);
                      setEmail(row.email);
                      setRole(row.roleLabel);
                      setPermissions(row.permissions);
                    }}
                  >
                    Edit access
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={busy}
                    onClick={() =>
                      void save(
                        row.status === "ACTIVE" ? "DISABLED" : "ACTIVE",
                        row,
                      )
                    }
                  >
                    {row.status === "ACTIVE" ? "Disable" : "Reactivate"}
                  </Button>
                </>
              )}
              <Button
                size="sm"
                variant="danger"
                disabled={busy}
                onClick={() => void save("REMOVED", row)}
              >
                {row.status === "INVITED"
                  ? "Revoke invitation"
                  : "Remove access"}
              </Button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
