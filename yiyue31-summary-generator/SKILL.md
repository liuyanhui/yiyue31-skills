---
name: yiyue31-summary-generator
description: Use when user asks to "summarize article", "summarize tech post", "summarize research paper", "summarize documentation", "summarize", "生成总结", "总结文章", or provides URLs/files that need summarization. 
---

# Tech Article Summarizer

## Summary Templates

This skill supports multiple summary templates for different use cases. **Before generating a summary,  ask user to select a template.**

### Available Templates

| Template | Description | Best For | Template Path |
|----------|-------------|----------|---------------|
| **Standard** | 平衡型通用技术文章格式（默认中文） | 大多数技术文章、博客文章、公告 | `templates/standard.md` |
| **Concise** | 简洁笔记 - 聚焦核心知识（默认中文） | 技术文章学习笔记、工程师快速复习 | `templates/concise.md` |
| **Comprehensive** | 全面解析 - 按文章顺序分节整理（默认中文） | 深度学习、技术参考、设计方案参考 | `templates/comprehensive.md` |

## Template and Language Selection Workflow

When starting a new summary:

1. **Ask language preference**: "总结语言？ / Summary language?"
   - **中文** (Chinese - default)
   - **English** (English)

2. **Ask template selection**: "你想使用哪个总结模板？ / Which summary template?"
   - **Standard**: 平衡型技术文章格式 (Overview, Key Points, Technical Details, Takeaways, Conclusion)
   - **Concise**: 简洁笔记 - 聚焦核心知识，快速复习
   - **Comprehensive**: 全面解析 - 按文章顺序分节，突出创新点和实用价值

3. **Use the selected template's structure** for the summary in the chosen language

---

## Summary Workflow

The complete step-by-step process from input to final output:

### Step 1: 获取文章内容

根据用户输入的类型，使用不同工具获取文章内容：
- **URL输入**：优先使用本地已安装的skills，如：下载文章、转换文章、搜索信息、操作网页、查看网页等skills。其次，使用 `wget` 或 `curl` 或 `agent-browser` 打开网页并下载文章内容。
- **文件路径输入**：使用 `Read` 工具读取文件内容
- **直接粘贴**：直接处理输入内容
- 用户输入的原始文章/文件/粘贴内容，提取title（title提取优先级为：从标题中提取，文件名，第一句话的前10个字），保存到本地，目录为：`{title}/original-{title}.md`。
- **缺少需要翻译的内容**，要求用户提供信息

**文章内容预处理**
1. 文章内容为非markdown格式时，转换并保存为markdown格式。
2. 转换时保留原文结构和格式，尽量保持段落、标题、列表等格式不变；对于无法准确转换的元素，保留原文并添加注释提示用户检查。
3. 检查转换后文件。如果不确定转换结果，要求用户确认。                                 

### Step 2: 分析文章                 
- 语言分析：检测文章语言
- 文章类型分析：技术博客、论文、产品文档、使用教程，视频字幕等。
- 主题分析：提取文章的主题和领域
- 结构分析：识别文章的主要结构和章节
- 主体分析：如果涉及人员、团队或组织等主体，分析其相关背景
- 背景分析：如果涉及事件，分析事件背景，材料来源，发布时间等
- 术语分析：提取关键术语和概念，以便在总结中保留或解释
- 金句提取：筛选出彩表达、亮眼、有记忆点的句子、有感染力、印象深刻的句子，作为总结中的亮点。最终以表格形式输出：" 原文位置 | 原文 | 亮点说明 "
- 分析结果保存到本地，目录为：`{title}/analysis-{title}.md`。

### step 3. 模板选择与总结生成
- 根据分析结果推荐适合的总结模板。总结模板见`templates/`目录下的文件。
- 根据用户选择的模板生成总结
- 金句和重要术语在总结中突出显示，格式为：在单独的一个段落中用 `> 中文翻译文字(英文原文)` 形式展示。
- 总结保存在本地，目录为：`{title}/summary-{title}.md`。
- 运行 `node scripts/word-counter.js {title}/summary-{title}.md` 检查字数是否符合模板要求，并展示结果。

### step 4. 质量检查
- 启用subagent进行质量检查
- 检查总结的覆盖率、准确性、长度、结构、语言和无虚构信息等质量标准
- 检查总结是否符合所选模板的格式要求
- 检查结果保存到本地，目录为：`{title}/validation-{title}.md`。
- 检查不通过时，返回生成阶段重新生成总结
- 检查通过时，告知用户，并要求用户确认：继续下一步或根据用户已经修改总结。

### step 6. 总结润色
- 根据用户选择的语言进行润色，去除AI生成痕迹。如果本地已经安装去除AI生成痕迹的Skills（如：humanizer-zh）；如果没有可以通过`find-skills`搜索和下载相关的去除AI生成痕迹的skills，安装到当前目录后再使用。
- 润色后的总结保存到本地，目录为：`{title}/final-summary-{title}.md`。


**注意**
- 要严格按照step顺序执行，禁止跳过任何步骤
- 每一步的输出都要保存到本地
- 每一步的输出都要符合markdown格式要求，特别是标题层级、列表缩进、代码块格式、表格格式等
---
