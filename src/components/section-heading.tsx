/** A numbered step heading, so the dashboard reads as a flow: 1 Read, 2 Choose, 3 Plan. */
export function SectionHeading({ step, id, title, hint }: { step: number; id: string; title: string; hint?: string }) {
  return (
    <header className="flex items-start gap-3">
      <span aria-hidden className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
        {step}
      </span>
      <div>
        <h2 id={id} className="font-heading text-2xl font-semibold leading-tight">
          <span className="sr-only">Step {step}: </span>
          {title}
        </h2>
        {hint && <p className="mt-0.5 text-sm text-muted-foreground">{hint}</p>}
      </div>
    </header>
  );
}
