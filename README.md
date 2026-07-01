# Yiyue31 Agent Skills

用于 Claude Code 的自定义 Skills 集合。

## 包含的 Skills

### yiyue31-translator

英文技术文章翻译为高质量中文。分段翻译 + 多轮质量审阅（准确性、术语一致性、翻译腔、AI 味、可读性），自动维护术语表，保留代码/URL 格式。

**示例：** `翻译这篇文章：https://example.com/tech-article`

### yiyue31-summary

技术文章/论文/文档智能总结。按类型加权评分（信息密度、逻辑连贯、技术深度、表达质量），逐条给出带证据的问题清单。

**示例：** `总结这篇文章：https://example.com/tech-post`

### yiyue31-hn-digest

把 Hacker News 讨论帖转成结构化中文文章：分组观点、争议点、多风格（技术/爆款/活泼/新闻/播客）推荐摘要。

**示例：** `总结这个 HN 帖子：https://news.ycombinator.com/item?id=48734373`

### yiyue31-talk

通过交互式讨论，提取用户对一篇文章的理解、观点和收获，生成用户观点文档。

**示例：** `帮我整理一下我对这篇文章的看法`

### yiyue31-notes

把 `yiyue31-summary`（文章总结）和 `yiyue31-talk`（用户观点）的产出合并成统一的学习笔记。

**示例：** `把刚才的总结和我的心得合并成笔记`

### yiyue31-prune

精简指令、流程、工作流或文档中的冗余，区分"目标意图"与"动机/啰嗦"，只砍后者。

**示例：** `精简这段 prompt，保留意图`

### yiyue31-paper-layout

中文学术论文 docx 转换为期刊投稿格式（双栏排版、格式模板对齐），输出规范 docx。

**示例：** `把这篇论文排版成期刊格式：paper.docx`

### yiyue31-science-courseware

初中理科（物理/化学/生物）自学课件生成器，支持多教材版本，输出结构化 Markdown 课件。

**示例：** `生成北师大版八年级物理第7章运动和力的课件`

## 工程类 Skills（engineering/）

`engineering/` 下另有三个 skill，详见 [engineering/README.md](engineering/README.md)：

- **yiyue31-planner** — 从需求产出结构化任务计划（YAML），供 orchestrator 执行。
- **yiyue31-orchestrator** — 按计划文档逐任务执行。
- **yiyue31-context** — 为项目各目录生成分层 `CLAUDE.md` 上下文。

## 设计记录

重要的需求背景、设计决策、踩坑教训应记录到 `docs/` 目录并纳入 git 版本管理，防止后续重复踩同样的坑。

记录内容应包含：原始需求场景、设计决策的来由、演进中暴露的问题、可复用的教训。

**示例：** [planner 设计背景与教训](docs/planner-design-background.md) —— 记录 `yiyue31-planner` 子代理机制的设计来由、暴露的复杂度失控问题，以及"遇到 AI 异常先验证根因归因，再设计机制""复杂度需匹配载体形态""子代理是可靠性负债"等教训。

**示例：** [共享评估 prompt 的版本同步](docs/shared-evaluation-prompt-sync.md) —— translator、hn-digest 等共用的评估 prompt 如何用版本号防止漂移；附 ai-tone v2.x 演进与待办（summary 英文版、sibling prompt 表层化）。

## 安装

将目标 skill 目录整体复制到 `~/.claude/skills/`（全局）或项目下 `.claude/skills/`，然后重启 Claude Code。

## 许可证

MIT License
