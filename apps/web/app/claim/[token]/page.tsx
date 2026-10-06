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
  // When the link can't be used, the reason is the heading, so nobody reads "Claim your gift" first.
  const unavailable =
    unavailableReason === "revoked"
      ? {
          title: "This link was cancelled",
          body: `${brandName} cancelled it. Ask them for a new one if you were expecting a gift.`,
        }
      : unavailableReason === "submitted"
        ? {
            title: "Your address is already in",
            body: `There's nothing left to do here. ${brandName} will be in touch.`,
          }
        : unavailableReason === "expired"
          ? { title: "This link has expired", body: `Ask ${brandName} for a fresh one.` }
          : {
              title: "This link doesn't work",
              body: "It may have expired or already been used. Ask the brand that sent it for a fresh link.",
            };

  return (
    <main className="min-h-screen bg-[#f8f3ec] px-4 py-8 text-neutral-950">
      <div className="mx-auto max-w-xl">
        <div className="rounded-[2rem] bg-white p-6 shadow-sm sm:p-8">
          {brand?.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={brand.logoUrl} alt={brand.name} className="h-8 w-auto" />
          ) : (
            <p className="text-xl font-semibold">{brand?.name ?? ""}</p>
          )}
          {isUnavailable || !claim ? (
            <>
              <h1 className="mt-6 text-3xl font-semibold tracking-tight">{unavailable.title}</h1>
              <p className="mt-3 text-base leading-7 text-neutral-700">{unavailable.body}</p>
            </>
          ) : (
            <>
              <h1 className="mt-6 text-3xl font-semibold tracking-tight">Claim your gift</h1>
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
