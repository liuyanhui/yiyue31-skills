---
name: yiyue31-summary
description: Use when the user wants to summarize articles, tech posts, research papers, or documentation.
version: 2.3.1
---

# Tech Article Summarizer

## Requirements
- **Audience** (drives depth, jargon, and emphasis): `general` (default, applied automatically — no user input needed) | `technical` | `mixed`. The user may override; otherwise `general`. See Step 1.
- **Reader's perspective, not the author's.** Readers want to grasp key information, not reconstruct the author's writing process. Two concrete forms:
  - **Idea as subject, not the author.** Avoid the "author + verb of speaking/thinking" pattern (`X argues / claims / advises / stresses / recounts / notes / points out / opens by / closes that`). Such verbs replay the author's writing process and force the author's name into the subject slot of most sentences. Put the claim, concept, or evidence in the subject slot. Attribute only when it carries weight: a contested opinion, a direct quote, or distinguishing who holds a view.
  - **Lead the Overview with the reader's payoff** — what the reader walks away with — not a topic-level restatement.
- **Evidence strength is visible**: distinguish what is data-backed from what is anecdote or speculation.
- Except for direct human quotes, avoid overly colloquial language during summarization. Maintain a professional, clear, and concise style.
- **Output language**: Generate the summary in English regardless of the source article's language. The Chinese version is produced by a **separate `yiyue31-translator` invocation after summary completes** (see Step 7 handoff) — it is no longer part of the summary pipeline. (The Step 2 analysis may follow the source language; the summary itself stays English so the Steps 4-6 quality checks apply consistently.)
---
## Directory

`{skill-dir}` = this SKILL.md's directory path. It means the directory where this SKILL.md is located.

---

## Reusable Sub-workflows

### Evaluate Once

Single-shot evaluation: call subagent, get scored report, pass or fail. No loop.

**Parameters (caller provides):**
- `{eval-prompt}`: Evaluate prompt file path (e.g. `{skill-dir}/references/evaluate-analysis-prompt.md`)
- `{input-file}`: File to evaluate
- `{output-file}`: Where to save the evaluation report
- `{threshold}`: Passing score, default 8.0

**Procedure:**
1. Call subagent with `{eval-prompt}` as prompt, providing `{input-file}` content as input.
2. Save the evaluation report to `{output-file}`.
3. Extract total score from report.
   - Score ≥ `{threshold}` → **PASS**
   - Score < `{threshold}` → **FAIL**

**Returns:** PASS/FAIL + evaluation report path.

**Loop constraint:** When Evaluate Once is called within a generate-evaluate loop, the evaluator MUST use the same LLM throughout all rounds — switching mid-loop is FORBIDDEN. Different LLMs apply different scoring standards; switching mid-loop makes scores non-comparable across rounds.

### Generate-Evaluate Loop

Repeatedly generate (or revise) an artifact and score it until the score meets the threshold or rounds are exhausted. Built on **Evaluate Once**; used by Steps 2 and 4.

**Parameters (caller provides):**
- `{generate-prompt}`: Generation prompt file path (e.g. `{skill-dir}/references/analysis-prompt.md`)
- `{generate-inputs}`: Inputs to the generator each round — the fixed sources, plus from round 2 on the previous round file and previous evaluation report (as improvement advice)
- `{eval-prompt}`: Evaluation prompt file path (delegated to **Evaluate Once**)
- `{round-file}`: Where to save each round's draft, with `{N}` substituted (e.g. `{title}/summary/{type}-round{N}-{title}.md`)
- `{eval-file}`: Where to save each round's evaluation report, with `{N}` substituted (e.g. `{title}/summary/evaluation-{type}-round{N}-{title}.md`)
- `{best-file}`: Where to copy the best result (e.g. `{title}/summary/{type}-{title}.md`)
- `{max-rounds}`: Round cap
- `{threshold}`: Passing score, default 8.0

**Procedure:**
1. **Each round N (1..{max-rounds}):**
   - Generate/revise via `{generate-prompt}`: round 1 produces a fresh draft from `{generate-inputs}`; later rounds revise the previous round to resolve every item in the previous `{eval-file}`. Save to `{round-file}`.
   - Evaluate (same pattern as **Evaluate Once**): call subagent with `{eval-prompt}`, save report to `{eval-file}`.
   - Extract total score:
     - Score ≥ `{threshold}` → **PASS** → copy current round file to `{best-file}` → return.
     - Score < `{threshold}` → **FAIL** → track this round as best candidate if it is the highest score so far → next round.
2. **Rounds exhausted**: copy the best-scoring round file to `{best-file}`, inform user of the score → return.

**Returns:** best result path + final score.

---

## Summary Workflow

The complete step-by-step process from input to final output:

### Step 1: Preprocess Content And Title

Initialize content based on the input type:
- **URL input**: Prefer locally installed skills such as: web-access skill, etc. Alternatively, use `wget` or `curl` or other tools to open the web page and download the article content.
- **File path input**: Use the `Read` tool to read the file content
- **Direct paste**: Process the input content directly

Title extraction rules:
- Extract the title from the original article/file/pasted content. Priority: article title → file name → first few words of the first sentence.
- Keep the title short (≤ 5 words) and path-safe: lowercase letters, numbers, and hyphens only (use hyphens to join words, no spaces). This value is used as a directory name and in filenames.

If original content is not in markdown format, convert it to markdown format.

**Convert Rules**
- Use subagent.
- Provide clear instructions to the subagent to:
   - Convert content as markdown file.
   - Preserve the original structure and format during conversion. Try to keep paragraphs, headings, lists, etc. unchanged. For elements that cannot be accurately converted, keep the original text and add comments to prompt the user to check.
   - input: original content or file path
   - output: markdown content.
- Save to: `{title}/summary/original-{title}.md`.

**Audience determination** (consumed by Steps 4–6; Steps 2–3 are audience-neutral):
- Default `general` — apply automatically, no user input required.
- Use `technical` only if the user explicitly asks for a technical/expert-level summary.
- Use `mixed` only if the user explicitly asks for one summary serving both general and technical readers.
Record the chosen audience; it drives depth, jargon handling, and emphasis in Steps 4–6.

### Step 2: Analyze Article (Generate-Evaluate Loop)

**Loop parameters:** max 3 rounds, passing threshold score ≥ 8.0.

Run a **Generate-Evaluate Loop** with these parameters:

- `{generate-prompt}`: `{skill-dir}/references/analysis-prompt.md`
- `{generate-inputs}`: original article `{title}/summary/original-{title}.md`; from round 2, also the previous round draft `{title}/summary/analysis-round{N-1}.md` and its evaluation `{title}/summary/evaluation-analysis-round{N-1}.md` as improvement advice
- `{eval-prompt}`: `{skill-dir}/references/evaluate-analysis-prompt.md`
- `{round-file}`: `{title}/summary/analysis-round{N}.md`
- `{eval-file}`: `{title}/summary/evaluation-analysis-round{N}.md`
- `{best-file}`: `{title}/summary/analysis-{title}.md`
- `{max-rounds}`: 3
- `{threshold}`: 8.0

On PASS or rounds-exhausted → proceed to Step 3.

### Step 3: Template Selection

Auto-select template based on Step 2 analysis results. No user input required unless explicitly requested.

- **Paper signals** (methods, experiments, results, citations, academic tone) → Paper Template
- **Default** → Tech Article Template
- **Concise Template** → only when user explicitly requests it

If the user specified a template in their initial input, use that instead.

### Step 4: Summary Generate-Evaluate Loop

Generate and polish the summary in a single scored loop. Polishing is folded in as revision rounds — the summary eval's Expression Quality dimension already covers naturalness, readability, and professionalism, so a separate polish pass is unnecessary.

Run a **Generate-Evaluate Loop** with these parameters:

- `{generate-prompt}`: `{skill-dir}/references/generate-summary-prompt.md`
- `{generate-inputs}`: analysis `{title}/summary/analysis-{title}.md` + selected template (Step 3) + original article `{title}/summary/original-{title}.md` + **the audience from Step 1**; from round 2, also the previous round draft and its evaluation as improvement advice
- `{eval-prompt}`: `{skill-dir}/references/evaluate-prompt.md`
- `{round-file}`: `{title}/summary/summary-round{N}-{title}.md`
- `{eval-file}`: `{title}/summary/evaluation-round{N}-{title}.md`
- `{best-file}`: `{title}/summary/summary-draft-{title}.md`
- `{max-rounds}`: 5
- `{threshold}`: 8.0

Each round, also run `node {skill-dir}/scripts/word-counter.js {title}/summary/summary-round{N}-{title}.md` to display word count (advisory).

**Pass the audience (Step 1) to both the generator and the evaluator.** The generator flexes depth/jargon/emphasis by audience; the evaluator scores Technical Depth against the audience's bar. When calling the evaluate subagent, include the audience value in the input.

On PASS or rounds-exhausted → proceed to Step 5.

### Step 5: AI Tone Check (max 5 rounds)

Detect and fix AI-generated tone artifacts in the summary. Each round checks tone on the current summary and applies the suggested fixes; the loop ends when the tone report comes back clean.

**Input:** `{title}/summary/summary-draft-{title}.md` (from Step 4). **Output:** `{title}/summary/tone-polished-{title}.md`.

**Loop procedure:**
1. **Each round N (1..5)**:
   - AI tone check: call subagent with `{skill-dir}/references/evaluate-ai-tone-prompt.md`, providing the current summary as input. Save report to `{title}/summary/evaluation-ai-tone-round{N}-{title}.md`.
   - If the report indicates no issues → copy current summary to `{title}/summary/tone-polished-{title}.md` → Step 6.
   - Otherwise: parse the issues and apply the suggested fixes to the working summary, next round.
2. **Rounds exhausted (5 rounds)**: copy current summary to `{title}/summary/tone-polished-{title}.md`, inform user that some AI-tone issues may remain → Step 6.

**Note:** Fixes are applied to the working summary and carried across rounds; intermediate rounds are not saved as separate files (unlike Steps 2/4). Only the final result is written to `tone-polished-{title}.md`. Each round's evaluation report is still saved.

### Step 6: Reader Audit (max 5 rounds)

The final quality gate before translation. Cold readers — who see ONLY the summary, never the original article — read it sentence by sentence and report where they get stuck. They report **phenomena only, never fixes**: a real reader knows where they are confused, not how to rewrite the text. A full-context editor then resolves every reported phenomenon. The loop repeats with a fresh batch of cold readers each round until none reports a **blocking comprehension problem**.

**Blocking vs. look-up-able (important for dense/technical summaries):** readers distinguish *blocking* comprehension problems from *look-up-able* domain vocabulary (see `evaluate-reader-audit-prompt.md` for the full taxonomy). Only blocking problems converge the loop; look-up-able terms are expected in a specialist summary and are listed for completeness, not fixed. **The line between blocking and look-up-able moves with the audience (Step 1):** `general` → more terms are blocking (jargon must be grounded on first use); `technical` → most domain terms are look-up-able. Pass the audience to each reader subagent.

**Why summary-only readers:** a real reader of the summary has no original article. Giving readers the original lets them fill gaps from memory and miss the gaps a real reader hits. The editor, by contrast, gets full context (original + analysis) so it can fix correctly. This reader/editor asymmetry is the core of the step: the reader is deliberately limited to surface real blind spots; the editor is fully informed to fix them well.

**Input:** `{title}/summary/tone-polished-{title}.md` (from Step 5). **Output:** `{title}/summary/summary-{title}.md`.

**Loop procedure:**
1. **Each round N (1..5)**:
   - Spawn **3 cold readers in parallel**, each a subagent with `{skill-dir}/references/evaluate-reader-audit-prompt.md` and a distinct reader profile. Each receives ONLY the current summary — never the original article or analysis. Profiles:
     - `non-expert` — curious reader with no domain background; flags jargon and unexplained terms.
     - `skim-reader` — busy, reads once and will not re-read; flags dense sentences, weak transitions, structural confusion.
     - `non-native` — non-native English reader with limited vocabulary; flags idioms, complex grammar, ambiguous references.
   - Save each reader's report to `{title}/summary/evaluation-reader-audit-round{N}-{profile}-{title}.md`.
   - **Aggregate:** collect and dedupe all **blocking** phenomena across the 3 reports.
   - If no reader reports a blocking comprehension problem → copy current summary to `{title}/summary/summary-{title}.md` → Step 7.
   - Otherwise: act as **editor**. For each blocking phenomenon, decide and apply a fix using the full context — current summary + original article `{title}/summary/original-{title}.md` + analysis `{title}/summary/analysis-{title}.md`. Apply all fixes to the working summary. Next round.
2. **Rounds exhausted (5 rounds)**: copy current summary to `{title}/summary/summary-{title}.md`, inform user that some reader-experience issues may remain → Step 7.

**Note:** Like Step 5, fixes are applied to the working summary and carried across rounds; intermediate rounds are not saved as separate summary files. Only the final result is written to `summary-{title}.md`. Each round's reader reports are still saved. Subagents are stateless, so every round is a genuinely fresh cold read — the convergence criterion is "any batch of new readers hits no blocking comprehension problem," not a fixed round count.

### Step 7: Emit Translation Handoff

The summary deliverable is the **English summary** (`summary-{title}.md`). Chinese translation is now a **separate, optional step**: it runs as its own `yiyue31-translator` invocation after summary completes, driven by a file contract — summary does **not** run it inline. This keeps summary focused on summarization, lets translation run independently (or in a fresh session, which bounds memory on this heavy pipeline), and removes summary-specific translation logic from this skill.

**Procedure:**
1. **Make the result directory self-contained.** Copy `{skill-dir}/references/translation-contract.md` to `{title}/summary/translation-contract.md` (verbatim). **Why:** the handoff must reference only files inside `{title}/summary/`; the skill-dir path is not portable to a fresh session, so the contract is co-located with this run's outputs. (The skill-dir file remains the canonical source; the copy is a point-in-time snapshot of the rules that governed this run.)
2. **Produce the handoff doc.** Write `{title}/summary/translation-handoff.md` declaring this run's outputs and the translation handoff. Content (substitute `{title}`):

   ````markdown
   # Translation Handoff — {title}

   This file is the entry point for the `yiyue31-translator` skill: it says what to translate and where the rules live. Run the translator on `summary-{title}.md` as a separate step.

   ## Files (this run)
   - `original-{title}.md` — source article, markdown-converted (Step 1).
   - `analysis-{title}.md` — structured analysis incl. Quotes table with per-item verbatim highlight context (Step 2).
   - `summary-{title}.md` — **the English summary deliverable** (Steps 3–6). This is what gets translated.
   - `translation-contract.md` — verbatim marker transformation, hard constraints, post-translation verification.
   - `translation-handoff.md` — this file.

   ## Translation handoff (separate step — NOT run by summary)
   - **Skill**: `yiyue31-translator`
   - **Source to translate**: `summary-{title}.md` (becomes the translator's `original-{title}.md`).
   - **Supplementary context**: `analysis-{title}.md` — verbatim highlight meanings (reference only; the translator generates its own analysis/glossary).
   - **Contract**: `translation-contract.md` (in this directory) — verbatim marker transformation, hard constraints, post-translation verification.
   - **Expected output & co-location**: the translator writes `translated-{title}-zh.md` into `{title}/sum-translation/`. After it finishes, **copy** that file to `{title}/summary/summary-{title}-zh.md` (naming rule: the Chinese version = English deliverable name + `-zh` before `.md`, so `summary-{title}.md` → `summary-{title}-zh.md`). Keep the translator's original in `{title}/sum-translation/`. The co-located pair is then `summary-{title}.md` (EN) + `summary-{title}-zh.md` (ZH).
   ````

3. **Hand off.** Inform the user:
   - English summary deliverable: `{title}/summary/summary-{title}.md`.
   - To produce the Chinese version, run `yiyue31-translator` on `summary-{title}.md` per `translation-handoff.md` and `translation-contract.md` (both in `{title}/summary/`). This is a separate step — **do not auto-run the translator**. Suggest running it in a fresh session if memory-constrained.

**Fallback:**
- If `yiyue31-translator` is not installed, inform the user: "No translation skill found. Summary saved at `{title}/summary/summary-{title}.md`. Install a translation skill to enable Chinese translation." → done. (No fallback substitute skill is attempted automatically, since translation is now an explicit, separate user action.)

---

## Available Templates

- **Tech Article Template**: Tech article summary template - Suitable for technical articles, tech blogs, tech announcements, etc. Provides comprehensive analysis and summary, highlighting innovations and practical value. See `{skill-dir}/templates/tech-article.md`. **Default template**.
- **Paper Template**: Paper summary template - Suitable for academic paper summaries, helping readers quickly learn and understand the core content and innovations of the paper. See `{skill-dir}/templates/paper.md`.
- **Concise Template**: Concise summary template - Focused on core knowledge, suitable for quick learning. See `{skill-dir}/templates/concise.md`. Only used when user explicitly requests it.
