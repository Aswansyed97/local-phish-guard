// Accuracy evaluation. Runs the URL-only detector over a list of phishing-style
// URLs and a list of known-legitimate URLs, then reports detection rate and
// false-positive rate at the warn threshold.
//
// URL-only: redirect and form signals need a live browser, so they are not
// measured here. The README states this limit.
//
// Usage:
//   node tools/evaluate.js                       (uses the bundled sample lists)
//   node tools/evaluate.js phishing.txt legit.txt (your own lists, one URL per line)
import { readFileSync } from "node:fs";
import { analyzeUrl, scoreToLevel } from "../extension/core/detect.js";

const phishPath = process.argv[2] || new URL("../data/sample-phishing.txt", import.meta.url);
const legitPath = process.argv[3] || new URL("../data/sample-legit.txt", import.meta.url);

function load(p) {
  return readFileSync(p, "utf8")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"));
}

const phishing = load(phishPath);
const legit = load(legitPath);

const WARN = 60;
let caught = 0;
const missed = [];
for (const u of phishing) {
  const v = analyzeUrl(u);
  if (v.score >= WARN) caught++;
  else missed.push([u, v.score]);
}
let falsePos = 0;
const flaggedLegit = [];
for (const u of legit) {
  const v = analyzeUrl(u);
  if (v.score >= WARN) { falsePos++; flaggedLegit.push([u, v.score]); }
}

const pct = (n, d) => (d ? ((100 * n) / d).toFixed(1) : "0.0");

console.log("\n=== Local Phish Guard — URL-only evaluation (threshold: score >= 60) ===\n");
console.log(`Dataset:         ${phishPath === undefined ? "" : ""}${String(phishPath).includes("sample") ? "bundled synthetic sample (hand-written, not a live feed)" : "custom lists"}`);
console.log(`Phishing URLs:   ${phishing.length}`);
console.log(`Legit URLs:      ${legit.length}\n`);
console.log(`Detection rate:  ${caught}/${phishing.length}  (${pct(caught, phishing.length)}%)`);
console.log(`False positives: ${falsePos}/${legit.length}  (${pct(falsePos, legit.length)}%)\n`);

if (missed.length) {
  console.log("Missed phishing (score below 60):");
  for (const [u, s] of missed) console.log(`  [${s}] ${u}`);
  console.log("");
}
if (flaggedLegit.length) {
  console.log("Wrongly flagged legit sites:");
  for (const [u, s] of flaggedLegit) console.log(`  [${s}] ${u}`);
  console.log("");
}
