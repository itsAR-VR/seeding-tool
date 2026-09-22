import { prisma } from "@/lib/prisma";
import { hashClaimToken } from "@/lib/gift-claims/tokens";
import { ClaimForm } from "./ClaimForm";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageProps = {
  params: Promise<{ token: string }>;
};

export default async function GiftClaimPage({ params }: PageProps) {
  const { token } = await params;
  const claim = await prisma.creatorGiftClaim.findUnique({
    where: { tokenHash: hashClaimToken(token) },
    include: {
      campaignProduct: {
        include: { product: true },
      },
      campaignCreator: {
        include: {
          campaign: true,
        },
      },
    },
  });

  const now = new Date();
  const unavailableReason = !claim
    ? "missing"
    : claim.revokedAt
      ? "revoked"
      : claim.claimedAt
        ? "submitted"
        : claim.expiresAt <= now
          ? "expired"
          : null;
  const isUnavailable = unavailableReason !== null;
  const unavailableMessage =
    unavailableReason === "revoked"
      ? "This link was cancelled by the Kalm team. Ask them for a new one if you were expecting a gift."
      : unavailableReason === "submitted"
        ? "Your details were already submitted, so there is nothing left to do here. The Kalm team will be in touch."
        : unavailableReason === "expired"
          ? "This link has expired. Ask the Kalm team for a fresh one."
          : "It may have expired or already been used. Please ask the Kalm team for a fresh link.";

  return (
    <main className="min-h-screen bg-[#f8f3ec] px-4 py-8 text-neutral-950">
      <div className="mx-auto max-w-xl">
        <div className="rounded-[2rem] bg-white p-6 shadow-sm sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-neutral-500">
            Kalm
          </p>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight">
            Claim your Kalm gift
          </h1>

          {isUnavailable || !claim ? (
            <div className="mt-6 rounded-3xl border border-amber-200 bg-amber-50 p-5 text-amber-950">
              <h2 className="font-semibold">This claim link is unavailable</h2>
              <p className="mt-2 text-sm leading-6">{unavailableMessage}</p>
            </div>
          ) : (
            <>
              <p className="mt-3 text-sm leading-6 text-neutral-700">
                You’re receiving{" "}
                <span className="font-medium">
                  {claim.campaignProduct?.product.name ?? "a Kalm product"}
                </span>{" "}
                from Kalm. Add your U.S. shipping details below so the team can
                review the address before preparing the gift.
              </p>
              <p className="mt-3 text-sm leading-6 text-neutral-700">
                This form does not create an order automatically.
              </p>
              <div className="mt-6">
                <ClaimForm token={token} />
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
