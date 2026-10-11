import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md space-y-3 py-16 text-center">
      <h1 className="font-heading text-2xl font-semibold">Brief not found</h1>
      <p className="text-sm text-muted-foreground">It may have been removed, or the link is wrong.</p>
      <Link href="/archive" className="text-sm font-medium text-primary underline-offset-4 hover:underline">Back to the archive</Link>
    </div>
  );
}
