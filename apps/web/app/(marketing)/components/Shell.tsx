"use client";

import { ReactNode, useEffect, useState } from "react";
import CtaLink from "./CtaLink";
import MobileCta from "./MobileCta";
import { trackEvent } from "./analytics";

export type ShellLink = {
  href: string;
  label: string;
};

type ShellProps = {
  activeHref?: string;
  brandHref: string;
  children: ReactNode;
  fallbackId: string;
  footerLinks: ShellLink[];
  mainId: string;
  navItems: ShellLink[];
  primaryCtaLabel: string;
  source: string;
};

export default function Shell({
  activeHref,
  brandHref,
  children,
  fallbackId,
  footerLinks,
  mainId,
  navItems,
  primaryCtaLabel,
  source,
}: ShellProps) {
  const [navOpen, setNavOpen] = useState(false);
  const [showMobileCta, setShowMobileCta] = useState(false);
  useEffect(() => {
    const onScroll = () => {
      setShowMobileCta(window.scrollY > Math.max(220, window.innerHeight * 0.38));
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  return (
    <div className="lp-root" id="top">
      <a className="skip-link" href={`#${mainId}`}>
        Skip to content
      </a>
      <div className="noise-layer" aria-hidden="true" />
      <div className="ambient ambient-indigo" aria-hidden="true" />
      <div className="ambient ambient-coral" aria-hidden="true" />
      <div className="ambient ambient-teal" aria-hidden="true" />

      <header className="top-nav">
        <a className="brand" href={brandHref} onClick={() => trackEvent("brand_clicked", source)}>
          SEEDING OS
        </a>
        <nav aria-label="Primary" data-open={navOpen || undefined}>
          {navItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              aria-current={item.href === activeHref ? "page" : undefined}
              onClick={() => setNavOpen(false)}
            >
              {item.label}
            </a>
          ))}
        </nav>
        <button
          className="nav-toggle"
          aria-expanded={navOpen}
          aria-label="Toggle navigation"
          onClick={() => setNavOpen(!navOpen)}
          type="button"
        >
          <span />
          <span />
          <span />
        </button>
        <CtaLink
          className="btn btn-solid"
          event={`${source}_nav_primary_cta`}
          fallbackId={fallbackId}
          label={primaryCtaLabel}
          source={source}
        />
      </header>

      {children}

      {showMobileCta ? <MobileCta fallbackId={fallbackId} label={primaryCtaLabel} source={source} /> : null}

      <footer className="site-footer">
        <div>
          <strong>SEEDING OS</strong>
          <p>Operational software for influencer sourcing, execution, and post verification.</p>
        </div>
        <nav aria-label="Footer">
          {footerLinks.map((item) => (
            <a key={item.href} href={item.href}>
              {item.label}
            </a>
          ))}
        </nav>
      </footer>
    </div>
  );
}
