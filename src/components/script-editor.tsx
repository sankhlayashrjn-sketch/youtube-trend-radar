"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ClipboardCopy, Download, FileText, Loader2, RefreshCw, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SCRIPT_LANGUAGES } from "@/lib/types";

type Status = "idle" | "loading" | "generating" | "dirty" | "saving" | "saved" | "error";
type Language = (typeof SCRIPT_LANGUAGES)[number];

const SAVE_DELAY_MS = 1200;

/** Spoken words only: ignore headings and [SHOW:] / [VERIFY:] notes. */
function spokenWords(md: string): number {
  return md
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/^#+.*$/gm, " ")
    .split(/\s+/)
    .filter(Boolean).length;
}

export function ScriptEditor({
  briefId, themeIndex, hasScript, title, defaultOpen = false,
}: { briefId: string | null; themeIndex: number; hasScript: boolean; title: string; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const [content, setContent] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [exists, setExists] = useState(hasScript);
  const [language, setLanguage] = useState<Language>("English");
  const [status, setStatus] = useState<Status>("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef("");
  const dirty = useRef(false); // typed but not yet saved

  // Opened by default (inside the Script tab): load an existing script straight away.
  useEffect(() => {
    if (!defaultOpen || !hasScript || !briefId) return;
    const id = setTimeout(() => { void load(); }, 0);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Leaving the page (or the tab) must not lose the last few seconds of typing.
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
      if (dirty.current && briefId) {
        void fetch("/api/script", {
          method: "PUT",
          keepalive: true,
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ briefId, themeIndex, content: latest.current }),
        }).catch(() => {});
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  if (!briefId) {
    return (
      <p className="rounded-xl border border-dashed p-3 text-xs text-muted-foreground">
        Scripts are available on saved briefs. Click &quot;Generate now&quot; to create one.
      </p>
    );
  }

  async function load() {
    setStatus("loading");
    try {
      const res = await fetch(`/api/script?briefId=${briefId}&themeIndex=${themeIndex}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load");
      if (data.script) {
        setContent(data.script.content);
        latest.current = data.script.content;
        dirty.current = false;
        setLanguage(data.script.language === "Hinglish" ? "Hinglish" : "English");
        setExists(true);
      }
      setLoaded(true);
      setStatus("idle");
    } catch (e) {
      setStatus("error");
      toast.error("Couldn't open the script", { description: (e as Error).message });
    }
  }

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && !loaded && exists) await load();
    else if (next && !exists) setLoaded(true);
  }

  async function generate() {
    if (content.trim() && !window.confirm("Drafting again replaces the current script, including your edits. Continue?")) return;
    setStatus("generating");
    try {
      const res = await fetch("/api/script", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ briefId, themeIndex, language }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
      setContent(data.script.content);
      latest.current = data.script.content;
      dirty.current = false;
      setExists(true);
      setLoaded(true);
      setStatus("saved");
      toast.success("Script drafted", { description: "Edit it below. Changes save automatically." });
    } catch (e) {
      setStatus("error");
      toast.error("Couldn't draft the script", { description: (e as Error).message });
    }
  }

  async function save(text: string) {
    setStatus("saving");
    try {
      const res = await fetch("/api/script", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ briefId, themeIndex, content: text }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Save failed");
      if (latest.current === text) {
        dirty.current = false;
        setStatus("saved");
      }
    } catch (e) {
      setStatus("error");
      toast.error("Couldn't save your edits", { description: (e as Error).message });
    }
  }

  function onChange(text: string) {
    setContent(text);
    latest.current = text;
    dirty.current = true;
    setStatus("dirty");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => save(text), SAVE_DELAY_MS);
  }

  function flush() {
    if (status === "dirty") {
      if (timer.current) clearTimeout(timer.current);
      void save(latest.current);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(content);
      toast.success("Script copied");
    } catch {
      toast.error("Couldn't copy. Select the text and copy it manually.");
    }
  }

  function download() {
    const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `script-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40) || "video"}.md`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  // Keep the editor on screen once a script exists, even if the user clears every character.
  const hasEditor = exists && loaded;
  const words = spokenWords(content);
  const busy = status === "generating" || status === "loading";
  const statusText =
    status === "dirty" ? "Unsaved changes…" : status === "saving" ? "Saving…" : status === "saved" ? "All changes saved" : status === "error" ? "Not saved" : "";

  return (
    <div className="space-y-3">
      <Button type="button" variant={open ? "secondary" : "outline"} onClick={toggle} aria-expanded={open} className="h-9 w-full gap-2 sm:w-auto">
        <FileText className="size-4" aria-hidden /> {exists ? "Open draft script" : "Draft script"}
      </Button>

      {open && (
        <div className="space-y-3 rounded-2xl border bg-card p-3 sm:p-4">
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              Language
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value as Language)}
                disabled={busy}
                className="h-8 rounded-lg border border-input bg-background px-2 text-sm text-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                {SCRIPT_LANGUAGES.map((l) => <option key={l}>{l}</option>)}
              </select>
            </label>
            <Button type="button" size="sm" onClick={generate} disabled={busy} className="gap-1.5">
              {status === "generating" ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : hasEditor ? <RefreshCw className="size-3.5" aria-hidden /> : <Sparkles className="size-3.5" aria-hidden />}
              {status === "generating" ? "Drafting…" : hasEditor ? "Draft again" : "Draft with Gemini"}
            </Button>
            {hasEditor && (
              <div className="ml-auto flex gap-1.5">
                <Button type="button" size="sm" variant="outline" onClick={copy}><ClipboardCopy className="size-3.5" aria-hidden /> Copy</Button>
                <Button type="button" size="sm" variant="outline" onClick={download}><Download className="size-3.5" aria-hidden /> .md</Button>
              </div>
            )}
          </div>

          {status === "loading" && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" aria-hidden /> Opening your script…</p>}
          {status === "generating" && <p className="text-sm text-muted-foreground" role="status">Gemini is writing a first draft. This takes about 20 seconds.</p>}

          {hasEditor ? (
            <>
              <label className="sr-only" htmlFor={`script-${themeIndex}`}>Draft script, editable</label>
              <textarea
                id={`script-${themeIndex}`}
                value={content}
                onChange={(e) => onChange(e.target.value)}
                onBlur={flush}
                spellCheck
                rows={22}
                className="min-h-80 w-full resize-y rounded-xl border border-input bg-background p-4 font-mono text-[13px] leading-relaxed outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              />
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                <span>~{words} spoken words · about {Math.max(1, Math.round(words / 150))} min</span>
                <span role="status" aria-live="polite" className={cn("inline-flex items-center gap-1", status === "error" && "text-destructive")}>
                  {status === "saved" && <Check className="size-3.5 text-emerald-600" aria-hidden />}
                  {statusText}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Lines marked [SHOW: …] are visuals and [VERIFY: …] are facts to check before you film.
              </p>
            </>
          ) : (
            !busy && <p className="text-sm text-muted-foreground">No script yet. Pick a language and press &quot;Draft with Gemini&quot;.</p>
          )}
        </div>
      )}
    </div>
  );
}
