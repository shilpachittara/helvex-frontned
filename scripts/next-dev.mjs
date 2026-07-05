#!/usr/bin/env node
import { spawn } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { applyRootEnv, parsePort } from "./load-root-env.mjs";

applyRootEnv({ override: true });

const webPort = parsePort(process.env.WEB_PORT, 3001);
const webDir = join(dirname(fileURLToPath(import.meta.url)), "..");

const child = spawn("pnpm", ["exec", "next", "dev", "-p", String(webPort)], {
  cwd: webDir,
  stdio: "inherit",
  env: process.env,
});

child.on("exit", (code) => process.exit(code ?? 1));
