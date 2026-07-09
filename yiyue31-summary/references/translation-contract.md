# Translation Contract (summary → translator)

**Purpose.** This document is the single source of truth for how a summary's English output is handed off to `yiyue31-translator` as a separate, optional step. summary produces this contract's inputs, copies this file into `{title}/summary/`, and points to that copy from its `translation-handoff.md`; the translator (run independently after summary) consumes them. Nothing else should hardcode these rules.

**Canonical source vs. run copy.** This file in `references/` is the canonical, maintained source. Step 7 copies it verbatim into `{title}/summary/translation-contract.md` so the result directory is self-contained. Edit here; do not hand-edit the run copy (the next summary run overwrites it).

**Why this file exists.** Previously the verbatim-marker transformation rule and its verification were inlined in summary's Step 7, and summary's summary-eval prompt even hardcoded a reference to "the Step 7 translator". Centralizing the rule here removes that cross-skill leak and lets translation run on its own.

---

## Inputs (produced by summary)

| File | Role in translation |
|------|---------------------|
| `{title}/summary/summary-{title}.md` | **Source to translate.** This is the English summary. It becomes the translator's `original-{title}.md`. |
| `{title}/summary/analysis-{title}.md` | **Supplementary context only** — its Quotes table gives each verbatim item's highlight meaning, helping the translator render highlights well. The translator still generates its **own** analysis/glossary per its Step 2; summary's analysis is *not* a substitute and is *not* consumed as the translator's analysis file. |

**Note:** the source is the *summary*, not the original article. The translator should treat `summary-{title}.md` as a complete, standalone article.

## Output

The translator writes `translated-{title}-zh.md` into its own workspace (`{title}/translation/`, deriving `{title}` from the source's title). That workspace holds all of the translator's intermediate artifacts (chunks, analysis, glossary, reviews).

**Co-location step (after the translator finishes):** copy `translated-{title}-zh.md` from `{title}/translation/` into `{title}/summary/`, renaming it to `summary-{title}-zh.md`. **Naming rule:** the Chinese version's filename is the English deliverable's filename with `-zh` inserted before `.md` (`summary-{title}.md` → `summary-{title}-zh.md`). The `-zh` suffix is the unified "Chinese version" marker; the `summary-` stem marks this as a translation *of a summary*, distinct from translating the original article directly (which stays `translated-{title}-zh.md`). Keep the translator's original in `{title}/translation/` — copy, do not move.

After this step the co-located pair in `{title}/summary/` is `summary-{title}.md` (English) + `summary-{title}-zh.md` (Chinese).

**Working directory:** run summary and the translator from the same working directory so `{title}/summary/` and `{title}/translation/` are siblings under `{title}`. (If run inside a per-run folder like `{title}-N/`, both nest one extra level; that is a working-directory convention, separate from this contract.)

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

Run on the translator's output file (`{title}/translation/translated-{title}-zh.md`) after the translator finishes, before the co-location copy:

1. **No literal tags remain** — zero `[Verbatim]`/`[/Verbatim]` (regex `[[][/]?Verbatim]`).
2. **Verbatim preservation** — every `[Verbatim]…[/Verbatim]` item present in the English summary appears in the translation, with the English original preserved as the parenthetical half of each `***中文译文（English original）***` pair. Verify against the summary's *actual* verbatim markers (the summary typically uses a subset of the analysis Quotes table, not the full table).
3. On failure → re-invoke the translator with the specific failures listed, or report the gap to the user.

---

## How to run (separate step)

After summary completes, invoke `yiyue31-translator` with:
- **Source:** `{title}/summary/summary-{title}.md` (becomes its `original-{title}.md`).
- **Style:** default (free translation).
- **Supplementary context:** point it at `{title}/summary/analysis-{title}.md` for verbatim highlight meanings.
- Then run the **Post-translation verification** above.
- Then do the **Co-location step** in the Output section (copy `translated-{title}-zh.md` from `{title}/translation/` → `{title}/summary/summary-{title}-zh.md`).

This step is intentionally separate so it can run in its own session (the summary + translator pipeline is heavy; splitting at the file boundary keeps memory bounded).
