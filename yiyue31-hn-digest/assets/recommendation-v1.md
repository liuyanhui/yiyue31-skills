<!--
Quality constraints for recommendation generation:
- Each summary must be based ONLY on the content of the final article (03-article.md).
  Do not fabricate or add information not present in the article.
- Character count constraints (for zh): count Chinese characters only (exclude punctuation,
  spaces, and Latin characters from the count). Approximate +/- 10% tolerance.
- Word count constraints (for en): count English words. Approximate +/- 10% tolerance.
- Language follows config.lang.
- Each style must be distinctly different in tone and structure, not just a rephrase of the same sentences.
- No markdown formatting within summary text (no bold, no links, no headings, no bullet points).
- Each summary must be self-contained and understandable without having read the full article.
- Timestamp: immediately AFTER the H1 (and before any summary section), add a `<small>` line:
  zh → `<small>讨论截至：{latestCommentAt}</small>`   en → `<small>Discussion as of: {latestCommentAt}</small>`
  Value = 01-raw-data.json top-level `latestCommentAt`. Omit the line if null. (This line is outside the summaries, so the "no markdown in summary text" rule still holds.)

Section names by language:
  zh → en
  技术风格 → Technical
  爆款文章风格 → Viral
  活泼风格 → Lively
  新闻风格 → News
  播客口播风格 → Podcast
  极简一句话 → TL;DR
-->

# 推荐摘要 / Recommendation Summaries

<small>讨论截至：{latestCommentAt}</small>

## 技术风格 / Technical

Tone: Objective, precise, structured. Use domain terminology naturally.
Audience: Engineers, researchers, technical professionals.
Techniques: Lead with the core technical insight; use precise cause-effect statements.

Short (~100字/words):
{summary}

Long (~200字/words):
{summary}

## 爆款文章风格 / Viral

Tone: Attention-grabbing hook, emotionally charged, uses curiosity gaps.
Audience: Social media scrollers, general readers.
Techniques: Rhetorical questions, surprising contrasts, "did you know" framing, provocative opening.

Short (~100字/words):
{summary}

Long (~200字/words):
{summary}

## 活泼风格 / Lively

Tone: Conversational, colloquial, occasional humor, like chatting with a friend.
Audience: Readers looking for an easy, entertaining summary.
Techniques: Analogies, rhetorical questions, conversational connectors ("话说回来...", "有意思的是...").

Short (~100字/words):
{summary}

Long (~200字/words):
{summary}

## 新闻风格 / News

Tone: Formal, factual, inverted pyramid structure (most important first).
Audience: News readers expecting a factual briefing.
Techniques: Lead with the key takeaway, follow with context and implications.

Short (~100字/words):
{summary}

Long (~200字/words):
{summary}

## 播客口播风格 / Podcast

Tone: Spoken-word feel, uses conversational filler phrases naturally, addresses the listener directly.
Audience: Audio content consumers.
Techniques: "你知道吗...", "说起来...", direct listener address ("你想想"), conversational transitions, short sentences for rhythm.

Short (~100字/words):
{summary}

Long (~200字/words):
{summary}

## 极简一句话 / TL;DR

Tone: Maximum information density in minimum characters.
Length: Fixed 30-50字/words. Only ONE version.
Constraint: Must capture the single most important takeaway or the most counter-intuitive conclusion from the discussion.

{summary}
