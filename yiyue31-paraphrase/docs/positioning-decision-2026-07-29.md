# yiyue31-paraphrase 定位决策（2026-07-29）

## 决定
把 skill 定位从「精简压缩型转述」改为「面向大众读者、可理解的转述」。优先级轴由 `保真 > 地道 > 精简` 改为 `保真 > 读者可理解性 > 地道 > 精简`。

## 起因
2026-07-29 处理《The new rules of context engineering for Claude 5 models》后复盘（见 `execution-report-2026-07-29.md`）：对技术从业者适配良好（忠实度 9.5），但对大众/跨领域读者门槛过高（读者适配 6/10；大众画像 39 个 blocking）。根因是定位本身——压缩器优先精简，读者门把可查词列为不阻塞。

## 做了什么
- 新增规则层 L3 可理解性（R12 术语释义 / R13 概念关系桥 / R14 因果桥），并入 `expression-rules.md` SSOT，由读者门验收（不加新门）。
- 给「授权补桥」画与金句例外同构的边界：只允许用大白话重述源文已有含义；仍禁编造（新数据/论断/引文/绝对化/类比）。faithfulness 据此放行、conciseness 据此豁免、reader-audit 据此消解 blocking。
- L2 精简降级：R9 仍删废话，但豁免 L3 补桥。
- 单一模式（不做多受众分层）。R0 / L1 / `verify-no-first-person.js` 不变。version 0.0.1 → 0.1.0。

## 明确不做（及原因）
- **受众分层（多版本输出）**：维护与 drift 成本高，且本次目标是重定义定位而非加功能。单一模式已覆盖核心诉求。
- **故事化 / 类比（深度解释）**：类比易成无中生有（破坏 faithfulness 硬护栏）、易触发 ai-tone 门的戏剧化元叙述、与平实写作偏好冲突。故解释深度取「中」（释义+背景+因果桥），不取「深」。
- **工作流效率类**（合并步骤 / 减少质检门 / 规则检查清单 / 进度可视化等，见 `improvement-recommendations.md` 其余路线图）：与本次定位重定义无关，留待后续独立评估。

## 同步不变量
未改动 `evaluate-ai-tone-prompt.md`（跨 skill 同步项）；`node scripts/check-prompt-sync.js` 保持 exit 0。

## 关于本目录既有分析文档
`execution-report-2026-07-29.md` / `general-reader-adaptation-analysis.md` / `improvement-recommendations.md` 是定位调整前的分析草稿，描述的路线图比实际落地大得多，保留作历史参考，不代表当前实现。
