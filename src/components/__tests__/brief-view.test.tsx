// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { BRIEF, THEMES, fullVideo, legacyVideo, mkTheme } from "@/lib/__tests__/fixtures";

// Recharts needs real layout; the chart has its own browser checks.
vi.mock("@/components/signals-panel", () => ({ SignalsPanel: () => <div data-testid="signals" /> }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { BriefView } from "@/components/brief-view";

afterEach(cleanup);

const order = () => screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent);

describe("BriefView", () => {
  it("shows exactly the three headline lines and every theme", () => {
    render(<BriefView brief={BRIEF} />);
    for (const l of BRIEF.headline) expect(screen.getByText(l)).toBeTruthy();
    expect(order()).toEqual(["Alpha Theme", "Bravo Theme", "Charlie Theme"]);
    expect(screen.getByTestId("signals")).toBeTruthy();
  });

  it("filter chips show a count per urgency and filter the cards", () => {
    render(<BriefView brief={BRIEF} />);
    const group = screen.getByRole("group", { name: /filter by urgency/i });
    expect(within(group).getByRole("button", { name: /All themes\s*3/ })).toBeTruthy();
    fireEvent.click(within(group).getByRole("button", { name: /Film now\s*1/ }));
    expect(order()).toEqual(["Alpha Theme"]);
    expect(within(group).getByRole("button", { name: /Film now/ }).getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(within(group).getByRole("button", { name: /Skip\s*1/ }));
    expect(order()).toEqual(["Charlie Theme"]);
    fireEvent.click(within(group).getByRole("button", { name: /All themes/ }));
    expect(order()).toHaveLength(3);
  });

  it("shows a friendly message when a filter has no themes", () => {
    const noSkip = { ...BRIEF, themes: [THEMES[0], THEMES[1], mkTheme("Delta Theme", "soon")] };
    render(<BriefView brief={noSkip} />);
    fireEvent.click(screen.getByRole("button", { name: /Skip\s*0/ }));
    expect(screen.getByText(/No themes in this group/)).toBeTruthy();
  });

  it("sorts by total views and by momentum, and returns to brief order", () => {
    render(<BriefView brief={BRIEF} />);
    const sort = screen.getByRole("group", { name: /sort themes/i });
    fireEvent.click(within(sort).getByRole("button", { name: "Total views" }));
    expect(order()).toEqual(["Bravo Theme", "Alpha Theme", "Charlie Theme"]);
    fireEvent.click(within(sort).getByRole("button", { name: "Momentum" }));
    expect(order()).toEqual(["Alpha Theme", "Bravo Theme", "Charlie Theme"]);
    fireEvent.click(within(sort).getByRole("button", { name: "Brief order" }));
    expect(order()).toEqual(["Alpha Theme", "Bravo Theme", "Charlie Theme"]);
  });

  it("keeps the original rank number on a card even when sorting reorders it", () => {
    render(<BriefView brief={BRIEF} />);
    fireEvent.click(within(screen.getByRole("group", { name: /sort themes/i })).getByRole("button", { name: "Total views" }));
    const first = screen.getAllByRole("article")[0];
    expect(within(first).getByRole("heading", { level: 3 }).textContent).toBe("Bravo Theme");
    expect(first.id).toBe("theme-2");
  });

  it("(regression) minimum views hides small examples, counts them, and explains itself", () => {
    render(<BriefView brief={BRIEF} minViews={25_000} />);
    expect(screen.getAllByText(/Example videos limited to/).length).toBeGreaterThan(0);
    const card = screen.getAllByRole("article")[0];
    expect(within(card).getByText(/2 of 3 above 25\.0K views/)).toBeTruthy();
    expect(within(card).queryByText("Title A3")).toBeNull();
    expect(within(card).getByText("Title A1")).toBeTruthy();
  });

  it("(regression) when every example is below the minimum it says so instead of an empty gap", () => {
    render(<BriefView brief={BRIEF} minViews={5_000_000} />);
    const card = screen.getAllByRole("article")[0];
    expect(within(card).getByText(/No example videos above 50\.0L views/)).toBeTruthy();
  });

  it("shows no limit note and every example when minViews is 0", () => {
    render(<BriefView brief={BRIEF} />);
    expect(screen.queryByText(/Example videos limited to/)).toBeNull();
    expect(within(screen.getAllByRole("article")[0]).getByText("Title A3")).toBeTruthy();
  });

  it("(regression) one theme without examples after filtering does not break the others", () => {
    const b = { ...BRIEF, themes: [mkTheme("Solo Theme", "soon", { videos: [fullVideo("s1", 100)] }), THEMES[1], THEMES[2]] };
    render(<BriefView brief={b} minViews={1_000_000} />);
    expect(screen.getAllByRole("article")).toHaveLength(3);
  });
});

describe("example video cards", () => {
  it("show every detail we have: views, age, duration, likes, comments, velocity, engagement", () => {
    render(<BriefView brief={BRIEF} />);
    const card = screen.getAllByRole("article")[0];
    const list = within(card).getByRole("list", { name: /example videos/i });
    const first = within(list).getAllByRole("listitem")[0];
    expect(within(first).getByText("12:34")).toBeTruthy(); // duration badge
    expect(first.textContent).toContain("20.0L views");
    expect(first.textContent).toContain("3 days ago");
    expect(first.textContent).toContain("4.4K"); // likes
    expect(first.textContent).toContain("1.3K"); // comments
    expect(first.textContent).toContain("8.1K/hr");
    expect(first.textContent).toContain("4.2% engaged");
  });
  it("opens the video and the channel safely in a new tab", () => {
    render(<BriefView brief={BRIEF} />);
    const links = within(screen.getAllByRole("article")[0]).getAllByRole("link");
    const video = links.find((l) => l.getAttribute("href")?.includes("watch?v=A1"))!;
    const channel = links.find((l) => l.getAttribute("href")?.includes("/channel/UCA1"))!;
    for (const l of [video, channel]) {
      expect(l.getAttribute("target")).toBe("_blank");
      expect(l.getAttribute("rel")).toContain("noopener");
    }
  });
  it("(regression) older briefs without the extra fields still render with just the basics", () => {
    const old = { ...BRIEF, themes: [mkTheme("Old Theme", "soon", { videos: [legacyVideo("o1", 500_000)] }), THEMES[1], THEMES[2]] };
    render(<BriefView brief={old} />);
    const card = screen.getAllByRole("article")[0];
    expect(within(card).getByText("Legacy o1")).toBeTruthy();
    expect(card.textContent).toContain("5.0L views");
    expect(card.textContent).not.toContain("NaN");
    expect(card.textContent).not.toContain("undefined");
    expect(within(card).queryByText(/engaged/)).toBeNull();
  });
  it("never prints NaN/undefined anywhere on the page", () => {
    const { container } = render(<BriefView brief={BRIEF} />);
    expect(container.textContent).not.toMatch(/NaN|undefined|null/);
  });
});

describe("theme card content", () => {
  it("shows urgency, the four signal meters and the metric chips", () => {
    render(<BriefView brief={BRIEF} />);
    const card = screen.getAllByRole("article")[0];
    expect(within(card).getByText("Film now")).toBeTruthy();
    for (const m of ["Momentum", "Competition", "Engagement", "Opportunity"]) expect(within(card).getByRole("meter", { name: m })).toBeTruthy();
    expect(card.textContent).toContain("4 creators");
    expect(card.textContent).toContain("5.0L views");
    expect(card.textContent).toContain("20.0K/hr");
  });
  it("signal meters stay within 0-100", () => {
    render(<BriefView brief={BRIEF} />);
    for (const m of screen.getAllByRole("meter")) {
      const v = Number(m.getAttribute("aria-valuenow"));
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(100);
    }
  });
  it("without a saved brief id the script panel explains it is unavailable instead of failing", () => {
    render(<BriefView brief={BRIEF} briefId={null} />);
    expect(screen.getAllByText(/Scripts are available on saved briefs/).length).toBe(3);
  });
  it("offers 'Open draft script' only for themes that already have one", () => {
    render(<BriefView brief={BRIEF} briefId="11111111-1111-4111-8111-111111111111" scriptIdx={[1]} />);
    expect(screen.getAllByRole("button", { name: /Open draft script/ })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: /^Draft script$/ })).toHaveLength(2);
  });
});
