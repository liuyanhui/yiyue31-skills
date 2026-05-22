# yiyue31-translator

英文技术文章翻译工具。自动翻译、评估纠错、维护术语纠正表。

## 使用

```text
翻译 https://example.com/article
翻译 ./article.md
翻译 https://example.com/article --literal
```

默认意译风格。加 `--literal` 使用直译。

## 工作流程

1. 抓取原文 → 2. 文章分段 → 3. 加载纠正表 → 4. 提取特殊词句 → 5. 翻译 → 6. 翻译检查 → 7. 翻译腔检查 → 8. AI 味检查 → 9. 术语维护 → 10. 可读性检查 → 11. 合并译文

### 文章分段

doc_segmenter 自动处理：小文件（< 40KB）直接作为单 chunk，大文件按章节切分为多个 chunk。输出格式统一，下游无需区分。详见 `scripts/doc_segmenter/README.md`。

全程自动，仅在开头（内容缺失/非英文）和末尾（汇报结果）交互。

## 纠正表

`references/terms.md` — 只收录 LLM 会翻错的术语，翻译后自动维护。

## 依赖

- Node.js v16+
- Python >= 3.10
- `web-access` skill（URL 抓取）

---

详见 [SKILL.md](./SKILL.md)
