"use client";

import CtaLink from "./CtaLink";

type MobileCtaProps = {
  fallbackId: string;
  label: string;
  source: string;
};

export default function MobileCta({ fallbackId, label, source }: MobileCtaProps) {
  return (
    <div className="mobile-cta" aria-label="Mobile primary CTA">
      <CtaLink
        className="btn btn-solid"
        event={`${source}_mobile_primary_cta`}
        fallbackId={fallbackId}
        label={label}
        source={source}
      />
    </div>
  );
}
