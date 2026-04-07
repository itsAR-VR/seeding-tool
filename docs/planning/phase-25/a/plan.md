# Phase 25a — Category Expansion + Enhanced Classification

## Focus

Expand creator classification from 5 keyword-only categories to 15 categories with LLM fallback for ambiguous bios. Add multi-label support.

## Inputs
- `apps/web/lib/creator-search/classification.ts` — current 5-category keyword matcher
- `apps/web/lib/creator-search/scoring/features.ts` — uses classification for topical match
- Deep sweep: "classification is keyword-only, 5 categories via `.includes()`"

## Skills Available for This Subphase
- `backend-coding-agent` — classification logic
- `tdd-guide` — test coverage for new categories
- `code-review` — post-implementation

## Work

### 1. Expand Category Taxonomy
Add 10 new categories: Tech, Gaming, Travel, Parenting, Pets, Sports, Education, Entertainment, Finance, Automotive.

### 2. Multi-Label Support
Creator can belong to multiple categories (e.g., "Fitness" + "Food & Drink"). Return array of `{ category, confidence }` instead of single category.

### 3. LLM Fallback Classification
When keyword matching returns confidence < 0.3, call OpenAI (using `AI_MODEL` from Phase 22c) to classify the bio. Cache LLM classification results.

### 4. Improve Multilingual Detection
Leverage existing language detection heuristics. Add keyword lists for common languages (Spanish, French, Portuguese).

### 5. Tests
- Test: each new category has keyword matches
- Test: multi-label returns multiple categories
- Test: LLM fallback triggers on low-confidence keyword match
- Test: multilingual bios classify correctly

## Output
- 15 categories with multi-label support
- LLM fallback for ambiguous bios
- Improved multilingual classification

## Handoff
Subphase b (Calibration Wiring) uses classification confidence as an input signal.
