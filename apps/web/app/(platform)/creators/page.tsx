import { CreatorsContent } from "./creators-client";

/**
 * Reads ?find=1 on the server and passes it down, so the page renders right
 * away instead of waiting behind a client-side search-params boundary.
 */
export default async function CreatorsPage({ searchParams }: { searchParams: Promise<{ find?: string }> }) {
  const { find } = await searchParams;
  return <CreatorsContent openFind={find === "1"} />;
}
