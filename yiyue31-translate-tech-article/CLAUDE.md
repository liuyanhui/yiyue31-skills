# yiyue31-translate-tech-article Documentation Rules

## Purpose

This file contains rules for generating and maintaining `SKILL.md`, `README.md`, `TEST_PLAN.md` and other documentation for the `yiyue31-translate-tech-article` skill.

## Documentation Structure

### Core Files

1. **SKILL.md** - Main skill definition and execution workflow
2. **README.md** - User-facing documentation
3. **TEST_PLAN.md** - Testing and verification plan
4. **CLAUDE.md** - This file (documentation generation rules)

### Glossary Files

- **glossary/template.md** - Template for new glossaries
- **glossary/{topic}.md** - Topic-specific technical terms

## SKILL.md Generation Rules

### Required Sections

1. **YAML Frontmatter**
   ```yaml
   ---
   name: {skill-name}
   description: {one-line description}
   ---
   ```

2. **Skill Metadata**
   - Skill ID: `yiyue31-translate-tech-article`
   - Version: `x.y.z`
   - Category: Content Creation
   - Tags: #translation #tech #chinese #terminology

3. **Functionality Description** (功能描述)
   - Clear explanation of what the skill does
   - Step-by-step workflow
   - User input requirements
   - Output specifications

4. **Translation Workflow** (翻译工作流程)
   - Step 1: Topic analysis
   - Step 2: Translation style selection
   - Step 3: Translation execution
   - Step 4: Glossary maintenance

5. **Technical Term Handling** (技术术语处理规则)
   - Term identification standards
   - Glossary file format
   - Term application rules

6. **Quality Checklist** (质量检查清单)
   - Content accuracy
   - Format compliance
   - Glossary handling
   - Readability

7. **Usage Examples** (使用示例)
   - URL input example
   - File input example
   - Pasted content example

8. **Error Handling** (错误处理)
   - File fetch failures
   - Topic identification failures
   - Glossary missing handling

### Language & Tone

- **Primary language**: Chinese (Simplified)
- **Technical terms**: Keep in English with Chinese explanations
- **Tone**: Professional, clear, instructional
- **Format**: Markdown with clear section hierarchy

## README.md Generation Rules

### Required Sections

1. **Project Title & Description**
   - Clear one-line description
   - Feature highlights (5-7 bullet points)

2. **Quick Start** (快速开始)
   - Basic usage examples
   - Common input methods

3. **Workflow Overview** (工作流程)
   - Numbered steps
   - Clear diagram or table

4. **Directory Structure** (目录结构)
   - ASCII tree or table format
   - File purpose descriptions

5. **Glossary System** (术语表系统)
   - File format example
   - How it works explanation

6. **Translation Rules** (翻译规则)
   - What gets preserved
   - Translation styles comparison
   - Term handling examples

7. **Output Format** (输出格式)
   - File location pattern
   - YAML frontmatter template

8. **Supported Topics** (支持的主题)
   - List of available glossaries
   - Instructions for adding new topics

### Style Guidelines

- **Conciseness**: Keep sections brief and scannable
- **Code examples**: Use realistic examples
- **Links**: Cross-reference to other documentation
- **Version info**: Include version and metadata at bottom

## TEST_PLAN.md Generation Rules

### Required Sections

1. **Overview**
   - Purpose of testing
   - Prerequisites

2. **Test Cases** (numbered)
   - Input specification
   - Expected steps (detailed)
   - Verification checklist

3. **Test Categories**
   - Input methods (URL, file, paste)
   - Known topics
   - Unknown topics (new glossary creation)
   - Glossary maintenance
   - Translation styles
   - Code preservation
   - Error handling
   - Git operations
   - Long articles

4. **Manual Testing Checklist**
   - Core functionality
   - Glossary maintenance
   - Quality checks

5. **Sample Test Articles**
   - URLs for testing
   - Expected topics
   - Expected terms

6. **Success Criteria**
   - Clear pass/fail conditions
   - Measurable outcomes

### Test Case Format

Each test case should include:
- **Input**: Exact user input or scenario
- **Expected Steps**: Detailed step-by-step execution
- **Verification**: Checkbox list for validation

## Glossary File Rules

### File Format

```markdown
# Topic: {Topic Name}

| English Term | Chinese Explanation | Notes |
|--------------|-------------------|-------|
| term1 | 中文解释 | Optional note |
| term2 | 中文解释 | Optional note |
```

### Naming Convention

- Use lowercase: `ai.md`, `react.md`, `python.md`
- For subtopics: `react-hooks.md`, `kubernetes-deployment.md`
- Use hyphens for multi-word topics: `machine-learning.md`

### Content Guidelines

- **English Term**: Exact spelling/casing as used in code
- **Chinese Explanation**: Clear, concise translation
- **Notes**: Context, framework, or usage hints
- **Sort order**: Alphabetical by English term
- **Encoding**: UTF-8

## Documentation Maintenance Rules

### When to Update

1. **SKILL.md**: When workflow or behavior changes
2. **README.md**: When features or API changes
3. **TEST_PLAN.md**: When new test cases needed or features added
4. **CLAUDE.md**: When documentation generation rules change

### Version Consistency

- All docs should reference same version number
- Update all files when making major changes
- Document version changes in git commit messages

### Review Checklist

Before committing documentation changes:
- [ ] All sections are complete
- [ ] Code examples are accurate
- [ ] Cross-references work
- [ ] Language is consistent (Chinese primary, English terms)
- [ ] Formatting is correct (markdown, tables, code blocks)
- [ ] No placeholder text remains

## Git Commit Rules for Documentation

### Commit Message Format

```
docs: {brief description}

Detailed explanation if needed.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
```

### Examples

- `docs: add SKILL.md with translation workflow`
- `docs: update README with new glossary format`
- `docs: add test cases for URL input handling`
- `docs: clarify glossary maintenance in TEST_PLAN.md`

## File Encoding & Formatting

- **Encoding**: UTF-8 with BOM not recommended
- **Line endings**: LF (Unix style)
- **Indentation**: 2 spaces for markdown lists
- **Line length**: No hard limit, but prefer ~80-100 chars for prose
- **Trailing whitespace**: Remove

## Quality Standards

### Clarity
- Use simple, direct language
- Avoid jargon unless technical term
- Provide examples for complex concepts

### Completeness
- Cover all user-facing features
- Include edge cases in test plans
- Document error conditions

### Maintainability
- Use consistent structure
- Avoid duplication
- Keep sections focused

---

**Last Updated**: 2025-02-25
**Maintained by**: Yiyue31
