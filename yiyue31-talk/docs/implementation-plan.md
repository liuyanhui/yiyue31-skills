# talk 重构实现计划（已完成，2026-07-31）

> 实现已完成并并入 SKILL.md v0.0.7。本文件保留作施工图历史记录，当前真相以 SKILL.md 为准。

## 目标回顾
采集与生成解耦（content pool）、重点保护、faithfulness 统一、config 问卷、progress 简化。设计决策见 `design-decision-2026-07-31.md`，最终实现见 `../SKILL.md`。

## 文件改动（已落地）
`SKILL.md`（重写）、`README.md`（同步）、`evaluate-faithfulness/reader-appeal/editor-review` prompt（输入改 pool）、`docs/shared-evaluation-prompt-sync.md`（订正）、新增 `design-decision-2026-07-31.md`。

## 评审闭环
- 计划评审 → 补：两段式问卷、faithfulness 定位 quality 段、alt-form 保留、anchor 拆字段、旧会话不兼容、边界护栏（空 pool/孤儿批注/key 优先/软去重）。
- 实现评审 → 9 条核心设计落实，无机制回退，ai-tone 同步与 merge 下游兼容核实通过。
- 完备性评审 → 补：`ref_id` 语义、`length` 字段命名统一、quality 持续不通过出口、迁移表（0 建议/quality 用尽/D3 二次 done 时序）。
- 精简评审 → 提案制去重（3 处→1）、合并断点恢复节、红线（goal-why）全保留。
