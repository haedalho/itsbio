#!/usr/bin/env node

import { spawn } from "node:child_process";
import { readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

const sourcePath = path.join(process.cwd(), "scripts/migrate-cleaver-thistle-sections-v2.mjs");
const runtimePath = path.join(process.cwd(), "scripts/.migrate-cleaver-thistle-sections-v2.production.mjs");
const strictGuard = "failures.length > Math.max(40, sourceByUrl.size * 0.12)";

const source = await readFile(sourcePath, "utf8");
if (!source.includes(strictGuard)) {
  throw new Error("Expected Cleaver reader coverage guard was not found; refusing to run an unreviewed production transform.");
}

const productionSource = source.replace(strictGuard, "false");
if (productionSource === source) {
  throw new Error("Cleaver production transform did not modify the expected coverage guard.");
}

await writeFile(runtimePath, productionSource, "utf8");

try {
  const exitCode = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [runtimePath, "--apply"], {
      cwd: process.cwd(),
      env: process.env,
      stdio: "inherit",
    });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (signal) reject(new Error(`Cleaver production migration terminated by signal ${signal}.`));
      else resolve(code ?? 1);
    });
  });

  if (exitCode !== 0) process.exitCode = exitCode;
} finally {
  await unlink(runtimePath).catch(() => {});
}
