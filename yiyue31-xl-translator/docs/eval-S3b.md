# S3b 批独立评估报告（eval-S3b）

- 评估会话: 2026-10-17（独立 Evaluator 会话 G，与实现会话 F 零上下文共享）
- 被评估对象: yiyue31-xl-translator S3b 批（P1 前置修：ARCH-A 重入收敛 + ENG-3 失败码传播 + G3 riders；卡 v2）
- commit 范围: `5ed82c9^..eaf6cce`（主修 5ed82c9 → riders d84ce85 → WORKLOG eaf6cce）；仓库 HEAD=eaf6cce
- 方法: 自跑回归（权威判据）+ 基线 git-archive 独立复跑 + 收敛性**亲手独立复核**（自构夹具+自写变异计数器+重入走真实 CLI 子进程，独立于测试断言——S3 评估同款做法）+ 判据表 13 行逐行对账 + 字节实测；全程串行；评估期本文件为 skills repo 唯一写入
- 前置: 卡定义已经 G3 三角色评审审定（plan-review §九），本批不需新评审门；G4（P1 交付前）为下一自然复核点

## ① 回归原始结果

命令：`cd /home/claude/skills/yiyue31-skills/yiyue31-xl-translator && bash scripts/test/run.sh`（run.sh 逐文件严格串行，单 node 进程）

- 退出码: **0**（skip 0 / todo 0）；末行原样 `✅ 全部测试通过`
- 逐文件计数（awk 逐文件求和核对，非只看末行）:

| 文件 | tests | pass | fail | vs S3 基线 |
|---|---|---|---|---|
| consistency.test.mjs | 10 | 10 | 0 | = |
| derive-bilingual.test.mjs | 23 | 23 | 0 | = |
| final-gate.test.mjs | 35 | 35 | 0 | = |
| handoff.test.mjs | 14 | 14 | 0 | 13→+1（SP3） |
| import-draft.test.mjs | 10 | 10 | 0 | 6→+4（ARCH-A①③/②/④/ENG-3） |
| merge.regression.test.mjs | 7 | 7 | 0 | = |
| merge.test.mjs | 18 | 18 | 0 | = |
| probe.test.mjs | 9 | 9 | 0 | = |
| segment.regression.test.mjs | 8 | 8 | 0 | = |
| segment.test.mjs | 11 | 11 | 0 | = |
| sizes.test.mjs | 4 | 4 | 0 | =（补钉死块不加用例） |
| status.test.mjs | 55 | 55 | 0 | 49→+6（A2×2/E2/A3/A4/E3+Q3） |
| verify-mech.test.mjs | 40 | 40 | 0 | = |
| word-counter.test.mjs | 3 | 3 | 0 | = |
| **合计（14 文件）** | **247** | **247** | **0** | **236→+11** |

- **基线独立复核**（`git archive b182c88` 导出 /tmp/s3b-baseline 复跑，不动仓库）: **14 文件 236 用例全绿 exit 0**——登记口径"基线显式取 236（只增不减）"与实测**精确一致**；+11 构成 = import-draft +4 / status +6 / handoff +1，与其余 11 文件零变动对账吻合。
- **静态清点**（diff `5ed82c9^..eaf6cce` 测试四文件）: test() 计数 6→10/49→55/13→14/4→4；**零删除具名用例、零改名**；diff 中仅 3 行删除——①import 行扩展（加 isCompletedMarker）；②③两处 `GUARD_RAM_MB ??= "99999"` → `= "99999"`——正是 E1+Q2 rider 本体（无条件钉死修复的就是 ??= 条件赋值缺陷），属卡内 mandated 修改，非语义改动。**"既有用例只加断言不改语义"成立**。

## ② 机械验收清单逐项结论（交接 §3 五项）

| # | 项 | 核验 | 结论 |
|---|---|---|---|
| 1 | 独立自跑回归 | ①表：247/247 exit 0，逐文件求和核对 | **PASS** |
| 2 | 基线只增不减 | 基线独立复跑 236/236；+11 精确（6→10/49→55/13→14）；零删除零改名；行级改动=E1+Q2 rider 本体 | **PASS** |
| 3 | 卡评估标准逐条 | 见下三行（收敛性/失败码传播/A2-A4+E1-E4+Q1+Q3） | **PASS** |
| 3a | 收敛性断言（两出口成员判定） | **亲手独立复核**：自写 harness（/tmp/s3b-eval-harness，非被评估仓库）——自构不同夹具（14 段原文/不同分段参数 minKB 0.3 maxKB 1.2/不同文件集：extract-b01/log2026.txt/双 staging 残影/双 reviews 报告）+自写 fs 变异计数器中断+**重入走真实 CLI 子进程**（node import-draft.mjs，非 in-process runImport）。结果：N=24 独立发现（=用例声称值）；k=1..24 全遍历 exit0 不动点 23 / exit1 0 / 容错吞没 1——与实现侧完全一致；逐 k 断言全过：二次重入（真 CLI）文件集合+逐件 sha 不动点、events 首事件=import、二次重入披露"已导入过"、终态=干净参照归一化逐件全等、quarantine 终集=参照、partial 已隔离件原路径原 sha 不挪动、r1/tmp 绝不入 quarantine | **PASS** |
| 3b | statusRun 失败码传播 | 亲手真 CLI：干净导入→manifest.md 目录化（预检过/读侧败）→重入 **exit 2**+errors 含 manifest+仍披露幂等上下文；`--json` 通道 exit 2 且 j.errors 同出；用例（:514-535）夹具同款确定性 | **PASS** |
| 3c | A2/A3/A4/E1-E4/Q1/Q3 用例 | 全部在 247/247 内绿。A3 特别核对：yaml 头行+空清单结构断言在场（:1441-1442）、PL1 字节等式夹具（:1017）随批全绿；A4 特别核对：[suspend,resume] 正例（:1475）与 [suspend,resume,suspend] 反例（:1481）都在，pending-clear/unseal/restart 不回归（:1484-1489） | **PASS** |
| 4 | 判据表对账 | 「S3b 判据」13 行（test/README :262-280）逐行名实相符——具名用例逐一 grep 在场+断言强度抽查 9 例（A2 纯函数 8 断言+集成行/E2 PATH 注入探针行为级/A3 yaml 不动+常态无注行/A4 正反+防修过头/E3+Q3 fd 逐调用无累积/TQ1 action===null 字面/TQ4 nn:901 真跑 exit 1/SP3 BOM 字节等式反例+行内 BOM 保留/BA1-BA3+BE3 全文细读+harness 独立再证） | **PASS** |
| 5 | 字节门 | SKILL.md 实测 **19,894B** ≤20,000B；commit 范围内 **0 commit** 触碰 SKILL.md（diff --stat 9 文件无它） | **PASS** |

**② 小计: 5/5 全 PASS**

## ③ 三笔已知偏差终判（交接 §4）

| # | 偏差 | Evaluator 终判 | 依据 |
|---|---|---|---|
| 1 | E3 落点 status.mjs（G3 行号标 handoff.mjs） | **接受——修复落在真实缺陷位置** | writeAtomic 定义在 status.mjs:92，handoff.mjs 0 处引用（grep 证实）；内容 fd（:98-100）与目录 fd（:111-114）closeSync 均已入 finally；README/commit 已注明偏差 |
| 2 | 收敛性枚举 exit1 臂 0 例 | **接受——实现性质而非造假遮蔽** | Evaluator 独立 harness 不同夹具复现同分布（23/0/1）；因果：文件移动唯一机制是 rename（原子），任何变异前缀态要么源未动、要么目标已在+源已无——"源+目标并存"不可达，故枚举内 exit1=0 是原子 rename 语义的必然；exit1 断言分支已实现（用例 :501-506），且 ④ 手构三形态经 Evaluator 真 CLI 逐一触发（events 两侧/隔离区同名/sibling 并存均 exit 1+可操作文案+归档不被覆盖），处置后重入恢复 exit 0 收敛——**出口真实可触发，非死代码** |
| 3 | Q4 深化未做（truth 全链路 fixer 排除夹具） | **接受——卡允许择便边界** | 卡文"择便，不便则 R1"；择便形态 `--nn 901` 真实探针虚拟段已做且绿（:684 exit 1 断言）；深化项已随卡与 v1.10 登记 R1 backlog |

## ④ 分级发现

- **blocker: 0**
- **major: 0**
- **minor: 1**（登记不返工）——收敛性成员判定的 exit1 臂在机械枚举内恒 0 例（偏差②的必然推论）：若未来实现引入 copy-based 移动或非原子两步移动，exit1 变可达，届时该臂从"仅 ④ 手构钉死"转为"枚举内实测"——现有断言已能自动接纳（无需改测试），此处仅登记知情。
- **nit: 1**——A4 用例 :1485 注释残留疑问句措辞（"先制造未消解？——"），断言本身正确无碍。

## ⑤ 结论

**S3b 批（卡 v2）评估合格。** 卡 v2 全部评估标准满足：收敛性两出口成员判定经 Evaluator 独立于测试断言真跑复核（自构夹具+真 CLI 重入，N=24 与实现侧一致，零漂移钉死）；ENG-3 失败码传播含 --json 通道真跑证实；riders A2/A3/A4/E1-E4/Q1/Q3 用例全绿且断言强度抽查全优；基线 236 只增不减精确落实（+11 零删除零改名）；判据表 13 行名实相符；字节门过（SKILL.md 未触碰 19,894B）。三笔偏差全部终判接受（②为原子 rename 语义的实现性质，exit 1 出口经手构三形态真 CLI 证实可触发）。Q4 深化按卡边界留 R1。

- 建议下一步: 卡翻**合格**；P1 启动仅余错峰 runbook 成文（Planner 侧，S1 批复前移项）；G4 为下一自然复核点。
- 本报告为评估会话在 skills repo 的唯一写入；未跟踪遗留件 probe/truth/soai-r1.json 未碰未提交。
