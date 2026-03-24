# Error Handling Workflow

## Error 1: Invalid URL

**Detection:**
```python
if is_url(input) and not url_accessible(input):
    return {
        "error": "INVALID_URL",
        "message": "无法访问该URL / Cannot access this URL",
        "suggestions": [
            "Check the URL is correct",
            "Try pasting the article content directly",
            "Use a different URL"
        ]
    }
```

**User Message:**
```markdown
## ❌ 无法访问URL / URL Not Accessible

无法访问该链接。请尝试以下方法：
The URL cannot be accessed. Please try:

1. **检查链接 / Check URL** - 确认URL是否正确
2. **直接粘贴 / Paste Content** - 直接粘贴文章内容
3. **更换链接 / Different URL** - 尝试其他链接
```

## Error 2: File Not Found

**Detection:**
```python
if is_file_path(input) and not file_exists(input):
    return {
        "error": "FILE_NOT_FOUND",
        "message": "文件不存在 / File not found",
        "suggestions": [
            "Check the file path",
            "Ensure file extension is .md or .txt",
            "Paste content directly"
        ]
    }
```

**User Message:**
```markdown
## ❌ 文件不存在 / File Not Found

找不到该文件。请检查：
File not found. Please check:

1. **文件路径 / File Path** - 确认路径正确
2. **文件格式 / File Format** - 支持.md和.txt文件
3. **直接粘贴 / Paste** - 直接粘贴内容
```

## Error 3: Empty/Insufficient Content

**Detection:**
```python
if word_count(content) < 100:
    return {
        "error": "INSUFFICIENT_CONTENT",
        "message": "内容不足 / Insufficient content",
        "min_required": 100,
        "actual": word_count(content),
        "suggestions": [
            "Provide more content",
            "Ensure full article is pasted",
            "Check if article is truncated"
        ]
    }
```

**User Message:**
```markdown
## ❌ 内容不足 / Insufficient Content

文章内容太少（最少需要100字）。
Content too short (minimum 100 words required).

**当前 / Current:** {actual} 字/words
**需要 / Required:** 100+ 字/words

请提供完整文章内容。
Please provide the complete article.
```

## Error 4: Article Type Ambiguous

**Detection:**
```python
if confidence(article_type) < 0.6:
    return {
        "error": "AMBIGUOUS_TYPE",
        "message": "文章类型不明确 / Article type unclear",
        "possible_types": [
            {"type": "Blog Post", "confidence": 0.45},
            {"type": "Tutorial", "confidence": 0.40}
        ],
        "action": "Ask user to clarify"
    }
```

**User Message:**
```markdown
## ❓ 文章类型不明确 / Article Type Unclear

无法确定文章类型，请选择：
Cannot determine article type, please select:

1. **博客文章 / Blog Post** - 个人观点、实践经验
2. **教程 / Tutorial** - 分步指导、学习材料
3. **研究论文 / Research Paper** - 学术研究、数据分析
4. **文档 / Documentation** - API参考、技术规范
```

## Error 5: Template Loading Failed

**Detection:**
```python
if not template_exists(selected_template):
    return {
        "error": "TEMPLATE_NOT_FOUND",
        "message": "模板不存在 / Template not found",
        "requested": selected_template,
        "available": list_available_templates(),
        "action": "Use default template"
    }
```

**User Message:**
```markdown
## ⚠️ 模板未找到 / Template Not Found

请求的模板 "{template}" 不存在。
Requested template "{template}" not found.

**可用模板 / Available Templates:**
- Standard (标准摘要)
- Concise (简洁笔记)
- Comprehensive (全面解析)

使用默认模板：Standard
Using default template: Standard
```
