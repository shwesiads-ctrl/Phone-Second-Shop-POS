import { spawn } from "node:child_process";
import { createServer } from "vite";
await import("./build.mjs");
const server = await createServer();
await server.listen();
const child = spawn(
  process.execPath,
  ["node_modules/electron/cli.js", ".", ...process.argv.slice(2)],
  {
    stdio: "inherit",
    env: { ...process.env, POS_DEV: "1" },
  },
);
child.on("exit", async (code) => {
  await server.close();
  process.exit(code ?? 1);
});
process.on("SIGINT", () => child.kill());
