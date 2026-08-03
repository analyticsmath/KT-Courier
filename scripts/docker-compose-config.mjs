import { composeArgs, composeEnv, runDocker, safeError, safeLog } from "./docker-common.mjs";

const result = runDocker(composeArgs(["config"]), { env: composeEnv() });

if (result.stdout) safeLog(result.stdout);
if (result.stderr) safeError(result.stderr);

process.exit(result.status ?? 1);
