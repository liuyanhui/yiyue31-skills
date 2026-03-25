# Yiyue31 Agent Skills

个人 Agent Skills 集合 - 用于 Claude Code 的自定义Skills包

## 项目简介

本项目包含针对特定使用场景优化的 Agent Skills，可安装到 Claude Code 中扩展 AI 助手的能力。

## 包含的Skills

### 📚 yiyue31-courseware-generator

生成面向初中生的科学课程（物理、化学、生物）自学课件。

**功能特性：**
- 自动生成结构化的课程内容（9个标准章节）
- 支持多种教材版本（北师大版、人教版等）
- 基于国际主流教学法设计（认知负荷理论、现象导向学习等）
- 包含知识点提炼、生活场景映射、思维导图、趣味自测
- 自动生成分级习题和历年中考真题
- 输出高质量 Markdown 格式课件

**目录：** `yiyue31-courseware-generator/SKILL.md`

**使用示例：**
```
生成北师大版八年级物理第7章运动和力的课件
```

---

### 🌐 yiyue31-tech-article-translator

专业技术文章翻译工具，将英文技术文章翻译为高质量中文。

**功能特性：**
- 智能网页内容获取（优先使用本地 skills，支持 wget/curl/agent-browser）
- 智能识别文章主题并加载对应术语表
- 保留代码块、命令行、URL 等技术内容格式
- 自动维护和更新术语表文件
- 支持多种输入方式（URL、文件、直接粘贴）
- 输出带 YAML Frontmatter 的规范 Markdown
- 自动 Git 提交术语表更新

**目录：** `yiyue31-tech-article-translator/SKILL.md`

**使用示例：**
```
翻译这篇文章：https://example.com/tech-article
```

---

### 📝 yiyue31-summary-generator

智能技术文章总结生成器，支持多种模板和文章类型的深度分析。

**功能特性：**

- 三种专业总结模板（技术文章、论文、简洁笔记）
- 智能文章分析（语言、类型、主题、结构、主体、背景、术语、金句）
- 支持多种输入方式（URL、文件、直接粘贴）
- 自动质量检查和字数统计验证
- 保留技术术语准确性，提供中英对照
- 完整工作流程（获取→分析→生成→检查→润色）
- 生成结构化 Markdown 输出文件

**可用模板：**

- **Tech-Article-Summary**：技术文章总结模板，适合技术博客、文档、公告等
- **Paper Template**：论文总结模板，适合学术论文和研究报告
- **Concise Template**：简洁笔记模板，聚焦核心知识，适合快速学习（默认）

**目录** `yiyue31-summary-generator/SKILL.md`

**工作流程：**

1. 获取文章内容（支持 URL/文件/粘贴）
2. 深度分析（8维度智能分析）
3. 模板选择与总结生成
4. 质量检查（覆盖率、准确性、长度等）
5. 总结润色（去除 AI 生成痕迹）

**使用示例：**
```
总结这篇文章：https://example.com/tech-post
```
---

## 安装或更新的方法

1. 包含三个文件：`yiyue31-summary-generator/SKILL.md`,`yiyue31-tech-article-translator/SKILL.md`, `yiyue31-courseware-generator/SKILL.md`。
2. User scope 级别安装。依次将三个文件复制到`~/.claude/`下。
3. Project 级别安装。将文件复制到项目对应的目录下的`.claude/`。
4. 复制前先创建对应的目录：`yiyue31-summary-generator/`,`yiyue31-tech-article-translator/`, `yiyue31-courseware-generator/`
5. 只能复制或更新'## 项目结构'中的目录和目录下的文件。
6. 重启 Claude Code

## 项目结构

所有Skills遵循 Anthropic Agent Skills 规范：

```
skill-name/
├── SKILL.md              # 必需：Skills定义和工作流程
├── templates/            # 可选：模板文件
│   ├── template-1.md
│   ├── template-2.md
│   └── ...
├── scripts/              # 可选：可执行脚本
│   └── script-name.js/py/ts
├── references/           # 可选：参考文档和模板
└── assets/               # 可选：输出资源文件
```

## Skills开发规范

- 使用 YAML Frontmatter 定义Skills元数据
- 提供清晰的工作流程和步骤说明
- 包含使用示例和最佳实践
- 保持文档简洁易读
- 支持中英文双语环境

## 许可证

MIT License

---

**最后更新：** 2025-03-25
