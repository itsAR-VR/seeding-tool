import Link from "next/link";

/** Shown when the signed-in person isn't part of a company yet. */
export function NoCompanyNotice({ title }: { title: string }) {
  return (
    <div className="space-y-3">
      <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
      <p className="text-muted-foreground">
        You&apos;re not part of a company yet. Finish setting up your company, or ask your team
        owner to invite you.
      </p>
      <Link href="/onboarding" className="inline-block font-medium text-blue-600 hover:underline">
        Set up your company
      </Link>
    </div>
  );
}
