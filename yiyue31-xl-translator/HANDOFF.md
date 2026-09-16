# HANDOFF：xl-translator M4 全量验收（活文档——每个单元结束后更新）

> **本文自足**：读完即可在**任何机器**继续任务。机器专属路径在本地配置文件，不入 git。
> 换机冷启动：①两仓库 git pull（skill 仓库 + 运行仓库 refined-stock）②读本文 ③按"当前状态"行的下一步动作执行。
> 最后更新：2026-09-16 午（chunk 04 译/机械毕（含 M4 缺陷#4 修复），裁定官第 3 配额窗后重派在途）。

## 0. 任务与判定依据

**任务 = M4 全量验收**（DESIGN §6 M4 行）：playbook 重跑（验证 M3 回写后的 skill 修改）+ 验收 10 条（REQUIREMENTS §6，含 4/5 细则）+ 红队 4 场景 + 中断续跑 / compact / 限流退避 / SessionEnd（含 Step 9↔10 退出）/"用户 12 小时不在场"演练。**验收 = 全绿 + REPORT 对账**。

开工裁定（2026-09-15 Yiyue）：全 subagent 派发 / 审校两波制 ≤5（D1）/ M4 新标题并行（M3 交付物原位不动）/ 验收 4/5 细则已入 REQUIREMENTS §6。

## 1. 机器本地配置（不入 git，换机时手工重建）

文件 `~/.config/xl-translator/m4-local.json`（键：run_repo_dir / skill_dir / workdir / title / probe_truth / translator_skill_dir）。
运行仓库内工作目录：`<run_repo>/xl-translator/AI-Native-SDLC-playbook-r2/`；验收记录：`<run_repo>/xl-translator/m4-outbox/`（M4-验收记录.md = 逐单元台账；演练规程.md = 6 演练 + 红队 4 场景执行规程）。
探针 truth 已入 skill 仓库 git（probe/truth/m4-playbook-r1.json，run=m4-playbook-r1 seed=20260915）。

## 2. 当前状态

| 阶段 | 状态 |
|---|---|
| Step 0-1 | ✅ 落盘/预检/分段（5 chunk 落带，sha 9bdcc5278c2b === M3 同源） |
| Step 2 五件产物 + 探针 truth | ✅ 落盘（glossary 终态 188 条零双选；评审 2 轮打回→修复闭环完成） |
| Step 2 评审第 2 轮复核 | ✅ 6/8 到位 + 2 处分钟级修复（stream of work 词头/agentic 补条/analysis 四行定位）——评审判"修后免复审可进翻译" |
| chunk 01 翻译/裁定/机械 | ✅ 翻译自检全绿（锚 9/9、精选表 5/5）；裁定保留 10/删 2、台账 10 行；机械校验 FAIL 3 → **skill 缺陷#3 修复（围栏两族分流）** + 译文修 2 处 → PASS |
| chunk 01 审校闭环 | 首审 12 单元（探针 4/4 命中）→ 修复批 1（41 处）→ 重审轮 1（FAIL 4+2+1）→ 修复批 2（8 处，含 quarters 复数端点/跨维张力修复）→ 重审轮 1 波 2 → 修复批 3（4 处，含精选表冻结句形变同步）→ **终审轮 3/3 在途（8 单元两波）** |
| chunk 02 全流程 | ✅ done 2/5（终态 sha a84b1c84e49c）：翻译零标记/机械首轮零修复/裁定 8 保留/审校 3 轮（b 半块第 2 轮即零且 fresh 存续——**半块隔离机器化实证**）/累计修复 34 处/第 2 配额窗实录 |
| chunk 03 全流程 | ✅ done 3/5（终态 sha 9cf190e35f57）：3 轮审校+终态确认轮；精选表 #7 兑现；批引残 2 起+终修代价结构已登观测 9/10 |
| **下一步** | chunk 04 译者在途（5 围栏混合形态/托管设置碎句体）→ 裁定 → 机械 → 审校 |
| Step 3-10 | ⬜ 逐 chunk 流水（每 chunk：翻译→裁定→机械→四维审校→修复闭环）→ merge/统稿 → 冷读/PM → final-gate |
| 演练 + 红队 + 验收 10 条 | ⬜ 按 m4-outbox/演练规程.md 执行（穿插进行） |

**续跑口令**（用户视角）：`继续翻译 AI-Native-SDLC-playbook-r2` / `翻译进度` / `停止翻译 …` / `重新翻译 …`。
**编排侧冷启动**：`node <skill_dir>/scripts/status.mjs <workdir> [--verb progress]`——状态纯落盘推导（C3 后默认 view 零副作用）。

## 3. 已完成的关键事实（换机后必读）

- 原文 sha1 前 12 = `9bdcc5278c2b`（=== M3，分母钉死）；5 chunk（unitTarget 12KB 一次过，与 M3 同边界）。
- **skill 侧已修 4 项**（均已提交 + 测试绿）：①final-gate PASS 消解 pending.md 挂起旗标 ②B2 最长匹配回归测试 ③围栏两族分流 ④verify-mech CLI --chunk-nn 入口 + runCli 透传（B4 scope 的 CLI 缺口）。
- M3 工作目录的陈旧 pending.md 已清（status 现正确报"已交付"）。
- 评审第 1 轮要点（已修）：glossary 补 harness/loop/governance/control 等核心条、keep-list 幽灵词、Western Electric 双收、围栏散文 mock 块口径（7 处照译）、special-phrases 增收 L416、analysis 6 处 chunk 定位。详见 workdir review-pre-translation.md。
- 全局 terms.md 冲突处置：agentic AI 对齐"智能体式 AI"；artifact 本篇覆盖为"产物"（REPORT 披露）。
- 低内存纪律：subagent 串行派发（审校波次 ≤5 两波制）；每次派发唯一，等回传。

## 4. 单元台账（最近单元，完整版见 m4-outbox/M4-验收记录.md）

| # | 单元 | 状态 | 备注 |
|---|---|---|---|
| 00 | 译前评审第 1 轮 | ✅ 打回·轻（36 条） | 报告 review-pre-translation.md |
| 00b | 修复（6 类必改全落） | ✅ | glossary 171→187 |
| 00c | 评审第 2 轮复核 | ✅ 修后免复审 | 报告"第 2 轮复核"节；遗留 2+1 全修 |
| 01 | chunk 01 翻译（阶段A） | ✅ 911s | 锚 9/9、精选 5/5、自裁定 7 条全不入表 |
| 02 | chunk 01 裁定（阶段B） | ✅ 366s | 保留 10/删 2；台账 10 行；G3 同源自检 PASS |
| 03 | chunk 01 机械校验 | ✅ FAIL 3→修→PASS | 缺陷#3 围栏两族分流入库（全套件绿） |
| 04 | chunk 01 审校首轮+探针 | ✅ 探针 4/4 命中；429[1308] 击杀 2 探针（零半成品，窗后重派双中） | D1 实录+C2 去重首跑 |
| 05 | 修复批 1-3（53 处）+ 机械重跑 ×3 | ✅ 全 PASS | 跨维张力 1 例（人手写→靠手写）；精选表 2 句形变同步 |
| 06 | chunk 01 终审轮 3/3 | ⏳ 波 1/2（5 在途） | sha a=248d17afeefd b=323e2d07a94c |

## 5. 环境注意（跨机器通用）

- 测试串行入口：`bash <skill_dir>/scripts/test/run.sh`（当前 160 项绿）。
- node -e 内联脚本转义在部分 shell 不可靠 → 非平凡脚本写临时 .mjs/.py 文件再跑。
- API 限流处置模板见 SKILL.md D1（429[1302] 补派 / [1308] 等窗 / 流停滞核验后重派 / ≤5 两波制）。
- 派发纪律：inputs/outputs 一律绝对路径；审校派发按 C4 模板（staging 总行数 + 起止标题 + 节名枚举 + grep 核对）；禁 web 条款随派发附。
- `agent`（AI 义）译"智能体"、`token`（AI 义）译"词元"。
