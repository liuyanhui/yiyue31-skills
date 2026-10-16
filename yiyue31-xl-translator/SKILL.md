---
name: yiyue31-xl-translator
description: 翻译大英文文档（>40KB）为中文时启用。触发词：翻译大文档、大文档翻译、继续翻译、resume、翻译进度、翻到哪了、停止翻译、重翻第 N 章、重新翻译、双语对照、先翻第 N 章、出样张、审计翻译、查翻译质量。小于 40KB 的文章请用 yiyue31-translator。
version: 0.4.0
author: Yiyue31
---

# yiyue31-xl-translator：大文档翻译编排

## 功能描述

- 角色 = **翻译项目编排者**：>40KB 英文大文档译专业中文；≤40KB 由 Step 0 自动交接 yiyue31-translator，不让用户重发。
- 纪律一：**状态只从文件系统推导**——任何动作前先跑 `{skill-dir}/scripts/status.mjs`，绝不依赖会话记忆。
- 纪律二：**逐 chunk 流水执行**——每 chunk 走完 翻译→裁定→机械校验→四维审校→修复 过审后才派下一个；phase 视图（×N）仅叙述与预算汇报用，非执行序。
- **质量最高优先**：耗时/token 让位；异常出口只有 暂停+续跑 / 升级 / PENDING-USER，永不削减质量维度。
- 中文术语约定：`agent`（AI 义）译"智能体"；`token`（AI 义）译"词元"。

## Directory

- `{skill-dir}` = 本 SKILL.md 所在目录；`{translator-skill-dir}` = `../yiyue31-translator`（Step 0 交接用，读不到按既定退化路径）。引用文件封闭集（`{skill-dir}/references/<file>`、`{skill-dir}/scripts/<file>`）：
  - **references/（14）**：translate-prompt.md、adjudicate-prompt.md、evaluate-accuracy.md、evaluate-translationese.md、evaluate-ai-tone.md、evaluate-readability.md、cold-reader.md、style-card.md、delivery-template.md、unify.md、fix-loop.md、env-playbook.md、verbs.md、analysis.md。（terms.md 系运行时用户态：自 translator 拷贝种子至工作目录，非本目录资产。）
  - **scripts/（11，运行时封闭集）**：segment/、verify-mech.mjs、status.mjs、merge.mjs、derive-bilingual.mjs、consistency.mjs、final-gate.mjs、probe.mjs、handoff.mjs、word-counter.mjs、import-draft.mjs。另有 `test/`（开发期测试资产，判据契约登记于其 README，不计入运行时封闭集）。
- 工作目录 `xl-translator/<title>/`（refined-stock 仓库根下）；文件命名遵循下方命名三条红线，status/final-gate 按脚本内建 glob 工作。
- 命名三条红线：①中间产物禁止以 `-zh.md` 结尾；②禁止 `summary-/talk-/merge-/final-/recommendation-` 前缀；③唯一交付物 `translated-<title>-zh.md` 由终检 PASS 原子改名产生（PASS 前全目录不得命中发布模式）；`translated-<title>-bilingual.md` 为 PASS 后机械派生只读视图（非交付物、不经终检、sha 不锚、不受手修保护、幂等，永不以 `-zh.md` 结尾）。
- 报告/台账的机器解析格式：各 prompt 与产物按 `{skill-dir}/references/` 对应文件的契约逐字执行，不得改写格式。

## 工作流程

> 执行者：`[脚本]` 确定性、零信任；`[subagent]` 独立调用（**严格串行**，一次一个等返回）；`[主]` 主 agent 编排与轻活。

### Step 0 发起与预检 `[主+脚本]`
- 取文→markdown 化→落 `original-<title>.md`（**落盘即归一 LF**——sha 按落盘字节算，防 CRLF 假错死锁）。brief 缺省（技术读者/意译/中等注释密度/发布用途/**标题双语锚开**/**双语对照关**）直接落盘**不问用户**；可得时附可选行 `来源:`/`作者:`（终检元信息头字段源）。
- 规模预检（`word-counter.mjs`）：**>40KB 单条件**才走 xl，否则自动交接 translator（读 `{translator-skill-dir}/SKILL.md` 执行 + 披露一行；不可读时退化本 skill 单 chunk 跑完——零运行时依赖）；`--xl-force` 为测试旁路。
- brief 扁平 key:value 逐行落盘，`双语对照: 关` 为缺省行（交付配置非翻译参数——见「交付」；不入 KEYMAP、机械校验零可见）。
- 原文完整性 WARN（末句截断/围栏不配对，不阻塞）；预算公告（chunk 数/调用基线/预计会话数 + **一行 brief 披露**："按技术读者/意译/中等注释密度/发布用途/标题双语锚开/双语对照关处理——想改就说'换成直译/注释少点/标题不加英文/要双语对照'"——通知非询问，用户须从此处知晓全部可改项）+ **原文 sha1（前 12 位）与 chunk 数**（聊天留痕分母锚，交付回显）+ 喊停方式与样张入口（"先翻第 N 章出样张"，确认风格后放全量）。
- 关卡：无（本步不改翻译产物）。

### Step 1 分段 `[脚本]`
- `segment/`：目标带 8-15KB、跨级别合并、code block/表格原子不可切、**fence 感知**（标题解析跳过代码围栏）；仅 fence/表格**原子块**可超限单 chunk 标 `X`，散文巨块强制再切（段落边界落回目标带）。
- 产物：`chunks/` + `manifest.md`（heading 树；续跑状态统一进 `status.md`）。
- 关卡：**拼接 sha === 原文 sha**（钉死分母）；尺寸分布落目标带，否则自动调参重分段。

### Step 2 译前分析 `[主+评审subagent×1]`
- 主 agent 本地生成：`analysis-/glossary-/keep-list-/special-phrases-` + brief + **文风基准卡** + **标题树预译**（细则见 `{skill-dir}/references/analysis.md`）；terms.md 种子拷贝。
- **标题双语锚（brief 默认开——全有或全无，非译者裁量）**：预译产出**双语对**（中文译名 + 英文**逐字**），全级别 H1-H6；标题行纯中文 + 次行弱化锚 `*English Heading*`；TOC 仅中文。
- **special-phrases 精选表格式冻结**：一条一行 `<英文原句> :: <既定中文>`（`#`/空行忽略）——终检 R23 解析契约。
- glossary **一条一译**（双选打回 ≤3 轮/投影/>64KB 分段提取——脚本执行守 O(1)；细则见 `{skill-dir}/references/analysis.md`）。
- 译前产物评审 subagent ×1（独立）：复核 glossary/keep-list/special-phrases/文风卡——不过打回重做（**≤2 轮**，超限升级评审模型一次，仍不过转 PENDING-USER）。
- 关卡：glossary 零双选；keep-list 非空（若原文有机械元素）。

### Step 3 翻译·阶段A `[subagent]` ×N 串行
- 派发前跑 `{skill-dir}/scripts/handoff.mjs <workdir>` 生成**机器件**：`handoff/projection-chunk-<NN>.md`（R8-b 投影）+ `handoff/context-chunk-<NN>.md`（串行增强段：邻 chunk 已审末段 + sha 锚）；**判断件** `handoff/chunk-<NN>.md`（①地图②"留下了什么"④台账⑤文风卡引用）主 agent 组装。
- prompt = `{skill-dir}/references/translate-prompt.md`。输入 = **交接包五件套**：①chunk 地图（含标题既定译名）②前 chunk 末段摘要③译法投影（含标题条目）④贯穿比喻/叙事台账⑤文风卡；另附 chunk 原文 + keep-list + special-phrases + brief。
- 串行增强：脚本**追加邻 chunk 已审中文末段 300-500 字**（sha 绑定）；chunk 1 过审节选定稿入 `handoff/anchor.md` 作**范文锚点**。
- 输出带 `«english»` 标记的译文；**硬禁止直接括注**；金句按精选表；**标题锚按 Step 2 双语对执行**（锚行逐字取自原文）；**glossary 外自裁定术语回传清单**（主 agent 一条一译入表、更新下游投影）。
- 关卡：无（信任后置到 Step 5/6）。

### Step 4 注释裁定·阶段B `[subagent]` ×N 串行
- prompt = `{skill-dir}/references/adjudicate-prompt.md`。输入：阶段A 译文 + chunk 原文（裁定需语境）+ special-phrases + 注释密度档（brief）+ **全文已裁定保留注释术语集**（括注全文唯一；精选表豁免——再现也须兑现）。
- 逐条裁定每个 `«»`：保留→`中文（English）`、删除→去标；扫直接括注违规；**裁定台账逐条落盘**（`adjudications/adjudication-chunk-<NN>.md`，行格式 `- «english» → 保留|删除`——格式冻结）。
- 关卡：`«»` 残留 = 0（正则）。

### Step 5 机械校验 `[脚本]` ×N
- `verify-mech.mjs [--projection <handoff/projection-chunk-NN.md>]`（终检重执行同源）：数字/单位保真 + 残留英文阈值 + 中英间距 + 段落计数/长度比下限（防空洞化）+ **R8-c 术语兑现硬判**（投影条目既定译名/别名未现即打回；终检不信任落盘投影，从 glossary × 原文**重推导**同参重跑）。
- **brief 阈值只能收紧不能放宽**（各键 clamp 安全域；中英间距不可经 brief 放宽；非默认阈值进 REPORT 首屏披露）。
- 修复后**强制重跑**；不过打回重翻，**同 chunk 打回 ≤2 次 → 并入 Step 7 升级出口**；结果落 `verify-results.json`（终检不信任）。
- **手修路径**（菜单②后）：间距类脚本自动补空格（diff 披露）重跑；手修 chunk **永不自动重翻**；仅结构性 FAIL（数字缺失/代码改动/漏译）提示用户。
- 关卡：全项通过。

### Step 6 审校 `[subagent]` 串行
- **四维独立、全覆盖、不合并、不抽样**：准确性 / 翻译腔 / AI 味 / 可读性——prompt 分别为 `{skill-dir}/references/evaluate-accuracy.md`、`evaluate-translationese.md`、`evaluate-ai-tone.md`、`evaluate-readability.md`；可读性维度**每 4 chunk 加文风对漂抽查**（派发消息注明触发）。
- **送审单元（节级锚）**：首审 = **整 chunk × 4 维**一次送审（§8 选型）；修复后仅 **sha 变化节 × 4 维 delta 补审**（只审变化节 + 邻节只读语境）；单元经 `staging/` 统一物化同构派发；**派发附该 chunk 原文全文作只读对照**（逐项核对依据；探针单元无原文，正常）；分节报告 + 每节独立结论。
- **C4 派发口径**（机械归属拆分，S2②）：staging 总行数/起止标题/节名枚举由 `status.mjs` 派发清单自动派生（`c4:` 行，随派发指令附给审校者——报告 sha 表逐字照抄）；agent 派发前自觉 `grep -n "^#" staging/<file>` 核对节序一致；终检随机抽核 ≥3 份兜底（`--seed N` 可复现，结果落 events）。
- 输入含 **per-chunk glossary 投影** + brief + **文风基准卡全文 + anchor 节选**（判卷口径 = 对照文风卡判偏离，四维均附）+ 翻译腔维度另附**已裁定保留术语聚合视图**（括注 (a) 类首现口径）；**报告头三行 `sha:/model:/time:`，整 chunk 首审另附逐节 sha 表（`sec:` 行）**——由 `status.mjs` 自译文内容派生，随派发指令附给审校者**逐字照抄、禁手算**（机器解析契约）；undersize/模板签名阈值随单元大小缩放；异模型尽量，环境不可控时 REPORT 披露。
- 关卡：四维报告齐备且非 stale。

### Step 7 修复闭环 `[主+脚本]`
- 按报告修复→重跑 Step 5→**sha 实际变化的节 × 4 维 delta 重审**（未变节豁免；队列由 `status.mjs` 差集派生）；修复中**增删括注的同步补记/勾销裁定台账行**（终检按台账集合对账，只改译文不改台账即 FAIL）。
- **fixer 闭环（S2④）**：审校 FAIL → `status.mjs <workdir> --verb fix --nn N [--dims …]` 物化 **fixer 包**（`staging/fixer-chunk-NN.md`=定位块+译文全文+FAIL 报告全文，≤40KB）→ 派 fixer subagent（**主上下文不进报告全文**，回传一行结论）→ 重跑 Step 5 → **复欠**=变化节 delta 队列自动回队列。包构成、C5 跨维采纳回核、升级出口与升级计数器三条款细则见 `{skill-dir}/references/fix-loop.md`。
- **修复环轮每 chunk ≤3**（`fix` 事件派生）：超限**停该 chunk** 登 `residue-chunk-NN.md`（项目不停）——与 Step 8 冻结窗补审轮分开计数，不挤占。

### Step 8 合并与统稿 `[脚本+subagent×1]`
- merge **只由 `merge.mjs` 执行**（判据契约见 `scripts/test/README.md`）→ `merged-draft.md`；final-gate 重导出复用其纯函数。**统稿先于终轮**（次序冻结：终轮读到统稿后的稳定稿）。
- 统稿三段式与变更 stale 分类（修复类/统稿替换类/句式级改写）细则见 `{skill-dir}/references/unify.md`；统稿轮 ≤2（冷读定点修计入，单套），超限转 PENDING-USER。
- **内容冻结窗（S2③）**：统稿完成后（冷读/PM 通读/终检阶段）内容冻结——pm-review 类发现**只登记不修**（落 analysis-notes / residue），**用户点名才修**；点名修复走 Step 7 fixer 闭环，其 delta 补审由 `status.mjs` 派发计数，**冻结窗补审轮项目级 ≤2 硬门：超限 dispatch 非零退出 + 写 pending.md 上报**（与修复环轮分开计数不挤占）。

### Step 9 全稿通读与验收准备 `[subagent×1-2 + 主]`（终检之前）
- 终稿**冷读者** subagent ×1-2（prompt = `{skill-dir}/references/cold-reader.md`）：以读者身份对照**文风基准卡**通读全稿，找文风断裂/明显错误/跨章不一致；>30KB 分段接力（重叠 ~2KB + 递进台账 + 收尾专读接缝/首末段；派发附 chunk 定位表；接力段只回传分段发现，主 agent 合并落盘）；**>100KB 强制 ≥2 名独立通读、发现取并集（分歧标注来源）**。台账覆盖行格式冻结：`- chunk <NN>: sha <12hex>`（终检对账）。
- **发现分流**：错误类→Step 7 修复闭环；文风类→统稿式定点修 + 接缝复查 + 冷读者复核；**发现清零（或复核通过）才放行**；定点修**计入统稿轮 ≤2**（单套），超限转 PENDING-USER。
- 主 agent PM 通读：**脚本化分层选样 ≥20%**（每 5 抽 1 + 升级/接缝必抽；final-gate 同规则重推导，漏抽即 FAIL）+ 标题快扫；结论写 `pm-review-<title>.md`（头部 `merged-sha: <12hex>` 锚不豁免 + 选样行 `- chunk <NN>: <实质结论>`——格式冻结）+ 步骤合规表（质量维度无 SKIPPED 合法标记）。
- 关卡：冷读发现清零（或复核通过）+ pm-review 落盘。

### Step 10 终检与交付 `[脚本]` ——**流程真正的最后一个动作**
- `final-gate.mjs` **重执行一切确定性检查**（不信任何落盘日志）——判据 F1-F13 权威登记于 `scripts/test/README.md`（机械重跑/重导出 diff/拼接 sha/完备性矩阵（准确性缺失 = 无条件 FAIL）/签名/G3/R23/标题锚/G4/探针命中每维每 run ≥1）。
- 探针：伪审校单元由 status 队列经 `staging/` 同构注入（与真 chunk 同构，照单派发）；ground truth 不落工作区。
- 新鲜度：豁免 glob 精确到文件（**pm-review 的 merged-sha 内容锚不豁免**）；固定顺序 = 冷读发现清零 → pm-review 最后写 → 终检最后跑；mtime 只作 WARN，硬判 = 内容 sha + 重执行结果。
- FAIL **半径分级**：单 chunk 根因 = scoped 重做（该 chunk 回 Step 6/7 + 接缝复查 + pm-review 重生成，其余成果保留）；全局根因（拼接 sha/完备性/探针未命中）= 全局阶段整体作废重走；连续 ≥3 次 FAIL 转 PENDING-USER。
- PASS → 脚本**原子改名**为 `translated-<title>-zh.md`（已存在交付物时拒绝覆盖——手修保护）→ REPORT 定稿（**交付物 sha 内容锚入 REPORT**）+ **交付摘要内联聊天输出**（按 `{skill-dir}/references/delivery-template.md`）。

## 横切机制

- **状态命令 = resume oracle**（`status.mjs`）：冷启动入口；再触发自动检测续跑；**双段契约**（人话一行 + 动作指令）。**C3 拆分**：`progress` 默认只读渲染零副作用；`dispatch` 才物化 + 追加事件。状态纯推导自文件系统，**唯一续跑文档 `status.md`**。
- **节级锚与 delta 队列生于脚本**：审校锚 = 逐节 sha 表（`sectionSlices`——与分段同款 fence 感知节边界；status/final-gate/verify-mech 三脚本同源派生）；修复后重审队列 = 变化节 × 4 维差集。报告锚一律脚本从内容派生，**禁止人工拼接**；夹具钉死（`scripts/test/README.md` 判据契约）。
- **决策落盘纪律（S2③）**：审校建议/统稿清单/历史参考的**采纳或不采纳当场落 analysis-notes**（逐条一句理由）——禁口头决策、禁事后补记。
- **D1 环境处置与限流保证**（429 分型 / 流停滞核验 / 并发 ≤5 两波制 / 退避四层 / 上下文溢出同路径恢复）细则见 `{skill-dir}/references/env-playbook.md`。
- **探针注入**：run 开始跑 `{skill-dir}/scripts/probe.mjs` 生成源侧 truth（`probe/truth/<run>.json`，不落工作区）；status 派发注入与 final-gate 命中比对均以 `--probe-truth` 传入。
- **draft 导入（S2⑥）**：外部半成品目录经 `import-draft.mjs` 按边界清单受/拒/隔离导入；旧 status.md 无 `schema:` 戳非零拒收；events 归档新建禁补记。
- **派发纪律**：派发指令 inputs/outputs 一律**绝对路径**（status 输出相对路径，subagent cwd 不定）；prompt 内相对路径以派发指令为准。
- **用户动词表**（继续/进度/停止/重翻/重新翻译/样张/双语对照）逐动词出口见 `{skill-dir}/references/verbs.md`。
- **brief 中途变更按性质分类**：注释密度档→不重翻（`«»` 仍在，按新档重跑 Step 4）；文风类→仅下游生效 + 登记统稿重点扫描；根本类（受众/用途）→披露代价由用户选。brief.md 更新落盘，status.md 记变更点。
- **会话预算**：每会话 N 单元后干净退出；单元幂等；N 同约束内存与主上下文增长；**单元 = 一次 subagent 调用**（基线 ~11/chunk）。
- **subagent 回传纪律**：仅回传 落盘路径 + 一行结论 + FAIL 项计数，报告/产物全文只落盘——保主上下文 O(1)。
- **PENDING-USER 挂起态**：`pending.md` 存在即挂起；处理后自动续跑——零介入唯一合法例外；待决终态一律走此门（不带病交付）。菜单：①继续（换模型/调参并记录）②手修后说"继续翻译"（按新 sha 重审）③终止；status 挂起态人话行输出此菜单。
- **并发参数** `--concurrency N` 默认 1；仅限"尴尬并行"阶段（翻译/裁定/校验/审校）；统稿、冷读、终检永远单发；**禁止自动上调**。
- **原文变更 re-keying**：chunk 按内容 sha 匹配保留成果（非序号）；原文 sha 变更 → 仅内容 sha 变更的 chunk 作废重翻，下游仅 **N+1 邻 chunk** handoff②/串行增强段重生成，全局阶段（merge/统稿/冷读/终检）整体作废重走。
- **交付后**：交付物 sha 已锚入 REPORT，再入不符 = 用户手改 → 询问"保留手修 or 重新交付"（手修永不覆盖）。**术语统一轻命令**：glossary 更新 → 全稿机械替换（逐条 diff 落盘）→ 受影响 chunk 重跑 Step 5 → final-gate 重入（复用统稿类通道，不重翻译）。

## 交付

- 交付即止：不自动触发发布——refined-stock 的 Stop/SessionEnd hook 自然发布 PASS 交付物（只发 `-zh.md`；bilingual 不命中发布模式）。
- **双语对照**：入口两形态——brief `双语对照: 开`（PASS 后跑 `{skill-dir}/scripts/derive-bilingual.mjs <workdir>`）或交付后动词 `双语对照 <title>`（幂等）。产物 `translated-<title>-bilingual.md` = 交付物 × 原文机械交错的只读派生视图：中文上英文下，节配对锚优先/配不齐降级节级，降级清单随尾注与 stdout；头部嵌源交付物 sha（status 三态：未生成/已生成/已过期）。双语字段归交付配置非翻译参数（双语模式不放宽注释政策）；派生只读不覆盖交付物、不触发 sha 不符询问（WARN 一行）。
- 动词 `审计翻译` / `查翻译质量`：以 REPORT.md 使用说明兜底（audit 脚本未实现）。
- `REPORT.md`：final-gate 渲染机器段（首屏结论/覆盖矩阵/sha 锚/FAIL 清单）+ 主 agent 按 `{skill-dir}/references/delivery-template.md` 追加人工段；内部术语附人话括注（如"探针 = 故意埋错看审校能否抓到"）。
