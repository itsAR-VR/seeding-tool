"use client";

import { getBookingHref, isExternalHref, trackEvent } from "./analytics";

type CtaLinkProps = {
  className: string;
  event: string;
  fallbackId: string;
  label: string;
  source: string;
};

export default function CtaLink({
  className,
  event,
  fallbackId,
  label,
  source,
}: CtaLinkProps) {
  const href = getBookingHref(fallbackId);
  const external = isExternalHref(href);

  return (
    <a
      className={className}
      href={href}
      rel={external ? "noreferrer" : undefined}
      target={external ? "_blank" : undefined}
      data-analytics-event={event}
      onClick={() => trackEvent(event, source)}
    >
      {label}
    </a>
  );
}
