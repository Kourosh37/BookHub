import "../env";
import { spawn } from "node:child_process";
import { cpSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
const standalone = resolve(".next/standalone");
mkdirSync(resolve(standalone, ".next"), { recursive: true });
cpSync(".next/static", resolve(standalone, ".next/static"), {
  recursive: true,
});
cpSync("public", resolve(standalone, "public"), { recursive: true });
cpSync("openapi", resolve(standalone, "openapi"), { recursive: true });
const child = spawn(process.execPath, [resolve(standalone, "server.js")], {
  stdio: "inherit",
  windowsHide: true,
  env: {
    ...process.env,
    NODE_ENV: "production",
    HOSTNAME: "127.0.0.1",
    PORT: "3100",
    SMS_API_URL: "http://127.0.0.1:3101/send",
    AVATAR_UPLOAD_DIR: resolve("test-results/uploads"),
  },
});
child.on("exit", (code) => {
  process.exitCode = code ?? 1;
});
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.once(signal, () => child.kill(signal));
