# Dependency security disposition

On 12 October 2026, `npm audit --omit=dev --audit-level=high` reported no production dependency findings. The full development toolchain audit reported five HIGH paths involving `braces@3.0.3`; the reviewed GitHub advisory is [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm). At review time it had no patched version; npm's proposed major framework/tool downgrade is incompatible with this Next 16 project and was not applied.

The affected chain is part of development/build tooling and is not shipped as a production runtime dependency under the lockfile classification used by the production-only audit. Keep the lockfile unchanged until a compatible upstream patch is available, then update and rerun the full audit and exact-source build. Recheck the advisory before release because its remediation status can change.
