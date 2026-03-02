import { describe, it, expect } from "vitest";
import {
  isCanonicalHtml,
  htmlToParagraphs,
  textToCanonicalHtml,
  formatCanonicalHtmlForStorage,
  stripHtmlToText,
  sanitizeToCanonicalHtml,
} from "./canonical-html";

describe("lib/canonical-html", () => {
  describe("isCanonicalHtml", () => {
    it("returns true for content starting with < or containing </p>", () => {
      expect(isCanonicalHtml("<p>Hi</p>")).toBe(true);
      expect(isCanonicalHtml("\n<p>Hi</p>")).toBe(true);
      expect(isCanonicalHtml("  <p>Hi</p>  ")).toBe(true);
      expect(isCanonicalHtml("Some text with </p> later")).toBe(true);
    });

    it("returns false for plain text", () => {
      expect(isCanonicalHtml("Plain text")).toBe(false);
      expect(isCanonicalHtml("Paragraph one.\n\nParagraph two.")).toBe(false);
      expect(isCanonicalHtml("")).toBe(false);
      expect(isCanonicalHtml("   \n  ")).toBe(false);
    });
  });

  describe("htmlToParagraphs", () => {
    it("extracts one paragraph per <p>...</p>", () => {
      const html = "<p>First.</p><p>Second.</p><p>Third.</p>";
      expect(htmlToParagraphs(html)).toEqual(["First.", "Second.", "Third."]);
    });

    it("strips inline tags and normalizes space", () => {
      const html = "<p>Hello <strong>world</strong> and <em>you</em>.</p>";
      expect(htmlToParagraphs(html)).toEqual(["Hello world and you."]);
    });

    it("decodes common entities", () => {
      const html = "<p>Dash &mdash; and &ndash; and &#39;quote&#39;</p>";
      expect(htmlToParagraphs(html)).toEqual(["Dash — and – and 'quote'"]);
    });

    it("returns empty array when no <p> tags (caller can fall back to legacy)", () => {
      expect(htmlToParagraphs("No paragraphs here")).toEqual([]);
    });
  });

  describe("textToCanonicalHtml", () => {
    it("wraps each paragraph in <p> and escapes entities", () => {
      const text = "One\n\nTwo & three\n\nFour";
      expect(textToCanonicalHtml(text)).toBe("<p>One</p><p>Two &amp; three</p><p>Four</p>");
    });

    it("collapses multiple newlines between paragraphs", () => {
      const text = "A\n\n\n\nB";
      expect(textToCanonicalHtml(text)).toBe("<p>A</p><p>B</p>");
    });

    it("replaces single newlines with space within paragraph", () => {
      const text = "Line one\nLine two\n\nNext";
      expect(textToCanonicalHtml(text)).toBe("<p>Line one Line two</p><p>Next</p>");
    });

    it("escapes < and >", () => {
      expect(textToCanonicalHtml("a < b")).toBe("<p>a &lt; b</p>");
      expect(textToCanonicalHtml("b > a")).toBe("<p>b &gt; a</p>");
    });
  });

  describe("formatCanonicalHtmlForStorage", () => {
    it("puts paragraph tags on their own lines", () => {
      const html = "<p>First paragraph.</p><p>Second paragraph.</p>";
      expect(formatCanonicalHtmlForStorage(html)).toBe(
        "<p>\nFirst paragraph.\n</p>\n\n<p>\nSecond paragraph.\n</p>"
      );
    });

    it("wraps paragraph text to the provided width", () => {
      const html = "<p>One two three four five six seven eight</p>";
      expect(formatCanonicalHtmlForStorage(html, 18)).toBe(
        "<p>\nOne two three four\nfive six seven eight\n</p>"
      );
    });

    it("preserves inline tags while wrapping", () => {
      const html = "<p>Hello <strong>bold text</strong> and <em>emphasis</em> here.</p>";
      expect(formatCanonicalHtmlForStorage(html, 26)).toBe(
        "<p>\nHello <strong>bold\ntext</strong> and\n<em>emphasis</em> here.\n</p>"
      );
    });
  });

  describe("stripHtmlToText", () => {
    it("strips tags and normalizes space", () => {
      expect(stripHtmlToText("<p>Hello <b>world</b></p>")).toBe("Hello world");
    });

    it("decodes common entities", () => {
      expect(stripHtmlToText("&mdash; &ndash; &#39;")).toBe("— – '");
    });
  });

  describe("sanitizeToCanonicalHtml", () => {
    it("preserves <p> and allowed inline tags", () => {
      const html = "<p>Say <strong>bold</strong> and <em>italic</em>.</p>";
      expect(sanitizeToCanonicalHtml(html)).toBe(
        "<p>Say <strong>bold</strong> and <em>italic</em>.</p>"
      );
    });

    it("strips disallowed tags but keeps content", () => {
      const html = "<p>Before <span>keep</span> after <a href='x'>link</a> end.</p>";
      expect(sanitizeToCanonicalHtml(html)).toContain("link");
      expect(sanitizeToCanonicalHtml(html)).not.toContain("<a ");
    });

    it("wraps bare text in <p> when no block tags", () => {
      const html = "Just some text";
      expect(sanitizeToCanonicalHtml(html)).toBe("<p>Just some text</p>");
    });
  });
});
