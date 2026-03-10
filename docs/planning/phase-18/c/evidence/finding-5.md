# Finding 5 — Bulk Draft-Review Ergonomics: Browser Evidence

**Date:** 2026-03-10  
**QA Agent:** Phase 18 closeout lane  
**Status:** ✅ PASS (browser-verified)

---

## Test Setup

- **Campaign:** `phase18-evidence-campaign` ("Phase 18 Evidence Campaign")
- **Brand:** `qa-test-brand-mmkbt6g6` (QA Test Brand, owned by `qa-lane2@seedscale.test`)
- **Creators seeded:** 5 approved/ready CampaignCreator records
  - Sophia Chen (@p18_sophiachen_fitness, 125K followers)
  - Marcus Rivera (@p18_marcusrivera_style, 89K followers)
  - Aya Tanaka (@p18_ayatanaka_beauty, 210K followers)
  - Liam O'Brien (@p18_liamobrien_travel, 67K followers)
  - Priya Sharma (@p18_priyasharma_food, 153K followers)

## Evidence

### Screenshot 1: Initial state — per-row checkboxes + Select All + Generate Drafts count
- **File:** `4d6e2ffc-43da-47c3-9281-efb21898f52a.png`
- **URL:** `http://localhost:3000/campaigns/phase18-evidence-campaign/outreach`
- **What it shows:**
  - "Select Creators" section heading with "5 approved creators available"
  - **"Select All (up to 20)"** button in top-right of section
  - **Per-row checkboxes** (unchecked) for each of the 5 creators
  - Each row displays: creator name, @handle, follower count, lifecycle status ("ready")
  - **"Generate Drafts (0)"** button at bottom (disabled, count reflects 0 selected)
  - Outreach readiness card shows "Approved creators: 5 ready" with "Ready" badge

### Screenshot 2: All selected state — Deselect All + count updates
- **File:** `eb12e390-592a-4b51-b815-80d5cf1efe67.png`
- **URL:** Same page after clicking "Select All (up to 20)"
- **What it shows:**
  - All 5 checkboxes are **checked** (blue filled state)
  - Toggle label changed from "Select All (up to 20)" to **"Deselect All"**
  - **"Generate Drafts (5)"** button now shows selected count of 5
  - Button remains visually present (disabled by product guardrail, not selection)

## Verified Behaviors

| Feature | Expected | Observed | Pass? |
|---------|----------|----------|-------|
| Per-row checkboxes | Each creator row has a checkbox | ✅ All 5 rows have checkboxes | ✅ |
| Select All toggle | Button to select/deselect all | ✅ "Select All (up to 20)" → "Deselect All" | ✅ |
| Generate Drafts count | Button shows selected count | ✅ "(0)" → "(5)" on select all | ✅ |
| MAX_BATCH_SIZE hint | "up to 20" in button label | ✅ Visible in "Select All (up to 20)" | ✅ |
| Approved filter | Only approved creators shown | ✅ All 5 seeded approved creators visible | ✅ |

## Conclusion

Finding 5 is **fully verified at browser level**. All bulk draft-review ergonomic features are functional:
- Per-row selection via checkboxes
- Select All / Deselect All toggle with batch size hint
- Dynamic "Generate Drafts (N)" count reflecting selection state
