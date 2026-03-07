"use client";

import { useEffect, useRef } from "react";

// ─── Lenis + GSAP lazy init ─────────────────────────────────────────────────
function useSmoothScroll() {
  useEffect(() => {
    let lenis: InstanceType<typeof import("lenis").default> | null = null;
    let rafId: number;

    async function init() {
      const { default: Lenis } = await import("lenis");
      lenis = new Lenis({ duration: 1.1, easing: (t: number) => 1 - Math.pow(1 - t, 4) });
      function raf(time: number) {
        lenis!.raf(time);
        rafId = requestAnimationFrame(raf);
      }
      rafId = requestAnimationFrame(raf);
    }

    init();
    return () => {
      cancelAnimationFrame(rafId);
      lenis?.destroy();
    };
  }, []);
}

function useHeroGSAP() {
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;

    async function init() {
      const gsap = (await import("gsap")).default;
      const { ScrollTrigger } = await import("gsap/ScrollTrigger");
      gsap.registerPlugin(ScrollTrigger);

      // Hero entrance
      const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
      tl.fromTo(
        "#navbar",
        { y: -24, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.7 },
        0
      )
        .fromTo(
          "#hero-eyebrow",
          { y: 20, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.7 },
          0.15
        )
        .fromTo(
          "#hero-headline",
          { y: 32, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.8 },
          0.25
        )
        .fromTo(
          "#hero-sub",
          { y: 24, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.7 },
          0.4
        )
        .fromTo(
          "#hero-ctas",
          { y: 20, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.6 },
          0.52
        )
        .fromTo(
          "#hero-stats",
          { y: 20, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.6, stagger: 0.08 },
          0.62
        );

      // Stat counter count-up
      const stats = [
        { id: "stat-creators", target: 5, suffix: "M+" },
        { id: "stat-countries", target: 140, suffix: "+" },
        { id: "stat-platforms", target: 12, suffix: "+" },
      ];

      stats.forEach(({ id, target, suffix }) => {
        const el = document.getElementById(id);
        if (!el) return;
        const counter = { val: 0 };
        gsap.to(counter, {
          val: target,
          duration: 1.8,
          ease: "power2.out",
          delay: 0.8,
          onUpdate: () => {
            el.textContent = Math.round(counter.val) + suffix;
          },
        });
      });

      // ScrollTrigger reveals
      const sections = document.querySelectorAll<HTMLElement>("[data-reveal]");
      sections.forEach((section) => {
        const els = section.querySelectorAll<HTMLElement>(".reveal");
        if (els.length === 0) {
          gsap.fromTo(
            section,
            { y: 40, opacity: 0 },
            {
              y: 0,
              opacity: 1,
              duration: 0.7,
              ease: "power2.out",
              scrollTrigger: {
                trigger: section,
                start: "top 85%",
                toggleActions: "play none none none",
              },
            }
          );
        } else {
          gsap.fromTo(
            els,
            { y: 36, opacity: 0 },
            {
              y: 0,
              opacity: 1,
              duration: 0.65,
              ease: "power2.out",
              stagger: 0.08,
              scrollTrigger: {
                trigger: section,
                start: "top 82%",
                toggleActions: "play none none none",
              },
            }
          );
        }
      });
    }

    init();
  }, []);
}

function useNavGlass() {
  useEffect(() => {
    const nav = document.getElementById("navbar");
    if (!nav) return;

    function onScroll() {
      if (window.scrollY > 60) {
        nav!.classList.add("nav-glass");
      } else {
        nav!.classList.remove("nav-glass");
      }
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
}

// ─── Section wrapper ────────────────────────────────────────────────────────
function Section({
  id,
  className = "",
  children,
}: {
  id?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      data-reveal
      className={`relative z-10 px-4 sm:px-6 lg:px-8 ${className}`}
    >
      <div className="mx-auto max-w-6xl">{children}</div>
    </section>
  );
}

// ─── Icons ──────────────────────────────────────────────────────────────────
function IconCheck() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="8" cy="8" r="8" fill="oklch(65% 0.22 255 / 0.15)" />
      <path
        d="M4.5 8l2.5 2.5L11 5"
        stroke="oklch(65% 0.22 255)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconX() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="8" cy="8" r="8" fill="oklch(55% 0.18 25 / 0.12)" />
      <path
        d="M5.5 5.5l5 5M10.5 5.5l-5 5"
        stroke="oklch(60% 0.2 25)"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────
export default function Page() {
  useSmoothScroll();
  useHeroGSAP();
  useNavGlass();

  return (
    <main
      style={{ fontFamily: "var(--font-body)" }}
      className="relative min-h-screen"
      aria-label="Aha landing page"
    >
      {/* ── Navbar ─────────────────────────────────────────────────────── */}
      <nav
        id="navbar"
        className="fixed top-0 left-0 right-0 z-50 transition-all duration-500"
        style={{ transitionTimingFunction: "var(--ease-expo)" }}
        aria-label="Primary navigation"
      >
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-4 py-4">
            <a
              href="#"
              className="text-xl font-bold tracking-tight"
              style={{
                fontFamily: "var(--font-display)",
                color: "var(--color-text)",
              }}
            >
              aha
              <span style={{ color: "var(--color-accent)" }}>.</span>
            </a>
            <div className="hidden md:flex items-center gap-6">
              {["How it works", "Features", "Guarantee"].map((item) => (
                <a
                  key={item}
                  href={`#${item.toLowerCase().replace(/\s+/g, "-")}`}
                  className="text-sm font-medium transition-colors duration-200"
                  style={{ color: "var(--color-text-muted)" }}
                  onMouseEnter={(e) =>
                    ((e.target as HTMLElement).style.color = "var(--color-text)")
                  }
                  onMouseLeave={(e) =>
                    ((e.target as HTMLElement).style.color =
                      "var(--color-text-muted)")
                  }
                >
                  {item}
                </a>
              ))}
            </div>
            <a
              href="https://app.aha.inc"
              className="btn-accent text-sm px-5 py-2.5"
            >
              Get started
            </a>
          </div>
        </div>
      </nav>

      {/* ── Hero ───────────────────────────────────────────────────────── */}
      <section
        className="relative min-h-screen flex flex-col items-center justify-center pt-24 pb-20 px-4 sm:px-6 lg:px-8 overflow-hidden"
        aria-label="Hero"
      >
        {/* mesh background */}
        <div className="mesh-bg" aria-hidden />

        {/* subtle radial glow */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-0"
          style={{
            background:
              "radial-gradient(ellipse 80% 60% at 50% 0%, oklch(65% 0.22 255 / 0.07) 0%, transparent 70%)",
          }}
        />

        <div className="relative z-10 mx-auto max-w-5xl text-center">
          <p
            id="hero-eyebrow"
            className="inline-block text-xs font-semibold tracking-widest uppercase mb-6 px-4 py-1.5 rounded-full glass-sm"
            style={{
              color: "var(--color-accent)",
              fontFamily: "var(--font-display)",
            }}
          >
            AI-powered influencer marketing
          </p>

          <h1
            id="hero-headline"
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 800,
              fontSize: "clamp(2.4rem, 6vw, 5rem)",
              lineHeight: 1.08,
              letterSpacing: "-0.03em",
              color: "var(--color-text)",
            }}
          >
            Your 24/7 AI Employee
            <br />
            for Influencer Marketing
          </h1>

          <p
            id="hero-sub"
            className="mx-auto mt-6 max-w-2xl"
            style={{
              fontSize: "clamp(1rem, 2vw, 1.25rem)",
              lineHeight: 1.7,
              color: "var(--color-text-muted)",
            }}
          >
            Aha handles discovery, outreach, negotiation, contracts, and
            payments — around the clock, across 140+ countries, so your team
            focuses on strategy.
          </p>

          <div
            id="hero-ctas"
            className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-10"
          >
            <a
              href="https://app.aha.inc"
              className="btn-accent px-8 py-3.5 text-base"
            >
              Start for free
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                aria-hidden
              >
                <path
                  d="M3 8h10M9 4l4 4-4 4"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </a>
            <a href="#how-it-works" className="btn-ghost px-8 py-3.5 text-base">
              See how it works
            </a>
          </div>

          {/* Stat bar */}
          <div
            id="hero-stats"
            className="flex flex-wrap items-center justify-center gap-6 sm:gap-10 mt-14"
          >
            {[
              {
                id: "stat-creators",
                value: "5M+",
                label: "Creators",
              },
              {
                id: "stat-countries",
                value: "140+",
                label: "Countries",
              },
              {
                id: "stat-platforms",
                value: "12+",
                label: "Platforms",
              },
            ].map(({ id, value, label }) => (
              <div key={id} className="flex flex-col items-center gap-1 reveal">
                <span
                  id={id}
                  className="stat-counter"
                  style={{ fontSize: "clamp(1.8rem, 4vw, 2.8rem)" }}
                >
                  {value}
                </span>
                <span
                  className="text-xs font-semibold tracking-wider uppercase"
                  style={{ color: "var(--color-text-faint)" }}
                >
                  {label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* scroll hint */}
        <div
          className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 z-10"
          aria-hidden
        >
          <span
            className="text-xs tracking-widest uppercase"
            style={{ color: "var(--color-text-faint)" }}
          >
            Scroll
          </span>
          <div
            className="w-px h-10 rounded-full"
            style={{
              background:
                "linear-gradient(to bottom, oklch(100% 0 0 / 0.2), transparent)",
            }}
          />
        </div>
      </section>

      <div className="section-divider" aria-hidden />

      {/* ── Problem Statement ──────────────────────────────────────────── */}
      <Section id="problem" className="py-24">
        <div className="text-center mb-14 reveal">
          <p
            className="text-xs font-semibold tracking-widest uppercase mb-3"
            style={{ color: "var(--color-accent)", fontFamily: "var(--font-display)" }}
          >
            The old way vs the Aha way
          </p>
          <h2
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 700,
              fontSize: "clamp(1.8rem, 4vw, 3rem)",
              letterSpacing: "-0.02em",
              color: "var(--color-text)",
            }}
          >
            Influencer marketing shouldn't
            <br />
            consume your entire team
          </h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Before */}
          <div className="glass p-8 reveal">
            <div className="flex items-center gap-2 mb-6">
              <span
                className="text-sm font-bold tracking-widest uppercase"
                style={{ color: "oklch(60% 0.2 25)", fontFamily: "var(--font-display)" }}
              >
                Before Aha
              </span>
            </div>
            <ul className="space-y-4">
              {[
                "Hours manually searching for the right creators",
                "Hundreds of cold DMs with low reply rates",
                "Endless back-and-forth on pricing and terms",
                "Contracts managed in spreadsheets and email threads",
                "Payments delayed or disputed",
                "No visibility into campaign progress",
              ].map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <span className="mt-0.5 shrink-0">
                    <IconX />
                  </span>
                  <span
                    style={{
                      fontSize: "clamp(0.875rem, 1.5vw, 1rem)",
                      color: "var(--color-text-muted)",
                    }}
                  >
                    {item}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* After */}
          <div
            className="glass p-8 reveal"
            style={{
              borderColor: "oklch(65% 0.22 255 / 0.2)",
              boxShadow: "0 0 40px oklch(65% 0.22 255 / 0.06)",
            }}
          >
            <div className="flex items-center gap-2 mb-6">
              <span
                className="text-sm font-bold tracking-widest uppercase"
                style={{ color: "var(--color-accent)", fontFamily: "var(--font-display)" }}
              >
                With Aha
              </span>
            </div>
            <ul className="space-y-4">
              {[
                "AI matches you with perfect creators in seconds",
                "Automated outreach that feels personal, at scale",
                "Smart negotiation engine handles pricing for you",
                "Contracts generated and signed automatically",
                "Escrow-protected payments on delivery",
                "Real-time dashboard tracks every campaign metric",
              ].map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <span className="mt-0.5 shrink-0">
                    <IconCheck />
                  </span>
                  <span
                    style={{
                      fontSize: "clamp(0.875rem, 1.5vw, 1rem)",
                      color: "var(--color-text-muted)",
                    }}
                  >
                    {item}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Section>

      <div className="section-divider" aria-hidden />

      {/* ── How It Works ───────────────────────────────────────────────── */}
      <Section id="how-it-works" className="py-24">
        <div className="text-center mb-14 reveal">
          <p
            className="text-xs font-semibold tracking-widest uppercase mb-3"
            style={{ color: "var(--color-accent)", fontFamily: "var(--font-display)" }}
          >
            Process
          </p>
          <h2
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 700,
              fontSize: "clamp(1.8rem, 4vw, 3rem)",
              letterSpacing: "-0.02em",
              color: "var(--color-text)",
            }}
          >
            You do 3 things.
            <br />
            Aha handles the rest.
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          {[
            {
              step: "01",
              title: "Set your campaign",
              desc: "Define your goals, budget, target audience, and brand guidelines. Takes under 5 minutes.",
              yours: true,
            },
            {
              step: "02",
              title: "Review creator picks",
              desc: "Aha surfaces the most relevant creators. You approve or skip — no deep dives needed.",
              yours: true,
            },
            {
              step: "03",
              title: "Approve content",
              desc: "Aha verifies authenticity and quality. You give final sign-off before it goes live.",
              yours: true,
            },
          ].map(({ step, title, desc }) => (
            <div key={step} className="glass p-6 reveal">
              <div className="flex items-center gap-3 mb-4">
                <span
                  className="text-2xl font-black"
                  style={{
                    color: "var(--color-accent)",
                    fontFamily: "var(--font-display)",
                  }}
                >
                  {step}
                </span>
                <span
                  className="text-xs font-semibold tracking-widest uppercase"
                  style={{ color: "var(--color-text-faint)" }}
                >
                  You
                </span>
              </div>
              <h3
                className="font-bold mb-2"
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "clamp(1rem, 1.8vw, 1.2rem)",
                  color: "var(--color-text)",
                }}
              >
                {title}
              </h3>
              <p
                className="text-sm"
                style={{
                  lineHeight: 1.65,
                  color: "var(--color-text-muted)",
                }}
              >
                {desc}
              </p>
            </div>
          ))}
        </div>

        {/* Aha handles */}
        <div
          className="glass p-6 reveal"
          style={{ borderColor: "oklch(65% 0.22 255 / 0.15)" }}
        >
          <p
            className="text-xs font-semibold tracking-widest uppercase mb-5"
            style={{ color: "var(--color-accent)", fontFamily: "var(--font-display)" }}
          >
            Aha handles automatically
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {[
              "Creator discovery & ranking",
              "Personalised outreach at scale",
              "Pricing negotiation",
              "Contract generation & e-signing",
              "Payment escrow & release",
              "Performance reporting",
            ].map((item) => (
              <div key={item} className="flex items-center gap-2">
                <span
                  className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ background: "var(--color-accent)" }}
                  aria-hidden
                />
                <span
                  className="text-sm"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  {item}
                </span>
              </div>
            ))}
          </div>
        </div>
      </Section>

      <div className="section-divider" aria-hidden />

      {/* ── Primary Features (alternating layout) ──────────────────────── */}
      <Section id="features" className="py-24">
        <div className="text-center mb-16 reveal">
          <p
            className="text-xs font-semibold tracking-widest uppercase mb-3"
            style={{ color: "var(--color-accent)", fontFamily: "var(--font-display)" }}
          >
            Core capabilities
          </p>
          <h2
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 700,
              fontSize: "clamp(1.8rem, 4vw, 3rem)",
              letterSpacing: "-0.02em",
              color: "var(--color-text)",
            }}
          >
            Built to run your entire
            <br />
            influencer operation
          </h2>
        </div>

        <div className="space-y-6">
          {/* Feature 1 — AI Matching */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 glass overflow-hidden reveal feature-card">
            <div className="p-10 lg:p-14 flex flex-col justify-center">
              <span
                className="text-xs font-semibold tracking-widest uppercase mb-4"
                style={{ color: "var(--color-accent)", fontFamily: "var(--font-display)" }}
              >
                AI matching
              </span>
              <h3
                className="mb-4"
                style={{
                  fontFamily: "var(--font-display)",
                  fontWeight: 700,
                  fontSize: "clamp(1.4rem, 3vw, 2rem)",
                  lineHeight: 1.25,
                  color: "var(--color-text)",
                }}
              >
                Find the right creator
                <br />
                every time, in seconds
              </h3>
              <p
                className="mb-6"
                style={{
                  fontSize: "clamp(0.9rem, 1.5vw, 1.05rem)",
                  lineHeight: 1.7,
                  color: "var(--color-text-muted)",
                }}
              >
                Our AI analyses 50+ signals — engagement quality, audience
                demographics, brand safety, content authenticity — to surface
                creators that actually move the needle for your specific
                campaign goals.
              </p>
              <ul className="space-y-2">
                {[
                  "5M+ vetted creator profiles",
                  "Audience overlap detection",
                  "Brand safety scoring",
                ].map((it) => (
                  <li key={it} className="flex items-center gap-2 text-sm" style={{ color: "var(--color-text-muted)" }}>
                    <IconCheck />
                    {it}
                  </li>
                ))}
              </ul>
            </div>
            <div
              className="relative min-h-64 lg:min-h-0 flex items-center justify-center p-10"
              style={{
                background:
                  "linear-gradient(135deg, oklch(20% 0.05 260) 0%, oklch(15% 0.04 260) 100%)",
                borderLeft: "1px solid oklch(100% 0 0 / 0.06)",
              }}
            >
              <div className="relative w-full max-w-xs">
                {/* Simulated creator cards */}
                {[
                  { name: "Alex Rivera", niche: "Tech & Lifestyle", match: "98%" },
                  { name: "Maya Chen", niche: "Fashion & Beauty", match: "94%" },
                  { name: "Jordan Kim", niche: "Gaming", match: "91%" },
                ].map((c, i) => (
                  <div
                    key={c.name}
                    className="glass-sm p-3 flex items-center gap-3 mb-2"
                    style={{
                      opacity: 1 - i * 0.08,
                      transform: `scale(${1 - i * 0.02})`,
                      transformOrigin: "top center",
                    }}
                  >
                    <div
                      className="w-9 h-9 rounded-full shrink-0"
                      style={{
                        background: `oklch(${55 + i * 8}% 0.18 ${250 + i * 20})`,
                      }}
                      aria-hidden
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold truncate" style={{ color: "var(--color-text)" }}>
                        {c.name}
                      </p>
                      <p className="text-xs truncate" style={{ color: "var(--color-text-faint)" }}>
                        {c.niche}
                      </p>
                    </div>
                    <span
                      className="text-xs font-bold shrink-0"
                      style={{ color: "var(--color-accent)" }}
                    >
                      {c.match}
                    </span>
                  </div>
                ))}
                {/* glow */}
                <div
                  aria-hidden
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    background:
                      "radial-gradient(ellipse 80% 60% at 50% 10%, oklch(65% 0.22 255 / 0.08) 0%, transparent 70%)",
                  }}
                />
              </div>
            </div>
          </div>

          {/* Feature 2 — Automated outreach (reversed) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 glass overflow-hidden reveal feature-card">
            <div
              className="relative min-h-64 lg:min-h-0 flex items-center justify-center p-10 order-last lg:order-first"
              style={{
                background:
                  "linear-gradient(135deg, oklch(15% 0.04 260) 0%, oklch(20% 0.05 260) 100%)",
                borderRight: "1px solid oklch(100% 0 0 / 0.06)",
              }}
            >
              <div className="relative w-full max-w-xs space-y-2">
                {[
                  { label: "Outreach sent", val: "1,240", delta: "+12%" },
                  { label: "Reply rate", val: "34%", delta: "+8%" },
                  { label: "Deals closed", val: "67", delta: "+22%" },
                ].map((m) => (
                  <div key={m.label} className="glass-sm p-3 flex items-center justify-between gap-3">
                    <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                      {m.label}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold" style={{ fontFamily: "var(--font-display)", color: "var(--color-text)" }}>
                        {m.val}
                      </span>
                      <span className="text-xs font-semibold" style={{ color: "oklch(60% 0.2 150)" }}>
                        {m.delta}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="p-10 lg:p-14 flex flex-col justify-center">
              <span
                className="text-xs font-semibold tracking-widest uppercase mb-4"
                style={{ color: "var(--color-accent)", fontFamily: "var(--font-display)" }}
              >
                Automated outreach
              </span>
              <h3
                className="mb-4"
                style={{
                  fontFamily: "var(--font-display)",
                  fontWeight: 700,
                  fontSize: "clamp(1.4rem, 3vw, 2rem)",
                  lineHeight: 1.25,
                  color: "var(--color-text)",
                }}
              >
                Outreach that reads human.
                <br />
                Results that scale.
              </h3>
              <p
                className="mb-6"
                style={{
                  fontSize: "clamp(0.9rem, 1.5vw, 1.05rem)",
                  lineHeight: 1.7,
                  color: "var(--color-text-muted)",
                }}
              >
                Aha drafts personalised pitches for each creator — referencing
                their recent content, audience, and past brand work — then
                handles all follow-ups, objections, and scheduling
                automatically, at any scale.
              </p>
              <ul className="space-y-2">
                {[
                  "Personalised per creator, at any volume",
                  "Automated follow-up sequences",
                  "34% average reply rate",
                ].map((it) => (
                  <li key={it} className="flex items-center gap-2 text-sm" style={{ color: "var(--color-text-muted)" }}>
                    <IconCheck />
                    {it}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Feature 3 — Pricing negotiation */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 glass overflow-hidden reveal feature-card">
            <div className="p-10 lg:p-14 flex flex-col justify-center">
              <span
                className="text-xs font-semibold tracking-widest uppercase mb-4"
                style={{ color: "var(--color-accent)", fontFamily: "var(--font-display)" }}
              >
                Pricing negotiation
              </span>
              <h3
                className="mb-4"
                style={{
                  fontFamily: "var(--font-display)",
                  fontWeight: 700,
                  fontSize: "clamp(1.4rem, 3vw, 2rem)",
                  lineHeight: 1.25,
                  color: "var(--color-text)",
                }}
              >
                Fair rates, every time.
                <br />
                No awkward haggling.
              </h3>
              <p
                className="mb-6"
                style={{
                  fontSize: "clamp(0.9rem, 1.5vw, 1.05rem)",
                  lineHeight: 1.7,
                  color: "var(--color-text-muted)",
                }}
              >
                Our negotiation engine is trained on millions of real creator
                deals. It sets market-benchmarked offers, counters
                professionally, and closes at rates that keep both brands and
                creators happy.
              </p>
              <ul className="space-y-2">
                {[
                  "Market-rate benchmarking",
                  "Automated counter-offers",
                  "Average 23% cost savings",
                ].map((it) => (
                  <li key={it} className="flex items-center gap-2 text-sm" style={{ color: "var(--color-text-muted)" }}>
                    <IconCheck />
                    {it}
                  </li>
                ))}
              </ul>
            </div>
            <div
              className="relative min-h-64 lg:min-h-0 flex items-center justify-center p-10"
              style={{
                background:
                  "linear-gradient(135deg, oklch(20% 0.05 260) 0%, oklch(15% 0.04 260) 100%)",
                borderLeft: "1px solid oklch(100% 0 0 / 0.06)",
              }}
            >
              <div className="relative w-full max-w-xs space-y-2">
                <div className="glass-sm p-4">
                  <p className="text-xs mb-3" style={{ color: "var(--color-text-faint)" }}>
                    Negotiation in progress
                  </p>
                  {[
                    { label: "Creator ask", val: "$2,400", color: "var(--color-text-muted)" },
                    { label: "Aha counter", val: "$1,850", color: "var(--color-accent)" },
                    { label: "Final agreed", val: "$1,950", color: "oklch(60% 0.2 150)" },
                  ].map((r) => (
                    <div key={r.label} className="flex justify-between items-center py-1.5 border-b last:border-0" style={{ borderColor: "oklch(100% 0 0 / 0.06)" }}>
                      <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                        {r.label}
                      </span>
                      <span className="text-sm font-bold" style={{ color: r.color, fontFamily: "var(--font-display)" }}>
                        {r.val}
                      </span>
                    </div>
                  ))}
                  <p className="text-xs mt-3 font-semibold" style={{ color: "oklch(60% 0.2 150)" }}>
                    Saved $450 (19%) ↓
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Section>

      <div className="section-divider" aria-hidden />

      {/* ── Feature Grid (6 secondary) ─────────────────────────────────── */}
      <Section className="py-24">
        <div className="text-center mb-14 reveal">
          <p
            className="text-xs font-semibold tracking-widest uppercase mb-3"
            style={{ color: "var(--color-accent)", fontFamily: "var(--font-display)" }}
          >
            Everything else
          </p>
          <h2
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 700,
              fontSize: "clamp(1.8rem, 4vw, 3rem)",
              letterSpacing: "-0.02em",
              color: "var(--color-text)",
            }}
          >
            Every step of the campaign,
            <br />
            covered.
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            {
              icon: "📄",
              title: "Contract management",
              desc: "Auto-generated, legally sound contracts with e-signature for every deal.",
            },
            {
              icon: "📡",
              title: "Progress monitoring",
              desc: "Live campaign status — who's posted, what's pending, what needs attention.",
            },
            {
              icon: "✅",
              title: "Content verification",
              desc: "AI reviews content against brand guidelines before you pay a single cent.",
            },
            {
              icon: "🔒",
              title: "Escrow protection",
              desc: "Funds held securely and released only when deliverables are confirmed.",
            },
            {
              icon: "📊",
              title: "Performance tracking",
              desc: "Real-time views, reach, engagement, and ROI across every campaign.",
            },
            {
              icon: "🛡️",
              title: "Real-time risk detection",
              desc: "Flags sudden follower drops, bot activity, or brand safety incidents instantly.",
            },
          ].map(({ icon, title, desc }) => (
            <div key={title} className="glass p-6 feature-card reveal">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center mb-4 text-xl"
                style={{ background: "oklch(65% 0.22 255 / 0.1)" }}
                aria-hidden
              >
                {icon}
              </div>
              <h3
                className="font-semibold mb-2"
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "clamp(0.95rem, 1.5vw, 1.05rem)",
                  color: "var(--color-text)",
                }}
              >
                {title}
              </h3>
              <p
                className="text-sm"
                style={{ lineHeight: 1.65, color: "var(--color-text-muted)" }}
              >
                {desc}
              </p>
            </div>
          ))}
        </div>
      </Section>

      <div className="section-divider" aria-hidden />

      {/* ── Social Proof ───────────────────────────────────────────────── */}
      <Section id="social-proof" className="py-24">
        <div className="text-center mb-14 reveal">
          <p
            className="text-xs font-semibold tracking-widest uppercase mb-3"
            style={{ color: "var(--color-accent)", fontFamily: "var(--font-display)" }}
          >
            Trusted by teams worldwide
          </p>
          <h2
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 700,
              fontSize: "clamp(1.8rem, 4vw, 3rem)",
              letterSpacing: "-0.02em",
              color: "var(--color-text)",
            }}
          >
            Leading AI-native teams
            <br />
            run their campaigns on Aha
          </h2>
        </div>

        {/* Logo reel */}
        <div className="overflow-hidden mb-12 reveal" aria-label="Partner brands">
          <div className="marquee-track">
            {[...Array(2)].map((_, pass) =>
              [
                "TechBrand", "Stylehaus", "NovaMed", "Apex Sports",
                "Luna Beauty", "GridStack", "PolarWave", "SkyForge",
              ].map((brand) => (
                <div
                  key={`${brand}-${pass}`}
                  className="flex items-center justify-center mx-8 shrink-0"
                >
                  <span
                    className="text-sm font-bold tracking-widest uppercase"
                    style={{ color: "var(--color-text-faint)" }}
                  >
                    {brand}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Quote cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[
            {
              quote:
                "We ran 3 campaigns in parallel — something that used to take a full team — with just one person overseeing Aha. The ROI was undeniable.",
              name: "Sarah K.",
              title: "Head of Growth, TechBrand",
            },
            {
              quote:
                "The outreach quality genuinely surprised me. Creators thought we wrote each message by hand. Aha handled 400+ negotiations in a week.",
              name: "Marcus L.",
              title: "Influencer Lead, StyleHaus",
            },
          ].map(({ quote, name, title }) => (
            <div key={name} className="glass p-8 reveal">
              <p
                className="mb-6"
                style={{
                  fontSize: "clamp(0.95rem, 1.5vw, 1.05rem)",
                  lineHeight: 1.75,
                  color: "var(--color-text-muted)",
                  fontStyle: "italic",
                }}
              >
                &ldquo;{quote}&rdquo;
              </p>
              <div>
                <p
                  className="font-semibold"
                  style={{ fontFamily: "var(--font-display)", color: "var(--color-text)" }}
                >
                  {name}
                </p>
                <p className="text-sm" style={{ color: "var(--color-text-faint)" }}>
                  {title}
                </p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <div className="section-divider" aria-hidden />

      {/* ── Guarantee ──────────────────────────────────────────────────── */}
      <Section id="guarantee" className="py-24">
        <div className="text-center mb-14 reveal">
          <p
            className="text-xs font-semibold tracking-widest uppercase mb-3"
            style={{ color: "var(--color-accent)", fontFamily: "var(--font-display)" }}
          >
            Our guarantee
          </p>
          <h2
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 700,
              fontSize: "clamp(1.8rem, 4vw, 3rem)",
              letterSpacing: "-0.02em",
              color: "var(--color-text)",
            }}
          >
            You're protected at
            <br />
            every step
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            {
              icon: "💳",
              accent: "oklch(65% 0.22 255)",
              title: "Payment upon delivery",
              desc: "Funds are held in escrow and only released once content is verified live. You never pay for work that isn't done.",
            },
            {
              icon: "📋",
              accent: "oklch(60% 0.2 150)",
              title: "Dual-sided contract",
              desc: "Every campaign is backed by a legally binding contract protecting both you and the creator. Disputes are rare — but covered if they arise.",
            },
            {
              icon: "📈",
              accent: "oklch(75% 0.18 75)",
              title: "Verified real traffic",
              desc: "Aha's detection engine flags inflated or fake engagement before you commit. Only authentic audiences count.",
            },
          ].map(({ icon, accent, title, desc }) => (
            <div
              key={title}
              className="glass p-8 reveal feature-card"
              style={{ borderTop: `2px solid ${accent}` }}
            >
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center text-xl mb-5"
                style={{ background: `${accent}18` }}
                aria-hidden
              >
                {icon}
              </div>
              <h3
                className="font-bold mb-3"
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "clamp(1rem, 1.8vw, 1.15rem)",
                  color: "var(--color-text)",
                }}
              >
                {title}
              </h3>
              <p
                className="text-sm"
                style={{ lineHeight: 1.7, color: "var(--color-text-muted)" }}
              >
                {desc}
              </p>
            </div>
          ))}
        </div>
      </Section>

      <div className="section-divider" aria-hidden />

      {/* ── CTA ────────────────────────────────────────────────────────── */}
      <section
        id="cta"
        data-reveal
        className="relative py-32 px-4 sm:px-6 lg:px-8 overflow-hidden"
        aria-label="Call to action"
      >
        {/* glow */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-0"
          style={{
            background:
              "radial-gradient(ellipse 60% 60% at 50% 50%, oklch(65% 0.22 255 / 0.09) 0%, transparent 70%)",
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-0"
          style={{
            background:
              "radial-gradient(ellipse 40% 40% at 50% 50%, oklch(65% 0.22 255 / 0.05) 0%, transparent 60%)",
          }}
        />

        <div className="relative z-10 mx-auto max-w-3xl text-center">
          <h2
            className="reveal"
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 800,
              fontSize: "clamp(2rem, 5vw, 3.8rem)",
              lineHeight: 1.1,
              letterSpacing: "-0.03em",
              color: "var(--color-text)",
            }}
          >
            Launch your next campaign
            <br />
            tonight.
          </h2>
          <p
            className="mt-6 reveal"
            style={{
              fontSize: "clamp(1rem, 2vw, 1.2rem)",
              lineHeight: 1.7,
              color: "var(--color-text-muted)",
            }}
          >
            Join thousands of brands running smarter influencer campaigns
            with Aha's AI platform. Free to start, no credit card required.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-10 reveal">
            <a
              href="https://app.aha.inc"
              className="btn-accent px-10 py-4 text-base"
            >
              Get started free
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                aria-hidden
              >
                <path
                  d="M3 8h10M9 4l4 4-4 4"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </a>
            <a
              href="mailto:hello@aha.inc"
              className="btn-ghost px-10 py-4 text-base"
            >
              Talk to sales
            </a>
          </div>
          <p
            className="mt-5 text-sm reveal"
            style={{ color: "var(--color-text-faint)" }}
          >
            Trusted by teams in 140+ countries · No credit card required
          </p>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────────────── */}
      <footer
        className="relative z-10 border-t px-4 sm:px-6 lg:px-8 py-12"
        style={{ borderColor: "oklch(100% 0 0 / 0.07)" }}
        aria-label="Site footer"
      >
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
            <div>
              <a
                href="#"
                style={{
                  fontFamily: "var(--font-display)",
                  fontWeight: 800,
                  fontSize: "1.25rem",
                  color: "var(--color-text)",
                }}
              >
                aha<span style={{ color: "var(--color-accent)" }}>.</span>
              </a>
              <p
                className="mt-2 text-sm max-w-xs"
                style={{ color: "var(--color-text-faint)", lineHeight: 1.65 }}
              >
                Your 24/7 AI employee for influencer marketing. 5M+ creators.
                140+ countries.
              </p>
            </div>

            <nav className="flex flex-wrap gap-x-8 gap-y-3" aria-label="Footer links">
              {[
                { label: "Product", href: "#features" },
                { label: "How it works", href: "#how-it-works" },
                { label: "Pricing", href: "https://aha.inc/pricing" },
                { label: "Blog", href: "https://aha.inc/blog" },
                { label: "Privacy", href: "https://aha.inc/privacy" },
                { label: "Terms", href: "https://aha.inc/terms" },
              ].map(({ label, href }) => (
                <a
                  key={label}
                  href={href}
                  className="text-sm transition-colors duration-200"
                  style={{ color: "var(--color-text-faint)" }}
                  onMouseEnter={(e) =>
                    ((e.target as HTMLElement).style.color = "var(--color-text-muted)")
                  }
                  onMouseLeave={(e) =>
                    ((e.target as HTMLElement).style.color = "var(--color-text-faint)")
                  }
                >
                  {label}
                </a>
              ))}
            </nav>
          </div>

          <div
            className="mt-8 pt-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-t"
            style={{ borderColor: "oklch(100% 0 0 / 0.06)" }}
          >
            <p className="text-xs" style={{ color: "var(--color-text-faint)" }}>
              &copy; {new Date().getFullYear()} Aha Inc. All rights reserved.
            </p>
            <p className="text-xs" style={{ color: "var(--color-text-faint)" }}>
              Built with AI. Run by AI. For humans.
            </p>
          </div>
        </div>
      </footer>
    </main>
  );
}
