import { describe, expect, it } from "vitest";
import { chartCategoriesFor } from "../youtube";

describe("chartCategoriesFor", () => {
  it("maps fashion to Howto & Style, not tech", () => {
    expect(chartCategoriesFor(["Fashion"])).toEqual(["26"]);
    expect(chartCategoriesFor(["Fashion"])).not.toContain("28");
  });
  it("maps tech keywords to Science & Technology", () => {
    expect(chartCategoriesFor(["AI tools", "smartphone review"])).toEqual(["28"]);
  });
  it("combines up to two matching categories and skips unknown niches", () => {
    expect(chartCategoriesFor(["Fashion", "gaming", "AI tools"])).toEqual(["26", "28"]);
    expect(chartCategoriesFor(["knitting patterns"])).toEqual([]);
  });
});
