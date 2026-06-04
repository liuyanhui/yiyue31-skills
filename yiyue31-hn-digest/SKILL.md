---
name: yiyue31-hn-digest
description: "当用户要求总结、提炼、Digest 一个 Hacker News (HN) 讨论帖时启用。用户提供 HN 帖子 URL 或 ID，希望快速了解评论核心观点、争论焦点、各方立场时启用。英文触发表达包括：summarize/digest/break down/analyze this HN thread, what are people saying/what is the consensus/key takeaways from this HN post, tldr/TLDR this HN thread, Hacker News discussion summary, HN post analysis, 以及其他语义等价的变体。不用于：通用摘要、新闻翻译、单纯抓取网页。"
version: 0.0.2
author: yiyue31
---

# yiyue31-hn-digest Skill

You are the yiyue31-hn-digest skill. You transform a Hacker News discussion thread into a structured article.

`{skill-dir}` = this SKILL.md's directory path.

Follow the steps below precisely, in order.

### Language Rule for Terminal Messages

All terminal messages output by this skill must match `config.lang`. The message text shown in each step below uses Chinese by convention; when `config.lang` is `"en"`, use the English variant documented in `{skill-dir}/references/terminal-messages.md`.

---

For consolidated error handling rules and the full terminal message catalog, see:
- `{skill-dir}/references/error-handling.md` — error decision table, retry strategy
- `{skill-dir}/references/terminal-messages.md` — every message the skill can output, in execution order

---

## Subagent Architecture

This skill uses a **main agent + evaluation subagent** architecture.

### Roles

| Role | Responsibilities |
|------|-----------------|
| **Main agent** (you) | Executes all steps: parsing, configuration, fetching, filtering, grouping, article generation, article revision, and applying quality fixes based on evaluation feedback. |
| **Evaluation subagent** | Independently evaluates article quality, AI tone, translationese, and readability. Reads the article and writes an evaluation report. **Must NOT modify the article or any other content file.** |

### Why evaluation subagent only

The evaluation subagent provides an **independent quality assessment** — it sees the article fresh without the generation bias. Keeping evaluation separate from generation/fixing ensures the evaluator focuses purely on finding problems, not on how to solve them.

The main agent applies fixes itself because it retains full context (why it wrote things a certain way) and can make more informed revisions than a separate generation subagent that only sees the evaluation report.

### Evaluation subagent dispatch

When dispatching an evaluation subagent, pass:
- The article file path for it to read.
- The evaluation prompt file path from `{skill-dir}/references/`.
- The output evaluation report file path for it to write to.

The evaluation subagent must not modify any file except the evaluation report it writes.

---

## Step 1: Parse Input

The user provides a Hacker News thread reference. Expect either:

- A full URL: `https://news.ycombinator.com/item?id=12345678`
- A plain post ID: `12345678`

Procedure:

1. Extract the argument from the user's message.
2. If it's a URL, extract the `id` query parameter.
3. If it's a plain number, use it directly.
4. Invalid input → terminal output: "Invalid postId" → terminate.

## Step 1.5: Generate Slug

Generate a URL-safe slug from the post title for the human-readable final filename.

### Slug Rules

1. Lowercase the title.
2. Remove all punctuation.
3. Remove English stop words: `a`, `an`, `the`, `is`, `are`, `was`, `were`, `can`, `could`, `will`, `would`, `of`, `in`, `on`, `at`, `to`, `for`, `and`, `or`, `but`, `with`, `by`, `from`, `not`, `no`, `do`, `does`, `did`, `has`, `have`, `had`, `it`, `its`, `this`, `that`, `these`, `those`.
4. Take the first 4 remaining words.
5. Join with hyphens.

Example: "Can the stockmarket swallow Anthropic, SpaceX and OpenAI?" → remove punctuation → "can the stockmarket swallow anthropic spacex and openai" → remove stop words → "stockmarket swallow anthropic spacex openai" → first 4 → `stockmarket-swallow-anthropic-spacex`.

Store as `{slug}` for use in Step 11 final output.

---

## Step 2: Load Configuration

### Config Schema

The table below defines all config fields, constraints, and built-in defaults (used when no config file exists or a field is missing/invalid).

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

### Config Location

The config file lives in the user's home directory — NOT inside the skill directory. This keeps user runtime state separate from skill assets, so skill upgrades never overwrite user preferences.

- Path: `~/.hn-digest/config.json`
- Resolve `~` via `os.homedir()` (Node) or the equivalent in your execution environment.
- The skill directory itself is treated as read-only.

### Config Loading Procedure

1. Resolve the config path to `{homedir}/.hn-digest/config.json`.
2. Check if the file exists.
3. If NOT exists:
   - Create the `.hn-digest/` directory under `{homedir}` if missing (`ensureDir`).
   - Generate the default config from the table above.
   - Write it to `{homedir}/.hn-digest/config.json`.
   - Terminal output: "首次运行，已生成默认配置 {path}" (where `{path}` is the resolved absolute path).
4. If exists but contains malformed JSON:
   - Terminal output: "config.json 格式错误，使用默认值"
   - Use built-in defaults (ignore the file entirely). Do NOT delete or overwrite the user's file.
5. If exists and valid JSON:
   - Read the config.
   - Clamp any out-of-range values to valid bounds.
   - For invalid field values, use defaults for those fields and terminal output: "config.json 字段 {field} 值无效，使用默认值 {default}"

### Config Merge Priority

```
CLI arguments > config.json > built-in defaults
```

CLI argument mapping:
| CLI flag | Config field |
|----------|-------------|
| `--depth N` | `depth` |
| `--minReplies N` | `minReplies` |
| `--maxComments N` | `maxComments` |
| `--lang zh\|en` | `lang` |
| `--outputDir path` | `outputDir` |
| `--with-original` | `fetchOriginalPost: true` |
| `--groupBy val` | `groupBy` (comma-separated) |
| `--sort-groups val` | `sortGroupsBy` |
| `--templateVersion val` | `templateVersion` |

`maxFetchRetries` is config-file-only (no CLI flag).

## Step 3: Check Cache

Cache location: `~/.hn-digest/cache/{postId}.json` (under the user's home directory, alongside config). The cache directory is created on first write via `ensureDir`.

1. Resolve the cache path to `{homedir}/.hn-digest/cache/{postId}.json`.
2. Check if the file exists.
3. **Cache hit + valid JSON**: read the cached data. Skip to Step 5 (Write 01-raw-data.json).
   - Terminal output: "从缓存加载 postId: {postId}"
4. **Cache hit + invalid JSON**: the file exists but is not valid JSON.
   - Terminal output: "缓存文件损坏，重新抓取"
   - Delete the corrupted cache file.
   - Proceed to Step 4 (Fetch).
5. **Cache miss**: file does not exist. Proceed to Step 4 (Fetch).

## Step 4: Fetch Data

Attempt fetching in priority order: Algolia → Firebase → Jina.

### Retry Rules

- `config.maxFetchRetries` (default 3) is the **per-method** attempt cap. Each method (Algolia, Firebase, Jina) may be tried up to `maxFetchRetries` times before falling through to the next.
- On failure, fall through to the next method in priority order. With all 3 methods, worst case = `maxFetchRetries × 3` total HTTP calls.
- Empty comments array is NOT an error — proceed normally with 0 comments.

For the full error-type-to-action decision table (timeout, 404, 429, malformed response, etc.), see `{skill-dir}/references/error-handling.md`.

### Fetch Methods (in order)

At this point, `{postId}` is guaranteed to be a numeric string extracted by Step 1.

#### Method 1: Algolia

```
bun {skill-dir}/scripts/algolia.ts {postId}
```

- Terminal output before fetch: "正在获取数据... (使用 Algolia 方式)"
- On success: parse stdout as JSON. Proceed to Step 4.1 (Save Cache).
- On failure: terminal output "抓取失败: Algolia - {reason}". Try next method.

#### Method 2: Firebase

```
bun {skill-dir}/scripts/firebase.ts {postId}
```

- Terminal output before fetch: "正在获取数据... (使用 Firebase 方式)"
- Note: Firebase script fetches up to depth 5 regardless of `config.depth`. Depth filtering happens in Step 6.1.
- On success: parse stdout as JSON. Proceed to Step 4.1 (Save Cache).
- On failure: terminal output "抓取失败: Firebase - {reason}". Try next method.

#### Method 3: Jina

```
bun {skill-dir}/scripts/jina.ts {postId}
```

- Terminal output before fetch: "正在获取数据... (使用 Jina 方式)"
- On success: the output is raw markdown text, NOT unified JSON. AI must normalize it:
  1. Parse the markdown to extract post title, author, and comments.
  2. Build the unified JSON structure manually (each comment gets `id`, `author`, `parentId: null`, `childIds: []`, `depth: 0`, `contentMarkdown`).
  3. **Validate after normalization**: `post.title` must be non-empty and `comments` array must exist. If validation fails, treat as fetch failure.
- On failure: terminal output "抓取失败: Jina - {reason}".

### All Methods Exhausted

If all methods have exhausted their per-method retry budget and none succeeded:
- Terminal output: "所有抓取方式均失败:" followed by each attempted method and its failure reason.
- Terminate. Do NOT generate any output files.

### Step 4.1: Save Cache

After a successful fetch (and Jina normalization if applicable):
1. Resolve the cache path to `{homedir}/.hn-digest/cache/{postId}.json`.
2. Create the `.hn-digest/cache/` directory under `{homedir}` if missing (`ensureDir`).
3. Write the unified JSON to that path.
4. Proceed to Step 5 (which chains to Step 5A and Step 5B before Step 6).

## Step 5: Write 01-raw-data.json

1. Create the output directory `{outputDir}/{postId}/` if it does not exist.
   - If directory creation fails (invalid path, permission denied): terminate immediately. No terminal message — system error.
2. Write the unified JSON data (from cache or fresh fetch) to `{outputDir}/{postId}/01-raw-data.json`.
   - If the write fails: terminate immediately. No terminal message — system error.
3. Proceed to Step 5A (Original Post Fetch, if enabled).

---

## Step 5A: Original Post Fetching (Conditional)

This step only executes when `config.fetchOriginalPost === true`. Skip entirely if false.

### When Enabled

1. Check if the post has an external URL (`post.url` is non-null).
2. If the post has no URL (text-only post): skip this step. Article generation will infer background from title + comments.
3. If the post has a URL, use Jina Reader to fetch the original article content:
   - Primary URL: `https://r.jina.ai/{post.url}`
   - Fallback URL: `https://r.jinaai.cn/{post.url}` (use if primary fails)
   - Fetch via the web-access skill, or using `fetchWithTimeout` (from `{skill-dir}/scripts/lib/utils.ts`) with a 30-second timeout. (Note: the Jina fetch script in Step 4 uses a 60-second timeout since it fetches the full thread; here we only need the article body, so 30s suffices.)
4. Extract the first 3 paragraphs (or first ~500 tokens) as background context.
5. Pass this content to the article generation step as "original content" for the background section.

### Failure Handling

- If the Jina fetch fails (either URL): terminal output "原文抓取失败，将从评论推断背景".
- Continue execution. The article generation step will infer background from the post title and comments instead.

---

## Step 5B: Post-0 Comments Check

After obtaining the unified data but before filtering:
- If `comments` array is empty (0 comments): terminal output "该帖子暂无评论". Terminate. Only `01-raw-data.json` is output (written by Step 5); no further files are generated.

---

## Step 6: Comment Filtering Pipeline

Process the unified JSON comments through the following pipeline, applying each step in order.

### Step 6.1: Depth Truncation

Remove all comments where `depth > config.depth`.

**After removal**, recalculate `childIds` counts based on the remaining comments only. This means:
1. Collect the IDs of all remaining comments.
2. For each remaining comment, recompute `childIds` by filtering the comment's original `childIds` to only include IDs that are still in the remaining set.
3. The `childIds.length` values used in subsequent steps (activity filter, quantity cap) must be based on these recalculated counts.

### Step 6.2: Activity Filter

Remove comments where `childIds.length < config.minReplies`.

Use the recalculated `childIds` from Step 6.1 (not the original values).

### Step 6.3: Quantity Cap

Sort the remaining comments by `childIds.length` in descending order. Take only the top `config.maxComments` comments.

### Step 6.4: OP (Original Poster) Identification

For each remaining comment, check if `comment.author === post.author`:
- If yes, set `isOP: true` on that comment.
- If no, set `isOP: false`.

OP comments will be highlighted in the article generation phase.

### Edge Cases

1. **0 comments after filtering**: terminal output "过滤后无符合条件的评论". Terminate. No output files generated (except 01-raw-data.json which was already written).

### Output

The result is a filtered comment array (kept in memory). This array, along with `config.groupBy`, `config.sortGroupsBy`, and the post metadata, is passed directly to Step 7 — AI performs grouping inline using these inputs (no subagent needed for this step).

---

## Step 7: Comment Grouping → 02-grouped.json

### Template Loading

1. Determine template version from `config.templateVersion` (default: `"v1"`).
2. Resolution: read `{skill-dir}/assets/grouped-example-{templateVersion}.json` for the output structure example. Your output must follow this structure.
3. If the specified version file does not exist:
   - Terminal output: "模板版本 {version} 不存在，使用最新版本"
   - Find the highest numbered version available in `{skill-dir}/assets/` and use that.
4. **Section names follow `config.lang`**: the article template (`article-v1.md`) shows Chinese section names by default (背景, 核心观点, 争议点, 总结). When `config.lang` is `"en"`, use English equivalents: Background, Core Viewpoints, Controversies, Summary.

### Grouping Procedure

Input: filtered comments + `config.groupBy` + `config.sortGroupsBy` + the loaded schema template.

1. **Read the example file** to understand the exact output structure. Your output must follow this format.

2. **Nested grouping**: Group by `config.groupBy` dimensions in order.
   - Example: `["topic", "stance"]` = first group by topic, then within each topic group by stance.
   - Each comment appears in exactly ONE group (the most relevant one, as determined by AI).
   - OP comments (`isOP: true`) are placed FIRST within their group.
   - **Topic examples**: group by the discussion theme — e.g., "performance", "security", "pricing", "UX", "alternatives". Topic names should reflect the actual discussion content, not generic labels.
   - **Stance examples**: "support", "oppose", "nuanced/mixed", "questioning". Stance reflects the commenter's position toward the topic.

3. **Single-value groupBy**: When `config.groupBy` has only one value (e.g., `["stance"]`), `subGroups` is an empty array `[]` for each group. No nesting.

4. **Dimension consistency**: Each group's `dimension` field must match the first value in `config.groupBy`. Each subGroup's `dimension` field must match the second value in `config.groupBy`.

5. **sortGroupsBy implementation**:
   - `"relevance"`: Order groups by: (1) total `childIds.length` of member comments, (2) number of unique authors in the group, (3) presence of OP comments. Higher values rank first.
   - `"engagement"`: Sort groups by total `childIds.length` of member comments (sum across all comments in the group), descending.

6. **Controversy detection**: Scan across groups for opposing viewpoints on the same topic. If found, add entries to the `controversies` array with `topic` and `sides` (each side has `stance` and `summary`).

### Context Window Overflow Handling

If the filtered comments exceed 40 comments:
1. Split into batches of approximately 20 comments each (in array order).
2. Process each batch to produce a partial grouping result (same grouping instructions apply).
3. Merge batches: combine groups with the same name, deduplicate `commentIds`.
4. Produce a single final `02-grouped.json` output.

### Output

Write the grouping result to `{outputDir}/{postId}/02-grouped.json`.

The output must follow the structure shown in `{skill-dir}/assets/grouped-example-{templateVersion}.json`.

---

## Step 8: Article Generation (Generate-Evaluate Loop)

This step uses a generate-evaluate loop for quality assurance. The main agent generates and revises the article; an evaluation subagent provides independent quality assessment.

### Loop Parameters

- **Max rounds**: 3
- **Passing threshold**: overall score >= 8.0 (out of 10)

### Loop Procedure (Each Round)

**Round 1 — Initial Generation:**

1. Generate the article. Read `{skill-dir}/assets/article-{templateVersion}.md` for the article template structure. Use `{outputDir}/{postId}/02-grouped.json`, post metadata, filtered comments, and (if fetched) original post content as input.
2. Write the article to `{outputDir}/{postId}/article-draft-round1.md`.
3. Dispatch an **evaluation subagent** with the prompt from `{skill-dir}/references/evaluate-article-prompt.md`.
   - The subagent reads: the article draft, original comments (`01-raw-data.json`), and `{outputDir}/{postId}/02-grouped.json`.
   - The subagent writes: `{outputDir}/{postId}/evaluation-article-round1.md`.
4. Read the evaluation report's **Overall Score** line. Score >= 8.0 → PASS → copy draft to `{outputDir}/{postId}/03-article.md` → Step 9. Score < 8.0 → FAIL → track as best candidate → next round.

**Rounds 2–3 — Revision:**

1. Revise the article based on the previous round's evaluation report (improvement suggestions). Apply the fixes yourself, using your full context of why the article was written a certain way.
2. Write the revised article to `{outputDir}/{postId}/article-draft-round{N}.md`.
3. Dispatch an evaluation subagent (same pattern as Round 1).
   - Output: `{outputDir}/{postId}/evaluation-article-round{N}.md`.
4. Read the Overall Score. Score >= 8.0 → PASS → copy to 03-article.md → Step 9. Score < 8.0 → FAIL → track best candidate → next round.

### Rounds Exhausted

If all 3 rounds complete without a PASS:
- Copy the best-scoring round's draft to `{outputDir}/{postId}/03-article.md`.
- Terminal output: "文章质量评分: {bestScore}/10"

### Generation Rules

1. **Background section**:
   - If original post content was fetched and passed as input, include it as background.
   - Otherwise, infer background from the post title and comments.

2. **OP highlight rules** (critical):
   - Any comment where `isOP === true` must be rendered with the prefix: `> **[OP]** `
   - OP comments must be placed FIRST within their group/section.

3. **Language**: Use `config.lang` (zh/en). The entire article must be in the configured language.

4. **References section**: Append a `## 参考资料` (zh) / `## References` (en) section at the end of the article, after the Summary section. Include:
   - HN discussion link: `https://news.ycombinator.com/item?id={postId}` (always)
   - Original article link: `post.url` (if the post has an external URL)
   - Format as markdown links.

5. **Overwrite warning**: If `{outputDir}/{postId}/03-article.md` already exists, overwrite it and terminal output: "正在覆盖已有输出"

6. **Disclaimer protection** (critical): The article begins with a `<small>` disclaimer line (AI-generated notice) placed between the title and the first section heading. This line must be preserved exactly as-is throughout all generation and quality fix steps. Do NOT reword, move, remove, or "optimize" it. This line is metadata, not article content.

---

## Step 9: AI Tone Check

This step detects and fixes AI-generated writing artifacts in the article.

### Loop Parameters

- **Max rounds**: 5
- **Pass condition**: no AI tone issues remain (binary pass/fail)

### Loop Procedure (Each Round)

1. Dispatch an **evaluation subagent** with the prompt from `{skill-dir}/references/evaluate-ai-tone-prompt.md`.
   - The subagent reads: `{outputDir}/{postId}/03-article.md`.
   - The subagent writes: `{outputDir}/{postId}/evaluation-ai-tone-round{N}.md`.
   - The subagent does NOT modify the article.

2. Read the report's **Verdict** line.
   - "NO ISSUES REMAIN" → PASS → proceed to Step 10 (Translationese Check).
   - "ISSUES FOUND" → FAIL → apply the suggested fixes to the article yourself → next round.

3. After applying fixes, write the updated article to `{outputDir}/{postId}/03-article.md` (overwrite).

### Rounds Exhausted (5)

If all 5 rounds complete without a clean pass:
- Keep the current article as-is.
- Terminal output: "部分AI语气问题可能残留"

---

## Step 10: Translationese Check (Conditional)

This step is **conditionally skipped** based on language matching.

### Condition Check

Before executing this step, determine the dominant language of the source comments:
1. Sample the first 10 comments from the filtered set.
2. Determine whether the majority are in Chinese (zh) or English (en).
3. Compare with `config.lang`.

**Skip this step entirely** when:
- `config.lang` is `"zh"` AND most comments are in Chinese.
- `config.lang` is `"en"` AND most comments are in English.

**Execute this step** when the article language differs from the source comment language (e.g., Chinese comments being summarized in English, or English comments being summarized in Chinese).

### Execution (Single Pass, No Loop)

1. Dispatch an **evaluation subagent** with the prompt from `{skill-dir}/references/evaluate-translationese-prompt.md`.
   - The subagent reads: `{outputDir}/{postId}/03-article.md`.
   - The subagent writes: `{outputDir}/{postId}/evaluation-translationese.md`.
   - The subagent does NOT modify the article.

2. Read the report's **Summary** line. If issues were found, apply the suggested fixes to the article yourself.

3. Write the updated article to `{outputDir}/{postId}/03-article.md` (overwrite).

4. Proceed to Step 11 regardless of findings (single pass, no retry loop).

---

## Step 11: Readability Check + Final Output

### Readability Check (Single Pass)

1. Dispatch an **evaluation subagent** with the prompt from `{skill-dir}/references/evaluate-readability-prompt.md`.
   - The subagent reads: `{outputDir}/{postId}/03-article.md`.
   - The subagent writes: `{outputDir}/{postId}/evaluation-readability.md`.
   - The subagent does NOT modify the article.

2. Read the report's **Summary** line. If issues were found, apply the suggested fixes to the article yourself.

3. Write the updated article to `{outputDir}/{postId}/03-article.md` (overwrite).

4. Proceed to final output regardless (single pass, no loop).

### Final Output

1. **Verify final article** at `{outputDir}/{postId}/03-article.md`.
   - This file was written by Step 8 and subsequently modified by the main agent in Steps 9–11. Verify it exists.

2. **Generate human-readable final copy**: copy `{outputDir}/{postId}/03-article.md` to `{outputDir}/{postId}/final-{slug}-{postId}.md`.
   - `{slug}` was generated in Step 1.5.
   - This file is an identical copy of `03-article.md` with a descriptive filename for easy sharing.
   - If the file already exists, overwrite it.

3. **Do NOT clean up intermediate files.** All files are preserved for observability:
   - `article-draft-round{N}.md` — per-round drafts from the generate-evaluate loop.
   - `evaluation-article-round{N}.md` — per-round evaluation reports.
   - `evaluation-ai-tone-round{N}.md` — AI tone check reports.
   - `evaluation-translationese.md` — translationese check report (if executed).
   - `evaluation-readability.md` — readability check report.

4. **Terminal output** (in this order):
   - "输出文件:" followed by the paths of all output files:
     - `{outputDir}/{postId}/01-raw-data.json`
     - `{outputDir}/{postId}/02-grouped.json`
     - `{outputDir}/{postId}/03-article.md`
     - `{outputDir}/{postId}/final-{slug}-{postId}.md`
   - Article summary: 3–5 sentences summarizing the article content, written in `config.lang`.

---

## References Index

Read these on demand — do not load all at once.

| File | When to read |
|------|--------------|
| `{skill-dir}/references/error-handling.md` | Consolidated error decision table; cross-references to step-level error descriptions. Read when an unusual error occurs or when retry/fallback behavior is unclear. |
| `{skill-dir}/references/terminal-messages.md` | Full catalog of every terminal message the skill can output, in execution order, with trigger conditions and language-aware variants. Read when verifying message wording or adding a new message. |
| `{skill-dir}/references/evaluate-article-prompt.md` | Used by Step 8 evaluation subagent. |
| `{skill-dir}/references/evaluate-ai-tone-prompt.md` | Used by Step 9 evaluation subagent. |
| `{skill-dir}/references/evaluate-translationese-prompt.md` | Used by Step 10 evaluation subagent. |
| `{skill-dir}/references/evaluate-readability-prompt.md` | Used by Step 11 evaluation subagent. |

---
