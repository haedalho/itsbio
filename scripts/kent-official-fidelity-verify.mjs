#!/usr/bin/env node

console.error(
  [
    "Disabled: this verifier used approximate text similarity and optional live Kent requests.",
    "It cannot prove exact content fidelity and is not an approved Kent workflow.",
    "Run: npm run kent:exact:verify",
    "Strict gate: npm run kent:exact:verify:strict",
  ].join("\n"),
);

process.exit(1);
