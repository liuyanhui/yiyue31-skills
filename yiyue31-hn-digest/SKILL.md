---
name: yiyue31-hn-digest
description: Digest HN threads when user says "summarize/digest/analyze this HN thread", "TLDR this HN post", "what are people saying on HN", or provides an HN post URL/ID.
version: 0.2.1
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
| `lang` | enum | `"zh"` / `"en"` | `"zh"` |
| `outputDir` | string | valid directory path | `"hn-digest/"` |
| `fetchOriginalPost` | boolean | — | false |
| `maxFetchRetries` | integer | 1–5 | 3 |
| `groupBy` | string[] | `"topic"`, `"stance"` | `["topic","stance"]` |
| `sortGroupsBy` | enum | `"relevance"` / `"engagement"` | `"relevance"` |
| `templateVersion` | string | maps to assets/ files | `"v1"` |

`depth` is the **analysis filter** (Step 5 keeps comments at depth ≤ `depth`). `fetchDepth` is the **Firebase fetch depth** (only matters when Algolia fails); fetch broadly, filter narrowly. `maxFetchComments` is a 2GB / time safety cap on Firebase's recursive fetch.

### Config Location & Loading

Path: `{homedir}/.hn-digest/config.json`. The skill directory is read-only.

- File missing → create dir, write defaults, output "首次运行，已生成默认配置 {path}".
- Malformed JSON → output "config.json 格式错误，使用默认值", use defaults (do NOT overwrite user's file).
- Valid JSON → read, clamp out-of-range values, replace invalid fields with defaults (output "config.json 字段 {field} 值无效，使用默认值 {default}").

### Config Priority

CLI args > config.json > defaults. CLI flags map to config fields by name, except: `--with-original` → `fetchOriginalPost: true`. `maxFetchRetries` is config-file-only.

---

## Step 3: Fetch Data

Try methods in order: Algolia → Firebase. Every run fetches fresh — there is no cache.

**Retries**: `maxFetchRetries` per method. 429 → wait 2s, retry same method. Empty comments = valid result. All methods 404 → output "帖子不存在或已被删除" → terminate.

For each method: output "正在获取数据... (使用 {Method} 方式)". On success → proceed to Step 4. On failure → output "抓取失败: {Method} - {reason}", try next.

| Method | Script | Notes |
|--------|--------|-------|
| Algolia | `bun {skill-dir}/scripts/algolia.ts {postId}` | Single request, full comment tree. Preferred. |
| Firebase | `bun {skill-dir}/scripts/firebase.ts {postId} --fetchDepth {config.fetchDepth} --maxFetchComments {config.maxFetchComments}` | Recursive per-comment fetch; fallback when Algolia fails. Bounded by `fetchDepth` and `maxFetchComments`. |

**`latestCommentAt`**: newest comment's ISO 8601 UTC timestamp, set by both fetch scripts.

All methods exhausted → output "所有抓取方式均失败: {methods + reasons}" → terminate.

---

## Step 4: Prepare Output & Validate

1. Generate `{slug}` from `post.title`: lowercase, strip punctuation and stop words (articles, prepositions, auxiliary verbs, conjunctions, pronouns, negation), take first 4 remaining words, join with hyphens. Example: "Can the stockmarket swallow Anthropic, SpaceX and OpenAI?" → `stockmarket-swallow-anthropic-spacex`.
2. Create `{outputDir}/{postId}-{slug}/` (fail → output "输出目录创建失败: {reason}" → terminate).
3. Write unified JSON to `{outputDir}/{postId}-{slug}/01-raw-data.json` (fail → output "原始数据写入失败: {reason}" → terminate).
4. If `config.fetchOriginalPost === true` and `post.url` exists: fetch via Jina (`https://r.jina.ai/{post.url}`, fallback `https://r.jinaai.cn/{post.url}`). Extract (a) the first ~3 paragraphs as background, and (b) 1–2 core-argument paragraphs — the passages that carry the original's main claim or evidence — for use as in-body block quotes during generation. On failure → output "原文抓取失败，将从评论推断背景".
5. If `comments` array is empty → output "该帖子暂无评论" → terminate.

---

## Step 5: Comment Filtering Pipeline (code-driven)

Run the deterministic filter — it produces `02-filtered.json` next to the input:

`bun {skill-dir}/scripts/preprocess.ts {outputDir}/{postId}-{slug}/01-raw-data.json --depth {config.depth} --minReplies {config.minReplies} --maxComments {config.maxComments}`

The script (`scripts/lib/filter.ts`) applies: (1) depth truncation, (2) activity partition → active set + outlier pool, (3) diversity-preserving selection to `maxComments` (OP + ≥1 representative per top-level subtree + heat fill), (4) OP mark. It writes `02-filtered.json` = `{ active, outlierPool, outlierBatches, meta }`. When the outlier pool is large (`> 60`), it is pre-split into `outlierBatches` (~40 each) so the standout pass (Step 6.4) can map-reduce without any single LLM call going oversized.

If `meta.activeCount === 0 && meta.outlierCount === 0` → output "过滤后无符合条件的评论" → terminate. Otherwise pass `02-filtered.json` to Step 6 (AI groups inline, no subagent).

---

## Step 6: Comment Grouping → 02-grouped.json

Read `02-filtered.json` (active + outlierPool + outlierBatches from Step 5) and `{skill-dir}/assets/grouped-example-{config.templateVersion}.json` for output structure (fallback to highest version if missing). Section names follow `config.lang`.

**If `active` is empty but `outlierPool` is not**: skip 6.1–6.3 (`groups` and `controversies` stay empty), still run 6.4 standouts; in Step 7 use the scattered-Q&A body with only `## 意外之声` (plus 总结 / 参考资料).

1. **Nested grouping** (over `active`): Group by `config.groupBy` dimensions in order (e.g., `["topic","stance"]` → first by topic, then by stance). Each comment in exactly ONE group. OP comments first within their group.
2. **sortGroupsBy**: `"relevance"` = rank by (total childIds.length, unique authors, OP presence) desc. `"engagement"` = rank by total childIds.length desc.
3. **Controversies**: Scan `active` for opposing viewpoints → add to `controversies` with `topic` + `sides`.
4. **Standout picks** (the cold/outrageous track — adds reader surprise, separate from the heat-ranked groups): pick 2–4 comments that are the most counter-consensus, counter-intuitive, sharp, or outrageous, from `outlierPool` plus `active`. **If `outlierBatches` is present** (large pool), map-reduce: pick surprising candidates from each batch, then pick the final 2–4 from the union — so no single call reads the whole oversized pool. Write to a top-level `standouts` array (each entry: `commentId`, `quote` = the comment's exact words, `reason` = why it is surprising, in `config.lang`). Set `standouts: []` if nothing genuinely surprising exists.

**Overflow handling**: If `active` > 40 comments, batch into ~20, group each batch, merge by group name, deduplicate `commentIds`.

Write the result to `{outputDir}/{postId}-{slug}/02-grouped.json` (fields: `groups`, `controversies`, `standouts` — see `assets/grouped-example-{config.templateVersion}.json`).

---

## Step 7: Article Generation (Generate-Evaluate Loop)

Max 3 rounds. Passing threshold: Overall Score >= 8.0.

### Loop Procedure

Each round:

1. Generate (round 1) or revise (rounds 2-3) the article using template from `{skill-dir}/assets/article-{templateVersion}.md`, grouped data, post metadata, filtered comments, and original post content (if fetched).
2. Write to `{outputDir}/{postId}-{slug}/article-draft-round{N}.md`.
3. Dispatch evaluation subagent with prompt from `{skill-dir}/references/evaluate-article-prompt.md`. Subagent reads: draft + `01-raw-data.json` + `02-grouped.json`. Writes: `evaluation-article-round{N}.md`.
4. Overall Score >= 8.0 → PASS → copy draft to `03-article.md` → Step 8. Score < 8.0 → track as best candidate → next round.

All rounds exhausted → copy best-scoring draft to `03-article.md`, output "文章质量评分: {bestScore}/10".

### Generation Rules

1. **Thread type** (decide in round 1, carry into revisions): classify the thread from `post.title` + `02-grouped.json` into one of controversy / breakthrough / event-or-obituary / scattered-Q&A, and pick the matching skeleton in `assets/article-{templateVersion}.md`. The body structure and whether `## 争议点` appears depend on this type — do not force every thread into the same skeleton.
2. **Language**: Entire article in `config.lang`. H1 title must be `[Hacker News] {post.title}`.
3. **OP highlight** (critical): `isOP === true` → prefix the OP marker (`zh`: `> **[楼主]** `, `en`: `> **[OP]** `), placed first in group. The marker follows `config.lang` so a zh article never ships an untranslated `[OP]`.
4. **Background & original voice**: Use fetched original content if available; otherwise infer from title + comments. When the fetched original carries a substantive argument, quote its 1–2 core-argument paragraphs as block quotes inside the relevant body section.
5. **References**: Append `## 参考资料`/`## References` with HN link and original article link (if exists).
6. Overwrite existing `03-article.md` (output "正在覆盖已有输出" if overwriting).
7. **Coverage marker**: each `###` subsection and roundup bullet that maps to a group in `02-grouped.json` appends `（N / M 条）` (zh) or `(N / M comments)` (en). N = unique comments under the mapped group(s); M = total unique across all groups. Body stays editorially ordered (not by heat); a group's `commentIds` already unions its subGroups — don't double-count. Skip list + full rules in `assets/article-{templateVersion}.md`.
8. **Standout section**: render `## 意外之声 / Standout takes` (all skeletons, before 总结) from `02-grouped.json` `standouts` — each pick as a blockquote of the comment's exact words plus a one-line reason it is surprising. Omit the section entirely when `standouts` is empty.

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

Cold readers — who see ONLY `03-article.md`, never the raw comments or grouped data — read it sentence by sentence and report where they get stuck. They report **phenomena only, never fixes**. You then act as editor with full context to resolve every **blocking** comprehension problem. The loop ends when no reader reports a blocking problem.

**Why article-only readers:** feeding readers the raw/grouped data lets them fill gaps from memory and miss the gaps a real reader hits; you (editor) get full context — `01-raw-data.json` + `02-grouped.json` — to fix correctly.

**Distinguishing blocking vs look-up-able:** only blocking problems (the article's own ungrounded concepts) converge the loop; look-up-able domain vocabulary (tool names, jargon) is expected in a specialist digest and is ignored.

**Loop procedure:**
1. **Each round N (1..3)**:
   - Spawn **3 cold readers in parallel**, each a subagent with `{skill-dir}/references/evaluate-reader-audit-prompt.md` and a distinct profile. Each receives ONLY `03-article.md`. Profiles follow `config.lang`:
     - zh: `普通读者` / `略读读者` / `门外汉`
     - en: `casual-reader` / `skim-reader` / `non-native`
   - Save each report to `{outputDir}/{postId}-{slug}/evaluation-reader-audit-round{N}-{profile}.md`.
   - **Aggregate:** collect and dedupe all **blocking** phenomena across the 3 reports (ignore look-up-able domain terms).
   - No reader reports a blocking problem → **PASS** → proceed to 10.3.
   - Otherwise: act as **editor**. For each blocking phenomenon, decide and apply a fix using full context — current `03-article.md` + `01-raw-data.json` + `02-grouped.json`. Overwrite `03-article.md`. Next round.
2. **Rounds exhausted (3 rounds)**: keep `03-article.md`, output "部分读者体验问题可能残留".

### 10.3 Final Output

1. Copy `03-article.md` to `{outputDir}/{postId}-{slug}/final-{slug}-{postId}.md` (overwrite if exists).
2. Inject the disclaimer + timestamp into `final-*.md`: `bun {skill-dir}/scripts/insert-header.ts {outputDir}/{postId}-{slug}/final-{slug}-{postId}.md {outputDir}/{postId}-{slug}/01-raw-data.json {config.lang}`.
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
