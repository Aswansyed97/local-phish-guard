// Background service worker. Tracks each tab's redirect chain, receives page
// signals from the content script, runs the detection core, and stores a verdict
// per tab. ES module so it can import the shared core.
import { analyze, scoreToLevel } from "./core/detect.js";

const redirectChains = {}; // tabId -> [url, url, ...]
const verdicts = {};       // tabId -> verdict object

// Register webRequest/webNavigation listeners at the top level so they re-attach
// every time the worker wakes.
chrome.webRequest.onBeforeRedirect.addListener(
  (d) => {
    if (d.type !== "main_frame" || d.tabId < 0) return;
    const chain = redirectChains[d.tabId] || (redirectChains[d.tabId] = []);
    if (chain[chain.length - 1] !== d.url) chain.push(d.url);
    if (d.redirectUrl) chain.push(d.redirectUrl);
  },
  { urls: ["<all_urls>"], types: ["main_frame"] }
);

// A fresh top-level navigation starts a new chain.
chrome.webNavigation.onBeforeNavigate.addListener((d) => {
  if (d.frameId === 0) redirectChains[d.tabId] = [d.url];
});

chrome.tabs.onRemoved.addListener((tabId) => {
  delete redirectChains[tabId];
  delete verdicts[tabId];
});

function applyBadge(tabId, level) {
  const map = { ok: "", caution: "!", warn: "!!" };
  const colors = { ok: "#2e7d32", caution: "#ed6c02", warn: "#c62828" };
  chrome.action.setBadgeText({ tabId, text: map[level] || "" });
  if (level !== "ok") chrome.action.setBadgeBackgroundColor({ tabId, color: colors[level] });
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "PAGE_SIGNALS" && sender.tab) {
    const tabId = sender.tab.id;
    const verdict = analyze({
      url: msg.pageUrl,
      redirectChain: redirectChains[tabId] || [],
      forms: msg.forms || [],
    });
    verdicts[tabId] = verdict;
    applyBadge(tabId, verdict.level);
    if (verdict.level === "warn") {
      chrome.tabs.sendMessage(tabId, { type: "SHOW_WARNING", verdict }).catch(() => {});
    }
    sendResponse({ ok: true });
    return true;
  }
  if (msg.type === "GET_VERDICT") {
    sendResponse(verdicts[msg.tabId] || null);
    return true;
  }
});
