import { describe, it, expect } from "vitest";
import {
  TOTAL_CHAPTERS,
  LAST_CHAPTER_STORAGE_KEY,
  VOLUMES,
  VOLUME_LABELS,
} from "./constants";

describe("lib/constants", () => {
  it("exports TOTAL_CHAPTERS as 117", () => {
    expect(TOTAL_CHAPTERS).toBe(117);
  });

  it("exports LAST_CHAPTER_STORAGE_KEY", () => {
    expect(LAST_CHAPTER_STORAGE_KEY).toBe("monte-cristo-last-chapter");
  });

  it("exports VOLUMES with 5 volumes", () => {
    expect(VOLUMES).toHaveLength(5);
    expect(VOLUMES).toContain("VOLUME ONE");
    expect(VOLUMES).toContain("VOLUME FIVE");
  });

  it("exports VOLUME_LABELS mapping volume keys to display labels", () => {
    expect(VOLUME_LABELS["VOLUME ONE"]).toBe("Volume I");
    expect(VOLUME_LABELS["VOLUME FIVE"]).toBe("Volume V");
  });
});
