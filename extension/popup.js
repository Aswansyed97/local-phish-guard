// Popup. Asks the background worker for the stored verdict of the active tab
// and renders it. Builds the DOM with text nodes only.
const TITLES = { ok: "Looks safe", caution: "Be careful", warn: "Likely phishing" };

chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  const tab = tabs[0];
  if (!tab) return;
  chrome.runtime.sendMessage({ type: "GET_VERDICT", tabId: tab.id }, (verdict) => {
    const head = document.getElementById("head");
    const title = document.getElementById("title");
    const score = document.getElementById("score");
    const reasons = document.getElementById("reasons");
    const none = document.getElementById("none");

    if (!verdict) {
      title.textContent = "No data yet";
      score.textContent = "Reload the page to run a check.";
      return;
    }

    head.className = verdict.level;
    title.textContent = TITLES[verdict.level] || "Checked";
    score.textContent = `Risk score: ${verdict.score} / 100`;

    if (verdict.signals.length === 0) {
      none.hidden = false;
      return;
    }
    for (const s of verdict.signals) {
      const li = document.createElement("li");
      li.textContent = `${s.label} (+${s.points})`;
      reasons.appendChild(li);
    }
  });
});
