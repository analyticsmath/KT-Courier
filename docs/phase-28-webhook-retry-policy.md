# Phase 28 webhook retry policy

Delivery is at least once. 2xx succeeds; 408, 425, 429 and 5xx retry with bounded exponential backoff and jitter. 410 disables the endpoint. Redirects and unsafe destinations are permanent failures. Manual retry cannot change a payload.
