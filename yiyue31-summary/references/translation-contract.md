# Translation Contract (summary → translator)

Rules for transforming a summary's `[Verbatim]` highlight markers when translating the English summary to Chinese.

## Input

The source to translate is `summary-{title}.md` (the English summary) — treat it as a complete, standalone article, not as a derivative of some other original. `analysis-{title}.md` is supplementary context only: its Quotes table gives each verbatim item's highlight meaning to help render highlights well. You still generate your **own** analysis/glossary; the summary's analysis is not a substitute.

The co-located Chinese file is named `summary-{title}-zh.md` (English deliverable name + `-zh`); the copy step and paths are in `translation-handoff.md`.

## Verbatim marker transformation

The English summary embeds memorable/highlight text inline using `[Verbatim]…[/Verbatim]` markers wrapped in `***bold italic***`. Transform each one:

**Rule:** keep the English original, prepend its Chinese translation, format the whole pair as `***bold italic***`, and strip the `[Verbatim]`/`[/Verbatim]` tags. Result shape uses **full-width** parentheses:

`***中文译文（英文原文）***`

- Example: `***[Verbatim]the only way to go fast is to go well[/Verbatim]***` → `***欲速则不达（the only way to go fast is to go well）***`
- Surrounding non-verbatim text is translated normally.

## Hard constraint

The Chinese translation must contain **zero** literal `[Verbatim]` or `[/Verbatim]` tags (all stripped and folded into the `***中文（英文）***` pair).

## Post-translation verification

Run on the translator's output (`translated-{title}-zh.md`) before co-location:

1. **Hard constraint holds** — zero literal `[Verbatim]`/`[/Verbatim]` tags.
2. **Verbatim preservation** — every `[Verbatim]…[/Verbatim]` item in the English summary appears in the translation, with the English original preserved as the parenthetical half of each `***中文译文（English original）***` pair. Verify against the summary's *actual* verbatim markers (the summary typically uses a subset of the analysis Quotes table, not the full table).
3. On failure → re-invoke the translator with the specific failures listed, or report the gap to the user.
