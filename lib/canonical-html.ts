/**
 * Canonical book content format: HTML fragments using <p>, <strong>, <em>, etc.
 * Parsers emit this format; getParagraphs() consumes it for indexing and display.
 */

/** Allowed inline tags in canonical HTML (lowercase). Block structure is <p> only. */
const ALLOWED_INLINE = new Set(["strong", "em", "b", "i", "span"]);

/**
 * True if content looks like canonical HTML (contains paragraph markers).
 */
export function isCanonicalHtml(content: string): boolean {
  const trimmed = content.trim();
  return trimmed.length > 0 && (trimmed.startsWith("<") || trimmed.includes("</p>"));
}

/**
 * Extract plain-text paragraphs from canonical HTML (one per <p>...</p>).
 * Single newlines within a paragraph are normalized to space.
 * If content does not look like HTML, returns empty (caller should use legacy getParagraphs).
 */
export function htmlToParagraphs(html: string): string[] {
  const paragraphs: string[] = [];
  const re = /<p(?:\s[^>]*)?>([\s\S]*?)<\/p>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const inner = m[1];
    const text = stripHtmlToText(inner).replace(/\s+/g, " ").trim();
    paragraphs.push(text);
  }
  if (paragraphs.length > 0) return paragraphs;
  // Fallback: treat as legacy (no <p> tags) — split by double newline
  return [];
}

/**
 * Convert plain-text content (paragraphs separated by \n\n) to canonical HTML.
 * Escapes HTML entities and wraps each paragraph in <p>...</p>.
 */
export function textToCanonicalHtml(text: string): string {
  const paragraphs = text
    .split(/\n\n+/)
    .map((p) => p.replace(/\n/g, " ").trim())
    .filter(Boolean);
  return paragraphs.map((p) => `<p>${escapeHtml(p)}</p>`).join("");
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Strip HTML tags and normalize whitespace to get plain text for search/excerpts.
 */
export function stripHtmlToText(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\s+([.,;:!?])/g, "$1") // collapse space before punctuation
    .replace(/&mdash;/g, "—")
    .replace(/&ndash;/g, "–")
    .replace(/&nbsp;/g, " ")
    .replace(/&[#\w]+;/g, (m) => decodeEntity(m))
    .trim();
}

function decodeEntity(m: string): string {
  const body = m.slice(1, -1); // drop & and ;
  if (body.startsWith("#")) {
    const num = body.slice(1).replace(/^x/, "0x");
    const n = parseInt(num, num.startsWith("0x") ? 16 : 10);
    if (Number.isFinite(n) && n >= 0) {
      try {
        return String.fromCodePoint(n);
      } catch {
        return " ";
      }
    }
  }
  const known: Record<string, string> = {
    "amp": "&",
    "lt": "<",
    "gt": ">",
    "quot": '"',
    "apos": "'",
    "#39": "'",
  };
  return known[body] ?? " ";
}

/**
 * Sanitize HTML to canonical fragment: only <p>, <strong>, <em>, <b>, <i>, <span>.
 * Strips other tags (content kept as text). Use for high-fidelity input (e.g. Gatsby).
 */
export function sanitizeToCanonicalHtml(html: string): string {
  const out: string[] = [];
  // First alternation: <p>...</p> → group 1 = inner. Second: <tag>...</tag> → group 2 = tag, group 3 = inner.
  const blockRe = /<p(?:\s[^>]*)?>([\s\S]*?)<\/p>|<(\w+)(?:\s[^>]*)?>([\s\S]*?)<\/\2>/gi;
  let lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = blockRe.exec(html)) !== null) {
    const pInner = m[1];
    const otherTag = m[2];
    const otherInner = m[3];
    if (pInner !== undefined) {
      if (m.index > lastIndex) {
        const between = html.slice(lastIndex, m.index);
        const text = stripHtmlToText(between).trim();
        if (text) out.push(`<p>${escapeHtml(text)}</p>`);
      }
      const sanitizedInner = sanitizeInlineHtml(pInner);
      out.push(`<p>${sanitizedInner}</p>`);
      lastIndex = m.index + m[0].length;
    } else if (otherTag && ALLOWED_INLINE.has(otherTag.toLowerCase())) {
      const sanitized = sanitizeInlineHtml(otherInner ?? "");
      out.push(`<${otherTag}>${sanitized}</${otherTag}>`);
      lastIndex = m.index + m[0].length;
    }
  }
  if (lastIndex < html.length) {
    const rest = html.slice(lastIndex);
    const text = stripHtmlToText(rest).trim();
    if (text) out.push(`<p>${escapeHtml(text)}</p>`);
  }
  if (out.length > 0) return out.join("");
  // No <p> found: treat whole thing as one paragraph
  const text = stripHtmlToText(html).trim();
  return text ? `<p>${escapeHtml(text)}</p>` : "";
}

function sanitizeInlineHtml(html: string): string {
  const re = /<(\w+)(?:\s[^>]*)?>([\s\S]*?)<\/\1>|([^<]+)/gi;
  const parts: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    if (m[3] !== undefined) {
      parts.push(escapeHtml(m[3]));
    } else {
      const tag = (m[1] ?? "").toLowerCase();
      const inner = m[2] ?? "";
      if (ALLOWED_INLINE.has(tag)) {
        parts.push(`<${tag}>${sanitizeInlineHtml(inner)}</${tag}>`);
      } else {
        parts.push(sanitizeInlineHtml(inner));
      }
    }
  }
  return parts.join("");
}
