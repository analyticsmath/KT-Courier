# Phase 28 webhook endpoint security

Endpoints require HTTPS, no embedded credentials, no IP literals, no private/loopback/link-local destinations, and bounded URL length. DNS is validated before verification and delivery; redirects are never followed. Test-local adapters are deferred to Phase 30 integration execution.
