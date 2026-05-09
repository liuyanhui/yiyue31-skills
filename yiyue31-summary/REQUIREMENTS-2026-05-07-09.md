# yiyue31-summary Skill: Requirements & Communication Log

> Period: 2026-05-07 ~ 2026-05-09
> Reconstructed from: git commit diffs (May 7-8) + live conversation (May 9)

---

## Part 1: Communication Record (Reconstructed)

### 2026-05-07

**Commit: `7a44708` — "Add Step 6 summary evaluation loop with scoring rubric"**

Starting point: skill had a linear pipeline (Steps 1-7) with adversarial review steps but no quantitative scoring.

Discussion topics (inferred from diff):
- **Need for quantitative evaluation**: The existing Quality Check (Step 5) used adversarial review but lacked numeric scoring. Agreed to add a scoring-based evaluation loop between Quality Check and Polishing.
- **Evaluation dimensions**: Chose 4 dimensions — Information Density (ID), Logical Coherence (LC), Technical Depth (TD), Expression Quality (EQ).
- **Type-based weight adaptation**: Different article types need different weight profiles. Added 3 types: Paper (ID 30/LC 25/TD 25/EQ 20), Tech Blog (25/25/30/20), Tech News (35/25/15/25).
- **Anti-inflation measures**: Aggressive scoring baseline — "Not bad" = 5, not 7.
- **Evaluation loop mechanics**: Max 5 rounds, threshold ≥ 8.0, same-LLM constraint for consistency.
- **Self-documenting output**: Evaluation report must include enough detail for a separate revision step to fix all issues without re-reading the original article.

Concrete changes:
- New file: `references/evaluate-prompt.md` (128 lines)
- SKILL.md: Inserted new Step 6, renumbered Steps 6→7, 7→8

---

### 2026-05-08

**Commit: `f45a635` — "Add timer-based eval loop and restructure summary workflow"**

Discussion topics (inferred from diff):
- **Timer-based timeout**: Long-running loops (5 rounds of generate+evaluate) could hang indefinitely. Agreed to add a 30-minute global timeout with `timer.js`.
- **Workflow restructuring**: Steps 4-8 were too granular. Merged into 4-7: separated template selection into its own step, made Summary Generation into a generate-evaluate loop.
- **De-AI guidelines**: Polishing step had no specific guidance. Added inline de-AI rules (avoid formulaic transitions, vary sentence structure, use specific language, remove hedging, avoid manufactured parallels).
- **Title sanitization**: Added filesystem-unsafe character removal (`/ \ : * ? " < > |`) and `untitled-{timestamp}` fallback.
- **Retry limits**: Added max 3 retries for analysis adversarial review and polishing check.
- **Template path fix**: Changed `templates/concise.md` to `{skill-dir}/templates/concise.md`.

Concrete changes:
- New files: `scripts/timer.js` (81 lines), `scripts/timer.test.js` (197 lines)
- SKILL.md: 145 lines, restructured Steps 4-8 → 4-7, added flowchart, added timer commands

---

**Commit: `8343839` — "Decouple SKILL.md from evaluator internals, compact evaluate-prompt.md"**

Discussion topics (inferred from diff):
- **Coupling problem**: SKILL.md referenced specific dimension names (ID/LC/TD/EQ) in its loop procedure. If eval prompt changed dimensions, SKILL.md would be out of sync. Agreed to decouple — SKILL.md only knows threshold (8.0) and reads total score from evaluator report.
- **Self-documenting output**: Added Methodology section to eval report template so the report itself explains its dimensions, weights, and formula.
- **Evaluate-prompt.md bloat**: 4 separate rubric tables (one per dimension) + separate type table + separate weight table = 134 lines. Merged into 1 combined rubric table + 1 combined type/weight table = 70 lines.

Concrete changes:
- SKILL.md: Changed "score across 4 dimensions (ID/LC/TD/EQ)" to generic "subagent returns structured evaluation report"
- evaluate-prompt.md: 134 → 70 lines

---

**Commit: `02fe5a4` — "Compact SKILL.md: remove flowchart, tighten analysis and polishing steps"**

Discussion topics (inferred from diff):
- **SKILL.md verbosity**: 145 lines was too long. Agreed to compress.
- **Flowchart redundancy**: The ASCII flowchart in Step 5 duplicated the loop procedure text. Removed it.
- **Analysis items**: Each item had verbose prefix ("Language analysis: Detect the article's language"). Compressed to terse bullet format ("**Language**: Detect language").
- **Loop procedure**: Multi-line numbered steps with sub-bullets compressed into more compact format.
- **De-AI guidelines**: 6 bullet points compressed into 2 lines.
- **Steps 6-7**: Polishing and Polishing Check compressed from 8 lines to 5 lines.

Concrete changes:
- SKILL.md: 145 → 104 lines (~28% reduction)

---

**Commits `d7c5cff`, `abf9b75` — Minor fixes**

- Language selection: Changed "first 10 characters of the first sentence" to "first few words of the first sentence" for title extraction
- Save file expression: Minor wording adjustments

---

### 2026-05-09 (Live conversation)

**Morning session — Commit `69a352f`: "Unify evaluate loops across all steps, merge steps, add dedicated eval prompts"**

- Discussed unifying evaluate loops across all steps — each step should use the same loop pattern
- Agreed to create dedicated eval prompts per step: analysis (CO/AC/SC/ED), summary (ID/LC/TD/EQ), polish (NA/RE/FI/PR)
- Merged Step 2 (Analyze) + Step 3 (Adversarial Review) into Step 2 (Analyze Generate-Evaluate Loop) — adversarial review replaced by eval loop
- Merged Step 6 (Polishing) + Step 7 (Polishing Check) into Step 5 (Polish Generate-Evaluate Loop) — check replaced by eval loop
- Extracted reusable "Evaluate Once" sub-workflow pattern
- Changed round output naming: `{type}-round{N}-{title}.md`, best round copied to step output; only final uses `final-` prefix
- Updated README with workflow/loop flowcharts and full file listing

**Afternoon session — Commit `0f27cdb` + unstaged changes:**

1. **Evaluate-analysis-prompt.md review**
   - User asked: "分析一下这个文件是否合理，是否需要完善。比如：4个维度是否完备，权重分配是否合理，是否可以压缩内容等。"
   - Dimensions: CO/AC/SC/ED — complete, no additions needed
   - Weights: ED 20% too low for core differentiator. Changed to ED 25% / SC 15%
   - Rubric: 5 bands had overlap in middle. Compressed to 3 bands (9-10 / 5-8 / 0-4)
   - Pre-check: Added section→dimension mapping, added Background to required sections
   - Output: Removed Weights repetition, simplified Methodology

2. **Evaluate-polish-prompt.md review**
   - Same analysis approach, same 3-band compression
   - Weights: FI too important to be equal to RE. Changed FI 25%→30% / RE 25%→20%
   - Pre-check: Added input source detection (reject raw analysis input)
   - FI rubric: Added terminology preservation checks
   - NA rubric: Explicit AI Pattern Checklist reference
   - Rule 5 merged into rubric, deleted

3. **Same-LLM constraint deduplication**
   - User: "所有的LOOP中都应该说明 'Evaluator MUST use the same LLM throughout all rounds'"
   - Initially added to all 3 loops
   - User: "既然是公用的，能不能提取只保留一份"
   - Extracted to Evaluate Once sub-workflow's "Loop constraint" section

4. **Code handling strategy**
   - User: "'Code/algorithms 处理方式'你认为应该保留原文还是修改？"
   - Analysis: neither "keep all as-is" nor "simplify all" is correct
   - Agreed on tiered approach: key snippets kept as-is, supporting code simplified
   - Rule: "Keep key code/algorithm snippets as-is; simplify supporting code into descriptions or pseudocode."

5. **SKILL.md vs Template responsibility separation**
   - User: "首先我们要区分清楚哪些是可以放到SKILL.md，哪些是放在这个模板文件里的"
   - Established principle: SKILL.md = shared rules for all templates; Templates = structure + template-specific constraints
   - Moved to SKILL.md: code handling, ordering, info source, word count, accuracy
   - Kept in templates: section layout, per-section instructions, quantity constraints, conditional generation

6. **Tech-article template review**
   - User: "你客观挑剔的分析一下这个文件是否完备，是否合理，是否需要修改。"
   - Issues: missing Quotes/Terminology sections, title duplication, generation instructions mixed into template, code handling conflict
   - Rewrote: 7 sections (Overview, Key Points, Main Content, Standout Quotes, Insights, Potential Issues, Key Terminology)

7. **Concise and Paper template review**
   - User: "用同样的方法，结合我们的讨论，分析另外两个模板文件"
   - Concise: removed shared rules, added Quote, formatted Glossary as table, added conditional generation
   - Paper: merged duplicate headers, added Quotes/Terminology, "My Reflections"→"Reflections", limited Extensions to paper's own suggestions

---

## Part 2: Requirements Specification

### 2.1 Skill Overview

**Name**: yiyue31-summary
**Purpose**: Article summary generator for technical articles, blog posts, research papers, and documentation. Produces structured, evaluated, polished summaries through a multi-step generate-evaluate loop workflow.

### 2.2 Workflow Requirements

The skill must follow a 5-step pipeline:

| Step | Name | Input | Output |
|------|------|-------|--------|
| 1 | Retrieve Article | URL/file/paste | `original-{title}.md` |
| 2 | Analyze (Generate-Evaluate Loop) | Original article | `analysis-{title}.md` |
| 3 | Template Selection | Analysis result | User-chosen template |
| 4 | Summarize (Generate-Evaluate Loop) | Analysis + template | `summary-{title}.md` |
| 5 | Polish (Generate-Evaluate Loop) | Summary | `final-{title}.md` |

**Loop requirements:**
- All generate-evaluate loops share the same pattern (defined in "Evaluate Once" sub-workflow)
- Maximum rounds per loop: Analysis 3, Summary 5, Polish 3
- Passing threshold: ≥ 8.0 out of 10
- Summary loop has global timeout: 30 minutes (tracked by `scripts/timer.js`)
- Evaluator MUST use the same LLM throughout all rounds — switching mid-loop is FORBIDDEN
- Each round's output saved as `{type}-round{N}-{title}.md`
- Best-scoring round copied to step output file

### 2.3 Evaluation Requirements

Three dedicated evaluation prompts, one per loop step:

| Eval Prompt | Dimensions | Weights |
|-------------|-----------|---------|
| evaluate-analysis-prompt.md | CO (Completeness) / AC (Accuracy) / SC (Structural Clarity) / ED (Extraction Depth) | 30% / 30% / 15% / 25% |
| evaluate-prompt.md | ID (Information Density) / LC (Logical Coherence) / TD (Technical Depth) / EQ (Expression Quality) | varies by article type |
| evaluate-polish-prompt.md | NA (Naturalness) / RE (Readability) / FI (Fidelity) / PR (Professionalism) | 30% / 20% / 30% / 20% |

**Shared evaluation requirements:**
- Score: single integer 0-10 per dimension, weighted total 0-10
- Anti-inflation: "Not bad" = 5, not 7
- Pre-check: reject invalid inputs (empty, gibberish, wrong type)
- Output: structured report with Methodology, Scores table, Issues table
- Issues table: verbatim quote + why it fails + suggested fix
- Severity levels: High (score-defining), Medium (notable), Low (minor)

**Analysis eval specific:**
- Required sections: Language, Article type, Topic & domain, Structure, Paragraphs, Entities, Terminology, Quotes, Background
- Section→dimension mapping for pre-check penalty (e.g., missing Entities → CO+ED capped at 5)

**Summary eval specific:**
- Type-based weight adaptation: Paper / Tech Blog / Tech News
- Type classified from article signals

**Polish eval specific:**
- AI Pattern Checklist as NA evaluation criteria
- Input source pre-check: reject raw analysis or original article input
- FI must check terminology preservation

### 2.4 Template Requirements

#### 2.4.1 Responsibility Boundary

**SKILL.md owns (shared across all templates):**
- Code handling: key snippets as-is, supporting code → descriptions/pseudocode
- Ordering: follow original article flow
- Info source: no fabrication (except proper nouns)
- Word count: must not exceed original
- Quote format: `> **[Verbatim]**: {original sentence}`
- Punctuation: every non-heading sentence ends with punctuation
- Language style: professional, clear, concise

**Templates own (per-template specific):**
- Section layout and ordering
- Per-section content instructions
- Quantity constraints (number of points, quotes, insights)
- Conditional generation rules ("if none exist, do not generate")
- Template-specific highlighting focus

#### 2.4.2 All Templates Must Include

- Shared header: Title, Source, Author, Template name, Word count
- Standout Quotes section (using `[Verbatim]` format)
- Key Terminology section (conditional, table format)
- Version in frontmatter

#### 2.4.3 Template-Specific Structure

**Tech-Article (tech-article.md):**
1. Overview (3-5 sentences + entity background)
2. Key Points at a Glance (5-8 bullet points)
3. Main Content Structure (by article section, with sub-points)
4. Standout Quotes (2-4 quotes with justification)
5. Insights and Inspirations (3-5 insights)
6. Potential Issues (conditional)
7. Key Terminology (conditional)

**Concise (concise.md):**
- Flat bullet list format for quick scanning
- Target length: 800-1500 words (aspirational; hard upper bound = original word count)
- Sections: Background & Problem, Core Technology/Method, Advantages & Innovations, Disadvantages & Limitations (conditional), Conclusions & Applications, Standout Quote, Key Glossary (conditional)

**Paper (paper.md):**
- Academic-oriented structure
- Basic Information block (Reading Date, Keywords)
- Technical Highlights with numbered sub-items (Key Technology, Innovations, Experiments/Validation)
- Reflections (Insights, Questions [conditional], Extensions [limited to paper's own suggestions])
- Action Items (optional)
- Key Terminology (conditional)

### 2.5 Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Rubric band count | 3 (9-10 / 5-8 / 0-4) | 5-band had significant overlap in middle bands; 3-band reduces ambiguity |
| Analysis weights | CO 30 / AC 30 / SC 15 / ED 25 | Completeness and accuracy are foundations; extraction depth > structural clarity (structure fixable downstream) |
| Polish weights | NA 30 / RE 20 / FI 30 / PR 20 | Anti-AI and fidelity are top priority; readability naturally improves with NA |
| Code handling | Tiered: key as-is, supporting simplified | Neither extreme works; tech readers need key code, but full code bloats summary |
| Same-LLM constraint | Defined once in Evaluate Once | Avoids triple repetition; all loops inherit from shared sub-workflow |
| Template vs SKILL.md | Shared rules centralized | Eliminates cross-file contradictions (e.g., code handling said opposite things) |
| Conditional sections | "If none exist, do not generate" | Prevents fabricated content when article has no limitations/terminology |
| SKILL.md decoupled from eval | Main agent only knows threshold | Evaluator internals (dimensions, weights) can change without touching SKILL.md |
| Timer-based timeout | 30 min global for summary loop | Prevents indefinite loops; other loops have fixed round limits |

### 2.6 File Structure

```
yiyue31-summary/
├── SKILL.md                              # Main skill definition & workflow
├── README.md                             # Documentation with flowcharts
├── references/
│   ├── evaluate-analysis-prompt.md       # Analysis evaluation (CO/AC/SC/ED)
│   ├── evaluate-prompt.md                # Summary evaluation (ID/LC/TD/EQ)
│   └── evaluate-polish-prompt.md         # Polish evaluation (NA/RE/FI/PR)
├── scripts/
│   ├── timer.js                          # Timeout tracking for loops
│   └── timer.test.js                     # Timer unit tests
└── templates/
    ├── tech-article.md                   # Tech article template (7 sections)
    ├── paper.md                          # Research paper template
    └── concise.md                        # Quick-review concise template
```

### 2.7 Evolution Timeline

| Date | Phase | Key Change |
|------|-------|------------|
| May 7 | Add scoring | Introduce evaluation loop + scoring rubric |
| May 8 | Restructure | Timer timeout, workflow restructure, SKILL.md decoupling, compact from 145→104 lines |
| May 9 AM | Unify | Dedicated eval prompts per step, merge steps, extract Evaluate Once pattern |
| May 9 PM | Refine | Rubric 5→3 bands, weight rebalancing, template responsibility separation, template rewrite |
