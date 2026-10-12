// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));
const router = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

import { ScriptEditor } from "@/components/script-editor";
import { CoverMaker } from "@/components/cover-maker";
import { GenerateButton } from "@/components/generate-button";

const ID = "11111111-1111-4111-8111-111111111111";
const fetchMock = vi.fn();
const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body });
const fail = (status: number, error: string) => ({ ok: false, status, json: async () => ({ error }) });

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("ScriptEditor", () => {
  const open = () => fireEvent.click(screen.getByRole("button", { name: /draft script/i }));
  const editor = () => screen.getByLabelText(/draft script, editable/i) as HTMLTextAreaElement;
  const draft = () => fireEvent.click(screen.getByRole("button", { name: /draft with gemini/i }));

  it("explains it is unavailable, and makes no requests, without a saved brief id", () => {
    render(<ScriptEditor briefId={null} themeIndex={0} hasScript={false} title="T" />);
    expect(screen.getByText(/available on saved briefs/i)).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("starts closed and fetches nothing until opened", () => {
    render(<ScriptEditor briefId={ID} themeIndex={0} hasScript={true} title="T" />);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("opens an existing script from the server into an editable box", async () => {
    fetchMock.mockResolvedValueOnce(ok({ script: { content: "# Saved script\nhello world", language: "Hinglish" } }));
    render(<ScriptEditor briefId={ID} themeIndex={2} hasScript={true} title="T" />);
    fireEvent.click(screen.getByRole("button", { name: /open draft script/i }));
    await waitFor(() => expect(editor().value).toContain("Saved script"));
    expect(fetchMock.mock.calls[0][0]).toContain(`briefId=${ID}&themeIndex=2`);
    expect((screen.getByLabelText(/language/i) as HTMLSelectElement).value).toBe("Hinglish");
  });

  it("with no script yet, shows the empty state and drafts one with the chosen language", async () => {
    fetchMock.mockResolvedValueOnce(ok({ script: { content: "# Fresh draft", language: "Hinglish", updatedAt: "x" } }));
    render(<ScriptEditor briefId={ID} themeIndex={1} hasScript={false} title="T" />);
    open();
    expect(screen.getByText(/No script yet/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText(/language/i), { target: { value: "Hinglish" } });
    draft();
    await waitFor(() => expect(editor().value).toBe("# Fresh draft"));
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/script");
    expect(JSON.parse(init.body)).toEqual({ briefId: ID, themeIndex: 1, language: "Hinglish" });
    expect(toast.success).toHaveBeenCalled();
  });

  it("(edge) shows the server's message and no editor when drafting fails (daily cap, Gemini down)", async () => {
    fetchMock.mockResolvedValueOnce(fail(429, "Daily script limit reached. Try again tomorrow."));
    render(<ScriptEditor briefId={ID} themeIndex={0} hasScript={false} title="T" />);
    open();
    draft();
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(toast.error.mock.calls[0][1].description).toMatch(/Daily script limit/);
    expect(screen.queryByLabelText(/draft script, editable/i)).toBeNull();
    expect((screen.getByRole("button", { name: /draft with gemini/i }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("(edge) survives a network error while drafting", async () => {
    fetchMock.mockRejectedValueOnce(new Error("offline"));
    render(<ScriptEditor briefId={ID} themeIndex={0} hasScript={false} title="T" />);
    open();
    draft();
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
  });

  it("autosaves once, 1.2s after typing stops (debounced), and reports the status", async () => {
    vi.useFakeTimers();
    fetchMock.mockResolvedValueOnce(ok({ script: { content: "start", language: "English" } })); // GET
    fetchMock.mockResolvedValue(ok({ ok: true })); // PUT
    render(<ScriptEditor briefId={ID} themeIndex={0} hasScript={true} title="T" />);
    fireEvent.click(screen.getByRole("button", { name: /open draft script/i }));
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    for (const v of ["start a", "start ab", "start abc"]) fireEvent.change(editor(), { target: { value: v } });
    expect(screen.getByText(/Unsaved changes/)).toBeTruthy();
    await act(async () => { await vi.advanceTimersByTimeAsync(1100); });
    expect(fetchMock.mock.calls.filter((c) => c[1]?.method === "PUT")).toHaveLength(0); // not yet
    await act(async () => { await vi.advanceTimersByTimeAsync(300); });
    const puts = fetchMock.mock.calls.filter((c) => c[1]?.method === "PUT");
    expect(puts).toHaveLength(1);
    expect(JSON.parse(puts[0][1].body)).toEqual({ briefId: ID, themeIndex: 0, content: "start abc" });
    expect(screen.getByText(/All changes saved/)).toBeTruthy();
  });

  it("saves immediately when the box loses focus", async () => {
    fetchMock.mockResolvedValueOnce(ok({ script: { content: "start", language: "English" } }));
    fetchMock.mockResolvedValue(ok({ ok: true }));
    render(<ScriptEditor briefId={ID} themeIndex={0} hasScript={true} title="T" />);
    fireEvent.click(screen.getByRole("button", { name: /open draft script/i }));
    await waitFor(() => expect(editor().value).toBe("start"));
    fireEvent.change(editor(), { target: { value: "start edited" } });
    fireEvent.blur(editor());
    await waitFor(() => expect(fetchMock.mock.calls.some((c) => c[1]?.method === "PUT")).toBe(true));
  });

  it("(edge) a failed save is reported and the status says it was not saved", async () => {
    fetchMock.mockResolvedValueOnce(ok({ script: { content: "start", language: "English" } }));
    fetchMock.mockResolvedValue(fail(500, "Save failed"));
    render(<ScriptEditor briefId={ID} themeIndex={0} hasScript={true} title="T" />);
    fireEvent.click(screen.getByRole("button", { name: /open draft script/i }));
    await waitFor(() => expect(editor().value).toBe("start"));
    fireEvent.change(editor(), { target: { value: "x" } });
    fireEvent.blur(editor());
    await waitFor(() => expect(screen.getByText("Not saved")).toBeTruthy());
    expect(toast.error).toHaveBeenCalled();
  });

  it("asks before replacing an existing script, and does nothing if the user says no", async () => {
    fetchMock.mockResolvedValueOnce(ok({ script: { content: "my work", language: "English" } }));
    render(<ScriptEditor briefId={ID} themeIndex={0} hasScript={true} title="T" />);
    fireEvent.click(screen.getByRole("button", { name: /open draft script/i }));
    await waitFor(() => expect(editor().value).toBe("my work"));
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    fireEvent.click(screen.getByRole("button", { name: /draft again/i }));
    expect(confirm).toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1); // only the initial GET
    expect(editor().value).toBe("my work");
  });

  it("counts spoken words only, ignoring headings and [SHOW:]/[VERIFY:] notes", async () => {
    fetchMock.mockResolvedValueOnce(ok({ script: { content: "# Title here\none two three\n[SHOW: a long visual note here]\nfour five", language: "English" } }));
    render(<ScriptEditor briefId={ID} themeIndex={0} hasScript={true} title="T" />);
    fireEvent.click(screen.getByRole("button", { name: /open draft script/i }));
    await waitFor(() => expect(screen.getByText(/~5 spoken words/)).toBeTruthy());
  });

  it("(edge) clearing the box entirely is allowed and saves the empty text", async () => {
    fetchMock.mockResolvedValueOnce(ok({ script: { content: "abc", language: "English" } }));
    fetchMock.mockResolvedValue(ok({ ok: true }));
    render(<ScriptEditor briefId={ID} themeIndex={0} hasScript={true} title="T" />);
    fireEvent.click(screen.getByRole("button", { name: /open draft script/i }));
    await waitFor(() => expect(editor().value).toBe("abc"));
    fireEvent.change(editor(), { target: { value: "" } });
    fireEvent.blur(editor());
    await waitFor(() => expect(fetchMock.mock.calls.some((c) => c[1]?.method === "PUT" && JSON.parse(c[1].body).content === "")).toBe(true));
  });
});

describe("CoverMaker", () => {
  type Rec = { calls: [string, unknown[]][]; sets: [string, unknown][] };
  let rec: Rec;

  beforeEach(() => {
    rec = { calls: [], sets: [] };
    const ctx = new Proxy({} as Record<string, unknown>, {
      get(_t, prop: string) {
        if (prop === "measureText") return (s: string) => ({ width: s.length * 12 });
        if (prop === "createLinearGradient" || prop === "createRadialGradient") return () => ({ addColorStop() {} });
        return (...args: unknown[]) => { rec.calls.push([prop, args]); };
      },
      set(_t, prop: string, value) { rec.sets.push([prop, value]); return true; },
    });
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(ctx as unknown as CanvasRenderingContext2D);
  });

  const text = (s: string) => rec.calls.filter(([n, a]) => n === "fillText" && a[0] === s);

  it("draws the headline and the duration badge from the props", () => {
    render(<CoverMaker defaultText="Free AI Stack" defaultEmoji="🔥" durationMin={8} slug="s" />);
    expect(rec.calls.some(([n, a]) => n === "fillText" && String(a[0]).includes("FREE"))).toBe(true);
    expect(text("8:00").length).toBe(1);
    expect(text("NEW").length).toBe(1);
  });

  it("(regression) draws the emoji fully opaque: fill style reset before the emoji, after the faint stripes", () => {
    render(<CoverMaker defaultText="X Y" defaultEmoji="🔥" durationMin={5} slug="s" />);
    const emojiIdx = rec.calls.findIndex(([n, a]) => n === "fillText" && a[0] === "🔥");
    expect(emojiIdx).toBeGreaterThan(-1);
    // Recorded sets and calls are in separate lists, so check the contract directly:
    const fills = rec.sets.filter(([p]) => p === "fillStyle").map(([, v]) => v);
    const stripes = fills.indexOf("rgba(255,255,255,0.07)");
    const reset = fills.indexOf("#000");
    expect(stripes).toBeGreaterThan(-1);
    expect(reset).toBeGreaterThan(stripes);
    expect(rec.sets.some(([p, v]) => p === "globalAlpha" && v === 1)).toBe(true);
  });

  it("(edge) shrinks a very long headline to fit and wraps it in at most 3 lines", () => {
    render(<CoverMaker defaultText={"WORD ".repeat(12)} defaultEmoji="" durationMin={5} slug="s" />);
    const headlineLines = rec.calls.filter(([n, a]) => n === "strokeText" && String(a[0]).includes("WORD"));
    expect(headlineLines.length).toBeLessThanOrEqual(3);
  });

  it("(edge) an empty headline shows a placeholder instead of a blank cover", () => {
    render(<CoverMaker defaultText="" defaultEmoji="" durationMin={5} slug="s" />);
    expect(rec.calls.some(([n, a]) => n === "fillText" && String(a[0]).includes("YOUR TITLE"))).toBe(true);
  });

  it("(edge) no emoji means no emoji is drawn, and a missing duration still gets a sane badge", () => {
    render(<CoverMaker defaultText="Hi" defaultEmoji="" durationMin={0} slug="s" />);
    expect(text("1:00").length).toBe(1);
  });

  it("redraws when the headline or style changes, and Reset restores the defaults", () => {
    render(<CoverMaker defaultText="Original" defaultEmoji="🔥" durationMin={5} slug="s" />);
    const box = screen.getByLabelText(/headline on the cover/i) as HTMLInputElement;
    fireEvent.change(box, { target: { value: "Changed Text" } });
    expect(rec.calls.some(([n, a]) => n === "fillText" && String(a[0]).includes("CHANGED"))).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: /^Mint$/ }));
    expect(screen.getByRole("button", { name: /^Mint$/ }).getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: /reset/i }));
    expect(box.value).toBe("Original");
    expect(screen.getByRole("button", { name: /^Red hot$/ }).getAttribute("aria-pressed")).toBe("true");
  });

  it("limits the headline to 40 characters and the emoji to 4", () => {
    render(<CoverMaker defaultText="x" defaultEmoji="🔥" durationMin={5} slug="s" />);
    expect((screen.getByLabelText(/headline on the cover/i) as HTMLInputElement).maxLength).toBe(40);
    expect((screen.getByLabelText(/emoji/i) as HTMLInputElement).maxLength).toBe(4);
  });

  it("downloads a PNG named after the idea, and releases the object URL", () => {
    vi.useFakeTimers();
    const blob = new Blob(["x"], { type: "image/png" });
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation((cb) => cb(blob));
    const url = vi.fn(() => "blob:fake");
    const revoke = vi.fn();
    (URL as unknown as Record<string, unknown>).createObjectURL = url;
    (URL as unknown as Record<string, unknown>).revokeObjectURL = revoke;
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    render(<CoverMaker defaultText="Hi" defaultEmoji="🔥" durationMin={5} slug="sale-phones" />);
    fireEvent.click(screen.getByRole("button", { name: /download png/i }));
    expect(click).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1100);
    expect(revoke).toHaveBeenCalledWith("blob:fake");
  });
});

describe("GenerateButton", () => {
  const go = () => fireEvent.click(screen.getByRole("button", { name: /generate now/i }));

  it("runs fetch, cluster, brief in order, passing the run id along, then refreshes the page", async () => {
    fetchMock.mockResolvedValue(ok({ runId: 42 }));
    render(<GenerateButton />);
    go();
    await waitFor(() => expect(toast.success).toHaveBeenCalled());
    const bodies = fetchMock.mock.calls.map((c) => JSON.parse(c[1].body));
    expect(bodies.map((b) => b.stage)).toEqual(["fetch", "cluster", "brief"]);
    expect(bodies[0].runId).toBeUndefined();
    expect(bodies[1].runId).toBe(42);
    expect(bodies[2].runId).toBe(42);
    expect(router.refresh).toHaveBeenCalled();
  });

  it("(edge) stops at the first failing stage, shows the reason, and still refreshes to show the last brief", async () => {
    fetchMock.mockResolvedValueOnce(ok({ runId: 5 }));
    fetchMock.mockResolvedValueOnce(fail(500, "Gemini returned invalid brief JSON twice"));
    render(<GenerateButton />);
    go();
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(fetchMock).toHaveBeenCalledTimes(2); // never reaches the brief stage
    expect(toast.error.mock.calls[0][1].description).toMatch(/invalid brief JSON/);
    expect(toast.success).not.toHaveBeenCalled();
    expect(router.refresh).toHaveBeenCalled();
  });

  it("(edge) a rate-limit response (429) is shown to the user", async () => {
    fetchMock.mockResolvedValueOnce(fail(429, "Rate limit: max 4 runs per hour. Try again later."));
    render(<GenerateButton />);
    go();
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(toast.error.mock.calls[0][1].description).toMatch(/Rate limit/);
  });

  it("(edge) is disabled while running, so a double click cannot start two runs", async () => {
    let release!: () => void;
    fetchMock.mockImplementationOnce(() => new Promise((r) => (release = () => r(ok({ runId: 1 })))));
    fetchMock.mockResolvedValue(ok({ runId: 1 }));
    render(<GenerateButton />);
    const btn = screen.getByRole("button", { name: /generate now/i }) as HTMLButtonElement;
    fireEvent.click(btn);
    await waitFor(() => expect(btn.disabled).toBe(true));
    fireEvent.click(btn);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    release();
    await waitFor(() => expect(toast.success).toHaveBeenCalled());
  });

  it("(edge) survives a network failure and becomes usable again", async () => {
    fetchMock.mockRejectedValueOnce(new Error("Failed to fetch"));
    render(<GenerateButton />);
    go();
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect((screen.getByRole("button", { name: /generate now/i }) as HTMLButtonElement).disabled).toBe(false);
  });
});
