#!/usr/bin/env node

import { spawn } from "node:child_process";

const args = ["scripts/sync-cleaver-source-truth.mjs", "--apply"];
const exitCode = await new Promise((resolve, reject) => {
  const child = spawn(process.execPath, args, {
    cwd: process.cwd(),
    env: process.env,
    stdio: "inherit",
  });
  child.once("error", reject);
  child.once("exit", (code, signal) => {
    if (signal) reject(new Error(`Cleaver source-truth sync terminated by signal ${signal}.`));
    else resolve(code ?? 1);
  });
});

if (exitCode !== 0) process.exitCode = exitCode;
