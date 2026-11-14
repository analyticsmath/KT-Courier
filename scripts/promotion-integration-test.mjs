#!/usr/bin/env node
import { spawnSync } from "node:child_process";

// The supported host runner provisions its own isolated PostgreSQL instance,
// applies migrations, runs the closure suite including the promotion flow,
// rejects skipped tests, and destroys the disposable database afterward.
if (process.argv.length !== 2) throw new Error("Usage: node scripts/promotion-integration-test.mjs");
const result = spawnSync(process.execPath, ["scripts/disposable-closure-host.mjs"], { stdio: "inherit", env: process.env });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
