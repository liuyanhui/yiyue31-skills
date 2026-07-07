# CLAUDE.md — yiyue31-context skill

维护本 skill 时先读这份。它讲清楚两件事的边界：skill 定义（SKILL.md）和配套 checker（scripts/），以及改一处时另一处要怎么同步。

## 这个 skill 做什么

为项目各目录生成 CLAUDE.md，给 AI coding 智能体提供"修改上下文"——在这里改代码需要知道什么（主要服务智能体，次要服务人）。不是结构清单。

## 两个组件

- **SKILL.md**：skill 定义。主智能体扫描目录、派 subagent 生成内容；定义六段输出模板和四项分析。改 skill 行为改这里。
- **scripts/**：配套 checker（TypeScript CLI）。校验 skill 生成的 CLAUDE.md 是否符合格式（覆盖率、编码、标记配对、段名白名单、内容一致性）。改校验逻辑改这里。

## 核心设计（改之前先理解意图）

- 六段自适应产出：目录职责 / 关键文件 / 设计要点与原因 / 约定与陷阱 / 依赖关系 / 扩展指南。空段跳过，不强制全填。
- 四项分析驱动产出：废弃文件检测（全模块零引用 → 已废弃）、约定检测（共享锁/返回值/异常风格/集中常量）、同步修改点检测（同接口多实现里的重复方法）、依赖与职责推断。
- 雷区段放在 marker 之外，skill 永不覆盖（只有人知道的陷阱）。
- 既无 `# AI Coding Auto Sections` 标题、又无任何 marker 的文件视为人工文件，report-only，不自动改写。
- marker：`<!-- skill: yiyue31-context | version: X | update_time: ... -->` 到 `<!-- /yiyue31-context -->`。skill 只改 marker 之间的内容；marker 保护人工写的内容不被覆盖——这个 goal-why 不能删。

## SKILL.md ↔ checker 必须同步

SKILL.md 定义输出格式，checker 校验它。改 SKILL.md 的段名/marker/行为时，必须同步：
- 段名集合：SKILL.md 的六段 == checker `DEFAULT_CONFIG.allowed_section_names`（scripts/src/types/config.ts）。
- 行为：report-only、自适应段名等在 checker 的 pipeline-orchestrator.ts 里要有对应实现 + 测试。
- marker 由 `marker-matcher` 弹性匹配：简单形式与带 version 形式都识别；SKILL.md 改 marker 写法时确认仍能被匹配。

## 构建/测试 checker

```bash
cd scripts && npm run build && npm run test   # 串行，约 8s
```

改了 scripts/ 必须保证这两条绿。

## 已知问题

1. **subagent 派发卡顿**（历史，待修 orchestrator/planner）：见 stall-incident-analysis.md。

## 改动约定

- 改 skill 行为：改 SKILL.md；若牵涉段名/marker/产出格式，同步 checker（config.ts 默认值 + 相关 validator）和测试。
- 改 checker：改 scripts/src + 补 scripts/tests，build + test 必须绿。
- 改 SKILL.md 时保留每条规则的 goal-why（marker 保护的原因、父目录先于子目录的原因等），可压缩措辞，不删意图。
