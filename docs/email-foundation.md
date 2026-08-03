# Historical email foundation

This document is retained for legacy data/UI context only. As of Phase 27, `lib/email/email-service.ts` is a compatibility adapter: it appends a canonical notification intent and never renders or sends an email.

Email, SMS and push delivery are owned exclusively by `lib/notifications`. Production providers are fail-closed until Phase 30 validation. See [Phase 27 research and implementation map](phase-27-research-and-implementation-map.md) for the migration boundary and audit.
