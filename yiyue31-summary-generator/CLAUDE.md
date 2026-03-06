# yiyue31-summary-generator Documentation Rules

## Purpose

This file contains rules for generating and maintaining `SKILL.md`, `README.md`, `TEST_PLAN.md` and other documentation for the `yiyue31-summary-generator` skill.

## Documentation Structure

### Core Files

1. **SKILL.md** - Main skill definition and execution workflow
2. **README.md** - User-facing documentation
3. **TEST_PLAN.md** - Testing and verification plan
4. **CHANGELOG.md** - Version history and changes
5. **CLAUDE.md** - This file (documentation generation rules)

### Template Files

- **templates/*.md** - Summary template definitions with metadata

### Reference Files

- **references/best-practices.md** - Summarization guidelines
- **references/examples.md** - Example summaries

## SKILL.md Generation Rules

### Required Sections

1. **YAML Frontmatter**
   ```yaml
   ---
   name: yiyue31-summary-generator
   description: [Clear description with Chinese and English keywords]
   ---
   ```

2. **Template Selection**
   - List all available templates
   - Describe each template's purpose
   - Include template management instructions

3. **Language and Template Selection Workflow**
   - Language preference step
   - Template selection step
   - Clear instructions for each

4. **Input Handling**
   - URLs (with web reader tool)
   - Files (supported formats)
   - Direct text paste

5. **Article Type Detection**
   - Types: Blog Post, Research Paper, Documentation, Tutorial
   - Indicators for each type
   - Summary emphasis per type

6. **Quality Standards**
   - Accuracy, Completeness, Conciseness, Neutrality, Readability
   - Quality validation checklist
   - User feedback mechanism

### Language & Tone

- **Primary language**: Chinese (Simplified) with English support
- **Tone**: Professional, clear, instructional
- **Format**: Markdown with clear section hierarchy

## README.md Generation Rules

### Required Sections

1. **Project Title & Description**
   - Clear one-line description
   - Feature highlights (5-7 bullet points)

2. **Quick Start**
   - Basic usage examples
   - All input methods
   - Chinese and English examples

3. **Templates**
   - Detailed description of each template
   - Best use cases
   - Section breakdown
   - Length guidelines

4. **Workflow**
   - Numbered steps
   - Clear diagram or table

5. **Article Type Detection**
   - Table of types and indicators
   - Summary emphasis per type

6. **Output Format**
   - File location pattern
   - YAML frontmatter template

7. **Custom Templates**
   - Instructions for creating templates
   - Template file format

8. **Quality Standards**
   - Validation checklist
   - Tips for best results

### Style Guidelines

- **Conciseness**: Keep sections brief and scannable
- **Code examples**: Use realistic examples
- **Links**: Cross-reference to other documentation
- **Version info**: Include version at bottom

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
   - All templates (Standard, Concise, Comprehensive)
   - Language support (Chinese, English)
   - Article type detection
   - Quality validation
   - Error handling
   - User feedback loop
   - Long articles

4. **Manual Testing Checklist**
   - Core functionality
   - Template-specific tests
   - Language support
   - Quality checks

5. **Sample Test Articles**
   - URLs for testing
   - Expected types
   - Expected outputs

6. **Success Criteria**
   - Clear pass/fail conditions
   - Measurable outcomes

### Test Case Format

Each test case should include:
- **Input**: Exact user input or scenario
- **Expected Steps**: Detailed step-by-step execution
- **Verification**: Checkbox list for validation

## Template File Rules

### Required Metadata

Each template file MUST include:

```yaml
---
name: [TemplateName]
display_name: [Display Name in Chinese/English]
version: [x.y.z]
default_language: [zh or en]
target_length: [word count range]
target_reading_time: [time estimate]
sections:
  - [section1]
  - [section2]
guidelines_length:
  section_name: [guideline]
features:
  - [feature1]
  - [feature2]
---
```

### Content Sections

1. **Description** - What the template does
2. **Structure** - Markdown template example
3. **Guidelines** - Length and content rules
4. **Best For** - Use cases

## CHANGELOG.md Rules

### Format

Follow [Keep a Changelog](https://keepachangelog.com/) format:

- **Added** - New features
- **Changed** - Changes to existing functionality
- **Deprecated** - Features to be removed
- **Removed** - Features removed
- **Fixed** - Bug fixes
- **Security** - Security improvements

### Version Format

[Major.Minor.Patch]
- **Major**: Breaking changes
- **Minor**: New features, backwards compatible
- **Patch**: Bug fixes, minor improvements

## Documentation Maintenance Rules

### When to Update

1. **SKILL.md**: When workflow or behavior changes
2. **README.md**: When features or templates change
3. **TEST_PLAN.md**: When new test cases needed or features added
4. **CHANGELOG.md**: For every version change
5. **Template files**: When template structure or metadata changes

### Version Consistency

- All docs should reference same version number
- Update all files when making major changes
- Document version changes in CHANGELOG.md

### Review Checklist

Before finalizing documentation changes:
- [ ] All sections are complete
- [ ] Code examples are accurate
- [ ] Cross-references work
- [ ] Language is consistent
- [ ] Formatting is correct (markdown, tables, code blocks)
- [ ] No placeholder text remains
- [ ] Version numbers match across files

## Git Commit Rules for Documentation

### Commit Message Format

```
docs: {brief description}

Detailed explanation if needed.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
```

### Examples

- `docs: add language selection workflow to SKILL.md`
- `docs: create comprehensive README with examples`
- `docs: add 12 test cases to TEST_PLAN.md`
- `docs: update template metadata with validation rules`

## File Encoding & Formatting

- **Encoding**: UTF-8
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

**Last Updated**: 2025-03-06
**Maintained by**: Yiyue31
