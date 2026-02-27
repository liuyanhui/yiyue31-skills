# Yiyue31 Agent Skills

个人 Agent Skills 集合 - 用于 Claude Code 的自定义技能包

## 项目简介

本项目包含针对特定使用场景优化的 Agent Skills，可安装到 Claude Code 中扩展 AI 助手的能力。

## 当前技能

### 📚 yiyue31-courseware-generator

生成面向初中生的科学课程（物理、化学、生物）自学课件。

**功能特性：**
- 自动生成结构化的课程内容（9个标准章节）
- 支持多种教材版本（北师大版、人教版等）
- 基于国际主流教学法设计（认知负荷理论、现象导向学习等）
- 包含知识点提炼、生活场景映射、思维导图、趣味自测
- 自动生成分级习题和历年中考真题
- 输出高质量 Markdown 格式课件

**技能包：** `yiyue31-courseware-generator.skill`

**使用示例：**
```
生成北师大版八年级物理第7章运动和力的课件
```

---

### 🌐 yiyue31-translate-tech-article

将英文技术文章翻译为中文，保留技术术语，支持直译和意译两种模式。

**功能特性：**
- 智能识别文章主题并加载对应术语表
- 保留代码块、命令行、URL 等技术内容
- 自动维护和更新术语表
- 支持 URL、文件、直接粘贴三种输入方式
- 输出带 YAML Frontmatter 的规范 Markdown
- 自动 Git 提交术语表更新

**技能包：** `yiyue31-translate-tech-article.skill`

**使用示例：**
```
翻译这篇文章：https://example.com/tech-article
```

---

### 📝 yiyue31-summary-generator

生成技术文章的结构化摘要，支持多种文章类型。

**功能特性：**
- 结构化摘要输出（概述、要点、技术细节、收获、结论）
- 支持博客文章、研究论文、文档等多种类型
- 接受 URL、文件、直接文本输入
- 智能识别文章类型并调整摘要风格
- 保持技术准确性和可读性的平衡

**技能包：** `yiyue31-summary-generator.skill`

**使用示例：**
```
总结这篇文章：https://example.com/tech-post
```

---

## 安装方法

1. 下载 `.skill` 文件
2. 将文件复制到 Claude Code 的 skills 目录
3. 重启 Claude Code

## 技能开发

所有技能遵循 Anthropic Agent Skills 规范：

```
skill-name/
├── SKILL.md              # 必需：技能定义和工作流程
├── references/           # 可选：参考文档和模板
├── scripts/              # 可选：可执行脚本
└── assets/               # 可选：输出资源文件
```

## 许可证

MIT License

---

**最后更新：** 2025-02-27
