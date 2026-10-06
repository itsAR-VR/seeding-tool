import { InviteShell } from "../invite-shell";

export const dynamic = "force-dynamic";

/**
 * Landing page for the emailed sign-in link. Signing in waits for a button
 * press, because email scanners open links and would use up the one-time code.
 */
export default async function ContinuePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ token_hash?: string; type?: string }>;
}) {
  const { token } = await params;
  const { token_hash: tokenHash, type } = await searchParams;

  return (
    <InviteShell>
      {tokenHash && type ? (
        <form action="/callback" method="get" className="space-y-4">
          <h1 className="text-2xl font-semibold tracking-tight">Confirm it&apos;s you</h1>
          <input type="hidden" name="token_hash" value={tokenHash} />
          <input type="hidden" name="type" value={type} />
          <input type="hidden" name="next" value={`/invite/${token}`} />
          <button
            type="submit"
            className="w-full min-h-11 rounded-full bg-foreground px-4 py-3 font-medium text-background"
          >
            Continue to your invite
          </button>
        </form>
      ) : (
        <>
          <h1 className="text-2xl font-semibold tracking-tight">This link is incomplete</h1>
          <a href={`/invite/${token}`} className="inline-flex min-h-11 items-center font-medium underline">
            Go back to your invite and send a new link
          </a>
        </>
      )}
    </InviteShell>
  );
}
