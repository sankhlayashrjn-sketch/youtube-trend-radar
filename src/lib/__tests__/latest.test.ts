import { beforeEach, describe, expect, it, vi } from "vitest";

const repo = vi.hoisted(() => {
  process.env.DATABASE_URL = "postgresql://u:p@localhost:6543/db";
  return { latestBrief: vi.fn(), latestRun: vi.fn(), getSettings: vi.fn() };
});
vi.mock("../repo", async (orig) => ({ ...(await orig<typeof import("../repo")>()), ...repo }));
vi.mock("../seed", () => ({ seedBrief: () => ({ seed: true }) }));

import { getLatest } from "../latest";
import { settingsHash } from "../repo";

const settings = { categories: ["AI tools", "ChatGPT"], region: "IN", email: "a@b.co", minViews: 0 };
const stored = (over: { hash?: string | undefined; createdAt?: Date } = {}) => ({
  id: "b1",
  createdAt: over.createdAt ?? new Date(),
  status: "ok",
  brief: { meta: { settingsHash: "hash" in over ? over.hash : settingsHash(settings), categories: settings.categories } },
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  repo.getSettings.mockResolvedValue(settings);
  repo.latestRun.mockResolvedValue(null);
});

describe("getLatest", () => {
  it("serves the bundled seed (not flagged) when the database has no brief yet", async () => {
    repo.latestBrief.mockResolvedValue(null);
    const r = await getLatest();
    expect(r.brief).toEqual({ seed: true });
    expect(r.settingsMismatch).toBe(false);
    expect(r.briefId).toBeNull();
  });
  it("shows the brief as current when it matches the saved settings", async () => {
    repo.latestBrief.mockResolvedValue(stored());
    const r = await getLatest();
    expect(r.settingsMismatch).toBe(false);
    expect(r.stale).toBe(false);
  });
  it("(regression) flags a mismatch when categories changed after the brief was made", async () => {
    repo.latestBrief.mockResolvedValue(stored());
    repo.getSettings.mockResolvedValue({ ...settings, categories: ["Fashion"] });
    expect((await getLatest()).settingsMismatch).toBe(true);
  });
  it("flags a mismatch when only the region changed", async () => {
    repo.latestBrief.mockResolvedValue(stored());
    repo.getSettings.mockResolvedValue({ ...settings, region: "US" });
    expect((await getLatest()).settingsMismatch).toBe(true);
  });
  it("is NOT a mismatch when only email or minimum views changed", async () => {
    repo.latestBrief.mockResolvedValue(stored());
    repo.getSettings.mockResolvedValue({ ...settings, email: "other@x.co", minViews: 50_000 });
    expect((await getLatest()).settingsMismatch).toBe(false);
  });
  it("treats legacy briefs without a settings hash as a mismatch (cannot prove they match)", async () => {
    repo.latestBrief.mockResolvedValue(stored({ hash: undefined }));
    expect((await getLatest()).settingsMismatch).toBe(true);
  });
  it("is not a mismatch when the same categories are saved in a different order or case", async () => {
    repo.latestBrief.mockResolvedValue(stored());
    repo.getSettings.mockResolvedValue({ ...settings, categories: ["chatgpt", "ai TOOLS"] });
    expect((await getLatest()).settingsMismatch).toBe(false);
  });
  it("marks the brief stale when the newest run failed after it was saved", async () => {
    const created = new Date(Date.now() - 3_600_000);
    repo.latestBrief.mockResolvedValue(stored({ createdAt: created }));
    repo.latestRun.mockResolvedValue({ status: "failed", error: "YouTube quota exceeded", startedAt: new Date() });
    const r = await getLatest();
    expect(r.stale).toBe(true);
    expect(r.staleReason).toContain("YouTube quota exceeded");
  });
  it("ignores a failed run that happened BEFORE the saved brief", async () => {
    repo.latestBrief.mockResolvedValue(stored({ createdAt: new Date() }));
    repo.latestRun.mockResolvedValue({ status: "failed", error: "old", startedAt: new Date(Date.now() - 86_400_000) });
    expect((await getLatest()).stale).toBe(false);
  });
  it("marks briefs older than 8 days as stale", async () => {
    repo.latestBrief.mockResolvedValue(stored({ createdAt: new Date(Date.now() - 9 * 86_400_000) }));
    const r = await getLatest();
    expect(r.stale).toBe(true);
    expect(r.staleReason).toMatch(/week old/);
  });
  it("falls back to the seed with a stale notice when the database is down", async () => {
    repo.latestBrief.mockRejectedValue(new Error("connection refused"));
    const r = await getLatest();
    expect(r.brief).toEqual({ seed: true });
    expect(r.stale).toBe(true);
    expect(r.staleReason).toMatch(/Database unreachable/);
  });
});
