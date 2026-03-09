# Phase Landing-Redesign B — Marketing Sections Rebuild

## Focus

Verify and complete all marketing page sections below the hero. The `HomeContent.tsx` on
`feature/hero-media-dock` contains full section content. This subphase ensures all sections
render correctly, match the AGENTS.md design direction, and are visually verified.

**Status (2026-03-09):** Section content is BUILT on `feature/hero-media-dock`. Needs visual
verification after merge (subphase a) and gap-fill for any missing sections.

---

## Inputs

- Merged `apps/web/app/(marketing)/components/HomeContent.tsx` (from subphase a)
- `apps/web/app/(marketing)/components/LeadForm.tsx`
- `apps/web/app/globals.css`
- AGENTS.md design principles (light mode, warm neutral, operator briefing aesthetic)

---

## Section Inventory (from HomeContent.tsx on feature branch)

| Section | Status | Content |
|---------|--------|---------|
| Logo rail | Built | Wild Bird, Dr. Harvey's, G Fuel, iHerb, Salty Face, Black Girl Vitamins, Super Gut, So Sweet Bee Organics, Purdy & Figg |
| Friction cards | Built | "Shortlists go stale fast", "Addresses live in reply threads", "Posted content gets found late" |
| Story steps | Built | Find → Reach → Collect (3 labeled steps with title + body) |
| AI capabilities | Built | Fit scoring, Reply triage, Exception flags, Post detection (4 capability cards) |
| Evidence | Built | 2 quote cards ("Growth lead, consumer beauty" + "Ops director, wellness CPG") |
| Lead form | Built | LeadForm component (email capture) |
| Shell/structure | Built | Shell component wraps all sections |

**Missing from current build (gaps to fill in this subphase):**
- [ ] Guarantee section — `phase-landing-redesign/plan.md` Phase 3 specifies 3 guarantee cards
  (escrow / contract / verified traffic). Not found in HomeContent.tsx scan.
- [ ] Explicit footer — need to verify Footer component exists and is rendered
- [ ] CTA section — standalone CTA block before footer not confirmed

### Story step content (exact)

```
Find:
  title: "Build a shortlist you would actually ship to."
  body: "Score creators against product fit, audience fit, and campaign context before anyone starts outreach."

Reach:
  title: "Handle replies, addresses, and shipping without losing the thread."
  body: "Keep the back-and-forth in one system so the box goes out without the usual manual cleanup."

Collect:
  title: "Track posts, misses, and follow-ups from the same lane."
  body: "When someone posts, you see it. When they do not, the system flags it before it becomes a mystery."
```

---

## Skills Available for This Subphase

- `browser-automation` — Playwright to screenshot all sections at 1440px and 390px
- `coding-agent` — add missing sections (guarantee, CTA) if confirmed absent
- `canvas-design` — before/after visual comparison if major sections added

---

## Work

### Step 1 — Visual verification pass (all sections)

After subphase a merge, run dev server and take scrolling screenshots:

```bash
# Full-page screenshot at 1440px
# Capture each section (600px scroll increments)
```

Target screenshots: hero → logo rail → friction → story → AI capabilities → evidence → CTA → footer.

Compare against AGENTS.md anti-references — flag anything that looks like:
- Generic flowchart hero (NOT this — carousel dock replaces it)
- Too many pills and badges
- Intrusive sticky CTAs
- Motion as decoration

### Step 2 — Gap fill: guarantee section

Check if guarantee section exists in `HomeContent.tsx`:

```bash
grep -n "escrow\|guarantee\|contract\|verified traffic" apps/web/app/\(marketing\)/components/HomeContent.tsx
```

If absent: add 3-card guarantee row using the same light glass card style as friction cards:
- Card 1: Escrow — payment held until campaign milestones
- Card 2: Contracts — signed agreements tracked in platform
- Card 3: Verified traffic — engagement validated before payout

### Step 3 — Gap fill: footer

```bash
ls apps/web/app/\(marketing\)/
grep -rn "Footer\|footer" apps/web/app/\(marketing\)/ --include="*.tsx"
```

Verify Footer renders correctly. If missing or broken, scaffold minimal footer:
logo + nav links + legal line.

### Step 4 — Mobile sections check (390px)

Per AGENTS.md: "Mobile should feel calmer than desktop, not more crowded."

Check each section at 390px:
- Logo rail: CSS marquee, no overflow
- Friction cards: stack vertically with breathing room
- Story steps: stacked not side-by-side
- AI capability grid: 1-column on mobile
- Evidence quotes: full width, no truncation

### Step 5 — Lead form functionality

```bash
# Submit test email, verify form state (loading → success/error)
```

Confirm form renders, submits, and shows success state. Error state (network fail) gracefully degraded.

---

## Output

- All marketing sections visually verified at desktop + mobile
- Guarantee / footer gaps filled if absent
- Screenshot evidence for each section
- No AGENTS.md anti-references present

---

## Handoff

Subphase c takes the verified sections and runs the design token + CSS token pass to ensure
all spacing, color, and typography values are consistent with AGENTS.md. Targets Tailwind config
and globals.css.
