import { composeArgs, composeEnv, runDocker } from "./docker-common.mjs";

const args = process.argv.slice(2);

if (args.length === 0) {
  console.error("Usage: node scripts/docker-compose-run.mjs <docker compose args...>");
  process.exit(1);
}

const result = runDocker(composeArgs(args), {
  stdio: "inherit",
  encoding: "utf8",
  env: composeEnv(),
});
process.exit(result.status ?? 1);
