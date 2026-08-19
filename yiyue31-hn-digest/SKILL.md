---
name: yiyue31-hn-digest
description: Digest HN threads when user says "summarize/digest/analyze this HN thread", "TLDR this HN post", "what are people saying on HN", or provides an HN post URL/ID.
version: 0.3.0
author: yiyue31
---

# yiyue31-hn-digest Skill

You transform a Hacker News discussion thread into a structured article. `{skill-dir}` = this SKILL.md's directory.

**Architecture**: Main agent (you) executes all steps. Evaluation subagents (one or more per step) read their assigned inputs (article, and where relevant `01-raw-data.json` / `02-filtered.json` / `02-grouped.json`) + write reports (read-only, never modify content files). When dispatching evaluation, pass: input path(s), evaluation prompt path from `{skill-dir}/references/`, and output report path.

Terminal messages use Chinese by default; English when `config.lang` is `"en"`.

---

## Step 1: Parse Input

Extract the post ID from user input — either a full URL (`https://news.ycombinator.com/item?id=12345678`) or a plain ID (`12345678`). Invalid input → output "Invalid postId" → terminate.

---

## Step 2: Load Configuration

### Config Schema

| Field | Type | Constraint | Default |
|-------|------|-----------|---------|
| `depth` | integer | 1–10 | 5 |
| `minReplies` | integer | 0–100 | 3 |
| `maxComments` | integer | 5–150 | 80 |
| `fetchDepth` | integer | 1–15 | 10 |
| `maxFetchComments` | integer | 1–2000 | 500 |
| `maxFetchAlgolia` | integer | 100–10000 | 2000 |
| `lang` | enum | `"zh"` / `"en"` | `"zh"` |
| `outputDir` | string | valid directory path | `"hn-digest/"` |
| `fetchOriginalPost` | boolean | — | false |
| `maxFetchRetries` | integer | 1–5 | 3 |
| `groupBy` | string[] | `"topic"`, `"stance"` | `["topic","stance"]` |
| `sortGroupsBy` | enum | `"relevance"` / `"engagement"` | `"relevance"` |
| `templateVersion` | string | maps to assets/ files | `"v1"` |

`depth` is the **analysis filter** (Step 5 keeps comments at depth ≤ `depth`). `fetchDepth` is the **Firebase fetch depth** (only matters when Algolia fails); fetch broadly, filter narrowly. `maxFetchComments` is a 2GB / time safety cap on Firebase's recursive fetch. `maxFetchAlgolia` is the equivalent safety net on Algolia's single unbounded response; normal threads never hit it, and when it does cut, the raw data carries `truncated`/`originalCommentCount` and the final header discloses the cut to the reader.

### Config Location & Loading

Path: `{cwd}/hn-digest.config.json` (project-local, at the project/repo root where the skill runs). The skill directory is read-only; config is project-local only — the legacy user-home config is no longer read.

- File missing → use defaults, do NOT create a file; output "未找到项目配置 {path}，使用默认值". Never auto-write a config on first run — a generated defaults snapshot freezes old defaults and silently defeats future default changes.
- Malformed JSON → output "config.json 格式错误，使用默认值", use defaults (do NOT overwrite user's file).
- Valid JSON → read, clamp out-of-range values, replace invalid fields with defaults (output "config.json 字段 {field} 值无效，使用默认值 {default}").

After resolving, output the effective config with its source so any override is visible at run start: "生效配置 [来源: {path 或 默认值}]: depth=.., minReplies=.., maxComments=.., fetchDepth=.., maxFetchComments=.., lang=.., outputDir=.., fetchOriginalPost=.., groupBy=.., sortGroupsBy=.., templateVersion=.., maxFetchRetries=..".

### Config Priority

CLI args > hn-digest.config.json > defaults. CLI flags map to config fields by name, except: `--with-original` → `fetchOriginalPost: true`. `maxFetchRetries` is config-file-only.

---

## Step 3: Fetch Data

Try methods in order: Algolia → Firebase. Every run fetches fresh — there is no cache.

**Retries**: `maxFetchRetries` per method. 429 → wait 2s, retry same method. Empty comments = valid result. All methods 404 → output "帖子不存在或已被删除" → terminate.

For each method: output "正在获取数据... (使用 {Method} 方式)". On success → proceed to Step 4. On failure → output "抓取失败: {Method} - {reason}", try next.

| Method | Script | Notes |
|--------|--------|-------|
| Algolia | `bun {skill-dir}/scripts/algolia.ts {postId} --out {outputDir}/raw-{postId}.json --maxFetchAlgolia {config.maxFetchAlgolia}` | Single request, full comment tree. Preferred. Writes the unified JSON straight to the file; stdout prints ONE summary line (title / author / score / comment counts / latestCommentAt / out path). |
| Firebase | `bun {skill-dir}/scripts/firebase.ts {postId} --out {outputDir}/raw-{postId}.json --fetchDepth {config.fetchDepth} --maxFetchComments {config.maxFetchComments}` | Recursive per-comment fetch; fallback when Algolia fails. Bounded by `fetchDepth` and `maxFetchComments`. Same file-write + summary-line contract. |

**Context rule (why: a large thread's raw JSON alone can approach the context window)**: the raw comment data moves through files and script summaries, never through your context. Do not cat/head/dump `raw-{postId}.json` or `01-raw-data.json` — the fetch stdout summary carries everything you need (title for the slug, counts, snapshot fields), and Steps 5-7 consume the raw data via scripts only.

**`latestCommentAt`**: newest comment's ISO 8601 UTC timestamp, set by both fetch scripts.

All methods exhausted → output "所有抓取方式均失败: {methods + reasons}" → terminate.

---

## Step 4: Prepare Output & Validate

1. Generate `{slug}` from the fetch summary line's `title`: lowercase, strip punctuation and stop words (articles, prepositions, auxiliary verbs, conjunctions, pronouns, negation), take first 4 remaining words, join with hyphens. Example: "Can the stockmarket swallow Anthropic, SpaceX and OpenAI?" → `stockmarket-swallow-anthropic-spacex`.
2. Create `{outputDir}/{postId}-{slug}/` (fail → output "输出目录创建失败: {reason}" → terminate).
3. Move the fetched file into place: `{outputDir}/raw-{postId}.json` → `{outputDir}/{postId}-{slug}/01-raw-data.json` (fail → output "原始数据写入失败: {reason}" → terminate).
4. If `config.fetchOriginalPost === true` and `post.url` exists: fetch via Jina (`https://r.jina.ai/{post.url}`, fallback `https://r.jinaai.cn/{post.url}`). Extract (a) the first ~3 paragraphs as background, and (b) 1–2 core-argument paragraphs — the passages that carry the original's main claim or evidence — for use as in-body block quotes during generation. On failure → output "原文抓取失败，将从评论推断背景".
5. If the fetch summary reports `comments: 0` → output "该帖子暂无评论" → terminate.

---

## Step 5: Comment Filtering Pipeline (code-driven)

Run the deterministic filter — it produces `02-filtered.json` next to the input:

`bun {skill-dir}/scripts/preprocess.ts {outputDir}/{postId}-{slug}/01-raw-data.json --depth {config.depth} --minReplies {config.minReplies} --maxComments {config.maxComments}`

The script (`scripts/lib/filter.ts`) applies: (1) depth truncation, (2) activity partition → active set + outlier pool, (3) diversity-preserving selection to `maxComments` (OP + ≥1 representative per top-level subtree + heat fill), (4) OP mark. It writes `02-filtered.json` = `{ active, outlierPool, outlierBatches, meta }`. Each `active`/`outlierPool` entry is a **slim index** — `{ id, author, parentId, childIds, depth, isOP }` — with **no `contentMarkdown`** (the body is a verbatim duplicate of `01-raw-data.json`). When the outlier pool is large (`> 60`), it is pre-split into `outlierBatches` (~40 each, id-only) so the standout pass (Step 6.4) can map-reduce without any single LLM call going oversized.

Then join the bodies back, by script:

`bun {skill-dir}/scripts/join.ts {outputDir}/{postId}-{slug}/01-raw-data.json {outputDir}/{postId}-{slug}/02-filtered.json`

`join.ts` writes `02-active-bodies.md` (every active comment's full body + a metadata header) and `02-outlier-bodies-g*.md` (the outlier pool's bodies, batches consolidated into ~4 files) next to its inputs. These are the ONLY body sources for Steps 6 and 7. **Do NOT read `02-filtered.json` or `01-raw-data.json` whole** — both can be large on big threads, and everything needed (counts, batch layout, bodies) is already in the script stdout summaries and the join outputs.

If `meta.activeCount === 0 && meta.outlierCount === 0` → output "过滤后无符合条件的评论" → terminate. Otherwise pass `02-filtered.json` to Step 6 (AI groups inline, no subagent).

---

## Step 6: Comment Grouping → 02-grouped.json

Read `02-active-bodies.md` (active bodies + metadata headers, from Step 5's join) and `{skill-dir}/assets/grouped-example-{config.templateVersion}.json` for output structure (fallback to highest version if missing). Counts and batch layout come from the Step 5 script summaries — do not read `02-filtered.json` whole. Section names follow `config.lang`.

**If `active` is empty but `outlierPool` is not**: skip 6.1–6.3 (`groups` and `controversies` stay empty), still run 6.4 standouts; in Step 7 use the scattered-Q&A body with only `## 意外之声` (plus 总结 / 参考资料).

1. **Nested grouping** (over `active`): Group by `config.groupBy` dimensions in order (e.g., `["topic","stance"]` → first by topic, then by stance). **Every comment in `active` MUST be assigned to exactly one group — none may be omitted** (the coverage marker M = total grouped comments; dropped comments silently shrink the digest and misrepresent how much of the thread was analyzed — depth ≥2 comments are routinely dropped if this is not enforced). Comments that don't fit a named topic go into a catch-all `其他观点`/`Other` group (dimension `topic`) rather than being dropped. OP comments first within their group.
2. **sortGroupsBy**: `"relevance"` = rank by (total childIds.length, unique authors, OP presence) desc. `"engagement"` = rank by total childIds.length desc.
3. **Controversies**: Scan `active` for opposing viewpoints → add to `controversies` with `topic` + `sides`.
4. **Standout picks** (the surprise track — adds reader surprise, separate from the heat-ranked body): pick 2–4 comments that are genuinely counter-consensus, counter-intuitive, or outrageous-but-coherent. Source them PRIMARILY from `outlierPool` (comments the activity filter dropped because of low reply volume), so they do NOT repeat the body; an `active` comment is allowed only when it contradicts its own group's mainstream stance. The bar is SURPRISE — "well-argued", "I agree", or "clearly explained" do NOT qualify. **If `outlierBatches` is present** (large pool), map-reduce: dispatch ~4 standout-scan subagents, each reading ONE `02-outlier-bodies-g*.md` file (`join.ts` has pre-consolidated the batches), pick surprising candidates from each, then pick the final 2–4 from the union — so no single call reads the whole oversized pool, and the scan does not become one dispatch per batch. Write to a top-level `standouts` array, each entry: `commentId`, `author` (the commenter's handle, from the slim index), `quote` = the comment's **exact words in the SOURCE language — never translate the quote** (HN comments are English, so a zh article still carries the English quote here), `translation` = a translation into `config.lang` (omit when the source language already equals `config.lang`), `reason` = why it was selected (入选原因), in `config.lang`. Set `standouts: []` when fewer than 2 picks clear the surprise bar — empty is the expected outcome for many threads, not a failure.

**Overflow handling**: If `active` > 40 comments, batch into ~20, group each batch (assigning EVERY comment in the batch), merge by group name and union `commentIds` across batches — drop nothing. Re-verify with the coverage check (6.5).

Write the result to `{outputDir}/{postId}-{slug}/02-grouped.json` (fields: `groups`, `controversies`, `standouts` — see `assets/grouped-example-{config.templateVersion}.json`).

5. **Coverage check (mandatory)**: After writing `02-grouped.json`, run `bun {skill-dir}/scripts/check-coverage.ts {outputDir}/{postId}-{slug}/02-filtered.json {outputDir}/{postId}-{slug}/02-grouped.json`. It reports active ids missing from any group, ids owned by more than one group, and grouped ids not in active. If it reports anything, fix (assign missing comments to a topic or the `其他观点` catch-all; remove cross-group duplicates) and re-run until it reports clean. Do not proceed to Step 7 with gaps — a non-clean result means the article's coverage marker will understate the thread.

---

## Step 7: Article Generation (Generate-Evaluate Loop)

Max 3 rounds. Passing threshold: Overall Score >= 8.0.

### Loop Procedure

Each round:

1. Generate (round 1) or revise (rounds 2-3) the article using template from `{skill-dir}/assets/article-{templateVersion}.md`, grouped data, post metadata, filtered comments (bodies from `02-active-bodies.md`), and original post content (if fetched).
2. Write to `{outputDir}/{postId}-{slug}/article-draft-round{N}.md`.
3. Dispatch evaluation subagent with prompt from `{skill-dir}/references/evaluate-article-prompt.md`. Subagent reads: draft + `01-raw-data.json` (sampled, not read whole, on large threads — per the evaluation prompt) + `02-grouped.json`. Writes: `evaluation-article-round{N}.md`.
4. Overall Score >= 8.0 → PASS → copy draft to `03-article.md` → Step 8. Score < 8.0 → track as best candidate → next round.

All rounds exhausted → copy best-scoring draft to `03-article.md`, output "文章质量评分: {bestScore}/10".

### Generation Rules

1. **Thread type** (decide in round 1, carry into revisions): classify the thread from `post.title` + `02-grouped.json` into one of controversy / breakthrough / event-or-obituary / scattered-Q&A, and pick the matching skeleton in `assets/article-{templateVersion}.md`. The body structure and whether `## 争议点` appears depend on this type — do not force every thread into the same skeleton.
2. **Language**: Entire article in `config.lang`. H1 prefix `[HN]`, monolingual section headings, and the original-title `<small>` line (positioned between the H1 and the injected header) are all defined in `assets/article-{templateVersion}.md`.
3. **OP highlight** (critical): `isOP === true` → prefix the OP marker (`zh`: `> **[楼主]** `, `en`: `> **[OP]** `), placed first in group. The marker follows `config.lang` so a zh article never ships an untranslated `[OP]`.
4. **Background & original voice**: Use fetched original content if available; otherwise infer from title + comments. When the fetched original carries a substantive argument, quote its 1–2 core-argument paragraphs as block quotes inside the relevant body section.
5. **References**: Append `## 参考资料` (en: `## References`) with HN link and original article link (if exists). This is the LAST section — nothing follows it.
6. Overwrite existing `03-article.md` (output "正在覆盖已有输出" if overwriting).
7. **Coverage (no end note, no per-section markers)**: do NOT append `（N / M 条）` / `(N / M comments)` to section headings, and do NOT write any coverage/methodology note at the end — that is injected as a `<small>` paragraph after the H1 by Step 10.3's `insert-header.ts`. Full generation constraints in `assets/article-{templateVersion}.md`.
8. **Standout section**: render `## 意外之声` (en: `## Surprising takes`; all skeletons, before 总结) from `02-grouped.json` `standouts`; source and surprise bar are defined in Step 6.4. **Full format (blockquote shape, blank `>` line between fields, label set, omit-when-empty) in `assets/article-{templateVersion}.md`.**
9. **Catch-all group**: if `02-grouped.json` contains an `其他观点`/`Other` group (the coverage safety net from Step 6.1), render it briefly as a short roundup or fold it into `## 要点` — never as a full body section. It exists to guarantee coverage, not to carry narrative weight.

---

## Step 8: AI Tone Check

Max 5 rounds. Pass condition: no AI tone issues remain.

1. Dispatch evaluation subagent with prompt from `{skill-dir}/references/evaluate-ai-tone-prompt.md`. Reads `03-article.md`, writes `evaluation-ai-tone-round{N}.md`.
2. Verdict "NO ISSUES REMAIN" → PASS → Step 9. "ISSUES FOUND" → apply fixes, overwrite `03-article.md`, next round.

All 5 rounds exhausted → keep article, output "部分AI语气问题可能残留".

---

## Step 9: Translationese Check (Conditional)

**Skip** when article language matches source comment language (sample the first 10 entries of `active` in `02-filtered.json` to determine). Otherwise execute single pass:

1. Dispatch evaluation subagent with prompt from `{skill-dir}/references/evaluate-translationese-prompt.md`. Reads `03-article.md`, writes `evaluation-translationese.md`.
2. If issues found → apply fixes, overwrite `03-article.md`.

Proceed to Step 10 regardless.

---

## Step 10: Readability Check + Reader Audit + Final Output

### 10.1 Readability Check

1. Dispatch evaluation subagent with prompt from `{skill-dir}/references/evaluate-readability-prompt.md`. Reads `03-article.md`, writes `evaluation-readability.md`.
2. If issues found → apply fixes, overwrite `03-article.md`.

### 10.2 Reader Audit (max 3 rounds)

Dispatch cold-reader subagents and resolve their reports per `{skill-dir}/references/reader-audit-procedure.md` (read it now). Short version: 3 article-only readers report blocking comprehension problems each round; you (main agent, full context) fix them; loop until no blocking problem remains or 3 rounds exhausted.

### 10.3 Final Output

1. Copy `03-article.md` to `{outputDir}/{postId}-{slug}/final-{slug}-{postId}.md` (overwrite if exists).
2. Inject the disclaimer + methodology + discussion snapshot (timestamp, post score, comment count) into `final-*.md` as one `<small>` paragraph after the H1: `bun {skill-dir}/scripts/insert-header.ts {outputDir}/{postId}-{slug}/final-{slug}-{postId}.md {outputDir}/{postId}-{slug}/01-raw-data.json {config.lang}`.
3. Do NOT clean up intermediate files.

---

## Step 11: Recommendation Summaries

Read `{outputDir}/{postId}-{slug}/03-article.md` as sole content source. Read `{skill-dir}/assets/recommendation-{config.templateVersion}.md` for style definitions (fallback to highest version if missing).

Generate 11 summaries (5 styles × 2 variants + 1 TL;DR): Technical, Viral, Lively, News, Podcast (each ~100字/words + ~200字/words), plus TL;DR (30–50字/words). No evaluation subagent.

**Rules**: Output in `config.lang`. Character counts: zh = Chinese characters (excluding punctuation/spaces), en = English words. Each style must be genuinely distinct. Each summary self-contained. Stay within ±10% of target.

Write to `{outputDir}/{postId}-{slug}/recommendation-{slug}-{postId}.md`.

**Terminal output**:
1. "输出文件:" + all output file paths.
2. 3–5 sentence article summary in `config.lang`.
