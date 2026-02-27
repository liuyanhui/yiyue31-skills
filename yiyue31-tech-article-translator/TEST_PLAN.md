# Test Plan: yiyue31-translate-tech-article Skill

## Overview

This document outlines the verification steps to ensure the `yiyue31-translate-tech-article` skill works correctly.

## Prerequisites

1. Claude Code CLI installed and configured
2. Git repository initialized (optional, for auto-commit feature)
3. Test articles available (URL, file, or pasted content)

## Test Cases

### Test 1: URL Input with React Article

**Input:**
```
Translate this article: https://react.dev/learn/thinking-in-react
```

**Expected Steps:**
1. AI uses `mcp__web_reader__webReader` to fetch article
2. AI analyzes and displays:
   - Original title
   - Identified topic: "react"
   - Main concepts (Components, State, Props, etc.)
   - Loaded glossary: `glossary/react.md`
   - Term count: ~35 terms
3. AI asks translation style (Literal vs Free)
4. User selects "Literal"
5. AI translates article preserving terms: useState, useEffect, Component, Props, etc.
6. AI identifies new terms (if any) and asks for confirmation
7. AI saves to: `articles/2024-02/thinking-in-react.md`
8. AI updates glossary (if new terms confirmed)
9. AI commits to git (if repo exists)

**Verification:**
- [ ] Output file exists
- [ ] YAML frontmatter is complete
- [ ] Technical terms preserved (useState, useEffect, etc.)
- [ ] Code blocks preserved
- [ ] Chinese translation is accurate
- [ ] Glossary updated (if applicable)
- [ ] Git commit created (if applicable)

---

### Test 2: File Input with Python Article

**Input:**
```
Translate ./test-articles/python-decorators.md
```

**Expected Steps:**
1. AI uses `Read` tool to load file
2. AI analyzes and identifies topic: "python"
3. AI loads glossary: `glossary/python.md`
4. AI displays topic info (~40 terms)
5. AI asks translation style
6. User selects "Free"
7. AI translates with reorganized Chinese flow
8. AI identifies new terms
9. AI saves output
10. AI updates glossary and commits

**Verification:**
- [ ] File read successfully
- [ ] Topic identified as "python"
- [ ] Terms preserved: Decorator, Generator, Lambda, etc.
- [ ] Free translation style applied (reorganized flow)
- [ ] Output saved correctly

---

### Test 3: Pasted Content with Kubernetes Article

**Input:**
```
[Paste a Kubernetes-related English article]
```

**Expected Steps:**
1. AI analyzes pasted content
2. AI identifies topic: "kubernetes"
3. AI loads glossary: `glossary/kubernetes.md`
4. AI displays topic info (~80 terms)
5. AI asks translation style
6. User selects "Literal"
7. AI translates preserving Pod, Deployment, Service, etc.
8. AI identifies new terms
9. AI saves output
10. AI updates glossary and commits

**Verification:**
- [ ] Content analyzed correctly
- [ ] Topic identified as "kubernetes"
- [ ] Extensive glossary loaded (80+ terms)
- [ ] Complex terms preserved: ReplicaSet, StatefulSet, DaemonSet, etc.
- [ ] Output saved with correct frontmatter

---

### Test 4: Unknown Topic (New Glossary Creation)

**Input:**
```
Translate an article about Rust programming language
```

**Expected Steps:**
1. AI analyzes content
2. AI identifies topic: "rust" (not in existing glossaries)
3. AI creates new glossary: `glossary/rust.md` using template
4. AI asks user to confirm topic or provide initial terms
5. User confirms "rust"
6. AI proceeds with translation
7. AI identifies many new terms (Ownership, Borrowing, Lifetimes, etc.)
8. AI presents new terms for confirmation
9. User confirms all
10. AI creates comprehensive `glossary/rust.md`
11. AI saves translated article
12. AI commits new glossary to git

**Verification:**
- [ ] New glossary file created
- [ ] Topic creation confirmed by user
- [ ] New terms identified and added
- [ ] Rust-specific terms preserved: Ownership, Borrowing, Trait, etc.
- [ ] Git commit includes new glossary file

---

### Test 5: Glossary Maintenance Workflow

**Input:**
```
Translate an article about a topic with existing glossary
```

**Expected Steps:**
1. Article translated using existing glossary
2. AI scans for new technical terms not in glossary
3. AI presents new terms in table format:

```markdown
## 📝 发现新术语

翻译过程中发现以下新的技术术语，是否添加到术语表？

| 英文术语 | 中文解释 | 上下文 | 备注 |
|---------|---------|--------|------|
| Server Actions | 服务端操作 | "Server Actions allow..." | Next.js feature |
| useTransition | 过渡钩子 | "useTransition hook..." | React 18 feature |
```

4. User selects "全部添加" (Add all)
5. AI appends terms to glossary file
6. AI commits to git with message: `docs: update glossary for react (2024-02-24)`

**Verification:**
- [ ] New terms identified correctly
- [ ] User confirmation requested via AskUserQuestion
- [ ] Terms appended to glossary (not overwriting)
- [ ] Git commit with correct message format
- [ ] Glossary format maintained

---

### Test 6: Translation Style Comparison

**Input:**
```
Translate: [Same short article twice]
First: Literal
Second: Free
```

**Expected Output Comparison:**

**Original:**
> React Hooks allow you to use state and other React features without writing a class.

**Literal (直译):**
> React Hooks 允许你在不编写类的情况下使用 state 和其他 React 特性。

**Free (意译):**
> React Hooks 让函数组件也能拥有状态管理能力，无需再编写类组件。

**Verification:**
- [ ] Literal preserves sentence structure
- [ ] Free reorganizes for better Chinese flow
- [ ] Both preserve technical terms (React Hooks, state)
- [ ] Both are technically accurate

---

### Test 7: Code Block Preservation

**Input:**
```
Translate article with code examples
```

**Expected Behavior:**
- Code blocks completely preserved
- Inline code completely preserved
- Comments in code optionally translated

**Verification:**
- [ ] ```code blocks``` unchanged
- [ ] `inline code` unchanged
- [ ] Only non-code text translated
- [ ] Code syntax highlighted correctly (if present)

---

### Test 8: Error Handling

**Test 8a: Invalid URL**
```
Translate: https://this-url-does-not-exist.example.com
```
Expected: Error message suggesting to paste content directly

**Test 8b: File Not Found**
```
Translate: ./non-existent-file.md
```
Expected: Error message confirming file path

**Test 8c: Unidentified Topic**
```
Translate: [Article about very niche technology]
```
Expected: AI asks user to specify topic

**Verification:**
- [ ] Graceful error messages
- [ ] Helpful suggestions provided
- [ ] No crashes or hangs

---

### Test 9: Git Auto-Commit

**Prerequisites:**
- Git repository initialized
- User has write permissions

**Input:**
```
Translate article that generates new glossary terms
```

**Expected Behavior:**
1. Translation completed
2. Glossary updated
3. Git commands executed:
   ```bash
   git add glossary/
   git commit -m "docs: update glossary for react (2024-02-24)"
   ```

**Verification:**
- [ ] Git add executed
- [ ] Git commit created
- [ ] Commit message format correct
- [ ] Only glossary/ files committed (not articles/)

---

### Test 10: Long Article Handling

**Input:**
```
Translate: [Long article >5000 words]
```

**Expected Behavior:**
- AI processes article in chunks if needed
- No timeout or truncation
- Complete translation delivered
- Single output file with full content

**Verification:**
- [ ] No timeout errors
- [ ] Complete article translated
- [ ] No content truncated
- [ ] Glossary updates from entire article

---

## Manual Testing Checklist

### Core Functionality
- [ ] URL input works with web reader
- [ ] File input works with Read tool
- [ ] Pasted content works directly
- [ ] Topic detection accurate for known topics
- [ ] Unknown topics trigger glossary creation
- [ ] Translation style question appears
- [ ] Both literal and free styles work
- [ ] Technical terms preserved from glossary
- [ ] Code blocks preserved exactly
- [ ] Output file saved to correct location
- [ ] YAML frontmatter complete and accurate

### Glossary Maintenance
- [ ] New terms identified after translation
- [ ] User confirmation requested via AskUserQuestion
- [ ] Terms appended to glossary (not overwritten)
- [ ] Glossary format maintained
- [ ] Git commit executed (if repo exists)
- [ ] Commit message follows format

### Quality Checks
- [ ] Technical accuracy maintained
- [ ] Chinese translation fluent
- [ ] No critical mistranslations
- [ ] Proper handling of ambiguous terms
- [ ] Consistent terminology throughout

---

## Sample Test Articles

### React Sample
Use: https://react.dev/learn/thinking-in-react
Expected topic: react
Expected terms: useState, useEffect, Component, Props, State

### Python Sample
Use: https://docs.python.org/3/tutorial/classes.html
Expected topic: python
Expected terms: Class, Instance, Method, Inheritance

### Kubernetes Sample
Use: https://kubernetes.io/docs/concepts/
Expected topic: kubernetes
Expected terms: Pod, Deployment, Service, Namespace

---

## Success Criteria

All tests pass when:
1. ✅ Core workflow executes without errors
2. ✅ Technical terms preserved correctly
3. ✅ Glossary maintenance works end-to-end
4. ✅ Git auto-commit works (when repo exists)
5. ✅ Translation quality is acceptable
6. ✅ Error handling is graceful
7. ✅ Output format matches specification

---

## Notes

- Test in a clean environment first
- Use git to track changes during testing
- Keep sample articles for regression testing
- Document any issues found during testing
- Update glossaries as needed based on test results

**Test Plan Version:** 1.0.0
**Last Updated:** 2024-02-24
