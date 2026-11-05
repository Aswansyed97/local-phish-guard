// Background worker. Scores each page and remembers the result per tab.
//
// MV3 note: this worker can be suspended after a short idle and restarted later.
// So the verdict the popup needs is kept in chrome.storage.session, which
// survives a restart (and clears when the browser closes). Redirect chains are
// best-effort in memory: if the worker dies mid-navigation we just lose a few
// hops, analyze() then sees fewer signals and still returns a valid result.
import { analyze } from "./core/detect.js";

const redirectChains = {}; // tabId -> [url, ...], best-effort only
const key = (tabId) => "verdict:" + tabId;

chrome.webRequest.onBeforeRedirect.addListener(
  (d) => {
    if (d.type !== "main_frame" || d.tabId < 0) return;
    const chain = redirectChains[d.tabId] || (redirectChains[d.tabId] = []);
    if (chain[chain.length - 1] !== d.url) chain.push(d.url);
    if (d.redirectUrl) chain.push(d.redirectUrl);
  },
  { urls: ["http://*/*", "https://*/*"], types: ["main_frame"] }
);

chrome.webNavigation.onBeforeNavigate.addListener((d) => {
  if (d.frameId === 0) redirectChains[d.tabId] = [d.url];
});

chrome.tabs.onRemoved.addListener((tabId) => {
  delete redirectChains[tabId];
  chrome.storage.session.remove(key(tabId)).catch(() => {});
});

function applyBadge(tabId, level) {
  const text = { ok: "", caution: "!", warn: "!!" };
  const color = { caution: "#ed6c02", warn: "#c62828" };
  chrome.action.setBadgeText({ tabId, text: text[level] || "" });
  if (color[level]) chrome.action.setBadgeBackgroundColor({ tabId, color: color[level] });
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "PAGE_SIGNALS" && sender.tab) {
    const tabId = sender.tab.id;
    const verdict = analyze({
      url: msg.pageUrl,
      redirectChain: redirectChains[tabId] || [],
      forms: msg.forms || [],
    });
    chrome.storage.session.set({ [key(tabId)]: verdict }).catch(() => {});
    applyBadge(tabId, verdict.level);
    if (verdict.level === "warn") {
      chrome.tabs.sendMessage(tabId, { type: "SHOW_WARNING", verdict }).catch(() => {});
    }
    sendResponse({ ok: true });
  }
  return true;
});
