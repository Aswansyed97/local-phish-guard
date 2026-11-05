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
  function showBanner(verdict) {
    if (document.getElementById("phish-guard-banner")) return;
    const bar = document.createElement("div");
    bar.id = "phish-guard-banner";
    Object.assign(bar.style, {
      position: "fixed", top: "14px", left: "50%", transform: "translateX(-50%)",
      zIndex: "2147483647", width: "min(560px, calc(100% - 28px))",
      background: "#b3261e", color: "#fff",
      font: "14px/1.5 system-ui,-apple-system,sans-serif",
      padding: "14px 16px 16px", borderRadius: "12px",
      boxShadow: "0 10px 30px rgba(0,0,0,.28)",
    });

    const head = document.createElement("div");
    Object.assign(head.style, { display: "flex", alignItems: "center", gap: "10px", fontWeight: "700" });
    const mark = document.createElement("span");
    mark.textContent = "⚠️";
    mark.style.fontSize = "18px";
    const title = document.createElement("span");
    title.textContent = `Phish Guard — likely phishing (risk ${verdict.score}/100)`;
    head.append(mark, title);
    bar.appendChild(head);

    const sub = document.createElement("div");
    sub.textContent = "This page shows signs of a credential-stealing attempt:";
    Object.assign(sub.style, { opacity: ".92", margin: "8px 0 4px", fontSize: "13px" });
    bar.appendChild(sub);

    const list = document.createElement("ul");
    Object.assign(list.style, { margin: "0", paddingLeft: "22px" });
    for (const s of verdict.signals) {
      const li = document.createElement("li");
      li.textContent = s.label; // text, never HTML
      li.style.margin = "3px 0";
      list.appendChild(li);
    }
    bar.appendChild(list);

    const close = document.createElement("button");
    close.textContent = "Dismiss";
    Object.assign(close.style, {
      position: "absolute", top: "12px", right: "14px", background: "rgba(255,255,255,.15)",
      border: "1px solid rgba(255,255,255,.6)", color: "#fff", borderRadius: "6px",
      padding: "3px 10px", cursor: "pointer", font: "13px system-ui,sans-serif",
    });
    close.addEventListener("click", () => bar.remove());
    bar.appendChild(close);

    document.documentElement.appendChild(bar);
  }

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === "SHOW_WARNING") showBanner(msg.verdict);
  });
})();
