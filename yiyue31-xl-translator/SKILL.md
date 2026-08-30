---
name: yiyue31-xl-translator
description: 翻译大英文文档（>40KB）为中文时启用。触发词：翻译大文档、大文档翻译、继续翻译、resume、翻译进度、翻到哪了、停止翻译、重翻第 N 章、审计翻译、查翻译质量。小于 40KB 的文章请用 yiyue31-translator。
version: 0.2.0-skeleton
author: Yiyue31
---

> v0.2 骨架（含三方评审 15 项修订回写）——M2 走查通过前不部署

# yiyue31-xl-translator：大文档翻译编排

## 功能描述

- 角色 = **翻译项目编排者**：把 >40KB 英文大文档译成专业中文；≤40KB 小文章由 Step 0 自动交接 yiyue31-translator，不让用户重发。
- 纪律一：**状态只从文件系统推导**——任何动作前先跑状态命令（`scripts/status.mjs`），绝不依赖会话记忆。
- 纪律二：**逐 chunk 流水执行**——每个 chunk 走完 翻译→裁定→机械校验→四维审校→修复 过审后，才派发下一个 chunk；phase 视图（×N）仅用于叙述与预算汇报，不是执行序。
- **质量最高优先**：耗时/token 让位；异常出口只有 暂停+续跑 / 升级 / PENDING-USER，永不削减质量维度。
- 中文术语约定：`agent`（AI 义）译"智能体"；`token`（AI 义）译"词元"。

## Directory

- `{skill-dir}` = 本 SKILL.md 所在目录；脚本在 `{skill-dir}/scripts/`，prompts 在 `{skill-dir}/references/`（清单见 DESIGN §5）。
- 工作目录 `xl-translator/<title>/`（refined-stock 仓库根下，与 translator/、summary/ 等其他 skill 输出完全分开）；文件命名严格按 DESIGN §5.1 schema，status/final-gate 按该表 glob 工作。
- 命名三条红线：①中间产物禁止以 `-zh.md` 结尾；②禁止 `summary-/talk-/merge-/final-/recommendation-` 前缀；③唯一交付物 `translated-<title>-zh.md` 由终检 PASS 原子改名产生——PASS 前全目录不得命中任何发布模式。

## 工作流程

> 执行者：`[脚本]` 确定性、零信任；`[subagent]` 独立调用（**严格串行**，一次一个，等返回再派下一个）；`[主]` 主 agent 编排与本地轻活。各步细节见 DESIGN §2 对应小节。

### Step 0 发起与预检 `[主+脚本]`
- 取文→markdown 化→落 `original-<title>.md`；brief 缺省默认值（技术读者/意译/中等注释密度/发布用途）直接落盘——**不问用户**。
- 规模预检：**>40KB 单条件**才走 xl，否则自动交接 translator 执行；`--xl-force` 为测试/标定旁路（M3 用）。
- 原文完整性 WARN（末句截断/围栏不配对，提示不阻塞）；预算公告（chunk 数、subagent 调用基线、预计会话数 + **一行 brief 披露**："按技术读者/意译/中等注释密度/发布用途处理，想改就说'换成直译/注释少点'"——通知非询问）。
- 关卡：无（本步不改翻译产物）。

### Step 1 分段 `[脚本]`
- fork doc_segmenter：目标带 8-15KB、跨级别合并、code block/表格原子不可切、巨块允许超限单 chunk 并标记；**fence 感知**——标题解析跳过代码围栏。
- 产物：`chunks/` + `manifest.md` + `progress.json`（缓存，非事实源）。
- 关卡：**拼接 sha === 原文 sha**（钉死分母）；尺寸分布落目标带，否则自动调参重分段。

### Step 2 译前分析 `[主+评审subagent×1]`
- 主 agent 本地生成：`analysis-/glossary-/keep-list-/special-phrases-` + brief 落盘 + **文风基准卡**（`style-card.md`：原文文风特征转写为中文写作规则，含**文体变化轴**；文体分化的书按部设多锚点）+ **全文标题树预译**（正文/目录标题照抄既定译名）；terms.md 首次种子拷贝。
- glossary **一条一译**：脚本扫双选条目→自动打回重裁定直至零双选；>64KB 改 subagent 分段提取 + 脚本合并去重（主 agent 不整读原文，守 O(1)）。
- 译前产物评审 subagent ×1（独立）：复核 glossary 合规/keep-list 完备/special-phrases 质量/文风卡——不过打回重做。
- 关卡：glossary 零双选；keep-list 非空（若原文有机械元素）。

### Step 3 翻译·阶段A `[subagent]` ×N 串行
- 输入 = **交接包五件套**：①全文 chunk 地图（含标题树既定译名）②前 chunk 末段摘要（含"留下了什么"）③该 chunk 译法投影（含标题条目）④贯穿比喻/叙事台账 ⑤文风卡；另附 chunk 原文 + keep-list + special-phrases + brief。
- 串行增强：派发时脚本**追加邻 chunk 已审中文末段 300-500 字**（sha 绑定）；chunk 1 过审后节选定稿入 `handoff/anchor.md` 作**范文锚点**。
- 输出带 `«english»` 标记的译文；**硬禁止直接括注**；金句/习语按精选表。
- 关卡：无（信任后置到 Step 5/6）。

### Step 4 注释裁定·阶段B `[subagent]` ×N 串行
- 输入：阶段A 译文 + chunk 原文（裁定需语境：术语首现/金句）+ special-phrases 精选表 + 注释密度档（brief）+ **全文已裁定保留注释术语集**（同一术语括注全文唯一）。
- 逐条裁定每个 `«»`：保留→`中文（English）`、删除→去标；扫直接括注违规；**裁定台账逐条落盘**（`adjudications/`，终检比对"最终文本括注 ⊆ 裁定集合"）。
- 关卡：`«»` 残留 = 0（正则）。

### Step 5 机械校验 `[脚本]` ×N
- fork verify-mechanical 扩展：原五项 + 数字/单位保真 + 散文残留英文阈值 + 中英间距 + 段落计数/长度比下限（防空洞化）。
- 修复后**强制重跑**；不过自动打回重翻（计返工轮次），**同 chunk 打回 ≤2 次 → 并入 Step 7 升级出口**；结果落 `verify-results.json`（终检不信任、会重跑）。
- 关卡：全项通过。

### Step 6 审校 `[subagent]` 串行
- **四维独立、全覆盖、不合并、不抽样**：准确性（fork + 数字/否定词/条件句专项）/ 翻译腔（fork + 逻辑连接词与指代衔接子项）/ AI 味 / 可读性（全覆盖 + 每 chunk 尾部 500 字定向 + 每 4 chunk 与范文锚点文风对漂抽查）。
- **半块送审**：每 chunk 切两半（字节中点向最近段落边界取整，a/b）分两次送审，**附另一边界段落（或 chunk 首 1-2 段）作只读语境**（不计被审 sha、不入报告范围）；分节报告 + 每节独立结论。
- 输入含 **per-chunk glossary 投影** + brief + **文风基准卡全文 + anchor 节选**（判卷口径 = 对照文风卡判偏离；文风卡至少喂可读性与 AI 味两维）；报告头部记 被审半块 sha/model/time；undersize/模板签名阈值随单元大小缩放；异模型尽量，环境不可控时 REPORT 披露。
- 关卡：四维报告齐备且非 stale。

### Step 7 修复闭环 `[主+脚本]`
- 按报告修复→重跑 Step 5→sha 实际变化的半块 × 4 维 stale 重审；每 chunk 重审 ≤3 轮。
- 超限自动**升级**：换模型重翻该 chunk（prompt 附邻 chunk 中文首末段 + 文风卡；重翻后接缝 scoped 统稿 + seam 复查）；仍不收敛→PENDING-USER。**不存在降级路径**。

### Step 8 合并与统稿 `[脚本+subagent×1]`
- merge **只由脚本执行**：manifest 顺序、只收最新 mech-passed chunk、清临时标记（残留必须 0）→临时名 `merged-draft.md` 落盘。
- 统稿三段式：consistency 清单全量扫描（术语/密度离群/标题译法/间距/接缝/文风遵从）→ 决策 subagent 只读清单下结论 → 机械应用 → 受影响 chunk 重跑 Step 5。
- 变更分类 stale 规则：**修复类**=相关维度报告 stale 重审；**统稿替换类**=逐条 diff 清单落盘 + consistency 重扫代替四维重审（REPORT 披露）；句式级改写仍走四维重审。统稿轮 ≤2，超限转 PENDING-USER。

### Step 9 全稿通读与验收准备 `[subagent×1-2 + 主]`（终检之前）
- 终稿**冷读者** subagent ×1-2：全稿通读，以读者身份对照**文风基准卡**找文风断裂、明显错误、跨章不一致；>30KB 分段接力（段间重叠 ~2KB + 递进式发现台账 + 收尾专读全部接缝与各 chunk 首末段）；**>100KB 强制 ≥2 名独立通读、发现取并集**。
- **发现分流**：错误类→走 Step 7 修复闭环；文风类→统稿式定点修 + 接缝复查 + 冷读者复核；**发现清零（或复核通过）才放行**。
- 主 agent PM 通读：**脚本化分层选样 ≥20%**（每 k 个 chunk 必抽 + 升级/接缝 chunk 必抽，选样由脚本定，防挑软柿子）+ 标题级快扫；结论写 `pm-review-`（**头部记 merged-draft sha 供 final-gate 校验**），含**步骤合规表**——质量维度（准确性/翻译腔/AI味/可读性/冷读）**不存在 SKIPPED 合法标记**。
- 关卡：冷读发现清零（或复核通过）+ pm-review 落盘。

### Step 10 终检与交付 `[脚本]` ——**流程真正的最后一个动作**
- **重执行一切确定性检查**（不信任何落盘日志）：机械校验全项重跑、从 translated-chunks 重导出 merged 做 diff、拼接 sha 复核、完备性矩阵（分母=原文钉死）、报告签名扫描、**探针命中比对**。
- 探针：伪审校单元由 status 队列注入（路径形态与真 chunk 无差别，主 agent 照单派发）；**每维度每 run（= final-gate 一次完整执行）≥1；缺报告即 FAIL**。
- 新鲜度：产物与豁免精确到 glob（豁免 mtime：pm-review、REPORT、progress/verify-results、`probes/`、终检报告自身；**pm-review 的 merged-draft sha 内容锚不豁免**）；固定顺序 = 冷读发现清零 → pm-review 最后写（记 sha 锚）→ 终检最后跑；mtime 只作 WARN，硬判 = 内容 sha + 重执行结果。
- FAIL **半径分级**：单 chunk 根因（报告 stale/签名）= scoped 重做（该 chunk 回 Step 6/7 + 接缝复查 + pm-review 重生成，其余成果保留）；全局根因（拼接 sha/完备性/探针未命中）= 全局阶段整体作废重走；连续 ≥3 次 FAIL 转 PENDING-USER；**准确性维度缺失 = 无条件 FAIL**。
- PASS → 脚本**原子改名**为 `translated-<title>-zh.md` → REPORT 定稿 + **交付摘要内联聊天输出**（含绝对路径；明示"本会话退出时将自动发布，请现在抽查，不满意可'重翻第 N 章'"）。

## 横切机制（详见 DESIGN §2 横切）

- **状态命令 = resume oracle**：冷启动入口；同文件再触发自动检测进行中并续跑；**输出双段契约**——人话一行（当前 X/Y、阶段、已耗时、剩余预估、下次该说的话）+ 动作指令（step/inputs[]/outputs[]，探针在其中与真单元不可区分）——人话段同时也是干净退出提示。状态纯推导自文件系统。
- **用户动词表**（全部挂状态命令）：`继续翻译 <title>`（续跑）/ `翻译进度`、`<title> 翻到哪了`（人话进度）/ `停止翻译 <title>`（封存标记 + 一行总结）/ `重翻 <title> 第 N 章`（执行前一行披露章↔chunk 映射如"第 3 章 = chunk 05-06"；作废范围按 re-keying 冻结语义）。
- **会话预算**：每会话处理 N 单元后干净退出；每单元幂等；N 同时约束内存与主会话上下文增长（默认值 M3 标定）；**单元 = 一次 subagent 调用**。
- **subagent 回传纪律**：仅回传 落盘路径 + 一行结论 + FAIL 项计数，报告/产物全文只落盘——保主上下文 O(1)。
- **上下文溢出防护**：主 agent 不依赖会话记忆，一切状态落盘、每单元完成即检查点；/compact、上下文压缩、OOM、/clear 同路径恢复（重跑状态命令即恢复）。
- **限流指数退避**：调用失败自动重试；超限窗口转挂起 + 干净退出提示。
- **PENDING-USER 挂起态**：`pending.md` 存在即挂起；干净退出附一行说明，处理后自动续跑——零介入唯一合法例外；待决终态一律走此门（不带病交付）。pending.md 含**选项菜单**：①继续（系统侧换模型/调参并记录）②用户手修译文后标注、按新 sha 重审 ③终止项目；status 挂起态人话行输出此菜单。
- **并发参数** `--concurrency N` 默认 1（N>1 推迟 v2，参数位保留）；仅限"尴尬并行"阶段（翻译/裁定/机械校验/审校）；统稿、冷读者、终检永远单发；**禁止自动上调**。
- **原文变更 re-keying**：chunk 按内容 sha 匹配保留成果（非序号）；原文 sha 变更 → **仅内容 sha 实际变更的 chunk 作废重翻**（未变更 chunk 绝不因位置/序号重翻），下游仅 **N+1 邻 chunk** 的 handoff②/串行增强段重生成，全局阶段（merge/统稿/冷读/终检）整体作废重走；handoff 失效细则见 DESIGN §2 横切。

## 交付

- 交付即止：不自动触发发布管线——refined-stock 的 Stop/SessionEnd hook 会自然发布 PASS 后的交付物。
- 动词 `审计翻译` / `查翻译质量`：响应对应 audit 命令（`scripts/audit.mjs`，M5 落地；落地前以 REPORT.md 使用说明兜底，见 DESIGN §2 Step 10）。
- `REPORT.md`：首屏一句人话结论 + 四维各一句 + 覆盖明细 + **章↔chunk 映射对账** + **消耗对账**（预估 vs 实际，含用户开口次数/会话接力次数；预算无硬顶，~88/64KB 基线只做披露）+ 异常与升级记录 + 遗留问题；内部术语附人话括注（如"探针 4 次 = 故意埋 4 处错看审校能否全抓到"）。
