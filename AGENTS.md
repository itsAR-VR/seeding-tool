# AGENTS.md — Seed Scale

Seed Scale influencer gifting platform. Keep this root file concise and operational.

## Quick Reference
- **Package manager:** npm
- **App dev:** `npm run web:dev`
- **App build:** `npm run web:build`
- **Marketing audit:** `npm run audit:marketing`
- **Platform audit:** `npm run audit:platform`
- **Competitor audit:** `npm run audit:competitors`
- **Collabstr scrape:** `npm run collabstr:scrape`
- **Collabstr import:** `npm run collabstr:import`

## Routing
- **Codex owns:** local app changes, tests, scripts, migrations, and direct repo debugging.
- **Podhi sidecar owns:** product research, browser workflows, visual QA, competitor analysis, strategy synthesis, and multi-agent execution.
- **Primary lane:** `openclaw-seed` using `seed-sidecar`.
- **Async default:** prefer `podhi_seed_bg` for parallelizable research/review/audit work; ask for `summary`, `verification`, `blockers`, `nextAction`.
- **Ops-only issues:** use `openclaw-ops` / `podhi_ops_bg` for gateway, tailscale, cron, Vercel-adjacent infra, and environment-health triage.

## Hard Overrides
- Do **not** deploy to Vercel as part of the normal dev/test loop.
- Run visual verification against `localhost:3000` / local app flow when applicable.
- Keep the product feel calm, operator-grade, and relevance-first.

## Detailed Context
- [Design context](docs/agent-context/design.md)
- [Workflow](docs/agent-context/workflow.md)
- [Shared git/file safety contract](../orchestration/STEINBERGER_GIT_SAFETY.md)

<!-- graphify:start -->
# Graphify — Knowledge Graph

This project has a persistent knowledge graph at `graphify-out/` (2,108 nodes, 3,415 edges, 88 communities). It maps code, planning docs, audit pages, and competitor research into one queryable structure.

## Always Do

- **Before answering architecture questions**, read `graphify-out/GRAPH_REPORT.md` for god nodes, communities, and surprising connections. Navigate by structure, not by grepping every file.
- **Check for staleness flag**: if `graphify-out/.needs_update` exists, doc files changed since the last semantic extraction. Run `/graphify . --update` to refresh before relying on the graph.
- **Use the graph for cross-domain questions**: "What planning docs relate to the scoring module?" or "How does Phase 20 connect to Phase 8?" — these are graph queries, not grep queries.

## Query Commands

| Command | Purpose |
|---------|---------|
| `/graphify query "question"` | BFS traversal — broad context |
| `/graphify query "question" --dfs` | DFS traversal — trace a specific path |
| `/graphify path "A" "B"` | Shortest path between two concepts |
| `/graphify explain "concept"` | Everything connected to one node |

## When to Update

| Trigger | Action | Cost |
|---------|--------|------|
| Code files changed | Automatic (git hook runs AST rebuild) | Free |
| Doc/planning files changed | Run `/graphify . --update` | LLM tokens (semantic extraction) |
| New phase plan added | Run `/graphify . --update` | LLM tokens |
| Full rebuild needed | Run `/graphify .` | Full LLM cost |

## Key Outputs

- `graphify-out/graph.html` — interactive visualization (open in browser)
- `graphify-out/GRAPH_REPORT.md` — god nodes, communities, surprising connections
- `graphify-out/graph.json` — raw queryable graph (386x token reduction vs raw files)

<!-- graphify:end -->

<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **seeding-tool** (7003 symbols, 11994 relationships, 300 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> If any GitNexus tool warns the index is stale, run `npx gitnexus analyze` in terminal first.

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `gitnexus_impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `gitnexus_detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `gitnexus_query({query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `gitnexus_context({name: "symbolName"})`.

## When Debugging

1. `gitnexus_query({query: "<error or symptom>"})` — find execution flows related to the issue
2. `gitnexus_context({name: "<suspect function>"})` — see all callers, callees, and process participation
3. `READ gitnexus://repo/seeding-tool/process/{processName}` — trace the full execution flow step by step
4. For regressions: `gitnexus_detect_changes({scope: "compare", base_ref: "main"})` — see what your branch changed

## When Refactoring

- **Renaming**: MUST use `gitnexus_rename({symbol_name: "old", new_name: "new", dry_run: true})` first. Review the preview — graph edits are safe, text_search edits need manual review. Then run with `dry_run: false`.
- **Extracting/Splitting**: MUST run `gitnexus_context({name: "target"})` to see all incoming/outgoing refs, then `gitnexus_impact({target: "target", direction: "upstream"})` to find all external callers before moving code.
- After any refactor: run `gitnexus_detect_changes({scope: "all"})` to verify only expected files changed.

## Never Do

- NEVER edit a function, class, or method without first running `gitnexus_impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `gitnexus_rename` which understands the call graph.
- NEVER commit changes without running `gitnexus_detect_changes()` to check affected scope.

## Tools Quick Reference

| Tool | When to use | Command |
|------|-------------|---------|
| `query` | Find code by concept | `gitnexus_query({query: "auth validation"})` |
| `context` | 360-degree view of one symbol | `gitnexus_context({name: "validateUser"})` |
| `impact` | Blast radius before editing | `gitnexus_impact({target: "X", direction: "upstream"})` |
| `detect_changes` | Pre-commit scope check | `gitnexus_detect_changes({scope: "staged"})` |
| `rename` | Safe multi-file rename | `gitnexus_rename({symbol_name: "old", new_name: "new", dry_run: true})` |
| `cypher` | Custom graph queries | `gitnexus_cypher({query: "MATCH ..."})` |

## Impact Risk Levels

| Depth | Meaning | Action |
|-------|---------|--------|
| d=1 | WILL BREAK — direct callers/importers | MUST update these |
| d=2 | LIKELY AFFECTED — indirect deps | Should test |
| d=3 | MAY NEED TESTING — transitive | Test if critical path |

## Resources

| Resource | Use for |
|----------|---------|
| `gitnexus://repo/seeding-tool/context` | Codebase overview, check index freshness |
| `gitnexus://repo/seeding-tool/clusters` | All functional areas |
| `gitnexus://repo/seeding-tool/processes` | All execution flows |
| `gitnexus://repo/seeding-tool/process/{name}` | Step-by-step execution trace |

## Self-Check Before Finishing

Before completing any code modification task, verify:
1. `gitnexus_impact` was run for all modified symbols
2. No HIGH/CRITICAL risk warnings were ignored
3. `gitnexus_detect_changes()` confirms changes match expected scope
4. All d=1 (WILL BREAK) dependents were updated

## Keeping the Index Fresh

After committing code changes, the GitNexus index becomes stale. Re-run analyze to update it:

```bash
npx gitnexus analyze
```

If the index previously included embeddings, preserve them by adding `--embeddings`:

```bash
npx gitnexus analyze --embeddings
```

To check whether embeddings exist, inspect `.gitnexus/meta.json` — the `stats.embeddings` field shows the count (0 means no embeddings). **Running analyze without `--embeddings` will delete any previously generated embeddings.**

> Claude Code users: A PostToolUse hook handles this automatically after `git commit` and `git merge`.

## CLI

| Task | Read this skill file |
|------|---------------------|
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus/gitnexus-exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.claude/skills/gitnexus/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.claude/skills/gitnexus/gitnexus-debugging/SKILL.md` |
| Rename / extract / split / refactor | `.claude/skills/gitnexus/gitnexus-refactoring/SKILL.md` |
| Tools, resources, schema reference | `.claude/skills/gitnexus/gitnexus-guide/SKILL.md` |
| Index, status, clean, wiki CLI commands | `.claude/skills/gitnexus/gitnexus-cli/SKILL.md` |

<!-- gitnexus:end -->

## graphify

This project has a graphify knowledge graph at graphify-out/.

Rules:
- Before answering architecture or codebase questions, read graphify-out/GRAPH_REPORT.md for god nodes and community structure
- If graphify-out/wiki/index.md exists, navigate it instead of reading raw files
- After modifying code files in this session, run `python3 -c "from graphify.watch import _rebuild_code; from pathlib import Path; _rebuild_code(Path('.'))"` to keep the graph current
