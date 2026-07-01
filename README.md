# Yiyue31 Agent Skills

用于 Claude Code 的自定义 Skills 集合。

## 包含的 Skills

### yiyue31-courseware-generator

初中理科（物理、化学、生物）自学课件生成器。支持多教材版本，基于国际教学法设计，输出结构化 Markdown 课件。

**示例：** `生成北师大版八年级物理第7章运动和力的课件`

### yiyue31-tech-article-translator

英文技术文章翻译为高质量中文。智能术语管理，保留代码/URL 格式，输出带 Frontmatter 的 Markdown。

**示例：** `翻译这篇文章：https://example.com/tech-article`

### yiyue31-summary-generator

技术文章智能总结。三种模板（技术文章/论文/简洁笔记），8 维度分析，自动质量检查。

**示例：** `总结这篇文章：https://example.com/tech-post`

### yiyue31-journal-article-formatter

中文学术论文 docx 转换为期刊投稿格式。支持双栏排版、格式模板对齐，输出规范 docx 文档。

**示例：** `格式化这篇论文：paper.docx`

## 设计记录

重要的需求背景、设计决策、踩坑教训应记录到 `docs/` 目录并纳入 git 版本管理，防止后续重复踩同样的坑。

记录内容应包含：原始需求场景、设计决策的来由、演进中暴露的问题、可复用的教训。

**示例：** [planner 设计背景与教训](docs/planner-design-background.md) —— 记录 `yiyue31-planner` 子代理机制的设计来由、暴露的复杂度失控问题，以及"遇到 AI 异常先验证根因归因，再设计机制""复杂度需匹配载体形态""子代理是可靠性负债"等教训。

**示例：** [共享评估 prompt 的版本同步](docs/shared-evaluation-prompt-sync.md) —— translator、hn-digest 等共用的评估 prompt 如何用版本号防止漂移；附 ai-tone v2.x 演进与待办（summary 英文版、sibling prompt 表层化）。

## 安装

将目标 skill 目录整体复制到 `~/.claude/skills/`（全局）或项目下 `.claude/skills/`，然后重启 Claude Code。

## 许可证

MIT License
