"""
User Feedback and Refinement Module

This module handles user feedback collection and summary refinement operations.
It supports length adjustment, topic refocusing, and language changes.
"""

from typing import Dict, List, Any, Optional
import re


def generate_feedback_prompt() -> str:
    """
    Generate the feedback collection prompt to show after presenting a summary.

    Returns:
        Markdown formatted feedback prompt

    Example:
        >>> prompt = generate_feedback_prompt()
        >>> 'Summary Complete' in prompt
        True
        >>> 'Adjust Length' in prompt
        True
    """
    return """## 📋 Summary Complete

这份摘要是否符合您的需求？是否需要调整？
Does this summary meet your needs? Any adjustments needed?

**Options / 选项:**
1. **调整长度 / Adjust Length** - Make shorter or longer
2. **重新聚焦 / Refocus** - Emphasize specific topic
3. **改变语言 / Change Language** - Switch to Chinese/English
4. **完美，保存 / Perfect, Save** - Finalize summary"""


def count_words(text: str) -> int:
    """
    Count the number of words in text.

    Args:
        text: Input text

    Returns:
        Number of words

    Example:
        >>> count_words("Hello world")
        2
    """
    return len(text.split())


def condense_summary(summary: str, target_length: int) -> str:
    """
    Condense a summary to reduce its length.

    Args:
        summary: Original summary text
        target_length: Target word count

    Returns:
        Condensed summary

    Example:
        >>> original = "This is a long summary that needs to be shortened."
        >>> condensed = condense_summary(original, 6)
        >>> len(condensed.split())
        6
    """
    # Simple implementation: take first N words
    # Real implementation would be more sophisticated
    words = summary.split()
    if len(words) <= target_length:
        return summary

    condensed = " ".join(words[:target_length])
    return condensed


def expand_summary(summary: str, target_length: int, article: str) -> str:
    """
    Expand a summary to increase its length.

    Args:
        summary: Original summary text
        target_length: Target word count
        article: Original article for additional content

    Returns:
        Expanded summary

    Example:
        >>> summary = "Brief overview."
        >>> article = "This is the full article content with more details..."
        >>> expanded = expand_summary(summary, 50, article)
        >>> len(expanded.split()) > len(summary.split())
        True
    """
    # Simple implementation: add article content
    # Real implementation would intelligently expand sections
    current_length = count_words(summary)

    if current_length >= target_length:
        return summary

    # Add details from article (simplified)
    words_needed = target_length - current_length
    article_words = article.split()[:words_needed]
    additional_content = " ".join(article_words)

    return summary + "\n\n" + "Additional details: " + additional_content


def adjust_length(summary: str, direction: str, template_metadata: Dict[str, Any], article: str = "") -> str:
    """
    Adjust summary length by ~25% in specified direction.

    Args:
        summary: Original summary text
        direction: 'shorter' or 'longer'
        template_metadata: Template metadata with target_length
        article: Original article (for expansion)

    Returns:
        Adjusted summary

    Example:
        >>> summary = "This is a summary. " * 10
        >>> metadata = {'target_length': (100, 300)}
        >>> shorter = adjust_length(summary, 'shorter', metadata)
        >>> len(shorter.split()) < len(summary.split())
        True
    """
    current_length = count_words(summary)
    target = template_metadata.get("target_length", (200, 500))

    if direction == "shorter":
        # Reduce by ~25%
        new_length = int(current_length * 0.75)
        return condense_summary(summary, new_length)
    else:
        # Increase by ~25%
        new_length = int(current_length * 1.25)
        return expand_summary(summary, new_length, article)


def find_topic_sections(article: str, topic: str) -> List[str]:
    """
    Find sections in article related to a specific topic.

    Args:
        article: Article content
        topic: Topic to search for

    Returns:
        List of relevant sections

    Example:
        >>> article = "## Introduction\\n\\n## React\\nReact is great...\\n\\n## Conclusion"
        >>> sections = find_topic_sections(article, "React")
        >>> len(sections) > 0
        True
    """
    # Simple implementation: find paragraphs containing topic
    paragraphs = article.split("\n\n")
    relevant = []

    for para in paragraphs:
        if topic.lower() in para.lower():
            relevant.append(para)

    return relevant


def extract_topic_details(article: str, topic_sections: List[str]) -> str:
    """
    Extract details about topic from relevant sections.

    Args:
        article: Full article content
        topic_sections: List of sections related to topic

    Returns:
        Extracted details as text

    Example:
        >>> article = "React is a framework for building UIs."
        >>> sections = find_topic_sections(article, "React")
        >>> details = extract_topic_details(article, sections)
        >>> 'React' in details
        True
    """
    # Simple implementation: combine relevant sections
    return "\n".join(topic_sections)


def enhance_sections(summary: str, topic: str, topic_details: str) -> str:
    """
    Enhance summary with additional details about specific topic.

    Args:
        summary: Original summary
        topic: Topic to enhance
        topic_details: Additional details about topic

    Returns:
        Enhanced summary

    Example:
        >>> summary = "## Overview\\nThis is about React."
        >>> details = "React is a JavaScript library."
        >>> enhanced = enhance_sections(summary, "React", details)
        >>> 'JavaScript' in enhanced
        True
    """
    # Add topic details to summary
    enhancement = f"\n\n**Additional details on {topic}:**\n{topic_details}"
    return summary + enhancement


def balance_sections(summary: str) -> str:
    """
    Balance sections in summary after enhancement.

    Args:
        summary: Enhanced summary that may be unbalanced

    Returns:
        Balanced summary

    Example:
        >>> summary = "Short section\\n\\nVery long section with lots of details... " * 10
        >>> balanced = balance_sections(summary)
        >>> len(balanced.split()) < len(summary.split())
        True
    """
    # Simple implementation: trim if too long
    target_words = 500
    if count_words(summary) > target_words:
        return condense_summary(summary, target_words)
    return summary


def refocus_summary(summary: str, topic: str, article: str) -> str:
    """
    Refocus summary to emphasize a specific topic.

    Args:
        summary: Original summary
        topic: Topic to focus on
        article: Original article content

    Returns:
        Refocused summary

    Example:
        >>> summary = "## Overview\\nGeneral content..."
        >>> article = "## Performance\\nReact is fast..."
        >>> refocused = refocus_summary(summary, "Performance", article)
        >>> 'Performance' in refocused
        True
    """
    # Identify sections related to topic
    topic_sections = find_topic_sections(article, topic)

    # Extract additional details on topic
    topic_details = extract_topic_details(article, topic_sections)

    # Enhance relevant sections
    new_summary = enhance_sections(summary, topic, topic_details)

    # Balance sections to maintain length
    new_summary = balance_sections(new_summary)

    return new_summary


def translate_to_english(text: str) -> str:
    """
    Translate text from Chinese to English (simplified placeholder).

    Args:
        text: Chinese text

    Returns:
        English translation

    Note:
        This is a placeholder. Real implementation would use translation API.
    """
    # Placeholder: real implementation would use translation service
    return f"[Translated to English] {text}"


def translate_to_chinese(text: str) -> str:
    """
    Translate text from English to Chinese (simplified placeholder).

    Args:
        text: English text

    Returns:
        Chinese translation

    Note:
        This is a placeholder. Real implementation would use translation API.
    """
    # Placeholder: real implementation would use translation service
    return f"[翻译成中文] {text}"


def preserve_technical_terms(summary: str, article: str) -> str:
    """
    Preserve technical terms during translation.

    Args:
        summary: Summary text (possibly translated)
        article: Original article

    Returns:
        Summary with technical terms preserved

    Example:
        >>> summary = "React is used for building UIs"
        >>> article = "React useState useEffect"
        >>> preserved = preserve_technical_terms(summary, article)
        >>> 'React' in preserved
        True
    """
    # Extract technical terms from article
    import re
    tech_terms = re.findall(r'\b[A-Z][a-zA-Z0-9]*\b', article)

    # Ensure they remain in summary (simplified)
    for term in tech_terms:
        if term not in summary:
            # Term was lost, add it back
            summary = f"{summary} (Note: {term})"

    return summary


def apply_language_template(summary: str, language: str) -> str:
    """
    Apply language-specific template formatting.

    Args:
        summary: Summary text
        language: Target language ('zh' or 'en')

    Returns:
        Formatted summary

    Example:
        >>> summary = "content"
        >>> formatted = apply_language_template(summary, 'zh')
        >>> 'content' in formatted
        True
    """
    if language == "zh":
        # Chinese formatting
        if not summary.startswith("## "):
            summary = "## 摘要\n\n" + summary
    else:
        # English formatting
        if not summary.startswith("## "):
            summary = "## Summary\n\n" + summary

    return summary


def change_language(summary: str, current_language: str, target_language: str, article: str) -> str:
    """
    Change summary language while preserving technical terms.

    Args:
        summary: Current summary
        current_language: Current language ('zh' or 'en')
        target_language: Target language ('zh' or 'en')
        article: Original article

    Returns:
        Summary in target language

    Example:
        >>> summary = "This is about React"
        >>> translated = change_language(summary, 'en', 'zh', 'React is great')
        >>> 'Translated' in translated or '翻译' in translated
        True
    """
    # Translate summary content
    if current_language == "zh" and target_language == "en":
        new_summary = translate_to_english(summary)
    elif current_language == "en" and target_language == "zh":
        new_summary = translate_to_chinese(summary)
    else:
        new_summary = summary

    # Preserve technical terms
    new_summary = preserve_technical_terms(new_summary, article)

    # Adjust template structure for language
    new_summary = apply_language_template(new_summary, target_language)

    return new_summary


def handle_refinement_request(
    summary: str,
    request: str,
    article: str = "",
    template_metadata: Optional[Dict[str, Any]] = None
) -> str:
    """
    Handle user refinement request.

    Args:
        summary: Current summary
        request: User's refinement request
        article: Original article (for context)
        template_metadata: Template metadata

    Returns:
        Refined summary

    Example:
        >>> summary = "This is a summary. " * 20
        >>> refined = handle_refinement_request(summary, "make it shorter")
        >>> len(refined.split()) < len(summary.split())
        True
    """
    request_lower = request.lower()
    template_metadata = template_metadata or {"target_length": (200, 500)}

    # Length adjustment
    if "shorter" in request_lower or "short" in request_lower:
        return adjust_length(summary, "shorter", template_metadata, article)
    elif "longer" in request_lower or "long" in request_lower or "expand" in request_lower:
        return adjust_length(summary, "longer", template_metadata, article)

    # Topic refocus
    elif "focus" in request_lower or "emphasize" in request_lower:
        # Extract topic from request
        words = request_lower.split()
        topic_index = -1
        for i, word in enumerate(words):
            if word in ["focus", "on", "about", "emphasize"]:
                if i + 1 < len(words):
                    topic_index = i + 1
                    break

        if topic_index > 0:
            topic = words[topic_index].capitalize()
            return refocus_summary(summary, topic, article)

    # Language change
    elif "english" in request_lower or "chinese" in request_lower or "中文" in request_lower:
        if "english" in request_lower:
            return change_language(summary, "zh", "en", article)
        else:
            return change_language(summary, "en", "zh", article)

    # Default: return original
    return summary


# Test function
if __name__ == "__main__":
    print("=" * 60)
    print("Testing User Feedback and Refinement Functions")
    print("=" * 60)

    # Test feedback prompt
    print("\n1. Feedback Prompt:")
    print(generate_feedback_prompt())

    # Test word count
    print("\n2. Word Count:")
    test_text = "This is a test summary with multiple words."
    print(f"   '{test_text}' has {count_words(test_text)} words")

    # Test length adjustment
    print("\n3. Length Adjustment:")
    long_summary = "This is a summary. " * 20
    print(f"   Original: {count_words(long_summary)} words")

    shorter = adjust_length(long_summary, "shorter", {"target_length": (100, 300)})
    print(f"   After shortening: {count_words(shorter)} words")

    longer = adjust_length("Short summary.", "longer", {"target_length": (100, 300)}, "Article content " * 50)
    print(f"   After lengthening: {count_words(longer)} words")

    # Test topic refocus
    print("\n4. Topic Refocus:")
    summary = "## Overview\\nThis is about web development."
    article = "## Performance\\nOptimizing performance is crucial.\\n\\n## Testing\\nTesting ensures quality."
    refocused = refocus_summary(summary, "Performance", article)
    print(f"   Refocused on 'Performance':")
    print(f"   {refocused[:100]}...")

    # Test language change
    print("\n5. Language Change:")
    english_summary = "This is about React and hooks."
    translated = change_language(english_summary, "en", "zh", "React uses useState and useEffect")
    print(f"   Original: {english_summary}")
    print(f"   Translated: {translated}")

    # Test refinement request handler
    print("\n6. Refinement Request Handler:")
    test_summary = "This is a summary. " * 20
    print(f"   Original: {count_words(test_summary)} words")

    refined = handle_refinement_request(test_summary, "please make it shorter")
    print(f"   Request: 'make it shorter'")
    print(f"   Result: {count_words(refined)} words")

    refined = handle_refinement_request(test_summary, "focus on performance", article="Performance is key for good applications.")
    print(f"   Request: 'focus on performance'")
    print(f"   Result mentions 'Performance': {'performance' in refined.lower()}")
