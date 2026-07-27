<!--
Generation constraints (read before writing the article):
- Source fidelity: no viewpoint may be SILENTLY dropped — preserve every distinct one. But do not spread depth evenly: concentrate on the 2–3 viewpoints that reframe understanding, round up the rest briefly. Use ONLY provided comments + fetched original; no fabrication or external knowledge. After writing, self-check for omitted viewpoints.
- Tone: write naturally with varied punctuation (commas, colons, parentheses, separate sentences) — no em dashes (—) for mid-sentence additions, no template openings/closings (e.g., "在当今快速发展的时代"). When the target language differs from the source, express natively — do not translate sentence-by-sentence.
- Thread type → skeleton (decide BEFORE writing, from the title + `02-grouped.json`). Forcing every thread into one mold is itself the blandness to avoid — a science breakthrough, an obituary, and a flame war should not share an identical skeleton:
  - Controversy (real opposing camps) → lead with the central question; viewpoints unfold as answers to it; end the body on the ROOT disagreement.
  - Breakthrough / achievement (a thing was done) → "what happened + why it was hard + what it means". Omit 争议点 unless a genuine dissent exists.
  - Event / obituary / reflection (no central controversy) → what people remember. Do NOT fabricate a 争议点 — an empty controversy reads as formula.
  - Scattered Q&A (no through-line) → honest loose roundup. Forced narrative on scattered threads = fabricated coherence = fidelity violation.
  争议点 is mandatory ONLY for the controversy type. For other types, include it only if a real split surfaces.
- Section names follow config.lang (see the language table below).

Citation:
- No commenter usernames as attribution — use generic references ("有评论者认为……""支持方认为……").
- Name a commenter only when quoting their exact, key-insight words, prefixed with context ("一位金融背景的评论者 augstein 引用 Hedgeye 分析称……").

Jargon:
- Explain financial/technical terms on first use with a brief parenthetical/appositive ("S&P 500（标普500指数）""401k（美国个人退休账户）"), or replace with plain language if meaning is preserved.

Paragraph & background:
- One idea per paragraph; split any paragraph over 5 sentences. Between subsections (###), add a transition sentence — but it must carry a SUBSTANTIVE logical link (how the next topic relates to the previous), not dramatize "the debate did X". "争论到此露出了底色""撞上反驳""分了叉" are NOT transitions — they narrate the discussion's action without adding a viewpoint.
- Background: open with a reader-stakes hook ("如果你有退休金账户……"), then context. Length: as much as the thread needs to make the reader care (typically 3–5 sentences) — do NOT cap at ~100 words when the topic needs more. Give large numbers a reference point ("$965B 估值，接近瑞典全年 GDP").
- Original-article voice: when the fetched original has a substantive argument (not just the comments), quote its 1–2 key paragraphs in full as a blockquote (with translation) inside the relevant section — the source's own words carry more weight than paraphrase. Skip if the original is thin or absent.

Information density (anti-空话):
- Every sentence should carry a viewpoint or a fact. Sentences that merely narrate THE DISCUSSION ITSELF — dramatizing the act of disagreement rather than what is disagreed about — are 空话: "争论从一开始就分了叉""措辞毫不客气""把杀伤力落到了实处""还有一种冷峻的判断""贯穿始终的，是一种被背叛感". Cut them, or recast into the substance they are decorating. Test: delete the sentence; if the reader loses no viewpoint or fact, it is 空话.
- Section headings (###) must be nominal/declarative. "这究竟算不算'恶意软件'" is fine; "这究竟算不算'恶意软件'，定性本身就先吵了起来" is not — drop the dramatic action clause.

Controversy (conditional):
- If viewpoints oppose: identify the ROOT of the disagreement, not just "X says A, Y says B." ("分歧的本质在于：……"). If one-sided: state the consensus and note dissenting nuances.

Aggregation voice (anti-AI-texture — the strongest tells in a multi-viewpoint digest):
- Do NOT stack "pendulum" sentences that symmetrically recite opposing sides ("有评论者认为……另一方则指出……" / "Some think X, while others argue Y."). Land on the concrete disagreement instead of a balanced restatement.
- Do NOT open group sections with meta-narration ("第一组讨论了……" / "Group A discusses..."). The heading names the topic — open with the viewpoint itself. Vary how viewpoints are introduced across sections.

Heat marker (surface engagement without reordering):
- Keep the body editorially ordered; do NOT reorder by raw heat. But each `###` subsection and roundup bullet that maps to one or more groups in `02-grouped.json` must append a comment-count marker at the end of its heading / lead-in: zh `（精选 N 条）`, en `(N selected comments)`. N = number of unique comments under the mapped group(s); a group's own `commentIds` already unions its subGroups, so summing a group together with its subGroups double-counts.
- No marker on: H1, 背景, whole-thread narrative sections (e.g. 怎么做到的 / 意味着什么 when they synthesize across the thread rather than map to one group), 争议点, 总结, 参考资料.
- The word 精选 / selected is load-bearing: the count is of the heat-filtered digest comments, not the full thread, so a reader does not mistake `（精选 7 条）` for "only 7 people discussed this" inside a 1000+ comment thread.

Sharp viewpoints & quotes:
- Wrap sharp/counter-intuitive points in **bold** (1–3 per section, only when they genuinely reframe understanding).
- Quote exact COMMENT words sparingly (≤1–2 fragments per section) as **{translated text}（{original text}）**. Skip the parenthetical when lang matches source. Full-width （） in Chinese, half-width () in English.
- Source-article quotes are a SEPARATE budget (see "Original-article voice"): one or two longer block quotes of the original's core argument are welcome and do NOT count against the comment-fragment limit.

Summary:
- Do NOT end with "讨论没有达成共识" or equivalent. Give something beyond a recap: an unanswered question, a practical implication, a higher-level observation, OR one explicitly-labeled editorial observation ("值得一提的是…") that goes beyond the commenters' frames — but only if supported by the original/comments. If the title poses a question, address it.
- Vary the summary's opening across articles — do not default to "与其说…不如说…" every time; that recurrence is a tell.
-->

<!-- Section names by language (use the names that match your chosen skeleton):
  zh → en
  背景 → Background
  核心观点 → Core Viewpoints
  怎么做到的 → How it was done
  意味着什么 → What it means
  人们记住的 → What people remember
  要点 → Notable points
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

## 背景 / Background
{读者钩子（1句）+ 让读者产生利害感的上下文（按需 3–5 句，不设 ~100 词上限）。若抓取到原文且有实质论点，在此或正文相应处用整段引用引出。}

<!-- Body skeleton — pick EXACTLY ONE by thread type (rules above). Do NOT output more than one, and do NOT output the "=== TYPE ===" markers or this comment. Each type's section shape:

=== Controversy ===
## 核心观点 / Core Viewpoints
### {中心问题本身作小标题，或"支持方 / 反对方"}（精选 N 条）
{观点作为对该问题的回答逐层展开；最尖锐点加粗 + 评论原话片段。每段≤5句。}
### {另一方 / 另一切角}（精选 N 条）
{过渡句 + 观点。每段≤5句。}
## 争议点 / Controversies
{分歧的根源，而非"A 说 X、B 说 Y"的复述。}

=== Breakthrough / achievement ===
## 怎么做到的 / How it was done
{发生了什么 + 为什么难 + 关键方法。可整段引用原文的说明。}
## 意味着什么 / What it means
{意义、局限、后续走向。}
（仅当确有真实异议时，才加 `## 争议点 / Controversies`）

=== Event / obituary / reflection ===
## 人们记住的 / What people remember
{复数的个人回忆或反应，按主题松散组织。}
（不要硬造 `## 争议点`；若讨论中确有分歧，再加。）

=== Scattered Q&A ===
## 要点 / Notable points
{相关但零散的看法 roundup，按粗略主题分组；每个 bullet 末尾加 `（精选 N 条）`。}
（老实的 roundup 优于强造叙事。）
-->

=== 所有类型共用结尾 ===
## 总结 / Summary
{回应核心问题 + 超出复述的读者价值：未解答的关键问题 / 实际影响 / 趋势判断 / 一处可被原文或评论佐证的延伸观察。}
## 参考资料 / References
- [原文]({post.url})
  {post.url}
- [HN 讨论](https://news.ycombinator.com/item?id={postId})
  https://news.ycombinator.com/item?id={postId}
