# Decouple Translation from summary — Tier 2 Plan

Status: **Tier 2 (in progress)**. Tier 3 (full orchestrator skill) deferred — discuss separately after Tier 2 lands.

## 1. Problem: what is actually coupled

"summary embeds translator" is imprecise. The translator's *logic* is **not** duplicated — Step 7 delegates the entire translator skill (all 12 steps) to a subagent. What is genuinely tangled is a **summary-specific format contract plus an adapter**, scattered across 5 files:

- `references/generate-summary-prompt.md:22` — producer rule for `[Verbatim]…[/Verbatim]`
- `templates/{tech-article,paper,concise}.md` — producer rule (×3)
- `references/evaluate-prompt.md:73` — evaluator; **leakiest spot**: hardcodes `"consumed by the Step 7 translator"`, binding a quality-check prompt to another skill's step number
- `SKILL.md` Step 7 — consumer + transformer (`***中文（英文）***`) + verifier

So the translator is clean; the dirty part is the Step 7 adapter logic and the cross-skill verbatim contract.

Reuse check (grep): **only `yiyue31-summary` invokes `yiyue31-translator` today.** `hn-digest` shares eval prompts but does not call the translator. There is currently zero cross-skill reuse of the translator.

## 2. The three tiers

| Tier | What | Verdict |
|---|---|---|
| 1 minimal | Keep Step 7; move verbatim contract out of inline prose into a doc |止血 only |
| **2 (this doc)** | summary ends after `final-{title}.md`; emits a `MANIFEST.md`; translation becomes a **separate, optional** translator invocation that reads a contract | **chosen now** |
| 3 full | Dedicated orchestrator skill chains summary → translator; generic "translatable artifact" contract | only worth it when translator is reused by ≥2 skills — **deferred** |

Why Tier 2 first: delivers the real decoupling (contract centralized, translation independently runnable, no leaky hardcode) **without** building an orchestrator layer for a single consumer. Bonus aligned with the low-memory rule: the file boundary is a natural session split — a heavy `summary + translator` pipeline no longer has to run in one ballooning process.

## 3. Tier 2 design — decisions locked

1. **summary stops after producing `final-{title}.md`** (end of Step 6). Step 7 becomes "Emit Manifest + Hand Off".
2. **Translation is NOT auto-run by summary.** It is a separate `yiyue31-translator` invocation after summary completes, driven by the manifest + contract. Summary informs the user of the handoff; it does not chain.
3. **Translation output stays in the translator's natural home** `{title}/translation/` (→ `translated-{title}-zh.md`). summary no longer reaches into the translator's dir to copy into `{title}/summary/translation/`. The manifest points to the real location. *(Relocating under `summary/` is a Tier 3 concern.)*
4. **Analysis-reuse ambiguity (resolved):** summary's `analysis-{title}.md` is **supplementary context only** (verbatim highlight meanings from the Quotes table). The translator still generates its **own** analysis/glossary per its Step 2 — they are different-shaped artifacts. The manifest states this explicitly.
5. **Verbatim contract centralized** in a new `references/translation-contract.md`. Both the manifest and any translation runner reference it; nothing else hardcodes the rule.
6. **Version bump** `2.2.2 → 2.3.0` (structural change: translation removed from the summary pipeline).

## 4. Tier 2 execution checklist

| # | File | Change |
|---|------|--------|
| A | `references/translation-contract.md` | **NEW** — source input, analysis-reuse rule, verbatim transformation + examples, hard constraints, post-translation verification, output location |
| B | `SKILL.md` | version → 2.3.0; rewrite Step 7 (manifest + handoff); fix Description line 16 (Chinese no longer produced in Step 7) |
| C | `references/evaluate-prompt.md:73` | remove `"consumed by the Step 7 translator"` hardcode → reference `translation-contract.md` |
| D | `README.md` | diagram node "Step 7 → Translate" → "Emit Manifest + Handoff"; Done node; loop-caption line 105; Output Files tree (drop `translation/` subtree, add `MANIFEST.md`); note translation is separate |

No shared cross-skill prompt is touched (`evaluate-ai-tone-prompt.md` unchanged), so no sibling version-sync is required. `evaluate-prompt.md` has no version header (summary-unique).

## 5. Deferred to Tier 3 (discuss later)

- Dedicated orchestrator skill (`summary → translator`).
- Generic "translatable artifact" contract so `hn-digest` / `paper-layout` can also consume the translator.
- Whether translation output should relocate under `{title}/summary/`.
- Auto-chaining vs. explicit handoff policy across skills.
