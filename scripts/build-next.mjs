import { spawn } from "node:child_process";

// NODE_OPTIONS reaches Next's TypeScript subprocess as well as the parent.
// A parent-only Node flag leaves that subprocess at its default heap limit.
const options = process.env.NODE_OPTIONS ?? "";
const nodeOptions = /--max[-_]old[-_]space[-_]size(?:=|\s)/.test(options)
  ? options
  : `${options} --max-old-space-size=4096`.trim();
const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "build", ...process.argv.slice(2)], {
  stdio: "inherit", env: { ...process.env, NODE_OPTIONS: nodeOptions },
});
child.on("error", () => { process.exitCode = 1; });
child.on("exit", (code) => { process.exitCode = code ?? 1; });
