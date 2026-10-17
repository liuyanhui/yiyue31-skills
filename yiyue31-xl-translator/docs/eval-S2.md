# S2 批1 独立评估报告（eval-S2）

- 评估会话: 2026-10-17（独立 Evaluator，与实现会话零上下文共享）
- 被评估对象: yiyue31-xl-translator S2 批次（7 项 + sizes）
- commit 范围: `c837cf4^..3bbd468`（8 commits）；仓库 HEAD=5953506（其上仅 WORKLOG 批次条目）
- 方法: 自跑回归（权威判据）+ §3 机械验收逐项核验 + 12 项 Planner 裁定源码对照 + 字节实测；全程串行，未修改任何现有文件（本报告为唯一写入）

## ① 回归原始结果

命令：`cd /home/claude/skills/yiyue31-skills/yiyue31-xl-translator && bash scripts/test/run.sh`（run.sh 逐文件严格串行，单 node 进程）

- 退出码: **0**
- 逐文件计数（node:test 计数器原样汇总）:

| 文件 | tests | pass | fail |
|---|---|---|---|
| consistency.test.mjs | 10 | 10 | 0 |
| derive-bilingual.test.mjs | 23 | 23 | 0 |
| final-gate.test.mjs | 35 | 35 | 0 |
| handoff.test.mjs | 11 | 11 | 0 |
| import-draft.test.mjs | 6 | 6 | 0 |
| merge.regression.test.mjs | 7 | 7 | 0 |
| merge.test.mjs | 18 | 18 | 0 |
| probe.test.mjs | 9 | 9 | 0 |
| segment.regression.test.mjs | 8 | 8 | 0 |
| segment.test.mjs | 11 | 11 | 0 |
| sizes.test.mjs | 4 | 4 | 0 |
| status.test.mjs | 36 | 36 | 0 |
| verify-mech.test.mjs | 40 | 40 | 0 |
| word-counter.test.mjs | 3 | 3 | 0 |
| **合计（14 文件）** | **221** | **221** | **0** |

- 原始输出末尾摘要（原样）:

```
----------------------------------------
✅ 全部测试通过
EXIT_CODE=0
```

- 基线独立复核（`git archive` 导出 c837cf4^ / c837cf4 至 /tmp 复跑，不动仓库）: c837cf4^ = **12 文件 186 用例全绿**（exit 0；需姊妹目录 yiyue31-translator 在场供 fork 源对照，首跑缺它 verify-mech 文件级失败属导出环境假阳性，补齐后全绿）；c837cf4（含 S2①）= 189 用例全绿。
  - **口径修正**: 宣称"基线 193→+28"与实测不符——真基线 186，实际增量 **+35**（终点 221 属实且全绿）。见 ⑤ 问题清单 minor-1。

## ② §3 S2 机械验收逐项结论

| # | 项 | 钉死用例（核实断言真实在跑） | 亲手机械复核 | 结论 |
|---|---|---|---|---|
| ① | 节级 sha 锚（三脚本） | status.test.mjs L211（仅变化节 s2 4 维 stale、未变节豁免不级联、N+1 handoff 失效）、L509（**3 节文档改节 2 → CLI --json 仅节 s2 stale**，真实子进程）；final-gate.test.mjs L522（gate **正**: 全 fresh exit 0 / **反**: 仅节 s2 FAIL scoped exit 3、未变节 s1 豁免、FAIL 不改名）；verify-mech.mjs L745-756（sectionSlices 同源节表入 record，闸保持整 chunk translationSha） | 全量回归内实跑 | **PASS** |
| ② | delta 节级补审 + C4 拆分 | status.test.mjs L247（delta 队列=变化节×4 维；staging 物化节文本；**dispatch 事件携 c4 detail 且与物化内容同源**；头三行 `sha:/model:/time:`+sec 表）；final-gate.test.mjs L758（**--seed 7 两次执行 sampled deepEqual、seed 8 不同**；随机抽 ≥3；结果落 events detail；REPORT 披露）、L791（口径失配→c4 FAIL scoped exit 3）、L813（superseded 豁免）；机械三件=c4Facts()（status.mjs，行数/起止/节枚举派生），grep 提示留 agent（status.md 渲染 `grep -n "^#"` 断言在 L279） | 全量回归内实跑 | **PASS** |
| ③ | 冻结窗入 Step 8（≤2 硬门）+决策落盘纪律 | status.test.mjs L591（已耗 2 轮后第 3 轮 dispatch → **exit 3 + pending.md 上报 + 不物化 + 不追加派发事件**）；L562（窗内修复→变化节×4 维补审优先于全局动作；派发批记 freeze-round）；L609（**双计数器不挤占**: freezeRounds 已耗 2 不影响 per-chunk 派发；fix/freeze-round 分开派生）；L724（修复环每 chunk ≤3，超限停 chunk 登 residue **项目不停**） | grep 亲手复核: SKILL.md Step 8 节（L82 标题）内 L85 含"内容冻结窗/≤2 硬门/非零退出+pending.md"；测试 L629 另按 "### Step 8".."### Step 9" 切片断言 | **PASS** |
| ④ | fixer 闭环（主上下文不进报告） | status.test.mjs L651（fixer 包物化: unit-sha/fix-round/逐节定位表/译文全文+FAIL 报告全文进包、--dims 选维、fix 事件计轮）；L683（**全链路 FAIL→fixer→verify（CLI 真跑）→复欠=变化节×4 维→done**，事件流各环节在场）；L724（轮上限） | fix-loop.md 实测 **2,876B ≤6KB**；fixer 包实测 **27,983B ≤40KB**（sizes 档 3a，max 尺寸译文 20,408B+四维报告 6,928B 夹具，且断言夹具 >16KB 防空转） | **PASS**（注: 链路由真 chunk 用例钉死；探针单元不进 fixer 属设计口径，探针覆盖在 ⑦/D5，见 ⑤ minor-2） |
| ⑤ | suspend/pending 同事务 + events 原子写 | status.test.mjs L754（原子写: 追加后全文逐行可解析+末行换行恒在+遗留 .tmp 覆盖清理）；L773（**撕裂尾行 WARN+忽略不阻塞**，CLI exit 0、stderr WARN 在场）；L794（追加隔离: 不吞并新行、不改写历史字节）；L811（**suspend 后 pending.md 必在**，载荷逐字一致）；L828（半态自愈重建）；L848（故障注入反例: 提交失败→两者皆不在）；L860（历史无载荷只 WARN 不重建）；L871（§9 mtime 对账 WARN 双通道） | 源码核: appendEvents 收口 tmp+fsync+rename（status.mjs L81-107），suspendTxn 事件先行+载荷（L133-137） | **PASS** |
| ⑥ | draft-import 最小实现 | import-draft.test.mjs D1（**旧格式 status.md 无戳 → exit 1 拒收且零副作用**: reviews 不动、events 字节不变、无 quarantine 无归档；版本不识同拒指路 S4①）+ D1b（**version 在场**: renderStatus 头 `> schema: 1`、parseStatusSchema 同源、无戳解析 null）；D2-D4（§7 边界: 受保留/拒类 sibling -r1/隔离+缺省 WARN/staging 清空/verify 回阶段）；D3 幂等；CLI 冒烟；D5（**探针小文档全流程**: 导入→verify 重跑→dispatch 真4+探针4 同构→伪审校落位→truth 命中正反→**ready-merge**） | 源码核: 版本戳门在任何移动之前（import-draft.mjs L94-102）；`schema:` 入 status 头（status.mjs L712，SCHEMA_VERSION=1 同源） | **PASS** |
| ⑦ | probe 新 run + truth | probe.test.mjs L110（**--run soai-r2**: `<name>.json` 四维齐、虚拟 NN 901-999 段不变、同 run 重跑 exit 2 防覆盖、跨目录同 run 字节相同[缺省 seed=runId 哈希]）；L134（**--probe-truth 伪报告命中**: 含 expectedHit→probeCheck 零 FAIL/缺报告 FAIL/未含→FAIL 披露期望串）；status.test.mjs L895（**>90 WARN**: 91 次派发→人话 ⚠ 行+--json state.warnings 同源、exit 0 不阻塞；90 不 WARN） | 全量回归内实跑 | **PASS** |
| sizes | 三档断言 + §6.1 迁出 + 硬门 | sizes.test.mjs 档 1/2/3a/3b（十进制 KB=1000B；档 3 夹具自证 >16KB 防空转；档 3b 附件预算 3,800B=风格卡投影 ≤2,000[S3 口径]+handoff ~1,400+brief ~400——S2 不实现投影，按 S3 前提口径） | 亲手 `wc -c`: **SKILL.md=19,994B ≤20,000B**；references 单件最大 5,515B ≤6,000B（14 件全过）；fixer 包 27,983B、审校单元包口径 32,518B 各 ≤40,000B；§6.1 迁出落地（unify/fix-loop/env-playbook/verbs/analysis.md 在 references/，SKILL.md Step 8 引用 unify.md 有断言） | **PASS** |

**§3 小计: 8/8 PASS（①-⑦ + sizes）**

## ③ 12 项 Planner 裁定逐条对照

| # | 裁定 | 核实（文件/行） | 结论 |
|---|---|---|---|
| ① | verify-mech 节级化解释（同源节表+整 chunk 闸） | verify-mech.mjs L745-748: `sectionSlices` 自 status.mjs 导入（三脚本同源），注释明示"机械校验判据仍以整 chunk translationSha 为闸…节表供 status/final-gate 对账"；record 同时携 sectionTable 与整 chunk translationSha（L748/L756） | **一致** |
| ② | 冻结窗开启边界=统稿后（FREEZE_STAGES 一处可调） | status.mjs L45-47: `const FREEZE_STAGES = ["cold-read", "pm-review", "final-gate"]` 单常量三处引用（L491/L651/L895）；测试 pushToFreeze 以 consistency（统稿）落盘+冷读产物 → global=cold-read 进窗 | **一致** |
| ③ | 补审轮计数=派发批口径门内拒绝 | status.mjs L895-898: dispatch 动词内、物化之前判 `inFreeze && freezeRounds >= FREEZE_ROUND_MAX` → suspendTxn+exit 3；L909-910: 一次补审派发批 append 一条 freeze-round（计数器事实源=事件流，deriveCounters L188-189） | **一致** |
| ④ | verify 事件化扩展 | verify-mech.mjs L641-646: verify-results 落盘时 appendEvents `{ev: verify-pass|reject, nn, detail: failChecks}`；deriveCounters L179-184 消费（mechanicalRejects 以 verify-pass 为重置点） | **一致** |
| ⑤ | 档 3b 包口径按 S3 前提（投影 2KB+附件 3,800B，S2 不实现投影） | sizes.test.mjs L124: `ATTACH_BUDGET=3800`，注释"风格卡投影 ≤2,000（S3 口径）+ handoff 投影 ~1,400 + brief ~400"；无投影实现进 S2 | **一致** |
| ⑥ | mtime 审计集口径（同进程成对产物，最小误报） | status.mjs L661-693: 审计集=merged-draft/verify-results/staging/*/交付物/双语版（脚本成对产物）；明示排除 agent 步调产物（reviews/adjudications/translated-chunks/chunks/manifest）与按设计晚于事件的视图件（status.md/pending.md/REPORT.md）；末事件取实读文件尾+1s 容差 | **一致** |
| ⑦ | suspendTxn 提交序（事件先行+载荷自愈） | status.mjs L129-137: appendEvents（原子追加=提交点，携 pending 全文载荷）→ writeAtomic(pending.md)；L139-154 reconcileSuspend 半态重建、无载荷只 WARN | **一致** |
| ⑧ | import 旧 status 整次拒收零副作用读法 | import-draft.mjs L94-102: 版本戳门在任何移动之前，return exitCode 1；D1 用例断言 reviews 目录内容、events 字节、quarantine/归档均未动 | **一致** |
| ⑨ | verify 重跑标记=sibling 归档本身 | import-draft.mjs L60: verify-results.json → `verify-results-r1.json`（注释"强制重跑标记"），无独立旗标件；import 事件 detail 携 `verifyRerun: true`（L176）；状态机按 verify-results 缺位置回 verify 阶段 | **一致** |
| ⑩ | handoff/ 整目录隔离（按件拆分留 P1） | import-draft.mjs L73: `{ re: /^handoff$/, act: "quarantine" }` 整目录入 quarantine；D2 断言 quarantine 含 handoff | **一致** |
| ⑪ | --probe-truth 复用 probeCheck 不加新旗标 | 命中判定唯一入口 = final-gate.mjs `probeCheck`（F11 同源）；probe.mjs 只生成 truth（--run/--seed/--truth-dir，无命中逻辑）；status.mjs `--probe-truth`（L935/L544）只做派发侧注入（truth 不落工作区）；probe.test.mjs/import-draft D5 直接调 probeCheck 验正反 | **一致** |
| ⑫ | >90 WARN 只观测不代决 | status.mjs L384-385: `dispatchTotal > 90` → `st.warnings.push(...)` 仅此；deriveCounters L172-175 dispatchTotal 与现有派发计数同源（含探针）；测试断言 exit 0 不阻塞、90 不 WARN | **一致** |

**裁定小计: 12/12 一致**

## ④ sizes / 字节数实测（十进制）

| 项 | 宣称 | 实测 | 门 | 判 |
|---|---|---|---|---|
| SKILL.md | 19,994B | **19,994B**（wc -c） | ≤20,000B 硬门 | 过（余量 6B；>16,000B 软目标仅 WARN，符合"批批断言硬门"口径） |
| references 单件最大 | — | **5,515B**（translate-prompt.md；14 件全量 43,793B） | 单件 ≤6,000B | 过 |
| fix-loop.md | ≤6KB | **2,876B** | ≤6,000B | 过 |
| fixer 包（--verb fix 实测物化） | ≤40KB | **27,983B**（译文 20,408B+四维报告 6,928B+定位块） | ≤40,000B | 过 |
| 审校单元包（staging+原文+附件预算） | ≤40KB | **32,518B**（staging 20,408B+原文 8,310B+附件 3,800B） | ≤40,000B | 过 |

## ⑤ 发现的问题

- **blocker**: 无。
- **major**: 无。
- **minor**:
  1. **基线用例数口径失实**: WORKLOG/任务描述宣称"基线 193→+28"，独立复跑实测真基线（c837cf4^）= **186 用例 12 文件全绿**，实际增量 **+35**（186+35=221；含 S2① 的 c837cf4 为 189，亦非 193）。终点 221 与全绿属实，属记事口径错误非代码缺陷。建议 WORKLOG 下批次更正。
  2. **④ 验收行措辞与用例口径的窄差**: "探针走通 FAIL→fixer→verify→复欠"由真 chunk 用例钉死全链路（status.test.mjs L683），探针单元另由 ⑦ 命中用例与 D5 链路覆盖；无"探针单元进 fixer"单列用例——按设计 fixer 按真 chunk 派发（探针不进 fixer），工程上合理，仅记录口径差。
  3. **范围记事**: diffstat 实际 **22 个文件**（任务描述称 16；WORKLOG commit message 中"14 文件"指 14 个测试文件，无误）。8 commits 确认无误。
- 已知遗留（按任务界定不评估、现状确认）: `probe/truth/soai-r1.json` 未跟踪残留在场（P1 按 §7 处置）；verb stop 未收口 suspendTxn；final-gate 手写 tmp+rename 未统一 writeAtomic；UNITS_PER_CHUNK=11 未调（延 M3）。

## ⑥ 总结论

**S2 批1 合格。**

- 回归: exit 0，14 文件 **221/221 全绿**（自跑，串行）。
- §3 机械验收: **8/8 PASS**（①-⑦+sizes），验收表可直接机械执行的项（grep Step 8 / fix-loop ≤6KB / SKILL.md ≤20,000B / --json 节级 stale / 正反退出码）均亲手复核或由真实子进程用例钉死。
- 12 项 Planner 裁定: **12/12 与实现一致**。
- 字节门: SKILL.md 19,994B（余量 6B）、references 单件 5,515B、fixer 包 27,983B、单元包口径 32,518B，全过。
- 问题: 无 blocker/major；3 项 minor（基线计数口径 193→应为 186/+35、④ 链路口径窄差、范围文件数记事）均不构成本批返工理由，建议随 WORKLOG 记事更正。
