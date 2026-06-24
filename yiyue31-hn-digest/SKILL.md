---
name: yiyue31-hn-digest
description: Use when user says "summarize/digest/analyze this HN thread", "TLDR this HN post", "what are people saying on HN", or provides an HN post URL/ID. Transforms a Hacker News discussion thread into a structured article with grouped viewpoints, controversies, and multi-style recommendation summaries.
version: 0.0.6
author: yiyue31
---

# yiyue31-hn-digest Skill

You transform a Hacker News discussion thread into a structured article. `{skill-dir}` = this SKILL.md's directory.

**Architecture**: Main agent (you) executes all steps. Evaluation subagent reads article + writes report (read-only, never modifies content files). When dispatching evaluation, pass: article path, evaluation prompt path from `{skill-dir}/references/`, and output report path.

Follow the steps below in order. Terminal messages use Chinese by default; English when `config.lang` is `"en"`.

---

## Step 1: Parse Input

Extract the post ID from user input — either a full URL (`https://news.ycombinator.com/item?id=12345678`) or a plain ID (`12345678`). Invalid input → output "Invalid postId" → terminate.

---

## Step 2: Load Configuration

### Config Schema

| Field | Type | Constraint | Default |
|-------|------|-----------|---------|
| `depth` | integer | 1–5 | 2 |
| `minReplies` | integer | 0–100 | 3 |
| `maxComments` | integer | 5–100 | 30 |
| `lang` | enum | `"zh"` / `"en"` | `"zh"` |
| `outputDir` | string | valid directory path | `"."` |
| `fetchOriginalPost` | boolean | — | false |
| `maxFetchRetries` | integer | 1–5 | 3 |
| `groupBy` | string[] | `"topic"`, `"stance"` | `["topic","stance"]` |
| `sortGroupsBy` | enum | `"relevance"` / `"engagement"` | `"relevance"` |
| `templateVersion` | string | maps to assets/ files | `"v1"` |

### Config Location & Loading

Path: `{homedir}/.hn-digest/config.json`. The skill directory is read-only.

- File missing → create dir, write defaults, output "首次运行，已生成默认配置 {path}".
- Malformed JSON → output "config.json 格式错误，使用默认值", use defaults (do NOT overwrite user's file).
- Valid JSON → read, clamp out-of-range values, replace invalid fields with defaults (output "config.json 字段 {field} 值无效，使用默认值 {default}").

### Config Priority

CLI args > config.json > defaults. CLI flags map to config fields by name, except: `--with-original` → `fetchOriginalPost: true`. `maxFetchRetries` is config-file-only.

---

## Step 3: Check Cache

Path: `{homedir}/.hn-digest/cache/{postId}.json`. Valid hit → read, output "从缓存加载 postId: {postId}", skip to Step 5. Corrupted → output "缓存文件损坏，重新抓取", delete file, proceed to Step 4. Miss → proceed to Step 4.

---

## Step 4: Fetch & Cache Data

Try methods in order: Algolia → Firebase → Jina.

**Retries**: `maxFetchRetries` per method. 429 → wait 2s, retry same method. Empty comments = valid result. All methods 404 → output "帖子不存在或已被删除" → terminate.

For each method: output "正在获取数据... (使用 {Method} 方式)". On success → save to `{homedir}/.hn-digest/cache/{postId}.json` (create dir if missing), proceed to Step 5. On failure → output "抓取失败: {Method} - {reason}", try next.

| Method | Script | Notes |
|--------|--------|-------|
| Algolia | `bun {skill-dir}/scripts/algolia.ts {postId}` | Output is unified JSON. |
| Firebase | `bun {skill-dir}/scripts/firebase.ts {postId}` | Fetches to depth 5; filtering in Step 6. |
| Jina | `bun {skill-dir}/scripts/jina.ts {postId}` | Output is raw markdown; normalize manually (see below). |

**Jina normalization**: Parse markdown → extract title, author, comments → build unified JSON (each comment: `id`, `author`, `parentId: null`, `childIds: []`, `depth: 0`, `contentMarkdown`). Validate: `post.title` non-empty and `comments` array exists.

**`latestCommentAt`**: The unified JSON top level carries `latestCommentAt` — the ISO 8601 UTC timestamp of the newest comment, set by the fetch scripts. Step 8 renders it in the article as the discussion snapshot time. (Jina path: leave it `null`; the article then omits the timestamp line.)

All methods exhausted → output "所有抓取方式均失败: {methods + reasons}" → terminate.

---

## Step 5: Prepare Output & Validate

1. Generate `{slug}` from `post.title`: lowercase, strip punctuation and stop words (articles, prepositions, auxiliary verbs, conjunctions, pronouns, negation), take first 4 remaining words, join with hyphens. Example: "Can the stockmarket swallow Anthropic, SpaceX and OpenAI?" → `stockmarket-swallow-anthropic-spacex`.
2. Create `{outputDir}/{postId}-{slug}/` (fail → terminate silently).
3. Write unified JSON to `{outputDir}/{postId}-{slug}/01-raw-data.json` (fail → terminate silently).
4. If `config.fetchOriginalPost === true` and `post.url` exists: fetch via Jina (`https://r.jina.ai/{post.url}`, fallback `https://r.jinaai.cn/{post.url}`), extract first 3 paragraphs as background. On failure → output "原文抓取失败，将从评论推断背景".
5. If `comments` array is empty → output "该帖子暂无评论" → terminate.

---

## Step 6: Comment Filtering Pipeline

Apply in order:

1. **Depth**: Remove `depth > config.depth`. Recalculate each remaining comment's `childIds` to only include IDs still present.
2. **Activity**: Remove `childIds.length < config.minReplies` (using recalculated values).
3. **Quantity**: Sort by `childIds.length` desc, take top `config.maxComments`.
4. **OP**: Set `isOP: true` where `comment.author === post.author`, else `false`.

If 0 comments remain → output "过滤后无符合条件的评论" → terminate. Otherwise pass the filtered array to Step 7 (AI groups inline, no subagent).

---

## Step 7: Comment Grouping → 02-grouped.json

Read `{skill-dir}/assets/grouped-example-{config.templateVersion}.json` for output structure (fallback to highest version if missing). Section names follow `config.lang`.

1. **Nested grouping**: Group by `config.groupBy` dimensions in order (e.g., `["topic","stance"]` → first by topic, then by stance). Each comment in exactly ONE group. OP comments first within their group.
2. **sortGroupsBy**: `"relevance"` = rank by (total childIds.length, unique authors, OP presence) desc. `"engagement"` = rank by total childIds.length desc.
3. **Controversies**: Scan for opposing viewpoints → add to `controversies` with `topic` + `sides`.

**Overflow handling**: If >40 comments, batch into ~20, group each batch, merge by group name, deduplicate `commentIds`.

Write to `{outputDir}/{postId}-{slug}/02-grouped.json`.

---

## Step 8: Article Generation (Generate-Evaluate Loop)

Max 3 rounds. Passing threshold: Overall Score >= 8.0.

### Loop Procedure

Each round:

1. Generate (round 1) or revise (rounds 2-3) the article using template from `{skill-dir}/assets/article-{templateVersion}.md`, grouped data, post metadata, filtered comments, and original post content (if fetched).
2. Write to `{outputDir}/{postId}-{slug}/article-draft-round{N}.md`.
3. Dispatch evaluation subagent with prompt from `{skill-dir}/references/evaluate-article-prompt.md`. Subagent reads: draft + `01-raw-data.json` + `02-grouped.json`. Writes: `evaluation-article-round{N}.md`.
4. Overall Score >= 8.0 → PASS → copy draft to `03-article.md` → Step 9. Score < 8.0 → track as best candidate → next round.

All rounds exhausted → copy best-scoring draft to `03-article.md`, output "文章质量评分: {bestScore}/10".

### Generation Rules

1. **Language**: Entire article in `config.lang`. H1 title must be `[Hacker News] {post.title}`.
2. **OP highlight** (critical): `isOP === true` → prefix `> **[OP]** `, placed first in group.
3. **Background**: Use fetched original content if available; otherwise infer from title + comments.
4. **References**: Append `## 参考资料`/`## References` with HN link and original article link (if exists).
5. **Disclaimer** (critical): Preserve the `<small>` disclaimer line exactly as-is. Do NOT reword, move, or remove.
6. **Timestamp**: Immediately after the disclaimer `<small>` line, add a `<small>` line with the discussion snapshot time = `01-raw-data.json` top-level `latestCommentAt`. zh: `讨论截至：{latestCommentAt}`; en: `Discussion as of: {latestCommentAt}`. If `latestCommentAt` is null, omit the line.
7. Overwrite existing `03-article.md` (output "正在覆盖已有输出" if overwriting).

---

## Step 9: AI Tone Check

Max 5 rounds. Pass condition: no AI tone issues remain.

1. Dispatch evaluation subagent with prompt from `{skill-dir}/references/evaluate-ai-tone-prompt.md`. Reads `03-article.md`, writes `evaluation-ai-tone-round{N}.md`.
2. Verdict "NO ISSUES REMAIN" → PASS → Step 10. "ISSUES FOUND" → apply fixes, overwrite `03-article.md`, next round.

All 5 rounds exhausted → keep article, output "部分AI语气问题可能残留".

---

## Step 10: Translationese Check (Conditional)

**Skip** when article language matches source comment language (sample first 10 filtered comments to determine). Otherwise execute single pass:

1. Dispatch evaluation subagent with prompt from `{skill-dir}/references/evaluate-translationese-prompt.md`. Reads `03-article.md`, writes `evaluation-translationese.md`.
2. If issues found → apply fixes, overwrite `03-article.md`.

Proceed to Step 11 regardless.

---

## Step 11: Readability Check + Reader Audit + Final Output

### 11.1 Readability Check

1. Dispatch evaluation subagent with prompt from `{skill-dir}/references/evaluate-readability-prompt.md`. Reads `03-article.md`, writes `evaluation-readability.md`.
2. If issues found → apply fixes, overwrite `03-article.md`.

### 11.2 Reader Audit (max 3 rounds)

Cold readers — who see ONLY `03-article.md`, never the raw comments or grouped data — read it sentence by sentence and report where they get stuck. They report **phenomena only, never fixes**. You then act as editor with full context to resolve every **blocking** comprehension problem. The loop ends when no reader reports a blocking problem.

**Why article-only readers:** a real reader of the digest has no original thread. Giving readers the raw/grouped data lets them fill gaps from memory and miss the gaps a real reader hits. You, the editor, get full context (`01-raw-data.json` + `02-grouped.json`) so you can fix correctly — this reader/editor asymmetry is the core of the step.

**Distinguishing blocking vs look-up-able:** readers separate blocking problems (the article's own ungrounded concepts) from look-up-able domain vocabulary (tool names, jargon any reader of the topic would look up). Only blocking problems converge the loop; look-up-able terms are expected in a specialist digest and are ignored here.

**Loop procedure:**
1. **Each round N (1..3)**:
   - Spawn **3 cold readers in parallel**, each a subagent with `{skill-dir}/references/evaluate-reader-audit-prompt.md` and a distinct profile. Each receives ONLY `03-article.md`. Profiles follow `config.lang`:
     - zh: `普通读者` / `略读读者` / `门外汉`
     - en: `casual-reader` / `skim-reader` / `non-native`
   - Save each report to `{outputDir}/{postId}-{slug}/evaluation-reader-audit-round{N}-{profile}.md`.
   - **Aggregate:** collect and dedupe all **blocking** phenomena across the 3 reports (ignore look-up-able domain terms).
   - No reader reports a blocking problem → **PASS** → proceed to 11.3.
   - Otherwise: act as **editor**. For each blocking phenomenon, decide and apply a fix using full context — current `03-article.md` + `01-raw-data.json` + `02-grouped.json`. Overwrite `03-article.md`. Next round.
2. **Rounds exhausted (3 rounds)**: keep `03-article.md`, output "部分读者体验问题可能残留".

**Boundary:** readers report comprehension problems only. AI-tone/style are handled in Step 9; readability mechanics in 11.1. Do not let this step duplicate those.

### 11.3 Final Output

1. Copy `03-article.md` to `{outputDir}/{postId}-{slug}/final-{slug}-{postId}.md` (overwrite if exists).
2. Do NOT clean up intermediate files.

---

## Step 12: Recommendation Summaries

Read `{outputDir}/{postId}-{slug}/03-article.md` as sole content source. Read `{skill-dir}/assets/recommendation-{config.templateVersion}.md` for style definitions (fallback to highest version if missing).

Generate 11 summaries (5 styles × 2 variants + 1 TL;DR): Technical, Viral, Lively, News, Podcast (each ~100字/words + ~200字/words), plus TL;DR (30–50字/words). No evaluation subagent.

**Rules**: Output in `config.lang`. Character counts: zh = Chinese characters (excluding punctuation/spaces), en = English words. Each style must be genuinely distinct. Each summary self-contained. Stay within ±10% of target. Add a `<small>` timestamp line right after the H1 (zh `讨论截至：{latestCommentAt}` / en `Discussion as of: {latestCommentAt}`) from `01-raw-data.json`'s `latestCommentAt`; omit if null.

Write to `{outputDir}/{postId}-{slug}/recommendation-{slug}-{postId}.md`.

**Terminal output**:
1. "输出文件:" + all output file paths.
2. 3–5 sentence article summary in `config.lang`.
