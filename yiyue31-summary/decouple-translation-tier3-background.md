# Tier 3 Background — Translation Decoupling: Orchestrator + Generic Contract

> **Purpose.** Self-contained handoff for a fresh session. This doc plus the referenced files are enough to start Tier 3 with no prior conversation context. **Propose a plan before implementing.**
>
> **Origin.** Expands the Tier 3 deferrals in `decouple-translation-plan.md` §5. Tier 2 is shipped and validated; Tier 3 is not started.

---

## 0. Prerequisite reads (absolute paths)

- Tier 2 plan + decisions: `/home/claude/skills/yiyue31-skills/yiyue31-summary/decouple-translation-plan.md`
- The current contract: `/home/claude/skills/yiyue31-skills/yiyue31-summary/references/translation-contract.md`
- summary skill (v2.3.0, Step 7 = manifest + handoff): `/home/claude/skills/yiyue31-skills/yiyue31-summary/SKILL.md`
- translator skill (v2.4.1, 12 steps, writes to `<title>/translation/`): `/home/claude/skills/yiyue31-skills/yiyue31-translator/SKILL.md`
- Repo conventions: `/home/claude/skills/yiyue31-skills/CLAUDE.md` (preserve the why; shared-prompt-sync rule), global `/home/claude/.claude/CLAUDE.md` (memory/serial rules).
- Validated Tier 2 run (working reference): `/home/claude/project/refined-stock/summary/career-advice-ai-3/`

---

## 1. Where things stand (Tier 1 & 2 done)

The translator's *logic* was never duplicated in summary — summary always delegated. The real coupling was a **summary-specific format contract** (`[Verbatim]…[/Verbatim]` markers) scattered across 5 files, plus inline translation in summary's Step 7.

- **Tier 1** (not done — was the minimal option): just move the contract out of inline prose.
- **Tier 2** (shipped, v2.3.0): summary **stops at the English deliverable + a `MANIFEST.md`**. Translation is a **separate, optional** `yiyue31-translator` invocation driven by `references/translation-contract.md`. Step 7 no longer translates inline. The leak where `evaluate-prompt.md` hardcoded "the Step 7 translator" is removed.

**Validated end-to-end:** a summary run on `career-advice-ai` produced `final-career-advice-ai.md` + `MANIFEST.md`; a *separate* translator run, given only the contract, transformed all 11 verbatim markers correctly (`***中文译文（英文原文）***`, zero literal tags, 11/11). See the `career-advice-ai-3/` run.

---

## 2. What Tier 3 is (the four deferred items)

From `decouple-translation-plan.md` §5:

1. **Dedicated orchestrator skill** chaining summary → translator (and, generically, producer → translator).
2. **Generic "translatable artifact" contract** so other skills (`hn-digest`, `paper-layout`, …) can also consume the translator — not just summary.
3. **Clean output co-location** — translation lands next to the producer's run, not in a confusingly nested path.
4. **Auto-chaining vs. explicit-handoff policy** across skills.

---

## 3. The concrete gaps Tier 3 must close

### Gap A — Output co-location (the path caveat) *[most concrete; start here]*
Tier 2 left this as a documented caveat in `translation-contract.md`. Real behavior from the validation run: running the translator on a summary whose run lives in a **per-run directory** `career-advice-ai-3/` produced the translation at:
```
career-advice-ai-3/career-advice-ai/translation/translated-career-advice-ai-zh.md
```
The nesting `career-advice-ai-3/career-advice-ai/` is the defect: the translator derives its output directory from the **article title** (`career-advice-ai`), not the **run directory** (`career-advice-ai-3`). The contract's "Path caveat" section explains this; Tier 3 must **resolve** it (clean co-location), not just document it.

### Gap B — No reuse surface
Only `yiyue31-summary` invokes the translator today (grep-confirmed). The contract is **summary-specific** (the `[Verbatim]` marker format). `hn-digest` shares some eval *prompts* with the translator but does **not** call it; `paper-layout` has no translation path at all. Tier 3 needs a contract generic enough for multiple producers.

### Gap C — No orchestration
After Tier 2, the user must **manually** run summary, then manually run the translator on its output. Tier 3 provides a chaining mechanism so this is one coherent operation (while preserving the option to split — see Constraints).

### Gap D — UX: one-command vs. two-command
Tier 2 **deliberately** split the pipeline into two steps for a reason: the summary + translator pipeline is very heavy, and splitting at the file boundary lets translation run in a **fresh session**, bounding memory (see global CLAUDE.md: "重活优先开新会话"). Tier 3's auto-chain decision must **not** regress this — auto-chaining should still allow/encourage session splitting, or it risks OOM on this ~1 GB machine.

---

## 4. Existing precedent in this repo (study before designing)

- **`yiyue31-orchestrator` skill** — generic task-list executor: reads `./task-list.md`, runs an Orchestrator-Generator-Evaluator loop, delegates each task. **Open question:** does summary→translator fit this generic model, or does it need a purpose-built orchestrator?
- **`yiyue31-planner` skill** — generates structured work plans (Planner-Generator-Reviewer, 10 quality dimensions).
- **`/home/claude/skills/yiyue31-skills/docs/planner-design-background.md`** — orchestration philosophy; read for design alignment.
- **`/home/claude/skills/yiyue31-skills/docs/shared-evaluation-prompt-sync.md`** — the cross-skill sync pattern. **Relevant:** if the generic contract (or any prompt) is duplicated across skills, the version-sync rule applies.

---

## 5. Key design questions to resolve in the new session

1. **Reuse scope.** Which producers will actually consume translation (`hn-digest`? `paper-layout`? others?)? This determines whether the generic contract earns its complexity. *If only summary will ever use it, Tier 3 may not be worth it — reconfirm before building.*
2. **Orchestrator approach.** New purpose-built skill vs. extend `yiyue31-orchestrator` vs. a thin wrapper script/skill. Trade off generality vs. specificity.
3. **Generic contract shape.** What is the "translatable artifact" interface? Candidate directions: (a) a manifest convention every producer emits (summary's `MANIFEST.md` generalizes); (b) a shared contract doc + per-producer manifest; (c) a small spec a producer's output must satisfy. Pick one and justify.
4. **Verbatim-format generalization.** summary's `[Verbatim]…[/Verbatim]` → `***中文（英文）***` is summary-specific. Other producers may have their own inline-highlight conventions (or none). The generic contract must either define a shared marker format or let each producer declare its own in its manifest.
5. **Output-location policy.** Convention for where translation lands relative to producer output — so Gap A stops recurring. Likely involves the orchestrator controlling the translator's working dir / title, or a post-step relocation.
6. **Auto-chain vs. handoff.** Does the orchestrator run translation automatically, or emit a handoff? Must preserve the memory-friendly split (Gap D).
7. **Backward compatibility.** Do **not** break Tier 2's validated contract. The career-advice-ai-3 run must still pass after Tier 3.

---

## 6. Constraints to honor

- **Memory / serial execution** (global CLAUDE.md): serial subagents only (no parallel fan-out); heavy multi-round work in a fresh session; minimize subagent count. The orchestrator itself must not become a memory hazard.
- **Preserve the "why"** (project CLAUDE.md): keep intent in prompts/instructions; trim wording, not goal-why.
- **Shared-prompt-sync**: if contracts/prompts are duplicated across skills, version-sync them.
- **Consume, don't rewrite, the translator.** It is v2.4.1 and mature. Tier 3 orchestrates it; it should not duplicate or fork its 12 steps.

---

## 7. Validation baseline

Tier 2 was validated with `career-advice-ai-3/` (refined-stock repo). After Tier 3, **re-run the same handoff** and confirm: (a) the translation still lands in a *clean, co-located* path (Gap A fixed), (b) all 11 verbatim markers still transform correctly (no regression), (c) the orchestration works end-to-end from one invocation. That run is the regression target.

---

## 8. Quick file map

| What | Path |
|------|------|
| This doc | `yiyue31-summary/decouple-translation-tier3-background.md` |
| Tier 2 plan | `yiyue31-summary/decouple-translation-plan.md` |
| Current contract | `yiyue31-summary/references/translation-contract.md` |
| summary skill | `yiyue31-summary/SKILL.md` (v2.3.0) |
| translator skill | `yiyue31-translator/SKILL.md` (v2.4.1) |
| orchestrator skill | `yiyue31-orchestrator/` (precedent) |
| planner skill | `yiyue31-planner/` (precedent) |
| design docs | `docs/planner-design-background.md`, `docs/shared-evaluation-prompt-sync.md` |
| validated run | `/home/claude/project/refined-stock/summary/career-advice-ai-3/` |
