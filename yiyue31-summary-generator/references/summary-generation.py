# Summary Generation Workflow

## Overview Section Generation

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

## Key Points Section Generation

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

## Technical Details Section Generation

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

## Takeaways Section Generation

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

## Conclusion Section Generation

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
