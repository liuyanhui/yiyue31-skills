# yiyue31-paraphrase 设计记录

## 原始需求

把英文技术文章/新闻**转述、改写**为精简的中文，发表在个人博客/公众号。方法上要求"逐句阅读、逐句改写，把英文表达方式改为中文表达方式；表达方式一致的无需改"。设计初期用户提出两个机制设想：（A）先列出中英文表达差异列表指导模型、防忘；（B）每次先让模型确认预先整理的差异列表、可增规则但不可减规则，防忽略/忘记。

## 定位（与兄弟 skill 的边界）

paraphrase 的区分轴 = **改写（paraphrase）+ 精简（compress）+ 去英文腔（de-anglicize）**，三者都为可读性、不为保真。

- `yiyue31-translator`：忠实全文翻译（准确第一，保全全部信息）。paraphrase 压缩、不保全。
- `yiyue31-summary`：英文结构化摘要。paraphrase 是中文散文重写，非 digest。
- `yiyue31-prune`：精简 prompt/指令/文档。paraphrase 改写文章/新闻，非指令。

description 带 **carve 子句** 把这三处碰撞显式路由出去（load-bearing，不可删）。

## 锁定决策与来由

1. **"逐句"形式化为三态分诊（triage）**：每句 → keep+改写 / merge / drop。"逐句"指**遍历+留痕**（无句漏），不是"一句对一句"。这化解了"逐句"与"精简（需合并）"的冲突——合并/丢弃合法，但仍遍历每一句并记决策。
2. **优先级轴**：核心信息保真 > 地道 > 精简 > 次要细节。**硬护栏**：保留内容不歪曲、不无中生有。允许 drop 次要点，但 keep 的含义不能变样。
3. **表达差异列表（机制 A+B 融合）**：`expression-rules.md` 是**单一源真相**，R0 转述身份 + L1 地道（R1–R8）+ L2 精简（R9–R11），每条带 好/不好 例。同时作改写指导与验收清单（faithfulness 查 R0、translationese 查 L1、conciseness 查 L2）。
4. **"只增不减"防忘规则（机制 B 落地）**：Step 2 预分析的 `rule-confirm` 逐条过 R0–R11，每条标 applies/N-A+理由；每个基础 ID 必须出现，不得删；本篇可补 R-A1…。不单设"确认往返"，而是把它内化进预分析步（仓库成熟的 分析→生成→评审 架构）。
5. **金句 `中文（English）`**：核心/精彩句保留英文原汁原味（verbatim），中文意译 gist（保真线 = 不偏离主要意义，宽松——精度由英文承担）。上限 ≤3–5/篇。复用 translator 金句构造。遴选标准是"这句有没有值得品尝的原文味道"，不是"内容重要"。
6. **两层保真**：金句中文宽松 / 其余严格。衍生自 talk 的 faithfulness prompt。
7. **质检门分类**：单元门（faithfulness/translationese/conciseness/ai-tone，各独立 subagent，**不可合并维度**）+ 全局门（资深编辑 craft 加法提案 + 读者视角 3 画像冷读）。复用 ai-tone（同步组），其余为衍生/新写（不同步）。
8. **编辑门交互模型**：默认端到端——PM 自动套用"安全套用"类 craft 提案，只把"边界 surface"（超出忠实重写的框架性强化）末端上呈用户（唯一 human-in-loop 点）。与 translator/summary 的 model-invoked 端到端一致。

9. **转述身份与精简（dry-run 驱动补强）**：首版 dry run（context-engineering 文）暴露两类问题，补三条规则——R0 **绝对不用"我/我们"**（源文作者的第一人称照搬会读成博客作者冒认，faithfulness 门查）；R8 代词尽量省、需指代原文作者用"他们"（translationese 门查）；R9 删废话判定**借鉴 yiyue31-prune**（"删掉读者不会少知道观点/事实的句"），显式列开场铺垫/过渡辞/元叙述为反例。

## v0.1 限制

- **自包含分块，无脚本**：≤~8000 英文词整篇；否则按 H2 模型驱动分块。不依赖 translator 的 `doc_segmenter`（skill 须自包含）。无可用标题→回退整篇+警告。若实际出现误分块，再考虑引入自包含 node 脚本（类比 `summary/scripts/word-counter.js`）。
- **字数模型估算**（advisory，不卡比例），v0.1 不引入 word-counter。
- 无 `terms.md`（paraphrase 非术语忠实，per-article 术语决策落在 `rule-confirm`）、无 `templates/`（产出是自由中文散文）。

## 可复用教训

- **同一份规则当指导又当验收清单**：避免"指导列表"与"review 清单"两份漂移；ID 化（R0–R11）让"只增不减"可机械校验。
- **leading word 化解机制描述冗余**：分诊（triage）一个词锚定 keep/merge/drop 三态决策，比反复展开省 token 且更稳。
- **授权集与禁令解耦**：金句 `中文（English）` 是"授权的中英并置"，须在 translationese 的"括注打嗝"禁令里显式排除，否则质检会反复打回合法金句（translator 的例外 (b) 已立此范式）。
- **dry-run 暴露的转述身份问题**：源文作者用"我/我们"自述工作时，照搬成中文 = 博客作者冒认。这类"非句式、属身份/归属"的规则要单列（R0）并交 faithfulness 门，不能只靠通用"地道"覆盖。
- **精简要给具体反例，否则等于没说**：泛泛"要精简"是 no-op；借鉴 prune 的"删掉读者不会少知道东西的句"判定 + 显式反例（总的来说/下面是/把这些汇总起来），精简才落到执行。
- **硬禁令要在交付物上机械复核，不能只信中间 draft 的 LLM 门**：dry-run（context-engineering 文）中 R0 在 draft 干净、faithfulness 门放行后，被编辑门的 craft 改写把"这一过程称为"改回"我们称"，回退漏到交付物，PM 还误判 PASS。确定性二元禁令（无"我/我们"）须用脚本（`scripts/verify-no-first-person.js`）在最终稿上 exit-1 校验，且校验须排在编辑门（Step 6）之后；编辑门约束另加"不得改人称"堵源头。
