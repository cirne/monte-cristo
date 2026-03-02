import { describe, it, expect } from "vitest";
import { linkifyParagraph } from "./linkify";

describe("lib/linkify", () => {
  it("returns single text segment when no entities in chapter", () => {
    // Chapter 999 likely has no index entry
    const result = linkifyParagraph("Some random text with no entities.", 99999);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ type: "text", content: "Some random text with no entities." });
  });

  it("returns text segment for empty paragraph", () => {
    const result = linkifyParagraph("", 1);
    expect(result).toEqual([{ type: "text", content: "" }]);
  });

  it("linkifyParagraph returns Segment array", () => {
    const result = linkifyParagraph("Hello world.", 1);
    expect(Array.isArray(result)).toBe(true);
    for (const seg of result) {
      expect(seg).toHaveProperty("type");
      expect(["text", "link"]).toContain(seg.type);
      expect(seg).toHaveProperty("content");
      if (seg.type === "link") {
        expect(seg).toHaveProperty("entityId");
        expect(seg).toHaveProperty("entityType");
      }
    }
  });

  it("does not link literal terms inside longer words", () => {
    const result = linkifyParagraph("A revolutionary tide.", 5);
    expect(result).toEqual([{ type: "text", content: "A revolutionary tide." }]);
  });

  it("does not link regex matches inside longer words", () => {
    const result = linkifyParagraph("A Morcerfian title.", 3);
    expect(result).toEqual([{ type: "text", content: "A Morcerfian title." }]);
  });

  it("still links complete terms with punctuation boundaries", () => {
    const result = linkifyParagraph("Morcerf's carriage arrived.", 3);
    const links = result.filter((segment) => segment.type === "link");
    expect(links).toHaveLength(1);
    expect(links[0]).toMatchObject({
      type: "link",
      content: "Morcerf",
      entityId: "fernand",
      entityType: "person",
    });
  });

  it("links Mademoiselle de Saint-Méran's to Renée from chapter 7 onward", () => {
    const text = "Mademoiselle de Saint-Méran’s family possessed considerable political influence.";
    const result = linkifyParagraph(text, 7);
    const links = result.filter((seg) => seg.type === "link");
    expect(links.some((seg) => seg.entityId === "rene_de_saintmran")).toBe(true);
  });
});
