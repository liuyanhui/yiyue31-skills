# Error Handling Reference

This document consolidates all error handling logic for the hn-digest skill. It cross-references step-level descriptions in `SKILL.md` and provides a single decision table for quick lookup.

## Retry Architecture

`config.maxFetchRetries` (default 3) is a **per-method** attempt cap. Each fetch method (Algolia, Firebase, Jina) may be tried up to this many times before falling through to the next method. With 3 methods and `maxFetchRetries=3`, the worst case is 9 total HTTP calls.

429 retries consume the per-method budget (same as any other retry). A 429 on Algolia attempt 2 means Algolia has 1 attempt left before falling through to Firebase.

## Consolidated Error Decision Table

| Error Type | Action | Counts toward per-method retry? | Terminal message |
|------------|--------|----------------------------------|-----------------|
| Network timeout | Try next method | Yes | "抓取失败: {method} - timeout" / "Fetch failed: {method} - timeout" |
| 404 / not found | Try next method | Yes | "抓取失败: {method} - not found" / "Fetch failed: {method} - not found" |
| 429 rate limit | Wait 2s, retry same method | Yes | (silent retry; no message on retry) |
| Malformed response | Try next method | Yes | "抓取失败: {method} - malformed response" / "Fetch failed: {method} - malformed response" |
| All methods 404 | Terminate | — | "帖子不存在或已被删除" / "Post does not exist or has been deleted" |
| All methods fail | Terminate | — | "所有抓取方式均失败: {methods + reasons}" / "All fetch methods failed: {methods + reasons}" |
| Corrupted cache | Delete, re-fetch | No | "缓存文件损坏，重新抓取" / "Cache file corrupted, re-fetching" |
| Malformed config JSON | Use built-in defaults | No | "config.json 格式错误，使用默认值" / "config.json format error, using defaults" |
| Invalid config field | Clamp / use default for field | No | "config.json 字段 {field} 值无效，使用默认值 {default}" / "config.json field {field} invalid, using default {default}" |
| Cannot create outputDir | Terminate | — | (system error, terminate immediately) |
| Cannot write output file | Terminate | — | (system error, terminate immediately) |
| Empty comments array | Not an error — proceed | No | (none) |

## Language Rule

All terminal messages use the language matching `config.lang`:
- **`lang: "zh"`** — Chinese variant (first in each table cell)
- **`lang: "en"`** — English variant (after the slash)

When a fetch method fails and another method is tried, the failure message is printed immediately (before the next method begins). This gives the user real-time visibility into the fallback chain.

For the full ordered catalog of every terminal message the skill can output, see `terminal-messages.md`.
