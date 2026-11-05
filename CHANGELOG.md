# Changelog

## 0.1.0 — 2026-11-05

First working version.

- Local-only detection: brand look-alikes, brand names on unrelated domains, cross-domain password forms, plain-HTTP logins, redirect chains, and URL-shape checks (IP host, `user@host`, punycode, long URLs).
- Toolbar popup with a risk score and the reasons; on-page warning banner.
- Verdicts persist in `chrome.storage.session`, so the popup survives a suspended service worker.
- Tested detection core (`node --test`, 17 tests) and a URL-only accuracy script.
