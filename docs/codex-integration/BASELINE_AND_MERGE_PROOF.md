> **Historical snapshot:** This document was prepared against the 6eed666 integration evidence baseline. The final exact-source results, corrected browser status and current handoff are in [PHASE_2_FINAL_CLOSURE.md](PHASE_2_FINAL_CLOSURE.md).
# Integration baseline and merge proof

## Captured state

Preflight was performed on 11 October 2026 in the isolated worktree `D:\KT-Courier-integration`. The remote-tracking refs observed during that preflight were:

| Ref | SHA | Meaning |
|---|---|---|
| `origin/main` | `83a4d63078efa20d4e234fe081c10e15746387d1` | Existing production branch; not used as the integration base. |
| `origin/production-closure-2026-10-07` | `46aeb318d097852db5634a512c5773818a884ece` | Phase 1 engineering report commit. |
| `origin/phase2/antigravity-functional-completion-2026-10-11` | `3c79fce207800264b78e59a60bfcc4240ede6cc4` | Phase 2 evidence and test-infrastructure branch head. |
| Merge base | `b31ede4a900b0778e15dce0a3ef78e6d2613b350` | Shared source baseline. |

The Phase 1 application source at `3655a53e8a595c4c89dbf9891578961dec195292` is the parent of the report-only Phase 1 commit. The original Phase 2 branch still has its two commits after the shared base. The source worktrees remained clean apart from the four pre-existing untracked driver diagnostic files in `D:\KT-Courier`; those files were not opened or modified. The separate Phase 2 worktree at `D:\KT-Courier-phase2` was left untouched. An unrelated stale/prunable worktree was also left untouched.

A final read-only `git ls-remote` on 11 October reconfirmed the same three origin SHAs above. The Phase 1 and Phase 2 worktree heads still resolve to `46aeb318…` and `3c79fce…`; `git status --short --untracked-files=all` shows only those same four untracked diagnostics in Phase 1 and no changes in Phase 2. No source branch was rewritten, committed to or pushed.

## Incoming change review

The Phase 2 branch contributes fourteen paths relative to the merge base: nine Markdown dossiers, one JSON evidence file, two Windows line-ending test normalizations, and two timeout increases. It contains no application, schema, migration, route, or domain-service implementation relative to the shared base. The timeout increases (`vitest.config.ts` from 15 to 45 seconds and the legacy CLI subprocess from 10 to 30 seconds) were evaluated against the complete DB-free suite and not retained: all 3,734 tests passed with the original 15-second and 10-second limits. Both CRLF normalization changes remain; they fix Windows source-audit comparisons and pass in the full suite.

The incoming historical Markdown uses trailing spaces as hard line breaks. Its contents were preserved as historical evidence; new integration records avoid those line endings. Semantic diff review with end-of-line whitespace ignored found no path collision with Phase 1 source changes.

## Merge receipt

The merge was staged with `git merge --no-ff --no-commit` in the new worktree, reviewed, tested, and committed without conflict resolution:

| Item | Receipt |
|---|---|
| Branch | `integration/codex-phase1-phase2-2026-10-11` |
| Worktree | `D:\KT-Courier-integration` |
| Merge commit | `6eed666775a30db5e7e4a70208c418072b76053b` |
| First parent | `46aeb318d097852db5634a512c5773818a884ece` (Phase 1) |
| Second parent | `3c79fce207800264b78e59a60bfcc4240ede6cc4` (Phase 2) |
| Conflicts | None |
| Source branch rewrites or updates | None |
| Application/domain source delta from Phase 1 | None |

Both source heads remain ancestors of the merge commit. The integration branch is local and reviewable but has not been pushed. `vercel.json` rewrites every path to `https://web-production-9f8bb.up.railway.app/:path*`; this would make an ordinary Vercel preview relay requests to the production Railway origin. Therefore a preview cannot be certified safe and no push or draft PR was created.

## Authority corpus

Six client DOCX originals are present and their SHA-256 digests match `docs/client-authority/2026-10/reviewed-client-documents.json`. The binaries for `KT COURIERS — Delivery and Access.docx` and `KT COURIERS — WEBSITE & SYSTEM CHANGES.docx` are absent from this worktree; their complete extracted paragraph corpora and recorded source digests are present in that reviewed JSON corpus. The document-rendering helper could not run because its bundled LibreOffice executable was unavailable, so visual page rendering was not independently reviewed. The readable corpus and the existing dated reconciliation README were used for requirements decisions.
