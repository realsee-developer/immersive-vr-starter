import { spawn } from "node:child_process";

const processes = [
  spawn(
    process.execPath,
    ["--env-file-if-exists=.env", "--watch", "server/index.ts"],
    {
      stdio: "inherit",
      env: { ...process.env, REALSEE_STARTER_DEV: "1" },
    }
  ),
  spawn(process.execPath, ["node_modules/vite/bin/vite.js"], {
    stdio: "inherit",
  }),
];
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  process.exitCode = code;
  for (const child of processes) child.kill("SIGTERM");
}
for (const child of processes) {
  child.on("error", () => stop(1));
  child.on("exit", (code) => stop(code || 0));
}
process.on("SIGINT", () => stop());
process.on("SIGTERM", () => stop());
