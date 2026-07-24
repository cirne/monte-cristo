/**
 * Content script for Kindle Cloud Reader (and the local demo mock page).
 *
 * Shows a floating "Read in Companion" pill. One click:
 *   1. Extract the book title and a snippet of the visible reading text.
 *   2. Ask the background worker to call the reader's /api/companion/locate.
 *   3. Open the companion reader at the matched book / chapter / paragraph.
 *
 * Best-effort by design: on DOM-rendering Kindle versions we can sync the exact
 * position; on canvas-rendered pages we fall back to a title-only book link.
 */

(() => {
  const IS_MOCK = Boolean(document.querySelector("[data-kindle-mock]"));
  const IS_KINDLE = location.hostname === "read.amazon.com";
  if (!IS_KINDLE && !IS_MOCK) return;

  // ---------- Extraction ----------

  function cleanTitle(raw) {
    return (raw || "")
      .replace(/kindle\s*(cloud|web)?\s*reader:?/gi, "")
      .replace(/amazon\.com:?/gi, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function getBookTitle() {
    const selectors = [
      "[data-kindle-mock-title]",
      '[data-testid="header-title"]',
      ".fixed-book-title",
      "#reader-title",
      '[class*="bookTitle"]',
      '[class*="book-title"]',
    ];
    for (const selector of selectors) {
      const el = document.querySelector(selector);
      const text = el && (el.getAttribute("data-kindle-mock-title") || el.textContent);
      if (text && cleanTitle(text)) return cleanTitle(text);
    }
    return cleanTitle(document.title);
  }

  function readableDocuments() {
    const docs = [document];
    for (const iframe of document.querySelectorAll("iframe")) {
      try {
        if (iframe.contentDocument) docs.push(iframe.contentDocument);
      } catch {
        // cross-origin iframe: skip
      }
    }
    return docs;
  }

  function isInViewport(el, win) {
    const rect = el.getBoundingClientRect();
    const height = win.innerHeight || 0;
    return rect.bottom > 0 && rect.top < height && rect.width > 0 && rect.height > 0;
  }

  /** First ~1500 chars of book text currently visible in the viewport. */
  function getVisibleText() {
    for (const doc of readableDocuments()) {
      const win = doc.defaultView || window;
      const blocks = doc.querySelectorAll("p, [role='paragraph'], .textLayer span");
      const parts = [];
      for (const block of blocks) {
        if (!isInViewport(block, win)) continue;
        const text = (block.innerText || block.textContent || "").replace(/\s+/g, " ").trim();
        if (text.length < 40) continue; // skip UI chrome / short fragments
        parts.push(text);
        if (parts.join(" ").length > 1500) break;
      }
      const joined = parts.join(" ").slice(0, 1500);
      if (joined.length >= 60) return joined;
    }
    return "";
  }

  // ---------- UI ----------

  const pill = document.createElement("button");
  pill.id = "mc-companion-pill";
  pill.type = "button";
  pill.innerHTML = `
    <span class="mc-companion-icon" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
      </svg>
    </span>
    <span class="mc-companion-label">Read in Companion</span>
  `;

  const toast = document.createElement("div");
  toast.id = "mc-companion-toast";
  toast.setAttribute("role", "status");

  let toastTimer = null;
  function showToast(message) {
    toast.textContent = message;
    toast.classList.add("mc-visible");
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("mc-visible"), 4200);
  }

  function setBusy(busy) {
    pill.classList.toggle("mc-busy", busy);
    pill.disabled = busy;
    pill.querySelector(".mc-companion-label").textContent = busy
      ? "Locating…"
      : "Read in Companion";
  }

  async function handleClick() {
    setBusy(true);
    const title = getBookTitle();
    const text = getVisibleText();
    let response;
    try {
      response = await chrome.runtime.sendMessage({ type: "locate", title, text });
    } catch (err) {
      response = { ok: false, error: err?.message || String(err) };
    }
    setBusy(false);

    if (!response?.ok) {
      showToast(`Companion reader unreachable — is it running? (${response?.error || "no response"})`);
      return;
    }
    if (!response.data?.found) {
      showToast(`“${title}” isn’t in the companion library yet.`);
      return;
    }
    const url = `${response.base}${response.data.url}`;
    if (response.data.chapter != null) {
      showToast(`Found your spot — Chapter ${response.data.chapter}. Opening…`);
    } else {
      showToast(`Opening ${response.data.bookTitle}…`);
    }
    chrome.runtime.sendMessage({ type: "open", url });
  }

  pill.addEventListener("click", handleClick);
  document.documentElement.appendChild(pill);
  document.documentElement.appendChild(toast);
})();
