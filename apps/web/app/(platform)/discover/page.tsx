import { DiscoverClient } from "./components/discover-client";

export default function DiscoverPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Discover</h1>
        <p className="text-muted-foreground">
          Walk a seed profile&apos;s Instagram suggestions, screenshot each
          profile, and let AI decide who matches your niche.
        </p>
      </div>
      <DiscoverClient />
    </div>
  );
}
