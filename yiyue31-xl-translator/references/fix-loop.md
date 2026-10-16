# 修复闭环细则（fix-loop）— Step 7 细则

> SKILL.md Step 7 只留流程位与计数器；fixer 闭环细则在本件（S2④；C5 与升级计数器自 SKILL.md 迁出，§6.1 #2）。

## fixer 包（脚本物化——主上下文不进报告全文）

- 物化：`status.mjs <workdir> --verb fix --nn N [--dims accuracy,translationese,ai-tone,readability]`（缺省全四维）→ `staging/fixer-chunk-NN.md` + `fix` 事件（修复环轮计数器事实源，脚本落流禁人工补记）。
- 构成（≤40KB，sizes 夹具钉死）：头部定位块（unit-sha / fix-round n/3 / 逐节 `sec:` sha 表——与派发 c4 口径同构）+ 译文全文 + 所选维度 FAIL 报告全文（whole + delta 单节报告逐字照抄）。
- **不含 chunk 原文**：报告逐条自带"原文引用"；fixer 需整节原文对照时只读工作目录 `chunks/<name>`（包外自取，不占包预算）。
- 派发：fixer subagent 输入 = 包路径 + 工作目录；回传仅 落盘路径 + 一行结论 + FAIL 项计数（报告全文只落盘——保主上下文 O(1)）。

## 闭环次序（事件流各环节在场）

审校 FAIL（报告落盘 + 回传 FAIL 项计数）→ `fix` 事件（包物化即记轮次）→ fixer 修译文（增删括注同步补记/勾销裁定台账行——终检按台账集合对账）→ 重跑 Step 5（`verify-pass`/`reject` 事件由 verify-mech CLI 落流）→ **复欠**：sha 变化节 × 4 维 delta 队列由 `status.mjs` 差集派生自动回队列（未变节豁免）；不采纳的发现逐条落 analysis-notes（决策落盘纪律），禁静默丢弃。

## C5 跨维采纳回核

凡采纳非 accuracy 维（翻译腔/可读性/AI 味）的**结构性改写**（化定语为主谓、拆句重组、语序重排），改后必须对照原文回核**数字、比例、否定极性**——如 "the share of X" 被改写成"有多少 X"即丢比例义；词级替换（换量词/换搭配）不触发此回核。回核结论落 analysis-notes。

## 升级出口与升级计数器三条款

- 超限自动**升级**：换模型重翻该 chunk（prompt 附邻 chunk 中文首末段 + 文风卡；重翻后接缝 scoped 统稿 + seam 复查）；仍不收敛 → PENDING-USER。**不存在降级路径**。
- 三条款：①升级后该 chunk 重试计数器清零；②每轮修复循环中升级至多一次；③累计升级 ≥2 次（跨轮，不随清零重置）→ 直接转 PENDING-USER。

## 修复环轮计数器（S2③ 双计数器之一）

每 chunk 修复环 ≤3 轮（`fix` 事件派生）；第 4 次物化被拒：**停该 chunk** + 登记 `residue-chunk-NN.md`（unit-sha / 轮次 / 未清 stale 节）+ `residue` 事件——**项目不停**（其余 chunk 照常推进，residue chunk 不再回队）。与冻结窗补审轮（项目级 ≤2，Step 8）分开计数，P1 并行不挤占。
