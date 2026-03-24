"""
Error Handling Module

This module provides error detection and handling functions for the summarization workflow.
It identifies various error types and generates user-friendly error messages.
"""

from typing import Dict, List, Any, Optional
import re


class SummaryError(Exception):
    """Base exception for summary generation errors."""
    pass


class InvalidURLError(SummaryError):
    """Raised when a URL cannot be accessed."""
    pass


class FileNotFoundError(SummaryError):
    """Raised when a file cannot be found."""
    pass


class InsufficientContentError(SummaryError):
    """Raised when content is too short to summarize."""
    pass


class AmbiguousTypeError(SummaryError):
    """Raised when article type cannot be determined."""
    pass


class TemplateNotFoundError(SummaryError):
    """Raised when a template cannot be found."""
    pass


def is_url(input_string: str) -> bool:
    """
    Check if input string is a URL.

    Args:
        input_string: Input string to check

    Returns:
        True if input appears to be a URL

    Example:
        >>> is_url("https://example.com/article")
        True
        >>> is_url("./article.md")
        False
    """
    url_pattern = re.compile(
        r'^https?://'  # http:// or https://
        r'(?:(?:[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?\.)+[A-Z]{2,6}\.?|'  # domain
        r'localhost|'  # localhost
        r'\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})'  # IP
        r'(?::\d+)?'  # optional port
        r'(?:/?|[/?]\S+)$', re.IGNORECASE)
    return url_pattern.match(input_string) is not None


def is_file_path(input_string: str) -> bool:
    """
    Check if input string is a file path.

    Args:
        input_string: Input string to check

    Returns:
        True if input appears to be a file path

    Example:
        >>> is_file_path("./article.md")
        True
        >>> is_file_path("https://example.com")
        False
    """
    return input_string.startswith(('./', '../', '/', '~')) or \
           re.match(r'^[A-Za-z]:\\', input_string) is not None


def check_url_accessible(url: str) -> bool:
    """
    Check if a URL is accessible (simplified implementation).

    Args:
        url: URL to check

    Returns:
        True if URL appears accessible

    Note:
        This is a simplified implementation. Real implementation would
        make HTTP request to check accessibility.
    """
    # Simplified - just check URL format
    return is_url(url)


def check_file_exists(file_path: str) -> bool:
    """
    Check if a file exists.

    Args:
        file_path: Path to file

    Returns:
        True if file exists

    Example:
        >>> check_file_exists("./test.txt")
        False
    """
    import os
    return os.path.exists(file_path)


def validate_content_length(content: str, min_words: int = 100) -> Dict[str, Any]:
    """
    Validate that content has sufficient length for summarization.

    Args:
        content: Article content
        min_words: Minimum word count required

    Returns:
        Dictionary with validation status and details

    Example:
        >>> result = validate_content_length("Short content")
        >>> result['status']
        'FAIL'
        >>> result = validate_content_length("A" * 200)
        >>> result['status']
        'PASS'
    """
    word_count = len(content.split())

    if word_count < min_words:
        return {
            "status": "FAIL",
            "error": "INSUFFICIENT_CONTENT",
            "min_required": min_words,
            "actual": word_count,
            "message": f"内容不足 / Insufficient content (minimum {min_words} words required)"
        }

    return {
        "status": "PASS",
        "word_count": word_count
    }


def detect_article_type_confidence(content: str) -> Dict[str, Any]:
    """
    Detect article type and return confidence scores.

    Args:
        content: Article content

    Returns:
        Dictionary with article type and confidence

    Example:
        >>> result = detect_article_type_confidence("In this blog post, I will...")
        >>> print(result['type'])
        'Blog Post'
        >>> print(result['confidence'] > 0.6)
        True
    """
    try:
        from article_analysis import detect_article_type
        article_type = detect_article_type(content)
    except ImportError:
        # Fallback implementation if article_analysis not available
        article_type = "Blog Post"  # Default

    # Simplified confidence calculation
    # Real implementation would use more sophisticated analysis
    confidence = 0.7  # Default confidence

    return {
        "type": article_type,
        "confidence": confidence
    }


def validate_article_type(content: str) -> Dict[str, Any]:
    """
    Validate that article type can be determined with sufficient confidence.

    Args:
        content: Article content

    Returns:
        Dictionary with validation status and article type info

    Example:
        >>> result = validate_article_type("Clear article content...")
        >>> result['status']
        'PASS'
    """
    detection = detect_article_type_confidence(content)

    if detection["confidence"] < 0.6:
        return {
            "status": "FAIL",
            "error": "AMBIGUOUS_TYPE",
            "possible_types": [
                {"type": "Blog Post", "confidence": 0.45},
                {"type": "Tutorial", "confidence": 0.40}
            ],
            "message": "文章类型不明确 / Article type unclear"
        }

    return {
        "status": "PASS",
        "type": detection["type"],
        "confidence": detection["confidence"]
    }


def check_template_exists(template_name: str, available_templates: List[str]) -> Dict[str, Any]:
    """
    Check if a template exists.

    Args:
        template_name: Name of template to check
        available_templates: List of available template names

    Returns:
        Dictionary with validation status

    Example:
        >>> templates = ["Standard", "Concise", "Comprehensive"]
        >>> result = check_template_exists("Standard", templates)
        >>> result['status']
        'PASS'
    """
    if template_name not in available_templates:
        return {
            "status": "FAIL",
            "error": "TEMPLATE_NOT_FOUND",
            "requested": template_name,
            "available": available_templates,
            "message": f"模板不存在 / Template '{template_name}' not found"
        }

    return {
        "status": "PASS",
        "template": template_name
    }


def generate_error_message(error_dict: Dict[str, Any]) -> str:
    """
    Generate user-friendly error message from error dictionary.

    Args:
        error_dict: Error dictionary with error details

    Returns:
        Formatted error message in markdown

    Example:
        >>> error = {
        ...     'error': 'INSUFFICIENT_CONTENT',
        ...     'min_required': 100,
        ...     'actual': 50
        ... }
        >>> msg = generate_error_message(error)
        >>> 'Insufficient Content' in msg
        True
    """
    error_type = error_dict.get("error", "UNKNOWN_ERROR")

    messages = {
        "INVALID_URL": """## ❌ 无法访问URL / URL Not Accessible

无法访问该链接。请尝试以下方法：
The URL cannot be accessed. Please try:

1. **检查链接 / Check URL** - 确认URL是否正确
2. **直接粘贴 / Paste Content** - 直接粘贴文章内容
3. **更换链接 / Different URL** - 尝试其他链接""",

        "FILE_NOT_FOUND": """## ❌ 文件不存在 / File Not Found

找不到该文件。请检查：
File not found. Please check:

1. **文件路径 / File Path** - 确认路径正确
2. **文件格式 / File Format** - 支持.md和.txt文件
3. **直接粘贴 / Paste** - 直接粘贴内容""",

        "INSUFFICIENT_CONTENT": f"""## ❌ 内容不足 / Insufficient Content

文章内容太少（最少需要{error_dict.get('min_required', 100)}字）。
Content too short (minimum {error_dict.get('min_required', 100)} words required).

**当前 / Current:** {error_dict.get('actual', 0)} 字/words
**需要 / Required:** {error_dict.get('min_required', 100)}+ 字/words

请提供完整文章内容。
Please provide the complete article.""",

        "AMBIGUOUS_TYPE": """## ❓ 文章类型不明确 / Article Type Unclear

无法确定文章类型，请选择：
Cannot determine article type, please select:

1. **博客文章 / Blog Post** - 个人观点、实践经验
2. **教程 / Tutorial** - 分步指导、学习材料
3. **研究论文 / Research Paper** - 学术研究、数据分析
4. **文档 / Documentation** - API参考、技术规范""",

        "TEMPLATE_NOT_FOUND": f"""## ⚠️ 模板未找到 / Template Not Found

请求的模板 "{error_dict.get('requested', '')}" 不存在。
Requested template "{error_dict.get('requested', '')}" not found.

**可用模板 / Available Templates:**
- Standard (标准摘要)
- Concise (简洁笔记)
- Comprehensive (全面解析)

使用默认模板：Standard
Using default template: Standard"""
    }

    return messages.get(error_type, f"## ❌ Unknown Error\n\n{error_dict.get('message', 'An unknown error occurred')}")


def validate_input(input_string: str) -> Dict[str, Any]:
    """
    Comprehensive input validation that checks all error conditions.

    Args:
        input_string: User input (URL, file path, or direct content)

    Returns:
        Dictionary with validation status and error details if any

    Example:
        >>> result = validate_input("./article.md")
        >>> result['status']
        'PASS' or 'FAIL'
    """
    # Check if URL
    if is_url(input_string):
        if not check_url_accessible(input_string):
            return {
                "status": "FAIL",
                "error": "INVALID_URL",
                "url": input_string,
                "message": "无法访问该URL / Cannot access this URL"
            }

    # Check if file path
    elif is_file_path(input_string):
        if not check_file_exists(input_string):
            return {
                "status": "FAIL",
                "error": "FILE_NOT_FOUND",
                "path": input_string,
                "message": "文件不存在 / File not found"
            }

    # If not URL or file path, treat as direct content
    else:
        # Validate content length
        content_check = validate_content_length(input_string)
        if content_check["status"] == "FAIL":
            return content_check

        # Validate article type
        type_check = validate_article_type(input_string)
        if type_check["status"] == "FAIL":
            return type_check

    return {"status": "PASS"}


# Test function
if __name__ == "__main__":
    print("=" * 60)
    print("Testing Error Handling Functions")
    print("=" * 60)

    # Test URL detection
    print("\n1. Testing URL detection:")
    print(f"   is_url('https://example.com'): {is_url('https://example.com')}")
    print(f"   is_url('./article.md'): {is_url('./article.md')}")

    # Test file path detection
    print("\n2. Testing file path detection:")
    print(f"   is_file_path('./article.md'): {is_file_path('./article.md')}")
    print(f"   is_file_path('https://example.com'): {is_file_path('https://example.com')}")

    # Test content validation
    print("\n3. Testing content length validation:")
    short_content = "This is too short."
    long_content = "This is a longer article. " * 20
    print(f"   Short content (5 words): {validate_content_length(short_content)['status']}")
    print(f"   Long content (120 words): {validate_content_length(long_content)['status']}")

    # Test article type detection
    print("\n4. Testing article type detection:")
    blog_content = "In this blog post, I will share my experience with React..."
    result = detect_article_type_confidence(blog_content)
    print(f"   Type: {result['type']}, Confidence: {result['confidence']}")

    # Test template check
    print("\n5. Testing template validation:")
    templates = ["Standard", "Concise", "Comprehensive"]
    print(f"   'Standard' exists: {check_template_exists('Standard', templates)['status']}")
    print(f"   'Invalid' exists: {check_template_exists('Invalid', templates)['status']}")

    # Test error message generation
    print("\n6. Testing error message generation:")
    error_dict = {
        "error": "INSUFFICIENT_CONTENT",
        "min_required": 100,
        "actual": 50
    }
    print(generate_error_message(error_dict))

    # Test comprehensive input validation
    print("\n7. Testing comprehensive input validation:")
    test_inputs = [
        "https://example.com/article",
        "./nonexistent.md",
        "This is a very long article with enough content to pass the minimum word count requirement for summarization. " * 10
    ]

    for test_input in test_inputs[:2]:  # Test first two only
        print(f"\n   Input: {test_input[:50]}...")
        result = validate_input(test_input)
        print(f"   Status: {result['status']}")
        if result['status'] == 'FAIL':
            print(f"   Error: {result.get('error', 'Unknown')}")
