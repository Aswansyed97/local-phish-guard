// Content script. Runs inside each page. It only gathers facts about login
// forms and reports them to the background worker. It makes no decisions and
// sends nothing to the network. Classic script (no imports) by design.
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
      position: "fixed", top: "0", left: "0", right: "0", zIndex: "2147483647",
      background: "#c62828", color: "#fff", font: "14px/1.4 system-ui,sans-serif",
      padding: "12px 16px", boxShadow: "0 2px 8px rgba(0,0,0,.3)",
    });

    const title = document.createElement("strong");
    title.textContent = "⚠ Phish Guard: this page looks like a phishing attempt.";
    bar.appendChild(title);

    const list = document.createElement("ul");
    list.style.margin = "8px 0 0";
    list.style.paddingLeft = "20px";
    for (const s of verdict.signals) {
      const li = document.createElement("li");
      li.textContent = s.label; // text, not HTML
      list.appendChild(li);
    }
    bar.appendChild(list);

    const close = document.createElement("button");
    close.textContent = "Dismiss";
    Object.assign(close.style, {
      position: "absolute", top: "8px", right: "12px", background: "transparent",
      border: "1px solid #fff", color: "#fff", borderRadius: "4px",
      padding: "2px 8px", cursor: "pointer",
    });
    close.addEventListener("click", () => bar.remove());
    bar.appendChild(close);

    document.documentElement.appendChild(bar);
  }

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === "SHOW_WARNING") showBanner(msg.verdict);
  });
})();
