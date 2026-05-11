# Changelog

## v1.0.0 → v2.0.0 Overview

| Dimension | v1.0.0 | v2.0.0 |
|-----------|--------|--------|
| Steps | 9 | 5 |
| Quality assurance | GAN adversarial review (3 places) | Generate-Evaluate Loop with structured scoring |
| Term system | Topic-based multi-file glossary (~860 entries) | Single `terms.md` (17 entries, LLM corrections only) |
| Default style | Literal (直译) | Free (意译) |
| User interaction | 7 confirmations mid-workflow | 2 (start exceptions + end summary) |
| Language | All Chinese | English |
| Evaluation | Unquantified, LLM self-judges | 5 dimensions (AC/FL/TM/FM/ST) with weights |
| Timeout control | None | timer.js global timeout |

**Step mapping:**

| v1.0.0 | v2.0.0 | Change |
|--------|--------|--------|
| Step 1 Get article | Step 1 Retrieve Article | Added 60-char title limit |
| Step 2 Topic analysis + Step 3 GAN review | Step 2 Load Corrections | Removed topic matching and review loop |
| Step 4 Ask translation style | Removed | Default Free, no prompt |
| Step 5 Glossary load + user confirm | Step 5 Terms Maintenance | Mid-workflow user confirm → end-of-workflow subagent auto-maintain |
| Step 6 Special phrases + Step 7 GAN review | Step 3 Special Phrases | Merged, removed GAN review |
| Step 8 Translate | Step 4 Translate | Added Generate-Evaluate Loop |
| Step 9 Validation + GAN review | Step 4 eval loop | Validation embedded in loop, no separate step |
| — | Evaluate prompts (new) | Structured scoring rubrics |
| — | word-counter / timer (new) | Word stats + timeout control |

## 2026-05-11

### Architecture

- **Glossary → Corrections → terms.md**: Restructured from topic-based multi-file glossary (~860 entries across 6 files) to a single `references/terms.md` (17 entries). Only includes terms where the LLM produces verifiable mistranslations, with a `Why` column explaining each entry.
- **Step 2 simplified**: Removed "Topic Analysis & Glossary (Generate-Evaluate Loop)". Now just loads terms.md and checks language — no topic matching, no evaluation loop, no user interaction.
- **New Step 5: Terms Maintenance**: After translation, a subagent compares original vs translation output to identify actual mistranslations (added to terms.md) and unnecessary entries (removed). Reported to user at the end.
- **Default style changed**: Free (意译) is now the default. Literal mode only used when user specifies. Style selection removed from workflow.
- **Workflow fully automated**: User interaction only at start (missing content / non-English warning) and end (results summary). All intermediate confirmations removed.

### SKILL.md

- Frontmatter `description` restructured for cleaner skill triggering
- Removed `Evaluate Once` dead code
- Step 1: Removed "ask user to confirm conversion", added title 60-char truncation limit
- Step 3: Fixed table header ambiguity (`Chinese Translation (English original)` → `Translation（附原文）`)
- Step 4: Fixed image text rule (now adds translator note instead of just "verify"), clarified `word_count` source, added Chinese-English spacing rule (moved from deleted checklist), restructured translation rules with Free as base case
- Step 4 YAML frontmatter: Removed `topic` field

### Evaluation Prompts

- **Scoring bands split**: 5-8 band split into separate 5-6 and 7-8 bands in both eval prompts, making score 8 achievable
- **Anti-Inflation adjusted**: Threshold from 7 to 6, score 8 redefined as "at most 1-2 very minor issues"
- **Terminology references**: All "Glossary" references renamed to "Corrections"

### Scripts

- **word-counter.js**: Rewritten from TypeScript compiled artifact to clean JavaScript. Fixed `countEnglishChars` comment (letters only, not letters+numbers+punctuation). Fixed reading time calculation (weighted sum instead of Math.max). Trimmed 100+ lines of dual-language comments.
- **timer.js**: `TEMP_DIR` changed from `process.cwd()` to `os.tmpdir()` to prevent cross-directory failures
- **timer.test.js**: Updated to match new TEMP_DIR, all 14 tests pass

### Deleted Files

- `references/evaluate-topic-prompt.md` — no longer needed (Step 2 no longer has evaluation loop)
- `references/markdown-format-checklist.md` — 11 of 12 checks were things LLM already knows; only useful rule (Chinese-English spacing) moved inline to SKILL.md Step 4
- `glossary/template.md` — superseded by `references/terms.md`
- `glossary/` directory — superseded by `references/terms.md`
- `corrections/` directory — intermediate step, consolidated into `references/`

### Other

- **README.md**: Rewritten to be concise
- **.gitignore**: Simplified
