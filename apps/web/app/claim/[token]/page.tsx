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
  const isUnavailable =
    !claim || claim.revokedAt || claim.claimedAt || claim.expiresAt <= now;

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

          {isUnavailable ? (
            <div className="mt-6 rounded-3xl border border-amber-200 bg-amber-50 p-5 text-amber-950">
              <h2 className="font-semibold">This claim link is unavailable</h2>
              <p className="mt-2 text-sm leading-6">
                It may have expired or already been used. Please ask the Kalm
                team for a fresh link.
              </p>
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
