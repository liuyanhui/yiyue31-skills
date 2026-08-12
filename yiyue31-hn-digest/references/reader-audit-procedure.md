# Reader Audit Procedure (Step 10.2 orchestration)

> Read by the main agent when it reaches Step 10.2. The cold-reader subagents themselves read `evaluate-reader-audit-prompt.md`; this file is the main agent's procedure for dispatching them and resolving what they report.

## What the cold readers do

Cold readers see ONLY `03-article.md`, never the raw comments or grouped data. They read it sentence by sentence and report where they get stuck. They report **phenomena only, never fixes**. You (main agent) then act as editor with full context to resolve every **blocking** comprehension problem. The loop ends when no reader reports a blocking problem.

## Why article-only readers

Feeding readers the raw/grouped data lets them fill gaps from memory and miss the gaps a real reader hits; you (editor) get full context — `01-raw-data.json` + `02-grouped.json` — to fix correctly.

## Distinguishing blocking vs look-up-able

Only blocking problems (the article's own ungrounded concepts) converge the loop; look-up-able domain vocabulary (tool names, jargon) is expected in a specialist digest and is ignored.

## Loop procedure

Max 3 rounds. Each round N (1..3):

1. Spawn **3 cold readers in parallel**, each a subagent with `{skill-dir}/references/evaluate-reader-audit-prompt.md` and a distinct profile. Each receives ONLY `03-article.md`. Profiles follow `config.lang`:
   - zh: `普通读者` / `略读读者` / `门外汉`
   - en: `casual-reader` / `skim-reader` / `non-native`
2. Save each report to `{outputDir}/{postId}-{slug}/evaluation-reader-audit-round{N}-{profile}.md`.
3. **Aggregate:** collect and dedupe all **blocking** phenomena across the 3 reports (ignore look-up-able domain terms).
4. No reader reports a blocking problem → **PASS** → return to Step 10.2 (proceed to 10.3). Otherwise: act as **editor** — for each blocking phenomenon, decide and apply a fix using full context (current `03-article.md` + `01-raw-data.json` + `02-grouped.json`). Overwrite `03-article.md`. Next round.

Rounds exhausted (3 rounds) → keep `03-article.md`, output "部分读者体验问题可能残留".
