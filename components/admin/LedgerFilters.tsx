const selectClass = "h-10 rounded-xl border border-[var(--kt-border)] bg-white px-3 text-sm text-[var(--kt-ink-navy)]";
const inputClass = `${selectClass} min-w-48`;

export function LedgerAccountFilters({ values }: { values: Record<string, string | undefined> }) {
  return (
    <form method="get" action="/admin/ledger" aria-label="Ledger account filters" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      <div className="grid gap-1 text-xs font-semibold text-[var(--kt-text-muted)]">
        <label htmlFor="accountCode-filter">Account code</label>
        <input id="accountCode-filter" className={inputClass} name="accountCode" defaultValue={values.accountCode} />
      </div>
      <div className="grid gap-1 text-xs font-semibold text-[var(--kt-text-muted)]">
        <label htmlFor="ownerType-filter">Owner type</label>
        <select id="ownerType-filter" className={selectClass} name="ownerType" defaultValue={values.ownerType ?? ""}>
          <option value="">All owners</option>
          {['CUSTOMER', 'STORE', 'DRIVER', 'PROMOTER', 'PLATFORM'].map((value) => <option key={value}>{value}</option>)}
        </select>
      </div>
      <div className="grid gap-1 text-xs font-semibold text-[var(--kt-text-muted)]">
        <label htmlFor="purpose-filter">Account purpose</label>
        <select id="purpose-filter" className={selectClass} name="purpose" defaultValue={values.purpose ?? ""}>
          <option value="">All purposes</option>
          {['AVAILABLE', 'PENDING', 'HELD', 'CASH_CLEARING', 'SETTLEMENT_CLEARING', 'PLATFORM_REVENUE', 'ADJUSTMENT', 'SUSPENSE', 'OPENING_BALANCE_CONTROL'].map((value) => <option key={value}>{value}</option>)}
        </select>
      </div>
      <div className="grid gap-1 text-xs font-semibold text-[var(--kt-text-muted)]">
        <label htmlFor="accountStatus-filter">Account status</label>
        <select id="accountStatus-filter" className={selectClass} name="accountStatus" defaultValue={values.accountStatus ?? ""}>
          <option value="">All statuses</option>
          {['ACTIVE', 'FROZEN', 'CLOSED'].map((value) => <option key={value}>{value}</option>)}
        </select>
      </div>
      <div className="flex items-end gap-2">
        <label className="flex h-10 items-center gap-2 text-sm text-[var(--kt-text-soft)]">
          <input type="checkbox" name="nonZero" value="true" defaultChecked={values.nonZero === "true"} />
          Non-zero only
        </label>
        <button className="h-10 rounded-xl bg-[var(--kt-brand-navy)] px-4 text-sm font-bold text-white" type="submit">Filter accounts</button>
      </div>
    </form>
  );
}

export function LedgerJournalFilters({ values }: { values: Record<string, string | undefined> }) {
  return (
    <form method="get" action="/admin/ledger" aria-label="Ledger journal filters" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <div className="grid gap-1 text-xs font-semibold text-[var(--kt-text-muted)]">
        <label htmlFor="journalReference-filter">Journal reference</label>
        <input id="journalReference-filter" className={inputClass} name="journalReference" defaultValue={values.journalReference} />
      </div>
      <div className="grid gap-1 text-xs font-semibold text-[var(--kt-text-muted)]">
        <label htmlFor="journalType-filter">Journal type</label>
        <select id="journalType-filter" className={selectClass} name="journalType" defaultValue={values.journalType ?? ""}>
          <option value="">All types</option>
          {['GENERAL', 'ACCOUNT_TRANSFER', 'OPENING_BALANCE', 'REVERSAL'].map((value) => <option key={value}>{value}</option>)}
        </select>
      </div>
      <div className="grid gap-1 text-xs font-semibold text-[var(--kt-text-muted)]">
        <label htmlFor="reversalState-filter">Reversal state</label>
        <select id="reversalState-filter" className={selectClass} name="reversalState" defaultValue={values.reversalState ?? ""}>
          <option value="">All journals</option>
          <option value="ORIGINAL">Original journals</option>
          <option value="REVERSAL">Reversal journals</option>
          <option value="REVERSED">Reversed originals</option>
          <option value="UNREVERSED">Unreversed originals</option>
        </select>
      </div>
      <div className="flex items-end">
        <button className="h-10 rounded-xl bg-[var(--kt-brand-navy)] px-4 text-sm font-bold text-white" type="submit">Filter journals</button>
      </div>
    </form>
  );
}
