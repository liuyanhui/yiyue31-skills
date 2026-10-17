# S3 批2 独立评估报告（eval-S3）

- 评估会话: 2026-10-17（独立 Evaluator，与实现会话零上下文共享）
- 被评估对象: yiyue31-xl-translator S3 批次（P0 批2 守卫类：5 项 + 风格卡投影 + riders）
- commit 范围: `4ecb339^..2600ac3`（4 实现 commits + WORKLOG 条目）；仓库 HEAD=2600ac3
- 方法: 自跑回归（权威判据）+ §3 S3 机械验收逐项核验 + GUARD_RAM_MB/GUARD_CTX_PCT 正反注入亲手复核 + 登记动作清单逐项对照 + 字节实测；全程串行；评估期本文件为 skills repo 唯一写入
- G3 三角色门（兼 P1 启动门）: 串行三 subagent（架构→工程师→QA），记录另续写 plan-review §九；本报告 ⑥ 为汇总

## ① 回归原始结果

命令：`cd /home/claude/skills/yiyue31-skills/yiyue31-xl-translator && bash scripts/test/run.sh`（run.sh 逐文件严格串行，单 node 进程）

- 退出码: **0**（skip 0 / todo 0）
- 逐文件计数（node:test 计数器原样汇总）:

| 文件 | tests | pass | fail | vs S2 基线 |
|---|---|---|---|---|
| consistency.test.mjs | 10 | 10 | 0 | = |
| derive-bilingual.test.mjs | 23 | 23 | 0 | = |
| final-gate.test.mjs | 35 | 35 | 0 | = |
| handoff.test.mjs | 13 | 13 | 0 | 11→+2（SP1/SP2） |
| import-draft.test.mjs | 6 | 6 | 0 | = |
| merge.regression.test.mjs | 7 | 7 | 0 | = |
| merge.test.mjs | 18 | 18 | 0 | = |
| probe.test.mjs | 9 | 9 | 0 | = |
| segment.regression.test.mjs | 8 | 8 | 0 | = |
| segment.test.mjs | 11 | 11 | 0 | = |
| sizes.test.mjs | 4 | 4 | 0 | = |
| status.test.mjs | 49 | 49 | 0 | 36→+13（CS/PL/GR） |
| verify-mech.test.mjs | 40 | 40 | 0 | = |
| word-counter.test.mjs | 3 | 3 | 0 | = |
| **合计（14 文件）** | **236** | **236** | **0** | **221→+15** |

- 原始输出末尾（原样）: `✅ 全部测试通过`（shell 回显 EXIT=0）
- **基线独立复核**（`git archive 4ecb339^`（=99312b7）导出 /tmp/s3-baseline 复跑，不动仓库）: **12 文件 221 用例全绿 exit 0**——登记口径"基线显式取 221（只增不减）"与实测**精确一致**（对比 S2 批的 193 记事失实，本批无此问题）；+15 构成 = handoff +2（SP1/SP2）+ status +13（CS1-CS2/PL1-PL4/GR1-GR6），与其余 12 文件零变动对账吻合。

## ② §3 S3 机械验收逐项结论

| # | 项 | 钉死用例（核实真实在跑） | 亲手复核（Evaluator 独立于测试断言） | 结论 |
|---|---|---|---|---|
| ① | RAM 守卫（free<500MB 不派） | GR1（子进程 env 注入正反：1→拒 / 99999→正常物化 4 单元；session-end 恰一条；冷启动卡/人话 ⚠ 双通道） | **亲手注入**：`GUARD_RAM_MB=1` 真跑 CLI → exit 4、staging 0 物化、events 唯一新增 `session-end:ram-guard:1MB`（无 dispatch）、cold-start.md 再生含「## 下次动作」「继续翻译 testdoc」、status.md 守卫行+⚠ 行；同 workdir `99999` → exit 0、4 单元物化+4 dispatch 事件。源码链 availableRamMb 四级回退（env→free -m available→os.freemem→null fail-open，status.mjs L150-171）与守卫块前置物化（L1088-1098）核读一致 | **PASS** |
| ② | 水位退出（<20% 退出+再生；N 降保险丝） | GR2（三态：5→exit 0 不物化+ctx-watermark / 缺省→WARN 放行 / 50→正常无水位行） | **亲手注入**：`GUARD_CTX_PCT=5` → exit 0、0 物化、`session-end:ctx-watermark:5%`、交接卡再生含下次动作、人话水位行在场；缺省（两 env 均剥）→ 正常物化 4 单元且 `--json state.warnings` 含缺省 WARN（真实 free -m 默认路径同轮冒烟通过）；`50` → 正常无水位行。SKILL.md L112 纪律行在场（信号源契约+代理计数 dispatchedSinceSessionEnd+缺省 WARN） | **PASS** |
| ③ | 冷启动卡自动再生 | CS1（欠账表直接派生自 state.chunks 与 --json 同源、指纹与 status.md 同源）/CS2（视图新鲜：整体重写反映新状态；无可物化也再生） | 亲手：dispatch 后 handoff/cold-start.md 在场含「## 下次动作」；守卫（RAM/水位）出口同样再生（①②注入轮亲证）。源码 L1135-1140 dispatch 收尾无条件再生 | **PASS** |
| ④ | 人话行同源；suspend 无 pending→菜单 | PL1（plainLines 单源、输出字节不变）/PL2（plainSelfCheck 健康空失配、失配双通道不改退出码）/PL3（suspend 史无 pending→PENDING-USER 菜单） | 源码核：renderStatus 消费同函数（L1130-1133 自检接线 console.error+state.warnings 双通道）；deriveState.suspendUnresolved（L470-478） | **PASS** |
| ⑤ | symlink 防呆 | GR5（status+handoff 子进程正反） | **亲手**：symlink 调用 status.mjs → exit 4 + stderr 警示含真实路径与修复口令；真实路径直连正常。11 CLI 入口接线核实（grep cli-guard：consistency/derive-bilingual/final-gate/handoff/import-draft/merge/probe/segment/status/verify-mech/word-counter），抽样 4 脚本确认守卫块在既有 argv[1] 入口守卫**之前**执行 | **PASS** |
| 注 | 风格卡投影 ≤2KB | SP1（>6KB 夹具自证卡、蒸馏 ≤2,000B、全标题、尾行披露、sha 锚、收紧预算驱动弃末节路径、幂等）/SP2（缺卡 WARN 不阻断 exit 0、投影不落盘）；sizes 档 3b 实测口径（ATTACH=投影实测+1,400+400≤3,800；整包 ≤40,000B） | **亲手**：合成卡 2,305B → 投影 1,525B ≤2,000、两次生成字节相同（确定性）、维度标题全保留、源卡 sha 锚在场、收紧 budget=600 → 585B 标题仍全在（≤budget 不变量）。回归原始输出行：`审校单元包实测口径 31785B（staging 20408B + 原文 8310B + 附件预算 3067B——风格卡投影实测 1267B）`——夹具投影 1,267B 与 WORKLOG 宣称一致。SKILL.md Step 3/Step 6 投影口径行在场（L52/L74，卡全文仅主上下文） | **PASS** |

**§3 小计: 5/5 + 注 = 全 PASS**

## ③ riders 与登记动作清单（G2 移交）逐项

| 项 | 核实 | 结论 |
|---|---|---|
| ENG-1 合并单次原子追加 | dispatchEventsBatch 纯函数（GR3 纯用例+集成用例：冻结窗 events 末条 freeze-round、此前恰为本批 4 条 dispatch）；run() 单点调用 L1116 | **落实** |
| ENG-2 rename 后目录 fsync | GR4 行为级断言（monkey-patch fs.openSync/fs.fsyncSync 记录路径、finally 还原、禁 source grep）；writeAtomic L92-108 | **落实** |
| ENG-4 session-end 生产者归 S3② | 守卫（L1090）/水位（L1104）/预算（L1122-1124）三出口均产；GR6 钉预算收尾复位 | **落实** |
| test/README 补 S2③④ 判据表 | FR1-FR5/FX1-FX4 两表在场（含 FR3/FR4/FX2/FX3 全行）；所具名 9 用例逐一 grep 在场；FR1 常量与 FX4 探针子句**如实标隐式覆盖**（隐式用例断言核实） | **落实** |
| 基线显式取 221（只增不减） | 任务卡登记 221；独立复跑 4ecb339^ = 221/221；236=221+15 零删改 | **落实** |
| 排次约束（ARCH-C）先迁 §6.1 #4/#7 腾位再新增 | SKILL.md 全批仅 e9b55ad 一 commit 触碰（迁出 cold-reader 扩 4,155B+新建 bilingual.md 1,402B+守卫纪律新增 ~1,090B+措辞压缩，同 commit 先迁后增）；各 commit SKILL.md 字节 19,994→19,894 恒 ≤20,000B（六 commit 逐一实测） | **遵守** |
| ARCH-B 挂 S3④ | secFresh 单点导出（status.mjs L290）四消费点同源：deriveState 完备性 L510 / buildQueue 冻结窗队列 L589 / review 队列 L624 / final-gate.mjs L48 import·L421 使用 | **落实** |

## ④ 字节数实测（十进制）

| 项 | 宣称 | 实测 | 门 | 判 |
|---|---|---|---|---|
| SKILL.md | 19,894B | **19,894B**（wc -c；2600ac3 与 e9b55ad 同） | ≤20,000B 硬门 | 过（>16,000B 软目标 WARN，口径同 S2） |
| references 单件 | — | 最大 **5,515B**（translate-prompt.md；15 件合计 45,949B） | 单件 ≤6,000B | 过 |
| bilingual.md（新建迁出） | 1,402B | **1,402B** | ≤6,000B | 过 |
| cold-reader.md（扩） | 4,155B | **4,155B** | ≤6,000B | 过 |
| 审校单元包（档 3b 实测口径） | 31,785B | **31,785B**（回归输出原行：staging 20,408+原文 8,310+附件 3,067） | ≤40,000B | 过 |
| 风格卡投影（档 3b 夹具） | 1,267B | **1,267B** | ≤2,000B | 过 |
| fixer 包（档 3a，回归恒跑） | 27,983B | **27,983B**（回归输出原行） | ≤40,000B | 过 |

## ⑤ Evaluator 发现的问题

- **blocker / major: 无。**
- **minor**:
  1. 投影披露尾行未截断也带「（超预算节内容略）」字样——亲手复现确认（2,305B 卡未弃任何节，尾行仍称略）。WORKLOG S3 遗留已登记在案（披露口径统一所致），非本批新发现，维持登记处置（G3 工程师位 nit 同款）。
- **记事（不构成缺陷）**:
  2. `status.mjs --help` 不带工作目录 → exit 1（`pos.length<1 ? 1 : 0`，L1193-1196）——既有 usage 约定非 S3 引入，本批复核顺手记录。
  3. Evaluator 亲手合成卡 2,305B 未覆盖 >6KB 路径——该路径由 SP1 夹具自证（`assert 卡 >6,000B`）与 sizes 档 3b 在套件内钉死，记录口径。

## ⑥ G3 三角色评审（兼 P1 启动门；串行三 subagent，全记录=plan-review §九）

| 角色 | 判定 | 要点 |
|---|---|---|
| 架构 | **有条件通过** | 条件=S3b 卡验收口径补五点（静默再分桶半态+收敛性断言等）。A1[major→S3b 卡] import-draft 重入静默再分桶（中断后已移件 -r1/quarantine 命中缺省规则→二次隔离 WARN exit 0 假象收敛——Evaluator 已核机制属实）；A2[minor] GUARD_* 空串→Number("")=0 假触发；A3[minor] 守卫出口动作指令段空清单无注行；A4[minor] suspendUnresolved 消解集不含 resume（legacy 显示层）；观察 3 条（R14 口径收窄知情、ENG-4 非完备点可接受、cli-guard import 副作用方向正确）。正面：secFresh 四点真同源、守卫三策略自洽、投影扎实、封闭集一致 |
| 工程师 | **通过** | 0 blocker/major。E1[minor] sizes.test.mjs 未钉 GUARD_RAM_MB（本机低内存真实 flake 窗）+GUARD_CTX_PCT 未剥；E2[minor] free -m 非 C locale 误判 available 列（高估 ~8% 偏 fail-open）；E3[minor] 目录 fsync 抛出时 fd 泄漏；E4[minor] BOM 开头卡首节静默丢弃；E5-E8[nit]。核验：free -m 列位本机实测正确、ctxPct 边界值全合理、dispatchEventsBatch 纯且形状兼容、cli-guard 假阳谱与下游失配谱同延（exit 4 恒优于静默 no-op）、投影不动点病态输入全过、15 新用例无空壳。给出 A2/A3/A4 修复形态（空串视同缺省+LC_ALL:C；镜像注行勿动 yaml 结构；两处消解集同步加 resume） |
| QA | **通过** | 独立抽跑 status/handoff/sizes 三文件全绿（49+13+4，skip/todo=0）。判据表逐行对账：五张新表+rider 两表具名用例全在场名实相符；两处"隐式覆盖"标注**如实**（FR1 隐式断言 status.test L583-584 真实在场；FX4 探针子句 L675 nn=99 替身同码路径）。断言强度抽查 8 例全"优"（exit 码/事件 detail/字节等式/正反对称）。基线纪律：+13/+2 精确对账、零删除零改名、run.sh/regression 零改动、静态清点 221 unit 用例吻合。新发现 Q1[minor] FR5 子句"action 空"无字面断言（一行修：`assert.equal(r.queue.action, null)`）；Q2[minor] 守卫 env 钉死非封闭（`??=` 条件赋值+进程内未剥 GUARD_CTX_PCT——外层 shell 残留时十余 in-process 用例可整体假红；修=无条件赋值+顶部 delete）；Q3[nit] GR4 catch 分支无用例；Q4[nit] FX4 以 nn=99 替身非真实探针 NN。**M3 认可达成**；S3b 卡现行验收"重入收敛 exit 0"口径过强（存在合法 exit 1 中断态），收紧为∈{exit 0 且二次重入不动点, exit 1 且 errors 含可操作文案}三元组机械判定 |

**G3 判定: 有条件通过（3/3 无不通过票）**——条件全部指向 S3b 卡验收口径修订与 riders（A1 静默再分桶+收敛性断言、A2/A3/A4/E1-E4/Q1-Q3 小修随卡），**不构成 S3 批返工**。条件处置=执行计划 v1.9 修订 S3b 卡（Planner 于本评估会话收口时落地）；P1 启动=S3b 实施完成+错峰 runbook 成文（S1 批复前移项，Planner 侧）。

## ⑦ 总结论

**S3 批2 合格。**

- 回归: exit 0，14 文件 **236/236 全绿**（自跑，串行，skip/todo=0）；基线独立复跑（git-archive 4ecb339^）**221/221**——"基线显式取 221（只增不减）"精确落实，+15 零删除零改名。
- §3 机械验收: **5/5+注全 PASS**；GUARD_RAM_MB/GUARD_CTX_PCT 正反注入、symlink 防呆、投影确定性均 Evaluator 亲手复核（独立于测试断言真跑 CLI）。
- riders 与登记动作清单: **7/7 落实**（ENG-1/2/4、README 判据表、基线、排次 ARCH-C、ARCH-B）。
- 字节门: SKILL.md 19,894B（各 commit 恒 ≤20,000B）、references 15 件最大 5,515B、单元包 31,785B、投影 1,267B，全过。
- G3 三角色门: **架构=有条件通过 / 工程师=通过 / QA=通过 → 有条件通过**；条件=S3b 卡修订（已随执行计划 v1.9 处置）+ riders 随 S3b。全记录=plan-review §九。
- **M3（批2 回归绿）✓ 确认**（Evaluator 自跑 + QA 位独立认可）。
- 问题: Evaluator 侧无 blocker/major（1 minor=已登记的投影披露措辞）；G3 新发现 A1（major 级，归 S3b 卡范围非 S3 回归）+A2-A4/E1-E4/Q1-Q4（minor/nit，全部随 S3b 或 backlog 处置，处置清单见 plan-review §九）。
