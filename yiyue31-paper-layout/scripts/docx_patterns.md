# docx-js 代码模式参考

本文件包含生成期刊格式 docx 时常用的 JavaScript 代码模式。
使用时根据具体论文内容填充数据，生成 `generate_journal.js` 后执行。

## 目录

1. [依赖引入与常量定义](#1-依赖引入与常量定义)
2. [常用字号对照表](#2-常用字号对照表)
3. [正文中引用标注上标](#3-正文中引用标注上标)
4. [双栏 Section 设置](#4-双栏-section-设置)
5. [页眉带分隔线](#5-页眉带分隔线)
6. [首页单栏段落构建](#6-首页单栏段落构建)
7. [参考文献中英双语](#7-参考文献中英双语)
8. [完整文档结构](#8-完整文档结构)

---

## 1. 依赖引入与常量定义

```javascript
const fs = require("fs");
const {
  Document, Packer, Paragraph, TextRun, Header, Footer,
  AlignmentType, SectionType, Column, HeadingLevel,
  PageNumber, TabStopType, TabStopPosition, BorderStyle
} = require("docx");

// 字号常量（半磅值）
const SIZE = {
  ERHAO: 44,      // 二号 22pt
  SANHAO: 32,     // 三号 16pt
  SIHAO: 28,      // 四号 14pt
  XIAOSI: 24,     // 小四 12pt
  WUHAO: 21,      // 五号 10.5pt
  XIAOWU: 18,     // 小五 9pt
  LIUHAO: 15,     // 六号 7.5pt
};

// 字体常量
const FONT = {
  HEITI: "黑体",
  SONGTI: "宋体",
  KAITI: "华文楷体",
  TNR: "Times New Roman",
};

// 单位转换：1cm ≈ 567 DXA
const CM = (cm) => Math.round(cm * 567);
```

## 2. 常用字号对照表

| 名称 | 磅值 (pt) | docx-js 半磅值 |
|------|----------|---------------|
| 二号 | 22 | 44 |
| 三号 | 16 | 32 |
| 四号 | 14 | 28 |
| 小四 | 12 | 24 |
| 五号 | 10.5 | 21 |
| 小五 | 9 | 18 |
| 六号 | 7.5 | 15 |

## 3. 正文中引用标注上标

用正则匹配 `[n]`、`[n,m]`、`[n-m]` 格式，自动设为上标：

```javascript
function makeBodyRuns(text, opts) {
  const runs = [];
  const regex = /(\[[\d,\s\-]+\])/g;
  let lastIndex = 0, match;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex)
      runs.push(new TextRun({ text: text.substring(lastIndex, match.index), ...opts }));
    runs.push(new TextRun({ text: match[1], ...opts, superScript: true }));
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length)
    runs.push(new TextRun({ text: text.substring(lastIndex), ...opts }));
  return runs;
}
```

使用方式：

```javascript
// 一级标题
new Paragraph({
  spacing: { line: 276, before: 160, after: 80 },
  children: makeBodyRuns("1  标题文字", { font: FONT.HEITI, size: SIZE.SIHAO }),
})

// 二级标题
new Paragraph({
  spacing: { line: 276, before: 120, after: 60 },
  children: makeBodyRuns("1.1  标题文字", { font: FONT.HEITI, size: SIZE.WUHAO, bold: true }),
})

// 正文段落（自动处理 [n] 上标）
new Paragraph({
  spacing: { line: 276, before: 0, after: 0 },
  indent: { firstLine: CM(0.74) },
  children: makeBodyRuns("正文内容[1]继续[2,3]", { font: FONT.SONGTI, size: SIZE.WUHAO }),
})
```

## 4. 双栏 Section 设置

> **关于上边距**：以下代码示例中所有 Section 统一使用 `CM(2.15)` 作为上边距（简化默认值）。部分期刊模板（如 `references/template_spec.md` 中记录的西北工业大学学报模板）要求正文双栏 Section 的上边距为 `CM(4.00)`，以留出更多页眉空间。实际使用时，请根据目标期刊的具体模板调整各 Section 的 `margin.top` 值。

```javascript
{
  properties: {
    type: SectionType.NEXT_PAGE,
    page: {
      size: { width: CM(21), height: CM(29.7) },
      margin: { top: CM(2.15), bottom: CM(2.15), left: CM(1.95), right: CM(1.95) },
      // ↑ 如模板要求正文区上边距更大，改为 top: CM(4.00)
    },
    column: { count: 2, equalWidth: true, space: 422 },  // 422 DXA ≈ 0.74cm
  },
  headers: { default: headerBody },
  footers: { default: footerDefault },
  children: [ /* 正文段落数组 */ ],
}
```

## 5. 页眉带分隔线

```javascript
const headerBody = new Header({
  children: [new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 0 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "000000", space: 4 } },
    children: [new TextRun({ text: "作者，等：文章标题", font: FONT.SONGTI, size: SIZE.XIAOWU })],
  })],
});
```

## 6. 首页单栏段落构建

```javascript
const headerParagraphs = [
  // 中文标题
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { line: 276, before: 200, after: 200 },
    children: [new TextRun({ text: "论文标题", font: FONT.HEITI, size: SIZE.ERHAO, bold: true })],
  }),
  // 作者
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { line: 276, before: 100, after: 50 },
    children: [new TextRun({ text: "作者姓名", font: FONT.KAITI, size: SIZE.SIHAO })],
  }),
  // 单位
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { line: 276, before: 0, after: 150 },
    children: [new TextRun({ text: "(单位，城市 邮编)", font: FONT.SONGTI, size: SIZE.XIAOWU })],
  }),
  // 摘要
  new Paragraph({
    spacing: { line: 276, before: 100, after: 50 },
    indent: { left: CM(0.74), right: CM(0.74) },
    children: [
      new TextRun({ text: "摘  要：", font: FONT.HEITI, size: SIZE.WUHAO, bold: true }),
      new TextRun({ text: "摘要内容...", font: FONT.KAITI, size: SIZE.WUHAO }),
    ],
  }),
  // 关键词
  new Paragraph({
    spacing: { line: 276, before: 50, after: 50 },
    indent: { left: CM(0.74), right: CM(0.74) },
    children: [
      new TextRun({ text: "关  键  词：", font: FONT.HEITI, size: SIZE.WUHAO, bold: true }),
      new TextRun({ text: "关键词1；关键词2", font: FONT.KAITI, size: SIZE.WUHAO }),
    ],
  }),
  // 中图分类号
  new Paragraph({
    spacing: { line: 276, before: 50, after: 200 },
    indent: { left: CM(0.74), right: CM(0.74) },
    children: [
      new TextRun({ text: "中图分类号：", font: FONT.HEITI, size: SIZE.WUHAO, bold: true }),
      new TextRun({ text: "S-01    ", font: FONT.TNR, size: SIZE.WUHAO }),
      new TextRun({ text: "文献标识码：", font: FONT.HEITI, size: SIZE.WUHAO, bold: true }),
      new TextRun({ text: "A", font: FONT.TNR, size: SIZE.WUHAO }),
    ],
  }),
  // --- 英文摘要部分 ---
  // 英文标题
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { line: 360, before: 200, after: 100 },
    children: [new TextRun({ text: "English Title", font: FONT.TNR, size: SIZE.SANHAO, bold: true })],
  }),
  // 英文作者
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { line: 276, before: 60, after: 30 },
    children: [new TextRun({ text: "ENGLISH Author", font: FONT.TNR, size: SIZE.SIHAO })],
  }),
  // 英文单位
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { line: 276, before: 0, after: 100 },
    children: [new TextRun({ text: "(English Affiliation)", font: FONT.TNR, size: SIZE.XIAOWU })],
  }),
  // Abstract
  new Paragraph({
    spacing: { line: 276, before: 80, after: 40 },
    indent: { left: CM(0.74), right: CM(0.74) },
    children: [
      new TextRun({ text: "Abstract", font: FONT.TNR, size: SIZE.WUHAO, bold: true }),
      new TextRun({ text: ": ", font: FONT.TNR, size: SIZE.WUHAO, bold: true }),
      new TextRun({ text: "Abstract content...", font: FONT.TNR, size: SIZE.WUHAO }),
    ],
  }),
  // Key words
  new Paragraph({
    spacing: { line: 276, before: 40, after: 100 },
    indent: { left: CM(0.74), right: CM(0.74) },
    children: [
      new TextRun({ text: "Key words", font: FONT.TNR, size: SIZE.WUHAO, bold: true }),
      new TextRun({ text: ": ", font: FONT.TNR, size: SIZE.WUHAO, bold: true }),
      new TextRun({ text: "keyword1; keyword2", font: FONT.TNR, size: SIZE.WUHAO }),
    ],
  }),
];
```

## 7. 参考文献中英双语

```javascript
const refParagraphs = [
  new Paragraph({
    spacing: { line: 276, before: 200, after: 100 },
    children: [new TextRun({ text: "参考文献:", font: FONT.HEITI, size: SIZE.SIHAO })],
  }),
];
for (const ref of REFERENCES) {
  // 中文行
  refParagraphs.push(new Paragraph({
    spacing: { line: 300, before: 0, after: 0 },
    children: [new TextRun({ text: ref.cn, font: FONT.SONGTI, size: SIZE.XIAOWU })],
  }));
  // 英文翻译行
  refParagraphs.push(new Paragraph({
    spacing: { line: 300, before: 0, after: 20 },
    children: [new TextRun({ text: ref.en, font: FONT.TNR, size: SIZE.XIAOWU })],
  }));
}
```

## 8. 完整文档结构

```javascript
const doc = new Document({
  sections: [
    // Section 1: 首页（单栏）
    {
      properties: {
        page: {
          size: { width: CM(21), height: CM(29.7) },
          margin: { top: CM(2.15), bottom: CM(2.15), left: CM(1.95), right: CM(1.95) },
        },
        column: { count: 1, equalWidth: true, space: 720 },
      },
      headers: { default: headerFirst },
      footers: { default: footerDefault },
      children: headerParagraphs,
    },
    // Section 2: 正文（双栏）
    {
      properties: {
        type: SectionType.NEXT_PAGE,
        page: { /* 同上 */ },
        column: { count: 2, equalWidth: true, space: 422 },
      },
      headers: { default: headerBody },
      footers: { default: footerDefault },
      children: bodyParagraphs,
    },
    // Section 3: 参考文献（单栏）
    {
      properties: {
        type: SectionType.NEXT_PAGE,
        page: { /* 同上 */ },
        column: { count: 1, equalWidth: true, space: 720 },
      },
      headers: { default: headerBody },
      children: refParagraphs,
    },
    // Section 4: 引用格式（单栏）
    {
      properties: {
        type: SectionType.NEXT_PAGE,
        page: { /* 同上 */ },
        column: { count: 1, equalWidth: true, space: 720 },
      },
      headers: { default: headerBody },
      children: englishParagraphs, // 引用格式行（斜体）
    },
  ],
});

// 输出
const OUTPUT = "输出文件名_期刊格式.docx";
Packer.toBuffer(doc).then((buffer) => {
  fs.writeFileSync(OUTPUT, buffer);
  console.log("Done: " + OUTPUT);
});
```
