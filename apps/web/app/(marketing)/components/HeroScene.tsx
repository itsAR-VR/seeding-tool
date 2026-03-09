"use client";

import type { CSSProperties } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import CtaLink from "./CtaLink";
import { trackEvent } from "./analytics";
import styles from "./HeroScene.module.css";

type HeroMediaItem = {
  accent: string;
  handle: string;
  id: string;
  kind: string;
  note: string;
  title: string;
};

type Slot = {
  opacity: number;
  rotate: number;
  scale: number;
  x: number;
  y: number;
  z: number;
};

type DockMetric = {
  scale: number;
  x: number;
  y: number;
};

const HERO_MEDIA: readonly HeroMediaItem[] = [
  {
    accent: "#ffb28d",
    handle: "@miatorres",
    id: "routine-pass",
    kind: "Reel",
    note: "Shelf routine breakdown",
    title: "Routine pass",
  },
  {
    accent: "#9cb6ff",
    handle: "@noahchen",
    id: "unboxing-cut",
    kind: "Reel",
    note: "Launch-day unboxing cut",
    title: "Unboxing cut",
  },
  {
    accent: "#84d7c0",
    handle: "@julescarter",
    id: "story-mention",
    kind: "Story",
    note: "Quick follow-up mention",
    title: "Story mention",
  },
  {
    accent: "#e6a28d",
    handle: "@avasingh",
    id: "creator-proof",
    kind: "UGC",
    note: "Before / after proof",
    title: "Proof collage",
  },
  {
    accent: "#9db2f4",
    handle: "@nadiakim",
    id: "kitchen-demo",
    kind: "Reel",
    note: "Kitchen demo sequence",
    title: "Kitchen demo",
  },
  {
    accent: "#92d0b2",
    handle: "@andrewsoto",
    id: "delivery-moment",
    kind: "Post",
    note: "Drop-off confirmation",
    title: "Delivery drop",
  },
] as const;

const DASHBOARD_METRICS = [
  { label: "Active campaigns", value: "6" },
  { label: "Creators in lane", value: "42" },
  { label: "Pending interventions", value: "3" },
  { label: "Orders in transit", value: "17" },
] as const;

const CAMPAIGN_ROWS = [
  { creators: "12 creators", label: "Spring shelf send", status: "Active" },
  { creators: "8 creators", label: "Launch unboxing push", status: "Live" },
  { creators: "11 creators", label: "Kitchen refresh", status: "Queued" },
] as const;

const ACTION_ROWS = [
  { detail: "Need address confirmation", label: "Mia Torres", tone: "Address" },
  { detail: "Approve replacement SKU", label: "Noah Chen", tone: "Review" },
  { detail: "Follow up on missing post", label: "Ava Singh", tone: "Intervention" },
] as const;

const DESKTOP_CAROUSEL_SLOTS: readonly Slot[] = [
  { x: 54, y: 17, scale: 0.42, opacity: 0.06, rotate: -10, z: 1 },
  { x: 61, y: 18, scale: 0.72, opacity: 0.52, rotate: -7, z: 2 },
  { x: 71, y: 18, scale: 1, opacity: 1, rotate: -3, z: 4 },
  { x: 82, y: 18, scale: 1.02, opacity: 1, rotate: 3, z: 5 },
  { x: 91, y: 18, scale: 0.72, opacity: 0.52, rotate: 7, z: 2 },
  { x: 98, y: 17, scale: 0.42, opacity: 0.06, rotate: 10, z: 1 },
] as const;

const MOBILE_CAROUSEL_SLOTS: readonly Slot[] = [
  { x: 25, y: 43.5, scale: 0.28, opacity: 0, rotate: -10, z: 0 },
  { x: 38, y: 43, scale: 0.4, opacity: 0.08, rotate: -8, z: 1 },
  { x: 56, y: 42.5, scale: 0.96, opacity: 1, rotate: -2, z: 4 },
  { x: 79, y: 43, scale: 0.66, opacity: 0.46, rotate: 5, z: 2 },
  { x: 98, y: 43.5, scale: 0.4, opacity: 0.08, rotate: 8, z: 1 },
  { x: 111, y: 43.5, scale: 0.28, opacity: 0, rotate: 10, z: 0 },
] as const;

const DESKTOP_DOCK_SLOTS: readonly Slot[] = [
  { x: 48, y: 76, scale: 0.43, opacity: 1, rotate: 0, z: 3 },
  { x: 60.5, y: 76, scale: 0.43, opacity: 1, rotate: 0, z: 3 },
  { x: 73, y: 76, scale: 0.43, opacity: 1, rotate: 0, z: 3 },
  { x: 85.5, y: 76, scale: 0.43, opacity: 1, rotate: 0, z: 3 },
] as const;

const MOBILE_DOCK_SLOTS: readonly Slot[] = [
  { x: 34, y: 74, scale: 0.5, opacity: 1, rotate: 0, z: 3 },
  { x: 67, y: 74, scale: 0.5, opacity: 1, rotate: 0, z: 3 },
] as const;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function lerp(start: number, end: number, progress: number) {
  return start + (end - start) * progress;
}

function smoothstep(progress: number) {
  return progress * progress * (3 - 2 * progress);
}

function slotIndexFor(itemIndex: number, activeIndex: number, total: number) {
  return (itemIndex - activeIndex + total) % total;
}

function desktopDockIndexForSlot(slotIndex: number) {
  if (slotIndex >= 1 && slotIndex <= 4) {
    return slotIndex - 1;
  }

  return -1;
}

function mobileDockIndexForSlot(slotIndex: number) {
  if (slotIndex === 2) {
    return 0;
  }

  if (slotIndex === 3) {
    return 1;
  }

  return -1;
}

export default function HeroScene() {
  const rootRef = useRef<HTMLDivElement>(null);
  const slotRefs = useRef<Array<HTMLElement | null>>([]);
  const dockTargetRefs = useRef<Array<HTMLDivElement | null>>([]);
  const cardSizerRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(4);
  const [isMobile, setIsMobile] = useState(false);
  const [isStackedLayout, setIsStackedLayout] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [progress, setProgress] = useState(0);
  const [dockMetrics, setDockMetrics] = useState<DockMetric[]>([]);

  useEffect(() => {
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const mobileQuery = window.matchMedia("(max-width: 920px)");
    const stackedQuery = window.matchMedia("(max-width: 1100px)");

    const syncState = () => {
      setPrefersReducedMotion(motionQuery.matches);
      setIsMobile(mobileQuery.matches);
      setIsStackedLayout(stackedQuery.matches);
    };

    syncState();
    motionQuery.addEventListener("change", syncState);
    mobileQuery.addEventListener("change", syncState);
    stackedQuery.addEventListener("change", syncState);

    return () => {
      motionQuery.removeEventListener("change", syncState);
      mobileQuery.removeEventListener("change", syncState);
      stackedQuery.removeEventListener("change", syncState);
    };
  }, []);

  useEffect(() => {
    if (prefersReducedMotion || isPaused || progress > 0.04) {
      return undefined;
    }

    const interval = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % HERO_MEDIA.length);
    }, 4500);

    return () => window.clearInterval(interval);
  }, [isPaused, prefersReducedMotion, progress]);

  useEffect(() => {
    const root = rootRef.current;

    if (!root) {
      return undefined;
    }

    let frame = 0;

    const updateProgress = () => {
      frame = 0;

      if (prefersReducedMotion) {
        setProgress(0);
        return;
      }

      const rect = root.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const start = viewportHeight * 0.14;
      const firstSlot = slotRefs.current[0];
      const endThreshold = isMobile ? 0.62 : isStackedLayout ? 0.54 : 0.46;
      const end = firstSlot
        ? Math.max(
            firstSlot.getBoundingClientRect().top -
              rect.top -
              viewportHeight * endThreshold,
            1,
          )
        : Math.max(root.offsetHeight - viewportHeight * 0.78, 1);
      const scrolled = clamp(start - rect.top, 0, end);
      const nextProgress = clamp(scrolled / end, 0, 1);

      setProgress((current) =>
        Math.abs(current - nextProgress) < 0.01 ? current : nextProgress,
      );
    };

    const onScrollOrResize = () => {
      if (frame !== 0) {
        return;
      }

      frame = window.requestAnimationFrame(updateProgress);
    };

    onScrollOrResize();
    window.addEventListener("scroll", onScrollOrResize, { passive: true });
    window.addEventListener("resize", onScrollOrResize);

    return () => {
      if (frame !== 0) {
        window.cancelAnimationFrame(frame);
      }
      window.removeEventListener("scroll", onScrollOrResize);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [isMobile, isStackedLayout, prefersReducedMotion]);

  const easedProgress = prefersReducedMotion ? 0 : smoothstep(progress);
  const carouselSlots = isMobile ? MOBILE_CAROUSEL_SLOTS : DESKTOP_CAROUSEL_SLOTS;
  const dockSlotCount = isMobile ? 2 : 4;
  const dockedItems = useMemo(() => {
    return HERO_MEDIA.map((item, index) => {
      const slotIndex = slotIndexFor(index, activeIndex, HERO_MEDIA.length);
      const dockIndex = isMobile
        ? mobileDockIndexForSlot(slotIndex)
        : desktopDockIndexForSlot(slotIndex);

      if (dockIndex < 0) {
        return null;
      }

      return { dockIndex, item };
    })
      .filter((entry): entry is { dockIndex: number; item: HeroMediaItem } => entry !== null)
      .sort((left, right) => left.dockIndex - right.dockIndex)
      .map((entry) => entry.item);
  }, [activeIndex, isMobile]);

  useEffect(() => {
    const root = rootRef.current;
    const cardSizer = cardSizerRef.current;

    if (!root || !cardSizer) {
      return undefined;
    }

    let frame = 0;

    const computeDockMetrics = () => {
      frame = 0;

      const rootRect = root.getBoundingClientRect();
      const cardRect = cardSizer.getBoundingClientRect();

      if (!rootRect.width || !rootRect.height || !cardRect.width || !cardRect.height) {
        return;
      }

      const nextMetrics = dockTargetRefs.current
        .slice(0, dockSlotCount)
        .map((target) => {
          if (!target) {
            return null;
          }

          const targetRect = target.getBoundingClientRect();
          const targetWidth = Math.max(targetRect.width - 8, 1);
          const targetHeight = Math.max(targetRect.height - 8, 1);
          const scale = Math.min(
            targetWidth / cardRect.width,
            targetHeight / cardRect.height,
          );

          return {
            scale,
            x: ((targetRect.left + targetRect.width / 2 - rootRect.left) / rootRect.width) * 100,
            y: ((targetRect.top + targetRect.height / 2 - rootRect.top) / rootRect.height) * 100,
          };
        })
        .filter((metric): metric is DockMetric => metric !== null);

      setDockMetrics((current) => {
        const sameLength = current.length === nextMetrics.length;
        const isSame =
          sameLength &&
          current.every((metric, index) => {
            const nextMetric = nextMetrics[index];
            return (
              Math.abs(metric.x - nextMetric.x) < 0.2 &&
              Math.abs(metric.y - nextMetric.y) < 0.2 &&
              Math.abs(metric.scale - nextMetric.scale) < 0.02
            );
          });

        return isSame ? current : nextMetrics;
      });
    };

    const scheduleCompute = () => {
      if (frame !== 0) {
        return;
      }

      frame = window.requestAnimationFrame(computeDockMetrics);
    };

    scheduleCompute();

    const resizeObserver = new ResizeObserver(scheduleCompute);
    resizeObserver.observe(root);
    resizeObserver.observe(cardSizer);
    dockTargetRefs.current.slice(0, dockSlotCount).forEach((target) => {
      if (target) {
        resizeObserver.observe(target);
      }
    });

    window.addEventListener("resize", scheduleCompute);

    return () => {
      if (frame !== 0) {
        window.cancelAnimationFrame(frame);
      }
      resizeObserver.disconnect();
      window.removeEventListener("resize", scheduleCompute);
    };
  }, [dockSlotCount]);

  const staticHeroItems = useMemo(() => {
    const visibleSlots = isMobile ? new Set([2, 3]) : new Set([1, 2, 3, 4]);

    return HERO_MEDIA.map((item, index) => {
      const slotIndex = slotIndexFor(index, activeIndex, HERO_MEDIA.length);
      return { item, slotIndex };
    })
      .filter(({ slotIndex }) => visibleSlots.has(slotIndex))
      .sort((left, right) => left.slotIndex - right.slotIndex);
  }, [activeIndex, isMobile]);

  return (
    <div
      ref={rootRef}
      className={styles.root}
      data-hero-stage=""
      data-hero-active-index={String(activeIndex)}
      data-hero-state={
        prefersReducedMotion ? "reduced" : easedProgress > 0.92 ? "docked" : "carousel"
      }
      data-transition-progress={easedProgress.toFixed(2)}
      onBlur={() => setIsPaused(false)}
      onFocus={() => setIsPaused(true)}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      style={{ "--hero-progress": easedProgress } as CSSProperties}
    >
      <div className={styles.gradientBase} aria-hidden="true" />
      <div className={styles.gradientWave} aria-hidden="true" />
      <div className={styles.gradientBloom} aria-hidden="true" />

      <div className={styles.surface}>
        <div className={styles.heroGrid}>
          <div className={styles.copyColumn} data-reveal>
            <p className="eyebrow">Seeding OS for operator-led growth teams</p>
            <h1 className={styles.headline}>
              Run seeding like a channel, not a side project.
            </h1>
            <p className={styles.copy}>
              Find brand-fit creators, run the outreach, collect the address,
              ship the box, and see what actually posted from one operating
              system.
            </p>
            <div className={styles.actions}>
              <CtaLink
                className="btn btn-solid"
                event="hero_primary_cta"
                fallbackId="#home-lead-form"
                label="Book a live walkthrough"
                source="landing_page"
              />
              <a
                className={styles.workflowLink}
                href="#workflow"
                onClick={() => trackEvent("hero_view_workflow", "landing_page")}
              >
                See the workflow
              </a>
            </div>
            <p className={styles.note}>
              AI handles the ranking, reply drafting, and follow-up flags. Your
              team still makes the calls.
            </p>
          </div>

          <div className={styles.mediaColumn} data-reveal>
            <div className={styles.carouselShell} data-hero-carousel="">
              <div className={styles.carouselHeader}>
                <div>
                  <p className={styles.carouselEyebrow}>
                    Creator content in motion
                  </p>
                  <h2 className={styles.carouselTitle}>
                    Watch the lane before it lands in the dashboard.
                  </h2>
                </div>
                <span className={styles.carouselStatus}>Live reel queue</span>
              </div>

              <div className={styles.carouselViewport}>
                <div className={styles.viewportFrame} />
                <div className={styles.viewportGlow} />
                <div className={styles.viewportRail}>
                  <span>Two lead reels</span>
                  <span>Rotating queue</span>
                  <span>Social listening handoff</span>
                </div>

                {prefersReducedMotion && (
                  <div className={styles.staticHeroLayer} aria-hidden="true">
                    {staticHeroItems.map(({ item, slotIndex }) => {
                      const start = carouselSlots[slotIndex];
                      const lead = isMobile
                        ? slotIndex === 2
                        : slotIndex === 2 || slotIndex === 3;

                      return (
                        <article
                          key={item.id}
                          className={[
                            styles.card,
                            lead ? styles.cardLead : styles.cardSide,
                          ].join(" ")}
                          data-hero-reel={item.id}
                          style={
                            {
                              "--card-accent": item.accent,
                              left: `${start.x}%`,
                              opacity: start.opacity,
                              top: `${start.y}%`,
                              transform: `translate(-50%, -50%) scale(${start.scale}) rotate(${start.rotate}deg)`,
                              zIndex: start.z,
                            } as CSSProperties
                          }
                        >
                          <PosterCard item={item} emphasize={lead} />
                        </article>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className={styles.carouselFooter}>
                <p>
                  The reels start as raw creator content, not as dashboard
                  widgets.
                </p>
                <p>
                  Scroll and the system pulls the live pieces into the mentions
                  view below.
                </p>
              </div>
            </div>
          </div>
        </div>

        <section
          className={styles.dashboardShowcase}
          data-dashboard-showcase=""
          data-reveal
        >
          <div className={styles.dashboardIntro}>
            <div>
              <p className="eyebrow">Dashboard preview</p>
              <h2 className={styles.dashboardTitle}>
                The real operating view starts when those reels hit mentions.
              </h2>
            </div>
            <p className={styles.dashboardCopy}>
              Recent mentions is the landing zone. Metrics, action queue, and
              campaign context fill in around it once the content is inside the
              system.
            </p>
          </div>

          <div className={styles.metricRow}>
            {DASHBOARD_METRICS.map((metric) => (
              <article key={metric.label} className={styles.metricCard}>
                <span>{metric.label}</span>
                <strong>{metric.value}</strong>
              </article>
            ))}
          </div>

          <section className={styles.mentionsPanel}>
            <div className={styles.panelHeader}>
              <div>
                <p className={styles.panelEyebrow}>Social listening</p>
                <h3>Recent mentions</h3>
              </div>
              <span className={styles.panelChip}>Landing zone</span>
            </div>

            <div className={styles.mentionsGrid}>
              {(isMobile ? MOBILE_DOCK_SLOTS : DESKTOP_DOCK_SLOTS).map(
                (_, index) => {
                  const fallback = dockedItems[index] ?? HERO_MEDIA[index];
                  return (
                    <article
                      key={`slot-${index}`}
                      className={styles.mentionSlot}
                      data-mentions-slot={String(index)}
                      ref={(node) => {
                        slotRefs.current[index] = node;
                      }}
                    >
                      <div className={styles.mentionText}>
                        <span className={styles.mentionKind}>
                          {fallback.kind}
                        </span>
                        <strong>{fallback.title}</strong>
                        <span>{fallback.handle}</span>
                      </div>
                      <div
                        ref={(node) => {
                          dockTargetRefs.current[index] = node;
                        }}
                        className={styles.mentionMediaTarget}
                        data-mentions-target={String(index)}
                        aria-hidden="true"
                      />
                    </article>
                  );
                },
              )}
            </div>
          </section>

          <div className={styles.dashboardGrid}>
            <section className={styles.dashboardPanel}>
              <div className={styles.panelHeader}>
                <div>
                  <p className={styles.panelEyebrow}>Campaigns</p>
                  <h3>Recent campaigns</h3>
                </div>
                <span className={styles.panelChip}>3 live</span>
              </div>
              <div className={styles.panelList}>
                {CAMPAIGN_ROWS.map((row) => (
                  <article key={row.label} className={styles.listRow}>
                    <div>
                      <strong>{row.label}</strong>
                      <span>{row.creators}</span>
                    </div>
                    <span className={styles.listTag}>{row.status}</span>
                  </article>
                ))}
              </div>
            </section>

            <section className={styles.dashboardPanel}>
              <div className={styles.panelHeader}>
                <div>
                  <p className={styles.panelEyebrow}>Action queue</p>
                  <h3>Need operator attention</h3>
                </div>
                <span className={styles.panelChip}>3 active</span>
              </div>
              <div className={styles.panelList}>
                {ACTION_ROWS.map((row) => (
                  <article key={row.label} className={styles.listRow}>
                    <div>
                      <strong>{row.label}</strong>
                      <span>{row.detail}</span>
                    </div>
                    <span className={styles.listTag}>{row.tone}</span>
                  </article>
                ))}
              </div>
            </section>
          </div>
        </section>
      </div>

      {!prefersReducedMotion && (
        <div className={styles.cardLayer} aria-hidden="true">
          <div ref={cardSizerRef} className={styles.cardSizer} />
          {HERO_MEDIA.map((item, index) => {
            const slotIndex = slotIndexFor(index, activeIndex, HERO_MEDIA.length);
            const start = carouselSlots[slotIndex];
            const dockIndex = isMobile
              ? mobileDockIndexForSlot(slotIndex)
              : desktopDockIndexForSlot(slotIndex);
            const measuredDock = dockIndex >= 0 ? dockMetrics[dockIndex] : null;
            const end =
              dockIndex >= 0
                ? measuredDock
                  ? {
                      opacity: 1,
                      rotate: 0,
                      scale: measuredDock.scale,
                      x: measuredDock.x,
                      y: measuredDock.y,
                      z: 3,
                    }
                  : (isMobile ? MOBILE_DOCK_SLOTS : DESKTOP_DOCK_SLOTS)[dockIndex]
                : {
                    opacity: 0,
                    rotate: start.rotate * 0.2,
                    scale: start.scale * 0.72,
                    x: start.x + (slotIndex < 3 ? -6 : 6),
                    y: start.y + 26,
                    z: 0,
                  };
            const x = lerp(start.x, end.x, easedProgress);
            const y = lerp(start.y, end.y, easedProgress);
            const scale = lerp(start.scale, end.scale, easedProgress);
            const opacity = lerp(start.opacity, end.opacity, easedProgress);
            const rotate = lerp(start.rotate, end.rotate, easedProgress);
            const lead = isMobile
              ? slotIndex === 2
              : slotIndex === 2 || slotIndex === 3;

            return (
              <article
                key={item.id}
                className={[
                  styles.card,
                  lead ? styles.cardLead : styles.cardSide,
                ].join(" ")}
                data-hero-reel={item.id}
                style={
                  {
                    "--card-accent": item.accent,
                    left: `${x}%`,
                    opacity,
                    top: `${y}%`,
                    transform: `translate(-50%, -50%) scale(${scale}) rotate(${rotate}deg)`,
                    zIndex: easedProgress > 0.55 ? 12 - index : start.z,
                  } as CSSProperties
                }
              >
                <PosterCard item={item} emphasize={lead} />
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

function PosterCard({
  item,
  emphasize,
}: {
  item: HeroMediaItem;
  emphasize: boolean;
}) {
  return (
    <div className={styles.poster}>
      <span className={styles.posterKind}>{item.kind}</span>
      <div className={styles.posterFrame}>
        <div className={styles.posterScreen}>
          <div className={styles.posterBar} />
          <div className={styles.posterBody}>
            <span className={styles.posterPlay} />
          </div>
        </div>
        <div className={styles.posterCaption}>{item.note}</div>
      </div>
      <div className={styles.posterCopy}>
        <strong>{item.title}</strong>
        <span>{item.handle}</span>
      </div>
      <div
        className={styles.posterHighlight}
        style={{ opacity: emphasize ? 0.92 : 0.72 } as CSSProperties}
      />
    </div>
  );
}
