# Quality Validation Workflow

## Pre-Presentation Validation Checklist

Before presenting summary to user, run these checks:

## Coverage Validation

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

## Accuracy Validation

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

## Length Validation

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

## Structure Validation

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

## Fabrication Validation

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
