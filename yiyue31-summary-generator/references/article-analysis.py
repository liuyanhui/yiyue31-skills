# Article Analysis Workflow

## Step 1: Initial Scan

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

## Article Type Detection Indicators

| Type | Primary Indicators | Secondary Indicators |
|------|-------------------|---------------------|
| **Blog Post** | Personal tone ("I", "my"), practical examples | How-to focus, implementation tips |
| **Research Paper** | Abstract section, citations, methodology | Results, discussion, conclusion sections |
| **Documentation** | API reference format, code examples, technical specs | Usage patterns, parameter descriptions |
| **Tutorial** | Step-by-step format, numbered lists | Learning outcomes, prerequisites |

## Section Identification Process

1. Identify heading structure (H1, H2, H3)
2. Extract first and last sentences of each paragraph
3. Identify repeated concepts and terminology
4. Note code examples and their purposes
5. Capture author's stated objectives

## Technical Term Extraction Rules

- Preserve: camelCase, PascalCase, snake_case identifiers
- Preserve: Framework names (React, Vue, Django)
- Preserve: Technical concepts (API, REST, GraphQL)
- Translate: General technical terms unless in code context
- Preserve: Command-line syntax and file extensions
