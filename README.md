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

## 安装

将目标 skill 目录整体复制到 `~/.claude/skills/`（全局）或项目下 `.claude/skills/`，然后重启 Claude Code。

## 许可证

MIT License
