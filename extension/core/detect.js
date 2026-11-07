// The detection rules. No browser APIs here, so the tests and the eval script
// run the same code the extension does.
import { BRANDS, SHORTENERS } from "./brands.js";

// Enough multi-part suffixes to get bbc.co.uk right instead of reading it as
// co.uk. Not the full Public Suffix List (see the README).
const MULTI_SUFFIX = new Set([
  "co.uk", "org.uk", "gov.uk", "ac.uk", "com.au", "net.au", "org.au",
  "co.jp", "co.nz", "co.in", "com.br", "co.za", "com.mx", "com.sg", "com.tr",
]);

export function registrableDomain(hostname) {
  if (!hostname) return "";
  const host = hostname.toLowerCase().replace(/\.$/, "");
  const parts = host.split(".").filter(Boolean);
  if (parts.length <= 2) return host;
  const last2 = parts.slice(-2).join(".");
  if (MULTI_SUFFIX.has(last2)) return parts.slice(-3).join(".");
  return last2;
}

// Fold the usual look-alike tricks back to plain ascii, so paypa1 and a
// Cyrillic-a pаypal both land near paypal.
export function normalizeConfusables(s) {
  return s
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[а]/g, "a") // Cyrillic a
    .replace(/[е]/g, "e") // Cyrillic e
    .replace(/[о]/g, "o") // Cyrillic o
    .replace(/[р]/g, "p") // Cyrillic r -> p
    .replace(/[с]/g, "c") // Cyrillic s -> c
    .replace(/[х]/g, "x") // Cyrillic h -> x
    .replace(/0/g, "o")
    .replace(/1/g, "l")
    .replace(/3/g, "e")
    .replace(/5/g, "s")
    .replace(/7/g, "t")
    .replace(/rn/g, "m")
    .replace(/vv/g, "w");
}

// RFC 3492 punycode decoder, so an `xn--` label can be read as the real
// Unicode it stands for. That lets the brand check see a look-alike hidden in
// punycode (xn--pypal-4ve -> "pаypal" -> paypal) instead of missing it.
function punyAdapt(delta, numPoints, first) {
  const base = 36, tmin = 1, tmax = 26, skew = 38, damp = 700;
  delta = first ? Math.floor(delta / damp) : delta >> 1;
  delta += Math.floor(delta / numPoints);
  let k = 0;
  while (delta > ((base - tmin) * tmax) >> 1) { delta = Math.floor(delta / (base - tmin)); k += base; }
  return k + Math.floor(((base - tmin + 1) * delta) / (delta + skew));
}

function punyDecode(input) {
  const base = 36, tmin = 1, tmax = 26, initialBias = 72, initialN = 128;
  const output = [];
  let n = initialN, bias = initialBias, i = 0;
  const lastDash = input.lastIndexOf("-");
  const basic = lastDash < 0 ? 0 : lastDash;
  for (let k = 0; k < basic; k++) output.push(input.charCodeAt(k));
  let ii = basic > 0 ? basic + 1 : 0;
  while (ii < input.length) {
    const oldi = i;
    let w = 1;
    for (let k = base; ; k += base) {
      if (ii >= input.length) return null;
      const c = input.charCodeAt(ii++);
      let digit;
      if (c >= 48 && c <= 57) digit = c - 48 + 26;
      else if (c >= 65 && c <= 90) digit = c - 65;
      else if (c >= 97 && c <= 122) digit = c - 97;
      else return null;
      i += digit * w;
      const t = k <= bias ? tmin : (k >= bias + tmax ? tmax : k - bias);
      if (digit < t) break;
      w *= base - t;
    }
    const outLen = output.length + 1;
    bias = punyAdapt(i - oldi, outLen, oldi === 0);
    n += Math.floor(i / outLen);
    i %= outLen;
    output.splice(i, 0, n);
    i++;
  }
  try { return String.fromCodePoint(...output); } catch { return null; }
}

// A single hostname label, with any `xn--` punycode decoded to Unicode.
export function decodeLabel(label) {
  if (!label.startsWith("xn--")) return label;
  const decoded = punyDecode(label.slice(4));
  return decoded || label;
}

export function levenshtein(a, b) {
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...new Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[m][n];
}

const sig = (id, label, points) => ({ id, label, points });

// Brand-lookalike checks. Returns zero or more signals.
export function brandSignals(hostname) {
  const out = [];
  const reg = registrableDomain(hostname);
  const labels = hostname.toLowerCase().split(".").filter(Boolean);
  const sld = reg.split(".")[0] || "";
  const normSld = normalizeConfusables(decodeLabel(sld));

  for (const brand of BRANDS) {
    const isLegit = brand.legit.includes(reg);
    if (isLegit) return []; // genuine brand site: trust it, emit nothing.

    for (const token of brand.tokens) {
      // A domain whose main label spells a brand, on a site that isn't the
      // brand, is about as clear as phishing gets, so it scores high alone.
      if (normSld === token) {
        out.push(sig("lookalike-exact", `Domain name spells "${brand.name}" but this is not an official ${brand.name} site`, 70));
        return out;
      }
      if (sld.length >= 5 && levenshtein(normSld, token) === 1) {
        out.push(sig("lookalike-typo", `Domain looks like "${brand.name}" with a small change`, 70));
        return out;
      }
      // Brand name hidden in a subdomain or combined label on an unrelated domain,
      // e.g. paypal.com.secure-login.xyz or paypal-login.xyz. Only for tokens of
      // 4+ characters, so short names like "dhl" can't substring-match common words.
      if (token.length >= 4) {
        const inSubdomain = labels.slice(0, -2).some((l) => normalizeConfusables(decodeLabel(l)).includes(token));
        const inSld = normSld.includes(token) && normSld !== token;
        if (inSubdomain || inSld) {
          out.push(sig("brand-unrelated", `Uses the name "${brand.name}" on an unrelated domain (${reg})`, 60));
          return out;
        }
      }
    }
  }
  return out;
}

// True when a string contains a known brand name, after folding look-alikes.
function hasBrandToken(s) {
  const n = normalizeConfusables(s);
  return BRANDS.some((b) => b.tokens.some((t) => n.includes(t)));
}

// URL-shape checks that do not need a brand.
export function structuralSignals(urlString) {
  const out = [];
  let u;
  try { u = new URL(urlString); } catch { return out; }
  const host = u.hostname;

  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) out.push(sig("ip-host", "Address is a raw IP, not a domain name", 35));
  if (u.href.includes("@")) out.push(sig("at-symbol", 'URL contains "@", which can hide the real destination', 35));
  // The "user@host" trick: the part before @ is a decoy and the real host is
  // after it. Flag it harder when the decoy looks like a domain or a brand,
  // which pushes the classic secure.apple.com@evil.test case over the line.
  if (u.username && (u.username.includes(".") || hasBrandToken(u.username))) {
    out.push(sig("userinfo-decoy", `The text before "@" looks like a real address, but the site is actually ${host}`, 30));
  }
  if (host.split(".").some((l) => l.startsWith("xn--"))) out.push(sig("punycode", "Domain uses punycode, often used to fake letters", 30));
  const subCount = host.split(".").length - 2;
  if (subCount >= 4) out.push(sig("many-subdomains", "Unusually many subdomains", 10));
  if (u.href.length > 100) out.push(sig("long-url", "URL is very long", 10));
  return out;
}

const LOOPBACK = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

// Signals that depend on the login form, from the content script.
export function formSignals(pageUrl, forms = []) {
  const out = [];
  let pageReg = "";
  try { pageReg = registrableDomain(new URL(pageUrl).hostname); } catch { /* ignore */ }
  for (const f of forms) {
    if (!f.hasPassword) continue;
    let actionReg = pageReg, actionProto = "https:", actionHost = "";
    try {
      const a = new URL(f.action, pageUrl);
      actionReg = registrableDomain(a.hostname);
      actionProto = a.protocol;
      actionHost = a.hostname;
    } catch { /* ignore */ }
    if (actionReg && actionReg !== pageReg) {
      out.push(sig("form-cross-domain", `A password form sends your login to a different site (${actionReg})`, 50));
    }
    // Plain-HTTP password form, except on a local dev address (loopback), which
    // is normal during development and would otherwise be a false positive.
    if (actionProto === "http:" && !LOOPBACK.has(actionHost)) {
      out.push(sig("form-http", "A password form sends data over unencrypted HTTP", 40));
    }
  }
  return out;
}

// Redirect-chain checks, from the background worker.
export function redirectSignals(chain = []) {
  const out = [];
  if (!Array.isArray(chain) || chain.length === 0) return out;
  const regs = chain.map((h) => { try { return registrableDomain(new URL(h).hostname); } catch { return ""; } });
  const distinct = new Set(regs.filter(Boolean));
  if (distinct.size >= 3) out.push(sig("redirect-chain", `Page redirected across ${distinct.size} different domains before loading`, 30));
  if ([...distinct].some((d) => SHORTENERS.has(d))) out.push(sig("redirect-shortener", "Reached through a link shortener", 15));
  return out;
}

export function scoreToLevel(score) {
  if (score >= 60) return "warn";
  if (score >= 30) return "caution";
  return "ok";
}

// URL-only verdict. Used by the evaluation tool, where we only have the URL string.
export function analyzeUrl(urlString) {
  let host = "";
  try { host = new URL(urlString).hostname; } catch { /* ignore */ }
  const signals = [...brandSignals(host), ...structuralSignals(urlString)];
  const score = Math.min(100, signals.reduce((s, x) => s + x.points, 0));
  return { url: urlString, score, level: scoreToLevel(score), signals };
}

// Full verdict. Used inside the extension, where we also have redirects and forms.
export function analyze({ url, redirectChain = [], forms = [] }) {
  let host = "";
  try { host = new URL(url).hostname; } catch { /* ignore */ }
  const signals = [
    ...brandSignals(host),
    ...structuralSignals(url),
    ...redirectSignals(redirectChain),
    ...formSignals(url, forms),
  ];
  const score = Math.min(100, signals.reduce((s, x) => s + x.points, 0));
  return { url, score, level: scoreToLevel(score), signals };
}
