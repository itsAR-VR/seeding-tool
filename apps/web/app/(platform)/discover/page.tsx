import { redirect } from "next/navigation";
import { DiscoverClient } from "./components/discover-client";

export default function DiscoverPage() {
  // This tool drives a logged-in Instagram browser on the computer it runs on,
  // so it only works locally. On the website, send people to creator search.
  if (process.env.VERCEL) redirect("/creators?find=1");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Discover (local only)</h1>
        <p className="text-muted-foreground">
          Walk a seed profile&apos;s Instagram suggestions, screenshot each profile, and let AI decide who matches your
          niche.
        </p>
      </div>
      <DiscoverClient />
    </div>
  );
}
