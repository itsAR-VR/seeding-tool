"use client";

import Image from "next/image";
import { useEffect } from "react";
import CtaLink from "./CtaLink";
import HeroScene from "./HeroScene";
import LeadForm from "./LeadForm";
import Shell from "./Shell";
import { trackEvent } from "./analytics";

const logoRail = [
  { name: "Wild Bird", src: "/logos/wild-bird.avif" },
  { name: "Dr. Harvey's", src: "/logos/dr-harveys.png" },
  { name: "G Fuel", src: "/logos/gfuel.avif" },
  { name: "iHerb", src: "/logos/iherb.avif" },
  { name: "Salty Face", src: "/logos/salty-face.avif" },
  { name: "Black Girl Vitamins", src: "/logos/black-girl-vitamins.png" },
  { name: "Super Gut", src: "/logos/super-gut.avif" },
  { name: "So Sweet Bee Organics", src: "/logos/sweet-bee.png" },
  { name: "Purdy & Figg", src: "/logos/purdy-figg.svg" },
];

const frictionCards = [
  {
    title: "Shortlists go stale fast",
    body: "A spreadsheet full of names is not a workflow. The second the replies start, context disappears.",
  },
  {
    title: "Addresses live in reply threads",
    body: "The most boring part of the process is also where teams lose the most time and miss the most handoffs.",
  },
  {
    title: "Posted content gets found late",
    body: "When the proof lives across screenshots and tabs, reporting becomes cleanup instead of insight.",
  },
];

const storySteps = [
  {
    label: "Find",
    title: "Build a shortlist you would actually ship to.",
    body: "Score creators against product fit, audience fit, and campaign context before anyone starts outreach.",
  },
  {
    label: "Reach",
    title: "Handle replies, addresses, and shipping without losing the thread.",
    body: "Keep the back-and-forth in one system so the box goes out without the usual manual cleanup.",
  },
  {
    label: "Collect",
    title: "Track posts, misses, and follow-ups from the same lane.",
    body: "When someone posts, you see it. When they do not, the system flags it before it becomes a mystery.",
  },
];

const aiCapabilities = [
  {
    title: "Fit scoring",
    body: "Ranks creators before your team spends time on the wrong names.",
  },
  {
    title: "Reply triage",
    body: "Drafts and classifies responses so address collection does not stall in email.",
  },
  {
    title: "Exception flags",
    body: "Surfaces missing addresses, stalled shipments, and ghosted creators while there is still time to act.",
  },
  {
    title: "Post detection",
    body: "Groups new mentions and follow-up cues so nothing gets buried in screenshots.",
  },
];

const evidenceCards = [
  {
    quote:
      "We stopped treating seeding like a side task. The team finally had one place to run the work and see what happened.",
    author: "Growth lead, consumer beauty",
  },
  {
    quote:
      "The biggest shift was operational. We were no longer bouncing between inboxes, notes, and shipping docs just to move one creator forward.",
    author: "Head of marketing, DTC nutrition",
  },
  {
    quote:
      "Once posts, misses, and follow-ups lived in one view, reporting stopped being a weekly cleanup project.",
    author: "Paid social manager, ecommerce apparel",
  },
];

export default function HomeContent() {
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add("has-reveal");

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const reveals = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]"));

    if (reduceMotion) {
      reveals.forEach((node) => node.classList.add("is-visible"));
      return () => { root.classList.remove("has-reveal"); };
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            (entry.target as HTMLElement).classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: "0px 0px -60px 0px" },
    );

    reveals.forEach((node) => observer.observe(node));

    return () => {
      observer.disconnect();
      root.classList.remove("has-reveal");
    };
  }, []);

  return (
    <Shell
      brandHref="#top"
      fallbackId="#home-lead-form"
      footerLinks={[
        { href: "#workflow", label: "Workflow" },
        { href: "/pricing", label: "Pricing" },
        { href: "#proof", label: "Proof" },
        { href: "#contact", label: "Talk to us" },
      ]}
      mainId="main-content"
      navItems={[
        { href: "#workflow", label: "Workflow" },
        { href: "#intelligence", label: "AI layer" },
        { href: "#proof", label: "Proof" },
        { href: "/pricing", label: "Pricing" },
      ]}
      primaryCtaLabel="Book a live walkthrough"
      source="landing_page"
    >
      <main id="main-content" className="lp-main home-main">
        <section className="hero-shell" aria-label="Hero">
          <div className="hero-gradient-base" aria-hidden="true" />
          <div className="hero-gradient hero-gradient-1" aria-hidden="true" />
          <div className="hero-gradient hero-gradient-2" aria-hidden="true" />
          <div className="hero-gradient-radial" aria-hidden="true" />

          <div className="hero-grid">
            <div className="hero-intro hero-frost" data-reveal>
              <p className="eyebrow">Seeding OS for operator-led growth teams</p>
              <h1>Run seeding like a channel, not a side project.</h1>
              <p className="hero-copy">
                Find brand-fit creators, run the outreach, collect the address, ship the box, and see what actually
                posted from one operating system.
              </p>
              <div className="hero-actions">
                <CtaLink
                  className="btn btn-solid"
                  event="hero_primary_cta"
                  fallbackId="#home-lead-form"
                  label="Book a live walkthrough"
                  source="landing_page"
                />
                <a className="hero-link" href="#workflow" onClick={() => trackEvent("hero_view_workflow", "landing_page")}>
                  See the workflow
                </a>
              </div>
              <p className="hero-note">
                AI handles the ranking, reply drafting, and follow-up flags. Your team still makes the calls.
              </p>
            </div>

            <div className="hero-stage-panel" data-reveal>
              <HeroScene />
            </div>
          </div>
        </section>

        <section className="proof-rail" aria-label="Proof rail" data-reveal>
          <div className="proof-rail-copy">
            <p className="eyebrow">Trusted by teams at</p>
            <h2>Operators at these brands already know what spreadsheet seeding costs.</h2>
            <p className="proof-rail-note">
              That is why the pitch lands fast: fewer handoffs, fewer screenshots, and a cleaner line from shortlist
              to post.
            </p>
          </div>
          <div className="brand-band" aria-hidden="true">
            <div className="brand-band-track">
              {[...logoRail, ...logoRail].map((logo, index) => (
                <Image
                  key={`${logo.name}-${index}`}
                  alt={logo.name}
                  className="brand-mark"
                  height={28}
                  sizes="124px"
                  src={logo.src}
                  width={124}
                />
              ))}
            </div>
          </div>
        </section>

        <section className="pain-strip" aria-label="Operational pain" data-reveal>
          <div className="section-block">
            <p className="eyebrow">What breaks first</p>
            <h2>The mess shows up right after the list looks good.</h2>
          </div>
          <div className="pain-grid">
            {frictionCards.map((card) => (
              <article key={card.title} className="pain-card">
                <h3>{card.title}</h3>
                <p>{card.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="workflow-story" id="workflow" aria-label="Workflow" data-reveal>
          <div className="section-block">
            <p className="eyebrow">Workflow</p>
            <h2>Find the right people. Move them forward. Catch what slips.</h2>
            <p>
              The product is not one big magic button. It is a tighter operating lane for the work your team already
              does every week.
            </p>
          </div>
          <div className="story-rail">
            <div className="story-line" aria-hidden="true">
              <div className="story-line-fill" />
            </div>
            {storySteps.map((step, index) => (
              <article key={step.label} className="story-card" data-step={index + 1}>
                <div className="story-node" aria-hidden="true" />
                <p className="story-index">0{index + 1}</p>
                <p className="story-label">{step.label}</p>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="intelligence-section" id="intelligence" aria-label="AI capabilities" data-reveal>
          <div className="section-block">
            <p className="eyebrow">AI layer</p>
            <h2>What AI is actually doing here.</h2>
          </div>
          <div className="intelligence-grid">
            {aiCapabilities.map((item) => (
              <article key={item.title} className="intelligence-card">
                <h3>{item.title}</h3>
                <p>{item.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="evidence-wall" id="proof" aria-label="Evidence" data-reveal>
          <div className="section-block">
            <p className="eyebrow">Proof</p>
            <h2>Teams switch when the operational drag becomes impossible to ignore.</h2>
          </div>
          <div className="evidence-grid">
            {evidenceCards.map((item) => (
              <article key={item.author} className="evidence-card">
                <blockquote>{item.quote}</blockquote>
                <p>{item.author}</p>
              </article>
            ))}
            <article className="evidence-aside">
              <p className="eyebrow">Why it lands</p>
              <h3>Less manual cleanup. Fewer missed follow-ups. Faster reporting.</h3>
              <p>
                The win is not just finding more creators. It is getting the day-to-day work out of spreadsheets,
                screenshots, and inbox archaeology.
              </p>
            </article>
          </div>
        </section>

        <section className="price-bridge" aria-label="Pricing bridge" data-reveal>
          <div>
            <p className="eyebrow">Ready for the next question?</p>
            <h2>If you are already shipping product every month, the real question is rollout pace.</h2>
          </div>
          <a className="btn btn-ghost" href="/pricing" onClick={() => trackEvent("bridge_to_pricing", "landing_page")}>
            Compare rollout paths
          </a>
        </section>

        <section className="final-capture" id="contact" aria-label="Lead capture" data-reveal>
          <div className="capture-copy">
            <p className="eyebrow">Talk it through</p>
            <h2>Bring one recent campaign and we will show you how the workflow would run here.</h2>
            <p>
              If you already know the process is messy, this is the fastest way to see where a tighter operating lane
              would save time.
            </p>
          </div>
          <LeadForm
            fields={[
              { label: "Name", name: "name", placeholder: "Jane", required: true },
              { label: "Work email", name: "email", placeholder: "jane@brand.com", required: true, type: "email" },
              { label: "Brand or website", name: "website", placeholder: "https://brand.com", type: "url" },
              { label: "Team size", name: "teamSize", placeholder: "10-25 people" },
            ]}
            formId="home-lead-form"
            intro="Tell us a little about the current setup."
            source="homepage"
            submitLabel="Show me the workflow"
          />
        </section>
      </main>
    </Shell>
  );
}
