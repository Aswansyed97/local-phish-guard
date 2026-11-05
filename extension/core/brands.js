// Brands the detector knows about, with the domains that are legitimately theirs.
// "tokens" are the words a lookalike domain tries to imitate.
// "legit" are registrable domains (eTLD+1) that are the real brand and must never be flagged.
export const BRANDS = [
  { name: "PayPal",       tokens: ["paypal"],            legit: ["paypal.com", "paypal.me"] },
  { name: "Apple",        tokens: ["apple", "icloud"],   legit: ["apple.com", "icloud.com"] },
  { name: "Google",       tokens: ["google", "gmail"],   legit: ["google.com", "gmail.com", "googlemail.com", "youtube.com"] },
  { name: "Microsoft",    tokens: ["microsoft", "office365", "outlook"], legit: ["microsoft.com", "office.com", "live.com", "outlook.com", "microsoftonline.com"] },
  { name: "Amazon",       tokens: ["amazon"],            legit: ["amazon.com", "amazon.co.uk", "amazon.in", "aws.amazon.com"] },
  { name: "Facebook",     tokens: ["facebook"],          legit: ["facebook.com", "fb.com"] },
  { name: "Instagram",    tokens: ["instagram"],         legit: ["instagram.com"] },
  { name: "Netflix",      tokens: ["netflix"],           legit: ["netflix.com"] },
  { name: "LinkedIn",     tokens: ["linkedin"],          legit: ["linkedin.com"] },
  { name: "WhatsApp",     tokens: ["whatsapp"],          legit: ["whatsapp.com"] },
  { name: "Bank of America", tokens: ["bankofamerica", "bofa"], legit: ["bankofamerica.com"] },
  { name: "Wells Fargo",  tokens: ["wellsfargo"],        legit: ["wellsfargo.com"] },
  { name: "Chase",        tokens: ["chase"],             legit: ["chase.com"] },
  { name: "Coinbase",     tokens: ["coinbase"],          legit: ["coinbase.com"] },
  { name: "Binance",      tokens: ["binance"],           legit: ["binance.com"] },
  { name: "DHL",          tokens: ["dhl"],               legit: ["dhl.com"] },
  { name: "FedEx",        tokens: ["fedex"],             legit: ["fedex.com"] },
  { name: "Steam",        tokens: ["steam", "steamcommunity"], legit: ["steampowered.com", "steamcommunity.com"] },
];

// Known URL shorteners — a redirect through one of these is worth a small flag.
export const SHORTENERS = new Set([
  "bit.ly", "tinyurl.com", "t.co", "goo.gl", "ow.ly", "is.gd", "buff.ly",
  "cutt.ly", "rebrand.ly", "shorturl.at", "rb.gy", "t.ly",
]);
