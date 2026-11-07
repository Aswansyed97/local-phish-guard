// Runs inside each page. All it does is look at the login forms and hand that
// to the background worker. It decides nothing and talks to no server.
(function () {
  function collectForms() {
    const forms = [...document.forms].map((f) => {
      const hasPassword = !!f.querySelector('input[type="password"]');
      let action = f.getAttribute("action") || location.href;
      return { hasPassword, action };
    });
    return forms.filter((f) => f.hasPassword);
  }

  function report() {
    try {
      chrome.runtime.sendMessage({
        type: "PAGE_SIGNALS",
        pageUrl: location.href,
        forms: collectForms(),
      });
    } catch (e) {
      /* worker asleep or context gone; ignore */
    }
  }

  // Report once the page settles, and again if a login form appears late.
  report();
  const mo = new MutationObserver(() => {
    if (document.querySelector('input[type="password"]')) {
      report();
      mo.disconnect();
    }
  });
  mo.observe(document.documentElement, { childList: true, subtree: true });

  // Build the warning banner with safe DOM methods only. Reason text comes from
  // the core but can contain a domain taken from the page, so it is inserted as
  // text, never as HTML, to avoid any injection.
  // All banner styling lives inside a Shadow DOM so the host page's CSS (for
  // example a `button { width: 100% }` rule) can't reach in and break it.
  const BANNER_CSS = `
    .bar { position: fixed; top: 14px; left: 50%; transform: translateX(-50%);
      z-index: 2147483647; box-sizing: border-box; width: calc(100vw - 28px); max-width: 560px;
      background: #b3261e; color: #fff; font: 14px/1.5 system-ui,-apple-system,sans-serif;
      padding: 14px 16px 16px; border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,.28); }
    .head { display: flex; align-items: flex-start; gap: 10px; }
    .ic { font-size: 18px; flex: 0 0 auto; }
    .title { flex: 1 1 auto; min-width: 0; font-weight: 700; }
    .x { flex: 0 0 auto; white-space: nowrap; width: auto; background: rgba(255,255,255,.15);
      border: 1px solid rgba(255,255,255,.6); color: #fff; border-radius: 6px;
      padding: 3px 10px; cursor: pointer; font: 13px system-ui,sans-serif; }
    .sub { opacity: .92; margin: 8px 0 4px; font-size: 13px; }
    ul { margin: 0; padding-left: 22px; }
    li { margin: 3px 0; }
  `;

  function showBanner(verdict) {
    if (document.getElementById("phish-guard-banner")) return;
    const host = document.createElement("div");
    host.id = "phish-guard-banner";
    host.setAttribute("style", "all: initial;");
    const root = host.attachShadow({ mode: "open" });

    const style = document.createElement("style");
    style.textContent = BANNER_CSS;
    root.appendChild(style);

    const bar = document.createElement("div");
    bar.className = "bar";

    const head = document.createElement("div");
    head.className = "head";
    const ic = document.createElement("span");
    ic.className = "ic";
    ic.textContent = "⚠️";
    const title = document.createElement("span");
    title.className = "title";
    title.textContent = `PhishLens — likely phishing (risk ${verdict.score}/100)`;
    const close = document.createElement("button");
    close.className = "x";
    close.textContent = "Dismiss";
    close.addEventListener("click", () => host.remove());
    head.append(ic, title, close);
    bar.appendChild(head);

    const sub = document.createElement("div");
    sub.className = "sub";
    sub.textContent = "This page shows signs of a credential-stealing attempt:";
    bar.appendChild(sub);

    const list = document.createElement("ul");
    for (const s of verdict.signals) {
      const li = document.createElement("li");
      li.textContent = s.label; // text, never HTML
      list.appendChild(li);
    }
    bar.appendChild(list);

    root.appendChild(bar);
    document.documentElement.appendChild(host);
  }

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === "SHOW_WARNING") {
      showBanner(msg.verdict);
    } else if (msg.type === "REMOVE_WARNING") {
      const el = document.getElementById("phish-guard-banner");
      if (el) el.remove();
    }
  });
})();
