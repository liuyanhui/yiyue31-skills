# Test Plan: yiyue31-summary-generator

## Overview

This document outlines the verification steps to ensure the `yiyue31-summary-generator` skill works correctly across all templates and input types.

## Prerequisites

1. Claude Code CLI installed and configured
2. Test articles available (URL, file, or pasted content)
3. Web reader MCP tool available for URL input

## Test Cases

### Test 1: URL Input with Blog Post (Standard Template)

**Input:**
```
Summarize this article: https://react.dev/learn/thinking-in-react
```

**Expected Steps:**
1. AI uses `mcp__web_reader__webReader` to fetch article
2. AI asks language preference (default: Chinese)
3. AI asks template selection
4. User selects "Standard"
5. AI generates summary with all required sections
6. AI validates quality checklist
7. AI asks for feedback

**Expected Output:**
```markdown
# Article Summary: Thinking in React

**Source**: https://react.dev/learn/thinking-in-react
**Template**: Standard（标准摘要）
**Language**: 中文

---

## Overview
[2-3 sentences about React's thinking approach]

## Key Points
- [3-7 key points about the article]
...
```

**Verification:**
- [ ] URL fetched successfully
- [ ] Language selection asked
- [ ] Template selection asked
- [ ] All sections present (Overview, Key Points, Technical Details, Takeaways, Conclusion)
- [ ] Length appropriate (300-500 words / 500-800字)
- [ ] Technical terms preserved
- [ ] Quality validation passed

---

### Test 2: File Input with Research Paper (Comprehensive Template)

**Input:**
```
Summarize ./test-articles/attention-paper.md
```

**Expected Steps:**
1. AI reads file using Read tool
2. AI asks language and template
3. User selects "Comprehensive"
4. AI generates in-depth summary following article structure
5. AI validates against comprehensive template guidelines

**Expected Output:**
- All 5 sections present
- Content organized by article sections (Introduction, Method, Results, Conclusion)
- 8-10 core highlights
- Length: 1500-3000字

**Verification:**
- [ ] File read successfully
- [ ] Comprehensive template applied
- [ ] Article structure preserved
- [ ] Key concepts identified
- [ ] Core highlights comprehensive
- [ ] Length within guidelines

---

### Test 3: Direct Text Paste (Concise Template)

**Input:**
```
Summarize this article:
[Paste a technical blog post about Docker]
```

**Expected Steps:**
1. AI analyzes pasted content
2. AI detects article type (tutorial/blog)
3. AI asks language and template
4. User selects "Concise"
5. AI generates focused learning notes

**Expected Output:**
- Hierarchical outline structure
- Key concepts with English terms preserved
- 5-8 core insights
- Length: 800-1500字

**Verification:**
- [ ] Content analyzed correctly
- [ ] Concise template format applied
- [ ] Technical terms preserved in English
- [ ] Hierarchical structure maintained
- [ ] Focus on core knowledge

---

### Test 4: English Language Output

**Input:**
```
Summarize this article in English: https://example.com/tech-article
```

**Expected Steps:**
1. Language specified as English
2. Template selection
3. Summary generated entirely in English
4. Technical terms preserved as-is

**Verification:**
- [ ] Output entirely in English
- [ ] No Chinese characters (except for author names if applicable)
- [ ] Technical terms correctly preserved
- [ ] Grammar and flow natural

---

### Test 5: Article Type Detection

**Input:**
```
Summarize [Research paper with Abstract, Methodology, Results sections]
```

**Expected Steps:**
1. AI detects as research paper
2. Emphasizes research questions, methodology, findings
3. Suggests Comprehensive template

**Verification:**
- [ ] Research paper correctly identified
- [ ] Methodology section covered
- [ ] Findings highlighted
- [ ] Limitations noted

---

### Test 6: Quality Validation

**Input:**
```
Summarize [Article with 10 major points]
```

**Expected Steps:**
1. AI generates summary
2. AI runs quality validation checklist
3. If missing points, AI should expand summary

**Verification:**
- [ ] All major points covered
- [ ] Technical terms accurate
- [ ] Length matches template guidelines
- [ ] All sections present
- [ ] No fabricated information

---

### Test 7: User Feedback Loop

**Input:**
```
User: "Summarize this article"
[Summary generated]
User: "Make it shorter"
```

**Expected Steps:**
1. AI acknowledges feedback
2. AI generates more concise version
3. AI maintains all key points

**Verification:**
- [ ] Feedback accepted
- [ ] New version shorter
- [ ] Key information retained
- [ ] Quality still maintained

---

### Test 8: Code Block Preservation

**Input:**
```
Summarize [Article with code examples]
```

**Expected Behavior:**
- Code blocks preserved or referenced
- Technical syntax maintained
- Key code concepts explained in text

**Verification:**
- [ ] Code blocks handled appropriately
- [ ] Syntax preserved
- [ ] Code concepts explained

---

### Test 9: Long Article Handling

**Input:**
```
Summarize [Long article >5000 words]
```

**Expected Behavior:**
- AI processes entire article
- Summary captures all major sections
- No timeout or truncation

**Verification:**
- [ ] Complete article processed
- [ ] All major sections covered
- [ ] Summary coherent and complete
- [ ] No content missed

---

### Test 10: Multiple Language Request

**Input:**
```
Summarize this article
[Chinese summary generated]
User: "Can you provide an English version too?"
```

**Expected Behavior:**
- AI regenerates summary in English
- Same template structure
- Same content, different language

**Verification:**
- [ ] English version generated
- [ ] Structure consistent with Chinese version
- [ ] Content equivalent
- [ ] Natural English flow

---

### Test 11: Template Metadata Validation

**Input:**
```
Summarize [Article] with Standard template
```

**Expected Steps:**
1. AI reads template metadata
2. AI validates summary against metadata:
   - Length: 300-500 words
   - Sections: all 5 present
   - Section lengths match guidelines

**Verification:**
- [ ] Template metadata loaded
- [ ] Length validation performed
- [ ] Section validation performed
- [ ] Summary meets all metadata criteria

---

### Test 12: Error Handling

**Test 12a: Invalid URL**
```
Summarize: https://this-url-does-not-exist.example.com
```
Expected: Error message suggesting to paste content directly

**Test 12b: File Not Found**
```
Summarize: ./non-existent-file.md
```
Expected: Error message confirming file path

**Test 12c: Empty Input**
```
Summarize: [Empty or very short text]
```
Expected: Message requesting more content

**Verification:**
- [ ] Graceful error messages
- [ ] Helpful suggestions provided
- [ ] No crashes or hangs

---

## Manual Testing Checklist

### Core Functionality
- [ ] URL input works with web reader
- [ ] File input works with Read tool
- [ ] Pasted content works directly
- [ ] Language selection asked
- [ ] Template selection asked
- [ ] All templates work (Standard, Concise, Comprehensive)
- [ ] Article type detection accurate
- [ ] Code blocks handled appropriately
- [ ] Quality validation performed
- [ ] User feedback requested

### Template-Specific
- [ ] **Standard**: 5 sections, 300-500 words, balanced coverage
- [ ] **Concise**: Hierarchical structure, 800-1500字, focused
- [ ] **Comprehensive**: Article structure preserved, 1500-3000字, in-depth

### Language Support
- [ ] Chinese output natural and fluent
- [ ] English output natural and fluent
- [ ] Technical terms preserved appropriately
- [ ] Language switching works correctly

### Quality Checks
- [ ] All major points covered
- [ ] Technical accuracy maintained
- [ ] No critical information missing
- [ ] No fabricated information
- [ ] Length appropriate for template
- [ ] Structure followed correctly

---

## Sample Test Articles

### Blog Post Sample
Use: https://react.dev/learn/thinking-in-react
Expected type: Blog Post
Expected template: Standard or Concise
Expected sections: Overview, Key Points, Technical Details

### Research Paper Sample
Use: Any technical research paper with Abstract, Method, Results
Expected type: Research Paper
Expected template: Comprehensive
Expected sections: Structure preserved, methodology covered

### Tutorial Sample
Use: Tutorial with step-by-step instructions
Expected type: Tutorial
Expected template: Standard or Concise
Expected emphasis: Learning outcomes, key steps

---

## Success Criteria

All tests pass when:
1. ✅ All input methods work (URL, file, paste)
2. ✅ All templates generate correctly
3. ✅ Both languages (Chinese/English) work
4. ✅ Quality validation catches issues
5. ✅ User feedback loop functional
6. ✅ Article type detection accurate
7. ✅ Error handling is graceful
8. ✅ Output meets template specifications

---

## Notes

- Test in both Chinese and English
- Use real articles from various sources
- Keep sample articles for regression testing
- Document any issues found during testing
- Update templates based on test results

---

**Test Plan Version:** 1.0.0
**Last Updated:** 2025-03-06
