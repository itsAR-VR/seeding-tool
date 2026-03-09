# Collabstr scraper runbook

## Rules
- Deterministic Playwright/browser scraping only
- No LLM inside the scrape loop
- Output schema must include first-class fields: `name`, `instagram`, `tiktok`, `profileDump`

## Bounded validation run
```bash
npm run collabstr:scrape -- --start-page 1 --max-pages 1 --max-profiles 2 --output /tmp/collabstr-sample.jsonl
```

## Import dry run
```bash
npm run collabstr:import -- --input /tmp/collabstr-sample.jsonl --dry-run
```

## Output shape
Each JSONL record starts with:
1. `name`
2. `instagram`
3. `tiktok`
4. `profileDump`

It also keeps direct scraped fields such as `collabstrSlug`, `collabstrUrl`, `niche`, `location`, `bio`, `imageUrl`, `instagramUrl`, `tiktokUrl`, `website`, `followerCount`, `price`, `rating`, `reviewCount`, and `scrapedAt`.

## Notes
- `profileDump` is the raw visible page text dump from the Collabstr profile page.
- Import stores the Collabstr URL and profile dump into creator notes for later enrichment/parsing.
- Checkpoints are scoped to the output file path, so bounded sample runs do not inherit resume state from the main scrape.
