# Competitor Influencer Platforms — Scraping Targets

## Tier 1 — Public Directories (Scrapeable Now or After AR Account Creation)

### 1. Collabstr (IN PROGRESS)
- **URL:** https://collabstr.com/influencers
- **Size:** 550,000+ creators
- **Login needed:** ❌ for scraping (data in public JSON-LD)
- **Signup:** Already have account (ar@soramedia.co)
- **Status:** 🔄 Scraping in progress
- **Data quality:** Excellent — name, niche, location, IG/TikTok handles, pricing, bio

### 2. Afluencer
- **URL:** https://afluencer.com/influencers
- **Size:** 29,000+ influencers
- **Login needed:** ✅ Free account required to browse directory
- **Signup:** Free for brands — AR needs to create account
- **Structure:** Directory with search filters (niche, followers, platform)
- **Data available:** IG/TikTok handles, niche, location, pricing, portfolio
- **AR action:** Create brand account at https://afluencer.com/ → then share login credentials

### 3. Influence.co
- **URL:** https://influence.co/influencer_searches
- **Size:** 200,000+ profiles (claims "nearly 200k")
- **Login needed:** ✅ Free account required
- **Signup:** Free signup for businesses
- **Structure:** Profile-based directory with categories
- **Data available:** Social handles, portfolio, rates, demographics
- **AR action:** Create account at https://influence.co → share login credentials

### 4. Heepsy
- **URL:** https://www.heepsy.com/influencer-search
- **Size:** Millions (claims 11M+ influencers)
- **Login needed:** ✅ Free tier available but limited results
- **Signup:** Free tier shows limited data; paid plans start at $49/mo
- **Structure:** Search engine with filters (category, location, engagement)
- **Data available:** Social handles, engagement rates, audience demographics
- **Note:** Free tier likely too limited for bulk scraping — may need paid account
- **AR action:** Create free account, evaluate if paid tier is needed

## Tier 2 — Worth Evaluating

### 5. JoinBrands
- **URL:** https://joinbrands.com
- **Size:** Unknown (UGC marketplace)
- **Login needed:** ✅ Account required
- **Signup:** Free for brands
- **Focus:** UGC creators specifically (good for Seed Scale use case)
- **AR action:** Create account, evaluate directory structure

### 6. Hypefy
- **URL:** https://hypefy.ai
- **Size:** Unknown
- **Login needed:** ✅ Account required
- **Focus:** Analytics + discovery
- **AR action:** Create account, evaluate

### 7. Inzpire.me
- **URL:** https://inzpire.me
- **Size:** Unknown (Nordic focus but expanding)
- **Login needed:** ✅ Account required
- **AR action:** Create account, evaluate

### 8. The Creator Marketplace (thecreatorsmarketplace.com)
- **URL:** https://thecreatorsmarketplace.com
- **Size:** Unknown
- **Login needed:** ✅ Account required
- **AR action:** Create account, evaluate

## Next Steps for AR

1. **Create free brand accounts** on: Afluencer, Influence.co, Heepsy, JoinBrands
2. **Share login credentials** (email + password) via DM so I can login and scrape
3. **Evaluate Heepsy** — might need paid tier for bulk access; free tier may be too limited
4. **Priority order:** Afluencer (29k creators, free) → Influence.co (200k, free) → JoinBrands → Heepsy

## Scraping Strategy Per Platform

Each platform follows the same pattern:
1. Login via browser automation
2. Recon: snapshot page, identify DOM structure + data sources
3. Build extraction script (JS evaluate for structured data or DOM scraping)
4. Paginate through directory
5. Extract: name, niche, location, social handles, followers
6. Output: JSONL → import into Seed Scale Creator table
7. Dedup against existing data using `instagramHandle + brandId` unique key
