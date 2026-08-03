# Storefront privacy and security

Public APIs use bounded query parsers, parameterised PostgreSQL access, rate
limits, safe generic 404/error responses and a whitelist cache policy. Telemetry
has a retention deadline and may store only coarse query category, count, filter
codes, anonymous target, latency/index version and coarse service area; it cannot
influence ranking. Raw query text, IPs, addresses, coordinates, contacts and
tokens are excluded.

