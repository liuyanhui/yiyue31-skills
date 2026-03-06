---
name: yiyue31-summary-generator
description: Generates structured summaries of technical articles with multiple templates (Standard/Concise/Comprehensive). Use when user asks to "summarize article", "summarize tech post", "summarize research paper", "summarize documentation", "summarize blog", "生成摘要", "总结文章", or provides URLs/files that need summarization. Supports all types of tech content (blog posts, research papers, documentation, tutorials) in Chinese or English. Accepts URLs, text files (.md, .txt), or direct text input.
---

# Tech Article Summarizer

## Summary Templates

This skill supports multiple summary templates for different use cases. **Before generating a summary, you will be asked to select a template.**

### Available Templates

| Template | Description | Best For |
|----------|-------------|----------|
| **Standard** | 平衡型通用技术文章格式（默认中文） | 大多数技术文章、博客文章、公告 |
| **Concise** | 简洁笔记 - 聚焦核心知识（默认中文） | 技术文章学习笔记、工程师快速复习 |
| **Comprehensive** | 全面解析 - 按文章顺序分节整理（默认中文） | 深度学习、技术参考、设计方案参考 |

### Template Management

Templates are stored in `templates/` directory. Each template file is self-contained with its own structure, guidelines, and use cases.

**To add a new template:**
1. Create a new `.md` file in `templates/` (e.g., `my-template.md`)
2. Follow the template structure format used by existing templates
3. Include sections: Description, Structure (markdown example), Guidelines, Best For
4. The template will be automatically available for selection

**To remove templates:** Delete the corresponding `.md` file from `templates/` directory.

## Quick Start

Summarize any technical article with structured output:

**From URL:**
```
Summarize this article: https://example.com/tech-article
```

**From file:**
```
Summarize the article at ./article.md
```

**Direct text:**
```
Summarize this article:
[paste article content]
```

## Template and Language Selection Workflow

When starting a new summary:

1. **Ask language preference**: "摘要语言？ / Summary language?"
   - **中文** (Chinese - default)
   - **English** (English)

2. **Ask template selection**: "你想使用哪个摘要模板？ / Which summary template?"
   - **Standard**: 平衡型技术文章格式 (Overview, Key Points, Technical Details, Takeaways, Conclusion)
   - **Concise**: 简洁笔记 - 聚焦核心知识，快速复习
   - **Comprehensive**: 全面解析 - 按文章顺序分节，突出创新点和实用价值

3. **Use the selected template's structure** for the summary in the chosen language

---

## Main Execution Workflow

The complete step-by-step process from input to final output:

```
┌─────────────────────────────────────────────────────────────┐
│                    1. INPUT STAGE                            │
│  - Receive URL, file path, or direct text                   │
│  - Detect input type                                         │
│  - Fetch/read content                                        │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                    2. SELECTION STAGE                        │
│  - Ask language preference (Chinese/English)                │
│  - Ask template selection (Standard/Concise/Comprehensive)  │
│  - Load selected template metadata                          │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                    3. ANALYSIS STAGE                         │
│  - Detect article type (Blog/Research/Docs/Tutorial)        │
│  - Extract article metadata (title, author, length)         │
│  - Identify main themes and sections                        │
│  - Extract key technical terms                              │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                    4. GENERATION STAGE                      │
│  - Generate each section per template structure             │
│  - Apply language-specific rules                            │
│  - Preserve technical terms appropriately                   │
│  - Handle code blocks and examples                          │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                    5. VALIDATION STAGE                      │
│  - Run quality validation checklist                         │
│  - Verify all sections present                              │
│  - Check length requirements                                │
│  - Validate technical accuracy                              │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                    6. FEEDBACK STAGE                        │
│  - Present summary to user                                  │
│  - Ask for feedback                                         │
│  - Handle refinement requests if any                        │
│  - Finalize or regenerate                                   │
└─────────────────────────────────────────────────────────────┘
```

**Decision Points:**
- At Stage 2: If user doesn't specify language, default to Chinese
- At Stage 2: If user doesn't specify template, recommend based on article type
- At Stage 5: If validation fails, regenerate problematic sections
- At Stage 6: If user requests changes, return to Stage 4 with new constraints

---

## Article Analysis Workflow

Detailed process for analyzing article before summarization:

### Step 1: Initial Scan
```python
# Pseudo-code for article analysis
def analyze_article(article_content, language):
    # Extract metadata
    metadata = {
        "title": extract_title(article_content),
        "author": extract_author(article_content),
        "length": word_count(article_content),
        "structure": identify_sections(article_content)
    }

    # Detect article type
    article_type = detect_article_type(article_content)

    # Extract main themes
    themes = extract_themes(article_content, top_n=5)

    # Extract technical terms
    tech_terms = extract_technical_terms(article_content)

    return {
        "metadata": metadata,
        "type": article_type,
        "themes": themes,
        "tech_terms": tech_terms
    }
```

### Step 2: Article Type Detection

**Indicators for each type:**

| Type | Primary Indicators | Secondary Indicators |
|------|-------------------|---------------------|
| **Blog Post** | Personal tone ("I", "my"), practical examples | How-to focus, implementation tips |
| **Research Paper** | Abstract section, citations, methodology | Results, discussion, conclusion sections |
| **Documentation** | API reference format, code examples, technical specs | Usage patterns, parameter descriptions |
| **Tutorial** | Step-by-step format, numbered lists | Learning outcomes, prerequisites |

### Step 3: Section Identification

**Common section patterns:**
```markdown
# Research Paper Sections:
- Abstract / 摘要
- Introduction / 引言
- Background / 背景
- Methodology / 方法
- Implementation / 实现
- Results / 结果
- Discussion / 讨论
- Conclusion / 结论

# Blog Post Sections:
- Introduction / 开头
- Problem Statement / 问题陈述
- Solution / 解决方案
- Examples / 示例
- Takeaways / 总结

# Tutorial Sections:
- Prerequisites / 前置要求
- Step 1, 2, 3... / 步骤
- Summary / 总结
```

### Step 4: Theme Extraction

**Process:**
1. Identify heading structure (H1, H2, H3)
2. Extract first and last sentences of each paragraph
3. Identify repeated concepts and terminology
4. Note code examples and their purposes
5. Capture author's stated objectives

### Step 5: Technical Term Extraction

**Rules:**
- Preserve: camelCase, PascalCase, snake_case identifiers
- Preserve: Framework names (React, Vue, Django)
- Preserve: Technical concepts (API, REST, GraphQL)
- Translate: General technical terms unless in code context
- Preserve: Command-line syntax and file extensions

**Examples:**
```
✅ Preserve: useState, useEffect, mapStateToProps
✅ Preserve: <Component />, const, function
✅ Preserve: HTTP, API, JSON, SQL
❌ Translate: "component" → "组件" (unless in code)
❌ Translate: "function" → "函数" (unless in code)
```

---

## Summary Generation Workflow

### Step-by-Step Generation Process

#### 1. Overview Section

**Goal:** 2-3 sentence high-level summary

**Process:**
```python
def generate_overview(analysis, language):
    if language == "zh":
        template = "本文主要介绍了{main_topic}，旨在{purpose}。文章通过{approach}，{outcome}。"
    else:
        template = "This article covers {main_topic}, aiming to {purpose}. Through {approach}, it {outcome}."

    # Extract from analysis
    main_topic = analysis["themes"][0]
    purpose = extract_from_intro(analysis["content"])
    approach = analysis["structure"]["main_approach"]
    outcome = analysis["conclusion"]

    return template.format(**locals())
```

**Validation:**
- [ ] Length: 2-3 sentences
- [ ] Covers: What + Why + How (high level)
- [ ] No: Details, examples, specific technical terms
- [ ] Tone: Objective and factual

#### 2. Key Points Section

**Goal:** 3-7 bullet points covering main ideas

**Process:**
```python
def generate_key_points(analysis, language):
    # Extract main points from each section
    sections = analysis["structure"]["sections"]
    key_points = []

    for section in sections:
        # Extract topic sentence
        topic = extract_topic_sentence(section)

        # Add supporting detail
        detail = extract_key_detail(section)

        # Format as bullet point
        point = f"{topic}: {detail}"
        key_points.append(point)

        # Limit to 7 points
        if len(key_points) >= 7:
            break

    return key_points
```

**Validation:**
- [ ] Count: 3-7 bullets
- [ ] Format: Full thoughts, not fragments
- [ ] Order: Most important first
- [ ] Each point: One main idea, specific and concrete

#### 3. Technical Details Section

**Goal:** 1-3 paragraphs with technical depth

**Process:**
```python
def generate_technical_details(analysis, language):
    # Identify technical content
    tech_content = {
        "technologies": analysis["tech_terms"]["frameworks"],
        "concepts": analysis["tech_terms"]["concepts"],
        "methodology": extract_methodology(analysis["content"]),
        "architecture": extract_architecture(analysis["content"])
    }

    # Build paragraphs
    paragraphs = []

    # Paragraph 1: Technologies and tools
    if tech_content["technologies"]:
        para1 = describe_technologies(tech_content["technologies"])
        paragraphs.append(para1)

    # Paragraph 2: Methodology/approach
    if tech_content["methodology"]:
        para2 = describe_methodology(tech_content["methodology"])
        paragraphs.append(para2)

    # Paragraph 3: Architecture/implementation (if needed)
    if tech_content["architecture"] and len(paragraphs) < 3:
        para3 = describe_architecture(tech_content["architecture"])
        paragraphs.append(para3)

    return paragraphs
```

**Validation:**
- [ ] Length: 1-3 paragraphs
- [ ] Depth: Matches article's technical level
- [ ] Content: How it works, specific technologies
- [ ] Audience: Technical readers who need substance

#### 4. Takeaways Section

**Goal:** 2-4 practical insights or action items

**Process:**
```python
def generate_takeaways(analysis, language):
    # Extract practical insights
    takeaways = []

    # From conclusion section
    conclusion_points = extract_conclusion_points(analysis["content"])

    # From practical examples
    example_insights = extract_example_insights(analysis["content"])

    # From recommendations
    recommendations = extract_recommendations(analysis["content"])

    # Combine and prioritize
    takeaways = conclusion_points + example_insights + recommendations
    takeaways = prioritize_practical(takeaways)
    takeaways = takeaways[:4]  # Limit to 4

    return takeaways
```

**Validation:**
- [ ] Count: 2-4 bullets
- [ ] Focus: Actionable or conceptual
- [ ] Format: Practical applications, lessons learned
- [ ] Value: What reader can do with this knowledge

#### 5. Conclusion Section

**Goal:** 1-2 sentences about value and audience

**Process:**
```python
def generate_conclusion(analysis, language):
    if language == "zh":
        template = "适合{audience}阅读，{value_proposition}。"
    else:
        template = "Essential reading for {audience}, {value_proposition}."

    # Determine audience
    audience = determine_audience(analysis["content"], analysis["type"])

    # Extract value proposition
    value = extract_value_proposition(analysis["content"])

    return template.format(audience=audience, value_proposition=value)
```

**Validation:**
- [ ] Length: 1-2 sentences
- [ ] Content: Who should read this, why it matters
- [ ] Tone: Evaluative but objective

---

## Quality Validation Workflow

### Pre-Presentation Validation Checklist

Before presenting summary to user, run these checks:

#### 1. Coverage Validation
```python
def validate_coverage(analysis, summary):
    """Check that all major points are covered."""

    article_sections = set(analysis["structure"]["sections"])
    summary_sections = set(extract_sections_from_summary(summary))

    missing = article_sections - summary_sections

    if missing:
        return {
            "status": "FAIL",
            "missing": list(missing),
            "action": "Add missing sections to summary"
        }

    return {"status": "PASS"}
```

#### 2. Accuracy Validation
```python
def validate_accuracy(article, summary):
    """Check technical terms are used correctly."""

    # Extract technical terms from article
    article_terms = extract_technical_terms(article)

    # Extract technical terms from summary
    summary_terms = extract_technical_terms(summary)

    # Check for misuse
    misused = []
    for term in summary_terms:
        if term in article_terms:
            # Check context is correct
            if not validate_context(term, summary, article):
                misused.append(term)

    if misused:
        return {
            "status": "FAIL",
            "misused_terms": misused,
            "action": "Review context of misused terms"
        }

    return {"status": "PASS"}
```

#### 3. Length Validation
```python
def validate_length(summary, template_metadata):
    """Check summary length matches template guidelines."""

    word_count = count_words(summary)
    target_range = template_metadata["target_length"]

    if target_range[0] <= word_count <= target_range[1]:
        return {"status": "PASS"}

    return {
        "status": "FAIL",
        "actual": word_count,
        "expected": target_range,
        "action": "Adjust length to match template guidelines"
    }
```

#### 4. Structure Validation
```python
def validate_structure(summary, template_metadata):
    """Check all required sections are present."""

    required_sections = set(template_metadata["sections"])
    actual_sections = set(extract_section_headers(summary))

    missing = required_sections - actual_sections

    if missing:
        return {
            "status": "FAIL",
            "missing_sections": list(missing),
            "action": "Add missing sections"
        }

    return {"status": "PASS"}
```

#### 5. Fabrication Validation
```python
def validate_fabrication(article, summary):
    """Ensure no information is fabricated."""

    # Extract key facts from summary
    summary_facts = extract_facts(summary)

    # Check each fact exists in article
    fabricated = []
    for fact in summary_facts:
        if not fact_exists_in_article(fact, article):
            fabricated.append(fact)

    if fabricated:
        return {
            "status": "FAIL",
            "fabricated_facts": fabricated,
            "action": "Remove fabricated information"
        }

    return {"status": "PASS"}
```

### Validation Summary Report

```markdown
## ✅ Quality Validation Report

| Check | Status | Details |
|-------|--------|---------|
| Coverage | ✅ PASS | All major sections covered |
| Accuracy | ✅ PASS | Technical terms used correctly |
| Length | ✅ PASS | 425 words (target: 300-500) |
| Structure | ✅ PASS | All 5 sections present |
| Fabrication | ✅ PASS | No fabricated information |

**Overall Status**: READY TO PRESENT
```

If any check fails:
```markdown
## ⚠️ Quality Validation Report

| Check | Status | Details |
|-------|--------|---------|
| Coverage | ❌ FAIL | Missing: Results section |
| Length | ⚠️ WARN | 250 words (target: 300-500) |

**Action Required**: Add Results section, expand Technical Details
```

---

## User Feedback and Refinement Workflow

### Feedback Collection

After presenting summary, ask for feedback:

```markdown
## 📋 Summary Complete

这份摘要是否符合您的需求？是否需要调整？
Does this summary meet your needs? Any adjustments needed?

**Options / 选项:**
1. **调整长度 / Adjust Length** - Make shorter or longer
2. **重新聚焦 / Refocus** - Emphasize specific topic
3. **改变语言 / Change Language** - Switch to Chinese/English
4. **完美，保存 / Perfect, Save** - Finalize summary
```

### Refinement Handlers

#### Handler 1: Length Adjustment

**Input:** "Make it shorter" / "Make it longer"

**Process:**
```python
def adjust_length(summary, direction, template_metadata):
    current_length = word_count(summary)
    target = template_metadata["target_length"]

    if direction == "shorter":
        # Reduce by ~25%
        new_length = int(current_length * 0.75)
        strategy = "condense"
    else:
        # Increase by ~25%
        new_length = int(current_length * 1.25)
        strategy = "expand"

    # Apply strategy
    if strategy == "condense":
        # Remove less important points
        # Condense verbose sections
        # Combine related points
        new_summary = condense_summary(summary, new_length)
    else:
        # Add more details
        # Expand on key points
        # Add examples from article
        new_summary = expand_summary(summary, new_length, article)

    return new_summary
```

#### Handler 2: Refocus on Topic

**Input:** "Focus more on [topic]"

**Process:**
```python
def refocus_summary(summary, topic, article):
    # Identify sections related to topic
    topic_sections = find_topic_sections(article, topic)

    # Extract additional details on topic
    topic_details = extract_topic_details(article, topic_sections)

    # Enhance relevant sections
    new_summary = enhance_sections(summary, topic, topic_details)

    # Reduce other sections to maintain length
    new_summary = balance_sections(new_summary)

    return new_summary
```

#### Handler 3: Language Change

**Input:** "Can you provide this in English/Chinese?"

**Process:**
```python
def change_language(summary, current_language, target_language, article):
    # Translate summary content
    if current_language == "zh" and target_language == "en":
        new_summary = translate_to_english(summary)
    elif current_language == "en" and target_language == "zh":
        new_summary = translate_to_chinese(summary)

    # Preserve technical terms
    new_summary = preserve_technical_terms(new_summary, article)

    # Adjust template structure for language
    new_summary = apply_language_template(new_summary, target_language)

    return new_summary
```

### Refinement Loop

```
┌─────────────────────────────────────────────────────────────┐
│                    Present Summary                          │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                    Ask for Feedback                         │
└─────────────────────────────────────────────────────────────┘
                              ↓
                    User Response?
                              ↓
            ┌─────────────────┴─────────────────┐
            │                                   │
        [Perfect]                         [Adjustment Needed]
            │                                   │
            ↓                                   ↓
    [Save/Finalize]                    [Apply Refinement]
            │                                   │
            └───────────────────┬───────────────┘
                                ↓
                        [Return to Validation]
```

---

## Error Handling Workflow

### Error Types and Handling

#### Error 1: Invalid URL

**Detection:**
```python
if is_url(input) and not url_accessible(input):
    return {
        "error": "INVALID_URL",
        "message": "无法访问该URL / Cannot access this URL",
        "suggestions": [
            "Check the URL is correct",
            "Try pasting the article content directly",
            "Use a different URL"
        ]
    }
```

**User Message:**
```markdown
## ❌ 无法访问URL / URL Not Accessible

无法访问该链接。请尝试以下方法：
The URL cannot be accessed. Please try:

1. **检查链接 / Check URL** - 确认URL是否正确
2. **直接粘贴 / Paste Content** - 直接粘贴文章内容
3. **更换链接 / Different URL** - 尝试其他链接
```

#### Error 2: File Not Found

**Detection:**
```python
if is_file_path(input) and not file_exists(input):
    return {
        "error": "FILE_NOT_FOUND",
        "message": "文件不存在 / File not found",
        "suggestions": [
            "Check the file path",
            "Ensure file extension is .md or .txt",
            "Paste content directly"
        ]
    }
```

**User Message:**
```markdown
## ❌ 文件不存在 / File Not Found

找不到该文件。请检查：
File not found. Please check:

1. **文件路径 / File Path** - 确认路径正确
2. **文件格式 / File Format** - 支持.md和.txt文件
3. **直接粘贴 / Paste** - 直接粘贴内容
```

#### Error 3: Empty/Insufficient Content

**Detection:**
```python
if word_count(content) < 100:
    return {
        "error": "INSUFFICIENT_CONTENT",
        "message": "内容不足 / Insufficient content",
        "min_required": 100,
        "actual": word_count(content),
        "suggestions": [
            "Provide more content",
            "Ensure full article is pasted",
            "Check if article is truncated"
        ]
    }
```

**User Message:**
```markdown
## ❌ 内容不足 / Insufficient Content

文章内容太少（最少需要100字）。
Content too short (minimum 100 words required).

**当前 / Current:** {actual} 字/words
**需要 / Required:** 100+ 字/words

请提供完整文章内容。
Please provide the complete article.
```

#### Error 4: Article Type Ambiguous

**Detection:**
```python
if confidence(article_type) < 0.6:
    return {
        "error": "AMBIGUOUS_TYPE",
        "message": "文章类型不明确 / Article type unclear",
        "possible_types": [
            {"type": "Blog Post", "confidence": 0.45},
            {"type": "Tutorial", "confidence": 0.40}
        ],
        "action": "Ask user to clarify"
    }
```

**User Message:**
```markdown
## ❓ 文章类型不明确 / Article Type Unclear

无法确定文章类型，请选择：
Cannot determine article type, please select:

1. **博客文章 / Blog Post** - 个人观点、实践经验
2. **教程 / Tutorial** - 分步指导、学习材料
3. **研究论文 / Research Paper** - 学术研究、数据分析
4. **文档 / Documentation** - API参考、技术规范
```

#### Error 5: Template Loading Failed

**Detection:**
```python
if not template_exists(selected_template):
    return {
        "error": "TEMPLATE_NOT_FOUND",
        "message": "模板不存在 / Template not found",
        "requested": selected_template,
        "available": list_available_templates(),
        "action": "Use default template"
    }
```

**User Message:**
```markdown
## ⚠️ 模板未找到 / Template Not Found

请求的模板 "{template}" 不存在。
Requested template "{template}" not found.

**可用模板 / Available Templates:**
- Standard (标准摘要)
- Concise (简洁笔记)
- Comprehensive (全面解析)

使用默认模板：Standard
Using default template: Standard
```

### Error Recovery Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    [Error Detected]                         │
└─────────────────────────────────────────────────────────────┘
                              ↓
                    [Identify Error Type]
                              ↓
            ┌─────────────────┴─────────────────┐
            │                                   │
      [Recoverable]                     [Non-Recoverable]
            │                                   │
            ↓                                   ↓
    [Provide Solution]                [Inform User]
    [Offer Alternative]                [Request New Input]
            │                                   │
            └───────────────────┬───────────────┘
                                ↓
                        [Await User Action]
```

---

## Default Template Structure (Standard)

The standard template follows this format (other templates have different structures):

```markdown
# Article Summary: [Original Title]

**Source**: [URL or file path]
**Author**: [if available]
**Published**: [if available]
**Read Time**: [estimated]
**Template**: Standard（标准摘要）

---

## Overview
[2-3 sentence high-level summary of what the article is about and its main purpose]

## Key Points
- [Main point 1]
- [Main point 2]
- [Main point 3]
- [Additional key points as needed]

## Technical Details
[Technical concepts, technologies, methodologies, or implementation details discussed]

## Takeaways
- [Practical takeaway 1]
- [Practical takeaway 2]
- [Action items or lessons learned]

## Conclusion
[Final thoughts on the article's value, intended audience, and relevance]
```

## Input Handling

### URLs
- Use `mcp__web_reader__webReader` tool to fetch web content
- Handle both direct article URLs and documentation pages
- Extract main content, ignoring navigation and sidebars

### Files
- Read `.md`, `.txt`, `.html`, `.rst` files directly
- For `.pdf` files, use pdf skill to extract text first
- Preserve code blocks and technical formatting

### Direct Text
- Accept pasted article content
- Parse markdown formatting if present
- Handle both plain text and formatted content

## Article Type Detection

Adapt summary emphasis based on content type:

| Type | Indicators | Summary Emphasis |
|------|------------|-----------------|
| **Blog Post** | Personal tone, practical examples, how-to focus | Practical takeaways, implementation tips |
| **Research Paper** | Abstract, citations, methodology sections | Research questions, findings, methodology |
| **Documentation** | API reference, usage examples, technical specs | Technical details, usage patterns |
| **Tutorial** | Step-by-step instructions, code samples | Learning outcomes, key steps covered |

## Content Analysis Guidelines

### Extract Main Points
- Identify the author's central thesis or argument
- Capture supporting arguments or evidence
- Note any counterpoints or alternative views discussed
- Highlight the most important conclusions

### Handle Technical Depth
- Preserve key technical terms and concepts (don't oversimplify)
- Explain unfamiliar concepts briefly in context
- Include relevant technologies, frameworks, or tools mentioned
- Capture code examples or pseudocode if critical to understanding

### Balance Detail and Brevity
- Overview: 2-3 sentences maximum
- Key Points: 3-7 bullet points
- Technical Details: 1-3 paragraphs, depth appropriate to article
- Takeaways: 2-4 practical insights
- Conclusion: 1-2 sentences

## Quality Standards

**Accurate**: Faithfully represent the article's content without misinterpretation

**Complete**: Cover all major points, not just the introduction

**Concise**: Eliminate redundancy while preserving meaning

**Neutral**: Maintain author's voice and intent, don't add opinions

**Readable**: Use clear language and proper formatting for technical content

## Quality Validation Checklist

Before presenting the summary, verify:

- [ ] **Coverage**: All major sections/topics from the article are represented
- [ ] **Accuracy**: Technical terms and concepts are used correctly
- [ ] **Length**: Summary length matches template guidelines (Standard: 300-500 words, Concise: 800-1500字, Comprehensive: as needed)
- [ ] **Structure**: All required sections are present and properly formatted
- [ ] **Language**: Consistent language usage (Chinese or English as selected)
- [ ] **No fabrication**: Only information from the original article is included
- [ ] **Tone**: Maintains appropriate professional/technical tone

## User Feedback

After generating the summary, ask:

"这份摘要是否符合您的需求？是否需要调整？ / Does this summary meet your needs? Any adjustments needed?"

Offer options:
- **调整长度** (Adjust length)
- **重新聚焦某个主题** (Refocus on specific topic)
- **改变语言** (Change language)
- **完美，保存** (Perfect, save)

## Using Different Templates

### Standard Template
Use for: General technical articles, blog posts, announcements
- **Language**: 默认中文，用户可指定英文
- **Sections**: Overview, Key Points, Technical Details, Takeaways, Conclusion
- **Length**: Medium (300-500 words)
- **Depth**: Balanced

### Concise（简洁笔记）
Use for: 技术文章学习笔记、工程师快速复习
- **Language**: Default 中文, user can specify English
- **Sections**: 标题与概述、关键概念与术语、内容大纲、核心洞见、问题与扩展
- **Length**: 800-1500字
- **Features**: 聚焦核心知识，避免冗余，保留英文专有名词

### Comprehensive（全面解析）
Use for: 深度学习、按文章顺序分节整理
- **Language**: Default 中文, user can specify English
- **Sections**: 文章标题与概述、关键概念与术语、主要内容结构（按引言/背景/方法/实现/结果/结论分节）、核心要点与亮点、潜在问题与延伸
- **Features**: 按文章顺序分节、突出创新点和实用价值、层级缩进便于复习

## Template Reference

See `templates/` directory for complete template definitions:
- `templates/standard.md` - 平衡型通用技术文章格式（默认中文）
- `templates/concise.md` - 简洁笔记模板（默认中文）
- `templates/comprehensive.md` - 全面解析模板（默认中文）
