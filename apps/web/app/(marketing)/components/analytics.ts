declare global {
  interface Window {
    dataLayer?: Array<Record<string, unknown>>;
  }
}

export function getBookingHref(fallbackId: string) {
  return process.env.NEXT_PUBLIC_BOOKING_URL || fallbackId;
}

export function getCalendlyHref() {
  return process.env.NEXT_PUBLIC_CALENDLY_URL || "";
}

export function isExternalHref(href: string) {
  return /^https?:\/\//.test(href);
}

export function trackEvent(event: string, source: string) {
  if (typeof window === "undefined") {
    return;
  }

  const payload = { event, source };
  window.dataLayer?.push(payload);
  window.dispatchEvent(new CustomEvent("landing:track", { detail: payload }));
}
