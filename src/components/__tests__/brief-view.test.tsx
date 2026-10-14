// @vitest-environment jsdom
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { BRIEF, THEMES, fullVideo, legacyVideo, mkTheme } from "@/lib/__tests__/fixtures";

// Recharts needs real layout; the chart has its own browser checks.
vi.mock("@/components/opportunity-map", () => ({
  OpportunityMap: ({ onSelect }: { onSelect: (i: number) => void }) => (
    <div data-testid="map"><button type="button" onClick={() => onSelect(2)}>map: pick theme 3</button></div>
  ),
}));
// The cover maker and script editor have their own tests; here we check how the dashboard wires them.
vi.mock("@/components/cover-maker", () => ({
  CoverMaker: () => {
    const [v, setV] = useState("");
    return <input aria-label="cover stub" value={v} onChange={(e) => setV(e.target.value)} />;
  },
}));
vi.mock("@/components/script-editor", () => ({
  ScriptEditor: (p: { briefId: string | null; themeIndex: number; hasScript: boolean; defaultOpen?: boolean }) => (
    <div data-testid="script-editor" data-brief={p.briefId ?? ""} data-index={p.themeIndex} data-has={String(p.hasScript)} data-open={String(!!p.defaultOpen)} />
  ),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { BriefView } from "@/components/brief-view";

const ID = "11111111-1111-4111-8111-111111111111";
const scrollIntoView = vi.fn();

beforeEach(() => {
  scrollIntoView.mockClear();
  Element.prototype.scrollIntoView = scrollIntoView;
  // run animation frames immediately, so a scroll scheduled by one test can never fire inside the next
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => { cb(0); return 0; });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const workspaceTitle = () => screen.getByRole("heading", { level: 3 }).textContent;
const row = (name: RegExp) => within(screen.getByRole("list", { name: "Themes" })).getByRole("button", { name });
const tab = (name: RegExp) => screen.getByRole("tab", { name });
const rowNames = () => within(screen.getByRole("list", { name: "Themes" })).getAllByRole("button").map((b) => b.textContent ?? "");

describe("the dashboard is one clear flow: read, choose, plan", () => {
  it("has three numbered steps, in order, each with a heading", () => {
    render(<BriefView brief={BRIEF} />);
    const headings = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
    expect(headings).toEqual(["Step 1: Read the week", "Step 2: Choose what to film", "Step 3: Plan the video"]);
  });

  it("shows a step bar that links to each step", () => {
    render(<BriefView brief={BRIEF} />);
    const nav = screen.getByRole("navigation", { name: /dashboard steps/i });
    const hrefs = within(nav).getAllByRole("link").map((a) => a.getAttribute("href"));
    expect(hrefs).toEqual(["#week", "#choose", "#plan"]);
    expect(nav.textContent).toMatch(/Read the week.*Choose a theme.*Plan the video/);
  });

  it("step 1 shows exactly the three headline lines, and says what comes next", () => {
    render(<BriefView brief={BRIEF} />);
    const lines = within(screen.getByRole("list", { name: /this week in 3 lines/i })).getAllByRole("listitem");
    expect(lines.map((l) => l.textContent?.replace("▶", "").trim())).toEqual(BRIEF.headline);
    expect(screen.getByRole("link", { name: /next: choose what to film/i }).getAttribute("href")).toBe("#choose");
  });

  it("every step is an anchor target, so the step bar and 'Next' links land somewhere", () => {
    const { container } = render(<BriefView brief={BRIEF} />);
    for (const id of ["week", "choose", "plan"]) expect(container.querySelector(`section#${id}`)).toBeTruthy();
  });

  it("never prints NaN, undefined or null anywhere", () => {
    const { container } = render(<BriefView brief={BRIEF} />);
    expect(container.textContent).not.toMatch(/NaN|undefined|null/);
  });

  it("copes with a brief that has only one theme", () => {
    render(<BriefView brief={{ ...BRIEF, themes: [THEMES[0]] }} />);
    expect(rowNames()).toHaveLength(1);
    expect(workspaceTitle()).toBe("Alpha Theme");
  });
});

describe("step 2: signals", () => {
  it("shows exactly three signals", () => {
    render(<BriefView brief={BRIEF} />);
    const tiles = within(screen.getByRole("list", { name: "Signals" })).getAllByRole("button");
    expect(tiles.map((t) => t.textContent)).toEqual([
      expect.stringContaining("Best bet"),
      expect.stringContaining("Most crowded"),
      expect.stringContaining("Audience loves"),
    ]);
  });

  it("(regression) there is no 'Fastest riser' signal anywhere", () => {
    const { container } = render(<BriefView brief={BRIEF} />);
    expect(container.textContent).not.toMatch(/fastest/i);
  });

  it("each signal selects the theme it points at and opens its workspace", () => {
    render(<BriefView brief={BRIEF} />);
    expect(workspaceTitle()).toBe("Alpha Theme"); // best bet is the starting point
    const signals = within(screen.getByRole("list", { name: "Signals" }));
    fireEvent.click(signals.getByRole("button", { name: /most crowded/i }));
    expect(workspaceTitle()).toBe("Bravo Theme"); // 20 creators
    fireEvent.click(signals.getByRole("button", { name: /audience loves/i }));
    expect(workspaceTitle()).toBe("Charlie Theme"); // highest engagement in the fixture
    fireEvent.click(signals.getByRole("button", { name: /best bet/i }));
    expect(workspaceTitle()).toBe("Alpha Theme");
  });
});

describe("step 2: choosing a theme", () => {
  it("starts with the best bet selected and labelled", () => {
    render(<BriefView brief={BRIEF} />);
    expect(row(/Alpha Theme/).getAttribute("aria-pressed")).toBe("true");
    expect(row(/Bravo Theme/).getAttribute("aria-pressed")).toBe("false");
    expect(row(/Alpha Theme/).textContent).toContain("Best bet");
    expect(row(/Bravo Theme/).textContent).not.toContain("Best bet");
  });

  it("each row has what you need to compare themes: creators, views, views per hour, urgency, opportunity", () => {
    render(<BriefView brief={BRIEF} />);
    const r = row(/Alpha Theme/);
    expect(r.textContent).toContain("4 creators");
    expect(r.textContent).toContain("5.0L views");
    expect(r.textContent).toContain("20.0K/hr");
    expect(r.textContent).toContain("Film now");
    const meter = within(r).getByRole("meter");
    const v = Number(meter.getAttribute("aria-valuenow"));
    expect(v).toBeGreaterThanOrEqual(0);
    expect(v).toBeLessThanOrEqual(100);
  });

  it("clicking a row selects it, moves to its workspace, and starts that workspace at 'Why it works'", () => {
    render(<BriefView brief={BRIEF} />);
    fireEvent.click(tab(/^Examples/));
    fireEvent.click(row(/Bravo Theme/));
    expect(row(/Bravo Theme/).getAttribute("aria-pressed")).toBe("true");
    expect(row(/Alpha Theme/).getAttribute("aria-pressed")).toBe("false");
    expect(workspaceTitle()).toBe("Bravo Theme");
    expect(tab(/Why it works/).getAttribute("aria-selected")).toBe("true");
  });

  it("scrolls to the plan when a theme is picked (a signal, a row, the big button, or the map)", () => {
    render(<BriefView brief={BRIEF} />);
    fireEvent.click(row(/Bravo Theme/));
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(scrollIntoView.mock.instances[0]).toBe(document.getElementById("plan"));
    fireEvent.click(screen.getByRole("button", { name: /plan .*bravo theme/i }));
    expect(scrollIntoView).toHaveBeenCalledTimes(2);
    fireEvent.click(within(screen.getByRole("list", { name: "Signals" })).getByRole("button", { name: /most crowded/i }));
    expect(scrollIntoView).toHaveBeenCalledTimes(3);
    fireEvent.click(screen.getByRole("button", { name: /compare all themes on a map/i }));
    fireEvent.click(screen.getByRole("button", { name: /map: pick theme 3/i }));
    expect(scrollIntoView).toHaveBeenCalledTimes(4);
  });

  it("(edge) a browser without scrollIntoView or animation frames does not break picking a theme", () => {
    vi.stubGlobal("requestAnimationFrame", undefined);
    Element.prototype.scrollIntoView = undefined as unknown as typeof Element.prototype.scrollIntoView;
    render(<BriefView brief={BRIEF} />);
    expect(() => fireEvent.click(row(/Bravo Theme/))).not.toThrow();
    expect(workspaceTitle()).toBe("Bravo Theme");
  });

  it("the main button always names the selected theme, so the next step is obvious", () => {
    render(<BriefView brief={BRIEF} />);
    expect(screen.getByRole("button", { name: /plan .*alpha theme/i })).toBeTruthy();
    fireEvent.click(row(/Charlie Theme/));
    expect(screen.getByRole("button", { name: /plan .*charlie theme/i })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /plan .*alpha theme/i })).toBeNull();
  });

  it("filters by urgency with counts, without changing which theme is open", () => {
    render(<BriefView brief={BRIEF} />);
    const group = screen.getByRole("group", { name: /filter by urgency/i });
    expect(within(group).getByRole("button", { name: /All\s*3/ })).toBeTruthy();
    fireEvent.click(within(group).getByRole("button", { name: /Skip\s*1/ }));
    expect(rowNames()).toHaveLength(1);
    expect(rowNames()[0]).toContain("Charlie Theme");
    expect(workspaceTitle()).toBe("Alpha Theme"); // still the theme you were planning
    fireEvent.click(within(group).getByRole("button", { name: /All/ }));
    expect(rowNames()).toHaveLength(3);
  });

  it("says so when a filter has no themes", () => {
    render(<BriefView brief={{ ...BRIEF, themes: [THEMES[0], THEMES[1], mkTheme("Delta Theme", "soon")] }} />);
    fireEvent.click(screen.getByRole("button", { name: /Skip\s*0/ }));
    expect(screen.getByText(/No themes in this group/)).toBeTruthy();
  });

  it("sorts the list, and the numbers on the rows stay the brief's own numbers", () => {
    render(<BriefView brief={BRIEF} />);
    const sort = screen.getByLabelText(/sort by/i) as HTMLSelectElement;
    expect([...sort.options].map((o) => o.textContent)).toEqual(["Brief order", "Rough income", "Opportunity", "Momentum", "Total views"]);
    fireEvent.change(sort, { target: { value: "income" } });
    expect(rowNames().map((n) => n.match(/(Alpha|Bravo|Charlie)/)?.[1])).toEqual(["Alpha", "Bravo", "Charlie"]);
    fireEvent.change(sort, { target: { value: "views" } });
    expect(rowNames().map((n) => n.match(/(Alpha|Bravo|Charlie)/)?.[1])).toEqual(["Bravo", "Alpha", "Charlie"]);
    fireEvent.change(sort, { target: { value: "momentum" } });
    expect(rowNames().map((n) => n.match(/(Alpha|Bravo|Charlie)/)?.[1])).toEqual(["Alpha", "Bravo", "Charlie"]);
    fireEvent.change(sort, { target: { value: "rank" } });
    expect(rowNames().map((n) => n.match(/(Alpha|Bravo|Charlie)/)?.[1])).toEqual(["Alpha", "Bravo", "Charlie"]);
    // Bravo is theme 2 in the brief, and still shows 2 while it is not selected
    expect(row(/Bravo Theme/).textContent).toMatch(/^2/);
  });

  it("keeps the opportunity map out of the way until you ask for it, and a bubble picks a theme", () => {
    render(<BriefView brief={BRIEF} />);
    const toggle = screen.getByRole("button", { name: /compare all themes on a map/i });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByTestId("map")).toBeNull();
    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: /map: pick theme 3/i }));
    expect(workspaceTitle()).toBe("Charlie Theme");
    fireEvent.click(toggle);
    expect(screen.queryByTestId("map")).toBeNull();
  });
});

describe("step 3: the workspace for the selected theme", () => {
  it("shows one theme at a time, with its name, urgency, summary and key numbers", () => {
    render(<BriefView brief={BRIEF} />);
    expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(1);
    const ws = screen.getByRole("article");
    expect(ws.textContent).toContain("Theme 1 of 3");
    expect(ws.textContent).toContain("Summary of Alpha Theme.");
    expect(ws.textContent).toContain("Film now");
    expect(ws.textContent).toContain("4 creators");
    expect(ws.textContent).toContain("~8 min");
  });

  it("has four tabs in workflow order, starting on 'Why it works'", () => {
    render(<BriefView brief={BRIEF} />);
    expect(within(screen.getByRole("tablist", { name: /plan this video/i })).getAllByRole("tab").map((t) => t.textContent?.replace(/\d+$/, ""))).toEqual(["Why it works", "Examples", "Cover", "Script"]);
    expect(tab(/Why it works/).getAttribute("aria-selected")).toBe("true");
  });

  it("'Why it works' leads with the recommendation, then the reasoning and the signals", () => {
    render(<BriefView brief={BRIEF} />);
    const panel = screen.getByRole("tabpanel");
    expect(within(panel).getByText("Film this")).toBeTruthy();
    expect(panel.textContent).toContain("Film: Alpha Theme"); // suggested title
    expect(panel.textContent).toContain("Angle for Alpha Theme");
    expect(panel.textContent).toContain("Reason film_now");
    expect(panel.textContent).toContain("Why now for Alpha Theme.");
    expect(panel.textContent).toContain("hands-on tutorial");
    expect(within(panel).getByRole("img", { name: /saturation: medium/i })).toBeTruthy();
    // the four score bars were removed on request
    expect(within(panel).queryAllByRole("meter")).toHaveLength(0);
    expect(panel.textContent).not.toMatch(/Momentum|Competition|Engagement/);
  });

  it("'Why it works' shows expected views and a rough income in rupees, from the example videos", () => {
    render(<BriefView brief={BRIEF} />);
    const panel = screen.getByRole("tabpanel");
    // Alpha: examples 2M, 30K, 900 -> median 30K, x1.15 (film now) x1 (medium crowding) = 34.5K views
    expect(within(panel).getByTestId("expected-views").textContent).toBe("34.5K");
    expect(within(panel).getByTestId("expected-income").textContent).toBe("₹2,800"); // 34,500 views at Rs 80 per 1,000
    expect(panel.textContent).toContain("Likely range");
      });

  it("the income follows the earnings-per-1,000-views setting, and the explainer text is gone", () => {
    render(<BriefView brief={BRIEF} rpm={160} />);
    const panel = screen.getByRole("tabpanel");
    expect(within(panel).getByTestId("expected-income").textContent).toBe("₹5,500"); // 34,500 views at Rs 160 per 1,000
    expect(panel.textContent).not.toContain("How this is worked out");
    expect(panel.textContent).toContain("₹160 per 1,000 views");
    expect(within(panel).queryByLabelText(/earnings per 1,000 views/i)).toBeNull(); // the input lives in Settings now
    expect(within(panel).getByRole("link", { name: "Settings" }).getAttribute("href")).toBe("/settings");
  });

  it("every theme row shows expected views and rough income, so themes can be compared by money", () => {
    render(<BriefView brief={BRIEF} rpm={80} />);
    const rows = within(screen.getByRole("list", { name: "Themes" })).getAllByTestId("row-income");
    expect(rows).toHaveLength(3);
    expect(rows[0].textContent).toContain("34.5K views");
    expect(rows[0].textContent).toContain("₹2,800");
    expect(rows[2].textContent).toContain("24.0K views"); // Charlie is 'skip': 30K x 0.8
  });

  it("sorting by rough income puts the highest earner first and follows the rate", () => {
    const rich = mkTheme("Rich Theme", "soon", { videos: [fullVideo("R1", 5_000_000), fullVideo("R2", 4_000_000), fullVideo("R3", 3_000_000)] });
    render(<BriefView brief={{ ...BRIEF, themes: [...THEMES, rich] }} rpm={80} />);
    fireEvent.change(screen.getByLabelText(/sort by/i), { target: { value: "income" } });
    expect(rowNames()[0]).toContain("Rich Theme");
  });

  it("'Why it works' explains each number against this week's average, with a verdict", () => {
    render(<BriefView brief={BRIEF} />);
    const panel = screen.getByRole("tabpanel");
    const guide = within(panel).getByRole("region", { name: /what these numbers mean/i });
    expect(guide.textContent).toContain("Is this a good number?");
    // Alpha has 4 creators vs an average of 11 (4, 20, 9): less crowded -> Good; fastest of the three -> Good
    const creators = guide.querySelector('[data-stat="creators"]')!;
    expect(creators.textContent).toContain("Good");
    expect(creators.textContent).toContain("Less crowded than most themes");
    expect(creators.textContent).toContain("11");
    expect(guide.querySelector('[data-stat="velocity"]')!.textContent).toContain("Growing faster than most themes");
  });

  it("the stats under the theme name show this week's average next to each figure", () => {
    render(<BriefView brief={BRIEF} />);
    const header = screen.getByRole("article").querySelector("header")!;
    expect(header.textContent).toContain("4 creators");
    expect(header.textContent).toContain("(avg 11)");
  });

  it("builds a tab only when it is first opened, then keeps it (hidden) so work is not lost", () => {
    const { container } = render(<BriefView brief={BRIEF} />);
    expect(container.querySelectorAll('[role="tabpanel"]')).toHaveLength(1);
    fireEvent.click(tab(/^Examples/));
    const panels = container.querySelectorAll('[role="tabpanel"]');
    expect(panels).toHaveLength(2);
    expect((panels[0] as HTMLElement).hidden).toBe(true);
    expect((panels[1] as HTMLElement).hidden).toBe(false);
    fireEvent.click(tab(/Why it works/));
    expect(container.querySelectorAll('[role="tabpanel"]')).toHaveLength(2);
  });

  it("each tab's panel is linked to its tab for screen readers", () => {
    render(<BriefView brief={BRIEF} />);
    const panel = screen.getByRole("tabpanel");
    expect(panel.getAttribute("aria-labelledby")).toBe(tab(/Why it works/).id);
    expect(tab(/Why it works/).getAttribute("aria-controls")).toBe(panel.id);
  });

  it("'Next' buttons lead through the whole workflow, one step at a time", () => {
    render(<BriefView brief={BRIEF} />);
    fireEvent.click(screen.getByRole("button", { name: /next: see the examples/i }));
    expect(tab(/^Examples/).getAttribute("aria-selected")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: /next: design the cover/i }));
    expect(tab(/Cover/).getAttribute("aria-selected")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: /next: draft the script/i }));
    expect(tab(/Script/).getAttribute("aria-selected")).toBe("true");
  });

  it("the last step has no 'Next' button and points back to choosing another theme", () => {
    render(<BriefView brief={BRIEF} />);
    fireEvent.click(tab(/Script/));
    const panel = screen.getByRole("tabpanel");
    expect(within(panel).queryByRole("button", { name: /^next/i })).toBeNull();
    expect(within(panel).getByRole("link", { name: /choose another theme/i }).getAttribute("href")).toBe("#choose");
    expect(panel.textContent).toMatch(/Step 4 of 4/);
  });

  it("arrow keys, Home and End move between tabs (and wrap)", () => {
    render(<BriefView brief={BRIEF} />);
    const list = screen.getByRole("tablist");
    fireEvent.keyDown(list, { key: "ArrowRight" });
    expect(tab(/^Examples/).getAttribute("aria-selected")).toBe("true");
    fireEvent.keyDown(list, { key: "End" });
    expect(tab(/Script/).getAttribute("aria-selected")).toBe("true");
    fireEvent.keyDown(list, { key: "ArrowRight" });
    expect(tab(/Why it works/).getAttribute("aria-selected")).toBe("true"); // wraps
    fireEvent.keyDown(list, { key: "ArrowLeft" });
    expect(tab(/Script/).getAttribute("aria-selected")).toBe("true"); // wraps back
    fireEvent.keyDown(list, { key: "Home" });
    expect(tab(/Why it works/).getAttribute("aria-selected")).toBe("true");
    fireEvent.keyDown(list, { key: "x" }); // unrelated keys do nothing
    expect(tab(/Why it works/).getAttribute("aria-selected")).toBe("true");
  });

  it("only the selected tab is in the tab order (roving tabindex)", () => {
    render(<BriefView brief={BRIEF} />);
    expect(tab(/Why it works/).tabIndex).toBe(0);
    expect(tab(/^Examples/).tabIndex).toBe(-1);
  });

  it("(regression) cover edits survive switching to another theme and back", () => {
    render(<BriefView brief={BRIEF} />);
    fireEvent.click(tab(/Cover/));
    fireEvent.change(screen.getByRole("textbox", { name: "cover stub" }), { target: { value: "my edit" } });
    fireEvent.click(row(/Bravo Theme/));
    expect(screen.queryByRole("textbox", { name: "cover stub" })).toBeNull(); // Bravo's cover tab has not been opened
    fireEvent.click(row(/Alpha Theme/));
    expect((screen.getByRole("textbox", { name: "cover stub" }) as HTMLInputElement).value).toBe("my edit");
  });

  it("the previous theme's workspace is hidden, not shown, while another is open", () => {
    const { container } = render(<BriefView brief={BRIEF} />);
    fireEvent.click(row(/Bravo Theme/));
    const wrappers = [...container.querySelectorAll("#plan > div[hidden], #plan > div:not([hidden])")];
    expect(wrappers).toHaveLength(2);
    expect(wrappers.filter((w) => !(w as HTMLElement).hidden)).toHaveLength(1);
    expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(1);
  });

  it("passes the saved brief id, the right theme index and whether a script exists to the script editor", () => {
    render(<BriefView brief={BRIEF} briefId={ID} scriptIdx={[1]} />);
    fireEvent.click(tab(/Script/));
    let ed = screen.getByTestId("script-editor");
    expect([ed.dataset.brief, ed.dataset.index, ed.dataset.has, ed.dataset.open]).toEqual([ID, "0", "false", "true"]);
    fireEvent.click(row(/Bravo Theme/));
    fireEvent.click(tab(/Script/));
    ed = screen.getAllByTestId("script-editor").find((e) => e.dataset.index === "1")!;
    expect(ed.dataset.has).toBe("true");
  });

  it("without a saved brief id the script editor gets none, so it can explain instead of failing", () => {
    render(<BriefView brief={BRIEF} briefId={null} />);
    fireEvent.click(tab(/Script/));
    expect(screen.getByTestId("script-editor").dataset.brief).toBe("");
  });
});

describe("the Examples tab", () => {
  const examples = () => screen.getByRole("list", { name: "Example videos" });

  it("shows every detail we have: views, age, duration, likes, comments, velocity, engagement", () => {
    render(<BriefView brief={BRIEF} />);
    fireEvent.click(tab(/^Examples/));
    const first = within(examples()).getAllByRole("listitem")[0];
    expect(within(first).getByText("12:34")).toBeTruthy();
    expect(first.textContent).toContain("20.0L views");
    expect(first.textContent).toContain("3 days ago");
    expect(first.textContent).toContain("4.4K");
    expect(first.textContent).toContain("1.3K");
    expect(first.textContent).toContain("8.1K/hr");
    expect(first.textContent).toContain("4.2% engaged");
  });

  it("opens the video and the channel safely in a new tab", () => {
    render(<BriefView brief={BRIEF} />);
    fireEvent.click(tab(/^Examples/));
    const links = within(examples()).getAllByRole("link");
    const video = links.find((l) => l.getAttribute("href")?.includes("watch?v=A1"))!;
    const channel = links.find((l) => l.getAttribute("href")?.includes("/channel/UCA1"))!;
    for (const l of [video, channel]) {
      expect(l.getAttribute("target")).toBe("_blank");
      expect(l.getAttribute("rel")).toContain("noopener");
    }
  });

  it("shows the number of examples on the tab itself", () => {
    render(<BriefView brief={BRIEF} />);
    expect(tab(/^Examples/).textContent).toBe("Examples3");
  });

  it("(regression) the minimum-views setting hides small examples, counts them, and explains itself", () => {
    render(<BriefView brief={BRIEF} minViews={25_000} />);
    expect(tab(/^Examples/).textContent).toBe("Examples2");
    fireEvent.click(tab(/^Examples/));
    const panel = screen.getAllByRole("tabpanel").find((p) => !p.hidden)!;
    expect(panel.textContent).toMatch(/Showing 2 of 3 above 25\.0K views/);
    expect(panel.textContent).toContain("Change this in Settings");
    expect(within(panel).queryByText("Title A3")).toBeNull();
    expect(within(panel).getByText("Title A1")).toBeTruthy();
  });

  it("(regression) when every example is below the minimum it says so instead of an empty gap", () => {
    render(<BriefView brief={BRIEF} minViews={5_000_000} />);
    fireEvent.click(tab(/^Examples/));
    expect(screen.getByText(/No example videos above 50\.0L views/)).toBeTruthy();
    expect(screen.queryByRole("list", { name: "Example videos" })).toBeNull();
  });

  it("shows no limit note and every example when the minimum is 0", () => {
    render(<BriefView brief={BRIEF} />);
    fireEvent.click(tab(/^Examples/));
    expect(screen.queryByText(/Change this in Settings/)).toBeNull();
    expect(screen.getByText("Title A3")).toBeTruthy();
  });

  it("(regression) older briefs without the extra fields still render with just the basics", () => {
    const old = { ...BRIEF, themes: [mkTheme("Old Theme", "soon", { videos: [legacyVideo("o1", 500_000)] }), THEMES[1], THEMES[2]] };
    render(<BriefView brief={old} />);
    fireEvent.click(row(/Old Theme/));
    fireEvent.click(tab(/^Examples/));
    const panel = screen.getAllByRole("tabpanel").find((p) => !p.hidden)!;
    expect(within(panel).getByText("Legacy o1")).toBeTruthy();
    expect(panel.textContent).toContain("5.0L views");
    expect(panel.textContent).not.toMatch(/NaN|undefined/);
    expect(within(panel).queryByText(/engaged/)).toBeNull();
  });

  it("one theme with no examples left does not affect the others", () => {
    const b = { ...BRIEF, themes: [mkTheme("Solo Theme", "soon", { videos: [fullVideo("s1", 100)] }), THEMES[1], THEMES[2]] };
    render(<BriefView brief={b} minViews={1_000_000} />);
    fireEvent.click(row(/Solo Theme/));
    fireEvent.click(tab(/^Examples/));
    expect(screen.getByText(/No example videos above/)).toBeTruthy();
    fireEvent.click(row(/Bravo Theme/));
    fireEvent.click(tab(/^Examples/));
    expect(screen.getByText("Title B1")).toBeTruthy();
  });
});
