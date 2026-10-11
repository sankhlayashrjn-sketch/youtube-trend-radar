import { describe, expect, it } from "vitest";
import { chartCategoriesFor } from "../youtube";

describe("chartCategoriesFor", () => {
  it("does not use the generic charts for fashion, and never the tech chart", () => {
    expect(chartCategoriesFor(["Fashion"])).toEqual([]);
    expect(chartCategoriesFor(["Fashion", "streetwear outfits"])).not.toContain("28");
  });
  it("maps tech keywords to Science & Technology", () => {
    expect(chartCategoriesFor(["AI tools", "smartphone review"])).toEqual(["28"]);
  });
  it("combines up to two matching categories and skips unknown niches", () => {
    expect(chartCategoriesFor(["Fashion", "gaming", "AI tools"])).toEqual(["28", "20"]);
    expect(chartCategoriesFor(["knitting patterns"])).toEqual([]);
  });
});
