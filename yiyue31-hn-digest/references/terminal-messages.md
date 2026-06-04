# Terminal Output Messages Reference

This document lists every terminal message the hn-digest skill can produce, in execution order. Each entry specifies the trigger condition, message type, and language-aware variants.

## Language Rule

All terminal messages use the language matching `config.lang`:
- **`lang: "zh"`** — Chinese variant
- **`lang: "en"`** — English variant

When the skill text below shows only one variant, the AI selects the appropriate one based on `config.lang`.

## Message Catalog (Execution Order)

### 1. "Invalid postId"

- **Trigger:** User input is neither a valid HN URL nor a numeric ID (Step 1).
- **Type:** Error
- **Language-aware:** zh: "无效的帖子ID" / en: "Invalid postId"
- **Terminal:** Yes — execution terminates after this message.

### 2. "首次运行，已生成默认配置 {path}"

- **Trigger:** No config file exists and the default config is written (Step 2).
- **Type:** Progress
- **Language-aware:** zh: "首次运行，已生成默认配置 {path}" / en: "First run, default config generated: {path}"
- **`{path}` placeholder:** the resolved absolute path to the config file (e.g., `/home/user/.hn-digest/config.json` or `C:\Users\name\.hn-digest\config.json`).

### 3. "config.json 格式错误，使用默认值"

- **Trigger:** Config file exists but contains malformed JSON (Step 2).
- **Type:** Warning
- **Language-aware:** zh: "config.json 格式错误，使用默认值" / en: "config.json format error, using defaults"

### 4. "config.json 字段 {field} 值无效，使用默认值 {default}"

- **Trigger:** A config field value is out of range or invalid type (Step 2).
- **Type:** Warning
- **Language-aware:** zh: "config.json 字段 {field} 值无效，使用默认值 {default}" / en: "config.json field {field} invalid, using default {default}"

### 5. "从缓存加载 postId: {postId}"

- **Trigger:** Cache hit with valid JSON (Step 3).
- **Type:** Progress
- **Language-aware:** zh: "从缓存加载 postId: {postId}" / en: "Loaded from cache postId: {postId}"

### 6. "缓存文件损坏，重新抓取"

- **Trigger:** Cache file exists but is not valid JSON (Step 3).
- **Type:** Warning
- **Language-aware:** zh: "缓存文件损坏，重新抓取" / en: "Cache file corrupted, re-fetching"

### 7. "正在获取数据... (使用 {method} 方式)"

- **Trigger:** Before each fetch attempt (Algolia, Firebase, or Jina). Printed immediately before the fetch call.
- **Type:** Progress
- **Language-aware:** zh: "正在获取数据... (使用 Algolia 方式)" / en: "Fetching data... (using Algolia method)"
- **Can appear multiple times:** Yes — once per method attempted.

### 8. "抓取失败: {method} - {reason}"

- **Trigger:** A fetch method fails (timeout, 404, malformed response, etc.) in Step 4.
- **Type:** Error
- **Language-aware:** zh: "抓取失败: {method} - {reason}" / en: "Fetch failed: {method} - {reason}"
- **Can appear multiple times:** Yes — once per failed method.

### 9. "帖子不存在或已被删除"

- **Trigger:** All fetch methods returned 404 / not found (Step 4, All Methods Exhausted variant).
- **Type:** Error
- **Language-aware:** zh: "帖子不存在或已被删除" / en: "Post does not exist or has been deleted"
- **Terminal:** Yes — execution terminates after this message.

### 10. "所有抓取方式均失败: {methods + reasons}"

- **Trigger:** All fetch methods exhausted and retry limit reached (Step 4, All Methods Exhausted).
- **Type:** Error
- **Language-aware:** zh: "所有抓取方式均失败: Algolia(timeout), Firebase(not found), ..." / en: "All fetch methods failed: Algolia(timeout), Firebase(not found), ..."
- **Terminal:** Yes — execution terminates after this message.

### 11. "原文抓取失败，将从评论推断背景"

- **Trigger:** Jina Reader fails to fetch the original post content (Step 5A).
- **Type:** Warning
- **Language-aware:** zh: "原文抓取失败，将从评论推断背景" / en: "Original post fetch failed, will infer background from comments"

### 12. "该帖子暂无评论"

- **Trigger:** Comments array is empty after obtaining unified data (Step 5B).
- **Type:** Warning
- **Language-aware:** zh: "该帖子暂无评论" / en: "This post has no comments"
- **Terminal:** Yes — execution terminates after this message.

### 13. "过滤后无符合条件的评论"

- **Trigger:** Zero comments remain after the filtering pipeline (Step 6, Edge Cases).
- **Type:** Warning
- **Language-aware:** zh: "过滤后无符合条件的评论" / en: "No comments match the filter criteria"
- **Terminal:** Yes — execution terminates after this message.

### 14. "正在覆盖已有输出"

- **Trigger:** `{outputDir}/{postId}/03-article.md` already exists before writing (Step 8).
- **Type:** Warning
- **Language-aware:** zh: "正在覆盖已有输出" / en: "Overwriting existing output"

### 15. "文章质量评分: {bestScore}/10"

- **Trigger:** All 3 generate-evaluate rounds exhausted without a passing score (Step 8, Rounds Exhausted).
- **Type:** Warning
- **Language-aware:** zh: "文章质量评分: {bestScore}/10" / en: "Article quality score: {bestScore}/10"

### 16. "部分AI语气问题可能残留"

- **Trigger:** All 5 AI tone check rounds exhausted without a clean pass (Step 9, Rounds Exhausted).
- **Type:** Warning
- **Language-aware:** zh: "部分AI语气问题可能残留" / en: "Some AI tone issues may remain"

### 17. "输出文件:" + file paths

- **Trigger:** Final output step completed (Step 11).
- **Type:** Progress
- **Language-aware:** zh: "输出文件:" / en: "Output files:"
- **Followed by three paths:**
  - `{outputDir}/{postId}/01-raw-data.json`
  - `{outputDir}/{postId}/02-grouped.json`
  - `{outputDir}/{postId}/03-article.md`

### 18. Article summary (3–5 sentences)

- **Trigger:** Final output step completed, immediately after file paths (Step 11).
- **Type:** Progress
- **Language-aware:** Written in `config.lang`. This is generated content, not a fixed template string.

---

For the error decision table and retry/fallback logic, see `error-handling.md`.
