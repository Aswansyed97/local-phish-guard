// Popup. Asks the background worker for the active tab's verdict and renders it.
// When opened outside the extension (no chrome APIs), it shows a demo verdict so
// the file still renders — useful for previews and screenshots.
const META = {
  ok:      { title: "Looks safe",       face: "✓" },
  caution: { title: "Be careful",       face: "!" },
  warn:    { title: "Likely phishing",  face: "⚠" },
};

function severity(points) {
  if (points >= 45) return "hi";
  if (points >= 25) return "mid";
  return "lo";
}

function render(verdict) {
  const head = document.getElementById("head");
  const face = document.getElementById("face");
  const title = document.getElementById("title");
  const score = document.getElementById("score");
  const meter = document.getElementById("meter");
  const bar = document.getElementById("bar");
  const reasons = document.getElementById("reasons");
  const none = document.getElementById("none");

  if (!verdict) {
    title.textContent = "No data yet";
    score.textContent = "Reload the page to run a check.";
    return;
  }

  const level = verdict.level;
  head.className = level;
  meter.className = "meter " + level;
  face.textContent = META[level].face;
  title.textContent = META[level].title;
  score.textContent = `Risk score ${verdict.score} / 100`;
  bar.style.width = Math.max(4, verdict.score) + "%";

  if (!verdict.signals || verdict.signals.length === 0) {
    none.hidden = false;
    return;
  }
  for (const s of verdict.signals) {
    const row = document.createElement("div");
    row.className = "reason";
    const dot = document.createElement("div");
    dot.className = "dot " + severity(s.points);
    const label = document.createElement("div");
    label.textContent = s.label;
    const pts = document.createElement("div");
    pts.className = "pts";
    pts.textContent = "+" + s.points;
    row.append(dot, label, pts);
    reasons.appendChild(row);
  }
}

if (typeof chrome !== "undefined" && chrome.tabs && chrome.runtime) {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs[0];
    if (!tab) return render(null);
    chrome.runtime.sendMessage({ type: "GET_VERDICT", tabId: tab.id }, render);
  });
} else {
  // Standalone preview (opened as a plain file, not inside the extension).
  render({
    level: "warn",
    score: 90,
    signals: [
      { label: "A password form sends your login to a different site (evil.test)", points: 50 },
      { label: "A password form sends data over unencrypted HTTP", points: 40 },
    ],
  });
}
