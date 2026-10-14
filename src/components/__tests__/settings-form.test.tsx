// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

import { SettingsForm } from "@/components/settings-form";

const initial = { categories: ["AI tools"], region: "IN", email: "me@example.com", minViews: 0 };
const fetchMock = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockResolvedValue({ ok: true, json: async () => ({}) });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const input = () => screen.getByLabelText("Categories") as HTMLInputElement;
const add = (text: string, via: "button" | "enter" = "button") => {
  fireEvent.change(input(), { target: { value: text } });
  if (via === "enter") fireEvent.keyDown(input(), { key: "Enter" });
  else fireEvent.click(screen.getByRole("button", { name: /^Add$/ }));
};
const tags = () => screen.getByRole("list", { name: /current categories/i }).querySelectorAll("li");
const save = () => fireEvent.click(screen.getByRole("button", { name: /save settings/i }));
const sent = () => JSON.parse(fetchMock.mock.calls[0][1].body);

describe("SettingsForm categories", () => {
  it("adds a category with the Add button and with Enter, then clears the box", () => {
    render(<SettingsForm initial={initial} />);
    add("ChatGPT");
    add("Gemini AI", "enter");
    expect(tags()).toHaveLength(3);
    expect(input().value).toBe("");
  });
  it("ignores blank input and case-insensitive duplicates", () => {
    render(<SettingsForm initial={initial} />);
    add("   ");
    add("ai TOOLS");
    expect(tags()).toHaveLength(1);
  });
  it("rejects a one-character category with a message", () => {
    render(<SettingsForm initial={initial} />);
    add("a");
    expect(tags()).toHaveLength(1);
    expect(screen.getByRole("alert").textContent).toMatch(/at least 2 characters/);
  });
  it("stops at 12 categories", () => {
    render(<SettingsForm initial={initial} />);
    for (let i = 0; i < 15; i++) add(`category ${i}`);
    expect(tags()).toHaveLength(12);
    expect(screen.getByRole("alert").textContent).toMatch(/Max 12/);
  });
  it("removes a category, and blocks saving with none left", () => {
    render(<SettingsForm initial={initial} />);
    fireEvent.click(screen.getByRole("button", { name: /remove AI tools/i }));
    expect(tags()).toHaveLength(0);
    save();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toMatch(/at least one category/i);
    expect(toast.error).toHaveBeenCalled();
  });
  it("keeps unicode and emoji categories intact", () => {
    render(<SettingsForm initial={initial} />);
    add("फैशन ट्रेंड्स");
    add("AI 🤖 tools");
    save();
    return waitFor(() => expect(sent().categories).toEqual(["AI tools", "फैशन ट्रेंड्स", "AI 🤖 tools"]));
  });
});

describe("SettingsForm email and region", () => {
  it("blocks an invalid email and shows the error next to the field", () => {
    render(<SettingsForm initial={{ ...initial, email: "not-an-email" }} />);
    save();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toMatch(/valid email/i);
  });
  it("offers only supported regions and saves the chosen one", async () => {
    render(<SettingsForm initial={initial} />);
    const select = screen.getByLabelText("Region") as HTMLSelectElement;
    expect([...select.options].map((o) => o.value)).toContain("IN");
    fireEvent.change(select, { target: { value: "US" } });
    save();
    await waitFor(() => expect(sent().region).toBe("US"));
  });
});

describe("SettingsForm minimum views slider", () => {
  const slider = () => screen.getByLabelText("Minimum views for example videos") as HTMLInputElement;
  const label = () => screen.getByText(/^(Any|[\d.]+[KLCr]+\+)$/);

  it("starts at 'Any' for 0 and maps saved values to the matching step", () => {
    render(<SettingsForm initial={initial} />);
    expect(label().textContent).toBe("Any");
    cleanup();
    render(<SettingsForm initial={{ ...initial, minViews: 5_000 }} />);
    expect(label().textContent).toBe("5.0K+");
    cleanup();
    render(<SettingsForm initial={{ ...initial, minViews: 20_000_000 }} />);
    expect(label().textContent).toBe("2.0Cr+");
  });
  it("(edge) a saved value between two steps snaps up to the next step", () => {
    render(<SettingsForm initial={{ ...initial, minViews: 7_000 }} />);
    expect(label().textContent).toBe("10.0K+");
  });
  it("(edge) a value above the last step snaps to the maximum instead of breaking", () => {
    render(<SettingsForm initial={{ ...initial, minViews: 99_000_000 }} />);
    expect(label().textContent).toBe("2.0Cr+");
  });
  it("moves from 0 to 20M and sends the real number on save", async () => {
    render(<SettingsForm initial={initial} />);
    expect(slider().min).toBe("0");
    fireEvent.change(slider(), { target: { value: slider().max } });
    save();
    await waitFor(() => expect(sent().minViews).toBe(20_000_000));
  });
  it("exposes a readable value to screen readers", () => {
    render(<SettingsForm initial={{ ...initial, minViews: 5_000 }} />);
    expect(slider().getAttribute("aria-valuetext")).toMatch(/5,000 views/);
  });
});

describe("SettingsForm saving", () => {
  it("PUTs the validated payload and shows a success toast", async () => {
    render(<SettingsForm initial={initial} />);
    save();
    await waitFor(() => expect(toast.success).toHaveBeenCalled());
    expect(fetchMock.mock.calls[0][0]).toBe("/api/settings");
    expect(fetchMock.mock.calls[0][1].method).toBe("PUT");
    expect(sent()).toEqual({ categories: ["AI tools"], region: "IN", email: "me@example.com", minViews: 0, rpm: 80 });
  });
  it("lets you set earnings per 1,000 views and sends it", async () => {
    render(<SettingsForm initial={initial} />);
    fireEvent.change(screen.getByLabelText(/earnings per 1,000 views/i), { target: { value: "120" } });
    save();
    await waitFor(() => expect(toast.success).toHaveBeenCalled());
    expect(sent().rpm).toBe(120);
  });
  it("rejects an earnings figure outside 10 to 500 and does not save", async () => {
    render(<SettingsForm initial={initial} />);
    fireEvent.change(screen.getByLabelText(/earnings per 1,000 views/i), { target: { value: "5000" } });
    save();
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toMatch(/at most/i);
  });
  it("shows the saved earnings figure", () => {
    render(<SettingsForm initial={{ ...initial, rpm: 150 }} />);
    expect((screen.getByLabelText(/earnings per 1,000 views/i) as HTMLInputElement).value).toBe("150");
  });
  it("shows an error toast (not a success) when the server rejects the save", async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, json: async () => ({ error: "Validation failed" }) });
    render(<SettingsForm initial={initial} />);
    save();
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(toast.success).not.toHaveBeenCalled();
  });
  it("survives a network failure and re-enables the Save button", async () => {
    fetchMock.mockRejectedValueOnce(new Error("offline"));
    render(<SettingsForm initial={initial} />);
    save();
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect((screen.getByRole("button", { name: /save settings/i }) as HTMLButtonElement).disabled).toBe(false);
  });
  it("(edge) a double click saves only once while the first request is in flight", async () => {
    let release!: () => void;
    fetchMock.mockImplementationOnce(() => new Promise((r) => (release = () => r({ ok: true, json: async () => ({}) }))));
    render(<SettingsForm initial={initial} />);
    const btn = screen.getByRole("button", { name: /save settings/i });
    fireEvent.click(btn);
    fireEvent.click(btn);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    release();
    await waitFor(() => expect(toast.success).toHaveBeenCalledTimes(1));
  });
});
