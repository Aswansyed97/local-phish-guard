# Local Phish Guard

A browser extension that flags likely phishing pages while you browse. Every check runs on your machine. The code makes no network calls, and there's a test that keeps it that way.

I built this to learn how phishing detection and browser extensions actually work. The detection rules sit in one small module with no browser code in it, so the rules I ship are the same ones the tests and the accuracy script run.

## What it looks like

When a page looks dangerous, a banner drops in at the top and says why:

![Warning banner on a fake login page](docs/screenshots/banner.png)

Click the toolbar icon for the page's risk score and the signals that fired:

![Popup showing the risk score and reasons](docs/screenshots/popup.png)

## What it checks

| Signal | Example | Weight |
|---|---|---|
| Domain spells a brand but isn't the brand | `paypa1.com`, `g00gle-mail.com` | high |
| Brand name on an unrelated domain | `paypal.com.secure-login.xyz` | high |
| Password form posts to a different domain | the login page sends your password somewhere else | high |
| Password form over plain HTTP | a login with no HTTPS | high |
| Redirect chain across several domains, or through a shortener | `bit.ly`, then two more hops, then `paypa1.com` | medium |
| Raw IP host, `@` in the URL, punycode, lots of subdomains, very long URL | `http://192.168.0.5/login` | low |

Each signal adds points to a score from 0 to 100. Below 30 it stays quiet. From 30 to 59 it puts a caution badge on the icon. At 60 or more it shows the banner.

## Layout

```
extension/          the extension itself (load this folder in the browser)
  core/detect.js    the detection rules, plain functions, no browser code
  core/brands.js    brands and their real domains
  background.js     tracks redirects, runs the rules, sets the badge
  content.js        reads login forms, draws the warning banner
  popup.js/.html    the toolbar popup
tests/              tests for the rules (node --test)
tools/evaluate.js   accuracy check over URL lists
data/               sample URL lists for the check
test-pages/         local pages to try it on safely
```

## Running the tests

```bash
npm test
```

## Checking the accuracy

```bash
npm run eval
```

Right now, against the sample lists:

```
Detection rate:  16/20  (80.0%)
False positives: 0/20   (0.0%)
```

Those lists are synthetic. I wrote them by hand to exercise the rules, so treat the numbers as a demo. For real ones, swap in a real feed (an OpenPhish or PhishTank export) and a list of common legit domains:

```bash
node tools/evaluate.js data/real-phishing.txt data/real-legit.txt
```

## Loading it in Brave or Chrome

1. Open `brave://extensions` or `chrome://extensions`.
2. Turn on Developer mode (top right).
3. Click Load unpacked and pick the `extension/` folder.
4. Open `test-pages/fake-login.html`. You should get a red banner.
5. Open `test-pages/safe-login.html`. Nothing should happen.

## What it doesn't do yet

- The accuracy numbers come from the synthetic samples, not a live feed. The approach is real, the data is a placeholder until I wire a feed in.
- The accuracy script only sees the URL. The redirect and form checks need a live page, so they help in the browser but don't count in `npm run eval`.
- It misses a few cases the sample run already shows: a brand name sitting only in the URL path (`192.168.0.5/paypal/login`), the `user@host` trick, punycode domains (I don't decode those yet), and short brand names like `dhl` that I skip on purpose so they don't match inside ordinary words.
- Domain parsing uses a short built-in suffix list instead of the full Public Suffix List, so a few uncommon multi-part TLDs get grouped wrong.
- The weights are hand-set, not trained. A small trained model is the next thing I want to try.

## Privacy

Everything runs in the browser against local data. No `fetch`, no `XMLHttpRequest`, no server.
