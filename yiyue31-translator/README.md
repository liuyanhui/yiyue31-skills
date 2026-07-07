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

1. 抓取原文 → 2. 分析 + 术语表 + keep-list + 受众 → 3. 特殊词句 → 4. 翻译（阶段A 内联打标）→ 4.5 注释把关（阶段B）→ 4.6 机械校验关卡 → 5/6/7 翻译/翻译腔/AI 味检查 → 8. 术语维护 → 9. 可读性检查 → 10. 合并 → 11. 全局一致性

### 注释体系（v2.4）

两阶段：翻译时对读者难推断的词内联插入 `«english»` 标记，阶段B 按 #1 词级标准裁定（保留→`中文（English）` / 删除）。机械类（代码/URL/SVG/缩写/[KEEP] 术语）内联原样保留，由 `scripts/verify-mechanical.js` 强制校验。优先级：准确 > 流畅地道 > 必要注释。

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
