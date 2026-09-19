---
name: yiyue31-xl-translator
description: 翻译大英文文档（>40KB）为中文时启用。触发词：翻译大文档、大文档翻译、继续翻译、resume、翻译进度、翻到哪了、停止翻译、重翻第 N 章、重新翻译、双语对照、审计翻译、查翻译质量。小于 40KB 的文章请用 yiyue31-translator。
version: 0.4.0
author: Yiyue31
---

# yiyue31-xl-translator：大文档翻译编排

## 功能描述

- 角色 = **翻译项目编排者**：把 >40KB 英文大文档译成专业中文；≤40KB 小文章由 Step 0 自动交接 yiyue31-translator，不让用户重发。
- 纪律一：**状态只从文件系统推导**——任何动作前先跑状态命令（`{skill-dir}/scripts/status.mjs`），绝不依赖会话记忆。
- 纪律二：**逐 chunk 流水执行**——每个 chunk 走完 翻译→裁定→机械校验→四维审校→修复 过审后，才派发下一个 chunk；phase 视图（×N）仅用于叙述与预算汇报，不是执行序。
- **质量最高优先**：耗时/token 让位；异常出口只有 暂停+续跑 / 升级 / PENDING-USER，永不削减质量维度。
- 中文术语约定：`agent`（AI 义）译"智能体"；`token`（AI 义）译"词元"。

## Directory

- `{skill-dir}` = 本 SKILL.md 所在目录。引用文件封闭集（引用格式 `{skill-dir}/references/<file>`、`{skill-dir}/scripts/<file>`）：
  - **references/（9）**：translate-prompt.md、adjudicate-prompt.md、evaluate-accuracy.md、evaluate-translationese.md、evaluate-ai-tone.md、evaluate-readability.md、cold-reader.md、style-card.md、delivery-template.md。（terms.md 系运行时用户态：首次从 translator 一次性拷贝种子至工作目录，非本目录资产。）
  - **scripts/（10）**：segment/、verify-mech.mjs、status.mjs、merge.mjs、derive-bilingual.mjs、consistency.mjs、final-gate.mjs、probe.mjs、handoff.mjs、word-counter.mjs。
- 工作目录 `xl-translator/<title>/`（refined-stock 仓库根下）；文件命名遵循下方命名三条红线，status/final-gate 按脚本内建 glob 工作。
- 命名三条红线：①中间产物禁止以 `-zh.md` 结尾；②禁止 `summary-/talk-/merge-/final-/recommendation-` 前缀；③唯一交付物 `translated-<title>-zh.md` 由终检 PASS 原子改名产生——PASS 前全目录不得命中任何发布模式；`translated-<title>-bilingual.md` 为 PASS 后机械派生的**只读视图**（非交付物、不经终检、sha 不锚、不受手修保护、幂等可重生成，命名永不以 `-zh.md` 结尾）。
- 报告/台账的机器解析格式：各 prompt 与产物按 `{skill-dir}/references/` 对应文件的契约逐字执行，不得改写格式。

## 工作流程

> 执行者：`[脚本]` 确定性、零信任；`[subagent]` 独立调用（**严格串行**，一次一个，等返回再派下一个）；`[主]` 主 agent 编排与本地轻活。

### Step 0 发起与预检 `[主+脚本]`
- 取文→markdown 化→落 `original-<title>.md`（**落盘即统一归一 LF**——一切 sha 按落盘文件字节原样计算，防 CRLF 假错死锁）。brief 缺省默认值（技术读者/意译/中等注释密度/发布用途/**标题双语锚开**/**双语对照关**）直接落盘——**不问用户**；取文可得时附可选行 `来源:`/`作者:`（终检 PASS 前置元信息头的字段源）。
- 规模预检（`word-counter.mjs`）：**>40KB 单条件**才走 xl，否则自动交接 translator（读 `{translator-skill-dir}/SKILL.md` 按其执行 + 一行披露"已自动交接 translator"；不可读时退化本 skill 单 chunk 模式跑完并披露——零跨 skill 运行时依赖）；`--xl-force` 为测试/标定旁路。
- brief 扁平 key:value 逐行落盘，`双语对照: 关` 为缺省行（交付配置非翻译参数——见「交付」节；解析仿 `标题双语锚` 先例，不入 KEYMAP、机械校验零可见）。
- 原文完整性 WARN（末句截断/围栏不配对，提示不阻塞）；预算公告（chunk 数、subagent 调用基线、预计会话数 + **一行 brief 披露**："按技术读者/意译/中等注释密度/发布用途/标题双语锚开/双语对照关处理——注释密度即术语后附英文括注的多少（低/中/高）——想改就说'换成直译/注释少点/标题不加英文/要双语对照'"——通知非询问——用户须从此处知晓全部可改项）+ **原文 sha1（前 12 位）与 chunk 数**（聊天留痕 = 工作区外分母锚，交付时回显对照）+ **喊停方式与样张入口**：公告末附一行如何中断；支持"先翻第 N 章出样张"，用户确认风格后放全量。
- 关卡：无（本步不改翻译产物）。

### Step 1 分段 `[脚本]`
- `segment/`：目标带 8-15KB、跨级别合并、code block/表格原子不可切；**fence 感知**——标题解析跳过代码围栏。**巨块条件**：仅 fence/表格**原子块**可超限单 chunk 并以 `X` 标记；散文巨块强制再切（段落边界，落回目标带）。
- 产物：`chunks/` + `manifest.md`（heading 树；续跑状态统一进 `status.md`）。
- 关卡：**拼接 sha === 原文 sha**（钉死分母）；尺寸分布落目标带，否则自动调参重分段。

### Step 2 译前分析 `[主+评审subagent×1]`
- 主 agent 本地生成：`analysis-/glossary-/keep-list-/special-phrases-` + brief 落盘 + **文风基准卡**（按 `{skill-dir}/references/style-card.md` 生成 `style-card.md`：原文文风特征转写为中文写作规则，含**文体变化轴**；文体分化的书按部设多锚点）+ **全文标题树预译**（正文/目录标题照抄既定译名）；terms.md 首次种子拷贝。
- **标题双语锚（brief 默认开——全有或全无，非译者裁量）**：标题树预译产出**双语对**（中文译名 + 英文原文**逐字**），全级别 H1-H6；译文格式 = 标题行纯中文 + 次行弱化锚 `*English Heading*`；目录 TOC 仅中文。
- **special-phrases 精选表格式冻结**：每条一行 `<英文原句> :: <既定中文>`（`#` 注释与空行忽略）——终检兑现硬判的解析契约。
- glossary **一条一译**：脚本扫双选条目→自动打回重裁定直至零双选（**双选打回 ≤3 轮**，超限转 PENDING-USER）；**既定译法投影由脚本按各 chunk 原文扫描生成**（大小写/单复数归一，取该 chunk 将出现的条目子集）；>64KB 改 subagent 分段提取 + 脚本合并去重（主 agent 不整读原文，守 O(1)）。
- 译前产物评审 subagent ×1（独立）：复核 glossary 合规/keep-list 完备/special-phrases 质量/文风卡——不过打回重做（**≤2 轮**，超限升级评审模型一次，仍不过转 PENDING-USER）。
- 关卡：glossary 零双选；keep-list 非空（若原文有机械元素）。

### Step 3 翻译·阶段A `[subagent]` ×N 串行
- 派发前跑 `{skill-dir}/scripts/handoff.mjs <workdir>` 生成**机器件**：`handoff/projection-chunk-<NN>.md`（R8-b 既定译法投影：glossary × chunk 原文扫描，大小写/单复数归一）+ `handoff/context-chunk-<NN>.md`（串行增强段：邻 chunk 已审中文末段 + sha 锚）；**判断件** `handoff/chunk-<NN>.md`（①地图②"留下了什么"④台账⑤文风卡引用）由主 agent 组装。
- prompt = `{skill-dir}/references/translate-prompt.md`。输入 = **交接包五件套**（判断件 + 两机器件）：①全文 chunk 地图（含标题树既定译名）②前 chunk 末段摘要（含"留下了什么"）③该 chunk 译法投影（含标题条目）④贯穿比喻/叙事台账 ⑤文风卡；另附 chunk 原文 + keep-list + special-phrases + brief。
- 串行增强：派发时脚本**追加邻 chunk 已审中文末段 300-500 字**（sha 绑定）；chunk 1 过审后节选定稿入 `handoff/anchor.md` 作**范文锚点**。
- 输出带 `«english»` 标记的译文；**硬禁止直接括注**；金句/习语按精选表；**标题双语锚按 Step 2 双语对执行**（锚行逐字取自原文标题）；**glossary 外自裁定术语回传清单**（主 agent 一条一译裁定入表、更新下游投影）。
- 关卡：无（信任后置到 Step 5/6）。

### Step 4 注释裁定·阶段B `[subagent]` ×N 串行
- prompt = `{skill-dir}/references/adjudicate-prompt.md`。输入：阶段A 译文 + chunk 原文（裁定需语境：术语首现/金句）+ special-phrases 精选表 + 注释密度档（brief）+ **全文已裁定保留注释术语集**（同一术语括注全文唯一；精选表条目豁免——再现也须兑现）。
- 逐条裁定每个 `«»`：保留→`中文（English）`、删除→去标；扫直接括注违规；**裁定台账逐条落盘**（`adjudications/adjudication-chunk-<NN>.md`，行格式 `- «english» → 保留|删除`——格式冻结）。
- 关卡：`«»` 残留 = 0（正则）。

### Step 5 机械校验 `[脚本]` ×N
- `verify-mech.mjs [--projection <handoff/projection-chunk-NN.md>]`（Step 10 终检重执行同源）：原五项 + 数字/单位保真 + 散文残留英文阈值 + 中英间距 + 段落计数/长度比下限（防空洞化）+ **术语兑现硬判 R8-c**（投影条目既定译名/别名未在译文出现即打回；终检不信任落盘投影，从 glossary × chunk 原文**重推导**同参重跑）。
- **brief 阈值只能收紧不能放宽**（各键 clamp 安全域；中英间距不可经 brief 放宽；非默认阈值进 REPORT 首屏披露）。
- 修复后**强制重跑**；不过自动打回重翻（计返工轮次），**同 chunk 打回 ≤2 次 → 并入 Step 7 升级出口**；结果落 `verify-results.json`（终检不信任、会重跑）。
- **手修路径**（PENDING-USER 菜单②后）：间距类违规由脚本自动补空格（diff 披露）后重跑；手修 chunk **永不自动重翻**；仅结构性 FAIL（数字缺失/代码改动/漏译）才提示用户。
- 关卡：全项通过。

### Step 6 审校 `[subagent]` 串行
- **四维独立、全覆盖、不合并、不抽样**：准确性 / 翻译腔 / AI 味 / 可读性——prompt 分别为 `{skill-dir}/references/evaluate-accuracy.md`、`evaluate-translationese.md`、`evaluate-ai-tone.md`、`evaluate-readability.md`；可读性维度**每 4 chunk 加文风对漂抽查**（派发消息注明触发）。
- **半块送审**：每 chunk 切两半（标题边界锚定，a/b）分两次送审，译文半块经 `staging/` 统一物化同构派发；**派发附该 chunk 原文全文作只读对照**（逐项核对依据；探针单元无原文，正常）；另附边界段落（或 chunk 首 1-2 段）作只读语境（不计被审 sha、不入报告范围）；分节报告 + 每节独立结论。
- **C4 派发口径模板（2026-09-15 M3 回写）**：审校派发提示词**必须**包含以下四项，缺一即口径事故风险（M3 两起实证：chunk 02 边界误标 4 修复未复核、chunk 05 终点误标 72% 未审——"范围=staging 全文"兜底不敌错误终点标记）：
  1. **staging 总行数**（如"该 staging 文件全部 91 行"）
  2. **起止标题**（首行标题名 + 终点标题名或"至块末"）
  3. **所含节名枚举**（逐节列出，如"含 CI/CD 节全部/维护章/闭环引言与如何起步"）
  4. **派发前核对**：grep staging 文件标题树（`grep -n "^#" staging/<file>`），确认口径描述与实际标题序列一致后才派发
- 输入含 **per-chunk glossary 投影** + brief + **文风基准卡全文 + anchor 节选**（判卷口径 = 对照文风卡判偏离，四维均附）+ 翻译腔维度另附**已裁定保留术语聚合视图**（括注 (a) 类首现口径）；**报告头部三行 `sha:/model:/time:`**（被审半块 sha1 前 12 位——机器解析契约；主 agent 自 `status.mjs --json` 的 `state.chunks[].halves` 取值，随派发指令附给审校者）；undersize/模板签名阈值随单元大小缩放；异模型尽量，环境不可控时 REPORT 披露。
- 关卡：四维报告齐备且非 stale。

### Step 7 修复闭环 `[主+脚本]`
- 按报告修复→重跑 Step 5→sha 实际变化的半块 × 4 维 stale 重审；每 chunk 重审 ≤3 轮；修复中**增删括注的同步补记/勾销裁定台账行**（终检按台账集合对账，只改译文不改台账即 FAIL）。
- **C5 跨维采纳回核规则（2026-09-15 M3 回写）**：凡采纳非 accuracy 维（翻译腔/可读性/AI 味）的**结构性改写**（化定语为主谓、拆句重组、语序重排），改后必须对照原文回核**数字、比例、否定极性**——M3 实证：采纳可读性"化定语为主谓"建议时丢了 share 的比例义（"the share of X"变成"有多少 X"），靠 accuracy 次轮兜住；词级替换（换量词/换搭配）不触发此回核。
- 超限自动**升级**：换模型重翻该 chunk（prompt 附邻 chunk 中文首末段 + 文风卡；重翻后接缝 scoped 统稿 + seam 复查）；仍不收敛→PENDING-USER。**不存在降级路径**。
- **升级计数器三条款**：升级后该 chunk 重试计数器清零；每轮修复循环中升级至多一次；**累计升级 ≥2 次（跨轮，不随清零重置）→ 直接转 PENDING-USER**。

### Step 8 合并与统稿 `[脚本+subagent×1]`
- merge **只由 `merge.mjs` 执行**（判据契约见 `scripts/test/README.md`）→ 临时名 `merged-draft.md` 落盘；final-gate 重导出复用其纯函数。
- 统稿三段式：`consistency.mjs` 清单全量扫描（术语/密度离群/标题译法/间距/接缝/文风遵从）→ 决策 subagent 只读清单下结论 → 机械应用 → 受影响 chunk 重跑 Step 5。
- 变更分类 stale 规则：**修复类**=相关维度报告 stale 重审；**统稿替换类**=逐条 diff 清单落盘 + consistency 重扫代替四维重审（REPORT 披露）；句式级改写仍走四维重审。统稿轮 ≤2，超限转 PENDING-USER。

### Step 9 全稿通读与验收准备 `[subagent×1-2 + 主]`（终检之前）
- 终稿**冷读者** subagent ×1-2：prompt = `{skill-dir}/references/cold-reader.md`——全稿通读，以读者身份对照**文风基准卡**找文风断裂、明显错误、跨章不一致；>30KB 分段接力（段间重叠 ~2KB + 递进式发现台账 + 收尾专读全部接缝与各 chunk 首末段；**派发附 chunk 定位表**——各 chunk 起始标题，接缝定位用；接力段只回传分段发现，主 agent 合并后整体落盘台账）；**>100KB 强制 ≥2 名独立通读、发现取并集（分歧逐条标注来源，不加第三读者）**。台账覆盖行格式冻结：`- chunk <NN>: sha <12hex>`（终检逐 chunk 对账）。
- **发现分流**：错误类→走 Step 7 修复闭环；文风类→统稿式定点修 + 接缝复查 + 冷读者复核；**发现清零（或复核通过）才放行**；冷读定点修**计入统稿轮 ≤2**（单套计数器），超限转 PENDING-USER。
- 主 agent PM 通读：**脚本化分层选样 ≥20%**（每 5 抽 1 + 升级/接缝 chunk 必抽——选样集由 final-gate 同规则重推导核验，漏抽即终检 FAIL，防挑软柿子）+ 标题级快扫；结论写 `pm-review-<title>.md`（**头部 `merged-sha: <12hex>` 锚（终检不豁免）+ 选样行 `- chunk <NN>: <实质结论>`**——格式冻结），含**步骤合规表**——质量维度（准确性/翻译腔/AI味/可读性/冷读）**不存在 SKIPPED 合法标记**。
- 关卡：冷读发现清零（或复核通过）+ pm-review 落盘。

### Step 10 终检与交付 `[脚本]` ——**流程真正的最后一个动作**
- `final-gate.mjs` **重执行一切确定性检查**（不信任何落盘日志）：机械校验全项重跑、从 translated-chunks 重导出 merged 做 diff、拼接 sha 复核、完备性矩阵（分母=原文钉死；**准确性维度缺失 = 无条件 FAIL**）、报告签名扫描、G3 括注对账（双向相等）、精选表兑现、**标题双语锚硬判**（fence 感知分母；brief 关闭时随披露跳过并记 REPORT）、G4 冷读覆盖矩阵 + pm-review 选样集重推导、探针命中比对（truth 比对源侧 `probe.mjs` 产物；**每维度每 run ≥1，缺报告即 FAIL**）。
- 探针：伪审校单元由 status 队列经 `staging/` 同构注入（路径形态与真 chunk 无差别，主 agent 照单派发）；ground truth 不落工作区。
- 新鲜度：豁免 glob 精确到文件（**pm-review 的 merged-sha 内容锚不豁免**）；固定顺序 = 冷读发现清零 → pm-review 最后写（记 sha 锚）→ 终检最后跑；mtime 只作 WARN，硬判 = 内容 sha + 重执行结果。
- FAIL **半径分级**：单 chunk 根因 = scoped 重做（该 chunk 回 Step 6/7 + 接缝复查 + pm-review 重生成，其余成果保留）；全局根因（拼接 sha/完备性/探针未命中）= 全局阶段整体作废重走；连续 ≥3 次 FAIL 转 PENDING-USER。
- PASS → 脚本**原子改名**为 `translated-<title>-zh.md`（已存在交付物时拒绝覆盖——手修保护）→ REPORT 定稿（**交付物 sha 内容锚入 REPORT**）+ **交付摘要内联聊天输出**（按 `{skill-dir}/references/delivery-template.md`）。

## 横切机制

- **状态命令 = resume oracle**（`status.mjs`）：冷启动入口；同文件再触发自动检测进行中并续跑；**输出双段契约**——人话一行 + 动作指令。**C3 view/dispatch 拆分（2026-09-15 M3 回写）**：无动词或动词=`progress` 默认**只读渲染**（零副作用——不物化 staging、不追加事件）；动词=`dispatch` 时才物化 + 追加事件——"运行一次 = 派发一轮承诺"不再是默认行为（M3 实证：三连跑产生 36 条幻影 dispatch 事件）。状态纯推导自文件系统，**唯一续跑文档 `status.md`**。
- **D1 环境处置模板（2026-09-15 M3 回写）**：API 限流/流停滞的编排侧处置（M3 全程 7 个配额窗 + 多次流停滞击杀 20+ 单元的经验沉淀）：
  - 429 `[1302]`（突发限流）→ 等在途单元回传一个后原样补派（并发已降即自愈）
  - 429 `[1308]`（五小时配额上限）→ **定时等窗续跑**（cron 定在重置时刻后 ~5min；不空转重试）
  - 流停滞（watchdog 600s）→ **先核验无半成品落盘**（读报告文件头 sha 是否旧值）→ 原样重派；禁 web 条款随派发提示词附带
  - 并发纪律：**≤5 两波制**（首波 5 + 回传 1-2 后派次波 3-4；8 并发实测触发突发限流）
- **探针注入**：run 开始时主 agent 跑 `{skill-dir}/scripts/probe.mjs` 生成源侧 truth（`probe/truth/<run>.json`，不落工作区）；status.mjs 派发注入与 final-gate.mjs 命中比对均以 `--probe-truth` 传入。
- **派发纪律**：派发指令中的 inputs/outputs 一律转**绝对路径**（status 输出为相对路径，subagent cwd 不定）；各 prompt 内的相对路径均以派发指令为准。
- **用户动词表**（全部挂状态命令）：`继续翻译 <title>`（续跑；封存态下 = 解封续跑）/ `翻译进度`、`<title> 翻到哪了`（人话进度）/ `停止翻译 <title>`（封存标记 + 一行总结）/ `重翻 <title> 第 N 章`（执行前一行披露章↔chunk 映射如"第 3 章 = chunk 05-06"；作废范围按 re-keying 冻结语义）/ `重新翻译 <title>`（新起全量，与封存后"继续"两出口在 status.md 写明）/ `先翻 <title> 第 N 章`（样张）/ `双语对照 <title>`（幂等生成/重生成双语派生视图——存量已交付项目随时可说；status 已交付态三态提示未生成/已生成/已过期）。
- **brief 中途变更按性质分类**：注释密度档→不重翻（`«»` 标记仍在，仅按新档重跑 Step 4 裁定）；文风类→仅下游生效 + 变更点登记统稿重点扫描；根本类（受众/用途）→披露代价由用户选范围。brief.md 更新落盘，status.md 记变更点。
- **会话预算**：每会话处理 N 单元后干净退出；每单元幂等；N 同时约束内存与主会话上下文增长（默认值 M3 标定）；**单元 = 一次 subagent 调用**（基线 ~11 单元/chunk）。
- **subagent 回传纪律**：仅回传 落盘路径 + 一行结论 + FAIL 项计数，报告/产物全文只落盘——保主上下文 O(1)。
- **限流四层保证**：宿主退避吸收瞬时限流；单元派发失败指数退避重试 ≤2 次→仍败干净挂起（status.md 记原因 + 续跑口令）；逐 chunk 流水完成即落盘带 sha→任意时刻中断损失 ≤1 在途单元；幂等续跑（sha 命中即跳过）。被动触发无常驻能力，不承诺自动唤醒。
- **上下文溢出防护**：每单元完成即检查点；/compact、上下文压缩、OOM、/clear 同路径恢复（重跑状态命令即恢复）。
- **PENDING-USER 挂起态**：`pending.md` 存在即挂起；干净退出附一行说明，处理后自动续跑——零介入唯一合法例外；待决终态一律走此门（不带病交付）。菜单：①继续（系统侧换模型/调参并记录）②用户手修译文后说"继续翻译"（按新 sha 自动重审）③终止项目；status 挂起态人话行输出此菜单。
- **并发参数** `--concurrency N` 默认 1；仅限"尴尬并行"阶段（翻译/裁定/机械校验/审校）；统稿、冷读者、终检永远单发；**禁止自动上调**。
- **原文变更 re-keying**：chunk 按内容 sha 匹配保留成果（非序号）；原文 sha 变更 → **仅内容 sha 实际变更的 chunk 作废重翻**（未变更 chunk 绝不因位置/序号重翻），下游仅 **N+1 邻 chunk** 的 handoff②/串行增强段重生成，全局阶段（merge/统稿/冷读/终检）整体作废重走。
- **交付后**：交付物 sha 已锚入 REPORT，再入不符 = 用户手改 → 询问"保留手修 or 按流程产物重新交付"（手修永不覆盖）。**术语统一轻命令**：glossary 更新 → 全稿术语表驱动机械替换（逐条 diff 落盘）→ 受影响 chunk 重跑 Step 5 → final-gate 重入（复用统稿类变更通道，不重翻译）。

## 交付

- 交付即止：不自动触发发布管线——refined-stock 的 Stop/SessionEnd hook 会自然发布 PASS 后的交付物（只发 `-zh.md` 交付物；bilingual 派生视图不以 `-zh.md` 结尾、不命中发布模式）。
- **双语对照**：入口两形态——发起时 brief `双语对照: 开`（PASS 后主 agent 查 brief，开则跑 `{skill-dir}/scripts/derive-bilingual.mjs <workdir>`）或交付后随时说动词 `双语对照 <title>`（幂等重生成）。产物 `translated-<title>-bilingual.md` = （交付物 × 原文）机械交错的只读派生视图：中文在上英文在下，节配对锚优先/配不齐降级节级对照，降级清单随文件尾注释与 stdout 可见；头部嵌源交付物 sha——status 已交付态据此三态显示（未生成/已生成·基于当前交付物/已过期·重说动词再生成）。双语字段归交付配置非翻译参数（解耦不变量：双语模式下不放宽注释政策）。**派生视图生成不触发 sha 不符询问——派生只读不覆盖交付物，WARN 一行即止**（与「交付后」"再入不符 = 询问"规则不相干——后者只护交付物本体）。
- 动词 `审计翻译` / `查翻译质量`：以 REPORT.md 使用说明兜底（audit 脚本未实现）。
- `REPORT.md`：final-gate 渲染机器段（首屏结论/覆盖矩阵/sha 锚/FAIL 清单）+ 主 agent 按 `{skill-dir}/references/delivery-template.md` 追加人工段；内部术语附人话括注（如"探针 4 次 = 故意埋 4 处错看审校能否全抓到"）。
