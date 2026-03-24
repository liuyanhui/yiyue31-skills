"""
Article Analysis Module

This module provides functions for analyzing technical articles before summarization.
It extracts metadata, detects article types, identifies themes, and extracts technical terms.
"""

from typing import Dict, List, Any
import re


def extract_title(content: str) -> str:
    """
    Extract the title from article content.

    Args:
        content: The article content as text

    Returns:
        The extracted title or empty string if not found
    """
    # Look for first heading (markdown format)
    match = re.search(r'^#\s+(.+)$', content, re.MULTILINE)
    return match.group(1) if match else ""


def extract_author(content: str) -> str:
    """
    Extract the author from article content.

    Args:
        content: The article content as text

    Returns:
        The extracted author or empty string if not found
    """
    # Common author patterns
    patterns = [
        r'author[:\s]+([^\n]+)',
        r'by[:\s]+([^\n]+)',
        r'作者[:\s]+([^\n]+)',
    ]
    for pattern in patterns:
        match = re.search(pattern, content, re.IGNORECASE)
        if match:
            return match.group(1).strip()
    return ""


def word_count(content: str) -> int:
    """
    Count the number of words in content.

    Args:
        content: The article content as text

    Returns:
        Number of words
    """
    return len(content.split())


def identify_sections(content: str) -> List[str]:
    """
    Identify main sections in the article.

    Args:
        content: The article content as text

    Returns:
        List of section titles
    """
    # Extract markdown headings (## and ###)
    sections = re.findall(r'^(##+)\s+(.+)$', content, re.MULTILINE)
    return [section[1] for section in sections]


def detect_article_type(content: str) -> str:
    """
    Detect the type of article (Blog/Research/Docs/Tutorial).

    Args:
        content: The article content as text

    Returns:
        Article type as string
    """
    # Indicators for each type
    blog_indicators = ['I', 'my', 'practical', 'how to', 'implementing']
    research_indicators = ['abstract', 'methodology', 'results', 'discussion', 'citations']
    docs_indicators = ['api', 'reference', 'parameters', 'syntax', 'example']
    tutorial_indicators = ['step', 'prerequisites', 'learning', 'follow along']

    content_lower = content.lower()

    # Count matches for each type
    scores = {
        'Blog Post': sum(1 for ind in blog_indicators if ind in content_lower),
        'Research Paper': sum(1 for ind in research_indicators if ind in content_lower),
        'Documentation': sum(1 for ind in docs_indicators if ind in content_lower),
        'Tutorial': sum(1 for ind in tutorial_indicators if ind in content_lower)
    }

    # Return type with highest score
    return max(scores, key=scores.get)


def extract_themes(content: str, top_n: int = 5) -> List[str]:
    """
    Extract main themes from the article.

    Args:
        content: The article content as text
        top_n: Number of top themes to extract

    Returns:
        List of theme strings
    """
    # Simple implementation: extract heading keywords
    headings = re.findall(r'^#+\s+(.+)$', content, re.MULTILINE)

    # Remove common words and return top N
    themes = []
    for heading in headings[:top_n]:
        # Clean up heading
        theme = re.sub(r'[^\w\s]', '', heading).strip()
        if theme:
            themes.append(theme)

    return themes


def extract_technical_terms(content: str) -> Dict[str, List[str]]:
    """
    Extract technical terms from the article.

    Args:
        content: The article content as text

    Returns:
        Dictionary with categories of technical terms
    """
    tech_terms = {
        'frameworks': [],
        'concepts': [],
        'identifiers': []
    }

    # Extract code identifiers (camelCase, PascalCase, snake_case)
    tech_terms['identifiers'] = re.findall(r'\b([A-Z][a-zA-Z0-9]*|[a-z][a-z0-9_]*[a-z0-9])\b', content)

    # Common frameworks
    frameworks = ['React', 'Vue', 'Angular', 'Django', 'Flask', 'Express', 'Spring']
    tech_terms['frameworks'] = [fw for fw in frameworks if fw in content]

    # Technical concepts
    concepts = ['API', 'REST', 'GraphQL', 'HTTP', 'JSON', 'SQL', 'NoSQL', 'OAuth', 'JWT']
    tech_terms['concepts'] = [conc for conc in concepts if conc in content]

    return tech_terms


def analyze_article(article_content: str, language: str = "en") -> Dict[str, Any]:
    """
    Analyze an article and extract metadata, type, themes, and technical terms.

    Args:
        article_content: The article content as text
        language: Content language ('en' or 'zh')

    Returns:
        Dictionary containing analysis results with keys:
        - metadata: Article metadata (title, author, length, structure)
        - type: Detected article type
        - themes: List of main themes
        - tech_terms: Dictionary of technical terms

    Example:
        >>> with open('article.md', 'r') as f:
        ...     content = f.read()
        >>> result = analyze_article(content)
        >>> print(result['type'])
        'Blog Post'
        >>> print(result['metadata']['title'])
        'My Article Title'
    """
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


# Test function
if __name__ == "__main__":
    # Test sample content
    test_content = """
# My Technical Blog Post

By John Doe

In this blog post, I'll share my practical experience implementing React applications.

## Introduction

React is a popular framework for building user interfaces. I've been working with it for years.

## Getting Started

First, let's install React using npm.

## Conclusion

I hope this helps you build better applications.
"""

    result = analyze_article(test_content)

    print("Article Analysis Result:")
    print(f"Title: {result['metadata']['title']}")
    print(f"Author: {result['metadata']['author']}")
    print(f"Type: {result['type']}")
    print(f"Length: {result['metadata']['length']} words")
    print(f"Themes: {result['themes']}")
    print(f"Frameworks: {result['tech_terms']['frameworks']}")
    print(f"Concepts: {result['tech_terms']['concepts']}")

