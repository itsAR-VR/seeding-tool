import { findUsableInvite, InviteError } from "@/lib/invites";
import { createClient } from "@/lib/supabase/server";
import { InviteAccept } from "./InviteAccept";

export const dynamic = "force-dynamic";

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  let invite: Awaited<ReturnType<typeof findUsableInvite>> | null = null;
  let problem: string | null = null;
  try {
    invite = await findUsableInvite(token);
  } catch (error) {
    problem = error instanceof InviteError ? error.message : "This invite link isn't valid.";
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const companyName = invite?.brand?.name ?? invite?.companyName ?? "";

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-md space-y-6 rounded-2xl border bg-background p-8 shadow-sm">
        <p className="text-sm font-semibold tracking-tight text-muted-foreground">Seed Scale</p>
        {problem || !invite ? (
          <>
            <h1 className="text-2xl font-semibold tracking-tight">This invite can&apos;t be used</h1>
            <p className="text-muted-foreground">{problem}</p>
            <a href="/login" className="inline-block font-medium underline">Go to sign in</a>
          </>
        ) : (
          <>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">
                {invite.brandId ? `Join ${companyName}` : `Set up ${companyName}`}
              </h1>
              <p className="mt-2 text-muted-foreground">
                {invite.brandId
                  ? "You've been invited to their creator gifting workspace."
                  : "You've been invited to run your creator gifting on Seed Scale. Next you'll add your brand and connect your accounts."}
              </p>
            </div>
            <InviteAccept
              token={token}
              email={invite.email}
              signedInEmail={user?.email?.toLowerCase() ?? null}
            />
          </>
        )}
      </div>
    </main>
  );
}
