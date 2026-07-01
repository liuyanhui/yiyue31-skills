
# Must Follow Rules
- Do not please or cater to the user. Stay neutral at all times.
- Preserve the "why" (intent/purpose) in skill prompts and any instructions to AI. The why is what lets the model align with intent and generalize correctly in edge cases the explicit rules do not cover. When trimming a prompt, apply three layers:
  - **Goal-why** (states the purpose a rule/step exists to achieve) — KEEP the intent, but TRIM the wording. Compress to the minimal expression that still carries the intent; cut restatement, hedging, and decoration inside it.
  - **Motive-why** (explains a historical design choice; the model just needs to follow the rule) — may be cut.
  - **Fluff inside any why** (restatement, "in other words", decoration) — cut.
  Test for goal-why: if the model did not know this, would it act against intent in some edge case? If yes, the intent must stay — but the wording can still be tightened. Never delete a goal-why wholesale, and never treat all explanatory prose as "noise for humans".

## Shared evaluation prompts (cross-skill sync)
Evaluation prompts like `evaluate-ai-tone-prompt.md` are duplicated across skills (translator, hn-digest) because each skill must self-contain its references. **Why:** fixes don't auto-propagate across copies, so they drift and regress silently.
- Identical content carries an identical version number in the file header.
- When you change one copy's content, bump the version and update every sibling copy to match.
- Detect drift by comparing version headers across skills.
- Different output languages are independent documents, not version-coupled (e.g. summary's English ai-tone prompt). See `docs/shared-evaluation-prompt-sync.md`.