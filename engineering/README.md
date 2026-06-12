# Yiyue31 Agents

Two agents for structured project planning and execution.

## Agents

| Agent | File | Purpose |
| ----- | ---- | ------- |
| **yiyue31-planner** | `yiyue31-planner.md` | Generate structured work plan documents from user requirements |
| **yiyue31-orchestrator** | `yiyue31-orchestrator.md` | Execute a task plan through Orchestrator-Generator-Evaluator loop |

## Relationship

```
User Requirements
       │
       ▼
┌──────────────────┐
│  yiyue31-planner │  Generate plan
│                  │  (Planner-Generator-Reviewer loop)
└────────┬─────────┘
         │
         │  outputs ./task-list.md
         │
         ▼
   User reviews / confirms / edits
         │
         ▼
┌────────────────────────────┐
│ yiyue31-orchestrator       │  Execute plan
│                            │  (Orchestrator-Generator-Evaluator loop)
└──────────┬──────────────────┘
         │
         │  outputs ./execution-report.md
         │
         ▼
    Project complete
```

### Data Flow

- **yiyue31-planner** produces `./task-list.md` — the plan document.
- User reviews the plan, confirms or edits it.
- **yiyue31-orchestrator** reads `./task-list.md` and executes tasks one by one.
- If orchestrator discovers plan defects, it reports to user and suggests re-running yiyue31-planner.

### Format Contract: Task List

The task item format is defined **only in yiyue31-planner**. When planner generates `./task-list.md`, the document includes a self-describing header with field explanations and examples. yiyue31-orchestrator reads the file and understands the format from the document itself — no separate format specification needed.

Format authority: `yiyue31-planner.md` → Task List Format section (Document Header + Task Item Template)

## Triggering

| User Intent | Agent | How |
| ----------- | ----- | --- |
| "Create a work plan" / "Plan this project" | yiyue31-planner | `Agent` tool with `subagent_type: "yiyue31-planner"` |
| "Execute the plan" / "Start the task list" | yiyue31-orchestrator | `Agent` tool with `subagent_type: "yiyue31-orchestrator"` |

## Differences

| Aspect | yiyue31-planner | yiyue31-orchestrator |
| ------ | --------------- | ---------------- |
| Input | User requirements | ./task-list.md |
| Output | ./task-list.md + ./work-plan-report.md | ./execution-report.md |
| Quality role | Adversarial Reviewer (finds flaws) | Evaluator (checks criteria) |
| Deliverable | Single plan document | Multiple task outputs |
| Loop unit | Entire plan | Each task |
| Max rounds | Fixed 5 | Per-task (3 or 5) |
| Permission | Generator writes plan only | Generator writes within task constraints |
