/**
 * Background service worker: talks to the local companion brain
 * (ingest / state / optional locate) and opens hosted-reader tabs.
 */

const DEFAULT_READER_BASE_URL = "http://localhost:3000";

async function getReaderBaseUrl() {
  const { readerBaseUrl } = await chrome.storage.sync.get({
    readerBaseUrl: DEFAULT_READER_BASE_URL,
  });
  return (readerBaseUrl || DEFAULT_READER_BASE_URL).replace(/\/+$/, "");
}

async function fetchJson(url, init) {
  const res = await fetch(url, init);
  if (!res.ok) {
    throw new Error(`Reader responded with HTTP ${res.status}`);
  }
  return res.json();
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "ingest") {
    (async () => {
      try {
        const base = await getReaderBaseUrl();
        const data = await fetchJson(`${base}/api/companion/ingest`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: message.title || "",
            text: message.text ? String(message.text).slice(0, 4000) : "",
            asin: message.asin || undefined,
            positionHint: message.positionHint || undefined,
          }),
        });
        sendResponse({ ok: true, base, data });
      } catch (err) {
        sendResponse({ ok: false, error: err?.message || String(err) });
      }
    })();
    return true;
  }

  if (message?.type === "state") {
    (async () => {
      try {
        const base = await getReaderBaseUrl();
        const params = new URLSearchParams({ title: message.title || "" });
        if (message.asin) params.set("asin", String(message.asin));
        const data = await fetchJson(`${base}/api/companion/state?${params.toString()}`);
        sendResponse({ ok: true, base, data });
      } catch (err) {
        sendResponse({ ok: false, error: err?.message || String(err) });
      }
    })();
    return true;
  }

  if (message?.type === "locate") {
    (async () => {
      try {
        const base = await getReaderBaseUrl();
        const params = new URLSearchParams({ title: message.title || "" });
        if (message.text) params.set("text", String(message.text).slice(0, 4000));
        const data = await fetchJson(`${base}/api/companion/locate?${params.toString()}`);
        sendResponse({ ok: true, base, data });
      } catch (err) {
        sendResponse({ ok: false, error: err?.message || String(err) });
      }
    })();
    return true;
  }

  if (message?.type === "open" && typeof message.url === "string") {
    chrome.tabs.create({ url: message.url });
  }
});
