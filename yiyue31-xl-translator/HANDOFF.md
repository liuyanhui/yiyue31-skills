# HANDOFF：M1a 脚本层开工（新会话冷启动用）

> **给新会话执行者**：本文件自足——读完即可开工，不需要先读其他文档。文末索引仅供可选深查。
> **任务来源**：Yiyue 2026-08-31 指令"生成 handoff"。上一里程碑（SKILL.md 骨架 v0.2.0 + 三方评审 15 项修订回写 + 复审二次修补）已收口，本 handoff 开启 **M1a**。

---

## 0. 你的任务

在 `~/skills/yiyue31-skills/yiyue31-xl-translator/scripts/` 下产出两个脚本（DESIGN §6 里程碑 M1a 行）：

1. **`segment/`**——fork `yiyue31-translator/scripts/doc_segmenter/` 改造：大文档分段（规格见 §3）
2. **`verify-mech.mjs`**——fork `yiyue31-translator/scripts/verify-mechanical.js` 扩展：机械校验（规格见 §5）

**执行顺序**：先 `verify-mech.mjs`（规格全冻结，无待裁决项），后 `segment/`（受 R11 裁决影响，见 §4）。全程主 agent 直接写码 + 自测，**不起 subagent**（低内存纪律）；单元测试串行跑。

## 1. 背景一段话

`yiyue31-xl-translator` 是把 **>40KB 英文大文档**译成专业中文的 Claude Code skill，完全独立于现有 `yiyue31-translator`（≤40KB 用）。源于真实事故：64KB 文档被碎成 53 片、212 份审校在低内存串行机器上不可达成、执行 agent 系统性造假。当前状态：需求 v0.4 + 设计 v2（含 §5.2 引用封闭集 + §9 三方评审记录 R1-R20）+ SKILL.md v0.2.0-skeleton（15 项评审修订已回写并复审收口）+ refined-stock `.gitignore` 已落（R12，已实测）。里程碑序：**M1a（本任务）** → M1b 状态机 → M1c 交付门 → M2 走查（部署前置）→ M3 试跑标定 → M4 验收 → M5 部署。

## 2. 硬约束（环境，不可违背）

- 本机 1.87GB 内存：**不起 subagent**；测试串行（`node --test` 串行或自写 test 脚本，禁并行）
- 全部产物在 `~/skills/yiyue31-skills/yiyue31-xl-translator/`；文件/目录名短（Windows 260 限制）
- **fork 纪律**：源在 `~/skills/yiyue31-skills/yiyue31-translator/scripts/`（doc_segmenter/ 目录、verify-mechanical.js）——**一次性拷贝改造，绝不回写源文件**（与 translator 零共享）
- **新文件必须先入 DESIGN §5/§5.2 表再编码**（自家规矩；本任务两个产物名已在 §5.2 表内，勿新增其他文件——测试样例放 `scripts/segment/test/` 或同級 `testdata/`，命名避开 `-zh.md` 结尾与 `summary-/talk-/merge-/final-/recommendation-` 前缀）
- 注释/文档中文；`agent`（AI 义）译"智能体"、`token`（AI 义）译"词元"
- 源仓库不 commit（Yiyue 未要求时）

## 3. segment/ 规格（权威出处：DESIGN §2 Step 1；此处仅摘录）

- **目标带 8-15KB**：跨级别合并（小节合并到落带）；code block/表格**原子不可切**；巨块允许超限单 chunk 并以 `chunk-<NN>X-<slug>` 标记（**X 后缀规则受 R11 影响，见 §4**）
- **fence 感知**：标题解析跳过代码围栏——干跑实测 30 个标题行 11 个在围栏内，正是 53 碎片事故的同源病灶，**必测**
- **分布自检闭环**：chunk 尺寸分布不落目标带 → 自动调参重分段（附录 A #1）
- **关卡：拼接 sha === 原文 sha**（钉死分母，防偷删）
- 产物：`chunks/chunk-<NN>-<slug>.md` + `manifest.md`（heading 树）+ `progress.json`（**缓存非事实源**，文件内明文注明）
- 命名细则（`<slug>` ≤30 字符等）见 DESIGN §5.1

## 4. R11 待裁决（segment 开工前呈报 Yiyue，二选一）

**问题**：巨块超限单 chunk × 半块固定切两份（现行 §5.1）——60KB 巨块半块=30KB 远超审校甜点区，500KB 场景注意力稀释复发。

- **选项 A**：巨块送审按 **~15KB 上界切 N 段**（h∈a|b 扩多段）——segment 产物不变，改的是审校单元规格（落 DESIGN §5.1 半块行 + §2 Step 6）
- **选项 B**：**收紧 Step 1 巨块条件**——仅 fence/表格原子块可超限，散文巨块强制再切——segment 改造多一条规则

裁决前 verify-mech 可先做完；裁决后把结果记入 DESIGN（§2 Step 1/6 + §5.1 + §7 划销 R11 + §9 R11 行标注），再动 segment。

## 5. verify-mech.mjs 规格（权威出处：DESIGN §2 Step 5）

- **原五项硬判**（fork 源行为不回归）：code / SVG / URL / keep-list / «» 残留
- **新四项**：①数字/单位保真 ②散文残留英文阈值 ③中英间距 ④段落计数/长度比下限（防空洞化）
- **同 chunk 机械打回 ≤2 次 → 升级**（R4）：计数归 status.mjs（M1b），本脚本只做**单次判定 + 明确退出码**（pass/fail+fail 项清单），供上层计次
- 结果落盘 `verify-results.json`（含译文 sha；**终检不信任它、会重跑**——文件头注释注明）
- **R8 未裁决不做**：术语兑现硬判（投影条目既定译名未出现即打回）是 ⚖️ 项，勿提前实现
- 输入约定：chunk 原文路径 + 译文路径 + keep-list 路径 + brief（注释密度等阈值来源）

## 6. 完成判据（自查后再交）

- [ ] 拼接 sha === 原文 sha 自测通过（构造含围栏/表格/巨块样例）
- [ ] fence 感知自测：≥30 标题行、≥11 在代码围栏内的样例，无一误切
- [ ] 原五项硬判继承且不回归（对 fork 源既有行为做对照测试）；新四项各有单测
- [ ] 尺寸分布落 8-15KB 带；不落带自动调参重分段闭环可演示
- [ ] 巨块路径按 R11 裁决结果实现并自测；裁决已记回 DESIGN
- [ ] 未修改 fork 源；产物全落 `xl-translator/scripts/`；无新增表外文件
- [ ] 测试全部串行执行，通过后向 Yiyue 汇报（含自测清单与结果）

## 7. 完成后的下一步（向 Yiyue 汇报时建议）

**M1b 状态机**（`status.mjs`：stale 半块级分类/升级态/PENDING-USER 含选项菜单/原文 re-keying 冻结语义/探针队列注入/用户动词表/双段契约输出人话+动作指令）——**另开新会话**；届时需一并落地 §7.5 计数器清零规则（升级后清零、每轮升级至多一次、累计升级 ≥2 转 PENDING-USER）。剩余待裁决：R3/R8/R16/R18（见 DESIGN §7.4）。

## 8. 可选深查索引（非必需）

| 文件 | 用途 |
|---|---|
| `DESIGN.md` v2 | §2 Step 1/5 规格 / §5.1 命名 schema / §5.2 引用封闭集 / §6 里程碑 / §9 评审记录 R1-R20 |
| `SKILL.md` v0.2.0-skeleton | 编排骨架（M2 走查对象，本任务不改动它） |
| `yiyue31-translator/scripts/doc_segmenter/` | segment 的 fork 源 |
| `yiyue31-translator/scripts/verify-mechanical.js` | verify-mech 的 fork 源 |
