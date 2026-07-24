/**
 * Background service worker: performs the locate fetch (avoids page CORS /
 * mixed-content constraints via host_permissions) and opens the reader tab.
 */

const DEFAULT_READER_BASE_URL = "http://localhost:3000";

async function getReaderBaseUrl() {
  const { readerBaseUrl } = await chrome.storage.sync.get({
    readerBaseUrl: DEFAULT_READER_BASE_URL,
  });
  return (readerBaseUrl || DEFAULT_READER_BASE_URL).replace(/\/+$/, "");
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "locate") {
    (async () => {
      try {
        const base = await getReaderBaseUrl();
        const params = new URLSearchParams({ title: message.title || "" });
        if (message.text) params.set("text", String(message.text).slice(0, 4000));
        const res = await fetch(`${base}/api/companion/locate?${params.toString()}`);
        if (!res.ok) throw new Error(`Reader responded with HTTP ${res.status}`);
        const data = await res.json();
        sendResponse({ ok: true, base, data });
      } catch (err) {
        sendResponse({ ok: false, error: err?.message || String(err) });
      }
    })();
    return true; // keep the message channel open for the async response
  }

  if (message?.type === "open" && typeof message.url === "string") {
    chrome.tabs.create({ url: message.url });
  }
});
