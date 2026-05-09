# yiyue31-summary-generator

Intelligent article summary generator supporting multiple templates.

## Core Features

- **Multiple Templates** - Tech Article / Paper / Concise Notes (default)
- **Intelligent Analysis** - Auto-detect article type, topic, terminology, highlights
- **Quality Assurance** - Generate-Evaluate loops with scored evaluation at each stage
- **Multiple Inputs** - URL, file path, direct paste

## Quick Start

```bash
# Summarize a URL
Summarize https://example.com/react-hooks

# Summarize a file
Summarize ./articles/python-async.md

# English output
Summarize https://example.com/react-hooks
```

## Templates

| Template         | Use Case                         |
|------------------|----------------------------------|
| **Tech Article** | Tech blogs, announcements        |
| **Paper**        | Academic papers, research reports|
| **Concise Notes**| Quick learning, review           |

## Workflow

```dot
digraph workflow {
    rankdir=TB;
    node [shape=box, style=filled, fillcolor="#f5f5f5", fontname="Arial"];
    edge [fontname="Arial", fontsize=10];

    step1 [label="Step 1\nRetrieve & Preprocess", fillcolor="#e3f2fd"];
    step2 [label="Step 2\nAnalyze Article\n(Generate-Evaluate Loop ×3)", fillcolor="#fff3e0"];
    step3 [label="Step 3\nTemplate Selection", fillcolor="#e8f5e9"];
    step4 [label="Step 4\nGenerate Summary\n(Generate-Evaluate Loop ×5)", fillcolor="#fff3e0"];
    step5 [label="Step 5\nPolish Summary\n(Generate-Evaluate Loop ×3)", fillcolor="#fff3e0"];
    done [label="Done → final-{title}.md", shape=ellipse, fillcolor="#c8e6c9"];

    step1 -> step2;
    step2 -> step3;
    step3 -> step4;
    step4 -> step5;
    step5 -> done;
}
```

### Generate-Evaluate Loop Detail

All three loops (Step 2, Step 4, Step 5) follow the same pattern:

```dot
digraph loop {
    rankdir=TB;
    node [fontname="Arial"];
    edge [fontname="Arial", fontsize=10];

    start [label="Round N", shape=box, style=filled, fillcolor="#f5f5f5"];
    generate [label="Generate / Revise\n(based on previous Issues table)", shape=box, style=filled, fillcolor="#e3f2fd"];
    save_round [label="Save\n{type}-round{N}-{title}.md", shape=box, style=filled, fillcolor="#f5f5f5"];
    evaluate [label="Evaluate\n(subagent via evaluate-prompt)", shape=box, style=filled, fillcolor="#fff3e0"];
    save_eval [label="Save\nevaluation-{type}-round{N}-{title}.md", shape=box, style=filled, fillcolor="#f5f5f5"];
    check [label="Score ≥ 8.0?", shape=diamond, style=filled, fillcolor="#fce4ec"];
    track [label="Track best candidate", shape=box, style=filled, fillcolor="#f5f5f5"];
    more [label="More rounds?", shape=diamond, style=filled, fillcolor="#fce4ec"];
    exit_pass [label="Copy best round →\n{type}-{title}.md\n(or final-{title}.md)", shape=box, style=filled, fillcolor="#c8e6c9"];
    exit_exhaust [label="Copy best-scoring round →\n{type}-{title}.md\n(or final-{title}.md)", shape=box, style=filled, fillcolor="#c8e6c9"];

    start -> generate;
    generate -> save_round;
    save_round -> evaluate;
    evaluate -> save_eval;
    save_eval -> check;
    check -> exit_pass [label="Yes"];
    check -> track [label="No"];
    track -> more;
    more -> generate [label="Yes, N+1", style=dashed];
    more -> exit_exhaust [label="No (exhausted)"];
}
```

### Loop Parameters per Step

| Step | Type | Max Rounds | Timeout | Output |
| ----- | ----- | ---------- | ------- | ------ |
| Step 2 | Analysis | 3 | — | `analysis-{title}.md` |
| Step 4 | Summary | 5 | 30 min | `summary-{title}.md` |
| Step 5 | Polish | 3 | — | `final-{title}.md` |

## Output Files

```text
{title}/summary/
  ├── original-{title}.md                       # Original article (Step 1)
  ├── analysis-round{N}-{title}.md              # Analysis drafts (Step 2)
  ├── evaluation-analysis-round{N}-{title}.md   # Analysis eval reports (Step 2)
  ├── analysis-{title}.md                       # Best analysis (Step 2 output)
  ├── summary-round{N}-{title}.md               # Summary drafts (Step 4)
  ├── evaluation-round{N}-{title}.md            # Summary eval reports (Step 4)
  ├── summary-{title}.md                        # Best summary (Step 4 output)
  ├── polish-round{N}-{title}.md                # Polish drafts (Step 5)
  ├── evaluation-polish-round{N}-{title}.md     # Polish eval reports (Step 5)
  └── final-{title}.md                          # Final output (Step 5 output)
```

---

**Detailed Workflow**: [SKILL.md](./SKILL.md)
