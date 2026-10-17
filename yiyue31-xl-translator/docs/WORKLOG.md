# WORKLOG — yiyue31-xl-translator 改造

> 约定（计划 §0.8）：每批一条条目，字段固定为 批次/日期/会话/改动/commit/评估/遗留；会话交接锚 = 执行计划任务卡 + 本文件对应批次条目。实现与评估分会话；skill 改动每批独立 commit（message 注明批次）。

## 条目格式（模板）

- 批次: S\<N\>/P\<N\>｜日期: YYYY-MM-DD｜会话: \<标识\>
- 改动: \<要点列表（文件+意图）\>
- commit: \<hash｜待提交\>
- 评估: \<Evaluator 结论 + 门（G1-G5）结果\>
- 遗留: \<未尽事项 / R1 回流条目号\>

## 条目

- 批次: S2（P0 批1 实现，7 项+sizes）｜日期: 2026-10-16 ~ 10-17｜会话: C（Generator subagent ×4 串行：①②→③④+sizes→⑤→⑥⑦；两次配额 429 中断均 SendMessage 续命原 agent，§0.5 不计轮）
- 改动: **①** c837cf4 节级 sha 锚——审校锚半块单 sha→逐节 sha 表（status/final-gate/verify-mech 同源节表，verify 闸保持整 chunk 语义=Planner 裁定）+ evaluate-*.md×4 契约；**②** 88807ee delta 节级补审（队列=变化节×4 维，首审仍全量整 chunk）+ C4 拆分（头三行/枚举/起止→status.mjs 机械校验；抽核 ≥3 seededOrder --seed N 落 events detail）；**③** 6175461 冻结窗入 Step 8（FREEZE_STAGES=统稿后开启，Planner 认可口径；补审轮 ≤2 硬门 dispatch exit 3+pending.md）+ 双计数器（vs Step 7 修复环每 chunk ≤3 超限登 residue 不停项目）+ 决策落盘纪律 + unify.md；**④** db8f6c5 fixer 闭环（--verb fix 物化 fixer 包，主上下文不进报告全文；fix-loop.md；verify 环节落事件并补 mechanicalRejects 生产者）；**sizes** 46475aa sizes.test.mjs 三档断言（十进制：SKILL.md ≤20,000B/references 单件 ≤6,000B/包 ≤40,000B）+ §6.1 #2/#3/#6/#8 迁出（unify/fix-loop/env-playbook/verbs/analysis.md）+ 措辞压缩——SKILL.md 23,633→**19,933B** 达硬门（留守 L102/L113/L114/回传纪律）；**⑤** 073da05 events 原子写收口（appendEvents tmp+fsync+rename 单点 17 写点）+ 撕裂尾行 WARN 容错 + suspendTxn 同事务（事件先行携 pending 载荷+读侧自愈，故障注入反例钉死）+ §9 mtime>末事件 WARN（审计集=同进程成对产物，最小误报口径）；**⑥** f75b051 import-draft.mjs §7 边界表数据驱动（受/sibling 归档 -r1/隔离 quarantine+缺省 WARN/staging 清空）+ SCHEMA_VERSION 版本戳（status 头 `schema:` 行；旧格式非零拒收零副作用）+ events 归档新建禁补记 + 幂等重入；**⑦** 3bbd468 probe --run 命名/--probe-truth 命中（复用 probeCheck F11）+ dispatchTotal>90 WARN（§12 观测点，只 WARN 不代决）。测试：**14 文件 221 用例全绿**（基线 193→+28 → 评估会更正 **186→+35**）；SKILL.md 终态 **19,994B**。
- commit: c837cf4 / 88807ee / 6175461 / db8f6c5 / 46475aa / 073da05 / f75b051 / 3bbd468（+本条目 commit）
- 评估: **合格（2026-10-17，独立评估会话 D）**——Evaluator 自跑 run.sh **exit 0，221/221 全绿**；基线独立复跑（git-archive 隔离）真值 **186→+35**（原记 193→+28 失实，终点 221 无误）；输入范围纠正为 **c837cf4^..3bbd468**（原记 c837cf4..3bbd468 漏 S2① 本体）；提案 §3 机械验收表 **8/8 PASS**（可机械执行项亲手 grep/wc 复核）；**12 项 Planner 裁定 12/12 一致**（逐条落源码行）；实测 SKILL.md 19,994B / references 单件最大 5,515B / fixer 包 27,983B；**0 blocker、0 major**。报告 `docs/eval-S2.md`（评估会唯一写入）。→ **G2 三角色门 3/3 通过**：**架构位** 8/8（ARCH-A import 重入事务窗=数据保全非丢失、ARCH-B fresh 谓词多处拷贝恒同判、ARCH-C SKILL.md 仅余 6B）；**工程师位** 通过（交接点双核：ARCH-A 属实 P1 前置必改、fresh 谓词 preamble/无标题/空节/BOM 四态两侧同判；新发现 ENG-1 freeze-round 与 dispatch 双追加窗可超 ≤2 门一格〔有界于崩溃次数〕、ENG-2 rename 后无目录 fsync、ENG-3 幂等分支吞 statusRun 失败码、ENG-4 session-end 事件无生产者）；**QA 位** 通过（用例抽查 12 例全优/合格、零 skip/空壳、§12 无应落未落、台账 10 条归属复核——微调 ARCH-B 挂 S3④、ENG-3 与 ARCH-A 捆绑 P1 前置修）。**M2（批1 回归绿）✓ 确认；S3（守卫批 5 项）解除"待 S2"门**。S3 随批登记：基线显式取 221；rider=ENG-1 一行修+ENG-2+test/README 补 S2③④ 判据表；排次约束=先迁 §6.1 #4/#7 腾位再新增（ARCH-C）；ENG-4 归 S3②。**移交复核的 Planner 裁定**：① verify-mech 节级化解释（同源节表+整 chunk 闸）；② 冻结窗开启边界=统稿后（FREEZE_STAGES 一处可调）；③ 补审轮计数=派发批口径门内拒绝；④ verify 事件化扩展；⑤ 档 3b 包口径按 S3 前提（投影 2KB+附件 3,800B）；⑥ mtime 审计集口径；⑦ suspendTxn 提交序（事件先行+载荷自愈）；⑧ import 旧 status 整次拒收零副作用读法；⑨ verify 重跑标记=sibling 归档本身；⑩ handoff/ 整目录隔离（按件拆分留 P1）；⑪ --probe-truth 复用 probeCheck 不加新旗标；⑫ >90 WARN 只观测。
- 遗留: verb stop（seal）未收口 suspendTxn（失败方向安全）；final-gate 既有手写 tmp+rename 未统一 writeAtomic（语义等价）；UNITS_PER_CHUNK=11 校准值未调（延 M3，首审实派已 4/chunk）；probe/truth/soai-r1.json 未跟踪残留（P1 按 §7 拒收处置）。**评估会新增**：ENG-1 freeze-round 双追加窗（S3 一行修）、ENG-2 目录 fsync（S3 顺带）、README 补 S2③④ 判据表（S3 rider）；**P1 启动前置=ARCH-A（import-draft 重入收敛）+ENG-3（幂等分支失败码）捆绑修**。**窗耗凭证：≈2 窗**（两次 5h 上限中断为证：10-16 14:41 与 21:00，限额重置 19:11 与 10-17 00:40——与提案 §4 排期 2.0 窗一致）。

## 条目（S1 存档）
- 批次: S1（改进提案）｜日期: 2026-10-16｜会话: B（Generator subagent）
- 改动: 新建 `docs/improvement-proposal.md`；v1.0=三源核销 43 行+分批验收+预算+瘦身映射+边界清单+粒度选型+表态+tripwire，经 Evaluator 三处数字修正（14,701B）；**v1.1=G1 五角色评审（5/5 有条件通过）11 项 major+minor 条件处置落齐**：P1 双口径预算与双计量熔断（90/120/3.5 窗，原 ≤2 窗作废）、总耗计量边界与 WORKLOG 观测凭证、水位信号源契约、S2①②合并 ~1 窗、边界清单补缺+缺省规则、迁出映射收窄（L102/113/114 留守）推演 17.2-17.4KB、§5/§6 单一口径、双计数器定义、投影归属 S3+超限切半出口、抽核池=全部新契约报告、新增 §13 待批复确认项。初版 15,310B 超 15KB 十进制上限被 Planner 驳回（1024 进制口径漂移），纯措辞压缩至 **14,670B**（条目零删除）。新建本 WORKLOG。
- commit: f19c075（S1 批次首提交）
- 评估: Evaluator 核销 43/43 合格 → G1 五角色 5/5 有条件通过 → v1.1 处置完毕 → **用户批复（2026-10-16）§13 全部清单生效**（含 P1 熔断双计量 90/120/3.5 窗、错峰 runbook 前移两项计划变更，已落执行计划 v1.5）
- 遗留: ①冷读重跑补计——**已闭环**（Planner 采纳，落执行计划 v1.3）；②防造假上限 120 与 SKILL.md ≤16KB 软目标——**已随批复确认**（§13 生效）
