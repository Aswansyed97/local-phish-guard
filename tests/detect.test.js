import { test } from "node:test";
import assert from "node:assert/strict";
import {
  registrableDomain, normalizeConfusables, levenshtein,
  brandSignals, structuralSignals, formSignals, redirectSignals,
  analyzeUrl, analyze, scoreToLevel,
} from "../extension/core/detect.js";

test("registrableDomain handles plain and multi-part suffixes", () => {
  assert.equal(registrableDomain("www.paypal.com"), "paypal.com");
  assert.equal(registrableDomain("login.secure.paypal.com"), "paypal.com");
  assert.equal(registrableDomain("foo.bbc.co.uk"), "bbc.co.uk");
  assert.equal(registrableDomain("paypal.com"), "paypal.com");
});

test("normalizeConfusables folds common tricks", () => {
  assert.equal(normalizeConfusables("paypa1"), "paypal");
  assert.equal(normalizeConfusables("g00gle"), "google");
  assert.equal(normalizeConfusables("arnazon"), "amazon"); // rn -> m
});

test("levenshtein basic distances", () => {
  assert.equal(levenshtein("paypal", "paypal"), 0);
  assert.equal(levenshtein("paypol", "paypal"), 1);
});

test("real brand domains produce no brand signal", () => {
  assert.deepEqual(brandSignals("www.paypal.com"), []);
  assert.deepEqual(brandSignals("accounts.google.com"), []);
  assert.deepEqual(brandSignals("signin.aws.amazon.com"), []);
});

test("lookalike domain is flagged high", () => {
  const s = brandSignals("paypa1.com");
  assert.ok(s.length > 0);
  assert.ok(s[0].points >= 45);
});

test("brand name on an unrelated domain is flagged", () => {
  const s = brandSignals("paypal.com.secure-login.xyz");
  assert.ok(s.some((x) => x.id === "brand-unrelated"));
});

test("structural signals: IP host and @ symbol", () => {
  const ids = structuralSignals("http://192.168.0.5/login").map((s) => s.id);
  assert.ok(ids.includes("ip-host"));
  const at = structuralSignals("http://example.com@evil.test/").map((s) => s.id);
  assert.ok(at.includes("at-symbol"));
});

test("cross-domain password form is flagged", () => {
  const s = formSignals("https://my-shop.test/login", [
    { hasPassword: true, action: "https://collector.evil.test/steal" },
  ]);
  assert.ok(s.some((x) => x.id === "form-cross-domain"));
});

test("same-domain password form is not flagged", () => {
  const s = formSignals("https://my-shop.test/login", [
    { hasPassword: true, action: "https://my-shop.test/auth" },
  ]);
  assert.equal(s.length, 0);
});

test("redirect across several domains is flagged", () => {
  const s = redirectSignals([
    "http://bit.ly/x", "http://a.test/", "http://paypa1.com/login",
  ]);
  assert.ok(s.some((x) => x.id === "redirect-chain"));
  assert.ok(s.some((x) => x.id === "redirect-shortener"));
});

test("analyzeUrl scores a legit site at ok", () => {
  const v = analyzeUrl("https://www.paypal.com/signin");
  assert.equal(v.level, "ok");
  assert.equal(v.score, 0);
});

test("analyze combines signals and caps at 100", () => {
  const v = analyze({
    url: "http://paypa1.com@192.168.0.9/login",
    redirectChain: ["http://bit.ly/x", "http://a.test/", "http://paypa1.com/"],
    forms: [{ hasPassword: true, action: "http://collector.evil.test/x" }],
  });
  assert.ok(v.score <= 100);
  assert.equal(v.level, "warn");
});

test("scoreToLevel thresholds", () => {
  assert.equal(scoreToLevel(0), "ok");
  assert.equal(scoreToLevel(30), "caution");
  assert.equal(scoreToLevel(60), "warn");
});

// --- known gaps: lock in intended behaviour -------------------------------

test("user@host decoy pushes the URL to a warning", () => {
  const v = analyzeUrl("http://secure.apple.com@phish-collector.test/verify");
  assert.ok(v.signals.some((s) => s.id === "userinfo-decoy"));
  assert.equal(v.level, "warn");
});

test("a brand word in the PATH of a real brand site is not flagged (no false positive)", () => {
  // amazon.com is legitimate; a brand word later in the path must not trip it.
  const v = analyzeUrl("https://www.amazon.com/paypal-vs-stripe-comparison");
  assert.equal(v.level, "ok");
});

test("punycode domains are flagged, even though we do not decode them yet", () => {
  const v = analyzeUrl("http://xn--pypal-4ve.com/login");
  assert.ok(v.signals.some((s) => s.id === "punycode"));
});

test("multi-part suffixes resolve to the right registrable domain", () => {
  assert.equal(registrableDomain("mail.google.co.uk"), "google.co.uk");
  assert.equal(registrableDomain("a.b.example.com.au"), "example.com.au");
});
