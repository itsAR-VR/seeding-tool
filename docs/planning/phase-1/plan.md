# Phase 1: Influencer Database Pipeline — Collabstr Scrape + Competitor Discovery

## Original User Request (verbatim)

> the next thing i want you to do in parallel running and own doing its own thing with reporting at checkpoints until the entire database of influencers is scraped from collabstr for the seed scale side is, that we also need to add and have all of these influencers with niche, identifiers and more info within an internal database. then grab more influencers and fully scrape sites like, https://collabstr.com/influencers, using login email: ar@soramedia.co and password: Moahid99!. build a script for it using the elements the script is going to need to go ahead and click on each individual item/influencer. scrape the actual page itself, grabbing their instagram, grabbing their name, their location. it's going to have to open up instagram to see if their email is mentioned. if it's not, just taking the handle is fine. we need to have an elaborate list also taking a tiktok if it's present. we're likely going to enrich all of these later on. you're going to need to use your browser automation in order to see the elements on the page and see what we need to do in order to have a repeatable workflow. that'll go ahead and just scrape the entire thing, opening up the instagram link and taking the handle from it. or just looking at the link itself to extract the handle for tiktok and instagram is a better solution maybe. identifying a few competitor sites where we can do something similar, signing up for them and checking it out. i don't think you'll be able to use your email to do that so maybe just identifying platforms for now and then i'll go ahead and do the account creation on my end and then you can just log in and do the same process. that's ideal.

## Objective

Build an autonomous, repeatable influencer scraping pipeline that:
1. Scrapes the entire Collabstr influencer directory into the Seed Scale internal database
2. Extracts: name, location, niche/category, Instagram handle, TikTok handle, email (if publicly visible on IG)
3. Stores all data in the existing Creator model (Prisma/Postgres)
4. Identifies competitor platforms for future scraping
5. Runs autonomously with checkpoint reporting until complete

## Architecture

```
Browser Automation (Playwright/OpenClaw browser)
  → Login to Collabstr
  → Paginate through /influencers directory
  → For each influencer card: click → extract profile data
  → Parse social links to extract IG/TikTok handles (from URLs, not by visiting each profile)
  → Optional: visit IG profile page to check bio for email
  → Batch insert into Seed Scale DB via API or direct Prisma
  → Checkpoint report every 50 creators
```

## Subphases

### 1.1 — Reconnaissance: Collabstr Page Structure
- **Action:** Open https://collabstr.com/influencers in browser, snapshot the page
- **Goal:** Identify DOM structure: influencer cards, pagination, profile links, data fields
- **Output:** Element selectors documented for repeatable scraping
- **Duration:** ~10 min

### 1.2 — Login + Session Setup
- **Action:** Browser automation to login with provided credentials
- **Goal:** Authenticated session with access to full influencer data
- **Credentials:** Stored in `.env.local` (not in plan files or memory)
- **Duration:** ~5 min

### 1.3 — Build Scraping Script
- **Action:** Create `scripts/scrape-collabstr.ts` using Playwright
- **Fields per influencer:**
  - `name` — display name
  - `location` — city/country if shown
  - `niche/category` — content category (e.g., "fitness", "beauty")
  - `instagramHandle` — extracted from IG link URL (no need to visit IG page)
  - `tiktokHandle` — extracted from TikTok link URL
  - `email` — if publicly listed on profile page
  - `followerCount` — if shown
  - `profileUrl` — Collabstr profile URL for deduplication
  - `imageUrl` — profile image
- **Pagination strategy:** scroll/click through all pages, extract card links, visit each
- **Rate limiting:** 2-3 second delay between page loads to avoid rate limiting
- **Error handling:** retry failed pages, skip and log errors, resume from last checkpoint
- **Output:** JSON lines file + direct DB inserts
- **Duration:** ~30 min to build

### 1.4 — Execute Scrape (Autonomous Background)
- **Action:** Run the scraper in a background sub-agent
- **Checkpoint:** Report to AR every 50 creators scraped
- **Resume:** Track last scraped page/offset for crash recovery
- **Target:** All influencers in Collabstr directory
- **Duration:** Variable (depends on directory size, estimated 1-4 hours)

### 1.5 — IG Email Enrichment Pass
- **Action:** For creators with IG handles but no email, visit IG bio pages
- **Strategy:** Extract email from IG bio text if present (regex: email patterns)
- **Alternative:** Use existing Apify enrichment service (already built)
- **Rate limiting:** Slow IG checks (5-10s between) to avoid blocks
- **Duration:** Runs after main scrape, variable

### 1.6 — Competitor Platform Identification
- **Action:** Research and document competitor influencer marketplaces
- **Platforms to evaluate:**
  - **Heepsy** — heepsy.com (influencer search engine, free tier)
  - **Influence.co** — influence.co (free directory)
  - **Hypefy** — hypefy.ai (search + analytics)
  - **Inzpire.me** — inzpire.me (Nordic marketplace)
  - **JoinBrands** — joinbrands.com (UGC marketplace)
  - **Afluencer** — afluencer.com (free directory with categories)
  - **Aspire** — aspire.io (enterprise but has public discovery)
  - **The Creator Marketplace** — thecreatorsmarketplace.com
- **Output:** For each: URL, signup requirements, directory structure, estimated influencer count, whether AR needs to create accounts
- **AR action needed:** Account creation on platforms that need it
- **Duration:** ~15 min research

## Data Model Mapping

Collabstr fields → Seed Scale Creator model:
| Collabstr | Creator (Prisma) | Notes |
|-----------|------------------|-------|
| Display name | `name` | |
| Location | `bio` (append) | No dedicated location field |
| Category | `bioCategory` | e.g., "fitness", "beauty" |
| IG link | `instagramHandle` | Parse from URL |
| TikTok link | `profiles[]` (platform: "tiktok") | CreatorProfile record |
| Email | `email` | If found |
| Followers | `followerCount` | If shown |
| Profile image | `imageUrl` | |
| Collabstr URL | `notes` | For dedup tracking |

- `discoverySource`: "collabstr"
- `brandId`: Sleepkalm brand ID (`9d4f824b-639a-43ce-93f9-cbf233912f91`)

## Execution Model

- **Runtime:** Background sub-agent with browser automation
- **Autonomy:** Fully autonomous, reports at checkpoints
- **Failure handling:** Resume from last successful page
- **Deduplication:** Skip if `instagramHandle` already exists for this brand

## Skills Available
- `browser-automation` — Playwright browser control
- `coding-agent` — for script building
- No phase-plan skill installed (manual plan)

## Skills Missing
- No dedicated web scraping skill — using browser-automation as fallback
- No Collabstr API (none exists publicly) — browser scraping required

## Success Criteria
1. ≥90% of Collabstr directory scraped and stored
2. Each creator has at minimum: name + IG handle + niche
3. Competitor platforms documented with next steps
4. Zero manual intervention required during scrape execution
