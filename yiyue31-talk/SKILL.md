---
name: yiyue31-talk
description: 读到好文章（技术/新闻）后，产出**可分享的中文心得成品**——把自己的理解、收获、看法或推荐整理成稿。触发："生成心得"、"提取观点"、"写收获"、"分享我的看法"、"写个推荐"等想就一篇文章写下自己想法的场合；中断后续做："继续心得"、"恢复 talk"、"接着上次"、"resume talk"。
version: 0.0.7
---

# 用户心得分享 Skill

读到好文章后，快速产出**可分享的中文心得成品**。AI 不盘问、不替用户下判断，只呈现原文内容、整理用户的话。

**为什么是这个形态**：讨论式（AI 提问、用户答）易跑题、用户被动。本 skill 反转：用户在作者位（选材/批注/写看法），AI 在辅助位（提取/整合/排版/组装），不发问、不编造。

## 提案制（全局护栏）

**为什么**：AI 的任何"加法"（提取角度、决定结构、强化某个点、读者/编辑建议）都只能由用户拍板才能进稿。用户不确认，AI 就只做忠实重组（搬运用户原话 + 原文：调序、归并、顺可读性，不改义、不加料）。

**规则**：所有 AI 加法以**提案**形式呈现，逐条由用户确认；未确认不进稿（AI 仅忠实重组），已确认即"用户授权内容"、下游减法检查不查。本规则全局生效，下文各加法环节（策展标注、D3、提议轮）不再复述。

## 核心架构：采集与生成解耦（content pool）

采集（怎么收想法）与生成（怎么写成文章）只通过一份**内容池**通信。无论 dump、策展、混合还是来回切，都只是往池里填内容的不同手段，不影响最终文章；用户的重点和权重作为字段随内容保存，生成时强制尊重。路线随时可切，已写内容不丢。

**内容池**：`{title}/talk/content-{title}.json`，内容单一真相。

```json
{
  "title": "{title}",
  "config": {
    "form": "free | template",
    "audience": "general | practitioner | self",
    "length_mode": "auto | target",
    "length_target": null
  },
  "items": [
    {
      "id": "i01",
      "source": "mine | original | ref",
      "ref_id": "refs 序号 NN（source=ref 时填，对应 refs/ref-{NN}；三栏'参考[X]'的 X 读此）",
      "text": "verbatim",
      "weight": "boost | keep | dim | drop",
      "key": false,
      "origin_anchor": "原文位置（source=original/ref 时填，可选；faithfulness 回溯用）",
      "annotates": "批注指向的 item_id（策展批注时填，可空）",
      "provenance": "dump | curate-pick | curate-note | d3-adopt"
    }
  ]
}
```

- `source` = 三栏来源（mine 我的话／original 原文／ref 参考）；`weight` = 结构权重；`key` = 重点（生成必读）；`annotates` = 批注挂点。
- **重点优先**：`key=true` 优先于 `weight`——重点项即使被标 drop 也进主轴。

## 目录约定

`{skill-dir}` = 本 SKILL.md 所在目录（仅用于读 `references/`）。`{title}/talk/` 是**工作目录（cwd）**，所有产物写在此处，不写 `{skill-dir}`；会话跨设备流转（见跨设备）。

## Reusable Sub-workflows

### Evaluate Once

单次审查：调 subagent，出报告，通过或不通过（审查 prompt 自定义"通过"条件）。**参数**：`{eval-prompt}`、`{input-files}`、`{output-file}`、`{max-rounds}`。无问题通过；有问题按建议修正复审，最多 `{max-rounds}` 轮；**轮次用尽仍有问题则展示当前版本与剩余问题由用户决定**。返回 PASS/FAIL + 报告路径。

提议轮不复用本流程（理由见提议轮）。

## title 安全化

仅保留字母、数字、CJK、`-`、`_`，其余替换为 `-`，合并连续 `-`，去首尾 `-`；压成短 slug，限 16 字符（CJK 与拉丁各计 1；超出截到最近 `-` 词边界，无则硬截）。路径无效用简短英文替代。

## 断点与恢复

**为什么**：用户介入多、跨天/跨设备；无显式状态指针时恢复只能靠推断文件存在性，易错。

### 两份会话文件（`{title}/talk/`）

**`progress-{title}.json`**——结构化状态，恢复的单一权威来源：

```json
{
  "title": "{安全化 title}",
  "skill": "yiyue31-talk",
  "skill_version": "0.0.7",
  "route": "dump | curate | mixed（可变采集偏好）",
  "current_step": "step0 | collecting | assembling | propose | quality | alt-form | done",
  "primary_done": false,
  "decisions": {
    "config": "问卷：形态/读者/篇幅/参考",
    "accepted_proposals": "提议轮采纳清单",
    "confirmed_structure": "自由结构：用户确认的结构",
    "d3_adopted": "D3 采纳补回的点"
  },
  "next_action": "一句话：接下来做什么",
  "started_at": "ISO",
  "last_updated": "ISO"
}
```

**`journal-{title}.md`**——逐次交互 append-only 日志。每条一行：`## [ISO] {step} · {用户|AI} — 发生了什么；触及文件`。只追加、不改写、不删。

### Checkpoint 协议

每次交互后：① 状态有变 → 更新 progress（至少 `current_step` + `last_updated`；决策时写 `decisions.*`）；② 追加 journal。**写盘顺序：内容文件 → journal → progress.json**（progress 最后写，保证"progress 标完成 ⇒ 产物必在"）。

### current_step 迁移表

| 触发事件 | current_step → | 附带 |
|---|---|---|
| Step 0 落盘 `original` | `step0` | 建会话两件套 |
| 问卷确定 config | `collecting` | 写 `decisions.config`；建空 pool |
| 首次"done"触发 D3，用户补点 | 留 `collecting`（重填 pool） | 采纳点进 pool（provenance=d3-adopt）+ `decisions.d3_adopted` |
| D3 后（或跳过/全否）第二次"done" | `assembling` | D3 最多一轮，不再触发 |
| assembling 落盘 `talk-{title}.md` | `propose` | 自由结构先写 `decisions.confirmed_structure` |
| 提议轮 0 建议 | `quality` | 跳过确认直进质检 |
| 提议轮出报告 + 采纳回流 | `quality` | 写 `decisions.accepted_proposals` |
| quality 四道通过 | `done` | primary 定稿 |
| quality 轮次用尽仍未通过 | 留 `quality` | 展示当前版本 + 剩余问题，用户定（再修/手动改/接受现状） |
| 用户确认 `talk-{title}.md` | `done` | `primary_done=true` |
| 用户要另一形态 | `alt-form` | `primary_done` 已 true |
| 另一形态完成 / 用户放弃 | `done` | `primary_done` 保持 true |

### 恢复入口

激活时或用户说"继续心得/恢复 talk/接着上次/resume talk"：扫 cwd 一层找 `*/talk/progress-*.json`。

- 无 → 全新开始（Step 0）。
- 一份且 `current_step != done` → 出示 title、route、current_step、last_updated、next_action、journal 末 1–2 条；AskUserQuestion：继续/重新开始/跳转步骤。续做前 journal 追加"恢复"记录。
- 一份且 `current_step == done`：`primary_done=false` → 提示"primary 已定稿，待确认"；`primary_done=true` → 提示"任务已完成"，问是否开新会话或回 alt-form。
- 多份 → 每份出示 title + current_step + last_updated，让用户选。
- progress 解析失败/字段缺失 → 备份原文件，退化为靠下表推断，提示"进度文件损坏"。
- **旧会话不兼容**：检测到无 `content-{title}.json` 的旧格式（current_step 为 D1/C2 等旧值）→ 提示"旧会话不兼容本版本，建议重新开始"，不自动迁移。

### 恢复兜底（progress 与产物不一致时）

先读 progress（`current_step` + `decisions` 为权威），再用下表核对产物（表作一致性校验）。两向不一致时以文件实际存在性定位，提示"进度与产物不一致，可能上次未干净落盘"：progress 乐观（标完成却缺产物）→ 回退重做；progress 落后（产物在却标未完成）→ 推进 current_step。

| 已有文件 | 含义 |
|---------|------|
| `original-{title}.md` | Step 0 完成 |
| `content-{title}.json` | 内容池（单一内容真相；采集起创建、append-only） |
| `progress-{title}.json` | 结构化状态 |
| `journal-{title}.md` | 交互日志 |
| `refs/` + `MANIFEST.md` | 参考资料（任意步骤追加；URL 抓取后落盘 + 溯源） |
| `user-input-{title}.md` | 用户原话原始追加日志（审计用，不作生成主输入） |
| `talk-{title}.md` | 生成稿（primary；**不重命名**，下游 yiyue31-merge 依赖） |
| `review-propose-{title}.md` | 提议轮报告（含采纳标记） |
| `review-faith-{title}.md` | faithfulness 检查报告（quality 段） |
| `review-quality-{title}.md` | 三道减法合并报告 |
| `talk-{title}-{form}.md` | 另一形态（可选） |
| `review-diff-{title}-{form}.md` | 另一形态"无新增内容"自查（可选） |

存在未完成工作 → 询问用户：继续/重新开始/跳转步骤。

### 跨设备

`{title}/talk/`（含 progress + journal + content pool + 全部产物）写在工作目录，随项目跨设备流转（git/网盘/拷贝），到目标设备用"继续/恢复"续做。skill 不做云同步。

---

## Workflow

### Step 0: 输入格式化

输入转 Markdown（URL 优先用本地 skill 下载 / 文件路径 Read / 粘贴）。title 安全化后存 `original-{title}.md`。创建会话两件套（progress 填 title + started_at + `current_step: step0`；journal 首条）。

### config 问卷（两段式 AskUserQuestion）

开场一次性问任务参数（**只问参数，不问内容**），默认预填可一键开始。单次上限 4 题，进阶项用 toggle 分两段：

- **Call 1（4 题）**：采集方式（dump 默认／策展／边写边选）· 形态（自由·分享默认／模板·归档）· 目标读者（大众默认／同行／自己存档）· "是否调进阶参数"（用默认直接开始默认／调整篇幅和参考）。
- toggle=用默认 → 进采集；toggle=调整 → **Call 2（2 题）**：篇幅（auto 默认／target＋字数，advisory 不足不注水）· 参考（无默认／有 URL·文件）。

问卷写 `content.config` + `decisions.config`，建空 pool，`current_step` → `collecting`。route 可随时改。

### 参考资料（任意步骤追加）

URL/md/txt 随时补。URL 必须抓取后落盘到 `refs/ref-{NN}-{安全化名}.{ext}`（不只存链接，链接会腐烂、跨设备续做时拿不到）；溯源 `refs/MANIFEST.md`（append-only：序号/类型/来源/抓取时间/文件名/备注）。旁路动作不改 `current_step`，走 Checkpoint 协议。refs 是合法来源之一，成品按三栏标注。

### 采集（collecting）：填 content pool

采集 = 往 pool 填 item，三种填法可混用、可随时切（切换不丢已写内容）：

- **dump**：用户分批写看法（可乱序、口语、多次），AI 把每条解析成 item（source=mine, weight=keep, key 看标记）追加 pool；用户可随时改任意 item 的 weight/key。原话同时追加 `user-input-{title}.md`（审计日志）。
- **策展**：
  - AI 单遍分析 `original`，提"点"（关键论断 + 出彩句 + 争议点，**≤5**，按讨论价值排序）作候选 item（source=original）呈现，未选不进 pool；AI 可标 top 2-3"建议强化"（提案）。
  - 用户多选 + 打权重（强化/保留/弱化/删），可改建议、可补新点（补的 source=mine）。每点一行：`[点] · 建议：强化/保留/弱化/删`；附自由文本框加新点。**一个点都不选 → 询问换 dump 或重提，不默默进空 pool。**
  - 用户对保留点选择性加批注（1-2 句）→ 批注成 item（source=mine, annotates=选点 id），原话追加 `user-input`。
- **混合/来回切**：任意填法都往 pool 追加 item。

**软去重**：写入时语义比对，命中同义 item → 问用户合并/覆盖/保留两条，不静默追加。

**关键门**：用户明确说"done/写完了"才结束采集进生成。每批 AI 只回"已记下，继续或说 done 结束"，不发问、不补写、不自动进生成。

#### D3 缺口提示（克制，可选，最多一轮）

首次"done"后、生成前，AI 扫 pool 对 `original`，指出**原文承重但 pool 没有**的点（**≤3**，只挑承重论点，不罗列原文所有内容），逐条问补不补（提案）。补则原话进 pool（source=mine, provenance=d3-adopt）+ 写 `decisions.d3_adopted`，留 collecting 重填；全否也不影响。D3 后第二次"done"才进 assembling，D3 最多一轮不再触发。提示时明示"这些是原文有你没提的承重点，补不补随你"。**防复述**：提示承重论点，非原文摘要。

### 生成（assembling）：读 content pool

PM 读 pool 直接生成（不调 subagent）。**输出固定中文。** **标点硬约束**：全文禁 em dash（`—`、`——`），用逗号/冒号/拆句代替，ai-tone 检查兜底复核。

**空 pool 护栏**：pool 无可生成 item（空或全部 drop 且无 key）→ 不生成，提示用户补内容。

**按 weight + key 排结构**：主轴（引言钩子 + 正文核心）= `weight=boost` 或 `key=true`；支撑（正文）= `weight=keep`；弱化（批注/收尾）= `weight=dim`；不出现 = `weight=drop` 且 `key=false`。**孤儿批注**：annotates 指向的 item 已 drop 且非 key → 批注一并跳过。

**形态分支**：
- **自由结构**：AI 先提结构（提案）→ 用户确认 → 按确认结构组装；结构未定不进组装。钩子开篇，长短自由。
- **模板**：固定四块——①引言（钩子先行，先抛用户最尖锐的判断或最大反差，来自用户原话，再补半句背景）；②心得正文（围绕用户最主要的单一论点，次要点收入批注或总结，不再分多并列小节；dump 用 pool 整合，策展用重点摘录+批注）；③总结（关键启示）；④推荐语（两版：≤100 汉字社交 + ≤200 汉字博客，标注用途，社交版开头即钩）。

**通则**：全文区分原文/参考[X]/我的话（三栏标注按 item.source，是质检"不改用户原话"边界的可执行前提）；数据/名称保持原值；`config.audience` 调 AI 衔接/术语深度（**不改 mine item 原话**）；`config.length_mode/target` advisory，不足不注水。引言/总结/推荐语/过渡等 AI 成稿文字是"待确认"草稿，加值由提议轮把关。

产物：`{title}/talk/talk-{title}.md`。

### 提议轮（加法门，两个并行 subagent）

组装初稿完成后、质检前，跑一轮提议——两个独立视角审视初稿，提出可增强的建议，用户拍板是否采纳（提案制，规则见全局护栏）。这是**加法层**，与后续减法检查（只润表达、自动修正）性质不同。

**为什么不复用 Evaluate Once**：Evaluate Once 会自动修正；提议轮只出建议、由用户拍板，套用会把"建议"误当"问题"自动改、越过作者位。

**输入**：`talk-{title}.md`（初稿）+ `content-{title}.json`（pool，第一参照）+ `refs/`。

**两个 subagent（并行）**：
1. **读者视角**（appeal）：以"目标读者会不会被勾住"为镜，建议开头更抓人、张力更明显、节奏更带感。prompt：`evaluate-reader-appeal-prompt.md`。
2. **编辑视角**（structure）：以"结构清不清楚、论点站不住站得住、有没有缺口或冗余"为镜，建议重组、补上下文、砍多余。prompt：`evaluate-editor-review-prompt.md`。

两 prompt 共享 5 条约束（不改义/不删用户保留项/只建议不自动改/可回溯强化但不编造/不引入 em dash），单一定义于 `shared-constraints.md`：调用时把该文件拼在视角 prompt 前作强制前提。

**合并报告**：两视角建议合并存 `review-propose-{title}.md`，每条标来源视角、类型、引用位置、可回溯依据、具体改写建议（"建议更自然"不算）。冲突并排列出由用户裁定。**0 条建议 → 跳过确认直进质检。**

**用户确认 + 回流**：展示报告，用户多选采纳（可全不选/改写/补自己的）。**采纳的建议直接改 `talk-{title}.md`，不写回 pool**（pool 只存用户原始内容；提案采纳是生成层授权加法，标"用户授权"，质检不查）。写 `decisions.accepted_proposals`，`current_step` → `quality`。每任务一轮，用户显式要求才跑第二轮。

### 质量审查（quality 段：faithfulness + 三道减法）

对回流后的 `talk-{title}.md` 跑四道检查，任一有问题统一修正后复审，最多 2 轮（复用 Evaluate Once 模式）：

1. **faithfulness（统一门）**：`evaluate-faithfulness-prompt.md`。输入 `talk-{title}.md` + `content-{title}.json` + `review-propose-{title}.md`（区分用户授权采纳的加法）+ 原文/refs。查"生成稿每条'我的话'都能在 pool 找到 source=mine 的 item，且无 pool 外编造"。报告 `review-faith-{title}.md`。
2. **翻译腔**：`evaluate-translationese-prompt.md`。
3. **可读性**：`evaluate-readability-prompt.md`。
4. **AI 味**：`evaluate-ai-tone-prompt.md`。

2–4 以 `talk-{title}.md` 为输入，报告合并 `review-quality-{title}.md`，并行。

**审查范围**：只审 AI 生成的成稿文字（引言/总结/推荐语/衔接/dump 整合正文/策展过渡），**不改 item.text 原文摘录与用户原话批注**（三栏标注是这条边界的可执行前提）。

**轮次用尽仍未通过**（faithfulness 是硬门尤关键）：展示当前版本 + 剩余问题，用户定夺（再修一轮 / 手动改 / 接受现状交付），`current_step` 留 `quality`。

四道通过 → `current_step` → `done`，primary 定稿。

### 按需：另一形态（alt-form）

用户确认 primary 后若要另一形态：从已确认内容做**约束式 re-skin**，不得新增观点/数据/引文。对 `talk-{title}-{form}.md`：

1. 三道减法检查（同 primary；faithfulness 可免，内容已过）。
2. 无新增内容自查（AI 语义层）：逐条核对该形态每个观点/数据/引文都能在 primary 找到同源。结果记 `review-diff-{title}-{form}.md`。发现新增 → 展示用户裁定（保留/删除），不自动改。

不重跑提议轮。`current_step` → `alt-form` → 完成回 `done`。

---

用户确认 `talk-{title}.md` 后：置 `primary_done=true`（`current_step` 已 done），任务完成。
