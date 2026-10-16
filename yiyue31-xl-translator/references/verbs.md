# 用户动词表（verbs）— 全部挂状态命令（status.mjs --verb）

> SKILL.md 横切机制只留一行引用；逐动词语义与出口在本件（§6.1 #6 迁出）。用户自然语言由主 agent 映射到动词。

| 动词 | 语义与出口 |
|---|---|
| `继续翻译 <title>` | 续跑；封存态下 = 解封续跑 |
| `翻译进度` / `<title> 翻到哪了` | 人话进度（只读渲染） |
| `停止翻译 <title>` | 封存标记 + 一行总结 |
| `重翻 <title> 第 N 章` | 执行前一行披露章↔chunk 映射（如"第 3 章 = chunk 05-06"）；作废范围按 re-keying 冻结语义 |
| `重新翻译 <title>` | 新起全量；与封存后"继续"两出口在 status.md 写明 |
| `先翻 <title> 第 N 章` | 样张（R16：过审后停住等用户确认风格） |
| `双语对照 <title>` | 幂等生成/重生成双语派生视图——存量已交付项目随时可说；status 已交付态三态提示未生成/已生成/已过期。若 <title> 是 translator 布局工程（`{title}/translation/`）则改由 yiyue31-translator 的 derive-bilingual.js 执行 |

（`审计翻译`/`查翻译质量`：以 REPORT.md 使用说明兜底，audit 脚本未实现。）
