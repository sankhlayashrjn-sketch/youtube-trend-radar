// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

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
  type Ev = ["set" | "call", string, unknown];
  let events: Ev[];
  let imageData: number[] = []; // what "reading the pixels of the photo" returns

  beforeEach(() => {
    events = [];
    imageData = [];
    const ctx = new Proxy({} as Record<string, unknown>, {
      get(_t, prop: string) {
        if (prop === "measureText") return (s: string) => ({ width: s.length * 12 });
        if (prop === "getImageData") return () => ({ data: imageData });
        if (prop === "createLinearGradient" || prop === "createRadialGradient") return () => ({ addColorStop: (o: number, c: string) => { events.push(["call", "addColorStop", [o, c]]); } });
        return (...args: unknown[]) => { events.push(["call", prop, args]); };
      },
      set(_t, prop: string, value) { events.push(["set", prop, value]); return true; },
    });
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(ctx as unknown as CanvasRenderingContext2D);
  });

  /** Every fillText with the fill colour that was active when it was drawn. */
  const texts = () => {
    let fill: unknown;
    const out: { text: string; fill: unknown }[] = [];
    for (const [kind, name, v] of events) {
      if (kind === "set" && name === "fillStyle") fill = v;
      if (kind === "call" && name === "fillText") out.push({ text: String((v as unknown[])[0]), fill });
    }
    return out;
  };
  // the most recent draw of that text (the canvas is redrawn after every change)
  const drawn = (s: string) => [...texts()].reverse().find((t) => t.text === s);
  const props = { defaultText: "Best Phone Deals", defaultKicker: "Buyer's guide", exampleTitles: ["Best phone deals today", "Phone deals compared", "Top phone picks"], stats: { views: "3.6Cr", creators: 19, velocity: "10.9K/hr" }, slug: "s" };
  const MIDNIGHT_ACCENT = "#4da3ff";

  it("draws the headline in capitals, word by word, with the label above it", () => {
    render(<CoverMaker {...props} />);
    for (const w of ["BEST", "PHONE", "DEALS"]) expect(drawn(w)).toBeTruthy();
    expect(drawn("BUYER'S GUIDE")).toBeTruthy();
  });

  it("highlights the word that is trending in the example titles, and nothing else", () => {
    render(<CoverMaker {...props} />);
    expect(drawn("PHONE")?.fill).toBe(MIDNIGHT_ACCENT);
    expect(drawn("BEST")?.fill).toBe("#ffffff");
    expect(drawn("DEALS")?.fill).toBe("#ffffff");
  });

  it("lets you pick a different word to highlight, and go back to automatic", () => {
    render(<CoverMaker {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "DEALS" }));
    expect(screen.getByRole("button", { name: "DEALS" }).getAttribute("aria-pressed")).toBe("true");
    expect(drawn("DEALS")?.fill).toBe(MIDNIGHT_ACCENT);
    fireEvent.click(screen.getByRole("button", { name: /auto/i }));
    expect(screen.getByRole("button", { name: "PHONE" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("(regression) is professional: no emoji, no NEW sticker, no timestamp badge", () => {
    render(<CoverMaker {...props} />);
    const all = texts().map((t) => t.text).join(" ");
    expect(all).not.toMatch(/NEW\b/);
    expect(all).not.toMatch(/\d:\d\d/);
    expect(all).not.toMatch(/\p{Extended_Pictographic}/u);
    expect(screen.queryByLabelText(/emoji/i)).toBeNull();
  });

  it("shows this week's real numbers as the focal graphic, and can hide them", () => {
    render(<CoverMaker {...props} />);
    for (const s of ["THIS WEEK", "3.6Cr", "19", "10.9K/hr"]) expect(drawn(s)).toBeTruthy();
    events.length = 0;
    fireEvent.click(screen.getByLabelText(/show this week's numbers/i));
    expect(drawn("3.6Cr")).toBeUndefined();
    expect(drawn("BEST")).toBeTruthy();
  });

  it("without stats it still draws a clean headline-only cover", () => {
    render(<CoverMaker {...props} stats={null} />);
    expect(drawn("THIS WEEK")).toBeUndefined();
    expect(screen.queryByLabelText(/show this week's numbers/i)).toBeNull();
  });

  it("(edge) a very long headline is wrapped into at most 3 lines", () => {
    render(<CoverMaker {...props} defaultText={"WORD ".repeat(12)} />);
    const ys = new Set(events.filter(([k, n, a]) => k === "call" && n === "fillText" && String((a as unknown[])[0]) === "WORD").map(([, , a]) => (a as number[])[2]));
    expect(ys.size).toBeGreaterThanOrEqual(1);
    expect(ys.size).toBeLessThanOrEqual(3);
  });

  it("(regression) an empty headline draws nothing: no placeholder text and no accent rule", () => {
    render(<CoverMaker {...props} defaultText="" defaultKicker="" stats={null} />);
    expect(texts()).toEqual([]);
    expect(events.some(([k, n]) => k === "call" && n === "roundRect")).toBe(false);
  });

  it("(regression) clearing the headline in the field removes it from the cover", () => {
    render(<CoverMaker {...props} />);
    expect(drawn("BEST")).toBeTruthy();
    events.length = 0;
    fireEvent.change(screen.getByLabelText(/headline on the cover/i), { target: { value: "" } });
    expect(texts().some((t) => ["BEST", "PHONE", "DEALS", "YOUR", "TITLE"].includes(t.text))).toBe(false);
  });

  it("an empty headline is a valid choice, not an error", () => {
    render(<CoverMaker {...props} />);
    fireEvent.change(screen.getByLabelText(/headline on the cover/i), { target: { value: "" } });
    const checks = screen.getByLabelText("Thumbnail checks").textContent ?? "";
    expect(checks).toMatch(/No headline/);
    expect(checks).not.toMatch(/Aim for 2 to 4 words/);
  });

  it("(edge) no label means no label is drawn", () => {
    render(<CoverMaker {...props} defaultKicker="" />);
    expect(texts().some((t) => t.text.includes("GUIDE"))).toBe(false);
  });

  it("switches colour style and redraws with that style's accent", () => {
    render(<CoverMaker {...props} />);
    fireEvent.click(screen.getByRole("button", { name: /^Graphite$/ }));
    expect(screen.getByRole("button", { name: /^Graphite$/ }).getAttribute("aria-pressed")).toBe("true");
    expect(drawn("PHONE")?.fill).toBe("#ff8a1f");
  });

  it("explains how good the cover is: 2-4 words passes, 1 or 7 words warns", () => {
    render(<CoverMaker {...props} />);
    expect(within(screen.getByLabelText("Thumbnail checks")).getByText(/3 words/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText(/headline on the cover/i), { target: { value: "FREE" } });
    expect(screen.getByLabelText("Thumbnail checks").textContent).toMatch(/Aim for 2 to 4 words/);
    fireEvent.change(screen.getByLabelText(/headline on the cover/i), { target: { value: "ONE TWO THREE FOUR FIVE SIX SEVEN" } });
    expect(screen.getByLabelText("Thumbnail checks").textContent).toMatch(/Aim for 2 to 4 words|trim it/);
  });

  it("Reset restores the original text, label, style and highlight", () => {
    render(<CoverMaker {...props} />);
    fireEvent.change(screen.getByLabelText(/headline on the cover/i), { target: { value: "Changed Text" } });
    fireEvent.click(screen.getByRole("button", { name: /^Ember$/ }));
    fireEvent.click(screen.getByRole("button", { name: /reset/i }));
    expect((screen.getByLabelText(/headline on the cover/i) as HTMLInputElement).value).toBe("Best Phone Deals");
    expect(screen.getByRole("button", { name: /^Midnight$/ }).getAttribute("aria-pressed")).toBe("true");
  });

  it("limits the headline to 40 characters and the label to 28", () => {
    render(<CoverMaker {...props} />);
    expect((screen.getByLabelText(/headline on the cover/i) as HTMLInputElement).maxLength).toBe(40);
    expect((screen.getByLabelText(/label above the headline/i) as HTMLInputElement).maxLength).toBe(28);
  });

  describe("adding a photo", () => {
    const pick = (file: File) => fireEvent.change(screen.getByLabelText(/add your photo or product shot/i), { target: { files: [file] } });

    beforeEach(() => {
      (URL as unknown as Record<string, unknown>).createObjectURL = vi.fn(() => "blob:photo");
      (URL as unknown as Record<string, unknown>).revokeObjectURL = vi.fn();
      vi.stubGlobal("Image", class { onload: (() => void) | null = null; onerror: (() => void) | null = null; width = 800; height = 600; set src(_v: string) { setTimeout(() => this.onload?.(), 0); } });
    });

    it("rejects a file that is not an image, and one over 8 MB, with a clear message", () => {
      render(<CoverMaker {...props} />);
      pick(new File(["x"], "notes.txt", { type: "text/plain" }));
      expect(screen.getByRole("alert").textContent).toMatch(/image file/i);
      pick(new File([new Uint8Array(8 * 1024 * 1024 + 1)], "huge.png", { type: "image/png" }));
      expect(screen.getByRole("alert").textContent).toMatch(/over 8 MB/);
    });

    it("draws the photo instead of the numbers, and can remove it again", async () => {
      render(<CoverMaker {...props} />);
      pick(new File(["x"], "me.png", { type: "image/png" }));
      await waitFor(() => expect(screen.getByRole("button", { name: /change photo/i })).toBeTruthy());
      expect(events.some(([k, n]) => k === "call" && n === "drawImage")).toBe(true);
      expect(texts().filter((t) => t.text === "3.6Cr").length).toBeLessThanOrEqual(1); // only the earlier first draw
      fireEvent.click(screen.getByRole("button", { name: /remove photo/i }));
      expect(screen.getByRole("button", { name: /add your photo/i })).toBeTruthy();
    });

    const addPhoto = async () => {
      render(<CoverMaker {...props} />);
      pick(new File(["x"], "me.png", { type: "image/png" }));
      await waitFor(() => expect(screen.getByRole("button", { name: /change photo/i })).toBeTruthy());
    };
    const lastImage = () => [...events].reverse().find(([k, n]) => k === "call" && n === "drawImage")?.[2] as unknown[] | undefined;
    const stops = () => events.filter(([k, n]) => k === "call" && n === "addColorStop").map(([, , a]) => String((a as unknown[])[1]));

    it("(regression) the photo IS the cover by default: it fills the whole canvas, not just a right-hand panel", async () => {
      await addPhoto();
      expect(screen.getByRole("button", { name: "Full image" }).getAttribute("aria-pressed")).toBe("true");
      // the stand-in image is 800x600; filling 1280x720 means scale 1.6 -> 1280x960, centred vertically
      expect(lastImage()?.slice(1)).toEqual([0, -120, 1280, 960]);
    });

    it("(regression) with your image there is no default vignette, glow or panel on top of it", async () => {
      await addPhoto();
      events.length = 0;
      // a genuine redraw (selecting the already-selected layout would not redraw)
      fireEvent.click(screen.getByRole("button", { name: /^Graphite$/ }));
      expect(stops().some((c) => c === "rgba(0,0,0,0.42)")).toBe(false); // the vignette
      expect(texts().some((t) => t.text === "THIS WEEK")).toBe(false); // the stats panel
    });

    it("'Fit whole image' never crops: the full image is visible, centred on the background", async () => {
      await addPhoto();
      fireEvent.click(screen.getByRole("button", { name: "Fit whole image" }));
      expect(lastImage()?.slice(1)).toEqual([160, 0, 960, 720]);
    });

    it("'Side photo' keeps the old split layout (photo drawn through a fade layer)", async () => {
      await addPhoto();
      events.length = 0;
      fireEvent.click(screen.getByRole("button", { name: "Side photo" }));
      const imgs = events.filter(([k, n]) => k === "call" && n === "drawImage");
      expect(imgs.length).toBeGreaterThanOrEqual(2);
      expect((imgs[imgs.length - 1][2] as unknown[])[0]).toBeInstanceOf(HTMLCanvasElement);
      expect(stops().some((c) => c === "rgba(0,0,0,0.42)")).toBe(true); // vignette is back
    });

    it("(regression) clearing headline and label shows your image exactly as it is: no text, no darkening", async () => {
      await addPhoto();
      fireEvent.change(screen.getByLabelText(/headline on the cover/i), { target: { value: "" } });
      fireEvent.change(screen.getByLabelText(/label above the headline/i), { target: { value: "" } });
      events.length = 0;
      // a genuine redraw (selecting the already-selected layout would not redraw)
      fireEvent.click(screen.getByRole("button", { name: /^Graphite$/ }));
      expect(texts()).toEqual([]);
      expect(events.some(([k, n]) => k === "call" && n === "roundRect")).toBe(false);
      expect(stops().some((c) => c.startsWith("rgba(0,0,0,"))).toBe(false); // no scrim at all
      expect(lastImage()).toBeTruthy();
      expect(screen.getByLabelText("Thumbnail checks").textContent).toMatch(/exactly as it is/);
    });

    it("darkens behind the text only when there is text, and the slider controls how much", async () => {
      await addPhoto();
      expect(stops().some((c) => c === "rgba(0,0,0,0.43)")).toBe(true); // 45% default
      const slider = screen.getByLabelText("Darken behind text") as HTMLInputElement;
      events.length = 0;
      fireEvent.change(slider, { target: { value: "80" } });
      expect(stops().some((c) => c === "rgba(0,0,0,0.76)")).toBe(true);
      events.length = 0;
      fireEvent.change(slider, { target: { value: "0" } });
      expect(stops().some((c) => c.startsWith("rgba(0,0,0,"))).toBe(false);
    });

    it("hides the darken slider when there is no text or in the side layout", async () => {
      await addPhoto();
      fireEvent.click(screen.getByRole("button", { name: "Side photo" }));
      expect(screen.queryByLabelText("Darken behind text")).toBeNull();
      fireEvent.click(screen.getByRole("button", { name: "Full image" }));
      expect(screen.getByLabelText("Darken behind text")).toBeTruthy();
      fireEvent.change(screen.getByLabelText(/headline on the cover/i), { target: { value: "" } });
      fireEvent.change(screen.getByLabelText(/label above the headline/i), { target: { value: "" } });
      expect(screen.queryByLabelText("Darken behind text")).toBeNull();
    });

    it("text on a photo gets a stronger shadow so it stays readable", async () => {
      await addPhoto();
      const blur = events.filter(([k, n]) => k === "set" && n === "shadowBlur").map(([, , v]) => v);
      expect(blur).toContain(36);
    });

    it("Reset drops the photo and returns to the default layout", async () => {
      await addPhoto();
      fireEvent.click(screen.getByRole("button", { name: "Fit whole image" }));
      fireEvent.click(screen.getByRole("button", { name: /reset/i }));
      expect(screen.queryByRole("group", { name: "Photo layout" })).toBeNull();
      expect(screen.getByRole("button", { name: /add your photo/i })).toBeTruthy();
    });

    const slider = () => screen.getByLabelText("Darken behind text") as HTMLInputElement;
    const solid = (v: number) => Array.from({ length: 29 * 36 }).flatMap(() => [v, v, v, 255]);

    it("(regression) a light image gets a stronger default darkening so the text stays readable", async () => {
      imageData = solid(250);
      await addPhoto();
      expect(slider().value).toBe("70");
    });

    it("a dark image needs less darkening, so it stays as untouched as possible", async () => {
      imageData = solid(15);
      await addPhoto();
      expect(slider().value).toBe("30");
    });

    it("(edge) when the image cannot be measured it falls back to 45%", async () => {
      imageData = [];
      await addPhoto();
      expect(slider().value).toBe("45");
    });

    it("the creator can still override the automatic darkening", async () => {
      imageData = solid(250);
      await addPhoto();
      fireEvent.change(slider(), { target: { value: "20" } });
      expect(slider().value).toBe("20");
    });

    it("(edge) a new photo always starts in the full-image layout", async () => {
      await addPhoto();
      fireEvent.click(screen.getByRole("button", { name: "Side photo" }));
      pick(new File(["x"], "second.png", { type: "image/png" }));
      await waitFor(() => expect(screen.getByRole("button", { name: "Full image" }).getAttribute("aria-pressed")).toBe("true"));
    });

    it("(edge) a photo that fails to load shows an error and keeps the cover as it was", async () => {
      vi.stubGlobal("Image", class { onload: (() => void) | null = null; onerror: (() => void) | null = null; set src(_v: string) { setTimeout(() => this.onerror?.(), 0); } });
      render(<CoverMaker {...props} />);
      pick(new File(["x"], "broken.png", { type: "image/png" }));
      await waitFor(() => expect(screen.getByRole("alert").textContent).toMatch(/Couldn't read/));
      expect(screen.getByRole("button", { name: /add your photo/i })).toBeTruthy();
    });
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
    render(<CoverMaker {...props} slug="sale-phones" />);
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
