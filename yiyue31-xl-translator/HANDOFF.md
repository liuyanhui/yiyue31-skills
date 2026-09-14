# HANDOFF：xl-translator skill 开发交接（冷启动文档）

> **本文自足**：读完即可在任何机器继续任务，不需要先读其他文档。文末索引仅供可选深查。
> 最后更新：2026-09-14（M3 完成后）。

## 0. 当前状态与你的任务

| 里程碑 | 状态 | 交付 |
|---|---|---|
| M1a segment + verify-mech | ✅ 已提交 | 15b26b0 之前 |
| M1b status.mjs 状态机 | ✅ 已提交 | 76cda1a |
| M1c 交付门 + M2 编排层 | ✅ 已提交 | dce7390 |
| M3 前置五件 | ✅ 已提交 | 9877336 |
| **M3 试运行标定** | ✅ **完成（未提交部分见 §3）** | 2026-09-11 终检 PASS，交付 AI-Native-SDLC-playbook 中文全译 |
| **M3 回写（skill 修改）** | ⬜ **当前任务** | 计划见 `docs/m3-writeback-plan.md` |
| M4 验收 → M5 部署 | ⬜ 待回写后 | — |

**你的任务 = 按 `docs/m3-writeback-plan.md` 实施**：A 组提交既修 → B/C/D 组按序实施。计划中每项含问题、M3 证据、拟议方案、改动面、验收。**方案需 Yiyue 裁定**（整批或逐项，先例：R18 曾整批全按建议）——开工前确认裁定状态。

## 1. 两个仓库（跨机以你的 clone 布局为准，勿依赖绝对路径）

| 仓库 | 内容 | 你需要的文件 |
|---|---|---|
| **本仓库**（yiyue31-skills 下的 yiyue31-xl-translator） | skill 本体：SKILL.md / scripts/ / references/ / probe/ | 全部 |
| **运行仓库**（refined-stock，兄弟目录） | M3 试运行的语料与产物 | `xl-translator/m3-outbox/M3-标定记录.md`（回写取证的唯一权威）；`xl-translator/AI-Native-SDLC-playbook/`（交付物 + 台账 + 报告） |

冷启动前提：两仓库均已 pull 到最新。

## 2. 冷启动步骤

1. `git pull`（本仓库 + 运行仓库）
2. 读本文档 → 读 `docs/m3-writeback-plan.md`
3. 核对 §3 git 状态是否干净（若脏，先补齐提交——清单在 §3）
4. 确认 Yiyue 对计划的裁定（若未裁定，先请裁）
5. 按计划实施顺序开工；每完成一组跑 `bash scripts/test/run.sh`（串行，全绿为准）
6. 提交规约：一组一提交或全量一提交均可，信息含测试计数；**源仓不 commit（Yiyue 未要求时）；fork 纪律：translator 仓只读参考，零共享零回写**

## 3. 本仓库 git 状态（2026-09-14 快照）

未提交变更（M3 期间产出，计划 A 组内容 + 探针 truth）：

```
M scripts/final-gate.mjs        # A4 文件名标题豁免
M scripts/handoff.mjs           # A1 围栏豁免 + A2 别名渲染
M scripts/status.mjs            # M3 前置遗留（先 review diff 再定去留）
M scripts/test/unit/handoff.test.mjs     # A1/A2 测试
M scripts/test/unit/verify-mech.test.mjs # A3 测试
M scripts/verify-mech.mjs       # A3 裸域名豁免（或含前置遗留，review diff）
?? probe/                       # M3 探针 truth（m3-playbook-r1.json 等）
?? docs/m3-writeback-plan.md    # 本计划
?? HANDOFF.md                   # 本文档（重写）
```

注：`status.mjs` 与 `verify-mech.mjs` 的改动混有 M3 前置会话未提交内容——提交前逐文件 review diff，确认无未登记改动。

## 4. 硬约束与环境注意

- 测试串行入口 `bash scripts/test/run.sh`（逐文件 `node --test scripts/test/unit/<x>.test.mjs` 亦可）
- **Windows Git Bash 下 node -e 内联脚本转义不可靠**（反斜杠/反引号会 mangle）——任何非平凡 node 脚本写成临时 .mjs 文件运行（M3 反复实证）
- ESM 从绝对路径导入须用 `file:///D:/...` URL 形式
- M3 实证 subagent 可用（审校/裁定/冷读均 subagent 化）；旧文档"1.87GB 不起 subagent"约束已过时
- API 侧环境损耗处置模板（M3 沉淀，计划 D1 将入 SKILL.md）：429[1302] 突发即补派 / 429[1308] 配额定时等窗 / 并发 ≤5 两波制 / 流停滞先核验无半成品再原样重派
- 注释/文档中文；`agent`（AI 义）译"智能体"、`token`（AI 义）译"词元"

## 5. 运行侧未决（Yiyue 裁定，非本仓改动）

1. 交付物元信息「发布时间：2001-08-21」疑源料笔误（创建时间 2026-08-26）——修正或保留
2. 交付物尾段承诺的文档列表，源文剪藏即缺失——保留或加译注
（裁定后径改运行仓库交付物并重跑 final-gate 即可，不影响本仓回写）

## 6. 可选深查索引

| 文件 | 用途 |
|---|---|
| `docs/m3-writeback-plan.md` | 当前任务计划（含 M3 证据索引） |
| 运行仓库 `xl-translator/m3-outbox/M3-标定记录.md` | M3 全程时间线与观测（回写取证权威） |
| `DESIGN.md` v2 | §2 各步权威规格、§5.1 冻结契约、§6 里程碑、§9 裁决全录 |
| `SKILL.md` v0.3.1 | 五步流水线与编排规则（回写主对象之一） |
| `scripts/test/README.md` | 测试两层分工与维护规约 |
