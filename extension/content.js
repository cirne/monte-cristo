/**
 * Content script for Kindle Cloud Reader (and the local demo mock page).
 *
 * Floating "Read in Companion" pill opens an injected side panel. Visible page
 * text is progressively ingested into the local companion brain; the panel
 * shows entities, current summary, and story so far for any book.
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
        if (text.length < 40) continue;
        parts.push(text);
        if (parts.join(" ").length > 1500) break;
      }
      const joined = parts.join(" ").slice(0, 1500);
      if (joined.length >= 60) return joined;
    }
    return "";
  }

  function simpleHash(text) {
    let h = 0;
    for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) | 0;
    return String(h);
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

  const panel = document.createElement("aside");
  panel.id = "mc-companion-panel";
  panel.setAttribute("aria-hidden", "true");
  panel.innerHTML = `
    <div class="mc-panel-header">
      <div class="mc-panel-heading">
        <div class="mc-panel-kicker">Companion</div>
        <h2 class="mc-panel-title">Reading companion</h2>
      </div>
      <button type="button" class="mc-panel-close" aria-label="Close companion panel">×</button>
    </div>
    <div class="mc-panel-status" role="status"></div>
    <div class="mc-panel-body">
      <section class="mc-panel-section">
        <h3>This page</h3>
        <p class="mc-panel-current">Open the companion to index the visible page.</p>
      </section>
      <section class="mc-panel-section">
        <h3>Story so far</h3>
        <p class="mc-panel-story">Notes accumulate as you turn pages.</p>
      </section>
      <section class="mc-panel-section">
        <h3>People & places</h3>
        <ul class="mc-panel-entities"></ul>
      </section>
      <section class="mc-panel-section mc-panel-hosted" hidden>
        <a class="mc-panel-hosted-link" href="#" target="_blank" rel="noopener">Open full reader</a>
      </section>
    </div>
  `;

  const statusEl = panel.querySelector(".mc-panel-status");
  const titleEl = panel.querySelector(".mc-panel-title");
  const currentEl = panel.querySelector(".mc-panel-current");
  const storyEl = panel.querySelector(".mc-panel-story");
  const entitiesEl = panel.querySelector(".mc-panel-entities");
  const hostedSection = panel.querySelector(".mc-panel-hosted");
  const hostedLink = panel.querySelector(".mc-panel-hosted-link");

  let toastTimer = null;
  let panelOpen = false;
  let ingesting = false;
  let lastTextHash = "";
  let watchTimer = null;
  let readerBase = "";
  /** @type {Map<Element, { width: string, maxWidth: string, right: string, left: string }>} */
  const splitStyleSnapshots = new Map();
  const OUR_IDS = new Set(["mc-companion-panel", "mc-companion-pill", "mc-companion-toast"]);

  function showToast(message) {
    toast.textContent = message;
    toast.classList.add("mc-visible");
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("mc-visible"), 4200);
  }

  function setPillBusy(busy) {
    pill.classList.toggle("mc-busy", busy);
    pill.disabled = busy;
    pill.querySelector(".mc-companion-label").textContent = busy
      ? panelOpen
        ? "Updating…"
        : "Opening…"
      : panelOpen
        ? "Hide Companion"
        : "Read in Companion";
  }

  function panelWidthPx() {
    return Math.min(380, Math.max(280, Math.round(window.innerWidth * 0.32)));
  }

  function isOurUi(el) {
    return el && OUR_IDS.has(el.id);
  }

  function shrinkElement(el, panePx) {
    if (!el || isOurUi(el)) return;
    if (!splitStyleSnapshots.has(el)) {
      splitStyleSnapshots.set(el, {
        width: el.style.width,
        maxWidth: el.style.maxWidth,
        right: el.style.right,
        left: el.style.left,
      });
    }
    const cs = getComputedStyle(el);
    const position = cs.position;
    if (position === "fixed" || position === "absolute") {
      el.style.right = `${panePx}px`;
      if (cs.left !== "auto" && parseFloat(cs.left) === 0) {
        el.style.left = "0px";
      }
      el.style.width = `calc(100vw - ${panePx}px)`;
      el.style.maxWidth = `calc(100vw - ${panePx}px)`;
    } else {
      el.style.width = "100%";
      el.style.maxWidth = `calc(100vw - ${panePx}px)`;
    }
  }

  function findReaderShells() {
    const shells = [];
    const byId = [
      "KindleReaderContainer",
      "kindleReader_container",
      "KindleReaderIFrame",
      "reader",
      "ion-app",
    ];
    for (const id of byId) {
      const el = document.getElementById(id);
      if (el) shells.push(el);
    }

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    for (const el of document.body.querySelectorAll("div, main, section, iframe")) {
      if (isOurUi(el) || shells.includes(el)) continue;
      const cs = getComputedStyle(el);
      if (cs.position !== "fixed" && cs.position !== "absolute") continue;
      const rect = el.getBoundingClientRect();
      if (rect.width >= vw - 40 && rect.height >= vh * 0.5 && rect.left <= 8) {
        shells.push(el);
      }
    }
    return shells;
  }

  function applySplitLayout(open, { notifyResize = true } = {}) {
    const panePx = panelWidthPx();
    document.documentElement.style.setProperty("--mc-companion-pane", `${panePx}px`);
    panel.style.width = `${panePx}px`;

    if (open) {
      document.documentElement.classList.add("mc-companion-split");
      document.body.classList.add("mc-companion-split-body");

      shrinkElement(document.documentElement, panePx);
      shrinkElement(document.body, panePx);
      document.documentElement.style.width = `calc(100vw - ${panePx}px)`;
      document.documentElement.style.maxWidth = `calc(100vw - ${panePx}px)`;
      document.body.style.width = "100%";
      document.body.style.maxWidth = "100%";
      document.body.style.boxSizing = "border-box";
      document.body.style.overflowX = "hidden";

      for (const shell of findReaderShells()) {
        shrinkElement(shell, panePx);
      }
    } else {
      document.documentElement.classList.remove("mc-companion-split");
      document.body.classList.remove("mc-companion-split-body");
      for (const [el, prev] of splitStyleSnapshots) {
        el.style.width = prev.width;
        el.style.maxWidth = prev.maxWidth;
        el.style.right = prev.right;
        el.style.left = prev.left;
      }
      splitStyleSnapshots.clear();
      document.documentElement.style.removeProperty("--mc-companion-pane");
      panel.style.width = "";
    }

    if (notifyResize) {
      // Let Kindle reflow pagination/canvas to the new viewport width, then
      // re-shrink any shells it recreates.
      requestAnimationFrame(() => {
        window.dispatchEvent(new Event("resize"));
        if (open) {
          setTimeout(() => applySplitLayout(true, { notifyResize: false }), 250);
        }
      });
    }
  }

  function setPanelOpen(open) {
    panelOpen = open;
    panel.classList.toggle("mc-open", open);
    panel.setAttribute("aria-hidden", open ? "false" : "true");
    pill.classList.toggle("mc-panel-open", open);
    applySplitLayout(open, { notifyResize: true });
    setPillBusy(ingesting);
    if (open) startWatching();
    else stopWatching();
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function renderPanel(data, base) {
    if (base) readerBase = base;
    titleEl.textContent = data.bookTitle || getBookTitle() || "Reading companion";

    if (data.noText) {
      statusEl.textContent = data.message || "No extractable text on this page.";
      statusEl.dataset.kind = "warn";
    } else if (data.message && !data.chunkCount) {
      statusEl.textContent = data.message;
      statusEl.dataset.kind = "info";
    } else {
      statusEl.textContent =
        data.chunkCount > 0
          ? `Indexed ${data.chunkCount} page${data.chunkCount === 1 ? "" : "s"}`
          : "Ready";
      statusEl.dataset.kind = "ok";
    }

    currentEl.textContent =
      data.currentSummary ||
      (data.noText ? "—" : "No summary for this page yet.");
    storyEl.textContent =
      data.storySoFar ||
      (data.chunkCount ? "—" : "Notes accumulate as you turn pages.");

    entitiesEl.innerHTML = "";
    const entities = Array.isArray(data.entities) ? data.entities : [];
    if (entities.length === 0) {
      const li = document.createElement("li");
      li.className = "mc-panel-empty";
      li.textContent = "No people or places indexed yet.";
      entitiesEl.appendChild(li);
    } else {
      for (const entity of entities) {
        const li = document.createElement("li");
        li.innerHTML = `<span class="mc-entity-name">${escapeHtml(entity.name)}</span>
          <span class="mc-entity-type">${escapeHtml(entity.type)}</span>
          ${
            entity.spoilerFreeIntro
              ? `<span class="mc-entity-intro">${escapeHtml(entity.spoilerFreeIntro)}</span>`
              : ""
          }`;
        entitiesEl.appendChild(li);
      }
    }

    if (data.hostedReaderUrl && readerBase) {
      hostedSection.hidden = false;
      hostedLink.href = `${readerBase}${data.hostedReaderUrl}`;
      hostedLink.textContent = "Open full reader";
    } else {
      hostedSection.hidden = true;
    }
  }

  async function sendIngest() {
    if (ingesting) return;
    const title = getBookTitle();
    const text = getVisibleText();
    const textHash = simpleHash(text);
    ingesting = true;
    setPillBusy(true);
    statusEl.textContent = text ? "Indexing page…" : "Checking page…";
    statusEl.dataset.kind = "info";

    let response;
    try {
      response = await chrome.runtime.sendMessage({ type: "ingest", title, text });
    } catch (err) {
      response = { ok: false, error: err?.message || String(err) };
    }

    ingesting = false;
    setPillBusy(false);

    if (!response?.ok) {
      statusEl.textContent = `Companion unreachable — is the reader running? (${response?.error || "no response"})`;
      statusEl.dataset.kind = "error";
      showToast(statusEl.textContent);
      return;
    }

    lastTextHash = textHash;
    renderPanel(response.data, response.base);
  }

  function startWatching() {
    stopWatching();
    watchTimer = setInterval(() => {
      if (!panelOpen || ingesting) return;
      const text = getVisibleText();
      const hash = simpleHash(text);
      if (hash !== lastTextHash) {
        sendIngest();
      }
    }, 2500);
  }

  function stopWatching() {
    if (watchTimer) {
      clearInterval(watchTimer);
      watchTimer = null;
    }
  }

  async function handlePillClick() {
    if (panelOpen) {
      setPanelOpen(false);
      return;
    }
    setPanelOpen(true);
    await sendIngest();
  }

  panel.querySelector(".mc-panel-close").addEventListener("click", () => setPanelOpen(false));
  pill.addEventListener("click", handlePillClick);

  let resizeRefreshTimer = null;
  window.addEventListener("resize", () => {
    if (!panelOpen) return;
    if (resizeRefreshTimer) clearTimeout(resizeRefreshTimer);
    resizeRefreshTimer = setTimeout(() => {
      applySplitLayout(true, { notifyResize: false });
    }, 100);
  });

  document.documentElement.appendChild(pill);
  document.documentElement.appendChild(toast);
  document.documentElement.appendChild(panel);
})();
