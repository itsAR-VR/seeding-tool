import { InviteShell } from "./invite-shell";
import { findInviteForLink, InviteError } from "@/lib/invites";
import { createClient } from "@/lib/supabase/server";
import { InviteAccept } from "./InviteAccept";

export const dynamic = "force-dynamic";

export default async function InvitePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ link?: string }>;
}) {
  const { token } = await params;
  const { link } = await searchParams;
  let found: Awaited<ReturnType<typeof findInviteForLink>> | null = null;
  let problem: string | null = null;
  try {
    found = await findInviteForLink(token);
  } catch (error) {
    problem = error instanceof InviteError ? error.message : "This invite link isn't valid. Ask for a new one.";
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const signedInEmail = user?.email?.toLowerCase() ?? null;
  const invite = found?.invite ?? null;
  const joined = found?.state === "joined";
  const companyName = invite?.brand?.name ?? invite?.companyName ?? "the team";
  const isInvitee = Boolean(invite && signedInEmail === invite.email);
  // Set by /callback when the emailed sign-in link was already used or expired.
  const linkFailed = link === "expired" && !isInvitee;

  return (
    <InviteShell>
      {problem || !invite ? (
        <>
          <h1 className="text-2xl font-semibold tracking-tight">This invite can&apos;t be used</h1>
          <p className="text-neutral-700">{problem}</p>
          <a href="/login" className="inline-flex min-h-11 items-center font-medium underline">Go to sign in</a>
        </>
      ) : joined && isInvitee ? (
        <>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">You&apos;ve joined {companyName}</h1>
            <p className="mt-2 text-neutral-700">This invite is already used, and you&apos;re signed in.</p>
          </div>
          <a
            href={invite.brandId ? "/dashboard" : "/onboarding"}
            className="block w-full min-h-11 rounded-full bg-foreground px-4 py-3 text-center font-medium text-background"
          >
            Go to your workspace
          </a>
        </>
      ) : (
        <>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {joined ? `Sign in to ${companyName}` : invite.brandId ? `Join ${companyName}` : `Set up ${companyName}`}
            </h1>
            <p className="mt-2 text-neutral-700">
              {joined
                ? "You already joined with this invite. We can email you a link to sign in."
                : invite.brandId
                  ? "You've been invited to their creator gifting workspace."
                  : "You've been invited to run your creator gifting on Seed Scale. Next you'll add your brand and connect your accounts."}
            </p>
          </div>
          {linkFailed && (
            <p role="alert" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
              That sign-in link was already used or has expired. Send yourself a new one below.
            </p>
          )}
          <InviteAccept
            token={token}
            email={invite.email}
            signedInEmail={signedInEmail}
            mode={joined ? "signin" : "join"}
          />
        </>
      )}
    </InviteShell>
  );
}
