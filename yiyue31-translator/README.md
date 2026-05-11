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

1. 抓取原文 → 2. 加载纠正表 → 3. 提取特殊词句 → 4. 翻译（含评估循环） → 5. 自动维护纠正表

全程自动，仅在开头（内容缺失/非英文）和末尾（汇报结果）交互。

## 纠正表

`references/terms.md` — 只收录 LLM 会翻错的术语，翻译后自动维护。

## 依赖

- Node.js v16+
- `web-access` skill（URL 抓取）

---

详见 [SKILL.md](./SKILL.md)
