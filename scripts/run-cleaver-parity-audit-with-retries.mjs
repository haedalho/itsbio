#!/usr/bin/env node

import { spawn } from "node:child_process";

const attempts = Math.max(1, Math.min(5, Number.parseInt(process.env.CLEAVER_PARITY_AUDIT_ATTEMPTS || "3", 10) || 3));

function runAudit(attempt) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, ["scripts/audit-cleaver-source-parity.mjs"], {
      stdio: "inherit",
      env: { ...process.env, CLEAVER_PARITY_AUDIT_ATTEMPT: String(attempt) },
    });
    child.on("exit", (code, signal) => resolve({ code: code ?? 1, signal }));
    child.on("error", () => resolve({ code: 1, signal: null }));
  });
}

for (let attempt = 1; attempt <= attempts; attempt += 1) {
  console.log(`[Cleaver parity audit] attempt ${attempt}/${attempts}`);
  const result = await runAudit(attempt);
  if (result.code === 0) {
    console.log(`[Cleaver parity audit] passed on attempt ${attempt}/${attempts}`);
    process.exit(0);
  }
  if (attempt < attempts) {
    const delayMs = 15_000 * attempt;
    console.warn(`[Cleaver parity audit] attempt ${attempt} failed; retrying in ${delayMs / 1000}s`);
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
}

throw new Error(`Independent Cleaver parity audit failed after ${attempts} attempt(s).`);
