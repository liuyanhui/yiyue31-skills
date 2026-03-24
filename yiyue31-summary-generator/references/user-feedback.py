# User Feedback and Refinement Workflow

## Feedback Collection

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

## Handler 1: Length Adjustment

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

## Handler 2: Refocus on Topic

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

## Handler 3: Language Change

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

## Refinement Loop

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
