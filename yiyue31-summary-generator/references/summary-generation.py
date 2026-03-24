"""
Summary Generation Module

This module provides functions for generating different sections of a technical article summary.
It includes overview, key points, technical details, takeaways, and conclusion generators.
"""

from typing import Dict, List, Any


def generate_overview(analysis: Dict[str, Any], language: str = "en") -> str:
    """
    Generate the overview section of a summary.

    Goal: 2-3 sentence high-level summary covering What + Why + How

    Args:
        analysis: Article analysis result from analyze_article()
        language: Target language ('zh' for Chinese, 'en' for English)

    Returns:
        Overview text as string

    Example:
        >>> analysis = {'themes': ['React patterns'], 'type': 'Blog Post'}
        >>> overview = generate_overview(analysis, 'en')
        >>> print(overview)
        'This article covers React patterns...'
    """
    if language == "zh":
        template = "本文主要介绍了{main_topic}，旨在{purpose}。文章通过{approach}，{outcome}。"
    else:
        template = "This article covers {main_topic}, aiming to {purpose}. Through {approach}, it {outcome}."

    # Extract from analysis
    main_topic = analysis["themes"][0] if analysis["themes"] else "the topic"
    purpose = "share practical insights"  # Would be extracted from intro
    approach = "practical examples and explanations"
    outcome = "helps developers understand key concepts"

    return template.format(
        main_topic=main_topic,
        purpose=purpose,
        approach=approach,
        outcome=outcome
    )


def generate_key_points(analysis: Dict[str, Any], language: str = "en") -> List[str]:
    """
    Generate the key points section of a summary.

    Goal: 3-7 bullet points covering main ideas

    Args:
        analysis: Article analysis result from analyze_article()
        language: Target language ('zh' for Chinese, 'en' for English)

    Returns:
        List of key point strings

    Example:
        >>> analysis = {'structure': {'sections': ['Intro', 'Method', 'Results']}}
        >>> points = generate_key_points(analysis)
        >>> print(len(points))
        3
    """
    key_points = []

    # Extract main points from themes
    for i, theme in enumerate(analysis.get("themes", [])[:7]):
        if language == "zh":
            point = f"第{i+1}个要点：{theme}"
        else:
            point = f"Point {i+1}: {theme}"
        key_points.append(point)

    # Limit to 7 points
    return key_points[:7]


def generate_technical_details(analysis: Dict[str, Any], language: str = "en") -> List[str]:
    """
    Generate the technical details section of a summary.

    Goal: 1-3 paragraphs with technical depth

    Args:
        analysis: Article analysis result from analyze_article()
        language: Target language ('zh' for Chinese, 'en' for English)

    Returns:
        List of paragraph strings

    Example:
        >>> analysis = {'tech_terms': {'frameworks': ['React', 'Vue']}}
        >>> details = generate_technical_details(analysis)
        >>> print(len(details))
        1
    """
    paragraphs = []

    # Identify technical content
    tech_content = {
        "technologies": analysis.get("tech_terms", {}).get("frameworks", []),
        "concepts": analysis.get("tech_terms", {}).get("concepts", []),
    }

    # Paragraph 1: Technologies and tools
    if tech_content["technologies"]:
        if language == "zh":
            para1 = f"文章涉及的技术栈包括：{', '.join(tech_content['technologies'])}。"
        else:
            para1 = f"The article covers the following technologies: {', '.join(tech_content['technologies'])}."
        paragraphs.append(para1)

    # Paragraph 2: Technical concepts
    if tech_content["concepts"]:
        if language == "zh":
            para2 = f"主要技术概念包括：{', '.join(tech_content['concepts'])}。"
        else:
            para2 = f"Key technical concepts include: {', '.join(tech_content['concepts'])}."
        paragraphs.append(para2)

    # Limit to 3 paragraphs
    return paragraphs[:3]


def generate_takeaways(analysis: Dict[str, Any], language: str = "en") -> List[str]:
    """
    Generate the takeaways section of a summary.

    Goal: 2-4 practical insights or action items

    Args:
        analysis: Article analysis result from analyze_article()
        language: Target language ('zh' for Chinese, 'en' for English)

    Returns:
        List of takeaway strings

    Example:
        >>> analysis = {'themes': ['Best practices', 'Performance']}
        >>> takeaways = generate_takeaways(analysis)
        >>> print(len(takeaways))
        2
    """
    takeaways = []

    # Generate takeaways from themes
    for i, theme in enumerate(analysis.get("themes", [])[:4]):
        if language == "zh":
            takeaway = f"关键收获{i+1}：理解{theme}的重要性"
        else:
            takeaway = f"Key takeaway {i+1}: Understand the importance of {theme}"
        takeaways.append(takeaway)

    # Limit to 4 takeaways
    return takeaways[:4]


def generate_conclusion(analysis: Dict[str, Any], language: str = "en") -> str:
    """
    Generate the conclusion section of a summary.

    Goal: 1-2 sentences about value and audience

    Args:
        analysis: Article analysis result from analyze_article()
        language: Target language ('zh' for Chinese, 'en' for English)

    Returns:
        Conclusion text as string

    Example:
        >>> analysis = {'type': 'Blog Post', 'themes': ['React']}
        >>> conclusion = generate_conclusion(analysis)
        >>> print(conclusion)
        'Essential reading for developers...'
    """
    if language == "zh":
        template = "适合{audience}阅读，{value_proposition}。"
    else:
        template = "Essential reading for {audience}, {value_proposition}."

    # Determine audience based on article type
    article_type = analysis.get("type", "Blog Post")
    audience_map = {
        "Blog Post": "developers and engineers",
        "Research Paper": "researchers and academics",
        "Documentation": "developers and technical users",
        "Tutorial": "beginners and learners"
    }
    audience = audience_map.get(article_type, "technical readers")

    # Extract value proposition
    value = "provides practical insights and actionable knowledge"

    return template.format(
        audience=audience,
        value_proposition=value
    )


def generate_summary(analysis: Dict[str, Any], language: str = "en") -> str:
    """
    Generate a complete summary with all sections.

    Args:
        analysis: Article analysis result from analyze_article()
        language: Target language ('zh' for Chinese, 'en' for English)

    Returns:
        Complete summary as markdown formatted string

    Example:
        >>> from article_analysis import analyze_article
        >>> content = "# My Article\\n\\nContent here..."
        >>> analysis = analyze_article(content)
        >>> summary = generate_summary(analysis, 'en')
        >>> print(summary)
        # Overview
        ...
    """
    sections = []

    # Overview
    overview = generate_overview(analysis, language)
    if language == "zh":
        sections.append("## 概述\n" + overview)
    else:
        sections.append("## Overview\n" + overview)

    # Key Points
    key_points = generate_key_points(analysis, language)
    if language == "zh":
        sections.append("\n## 要点\n" + "\n".join(f"- {point}" for point in key_points))
    else:
        sections.append("\n## Key Points\n" + "\n".join(f"- {point}" for point in key_points))

    # Technical Details
    tech_details = generate_technical_details(analysis, language)
    if tech_details:
        if language == "zh":
            sections.append("\n## 技术细节\n" + "\n".join(tech_details))
        else:
            sections.append("\n## Technical Details\n" + "\n".join(tech_details))

    # Takeaways
    takeaways = generate_takeaways(analysis, language)
    if language == "zh":
        sections.append("\n## 关键收获\n" + "\n".join(f"- {takeaway}" for takeaway in takeaways))
    else:
        sections.append("\n## Takeaways\n" + "\n".join(f"- {takeaway}" for takeaway in takeaways))

    # Conclusion
    conclusion = generate_conclusion(analysis, language)
    if language == "zh":
        sections.append("\n## 结论\n" + conclusion)
    else:
        sections.append("\n## Conclusion\n" + conclusion)

    return "\n".join(sections)


# Test function
if __name__ == "__main__":
    # Test with sample analysis
    test_analysis = {
        "metadata": {
            "title": "React Best Practices",
            "author": "John Doe",
            "length": 1500,
            "structure": ["Introduction", "Best Practices", "Examples", "Conclusion"]
        },
        "type": "Blog Post",
        "themes": ["Component Design", "State Management", "Performance Optimization", "Testing"],
        "tech_terms": {
            "frameworks": ["React", "Redux"],
            "concepts": ["Hooks", "Context API", "Virtual DOM"],
            "identifiers": []
        }
    }

    # Generate summary in English
    print("=" * 60)
    print("English Summary:")
    print("=" * 60)
    summary_en = generate_summary(test_analysis, "en")
    print(summary_en)

    print("\n" + "=" * 60)
    print("Chinese Summary:")
    print("=" * 60)
    summary_zh = generate_summary(test_analysis, "zh")
    print(summary_zh)

