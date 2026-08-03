import { runPhase27Processor } from "./phase27-processor-cli.mjs";
// This only validates canonical processor composition; PostgreSQL integration is scaffolded and deferred to Phase 30.
runPhase27Processor("integration");
