---
name: yiyue31-summary
description: Use when user asks to "summarize article", "summarize tech post", "summarize research paper", "summarize documentation", "summarize", "生成总结", "总结文章", or provides URLs/files that need summarization.
---

# Tech Article Summarizer

## Description

文章总结生成器，适用于用户需要总结技术文章、博客、论文、文档等内容的场景。支持多种总结模板，满足不同需求。通过分析文章内容，提取核心要点和亮点，生成结构化、易读的总结。

## 要求
- 除了人类的原话之外，总结时不要过于口语化，保持专业、清晰、简洁的语言风格。
- 从读者的角度总结，而不是作者的角度。
- AI语境下'agent'必须翻译为'智能体'，不能翻译为'代理'。

---
##  Directory

`{skill-dir}` = this SKILL.md's directory path. It means the directory where this SKILL.md is located. 

---

## Summary Workflow

The complete step-by-step process from input to final output:

### Step 1: 获取文章内容

根据用户输入的类型，使用不同工具获取文章内容：
- **URL输入**：优先使用本地已安装的skills，如：下载文章、转换文章、搜索信息、操作网页、查看网页等skills。其次，使用 `wget` 或 `curl` 或 `agent-browser` 打开网页并下载文章内容。
- **文件路径输入**：使用 `Read` 工具读取文件内容
- **直接粘贴**：直接处理输入内容
- 用户输入的原始文章/文件/粘贴内容，提取title（title提取优先级为：从标题中提取，文件名，第一句话的前10个字），保存到本地，目录为：`{title}/summary/original-{title}.md`。
- **缺少需要翻译的内容**，要求用户提供信息

**文章内容预处理**
1. 文章内容为非markdown格式时，转换并保存为markdown格式。
2. 转换时保留原文结构和格式，尽量保持段落、标题、列表等格式不变；对于无法准确转换的元素，保留原文并添加注释提示用户检查。
3. 检查转换后文件。如果不确定转换结果，使用 AskUserQuestion 工具请用户确认：确认无误或需要修正。                                 

### Step 2: 分析文章                 
- 语言分析：检测文章语言
- 文章类型分析：技术博客、论文、产品文档、使用教程，视频字幕、论文、普通文章等。
- 主题分析：提取文章的主题和领域
- 结构分析：识别文章的主要结构和章节
- 段落分析：提取每个段落的核心观点、步骤、优缺点或重要论述等。如果有代码、算法或流程，使用简化描述或伪代码表示。必要时采用bullet points（主点 + 子点）的方式。
- 主体分析：如果涉及人员、团队或组织等主体，分析其相关背景
- 背景分析：如果涉及事件，分析事件背景，材料来源，发布时间等
- 术语分析：提取关键术语和概念，以便在总结中保留或解释。最终以表格形式输出：" 原文位置 | 原文术语 | 中文术语 "
- 金句提取：筛选出彩表达、亮眼、有记忆点的句子、有感染力、印象深刻的句子，作为总结中的亮点。最终以表格形式输出：" 原文位置 | 原文 | 亮点说明 "
- 分析结果保存到本地，目录为：`{title}/summary/analysis-{title}.md`。

### step 3. 分析结果对抗审查
- 启用subagent进行对抗审查(参考生成对抗网络的方式)，检查分析结果是否存在错误、遗漏、不合理的地方。
- 对抗审查结果保存到本地，目录为：`{title}/summary/analysis-gan-{title}.md`。
- 对抗审查不通过时，返回分析阶段重新分析文章

### step 4. 模板选择与总结生成
- 根据分析结果使用 AskUserQuestion 工具推荐适合的总结模板，请用户选择或输入自定义意见。模板见 [Available Templates](#available-templates) 部分。
- 重要内容保持原文翻译，如：流程、概念、技术细节等。
- 金句和重要术语在总结中突出显示，格式为：在单独的一个段落中用 `> 中文翻译(英文原文)` 形式展示。
- 术语采用`中文翻译(英文原文)`的格式在总结中展示。
- 完整长句或者一句话前面出现了逗号，末尾一定要加句号。
- 总结保存在本地，目录为：`{title}/summary/summary-{title}.md`。
- 运行 `node {skill-dir}/scripts/word-counter.js {title}/summary/summary-{title}.md` 检查字数是否符合模板要求，并展示结果。

### step 5. 质量检查
- 启用subagent进行对抗质量检查(参考生成对抗网络的方式)
- 检查总结的覆盖率、准确性、长度、结构、语言和无虚构信息等质量标准
- 检查可读性和逻辑性，确保总结内容清晰、连贯、易于理解
- 检查总结是否符合所选模板的格式要求
- 检查结果保存到本地，目录为：`{title}/summary/validation-{title}.md`。
- 检查不通过时，返回总结生成阶段重新生成总结
- 检查通过时，告知用户，并使用 AskUserQuestion 工具请用户确认：继续下一步或已修改总结。

### step 6. 总结润色
- 根据用户选择的语言进行润色，去除AI生成痕迹。如果本地已经安装去除AI生成痕迹的Skills（如：humanizer-zh）；如果没有可以通过`find-skills`搜索和下载相关的去除AI生成痕迹的skills，安装到当前目录后再使用。
- 润色后的总结保存到本地，目录为：`{title}/summary/final-summary-{title}.md`。

### step 7. 润色结果检查
- 启用subagent进行对抗质量检查(参考生成对抗网络的方式)。
- 检查润色后的可读性，要符合人类阅读习惯。 
- 检查结果保存到本地，目录为：`{title}/summary/refine-gan-{title}.md`。
- 检查不通过时，返回总结润色阶段重新润色总结
- 检查通过时，告知用户最终的总结已经生成，并提供总结文件的路径。

---

## Available Templates

- **Tech Article Template**: 技术文章总结模板 - 适合技术文章、技术博客、技术公告等，提供全面的分析和总结，突出创新点和实用价值。模板内容见 `{skill-dir}/templates/tech-article.md`。
- **Paper Template**: 论文总结模板 - 适合学术论文总结，帮助读者快速学习和理解论文的核心内容和创新点。模板内容见 `{skill-dir}/templates/paper.md`。
- **Concise Template**: 简洁总结模板 - 聚焦核心知识，适合快速学习。模板内容见 `templates/concise.md`。**默认模板*，当其他模板无法匹配时使用。


**注意**
- 要严格按照step顺序执行，禁止跳过任何步骤
- 每一步的输出都要保存到本地
- 每一步的输出都要符合markdown格式要求，特别是标题层级、列表缩进、代码块格式、表格格式等


