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
- Section names are MONOLINGUAL — follow config.lang (use the zh name when lang=zh, the en name when lang=en). Do NOT output bilingual "zh / en" headings. See the mapping table below.

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

Coverage (stated ONCE in the injected header — NOT written by you, NOT at the end):
- The disclaimer + methodology/neutrality + discussion snapshot (timestamp / post score / comment count) are injected as ONE <small> paragraph right after the H1 by `scripts/insert-header.ts`. Do NOT write any of them yourself.
- Do NOT append `（N / M 条）` / `(N / M comments)` to section headings — that part/whole ratio is an internal coverage metric; readers cannot interpret it and it clashes with the editorial voice.
- Do NOT add any coverage or methodology note at the end of the article — the header already carries it. The body ends after `## 参考资料`.
- Keep the body editorially ordered; do NOT reorder by raw heat.

Sharp viewpoints & quotes:
- Wrap sharp/counter-intuitive points in **bold** (1–3 per section, only when they genuinely reframe understanding).
- Quote exact COMMENT words sparingly (≤1–2 fragments per section) as **{translated text}（{original text}）**. Skip the parenthetical when lang matches source. Full-width （） in Chinese, half-width () in English.
- Source-article quotes are a SEPARATE budget (see "Original-article voice"): one or two longer block quotes of the original's core argument are welcome and do NOT count against the comment-fragment limit.

Summary:
- Do NOT end with "讨论没有达成共识" or equivalent. Give something beyond a recap: an unanswered question, a practical implication, a higher-level observation, OR one explicitly-labeled editorial observation ("值得一提的是…") that goes beyond the commenters' frames — but only if supported by the original/comments. If the title poses a question, address it.
- Vary the summary's opening across articles — do not default to "与其说…不如说…" every time; that recurrence is a tell.
-->

<!-- Section names — MONOLINGUAL. Use the name that matches config.lang; do NOT output bilingual "zh / en" headings.
  zh → en
  背景 → Background
  核心观点 → Core Viewpoints
  怎么做到的 → How it was done
  意味着什么 → What it means
  人们记住的 → What people remember
  要点 → Notable points
  争议点 → Controversies
  意外之声 → Surprising takes
  总结 → Summary
  参考资料 → References
-->

<!-- Title:
- H1 = `[HN] {title in config.lang}`. HN titles are usually English, so for a zh article the H1 is the CHINESE translation of post.title; for an en article it is post.title as-is.
- When post.title differs from the article language, add ONE small line with the original right after the H1 (the injected header will sit between H1 and this line): zh `<small>原标题：{post.title}</small>`, en `<small>Original: {post.title}</small>`. Skip it when post.title is already in the article language.
-->

<!-- References rules:
- Append a "参考资料" (en: "References") section at the end of the article — this is the LAST section; nothing follows it.
- Always include the HN discussion link: https://news.ycombinator.com/item?id={postId}
- If the post has an external URL (post.url), include it as the original article link.
- IMPORTANT: Show the raw URL explicitly on a separate indented line after each Markdown link,
  so that URL information is preserved when converting to other formats (HTML, PDF, WeChat, etc.).
- Format (zh shown; en uses "References" / "Original"):
  ## 参考资料
  - [原文]({post.url})
    {post.url}
  - [HN 讨论](https://news.ycombinator.com/item?id={postId})
    https://news.ycombinator.com/item?id={postId}
-->

# [HN] {帖子标题（中文译名） / Post Title}
<small>原标题：{post.title（原文，仅当与正文语言不同时）}</small>

## 背景
{读者钩子（1句）+ 让读者产生利害感的上下文（按需 3–5 句，不设 ~100 词上限）。若抓取到原文且有实质论点，在此或正文相应处用整段引用引出。}

<!-- Body skeleton — pick EXACTLY ONE by thread type (rules above). Do NOT output more than one, and do NOT output the "=== TYPE ===" markers or this comment. Headings shown in zh; for en use the mapping table above. Each type's section shape:

=== Controversy ===
## 核心观点
### {中心问题本身作小标题，或"支持方 / 反对方"}
{观点作为对该问题的回答逐层展开；最尖锐点加粗 + 评论原话片段。每段≤5句。}
### {另一方 / 另一切角}
{过渡句 + 观点。每段≤5句。}
## 争议点
{分歧的根源，而非"A 说 X、B 说 Y"的复述。}

=== Breakthrough / achievement ===
## 怎么做到的
{发生了什么 + 为什么难 + 关键方法。可整段引用原文的说明。}
## 意味着什么
{意义、局限、后续走向。}
（仅当确有真实异议时，才加 `## 争议点`）

=== Event / obituary / reflection ===
## 人们记住的
{复数的个人回忆或反应，按主题松散组织。}
（不要硬造 `## 争议点`；若讨论中确有分歧，再加。）

=== Scattered Q&A ===
## 要点
{相关但零散的看法 roundup，按粗略主题分组。}
（老实的 roundup 优于强造叙事。）
-->

=== 所有类型共用结尾 ===

## 意外之声
<!-- 意外之声 (en: Surprising takes) — the cold / counter-consensus track, separate from the heat-ranked body. The point of this section is SURPRISE, not "best of".
- The picks come from `02-grouped.json` `standouts`. The grouping step draws them PRIMARILY from the outlier pool (comments the activity filter dropped because of low reply volume), so they do NOT repeat what the body already covered. An `active` comment is allowed only when it contradicts its own group's mainstream stance.
- Bar — each pick must be genuinely SURPRISING: counter-consensus, counter-intuitive, or outrageous-but-coherent. "Well argued", "I agree", or "clearly explained" do NOT qualify and must not appear here. If fewer than 2 picks clear this bar, the grouping step sets `standouts: []` and you OMIT this whole section (empty is the expected outcome for many threads, not a failure).
- Render each pick as ONE blockquote with the fields separated by BLANK lines (blank lines render as separate <p> in HTML, so author / translation / original / reason do not collapse onto one line):
  > **作者 @{author}**
  >
  > {中文译文}
  >
  > 原文：*{original exact words}*
  >
  > 为何意外：{reason}
  Join @{author} and the original exact words from `01-raw-data.json` by `commentId`. {中文译文} is your translation of the original; when the article language already matches the source, drop the 原文/译文 split and show the quote once. {reason} is the standouts entry's reason (relabel "为何意外" to "Why surprising" for en). Attribution is allowed here because the whole section is an exact-quote spotlight — an extension of the body's "quote → may name" rule.
-->
{逐条按上述四段 blockquote 格式。`standouts` 为空则整节省略，不要写空标题。}

## 总结
{回应核心问题 + 超出复述的读者价值：未解答的关键问题 / 实际影响 / 趋势判断 / 一处可被原文或评论佐证的延伸观察。}

## 参考资料
- [原文]({post.url})
  {post.url}
- [HN 讨论](https://news.ycombinator.com/item?id={postId})
  https://news.ycombinator.com/item?id={postId}
