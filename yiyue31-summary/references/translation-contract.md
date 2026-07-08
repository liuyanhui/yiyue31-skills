# Translation Contract (summary → translator)

**Purpose.** This document is the single source of truth for how a summary's English output is handed off to `yiyue31-translator` as a separate, optional step. summary produces this contract's inputs and points to it from its `MANIFEST.md`; the translator (run independently after summary) consumes them. Nothing else should hardcode these rules.

**Why this file exists.** Previously the verbatim-marker transformation rule and its verification were inlined in summary's Step 7, and summary's summary-eval prompt even hardcoded a reference to "the Step 7 translator". Centralizing the rule here removes that cross-skill leak and lets translation run on its own.

---

## Inputs (produced by summary)

| File | Role in translation |
|------|---------------------|
| `{title}/summary/final-{title}.md` | **Source to translate.** This is the English summary. It becomes the translator's `original-{title}.md`. |
| `{title}/summary/analysis-{title}.md` | **Supplementary context only** — its Quotes table gives each verbatim item's highlight meaning, helping the translator render highlights well. The translator still generates its **own** analysis/glossary per its Step 2; summary's analysis is *not* a substitute and is *not* consumed as the translator's analysis file. |

**Note:** the source is the *summary*, not the original article. The translator should treat `final-{title}.md` as a complete, standalone article.

## Output

The translator writes `translated-{title}-zh.md` into its own output directory (`<title>/translation/`, where it derives `<title>` from the source article's title). summary does not copy or relocate it.

**Path caveat (read before locating the file):** the `<title>/translation/` path assumes the **standard layout** where summary's outputs live in `<title>/summary/` — so `summary/` and `translation/` are siblings under `<title>`. If a run uses a different output directory (e.g. a per-run folder like `career-advice-ai-3/`), the translation will **not** land next to that run's files; it lands wherever the translator resolves `<title>/translation/` relative to its working directory. Co-locating translation with an arbitrary run directory is a **Tier 3 (orchestration)** concern. To find the file reliably, search for `translated-{title}-zh.md`.

---

## Verbatim marker transformation (the core contract)

The English summary embeds memorable/highlight text inline using `[Verbatim]…[/Verbatim]` markers wrapped in `***bold italic***` (see summary's `generate-summary-prompt.md`). The translator must transform each one:

**Rule:** keep the English original, prepend its Chinese translation, format the whole pair as `***bold italic***`, and strip the `[Verbatim]`/`[/Verbatim]` tags. Result shape uses **full-width** parentheses:

`***中文译文（英文原文）***`

- Example: `***[Verbatim]the only way to go fast is to go well[/Verbatim]***` → `***欲速则不达（the only way to go fast is to go well）***`
- Surrounding non-verbatim text is translated normally.
- Each verbatim item's highlight context is in the analysis Quotes table.

## Hard constraints

- The Chinese translation must contain **zero** literal `[Verbatim]` or `[/Verbatim]` tags (they are all stripped and folded into the `***中文（英文）***` pair).

## Post-translation verification

Run on the translator's output file (`translated-{title}-zh.md` — see the **Path caveat** above for where it lands) after the translator finishes:

1. **No literal tags remain** — zero `[Verbatim]`/`[/Verbatim]` (regex `[[][/]?Verbatim]`).
2. **Verbatim preservation** — every `[Verbatim]…[/Verbatim]` item present in the English summary appears in the translation, with the English original preserved as the parenthetical half of each `***中文译文（English original）***` pair. Verify against the summary's *actual* verbatim markers (the summary typically uses a subset of the analysis Quotes table, not the full table).
3. On failure → re-invoke the translator with the specific failures listed, or report the gap to the user.

---

## How to run (separate step)

After summary completes, invoke `yiyue31-translator` with:
- **Source:** `{title}/summary/final-{title}.md` (becomes its `original-{title}.md`).
- **Style:** default (free translation).
- **Supplementary context:** point it at `{title}/summary/analysis-{title}.md` for verbatim highlight meanings.
- Then run the **Post-translation verification** above.

This step is intentionally separate so it can run in its own session (the summary + translator pipeline is heavy; splitting at the file boundary keeps memory bounded). See `decouple-translation-plan.md` for the full rationale.
