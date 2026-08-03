import { spawnSync } from "node:child_process";
import path from "node:path";
import process from "node:process";

const npm = process.platform === "win32" ? process.execPath : "npm";
const npmPrefix = process.platform === "win32"
  ? [path.join(path.dirname(process.execPath), "node_modules", "npm", "bin", "npm-cli.js")]
  : [];
const npmGate = (args) => [npm, [...npmPrefix, ...args]];
const prismaGate = (args) => [process.execPath, [path.join("node_modules", "prisma", "build", "index.js"), ...args]];
const gates = [
  npmGate(["ci"]),
  prismaGate(["format"]),
  prismaGate(["validate"]),
  prismaGate(["generate"]),
  npmGate(["run", "migrations:check"]),
  npmGate(["run", "docker:doctor"]),
  npmGate(["run", "docker:config"]),
  npmGate(["run", "docker:db"]),
  npmGate(["run", "db:preflight"]),
  npmGate(["run", "lint"]),
  npmGate(["run", "typecheck"]),
  npmGate(["test"]),
  npmGate(["run", "test:coverage"]),
  npmGate(["run", "docker:migration-smoke"]),
  npmGate(["run", "docker:migrate"]),
  npmGate(["run", "docker:seed"]),
  npmGate(["run", "docker:seed"]),
  npmGate(["run", "docker:up"]),
  npmGate(["run", "docker:ps"]),
  npmGate(["run", "db:verify-schema"]),
  npmGate(["run", "db:verify-phase7.5"]),
  npmGate(["run", "test:integration:auth"]),
  npmGate(["run", "test:integration:permissions"]),
  npmGate(["run", "test:integration:orders"]),
  npmGate(["run", "test:integration:pricing"]),
  npmGate(["run", "test:integration:dispatch"]),
  npmGate(["run", "test:integration:cross-module"]),
  npmGate(["run", "build"]),
  npmGate(["run", "docker:build"]),
  npmGate(["run", "docker:smoke"]),
  npmGate(["run", "test:e2e"]),
  npmGate(["audit", "--omit=dev"]),
];

for (const [command, args] of gates) {
  console.log(`\n> ${command} ${args.join(" ")}`);
  const result = spawnSync(command, args, { stdio: "inherit", shell: false });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
