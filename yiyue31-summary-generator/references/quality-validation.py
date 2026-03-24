"""
Quality Validation Module

This module provides validation functions for ensuring summary quality.
It checks coverage, accuracy, length, structure, and fabrication.
"""

from typing import Dict, List, Any, Tuple


def validate_coverage(analysis: Dict[str, Any], summary: str) -> Dict[str, Any]:
    """
    Check that all major points from the article are covered in the summary.

    Args:
        analysis: Article analysis result from analyze_article()
        summary: Generated summary text

    Returns:
        Dictionary with validation status and details

    Example:
        >>> analysis = {'structure': {'sections': ['Intro', 'Method', 'Results']}}
        >>> summary = "## Overview\\nThis covers..."
        >>> result = validate_coverage(analysis, summary)
        >>> print(result['status'])
        'PASS'
    """
    article_sections = set(analysis.get("structure", {}).get("sections", []))

    # Extract sections from summary (simple implementation)
    summary_sections = set()
    import re
    for match in re.finditer(r'^##\s+(.+)$', summary, re.MULTILINE):
        summary_sections.add(match.group(1))

    missing = article_sections - summary_sections

    if missing:
        return {
            "status": "FAIL",
            "missing": list(missing),
            "action": "Add missing sections to summary"
        }

    return {"status": "PASS"}


def validate_accuracy(article: str, summary: str) -> Dict[str, Any]:
    """
    Check that technical terms are used correctly in the summary.

    Args:
        article: Original article text
        summary: Generated summary text

    Returns:
        Dictionary with validation status and details

    Example:
        >>> article = "React is a framework..."
        >>> summary = "React is used for building UIs..."
        >>> result = validate_accuracy(article, summary)
        >>> print(result['status'])
        'PASS'
    """
    import re

    # Extract technical terms from article (simple implementation)
    article_terms = set(re.findall(r'\b[A-Z]{2,}\b', article))

    # Extract technical terms from summary
    summary_terms = set(re.findall(r'\b[A-Z]{2,}\b', summary))

    # Check for misuse (simplified - in real implementation would check context)
    misused = []
    for term in summary_terms:
        if term not in article_terms and len(term) > 2:
            # Term in summary but not in article - potential misuse
            misused.append(term)

    if misused:
        return {
            "status": "FAIL",
            "misused_terms": misused,
            "action": "Review context of misused terms"
        }

    return {"status": "PASS"}


def validate_length(summary: str, template_metadata: Dict[str, Any]) -> Dict[str, Any]:
    """
    Check that summary length matches template guidelines.

    Args:
        summary: Generated summary text
        template_metadata: Template metadata with target_length range

    Returns:
        Dictionary with validation status and details

    Example:
        >>> summary = "This is a test summary..."
        >>> metadata = {'target_length': (200, 500)}
        >>> result = validate_length(summary, metadata)
        >>> print(result['status'])
        'PASS'
    """
    word_count = len(summary.split())
    target_range = template_metadata.get("target_length", (200, 500))

    if target_range[0] <= word_count <= target_range[1]:
        return {"status": "PASS", "word_count": word_count}

    return {
        "status": "FAIL",
        "actual": word_count,
        "expected": target_range,
        "action": "Adjust length to match template guidelines"
    }


def validate_structure(summary: str, template_metadata: Dict[str, Any]) -> Dict[str, Any]:
    """
    Check that all required sections are present in the summary.

    Args:
        summary: Generated summary text
        template_metadata: Template metadata with required sections list

    Returns:
        Dictionary with validation status and details

    Example:
        >>> summary = "## Overview\\n...\\n## Key Points\\n..."
        >>> metadata = {'sections': ['Overview', 'Key Points', 'Conclusion']}
        >>> result = validate_structure(summary, metadata)
        >>> print(result['status'])
        'PASS'
    """
    import re

    required_sections = set(template_metadata.get("sections", []))

    # Extract section headers from summary
    actual_sections = set()
    for match in re.finditer(r'^##\s+(.+)$', summary, re.MULTILINE):
        actual_sections.add(match.group(1))

    missing = required_sections - actual_sections

    if missing:
        return {
            "status": "FAIL",
            "missing_sections": list(missing),
            "action": "Add missing sections"
        }

    return {"status": "PASS", "sections_found": list(actual_sections)}


def validate_fabrication(article: str, summary: str) -> Dict[str, Any]:
    """
    Ensure no information is fabricated in the summary.

    Args:
        article: Original article text
        summary: Generated summary text

    Returns:
        Dictionary with validation status and details

    Example:
        >>> article = "React has 10 concepts..."
        >>> summary = "React has 10 concepts..."
        >>> result = validate_fabrication(article, summary)
        >>> print(result['status'])
        'PASS'
    """
    # Extract key facts from summary (simplified implementation)
    # In real implementation, would use NLP to extract facts
    import re

    # Extract numbers and claims from summary
    summary_facts = re.findall(r'\d+\.?\d*', summary)

    # Check each fact exists in article
    fabricated = []
    for fact in summary_facts:
        if fact not in article:
            fabricated.append(fact)

    if fabricated:
        return {
            "status": "FAIL",
            "fabricated_facts": fabricated,
            "action": "Remove fabricated information"
        }

    return {"status": "PASS"}


def run_validation_checks(
    article: str,
    analysis: Dict[str, Any],
    summary: str,
    template_metadata: Dict[str, Any]
) -> List[Dict[str, Any]]:
    """
    Run all validation checks and return results.

    Args:
        article: Original article text
        analysis: Article analysis result
        summary: Generated summary text
        template_metadata: Template metadata

    Returns:
        List of validation result dictionaries

    Example:
        >>> results = run_validation_checks(article, analysis, summary, metadata)
        >>> for result in results:
        ...     print(f"{result['check']}: {result['status']}")
        coverage: PASS
        accuracy: PASS
        length: PASS
        structure: PASS
        fabrication: PASS
    """
    checks = [
        ("Coverage", validate_coverage(analysis, summary)),
        ("Accuracy", validate_accuracy(article, summary)),
        ("Length", validate_length(summary, template_metadata)),
        ("Structure", validate_structure(summary, template_metadata)),
        ("Fabrication", validate_fabrication(article, summary))
    ]

    results = []
    for check_name, result in checks:
        result["check"] = check_name
        results.append(result)

    return results


def generate_validation_report(results: List[Dict[str, Any]]) -> str:
    """
    Generate a validation report from validation results.

    Args:
        results: List of validation result dictionaries

    Returns:
        Markdown formatted validation report

    Example:
        >>> results = run_validation_checks(...)
        >>> report = generate_validation_report(results)
        >>> print(report)
        ## ✅ Quality Validation Report
        ...
    """
    lines = ["## Quality Validation Report\n"]
    lines.append("| Check | Status | Details |")
    lines.append("|-------|--------|---------|")

    all_pass = True
    for result in results:
        check = result["check"]
        status = result["status"]

        if status == "PASS":
            status_icon = "✅ PASS"
            details = "Check passed"
        elif status == "FAIL":
            status_icon = "❌ FAIL"
            details = result.get("action", "Check failed")
            all_pass = False
        else:
            status_icon = "⚠️ " + status
            details = result.get("action", "Warning")
            all_pass = False

        lines.append(f"| {check} | {status_icon} | {details} |")

    lines.append(f"\n**Overall Status**: {'READY TO PRESENT' if all_pass else 'NEEDS REVISION'}")

    return "\n".join(lines)


# Test function
if __name__ == "__main__":
    # Test data
    test_article = """
# React Best Practices

React is a popular framework for building user interfaces.

## Overview

This article covers React best practices.

## Key Points

- Use hooks for state management
- Optimize performance with memo
- Write clean components

## Conclusion

Essential reading for React developers.
    """

    test_analysis = {
        "structure": {"sections": ["Overview", "Key Points", "Conclusion"]},
        "type": "Blog Post"
    }

    test_summary = """## Overview

This article covers React best practices, aiming to share practical insights. Through clear examples, it helps developers understand key concepts.

## Key Points

- Point 1: React best practices
- Point 2: Performance optimization
- Point 3: Clean code principles

## Conclusion

Essential reading for developers and engineers, provides practical insights and actionable knowledge.
    """

    test_template_metadata = {
        "target_length": (100, 300),
        "sections": ["Overview", "Key Points", "Conclusion"]
    }

    # Run validation
    print("=" * 60)
    print("Running Validation Checks")
    print("=" * 60)

    results = run_validation_checks(
        test_article,
        test_analysis,
        test_summary,
        test_template_metadata
    )

    # Print individual results
    for result in results:
        print(f"\n{result['check']}: {result['status']}")
        if "details" in result:
            print(f"  Details: {result['details']}")

    # Generate and print report
    print("\n" + "=" * 60)
    print("Validation Report")
    print("=" * 60)
    report = generate_validation_report(results)
    print(report)
