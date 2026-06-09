<!--
Quality constraints for article generation:
- Preserve ALL distinct viewpoints. Do not merge or discard differing opinions.
- After generating, self-check: are there any important viewpoints from the comments that were omitted?
- Write naturally. Vary punctuation (commas, colons, parentheses, separate sentences); avoid em dashes (—)
  for mid-sentence additions. No template openings/closings (e.g., "在当今快速发展的时代").
- When target language differs from comment source language, express ideas natively in the target language.
  Do not translate sentence-by-sentence. Restructure for natural flow.
- Only content from the provided comments. Do not fabricate or add external knowledge.
- Section names must follow config.lang: use the Chinese or English column below.

Citation rules:
- Do NOT use commenter usernames as attribution. Replace with generic references:
  "有评论者认为……""另一方指出……""支持方认为……""反对方则认为……"
- Only name a commenter when quoting their exact words AND the quote is a key insight worth preserving.
  Even then, prefix with context: "一位金融背景的评论者 augstein 引用 Hedgeye 分析称……"

Jargon rules:
- Financial/technical terms must be explained on first use with a brief parenthetical or appositive.
  Example: "S&P 500（标普500指数，大量基金跟踪它）""401k（美国个人退休账户）"
- If a term can be replaced with plain language without losing meaning, do that instead.

Paragraph rules:
- Each paragraph covers ONE idea or ONE angle. If a paragraph exceeds 5 sentences, split it.
- Between subsections (###), include a transition sentence explaining how the next topic relates to the previous one.

Background rules:
- Open with a sentence that connects the topic to the reader's interest or stakes.
  Example: "如果你有退休金账户，这些公司的上市可能直接影响你的投资。"
- Then provide context (what the post is about, why it matters).
- Keep background to 3-4 sentences (~100 words).
- If the article involves large numbers, provide a reference point. Example: "$965B 估值——接近瑞典全年 GDP"。

Controversy rules (conditional):
- If opposing viewpoints exist: identify the ROOT of the disagreement, not just "X says A, Y says B."
  Example: "分歧的本质在于：指数基金的职责到底是被动跟踪市场，还是保护被动投资者？"
- If the discussion is one-sided: state the consensus and note any dissenting nuances.

Sharp viewpoint rules:
- When a group's summary or a comment contains a sharp, counter-intuitive, or particularly
  insightful point, wrap it with **bold** in the article text.
  Example: "指数基金的本质问题不在于费用，而在于**它们让资本失去了惩罚坏公司的能力**。"
- Keep bold highlights to 1–3 per section. Too many bold lines dilute the effect; too few
  makes the article feel flat. Apply bold only when the point genuinely surprises or reframes
  the reader's understanding.

Original quote rules:
- When quoting a commenter's exact words that are sharp or important, format as:
  **{translated text in article language}**（{original text}）
  Example (zh article, en source): **指数基金让资本失去了惩罚坏公司的能力**（index funds have stripped capital of the ability to punish bad companies）
  Example (en article, en source): **index funds have stripped capital of the ability to punish bad companies**
- When config.lang matches the source language (e.g., both "en"), skip the parenthetical — just use **bold**.
- Use original quotes sparingly: at most 1–2 quotes per group section. Only quote when the
  original wording is significantly more impactful than any paraphrase would be.
- Use full-width parentheses （）for the original-text parenthetical in Chinese articles;
  use half-width () in English articles.

Summary rules:
- Do NOT end with "讨论没有达成共识" or equivalent — this provides no value.
- The summary must give the reader something beyond a recap:
  an unanswered question worth watching, a practical implication, or a higher-level observation.
- If the title poses a question, the summary should address it (even if the answer is "it depends, and here's what it depends on").
-->

<!-- Section names by language:
  zh → en
  背景 → Background
  核心观点 → Core Viewpoints
  争议点 → Controversies
  总结 → Summary
-->

<!-- References rules:
- Append a "参考资料 / References" section at the end of the article.
- Always include the HN discussion link: https://news.ycombinator.com/item?id={postId}
- If the post has an external URL (post.url), include it as the original article link.
- IMPORTANT: Show the raw URL explicitly on a separate indented line after each Markdown link,
  so that URL information is preserved when converting to other formats (HTML, PDF, WeChat, etc.).
- Format:
  ## 参考资料 / References
  - [原文章标题或"原文"](post.url)
    post.url
  - [HN 讨论](https://news.ycombinator.com/item?id={postId})
    https://news.ycombinator.com/item?id={postId}
-->

# [Hacker News] {帖子标题 / Post Title}

<small>本文由 Yiyue31 开发的 Skill 基于 Hacker News讨论总结而成，可能与原始评论存在差异，请自行甄别。</small>

## 背景 / Background
{读者钩子（1句）+ 帖子上下文（2-3句）}
## 核心观点 / Core Viewpoints
### {分组1名称}
{观点总结 + 代表性评论引用。每段不超过5句。}
### {分组2名称}
{过渡句 + 观点总结。每段不超过5句。}
...
## 争议点 / Controversies
{对立观点的分歧根源，而非论点复述。如果讨论一边倒，改为共识描述。}
## 总结 / Summary
{回应核心问题 + 超出复述的读者价值（未解答的关键问题 / 实际影响 / 趋势判断）}
## 参考资料 / References
- [原文]({post.url})
  {post.url}
- [HN 讨论](https://news.ycombinator.com/item?id={postId})
  https://news.ycombinator.com/item?id={postId}
