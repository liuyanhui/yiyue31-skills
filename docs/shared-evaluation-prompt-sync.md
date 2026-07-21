# 共享评估 prompt 的版本同步

## 背景

translator、hn-digest 等 skill 都产出中文文本，各自带一份"AI 味检查"评估 prompt（`references/evaluate-ai-tone-prompt.md`）。skill 是自包含的分发单元，prompt 必须随 skill 复制，无法共用同一物理文件，于是同一概念的多份副本各自演化、逐渐漂移，修一处不传导到别处。

## 规则

完整规则见 `CLAUDE.md` 的 "Shared evaluation prompts (cross-skill sync)"。要点：内容一致的副本同版本号、改一处同步全部、靠版本号检测漂移。不同语言（如 summary 的英文）是独立文档，不做内容同步，也不绑版本号。

## ai-tone prompt 的演进

旧版（hn-digest v1.x、summary v0.x）只罗列表层模式、纯禁令。v2.x 升级要点（详见各 prompt 文件）：两副面孔同根、节奏层判定、正向锚点；v2.1 并入 Rule of Three 与 Empty Promises。

## 现状

- **中文版**：hn-digest（v2.2）、talk（v2.2）内容一致、版本同步；translator 仍 v2.1，与 v2.2 漂移（见下方漂移说明），待对齐。
- **英文版（summary）**：独立文档，结构与中文版对齐（三副面孔、节奏层、正向锚点），但例子与词表英文化，不绑版本号、不做内容同步。

## sibling prompt 处理记录

前期判断"translationese / readability / article / reader-audit 都有纯禁令通病"过度概括，实际复核：

- **article / summary 评分量表、reader-audit、translation 多维**：有正向锚点或属不同范式（读者模拟），无需改。
- **readability**：translator 版（中文可懂度）原为纯反模式，已补"正向目标"段；hn-digest 版（英文结构可读性）已补一句正向目标。两者已分化为不同用途，非副本，不做同步。
- **article-eval 的 AI-tell 检查**：通用对仗模式已让位给独立 ai-tone 检查（避免重复扣分），只留 digest 体裁特有的 meta-narration 开场。

## 待办

- **reader-audit（hn-digest ↔ summary）已核查（2026-07-09）**：两者已分化为独立文档，不做同步。详见下方"reader-audit 分化核查（2026-07-09）"。
- **translationese（translator ↔ hn-digest）已核查（2026-07-07）**：两者是**不同语言**的独立文档——translator 版为中文「翻译腔检查」，hn-digest 版为英文「Translationese Evaluation Prompt」，结构与示例均不同。按"不同输出语言是独立文档、不绑版本号"规则，**不做内容同步**。translator 版于 v2.4.0 补了「双语并置 / 括号英文注释堆砌」一项（翻译专属，不传导到 hn-digest 英文版）。

## ai-tone 漂移说明（2026-07-07）

translator（v2.1）与 hn-digest（v2.2）的 ai-tone 已漂移：hn-digest 先行升到 v2.2。translator v2.4.0 **未**改动 ai-tone（评估后决定不把"括号英文堆砌"翻译专属规则塞进共享 prompt，避免破坏同内容不变量；该检测落在 translationese prompt + SKILL.md 注释滥用对抗 pass）。下次任一方改动 ai-tone 时，应先把 v2.1↔v2.2 的既有漂移对齐，再同步。

## reader-audit 分化核查（2026-07-09）

summary 与 hn-digest 各有一份 `evaluate-reader-audit-prompt.md`，原列为"近似副本、待查是否分化"。核查结论：**已分化为独立文档，按"不同输出语言 / 不同范式是独立文档"规则不做同步**。差异：

- 语言与适用对象：summary 版为英文、面向 summary 产物；hn-digest 版中英混合、面向 article/digest 产物。
- reader profile 集合不同：summary 版为 non-expert / skim-reader / non-native；hn-digest 版为 casual-reader / skim-reader / outsider / non-native（且 profile 随文章语言切换）。
- 上下文引用不同：summary 版引用 Step 序号与 original article；hn-digest 版引用 comment thread 与 Step 9。

2026-07-09 summary 版新增 **audience** 输入（general/technical/mixed，blocking vs look-up-able 阈值随受众移动），属 summary 专属逻辑，不传导到 hn-digest 版。

## talk 加入记录（2026-07-21）

- talk（yiyue31-talk）新增中文心得稿输出，复用 ai-tone：co-locate hn-digest v2.2 原文，talk 版本 v2.2，与 hn-digest 同步。
- translator 仍 v2.1，与 v2.2 的既有漂移本轮未处理（超出 talk 改动范围），保留待办：下次改 ai-tone 时先对齐 translator ↔ hn-digest/talk。
- talk 另建三份独立审查 prompt，**不参与同步**（体裁不同，类比 summary 英文版独立）：
  - `evaluate-translationese-prompt.md` v1.0：脱胎自 translator 中文翻译腔检查，改为面向"中文原创心得稿"（无译文/原文配对、去翻译专属括注规则）。
  - `evaluate-readability-prompt.md` v1.0：脱胎自 translator 中文可读性检查，改为通用中文文本。
  - `evaluate-faithfulness-prompt.md` v1.0：talk 专属（dump 模式 D4 忠实度检查），无对应兄弟。
