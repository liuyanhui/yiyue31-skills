# HANDOFF：M1c 交付门开工（新会话冷启动用）

> **给新会话执行者**：本文件自足——读完即可开工，不需要先读其他文档。文末索引仅供可选深查。
> **任务来源**：M1b 已于 2026-09-01 收口（status.mjs + 15 单测，全套 63 项串行全过）。R18 六项已于 2026-08-31 全部裁决（无待裁决项）。本任务 = **M1c：final-gate.mjs + probe.mjs + merge.mjs**。
> **仓库状态**：master 干净，M1b 及此前全部交付均已提交。`scripts/test/` 为独立测试目录（unit/ + regression/ + run.sh 串行入口），新测试按其 README 维护规约入对应层。

---

## 0. 你的任务

在 `~/skills/yiyue31-skills/yiyue31-xl-translator/scripts/` 下产出三件（均已在 DESIGN §5.2 B 表登记，勿新增表外文件）：

1. **`merge.mjs`**（Step 8 本体，2026-08-31 裁决补登记）——确定性组装
2. **`probe.mjs`**（源侧）——探针样本生成 + ground truth
3. **`final-gate.mjs`**（Step 10 交付门）——重执行一切 + 原子改名

**执行序**：merge → probe → final-gate（final-gate 依赖前两者的导出函数）。全程主 agent 直接写码 + 自测，**不起 subagent**（低内存纪律）；测试串行（`bash scripts/test/run.sh`）。

## 1. 背景一段话

`yiyue31-xl-translator` 是把 >40KB 英文大文档译成专业中文的 Claude Code skill。已交付：需求 v0.4 + 设计 v2（全部裁决回写完毕，零待裁决项）+ M1a（segment + verify-mech，真实文档回归层）+ M1b（status.mjs：文件系统推导、status.md 唯一续跑文档、staging/ 统一物化、events.jsonl 计数器、六动词）。里程碑序：**M1c（本任务）** → M2 走查 → M3 试跑标定 → M4 验收 → M5 部署。

## 2. 硬约束（环境，不可违背）

- 本机 1.87GB 内存：**不起 subagent**；测试串行（`bash scripts/test/run.sh`，逐文件）
- 全部产物在 `~/skills/yiyue31-skills/yiyue31-xl-translator/`；新文件先入 §5.1/§5.2 表再编码（本任务三件均已在表）
- 注释/文档中文；`agent`（AI 义）译"智能体"、`token`（AI 义）译"词元"
- fork 纪律：translator 仓只读参考，零共享零回写
- 源仓不 commit（Yiyue 未要求时）

## 3. merge.mjs 规格（权威出处 DESIGN §2 Step 8 + scripts/test/README.md「行为场景类回归契约」）

- **确定性组装**：chunk 按 **NN 数值序**（禁字典序 R29）拼接；只收"最新机械校验 passed"chunk（依据 verify-results.json）；清 «» 临时标记（残留必须 0 且清标有记录）→ **临时名** `merged-draft.md` 落盘（不命中任何发布模式）
- **固定判据 M1-M7**（测试即按此写，契约已在 `scripts/test/README.md` 登记）：
  M1 拼接字节保真 / M2 收录集合恰 = 最新 passed / M3 «» 清零有记录 / M4 临时名不命中 deliverable / M5 同输入重跑字节相同 / M6 输入损坏（缺 chunk/乱序/sha 不符）非零退出报错绝不静默拼残稿 / M7 零改写（无 BOM/EOL 改写/无 `"\n\n"` 插入）
- **导出纯函数**供 final-gate"从 translated-chunks 重导出 merged 做 diff"复用（重执行 = 换调用点不重写逻辑）
- 测试：`unit/merge.test.mjs` + `regression/fixtures/merge/{happy,partial,residue,broken}/case-NN/` 工作目录快照（译文文本用真实中文，场景装置合成；目录自动发现）

## 4. probe.mjs 规格（源侧；DESIGN §2 Step 10 探针机制 + §5.1 统一物化）

- 生成探针样本：`{ dim, half, text }[]`，写入**源侧** `probe/truth/<run>.json`（含 unit↔真假/缺陷类型/预期命中点）——**不落工作区**
- 虚拟 NN ∈ 901-999（真实 chunk 上界 640，永不冲突）
- 与 status.mjs 的接口已就位：`run(dir, { probeTruth: <file> })` 读取 truth 并把探针混入队列（M1b 已实现，实测同构不可分辨）

## 5. final-gate.mjs 规格（权威出处 DESIGN §2 Step 10）

- **重执行一切确定性检查**（不信任何落盘日志）：机械校验全项重跑；从 translated-chunks 重导出 merged 做 diff（复用 merge.mjs 纯函数）；拼接 sha 复核；完备性矩阵（分母 = 原文钉死）
- **括注双向对账（G3）**：译文最终括注集合 === 裁定台账"保留"集合（空集对非空台账即 FAIL）
- **精选表兑现硬判（R23，格式已冻结 §5.1）**：`<英文原句> :: <既定中文>` 条目出现于该 chunk 原文者，译文须以 `中文（English）` 括注形态呈现
- **标题双语锚硬判（2026-08-31 Yiyue 裁决）**：分母 = 原文 fence 感知标题扫描（segment.mjs 同款状态机）；逐标题核对中文标题行 + 次行锚逐字相等 + 级别序列一致；brief 关闭时披露跳过并记 REPORT
- **冷读/pm-review 结构化核验（G4）**：冷读台账逐段覆盖矩阵 = 全稿；pm-review 选样清单全覆盖且逐样本有实质结论
- **R15**：pm-review 头部 merged-draft sha 内容锚核对（不豁免）
- **探针命中比对**：每维度每 run ≥1；探针单元缺报告 = 直接 FAIL；比对源侧 truth
- **新鲜度**：豁免 glob 精确到文件（status.md / verify-results.json / staging/ / pm-review / REPORT / 终检报告自身；pm-review 的 sha 锚不豁免）；mtime 只作 WARN，硬判 = 内容 sha + 重执行
- **PASS → 原子改名** `translated-<title>-zh.md` + 交付物 sha 内容锚入 REPORT（R18-⑥ 手改区分）；FAIL → 故障半径分级（C-7：单 chunk scoped 重做 / 全局作废重走）；连续 FAIL ≥3 转 PENDING-USER；**准确性维度缺失 = 无条件 FAIL**
- 退出码约定沿用 verify-mech（0 成功 / 非零分类）

## 6. 完成判据（自查后再交）

- [ ] merge M1-M7 全部有测试且过（含真实译文快照回归）
- [ ] final-gate：重执行一切、豁免 glob、探针命中判定、原子改名、G3 括注对账、R23 精选表兑现、标题双语锚、G4 覆盖矩阵、R15 锚——各有单测
- [ ] probe truth 只存源侧（工作区无 probes/、staging 同构不可分辨——已有 M1b 测试延伸）
- [ ] 全套串行全过（`bash scripts/test/run.sh`，现 63 项 + 新增）
- [ ] 未改 fork 源；无表外文件；汇报含自测清单与结果

## 7. 完成后的下一步（向 Yiyue 汇报时建议）

**M2 编排层走查**（SKILL.md v0.2.0-skeleton + references prompts + §5.2 对照表；同步点：SKILL.md 内 progress.json 表述移除、brief 默认值加"标题双语锚开"）。**另开新会话**。

## 8. 可选深查索引（非必需）

| 文件 | 用途 |
|---|---|
| `DESIGN.md` v2 | §2 Step 8/10（merge/final-gate 权威规格）、§5.1（命名/物化/格式冻结）、§6 里程碑、§9+§9.3 全部裁决 |
| `scripts/status.mjs` | M1b 交付：staging 物化、probeTruth 接口、events.jsonl、verify-results 读法 |
| `scripts/verify-mech.mjs` | 硬判同源（final-gate 重执行复用其 verify）；brief clamp（G2） |
| `scripts/test/README.md` | 两层分工、merge M1-M7 契约、维护规约 |
