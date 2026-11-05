# Local Phish Guard

A browser extension that flags likely phishing pages in real time, using **local rules only**. No browsing data ever leaves the browser — there are no network calls in the code, and a test enforces that claim.

Built as a learning project. The detection logic is a separate, tested module so the exact code that runs in the browser is the code measured in the evaluation.

## What it checks

| Signal | Example | Weight |
|---|---|---|
| Domain spells a brand but isn't the brand | `paypa1.com`, `g00gle-mail.com` | high |
| Brand name on an unrelated domain | `paypal.com.secure-login.xyz` | high |
| Password form posts to a different domain | login page sends your password elsewhere | high |
| Password form over plain HTTP | — | high |
| Redirect chain across several domains / via a shortener | `bit.ly → … → paypa1.com` | medium |
| Raw IP host, `@` in URL, punycode, many subdomains, very long URL | `http://192.168.0.5/login` | low |

Signals are summed into a 0–100 score: under 30 is silent, 30–59 shows a caution badge, 60+ shows an on-page warning with the reasons.

## Project layout

```
extension/          the loadable extension (load this folder in the browser)
  core/detect.js    detection rules — pure functions, no browser APIs
  core/brands.js    known brands and their real domains
  background.js     tracks redirects, runs the core, sets the badge
  content.js        reads login forms on the page; shows the warning banner
  popup.js/.html    shows the current page's verdict
tests/              unit tests for the core (node --test)
tools/evaluate.js   accuracy evaluation over URL lists
data/               sample URL lists for the evaluation
test-pages/         local HTML pages to try the extension safely
```

## Run the tests

```bash
npm test
```

## Run the accuracy evaluation

```bash
npm run eval
```

Current result on the bundled **synthetic** sample lists:

```
Detection rate:  16/20  (80.0%)
False positives: 0/20   (0.0%)
```

To measure real-world accuracy, replace the sample files with a real feed (for example an OpenPhish or PhishTank export) and a list of popular legitimate domains:

```bash
node tools/evaluate.js data/real-phishing.txt data/real-legit.txt
```

## Load it in a browser (Chromium / Brave / Chrome)

1. Open `brave://extensions` (or `chrome://extensions`).
2. Turn on **Developer mode** (top right).
3. Click **Load unpacked** and select the `extension/` folder.
4. Open `test-pages/fake-login.html` — you should see a red warning banner.
5. Open `test-pages/safe-login.html` — no warning.

## Limitations (honest list)

- **The accuracy numbers above use synthetic sample data**, not a live feed. The method is real; the dataset is illustrative until a real feed is plugged in.
- **The evaluation is URL-only.** Redirect-chain and form signals need a live page, so they raise accuracy in the browser but are not counted in `npm run eval`.
- **Known misses** (shown by the evaluation): a brand name that appears only in the URL *path* (`192.168.0.5/paypal/login`), the `user@host` trick, punycode domains (not decoded yet), and very short brand names like `dhl` (deliberately not substring-matched, to avoid false positives).
- **Domain parsing uses a short built-in suffix list**, not the full Public Suffix List, so a few uncommon multi-part TLDs may be grouped wrong.
- Rule weights are hand-set, not learned. A small trained model is planned as a follow-up ("approach B").

## Privacy

Every check runs in the browser against local data. The code makes no `fetch`/`XMLHttpRequest` calls and contacts no server.
