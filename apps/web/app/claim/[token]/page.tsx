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
          campaign: { include: { brand: { select: { name: true, logoUrl: true, shipCountries: true } } } },
        },
      },
    },
  });

  const brand = claim?.campaignCreator.campaign.brand;
  const brandName = brand?.name ?? "the team";
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
      ? `This link was cancelled by ${brandName}. Ask them for a new one if you were expecting a gift.`
      : unavailableReason === "submitted"
        ? `Your details were already submitted, so there is nothing left to do here. ${brandName} will be in touch.`
        : unavailableReason === "expired"
          ? `This link has expired. Ask ${brandName} for a fresh one.`
          : "It may have expired or already been used. Please ask the brand that sent it for a fresh link.";

  return (
    <main className="min-h-screen bg-[#f8f3ec] px-4 py-8 text-neutral-950">
      <div className="mx-auto max-w-xl">
        <div className="rounded-[2rem] bg-white p-6 shadow-sm sm:p-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {brand?.logoUrl ? (
            <img src={brand.logoUrl} alt={brand.name} className="h-8 w-auto" />
          ) : (
            <p className="text-xl font-semibold">{brand?.name ?? ""}</p>
          )}
          <h1 className="mt-6 text-3xl font-semibold tracking-tight">
            Claim your gift
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
                  {claim.campaignProduct?.product.name ?? `a gift from ${brandName}`}
                </span>
                . Add your shipping details below and we&apos;ll get it ready
                to ship.
              </p>
              <div className="mt-6">
                <ClaimForm token={token} brandName={brandName} shipCountries={brand?.shipCountries?.length ? brand.shipCountries : ["US"]} />
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
