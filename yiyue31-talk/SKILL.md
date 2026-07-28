---
name: yiyue31-talk
description: 读到好文章（技术/新闻）后，产出**可分享的中文心得成品**——把自己的理解、收获、看法或推荐整理成稿。触发："生成心得"、"提取观点"、"写收获"、"分享我的看法"、"写个推荐"等想就一篇文章写下自己想法的场合；中断后续做："继续心得"、"恢复 talk"、"接着上次"、"resume talk"。
version: 0.0.6
---

# 用户心得分享 Skill

读到好文章后，快速产出**可分享的中文心得成品**。AI 不盘问、不替用户下判断，只呈现原文内容、整理用户的话。

**为什么是这个形态**：访谈/讨论式（AI 提问、用户答）被验证既累又跑题——用户被动答题，AI 还常问出与用户想法大相径庭的问题。本 skill 反转：用户在作者位（选材、批注、写看法），AI 在辅助位（提取、整合、排版、组装），不发问、不编造。

## 提案制（全局护栏）

**为什么**：AI 的任何"加法"——提取角度、决定结构、强化某个点、读者/编辑的建议——都只能由用户拍板才能进稿（用户在作者位，见"为什么是这个形态"）。用户不确认，AI 就只做"忠实重组"（搬运用户原话 + 原文：调序、归并、顺可读性，不改义、不加料）。

**规则**：所有 AI 加法行为一律以**提案**形式呈现，逐条由用户确认后才并入初稿。**未确认的提案一律不进稿**——此时 AI 产出仅为忠实重组。已采纳的提案即"用户授权内容"，下游减法检查不再以"AI 发挥"质疑。

## 两条路径

- **dump 模式**（心得已成形）：用户分批写下所有看法，AI 忠实整合成稿。
- **策展模式**（心得未成形）：AI 摆出原文的"点"，用户挑几个、加批注，AI 组装。

**输出形态**（自由结构 / 模板）独立于路径，见"路由"。

---

## 目录约定

`{skill-dir}` = 本 SKILL.md 所在目录路径（仅用于读 `references/` 下的 prompt）。

`{title}/talk/` 的根目录是**工作目录（cwd）**，所有产物（original / progress / journal / user-input / draft / points / picked / review-* / talk-*）都写在此处，**不写在 `{skill-dir}`**。会话跟着项目走，便于跨设备流转（见「断点与恢复·跨设备」）。

## Reusable Sub-workflows

### Evaluate Once

单次审查：调 subagent，出报告，通过或不通过。审查 prompt 自身定义"通过"条件（通常为"无问题"）。

**参数（调用方提供）：**
- `{eval-prompt}`：审查 prompt 文件路径
- `{input-files}`：待审文件（可为多个）
- `{output-file}`：审查报告保存位置
- `{max-rounds}`：复审上限

**流程：**
1. 以 `{eval-prompt}` 为标准，把 `{input-files}` 内容作为输入调 subagent。
2. 保存报告到 `{output-file}`。
3. 报告无问题 → 通过。有问题 → 按建议修正，复审。最多 `{max-rounds}` 轮。
4. 轮次用尽仍有问题 → 展示当前版本与剩余问题，由用户决定。

**返回：** PASS/FAIL + 报告路径。

**注意**：提议轮不复用 Evaluate Once（理由见该节）。

---

## title 安全化

仅保留字母、数字、CJK 字符、`-`、`_`，其余替换为 `-`，合并连续 `-`，去除首尾 `-`。**压成短 slug，限 16 字符**（CJK 与拉丁字母各计 1；超出时截到最近的 `-` 词边界，无词边界则硬截）。示例：`《AI 重塑软件开发：2026 年趋势》` → `AI-重塑软件开发`；`《大模型时代的软件开发范式转移与实践总结》` → `大模型时代的软件开发范`（截断）。路径无效时用简短英文替代。

**为什么限短**：`{title}` 既是目录名又出现在每个产物文件名（`{name}-{title}.md`）里，不限长则目录与全部文件都过长（对标 yiyue31-summary 的 ≤5 词短 slug）。

## 断点与恢复

**为什么**：talk 任务用户介入多、常跨天/跨设备；无显式状态指针与决策台账时，恢复只能靠推断文件存在性，易错且不知"上次到哪"。

### 两份会话文件（均在 `{title}/talk/`）

**`progress-{title}.json`**——结构化状态，恢复的**单一权威来源**：

```json
{
  "title": "{安全化 title}",
  "skill": "yiyue31-talk",
  "skill_version": "0.0.6",
  "route": "dump | 策展",
  "form": "free | template",
  "current_step": "step0 | routing | D1 | D2 | D3 | D4 | C1 | C2 | C3 | assembly | propose | quality | alt-form | done",
  "input_done": "no | yes",
  "primary_done": false,
  "decisions": {
    "routing": "路由 + 形态选择（含时间）",
    "selected_points": "策展：保留点 + 权重（强化/保留/弱化/删）",
    "accepted_proposals": "提议轮：用户采纳的建议清单",
    "confirmed_structure": "自由结构组装：用户确认的结构"
  },
  "next_action": "一句话：接下来做什么",
  "started_at": "ISO",
  "last_updated": "ISO"
}
```

**`journal-{title}.md`**——逐次交互 append-only 日志（审计时间线）。每条一行：`## [ISO] {step} · {用户|AI} — 发生了什么；触及文件`。只追加、不改写、不删（与 `user-input` 同纪律）。

### Checkpoint 协议（全流程通用，不在每步重复）

每次交互后：① 状态有变 → 更新 `progress-{title}.json`（至少 `current_step` + `last_updated`；发生决策时写对应 `decisions.*`）；② 追加一条 `journal-{title}.md`——用户每批输入、路由/形态决策、AI 生成（C1 提点 / D2 初稿 / 组装稿）、选点 + 打权重、提议轮出报告与采纳、各道质量审查、追加参考资料、暂停/恢复都要记。**写盘顺序：内容文件 → journal → progress.json**（progress 最后写，保证"progress 标完成 ⇒ 对应产物必在"）。

`current_step` 迁移表（事件 → 新值；无明示时按此推进）：

| 触发事件 | current_step → | 附带 |
|---|---|---|
| Step 0 落盘 `original` | `step0` | 建会话两件套 |
| 路由定 route/form | `D1`（dump）/ `C1`（策展） | `input_done=no`；写 `decisions.routing` |
| 用户说 done（D1） | `D2` | `input_done=yes` |
| D2 落盘 `draft` | `D3` | - |
| D3 采纳补段 | 回 `D2`（重出初稿） | 采纳段追加进 `user-input` |
| D3 不补 / 跳过 | `D4` | - |
| D4 通过 | `assembly` | - |
| C1 落盘 `points` | `C2` | - |
| C2 落盘 `picked` | `C3` | 写 `decisions.selected_points` |
| 用户说 done（C3） | `assembly` | `input_done=yes` |
| assembly 落盘 `talk-{title}.md` | `propose` | 自由结构先写 `decisions.confirmed_structure` |
| 提议轮出 `review-propose` + 采纳回流 | `quality` | 写 `decisions.accepted_proposals` |
| 三道审查通过 | `done` | primary 初稿定稿 |
| 用户确认 `talk-{title}.md` | `done` | `primary_done=true` |
| 用户要另一形态 | `alt-form` | `primary_done` 已 true |
| 另一形态完成 / 用户放弃 | `done` | `primary_done` 保持 true |

### 恢复入口

激活时，或用户说"继续心得 / 恢复 talk / 接着上次 / resume talk"：扫 cwd 一层找 `*/talk/progress-*.json`（只扫一层，避免误抓项目内无关会话）。

- 无 → 全新开始（Step 0）。
- 一份且 `current_step != done` → 出示 title、route/form、current_step、last_updated、next_action、journal 末 1–2 条；AskUserQuestion：继续 / 重新开始 / 跳转步骤。续做前先在 journal 追加一条"恢复"记录接上时间线。
- 一份且 `current_step == done`：`primary_done=false` → 提示"primary 已定稿，待你确认"；`primary_done=true` → 提示"任务已完成"，问是否开新会话或回到 alt-form。
- 多份 → 每份出示 title + current_step + last_updated，让用户选。
- `progress.json` 解析失败 / 字段缺失 → 备份原文件，退化为靠「恢复逻辑」表推断，并提示"进度文件损坏"。

### 跨设备

`{title}/talk/`（含 progress.json + journal.md + 全部产物）写在**工作目录**（cwd），不是 skill 目录——会话随项目跨设备流转（git / 网盘 / 手动拷贝），到目标设备用"继续/恢复"触发即可续做。skill 不做云同步、不加打包步骤。

## 恢复逻辑

**先读 `progress-{title}.json`**（`current_step` + `decisions` 为权威），再用下表核对产物文件——表作**一致性校验与兜底**。两向不一致都按"以文件实际存在性定位内容"处理、并提示"进度文件与产物不一致，可能上次未干净落盘"：progress 乐观（标 D2 完成却缺 `draft`）→ 视为未完成、回 D2；progress 落后（`draft` 在却标 D1）→ 视为 D2 已完成、推进 current_step。progress.json 完全缺失时退化为纯靠下表推断（向后兼容旧会话）。

| 已有文件 | 模式 / 完成步骤 |
|---------|---------------|
| `original-{title}.md` | Step 0 完成 |
| `progress-{title}.json` | 结构化状态（见"断点与恢复"；Step 0 起创建） |
| `journal-{title}.md` | 交互日志（见"断点与恢复"；Step 0 起创建） |
| `refs/` | 参考资料（任意步骤追加；URL 内容抓取后保存） |
| `refs/MANIFEST.md` | 参考资料溯源清单（append-only） |
| `user-input-{title}.md` | D1 / C3 / D3 用户原话分批追加（纯内容）；输入是否完成看 `progress.json` 的 `input_done` |
| `points-{title}.md` | 策展，C1 完成（≤5 点 + "可补回"清单）|
| `picked-{title}.md` | 策展，C2 完成（含权重：建议强化 / 保留 / 弱化 / 删）|
| `draft-{title}.md` | dump，D2 完成 |
| `review-faith-{title}.md` | dump，D4 完成（核 `draft`）|
| `talk-{title}.md` | 共用组装完成（primary 形态）|
| `review-propose-{title}.md` | 读者 / 编辑提议轮完成（建议已出，含用户采纳标记）|
| `review-quality-{title}.md` | 减法三道检查完成 |
| `talk-{title}-{form}.md` | 按需另一形态已生成（可选；`-free` / `-template`）|
| `review-diff-{title}-{form}.md` | 另一形态"无新增内容"自查报告（可选）|

存在未完成工作 → 询问用户：继续 / 重新开始 / 跳转步骤。

---

## Workflow

### Step 0: 输入格式化

将用户输入转为 Markdown。来源：URL（优先用本地 skill 下载）/ 文件路径 / 粘贴内容。title 安全化后保存。

保存：`{title}/talk/original-{title}.md`

同时创建会话状态两件套（见"断点与恢复"）：`progress-{title}.json`（填 `title` + `started_at` + `current_step: step0`）与 `journal-{title}.md` 首条记录。

### 路由

**始终**用 AskUserQuestion 询问（即使用户触发语已带看法，也由用户实时选，不自动跳过）。问两件：

**1. 内容路径**（怎么收集心得内容）：
- 想好 → **dump 模式**（分批写）
- 没想好 → **策展模式**（AI 摆原文点，你挑、你批注）

**2. 输出形态**（成品长什么样；只选一个，另一个按需再出）：
- **分享**（社交 / 博客，抓眼球优先）→ 默认 **自由结构**：钩子开头；AI 提议结构 → 用户确认（结构决定本身是加法，走提案制）。
- **归档 / 正式**（存查 / 笔记，规范优先）→ **模板**：固定四块（引言 / 心得正文 / 总结 / 推荐语）；引言内部钩子先行，正文内部围绕用户最主要的单一论点展开、次要点收入批注或总结、不再分多并列小节。

路由决定写入 `progress-{title}.json` 的 `route` / `form` / `input_done`（单一来源，见"断点与恢复"），并把 `decisions.routing` 记为"路由 + 形态选择（含时间）"；`current_step` 推进到 `D1`（dump）或 `C1`（策展）。`user-input-{title}.md` 只追加用户原话、不带元数据。

- 用户说 done 时把 `input_done` 改 `yes`。
- 形态 ↔ 文件后缀：自由结构 = `free` → `-free`；模板 = `template` → `-template`。

**按需另一种形态**：primary 形态经用户确认后，用户可要求出另一形态——**约束式 re-skin**，内容锁定自 primary 的已确认内容，不得新增观点 / 数据 / 引文。保存 `talk-{title}-{form}.md`（如 `talk-{title}-template.md`）。**不重命名** `talk-{title}.md`（`yiyue31-merge` 依赖此文件名）。

### 参考资料（任意步骤可追加）

用户可随时追加参考资料（URL / md / txt 等）补充背景。**必须落盘**——URL 内容用 web-access skill 抓取后保存，不只存链接（链接会腐烂，跨设备 / 跨天续做时拿不到）。

- 存放：`{title}/talk/refs/`，每份 `ref-{NN}-{安全化名}.{ext}`（文件保留原扩展名；URL 转 markdown 存 `.md`）。
- 溯源：`refs/MANIFEST.md`（append-only）逐条记 序号 / 类型（url|file|paste）/ 来源 / 抓取时间 / 存为文件名 / 备注。
- 旁路动作：不改 `current_step`；走 Checkpoint 协议（存文件 + 写 MANIFEST + journal + 更新 progress `last_updated`）。
- 用途与归属：refs 是合法来源之一（见 D2 / D4 / 组装 / 提议轮），成品按三栏标注——原文 / 参考[X] / 我的话。

### 批量输入与 "done?" 门

D1（dump）与 C3（策展批注）均为**循环**：用户可分多批输入，AI 把每批原样**追加**到 `user-input-{title}.md`（只追加、不改写、不删）。

**关键门**：组装 / 生成**不启动**，直到用户明确说 "done / 写完了 / 可以了 / 没了"。每批追加后 AI 只回"已记下，继续或说 done 结束"，不发问、不补写、不自动开始组装。

---

### dump 模式

#### D1: 用户分批输入看法

用户自由写下所有看法（可乱序、可口语、可分多次）。每批原样追加到 `user-input-{title}.md`。用户说"done"前不进 D2。

#### D2: AI 忠实整合成稿

读 `user-input` + `original` + `refs`，产出结构化初稿：

- 按主题或原文章节归并用户观点。
- 明确标注原文 / 参考[X] / 我的话。
- 补足让没读过原文的读者也能看懂的上下文（仅必要）。
- 顺可读性。
- **标点（硬约束）**：禁止 em dash（`—`、`——`），用逗号 / 冒号 / 拆句等中文写法代替（与组装一致）。

**护栏（强制）**：严格按"原文 + 参考 + 用户输入"成稿，禁止 AI 自行发挥。可重组、补必要原文 / 参考上下文、顺可读性，但不得添加原文、参考与用户输入之外的任何观点、论据或修饰。**用户说得少，稿子就短——不能为丰满而编造。** 角度提炼、张力放大等加值留给"读者 / 编辑提议轮"。

保存：`{title}/talk/draft-{title}.md`

#### D3: 缺口提示（可选）

AI 列出原文里用户没提到的关键点（"你没提 X、Y，要补吗？"）。内容锚定、非猜问题。**走提案制**：用户决定补 / 不补；补则把用户补的原话追加进 `user-input-{title}.md`（标 `# D3 采纳`），与 D1 同等地位，再回 D2 重出初稿。**D3 最多一轮**，避免与 D2 反复循环。

#### D4: faithfulness 检查（Evaluate Once）

核对 `draft`：每条"我的"观点都能在 `user-input`（含 D3 采纳段）找到来源，且无原文、参考与用户输入之外的内容（禁止 AI 发挥）。

- `{eval-prompt}`：`{skill-dir}/references/evaluate-faithfulness-prompt.md`
- `{input-files}`：`draft` + `user-input` + `original` + `refs`
- `{output-file}`：`{title}/talk/review-faith-{title}.md`
- `{max-rounds}`：2

不通过 → 按 D2 护栏修正，复审。

**→ 进入"共用组装"。**

---

### 策展模式

#### C1: AI 提取原文点

单遍分析 `original`（脊柱；refs 不在此提点，留待 C3 / D2 / 提议轮引用），抽取"点"：关键论断 + 出彩句 + 争议点。**总数 ≤ 5**（聚焦，不贪多）。AI 主动标注其中 top 2-3 为"**建议强化 / 重点**"（标注是提案，走提案制）。按讨论价值排序（高优先）。

同时把**未入选的点**单列一份"**可补回**"清单（用户可勾选补回）。

保存：`{title}/talk/points-{title}.md`

#### C2: 用户多选收敛 + 权重

每一点呈现在**一行**：

`[点] · 建议：强化 / 保留 / 弱化 / 删`

用户对每点选一个权重，并可改 AI 的建议。**始终**附一个**自由文本输入框**，让用户加 AI 没提到的点。**若用户一个点都不选，询问是否换 dump 路径或回 C1 重提点；不可默默进入空组装。**"强化"是加法 → 走提案制（用户确认该点的强化方向）。

记录：`{title}/talk/picked-{title}.md`（格式：每点一行带权重标签 + 末尾"# 用户补充"段落）

**为什么是"点"不是"问题"**：呈现原文的点，让用户直接对内容反应，而非回答 AI 拟的、可能跑题的问题（同"为什么是这个形态"）。收敛即一次多选 + 打权重，秒级完成。

#### C3: 用户选择性加批注

仅在保留点上写"我的理解"（1-2 句）。想写的写，不想写的留摘录。AI 不主动提问；用户卡壳时可要求 AI 代拟一句、再改。批注可分批，原样追加到 `user-input-{title}.md`。用户说"done"前不进组装。

**→ 进入"共用组装"。** 策展模式无 faithfulness 检查——内容是用户自己选、自己写的，用户即质量门。

---

### 共用组装：分享稿（primary 形态）

**输出语言固定为中文。** 产出 primary 形态初稿（待提议轮确认）。

**标点（硬约束）**：全文禁止 em dash（`—`、`——`），用逗号 / 冒号 / 拆句等中文写法代替；ai-tone 检查兜底复核。

**形态分支**：
- **自由结构**：AI 先提议一个结构（提案）→ 用户确认 → 按确认结构组装。用户拒绝则请用户给出自己的结构或要求 AI 重提，结构未定前不进组装。钩子开篇，长短自由。
- **模板**：固定四块组装：
  1. **引言**：钩子先行——先抛出用户最尖锐的判断或最大反差（来自用户原话），再补半句背景。
  2. **心得正文**：围绕用户最主要的单一论点组织，次要点收入批注或总结，不再分多并列小节。
     - dump → D2 整合稿。
     - 策展 → 重点摘录 + 我的批注（按保留点 + 权重组织）。
  3. **总结**：关键启示（无指定长度）。
  4. **推荐语**：两版——**≤100 汉字**（社交动态）+ **≤200 汉字**（博客前言），文稿内标注用途；社交版尤其要"开头即钩"，因其本身就是动态正文。

**通则**：全文区分原文 / 参考[X] / 我的话；数据 / 名称保持原值。引言 / 总结 / 推荐语 / 过渡这些 AI 生成的成稿文字仅作"待确认"草稿，其加值由下一道"提议轮"把关。

保存：`{title}/talk/talk-{title}.md`

### 共用：读者 / 编辑提议轮（加法门）

组装初稿完成后、三道减法检查之前，跑一轮"提议"——让两个独立视角审视初稿，**提出可增强的建议**，由用户拍板是否采纳。这是**加法层**（建议增删改以提升吸引力与完备性），与后续三道**减法检查**（只润表达、自动修正）性质不同。

**为什么不复用 Evaluate Once**：Evaluate Once 是 pass/fail + 自动修正。提议轮**不判通过、不自动改**——只出建议清单，每条是否落地由用户当场决定。强行套 Evaluate Once 会把"建议"误当成"问题"自动改掉，越过用户作者位。

**输入**：
- `talk-{title}.md`（组装初稿）
- `user-input-{title}.md`（用户原话，第一参照）
- `original-{title}.md`（原文）
- `refs/`（参考资料，合法来源之一；建议须可回溯到用户原话、原文或参考）
- （策展模式额外）`picked-{title}.md`（选点 + 权重 + 强化理由，与 `user-input` 同为第一参照）

**两个 subagent（并行）**：
1. **读者视角**（appeal / 吸引力）：以"目标读者会不会想读下去、会不会被勾住"为镜，建议如何让开头更抓人、张力更明显、节奏更带感。prompt：`{skill-dir}/references/evaluate-reader-appeal-prompt.md`。
2. **编辑视角**（structure / 完备性）：以"结构是否清楚、论点是否站得住、有没有缺口或冗余"为镜，建议如何重组、补必要上下文、砍多余。prompt：`{skill-dir}/references/evaluate-editor-review-prompt.md`。

两个 prompt 共享 5 条约束（不改义 / 不删用户保留项 / 只建议不自动改 / 可回溯强化但不编造 / 改写不引入 em dash），**单一定义于** `{skill-dir}/references/shared-constraints.md`：调用每个 subagent 时，先把该文件内容拼在该视角 prompt 之前作为强制前提；约束不再内联进两份 prompt，避免拷贝漂移。

**合并报告**：两个 subagent 的建议合并为一份，保存 `{title}/talk/review-propose-{title}.md`。每条标明：来源视角（读者 / 编辑）、类型（结构 / 张力 / 完备性 / 措辞）、引用位置、可回溯依据、具体改写建议（"建议更自然"不算，必须给具体改写或具体增删）。两个视角建议冲突时并排列出，由用户裁定。

**用户确认（提案制落地）**：展示 `review-propose-{title}.md`，用户多选要采纳的建议（可全不选、可改写、可补自己的）。**未选的建议一律不进稿。** 若合并后 0 条建议，跳过确认，直接进三道减法检查。每任务一轮；用户显式要求才跑第二轮。

**回流**：把用户选中的建议应用到 `talk-{title}.md`。被采纳的内容即"用户授权内容"，后续减法检查不再以"AI 发挥"质疑。

### 质量审查（三道减法检查，提议轮后）

对应用后的 `talk-{title}.md` 跑三道检查（并行 subagent），任一有问题则统一修正后复审，最多 2 轮：

1. **翻译味儿审查**：`{skill-dir}/references/evaluate-translationese-prompt.md`——欧化句式、"的"字堆叠、被动滥用、生硬连接词等翻译腔。
2. **可读性审查**：`{skill-dir}/references/evaluate-readability-prompt.md`——语义断裂、逻辑跳跃、术语堆砌、指代不清等阻断理解的问题。
3. **AI 味儿审查**：`{skill-dir}/references/evaluate-ai-tone-prompt.md`——套路化、口语化、空话等 AI 写作痕迹。

三道均以 `talk-{title}.md` 为 `{input-files}`，报告合并 `{title}/talk/review-quality-{title}.md`，各 `{max-rounds}`：2，并行。

**审查范围（重要）**：只审 AI 生成的成稿文字（引言、总结、推荐语、dump 整合正文、策展中的过渡与组织），**不改原文摘录与用户原话批注**——那是原文与用户的声音，不是 AI 要修的对象。三道检查只润色表达，不得改变含义或增删内容。

### 按需：另一种形态

用户确认 primary（`talk-{title}.md`）后，若要求出另一形态：从已确认内容做**约束式 re-skin**，不得新增观点 / 数据 / 引文。对新生成的 `talk-{title}-{form}.md`：

1. **三道减法检查**（同 primary）。
2. **无新增内容自查**（AI 做，语义层）：逐条核对该形态里每个观点 / 数据 / 引文都能在已确认 primary `talk-{title}.md` 找到同源，不得有 primary 没有的新内容。结果记 `{title}/talk/review-diff-{title}-{form}.md`。
3. 自查发现新增内容 → 展示给用户裁定（保留 / 删除），不自动改。

不重跑提议轮、不做完整 D4。

---

用户确认 `talk-{title}.md` 后：置 `primary_done=true`（`current_step` 已为 `done`），任务完成。
