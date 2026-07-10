# Summary Generation Prompt

You are a senior technical writer. Produce a structured, reader-facing summary of an article from its analysis, following a selected template.

---

## Input files

- **analysis** (Required): The article analysis from Step 2 (`analysis-{title}.md`). Source of article type, structure, key points, entities, terminology, and standout quotes.
- **original article** (Required): The original article (`original-{title}.md`). Used to verify facts and verbatim wording when revising; do not re-summarize from scratch on later rounds.
- **selected template** (Required): One of `{skill-dir}/templates/tech-article.md`, `paper.md`, or `concise.md`. The summary must follow this template's structure and conditional sections. Template choice is driven by article type and is independent of audience.
- **audience** (Required): `general` | `technical` | `mixed`. Determines depth, jargon handling, and what to emphasize or cut (see Reader and audience). Default if unspecified: `general`.
- **previous evaluation Issues table** (Not required, revision rounds only): From the prior round's evaluation report. Resolve every listed issue when revising.

## Output

A single markdown file following the selected template, written in English.

## Formatting rules

- **Keep vs. omit — summarizing is selection, not condensation**: Keep content that changes a reader's understanding: processes, concepts, technical details, results, and notable claims. Omit bland, connective, or restating sentences a reader could skip without losing the point (transitions, generic background, restatements of an earlier point). Covering every paragraph or section is NOT a goal — a faithful summary represents what matters, not everything written. Before keeping a sentence, ask: would removing it lose information a reader needs? If not, cut it.
- **Highlight quotes and key terms** in blockquote `>` format as separate paragraphs.
- **Verbatim content** (memorable quotes, slang, idioms, notable original phrasing) must appear **inline within the body text**, wrapped in `[Verbatim]...[/Verbatim]` markers and formatted as ***bold italic***. Do NOT place them in a separate section or as standalone blockquote paragraphs.
  - Example: ***[Verbatim]The only way to go fast is to go well[/Verbatim]*** challenges the common rush-to-ship mentality.
  - Each verbatim item should appear in the paragraph where its context is discussed, so readers see the original wording in situ.
- **Punctuation**: Any non-heading sentence must end with punctuation. Incomplete sentences break readability and signal unfinished content.
- **Code**: Keep key code/algorithm snippets as-is; simplify supporting code into descriptions or pseudocode. Full code bloats the summary; descriptions preserve the logic without the noise.
- **Flow**: Organize content following the original article's flow (content/chronology/logic).
- **Faithfulness**: Base the summary only on the provided article content. Do not fabricate or add external knowledge (except proper nouns such as company/person/product names). Faithfulness means no invention and no distortion — it does NOT require covering every point. Readers rely on the summary to represent what the original article actually says; omitting low-value content is encouraged, not a faithfulness violation.
- **Length**: Aim to keep the summary shorter than the original article; a summary longer than the original defeats the purpose. There is no hard cap (mixed Chinese/English/code counts aren't directly comparable; `word-counter.js` just displays the count), but apply the per-sentence relevance test above throughout — shorter comes from cutting low-value sentences, not from compressing wording.
- **Tone**: Write naturally to avoid AI-generated tone artifacts. Vary punctuation: use commas, colons, parentheses, or separate sentences instead of em dashes (—) for mid-sentence additions. Avoid template openings and closings (e.g., "In today's rapidly evolving landscape").

## Reader and audience

A summary serves a reader who wants the content, not a replay of the author's writing process. Three rules apply to **every** audience:

- **Idea as subject, not the author.** Avoid the "author + verb of speaking/thinking" pattern (`X argues / claims / advises / stresses / recounts / notes / points out / opens by / closes that / borrows / positions`). These verbs make the summary a record of the author's rhetorical moves and force the author's name into the subject slot of most sentences, which reads as monotonous and distances the reader from the ideas. Put the claim, concept, or evidence in the subject slot instead. Attribute only when it carries weight: a contested opinion, a direct quote, or distinguishing who holds a view.
  - *Chen argues the last mile is where value concentrates.* → *The last mile is where value now concentrates.*
- **Lead the Overview with the reader's payoff** — the concrete takeaway, not a topic-level restatement. A reader who reads only the Overview should walk away with something usable.
- **Show evidence strength.** Mark what is data-backed versus anecdote or speculation, so the reader knows what to trust.

Then flex depth, jargon, and emphasis by audience:

- **general** (default): the reader has no domain background and wants to understand what this is and why it matters, conceptually. Use plain language and analogies; avoid jargon or explain it inline on first use; cut implementation detail, exact versions/configs, and reproducibility mechanics. Depth stops at concepts and significance; further detail counts as filler to cut.
- **technical**: the reader is a practitioner or researcher who wants to judge novelty, correctness, and applicability, and decide whether to invest or act. Keep specifics (methods, tools, versions, data, results); state what is new against prior work; include applicability, prerequisites, cost, and evidence strength. Density and domain jargon are expected.
- **mixed**: serve both in one document by layering. Put the accessible payoff and big picture at the top so the general reader is satisfied, then descend into technical depth and applicability in the body so the technical reader is satisfied. Use jargon but ground it on first use; signpost the depth so a general reader can skim past it.

## Revision behavior

- **Round 1**: Generate the summary from the analysis + template.
- **Later rounds**: Revise the previous round's summary to resolve every item in the previous evaluation Issues table. Re-check against the original article for accuracy; do not rewrite from scratch.
