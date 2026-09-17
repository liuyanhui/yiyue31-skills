# HANDOFF：xl-translator 项目终态（M1-M5 全部收口；本文件留档备查，支持换机读取）

> **本文自足**：在任何机器读完即可继续任务，不依赖任何会话记忆或本机路径。机器专属路径只存在于本地配置文件（不入 git，见 §1）。
> **换机冷启动三步**：①两仓库 `git pull`（skill 仓库 + 运行仓库 refined-stock）②读本文 §2"当前状态"③按 §3"下一步动作"执行。
> 最后更新：2026-09-17（**M5 收窄口径完成——项目终态 M1-M5 全收口**）。

## 0. 任务与判定依据

**任务 = M5 部署收尾**（DESIGN §6 M5 行，最后一个里程碑）：
1. refined-stock `CLAUDE.md` 约定表加 xl-translator 条目（工作目录 `xl-translator/<title>/`、动词表、与 translator/summary 等输出目录的边界）
2. translator skill description 加边界互指（"大文档 >40KB 请用 yiyue31-xl-translator"——xl 侧 description 已有反向指引，核对即可）
3. 中间态 gitignore 复核（R12 规则已提前落 refined-stock——**M4 复审结论：普通名中间产物 classify() 全 null 安全，`summary-` 前缀与 `-zh.md` 后缀是真实泄漏向量，命名红线三条已防**；复核即可，无需新规则）
4. 两 skill 触发测试（小文章仍走旧 skill / 大文章触发 xl——description 边界互指生效验证）

**验收** = 小文章仍走旧 skill（DESIGN §6 M5 行验收列）。

**开工口径先例**（M3/M4 均如此）：涉及取舍的问题问 Yiyue；机械可推导的直接做。

## 1. 机器本地配置（不入 git，换机时手工重建）

文件 `~/.config/xl-translator/m4-local.json`（键见下；M5 沿用同文件即可）：
```json
{
  "run_repo_dir": "~/project/refined-stock",
  "skill_dir": "~/skills/yiyue31-skills/yiyue31-xl-translator",
  "workdir": "~/project/refined-stock/xl-translator/AI-Native-SDLC-playbook-r2",
  "title": "AI-Native-SDLC-playbook-r2",
  "probe_truth": "probe/truth/m4-playbook-r1.json（相对 skill_dir；已入 git）",
  "translator_skill_dir": "~/skills/yiyue31-skills/yiyue31-translator"
}
```
两仓库在 git 中已含全部必需状态（探针 truth 已入 skill 仓库；运行产物已入 refined-stock）——重建此文件后无其他本机依赖。

## 2. 当前状态（换机后必读）

| 里程碑 | 状态 |
|---|---|
| M1a-M1c + M2 + M3 | ✅ 已提交（DESIGN §6 各行已收口） |
| **M4 全量验收** | ✅ **2026-09-15~17 全绿收官**（DESIGN §6 M4 行已收口）：playbook-r2 全流程重跑 5 chunk / 终检二跑 PASS / 交付物 `translated-AI-Native-SDLC-playbook-r2-zh.md`（sha `c88afa0d8101`）/ 验收 10 条全绿 / 红队 4 全捕获 / 演练 6 全过 / skill 修复 6 项（①PASS 消解挂起旗标 ②B2 回归测试 ③围栏两族分流 ④verify CLI --chunk-nn/--waiver ⑤final-gate waiver 持久登记 handoff/waivers.md ⑥final-gate 内部 chunkNn 透传——全套件 160 测试绿） |
| **M5 部署收尾** | ✅ 2026-09-17 收窄口径完成（Yiyue：refined-stock 加家族同款配置即可，其他忽略）——CLAUDE.md 约定表+发布清单两处收录，已推送；发布面零改动（classify 既有模式覆盖，M4 已证） |

**关键事实**：
- M4 详情：运行仓库 `xl-translator/m4-outbox/M4-验收记录.md`（30+ 单元台账 + 验收 10 条终判 + 终账）；M3 对照译本仍在 `xl-translator/AI-Native-SDLC-playbook/`（同源两译本并存，均有效交付）。
- 移交用户 3 项源料缺陷（M4 REPORT 记录）：发布时间 2001-08-21 疑错年 / chunk 05 尾段文档列表源缺失 / Traditional 段首连写形。
- refined-stock 发布链：SessionEnd → gen-html（classify 扫描）→ publish（git push）。M4 已实测 r2 半径仅交付物渲染。
- refined-stock 的 CLAUDE.md 约定表：**已收录 xl-translator**（输出目录 `xl-translator/<title>/` + 发布工作流清单，2026-09-17 提交）。

## 3. M5 执行记录（已完成；若未来重启可选项见此）

1. refined-stock `CLAUDE.md`：约定表加 xl-translator 行（工作目录 `xl-translator/<title>/`；动词"继续翻译/翻译进度/重翻第 N 章/重新翻译"归 xl；≤40KB 走 translator）
2. translator `SKILL.md` description：加"大文档（>40KB）请用 yiyue31-xl-translator"（若已有则核对措辞）
3. gitignore 复核：确认 `xl-translator/` 中间产物无 `summary-/talk-/merge-/final-/recommendation-` 前缀与 `-zh.md` 后缀（M4 红队已证此二形是唯一真实泄漏向量）
4. 触发测试：小文章（<40KB）仍走 translator、大文章触发 xl（两条 description 互指生效）
5. 收口：DESIGN §6 M5 行 + 本 HANDOFF 终态化；两仓库 commit + push —— ✅ 已完成（第 1/3/5 项落地，第 2/4 项按 Yiyue 指示忽略，登记后续可选）
6. 测试纪律：skill 侧改动后跑 `bash <skill_dir>/scripts/test/run.sh`（当前 160 项，须全绿）

## 4. 单元台账（M5 期间逐项追加）

| # | 单元 | 状态 | 备注 |
|---|---|---|---|
| 1 | CLAUDE.md 约定表 + 发布清单收录 xl-translator | ✅ 2026-09-17 | refined-stock 两处提交推送；发布面零改动（classify 既有模式覆盖） |
| — | translator 互指措辞核对 / 双 skill 触发实测 | ⏸ 按指示忽略 | 后续可选：xl description 已含 40KB 边界反向指引 |

## 5. 环境注意（跨机器通用）

- 测试串行入口：`bash <skill_dir>/scripts/test/run.sh`；非平凡脚本写临时文件再跑（内联转义不可靠）。
- 低内存纪律：subagent 串行（审校两波制 ≤5 需 Yiyue 授权——M4 已授权过，M5 无审校需求）；每会话预算干净退出。
- API 限流处置（D1 模板）：429[1302] 补派 / [1308] 定时等窗（配额窗约 5h 一档，重置时刻见报错）/ 流停滞核验无半成品后原样重派。
- 派发纪律：inputs/outputs 绝对路径；`agent`（AI 义）译"智能体"、`token`（AI 义）译"词元"。
- M4 过程教训（供 M5 及后续参考）：批量 str.replace 后必跑叠字自扫；终审轮后不落词级修复（sha 刷新代价=半块 4 单元）；扫描 classify 一律以仓库根为根。
