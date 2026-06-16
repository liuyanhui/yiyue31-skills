# Yiyue31 Planner & Orchestrator

Two agents for structured project planning and execution: **planner** produces a verified task plan, **orchestrator** executes it task by task. They are decoupled and communicate only through the plan document.

> Chinese reference translations: `planner/yiyue31-planner-CN.md`, `orchestrator/yiyue31-orchestrator-CN.md` (the English `SKILL.md` files are authoritative).

## Agents

| Agent | File | Purpose |
| ----- | ---- | ------- |
| **yiyue31-planner** | `planner/SKILL.md` | Generate a structured, reviewed task plan (YAML) from user requirements |
| **yiyue31-orchestrator** | `orchestrator/SKILL.md` | Execute the plan task by task through an Orchestrator-Generator-Evaluator loop |

## Design Principles

These principles govern the two agents and any future changes to them.

1. **Planner first, then orchestrator.** Before executing any work, run planner to produce the task plan, then run orchestrator to execute it.
2. **Planner and orchestrator are decoupled.** They do not know of each other's existence; information passes only through the plan document. The contract that makes this work: each task carries a stable `id` (a label, never used for ordering) and a numeric `seq` (execution order); re-planning never renumbers existing `id`s, so an already-completed task keeps its identity and orchestrator can resume without coordination.
3. **Execution needs no human intervention by default.** Tasks run one after another with no manual steps. Human involvement (and re-running planner to rewrite the plan) is reserved for cases where the plan has serious defects.
4. **Planner controls plan document size.** Planner keeps the plan bounded and splits it into a document set (overview + per-phase sub-documents) when necessary, so the orchestrator's context does not overflow during execution.
5. **Arbitrary task start (resume-from-checkpoint).** A plan must support starting execution from any task.

## Relationship

```
User Requirements
       │
       ▼
┌──────────────────┐
│  yiyue31-planner │  Generate plan
│                  │  (Planner-Generator-Reviewer loop)
└────────┬─────────┘
         │  outputs ./task-list.yaml (overview) + ./tasks-NN.yaml (sub-docs)
         ▼
   User reviews / confirms / edits
         │
         ▼
┌────────────────────────────┐
│ yiyue31-orchestrator       │  Execute plan
│                            │  (Orchestrator-Generator-Evaluator loop)
└──────────┬──────────────────┘
         │  outputs ./execution-report.md
         ▼
    Project complete
```

### Data Flow

- **planner** produces `./task-list.yaml` (the overview) and, for large plans, `./tasks-NN.yaml` sub-documents. It also writes `./work-plan-report.md`.
- User reviews the plan, confirms or edits it.
- **orchestrator** reads `./task-list.yaml`, then loads one sub-document at a time, and executes tasks in `seq` order.
- Task runtime state is written back into the plan YAML (`status`, `current_round`, `evaluation_result`); a minimal cross-session snapshot lives in `./task-progress.json` so execution can resume after a restart.
- If orchestrator discovers plan defects, it reports to the user and suggests re-planning.

### Format Contract: Task List

The task format is defined **only in planner** (`planner/SKILL.md` → Plan Document Format). The plan is YAML and self-describing: the overview carries the field definitions once, and each task has `id` + `seq` plus the fields orchestrator needs (`description`, `constraints`, `deliverable`, `evaluation_criteria`, `evaluation_method`, etc.). orchestrator reads the file and understands the format from the document itself — no separate spec.

## Triggering

| User Intent | Agent | How |
| ----------- | ----- | --- |
| "Create a work plan" / "Plan this project" | yiyue31-planner | `Agent` tool with `subagent_type: "yiyue31-planner"` |
| "Execute the plan" / "Start the task list" | yiyue31-orchestrator | `Agent` tool with `subagent_type: "yiyue31-orchestrator"` |

> orchestrator has `disable-model-invocation: true` — it is triggered only by an explicit user request, never auto-invoked by the model.

## Differences

| Aspect | yiyue31-planner | yiyue31-orchestrator |
| ------ | --------------- | ---------------- |
| Input | User requirements | ./task-list.yaml (+ sub-docs) |
| Output | ./task-list.yaml + ./tasks-NN.yaml + ./work-plan-report.md | ./execution-report.md |
| Quality role | Adversarial Reviewer (finds flaws) | Evaluator (checks criteria) |
| Deliverable | Plan document set | Multiple task outputs |
| Loop unit | Entire plan | Each task |
| Max rounds | Fixed 5 | Per-task (3 or 5) |
| Permission | Generator writes plan only | Generator writes within task constraints |
