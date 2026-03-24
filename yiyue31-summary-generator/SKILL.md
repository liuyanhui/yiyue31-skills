---
name: yiyue31-summary-generator
description: Use when user asks to "summarize article", "summarize tech post", "summarize research paper", "summarize documentation", "summarize", "生成摘要", "总结文章", or provides URLs/files that need summarization. 
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

1. **Ask language preference**: "摘要语言？ / Summary language?"
   - **中文** (Chinese - default)
   - **English** (English)

2. **Ask template selection**: "你想使用哪个摘要模板？ / Which summary template?"
   - **Standard**: 平衡型技术文章格式 (Overview, Key Points, Technical Details, Takeaways, Conclusion)
   - **Concise**: 简洁笔记 - 聚焦核心知识，快速复习
   - **Comprehensive**: 全面解析 - 按文章顺序分节，突出创新点和实用价值

3. **Use the selected template's structure** for the summary in the chosen language

---

## Main Workflow

The complete step-by-step process from input to final output:

### step 1. INPUT STAGE                          
- Receive URL, file path, or direct text                  
- Detect input type                                       
- Fetch/read content                                      

### step 2. SELECTION STAGE                      
- Ask language preference (Chinese/English)               
- Ask template selection (Standard/Concise/Comprehensive) 
- Load selected template metadata                         

### step 3. ANALYSIS STAGE                       
- Detect article type (Blog/Research/Docs/Tutorial)       
- Extract article metadata (title, author, length)        
- Identify main themes and sections                       
- Extract key technical terms                           

### step 4. GENERATION STAGE                     
- Generate each section per template structure            
- Apply language-specific rules                           
- Preserve technical terms appropriately                  
- Handle code blocks and examples               

### step 5. VALIDATION STAGE                     
- Run quality validation checklist                        
- Verify all sections present                             
- Check length requirements                               
- Validate technical accuracy                    

### step 6. FEEDBACK STAGE                       
- Present summary to user                                 
- Ask for feedback                                        
- Handle refinement requests if any                       
- Finalize or regenerate  

**Decision Points:**
- At Stage 2: If user doesn't specify language, default to Chinese
- At Stage 2: If user doesn't specify template, recommend based on article type
- At Stage 5: If validation fails, regenerate problematic sections
- At Stage 6: If user requests changes, return to Stage 4 with new constraints

---

## Article Analysis Workflow

Detailed process for analyzing article before summarization. See `references/article-analysis.py` for complete implementation.

### Step 1: Initial Scan
Extract article metadata, detect type, extract themes and technical terms.

### Step 2: Article Type Detection
**Indicators for each type:**
- **Blog Post**: Personal tone ("I", "my"), practical examples
- **Research Paper**: Abstract section, citations, methodology
- **Documentation**: API reference format, code examples, technical specs
- **Tutorial**: Step-by-step format, numbered lists

### Step 3: Section Identification
See `references/section-patterns.md` for common section patterns by article type.

### Step 4: Theme Extraction
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

See `references/technical-term-examples.md` for preservation examples.

---

## Summary Generation Workflow

### Step-by-Step Generation Process

See `references/summary-generation.py` for complete implementation of all generation functions.

#### 1. Overview Section
**Goal:** 2-3 sentence high-level summary
**Validation:**
- [ ] Length: 2-3 sentences
- [ ] Covers: What + Why + How (high level)
- [ ] No: Details, examples, specific technical terms
- [ ] Tone: Objective and factual

#### 2. Key Points Section
**Goal:** 3-7 bullet points covering main ideas
**Validation:**
- [ ] Count: 3-7 bullets
- [ ] Format: Full thoughts, not fragments
- [ ] Order: Most important first
- [ ] Each point: One main idea, specific and concrete

#### 3. Technical Details Section
**Goal:** 1-3 paragraphs with technical depth
**Validation:**
- [ ] Length: 1-3 paragraphs
- [ ] Depth: Matches article's technical level
- [ ] Content: How it works, specific technologies
- [ ] Audience: Technical readers who need substance

#### 4. Takeaways Section
**Goal:** 2-4 practical insights or action items
**Validation:**
- [ ] Count: 2-4 bullets
- [ ] Focus: Actionable or conceptual
- [ ] Format: Practical applications, lessons learned
- [ ] Value: What reader can do with this knowledge

#### 5. Conclusion Section
**Goal:** 1-2 sentences about value and audience
**Validation:**
- [ ] Length: 1-2 sentences
- [ ] Content: Who should read this, why it matters
- [ ] Tone: Evaluative but objective

---

## Quality Validation Workflow

### Pre-Presentation Validation Checklist

Before presenting summary to user, run these checks. See `references/quality-validation.py` for complete implementation.

#### 1. Coverage Validation
Check that all major points are covered.

#### 2. Accuracy Validation
Check technical terms are used correctly.

#### 3. Length Validation
Check summary length matches template guidelines.

#### 4. Structure Validation
Check all required sections are present.

#### 5. Fabrication Validation
Ensure no information is fabricated.

### Validation Summary Report

See `references/validation-report-template.md` for report templates.

---

## User Feedback and Refinement Workflow

### Feedback Collection

After presenting summary, ask for feedback. See `references/user-feedback.py` for complete implementation including feedback prompt template and refinement handlers.

### Refinement Handlers

#### Handler 1: Length Adjustment
**Input:** "Make it shorter" / "Make it longer"
**Process:** Adjust by ~25% using condense or expand strategy

#### Handler 2: Refocus on Topic
**Input:** "Focus more on [topic]"
**Process:** Enhance relevant sections, reduce others to maintain length

#### Handler 3: Language Change
**Input:** "Can you provide this in English/Chinese?"
**Process:** Translate while preserving technical terms and applying language template

---

## Error Handling Workflow

### Error Types and Handling

See `references/error-handling.py` for complete implementation of all error types including detection logic and user-facing messages.

#### Error 1: Invalid URL
Cannot access the provided URL

#### Error 2: File Not Found
Requested file does not exist

#### Error 3: Empty/Insufficient Content
Content too short (minimum 100 words required)

#### Error 4: Article Type Ambiguous
Cannot determine article type (Blog/Tutorial/Research/Documentation)

#### Error 5: Template Loading Failed
Requested template not found, using default

### Error Recovery Flow
```
[Error Detected] → [Identify Type] → [Recoverable/Non-Recoverable]
                                   ↓                    ↓
                           [Provide Solution]    [Inform User]
                           [Offer Alternative]   [Request Input]
```

---

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

### Markdown Format Requirements

After generating the summary, verify the following:

- [ ] **标题层级**：# → ## → ### 顺序，不跳跃
- [ ] **列表缩进**：同层级缩进一致（2空格），分隔符统一
- [ ] **代码块**：``` 后加语言标识，保留原文缩进
- [ ] **数学公式**：行内用 $，独立用 $$
- [ ] **表格格式**：| 对齐正确，表头分隔符 ≥3个-
- [ ] **换行规则**：段落间空一行，列表项间无空行
- [ ] **空行控制**：连续不超过2行
- [ ] **链接格式**：[文本](URL) 格式正确
- [ ] **特殊字符**：| < > 需转义处已处理
- [ ] **行尾空格**：无多余空格
- [ ] **中英文空格**：之间保留一个空格

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
