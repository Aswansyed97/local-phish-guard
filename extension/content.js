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
  // A full-page warning overlay, styled inside a Shadow DOM so the host page's
  // CSS can't reach in and break it. It warns but does not block: "Continue
  // anyway" dismisses it.
  const BANNER_CSS = `
    :host { all: initial; }
    .backdrop { position: fixed; inset: 0; z-index: 2147483647; display: flex;
      align-items: center; justify-content: center; padding: 20px; box-sizing: border-box;
      font: 14px/1.5 system-ui,-apple-system,sans-serif; color: #1b1b1f;
      background: radial-gradient(1200px 600px at 50% -10%, rgba(179,38,30,.38), rgba(8,8,10,.68));
      backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px); animation: pg-fade .18s ease-out; }
    @keyframes pg-fade { from { opacity: 0 } to { opacity: 1 } }
    @keyframes pg-pop { from { opacity: 0; transform: translateY(10px) scale(.97) } to { opacity: 1; transform: none } }
    .card { box-sizing: border-box; width: min(460px, calc(100vw - 40px)); background: #fff;
      border-radius: 16px; overflow: hidden; box-shadow: 0 24px 60px rgba(0,0,0,.45);
      animation: pg-pop .22s cubic-bezier(.2,.8,.2,1); }
    .hd { background: linear-gradient(135deg, #c62828, #861111); color: #fff;
      padding: 20px 22px; display: flex; gap: 14px; align-items: center; }
    .shield { flex: 0 0 auto; width: 46px; height: 46px; border-radius: 50%;
      background: rgba(255,255,255,.16); display: flex; align-items: center; justify-content: center; font-size: 25px; }
    .hd .t { font-size: 17px; font-weight: 700; line-height: 1.25; }
    .hd .s { font-size: 12.5px; opacity: .92; margin-top: 3px; }
    .body { padding: 18px 22px 4px; }
    .pill { display: inline-block; font-size: 12px; font-weight: 600; color: #b3261e;
      background: #fdecea; border-radius: 999px; padding: 4px 11px; margin-bottom: 12px; }
    .reasons { list-style: none; margin: 0; padding: 0; }
    .reasons li { display: flex; gap: 10px; align-items: flex-start; padding: 9px 0; border-top: 1px solid #eef0f3; }
    .reasons li:first-child { border-top: 0; }
    .reasons .dot { flex: 0 0 auto; width: 8px; height: 8px; border-radius: 50%; background: #c62828; margin-top: 6px; }
    .acts { display: flex; gap: 10px; padding: 16px 22px 10px; }
    .btn { flex: 1 1 auto; text-align: center; padding: 11px 14px; border-radius: 10px;
      font: inherit; font-weight: 600; cursor: pointer; border: 1px solid transparent; }
    .btn.primary { background: #b3261e; color: #fff; }
    .btn.primary:hover { background: #9b2019; }
    .btn.ghost { background: #fff; color: #555; border-color: #dfe2e7; }
    .btn.ghost:hover { background: #f6f7f9; }
    .foot { text-align: center; font-size: 11px; color: #8b8f98; padding: 2px 22px 16px; }
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

    const backdrop = document.createElement("div");
    backdrop.className = "backdrop";
    const card = document.createElement("div");
    card.className = "card";

    const hd = document.createElement("div");
    hd.className = "hd";
    const shield = document.createElement("div");
    shield.className = "shield";
    shield.textContent = "🛡️"; // shield
    const hdText = document.createElement("div");
    const t = document.createElement("div");
    t.className = "t";
    t.textContent = "This site looks like a phishing attempt";
    const s = document.createElement("div");
    s.className = "s";
    s.textContent = "It may be trying to steal your password or personal details.";
    hdText.append(t, s);
    hd.append(shield, hdText);
    card.appendChild(hd);

    const body = document.createElement("div");
    body.className = "body";
    const pill = document.createElement("span");
    pill.className = "pill";
    pill.textContent = `PhishLens risk ${verdict.score} / 100`;
    body.appendChild(pill);
    const reasons = document.createElement("ul");
    reasons.className = "reasons";
    for (const sig of verdict.signals) {
      const li = document.createElement("li");
      const dot = document.createElement("span");
      dot.className = "dot";
      const label = document.createElement("span");
      label.textContent = sig.label; // text, never HTML
      li.append(dot, label);
      reasons.appendChild(li);
    }
    body.appendChild(reasons);
    card.appendChild(body);

    const acts = document.createElement("div");
    acts.className = "acts";
    const back = document.createElement("button");
    back.className = "btn primary";
    back.textContent = "← Go back to safety";
    back.addEventListener("click", () => {
      if (history.length > 1) history.back();
      else location.replace("about:blank");
    });
    const cont = document.createElement("button");
    cont.className = "btn ghost";
    cont.textContent = "Continue anyway";
    cont.addEventListener("click", () => host.remove());
    acts.append(back, cont);
    card.appendChild(acts);

    const foot = document.createElement("div");
    foot.className = "foot";
    foot.textContent = "PhishLens · all checks ran locally in your browser";
    card.appendChild(foot);

    backdrop.appendChild(card);
    root.appendChild(backdrop);
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
