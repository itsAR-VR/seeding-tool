"use client";

import { useEffect } from "react";
import LeadForm from "./LeadForm";
import Shell from "./Shell";
import { trackEvent } from "./analytics";

const plans = [
  {
    name: "Starter",
    price: "From $999/month",
    badge: "Fastest path",
    summary: "For teams that need one clean lane instead of another spreadsheet and another inbox thread.",
    bestFor: "Best when you are running seeding regularly but the process still depends on memory and manual follow-up.",
    bullets: [
      "Brand-fit creator shortlist workflow",
      "Reply handling and address capture support",
      "Shipment and post-state tracking",
      "Social listening included",
    ],
    cta: "Start with Starter",
  },
  {
    name: "Growth",
    price: "Custom scope",
    summary: "For teams running enough volume that ops, creative, and paid all need the same operating view.",
    bestFor: "Best when multiple people touch the workflow and misses are starting to cost you time or creative output.",
    bullets: [
      "Higher-throughput creator lanes",
      "Deeper automation and exception handling",
      "Cross-team visibility and reporting",
      "Rollout support across multiple campaign motions",
    ],
    cta: "Talk through Growth",
  },
  {
    name: "Enterprise",
    price: "Custom scope",
    summary: "For groups with multiple brands, stricter controls, and heavier operational complexity.",
    bestFor: "Best when governance, handoffs, and operating consistency matter as much as campaign output.",
    bullets: [
      "Multi-brand workflow control",
      "Approval and operating governance",
      "Custom reporting and rollout planning",
      "Priority implementation support",
    ],
    cta: "Talk through Enterprise",
  },
];

const fitChecks = [
  {
    title: "Starter",
    body: "You want the workflow in one place before you scale volume.",
  },
  {
    title: "Growth",
    body: "You already feel the drag of handoffs, shipping follow-up, and reporting cleanup.",
  },
  {
    title: "Enterprise",
    body: "You need one operating model across multiple brands or internal teams.",
  },
];

const rolloutSteps = [
  {
    step: "Week 1",
    title: "Map the current lane",
    body: "We look at one recent campaign and find the exact places where the workflow slows down.",
  },
  {
    step: "Week 2",
    title: "Stand up the first operating lane",
    body: "Your shortlist, outreach, addresses, shipment states, and post states move into one system.",
  },
  {
    step: "After that",
    title: "Add volume only after the lane feels stable",
    body: "You do not scale chaos. You scale the version that already works.",
  },
];

const faqs = [
  {
    q: "Do we need to move everything on day one?",
    a: "No. The rollout starts with one lane so the team can see the shape of the workflow before adding more volume.",
  },
  {
    q: "What is included in every plan?",
    a: "Every plan includes the core seeding workflow, creator-state tracking, and social listening. The difference is rollout depth and operator load.",
  },
  {
    q: "How do we choose between Starter and Growth?",
    a: "Starter is for one clean operating lane. Growth is for teams already feeling the cost of volume, handoffs, and reporting drag.",
  },
  {
    q: "Can we upgrade once the workflow is working?",
    a: "Yes. The pricing path is meant to follow operating complexity, not force you into a bigger scope before you need it.",
  },
];

export default function PricingContent() {
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
      activeHref="/pricing"
      brandHref="/"
      fallbackId="#pricing-contact-form"
      footerLinks={[
        { href: "/", label: "Home" },
        { href: "/pricing", label: "Pricing" },
        { href: "#plans", label: "Plans" },
        { href: "#pricing-contact", label: "Talk to us" },
      ]}
      mainId="pricing-main"
      navItems={[
        { href: "/", label: "Home" },
        { href: "#plans", label: "Plans" },
        { href: "#fit", label: "Fit" },
        { href: "#pricing-contact", label: "Talk to us" },
      ]}
      primaryCtaLabel="Talk through my rollout"
      source="pricing_page"
    >
      <main id="pricing-main" className="lp-main pricing-main decision-main">
        <section className="decision-hero" aria-label="Pricing hero">
          <div className="decision-hero-grid">
            <div className="decision-copy" data-reveal>
              <p className="eyebrow">Pricing</p>
              <h1>Choose the rollout path that matches how much seeding you run today.</h1>
              <p>
                Starter is for one clean operating lane. Growth is for teams already feeling the drag of volume.
                Enterprise is for multi-brand or governed workflows.
              </p>
              <div className="hero-actions">
                <a className="btn btn-solid" href="#pricing-contact" onClick={() => trackEvent("pricing_primary_cta", "pricing_page")}>
                  Talk through my rollout
                </a>
                <a className="btn btn-ghost" href="#plans" onClick={() => trackEvent("pricing_compare_paths", "pricing_page")}>
                  Compare what changes
                </a>
              </div>
            </div>
            <div className="decision-summary" data-reveal>
              <p className="eyebrow">What changes between plans</p>
              <div className="decision-summary-row">
                <strong>Starter</strong>
                <span>One lane, one team, quick adoption.</span>
              </div>
              <div className="decision-summary-row">
                <strong>Growth</strong>
                <span>More volume, more handoffs, stronger automation.</span>
              </div>
              <div className="decision-summary-row">
                <strong>Enterprise</strong>
                <span>Governance, multi-brand structure, custom rollout support.</span>
              </div>
            </div>
          </div>
        </section>

        <section className="decision-grid" id="plans" aria-label="Plan comparison" data-reveal>
          {plans.map((plan) => (
            <article key={plan.name} className={`decision-card${plan.badge ? " decision-card-featured" : ""}`}>
              {plan.badge ? <span className="decision-badge">{plan.badge}</span> : null}
              <p className="eyebrow">{plan.name}</p>
              <h2>{plan.price}</h2>
              <p className="decision-summary-copy">{plan.summary}</p>
              <p className="decision-fit-copy">{plan.bestFor}</p>
              <ul>
                {plan.bullets.map((bullet) => (
                  <li key={bullet}>{bullet}</li>
                ))}
              </ul>
              <a className={`btn ${plan.badge ? "btn-solid" : "btn-ghost"}`} href="#pricing-contact">
                {plan.cta}
              </a>
            </article>
          ))}
        </section>

        <section className="fit-strip" id="fit" aria-label="Fit guidance" data-reveal>
          <div className="section-block">
            <p className="eyebrow">Which path fits?</p>
            <h2>Pick the plan based on operational load, not just budget.</h2>
          </div>
          <div className="fit-grid">
            {fitChecks.map((item) => (
              <article key={item.title} className="fit-card">
                <h3>{item.title}</h3>
                <p>{item.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="rollout-lane" aria-label="Rollout timeline" data-reveal>
          <div className="section-block">
            <p className="eyebrow">How rollout works</p>
            <h2>You do not need a giant migration week.</h2>
          </div>
          <div className="rollout-lane-grid">
            {rolloutSteps.map((step) => (
              <article key={step.step} className="rollout-card">
                <p className="rollout-step">{step.step}</p>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="implementation-proof" aria-label="Implementation proof" data-reveal>
          <article>
            <h3>Good for operators</h3>
            <p>The point is to reduce manual cleanup, not add another system your team has to babysit.</p>
          </article>
          <article>
            <h3>Good for leadership</h3>
            <p>You get clearer status, clearer misses, and cleaner reporting before volume grows again.</p>
          </article>
          <article>
            <h3>Good for rollout</h3>
            <p>Start with one lane. Let it settle. Then expand from something that already works.</p>
          </article>
        </section>

        <section className="pricing-faqs" aria-label="Pricing FAQ" data-reveal>
          <div className="section-block">
            <p className="eyebrow">FAQ</p>
            <h2>The questions that matter before you pick a path.</h2>
          </div>
          <div className="pricing-faq-grid">
            {faqs.map((item, index) => (
              <details key={item.q} open={index === 0}>
                <summary>{item.q}</summary>
                <p>{item.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="pricing-contact" id="pricing-contact" aria-label="Pricing lead capture" data-reveal>
          <div className="capture-copy">
            <p className="eyebrow">Talk to us</p>
            <h2>If you are choosing between paths, bring one recent campaign and we will map the right starting lane.</h2>
            <p>
              This is usually where teams figure out whether they need one clear operating lane or a heavier rollout.
            </p>
          </div>
          <LeadForm
            fields={[
              { label: "Name", name: "name", placeholder: "Jane", required: true },
              { label: "Work email", name: "email", placeholder: "jane@brand.com", required: true, type: "email" },
              { label: "Brand or website", name: "website", placeholder: "https://brand.com", type: "url" },
              { label: "Monthly creator campaigns", name: "monthlyCampaigns", placeholder: "4-8 campaigns" },
            ]}
            formId="pricing-contact-form"
            intro="Tell us what the current workload looks like."
            source="pricing"
            submitLabel="Talk through my rollout"
          />
        </section>
      </main>
    </Shell>
  );
}
