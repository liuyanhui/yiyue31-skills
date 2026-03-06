# Design: Context-Aware Translation Enhancement

**Date:** 2025-03-06
**Skill:** yiyue31-tech-article-translator
**Version:** 2.0.0
**Status:** Design Approved

---

## Overview

Enhance the translator skill with a context-aware two-pass translation approach to improve term detection accuracy, handle context-dependent terms and homonyms, and ensure terminology consistency throughout translations.

---

## Problem Statement

**Current Limitations:**
1. **Single-pass translation** - No pre-analysis of term usage patterns
2. **Ambiguous term handling** - "hook", "state", "component" preserved without context awareness
3. **No consistency validation** - Terms may be translated inconsistently across sections
4. **Limited glossary intelligence** - No context patterns or examples

**Impact:** Mistranslations, inconsistent terminology, missed technical terms

---

## Solution: Context-Aware Two-Pass Translation

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     ORIGINAL WORKFLOW                       │
│  Article → Topic ID → Glossary Load → Translate → Update    │
└─────────────────────────────────────────────────────────────┘

                              ↓

┌─────────────────────────────────────────────────────────────┐
│                    ENHANCED WORKFLOW                        │
│  Article → Topic ID → Glossary Load → CONTEXT SCAN →        │
│  └─> Build Term Context Map → Translate (with awareness) →   │
│      Consistency Check → Update Glossary                     │
└─────────────────────────────────────────────────────────────┘
```

### New Components

1. **Context Scanner** - Pre-pass that identifies terms in context
2. **Term Context Map** - Data structure storing term usage patterns
3. **Consistency Validator** - Post-translation verification

---

## Data Structures

### Enhanced Glossary Format

```markdown
| English Term | Chinese Explanation | Notes | Context Patterns | Examples |
|--------------|-------------------|-------|------------------|----------|
| useState | 状态钩子 | React Hook | `useState(`, "useState hook" | "useState allows you to add state" |
| State | 状态 | General | "component state", "setState(" | "The state holds the data" |
| Hook | 钩子 | General | "use hook", "React hook" | "Hooks let you use state" |
```

**New Columns:**
- **Context Patterns**: Regex-like patterns for term identification
- **Examples**: Real usage examples for disambiguation

### Term Context Map (Runtime)

Generated during context scan pass:

```yaml
article_terms:
  - term: "useState"
    occurrences: 15
    confidence: high
    context_patterns:
      - "useState("
      - "useState hook"
    disambiguated_as: "react_hook"
    translation_decision: preserve

  - term: "state"
    occurrences: 42
    confidence: medium
    context_patterns:
      - "component state"
      - "setState("
    disambiguated_as: "react_state"
    translation_decision: preserve
    ambiguous_matches: ["application state", "server state"]

  - term: "hook"
    occurrences: 8
    confidence: high
    context_patterns:
      - "use hook"
      - "React hook"
    disambiguated_as: "react_hook"
    translation_decision: translate_to_中文术语
```

---

## Implementation: Context Scanner Pass

### Step 1: Token Analysis

**Extract potential technical terms:**
- Capitalized words (React, Component, State)
- camelCase identifiers (useState, useEffect, mapStateToProps)
- Code-like patterns (function_name, CLASS_NAME, variableName)
- Known glossary terms

**For each term, collect context:**
- Surrounding text (±50 characters)
- Sentence context (full sentence containing term)
- Code context (if inside code block)

### Step 2: Context Pattern Matching

```python
# Pseudo-code for context scanning
def scan_article_context(article, glossary):
    potential_terms = extract_potential_terms(article)
    term_map = []

    for term in potential_terms:
        contexts = collect_contexts(article, term, window=50)
        patterns = extract_patterns(contexts)

        if term in glossary:
            glossary_entry = glossary[term]

            # Match against glossary context patterns
            pattern_match_score = match_patterns(
                patterns,
                glossary_entry.context_patterns
            )

            if pattern_match_score > 0.8:
                confidence = HIGH
                decision = PRESERVE
            elif pattern_match_score > 0.5:
                confidence = MEDIUM
                decision = PRESERVE_WITH_REVIEW
            else:
                confidence = LOW
                decision = FLAG_FOR_DISAMBIGUATION

        else:
            confidence = LOW
            decision = SUGGEST_NEW_TERM

        term_map.append({
            "term": term,
            "occurrences": count_occurrences(article, term),
            "confidence": confidence,
            "context_patterns": patterns,
            "decision": decision
        })

    return term_map
```

### Step 3: Disambiguation Rules

**Handle homonyms using context:**

| Term | Context Pattern | Disambiguated As |
|------|----------------|------------------|
| hook | `use`, `React`, `Component` | React Hook (preserve) |
| hook | `fishing`, `catch`, `lure` | fishing hook (translate) |
| state | `component`, `useState`, `setState` | React state (preserve) |
| state | `server`, `application`, `database` | application state (translate) |
| component | `React`, `Props`, `State` | React Component (preserve) |
| component | `system`, `architecture`, `module` | system component (translate) |

**Code pattern preservation:**
- `functionName(` → always preserve (function call)
- `ClassName.` → always preserve (method access)
- `variableName =` → always preserve (assignment)

---

## Implementation: Consistency Validator

### Post-Translation Checks

**1. Term Frequency Check**
```yaml
expected_term_counts:
  useState: 15
  useEffect: 8
  Component: 23

validation: Count actual occurrences in translation
tolerance: ±10% from expected
```

**2. Pattern Validation**
```yaml
code_patterns:
  - "useState("
  - ".useEffect("
  - "<Component"

check: All patterns preserved in output
action: Flag any translated code patterns for review
```

**3. Cross-Reference Consistency**
```yaml
check: Same term translated consistently across sections
example: "Component" should not become "组件" in section 1 and "部件" in section 2
```

### Consistency Report Format

```markdown
## 🔍 Translation Consistency Report

### ✅ Preserved Terms (15)
- useState (15 occurrences) - 100% consistent
- useEffect (8 occurrences) - 100% consistent
- Component (23 occurrences) - 100% consistent

### ⚠️ Needs Review (2)
- **state**: 42 occurrences, 2 different translations detected
  - "状态" (38 times)
  - "国家" (1 time) - FLAG: Possible mistranslation
  - "声明" (3 times) - FLAG: Context confusion

### 🆕 Suggested New Terms (3)
- **useTransition**: 5 occurrences, pattern "useTransition("
- **Server Actions**: 3 occurrences, context "Server Actions allow"
- **useDeferredValue**: 2 occurrences, pattern "useDeferredValue("
```

---

## Error Handling

| Scenario | Detection | Recovery |
|----------|-----------|----------|
| **Ambiguous term detected** | Confidence < 0.5 for known term | Present context to user, ask for clarification |
| **Context mismatch** | Pattern doesn't match glossary entry | Flag for review, preserve original, add note |
| **New term pattern** | Unknown code-like pattern with high frequency | Propose as new glossary term |
| **Inconsistent usage** | Same term translated differently across sections | Highlight inconsistency, suggest fix |
| **Code pattern translated** | Regex detects translated code syntax | Auto-revert, flag for manual review |

---

## Testing Strategy

### New Test Cases

**Test 11: Context Disambiguation**
```markdown
Input: Article with "hook" used in multiple contexts
Expected:
- "React Hook" → preserved as "React Hook"
- "fishing hook" → translated to "鱼钩"
- "hook onto" → translated to "钩住"
Verification: Context-aware disambiguation applied
```

**Test 12: Code Pattern Preservation**
```markdown
Input: Article with complex code examples
Expected:
- All function names preserved: useState, useEffect, useContext
- All method calls preserved: .map(), .filter(), .reduce()
- All JSX syntax preserved: <Component />, {props.children}
Verification: No code syntax translated
```

**Test 13: Multi-Section Consistency**
```markdown
Input: Long article with 5 sections
Expected:
- "Component" consistently translated across all sections
- Term counts match expected frequency
- No drift in translation style
Verification: Consistency validator passes
```

**Test 14: Edge Cases**
```markdown
Input: Mixed content (code + prose + nested blocks)
Expected:
- Code blocks completely preserved
- Inline code in prose preserved
- Nested structures handled correctly
Verification: No content corruption
```

### Quality Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Term Detection Accuracy | >95% | Manual review of 100 sample articles |
| False Positive Rate | <5% | Terms incorrectly marked as technical |
| Translation Consistency | >90% | Terms used consistently across sections |
| Code Preservation | 100% | All code patterns unchanged |
| User Satisfaction | >4.5/5 | Post-translation feedback |

---

## Glossary Migration Plan

### Phase 1: Schema Update (Week 1)

1. **Update template.md**
```markdown
# Before
| English Term | Chinese Explanation | Notes |

# After
| English Term | Chinese Explanation | Notes | Context Patterns | Examples |
```

2. **Add migration script**
```python
# scripts/migrate_glossary.py
def migrate_glossary(input_file, output_file):
    # Add new columns with empty values
    # Backfill common terms with examples
```

### Phase 2: Backfill Popular Terms (Week 2-3)

**Priority:**
1. react.md (~35 terms) - 60% of translations
2. ai.md (~115 terms) - 20% of translations
3. python.md (~40 terms) - 10% of translations
4. kubernetes.md (~80 terms) - 5% of translations

**Backfill Strategy:**
- Use actual translated articles as source
- Extract real usage examples
- Add context patterns from code

### Phase 3: Quality Validation (Week 4)

- Run consistency validator on existing translations
- Identify and fix inconsistencies
- Update glossaries with findings

---

## Implementation Phases

### Phase 1: Core Infrastructure (Week 1-2)
- [ ] Update glossary schema (add Context Patterns, Examples columns)
- [ ] Implement context scanner (token analysis, pattern extraction)
- [ ] Implement term context map generation
- [ ] Update SKILL.md with new workflow

### Phase 2: Translation Enhancement (Week 3-4)
- [ ] Implement context-aware translation logic
- [ ] Implement disambiguation rules
- [ ] Implement consistency validator
- [ ] Add error handling for ambiguous cases

### Phase 3: Testing & Validation (Week 5-6)
- [ ] Add new test cases (11-14)
- [ ] Run quality metrics validation
- [ ] Manual testing with sample articles
- [ ] Performance benchmarking

### Phase 4: Glossary Migration (Week 7-8)
- [ ] Migrate existing glossaries to new format
- [ ] Backfill popular terms with examples
- [ ] Validate migration quality
- [ ] Update TEST_PLAN.md

---

## Success Criteria

**Phase 1-2 Complete When:**
- [ ] Context scanner successfully identifies 95%+ of technical terms
- [ ] Term context map generation works for all test articles
- [ ] New workflow documented in SKILL.md

**Phase 3 Complete When:**
- [ ] All test cases pass (Tests 1-14)
- [ ] Quality metrics meet targets (>95% accuracy, <5% false positives)
- [ ] Performance impact <20% increase in translation time

**Phase 4 Complete When:**
- [ ] All 4 popular glossaries migrated
- [ ] Backfill quality validated
- [ ] Migration script documented and tested

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| **Performance degradation** | Translation takes longer | Implement caching, parallel processing |
| **Glossary migration errors** | Broken glossaries | Test migration script on copies first |
| **False positive increase** | More terms incorrectly preserved | Add confidence threshold tuning |
| **User workflow disruption** | Users confused by new prompts | Clear communication, gradual rollout |

---

## Future Enhancements

**Post v2.0:**
1. Machine learning-based term detection
2. Automatic context pattern learning from translations
3. Collaborative glossary editing
4. Translation quality dashboard
5. Integration with terminology databases (e.g., Microsoft Language Portal)

---

## Appendix: Example Workflow

### Before (Current)

```
User: Translate https://react.dev/hooks
AI: Detected topic: react
AI: Loaded glossary: glossary/react.md (35 terms)
AI: [Translates article - single pass]
AI: Found 3 new terms, add to glossary?
User: Yes
AI: [Saves article, updates glossary]
```

### After (Enhanced)

```
User: Translate https://react.dev/hooks
AI: Detected topic: react
AI: Loaded glossary: glossary/react.md (35 terms with context)

AI: 🔍 Scanning article for term context...
    Found 23 technical terms
    - useState (15 occurrences) ✓ high confidence
    - useEffect (8 occurrences) ✓ high confidence
    - state (42 occurrences) ⚠ medium confidence (2 ambiguous contexts)
    - hook (8 occurrences) ✓ high confidence

AI: 📋 Translation Plan Ready
    Preserving: 18 technical terms
    Flagging for review: 2 ambiguous terms
    Suggesting new: 3 terms (useTransition, Server Actions, useDeferredValue)

AI: Please choose translation style:
    [ ] Literal  [ ] Free

User: Literal

AI: [Translates with context awareness]

AI: 🔍 Consistency Check
    ✅ All terms used consistently
    ✅ All code patterns preserved
    ⚠️ 1 minor inconsistency detected (line 142)

AI: 🆕 New Terms Found
    Add to glossary?
    [✓] useTransition
    [✓] Server Actions
    [ ] useDeferredValue (skip)

User: Confirm selected

AI: [Saves article, updates glossary, commits]
```

---

**Design Document Version:** 1.0
**Author:** Claude Sonnet 4.6
**Status:** Approved for Implementation
**Next Step:** Invoke writing-plans skill to create implementation plan
