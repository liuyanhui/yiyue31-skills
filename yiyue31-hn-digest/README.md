# hn-digest

把 Hacker News 讨论帖自动转成结构化中文/英文文章的 Claude Code skill。抓取 → 过滤 → 分组 → 生成 → 质量检查，端到端。

## 使用

直接对 Claude Code 用自然语言触发：

```text
总结这个 HN 帖子 https://news.ycombinator.com/item?id=12345678
digest this HN thread: 12345678
帮我看看 HN 这场讨论在吵什么 12345678
summarize what HN is saying in this post
```

可选参数（在自然语言里说出来即可，Claude 会解析）：

| 参数 | 默认 | 说明 |
|------|------|------|
| `--depth N` | 2 | 评论树截断深度（1–5） |
| `--minReplies N` | 3 | 单条评论最少需要的子评论数 |
| `--maxComments N` | 30 | 入选评论上限 |
| `--lang zh\|en` | `zh` | 输出文章语言 |
| `--outputDir path` | `.` | 输出目录 |
| `--with-original` | 关 | 同时抓取原文链接内容作为背景 |
| `--groupBy topic,stance` | `topic,stance` | 分组维度 |
| `--sort-groups relevance\|engagement` | `relevance` | 分组排序方式 |
| `--templateVersion v1` | `v1` | 模板版本 |

## 工作流程

1. 解析输入 → 2. 加载配置 → 3. 检查缓存 → 4. 抓取并缓存数据 → 5. 准备输出并校验 → 6. 过滤评论 → 7. 分组 → 8. 生成文章（最多 3 轮 generate-evaluate）→ 9. AI 语气检查 → 10. 翻译腔检查（条件）→ 11. 可读性检查 + 读者审计 + 最终输出 → 12. 推荐摘要 → `03-article.md` + `recommendation-*.md`

主流程见 [SKILL.md](./SKILL.md)。

## 输出

每个帖子在 `{outputDir}/{postId}-{slug}/` 下生成：

```
01-raw-data.json              # 原始统一 JSON（顶层含 latestCommentAt 时间戳）
02-grouped.json               # 分组结果
03-article.md                 # 最终文章
recommendation-{slug}-{postId}.md  # 多风格推荐摘要
article-draft-round{N}.md     # 各轮草稿（可观测性）
evaluation-*.md               # 各评估报告（可观测性）
```

所有中间文件保留，不清理。

## 目录结构

```
hn-digest/
├── SKILL.md                  # 入口提示词文档
├── README.md                 # 本文件
├── scripts/                  # 抓取器代码（详见 scripts/README.md）
│   ├── algolia.ts
│   ├── firebase.ts
│   ├── jina.ts
│   ├── lib/utils.ts
│   └── __tests__/            # bun:test 测试套件
├── references/               # 按需加载的评估 prompt
│   ├── evaluate-article-prompt.md
│   ├── evaluate-ai-tone-prompt.md
│   ├── evaluate-translationese-prompt.md
│   ├── evaluate-reader-audit-prompt.md
│   └── evaluate-readability-prompt.md
├── assets/                   # 输出模板
│   ├── article-v1.md
│   ├── recommendation-v1.md
│   └── grouped-example-v1.json
├── package.json
└── bun.lock

# 运行时数据（不在 skill 目录里）
~/.hn-digest/
├── config.json               # 首次运行自动生成
└── cache/
    └── {postId}.json         # 抓取缓存
```

## 依赖

- [Bun](https://bun.sh/) 运行时（执行抓取脚本与测试）
- `turndown`（HTML → Markdown，已在 `package.json` 中）
- Jina Reader：`https://r.jina.ai`，备用 `https://r.jinaai.cn`

## 测试

```bash
bun test
```

当前规模：7 个测试文件，95 个 pass / 9 个 skip（需网络的集成测试） / 0 个 fail。

## 设计决策

- **抓取脚本**（`scripts/*.ts`）是可执行 TypeScript，单独调试时可直接 `bun scripts/algolia.ts <postId>`
- **质量评估走 subagent 架构**：主 agent 负责生成和修复，评估 subagent 负责独立评估（只读文章、写报告、不修改文件）。详见 [SKILL.md](./SKILL.md)

## Changelog

- **0.0.8**（2026-06-30）：免责声明 + 时间戳改为程序注入
  - 新增 `scripts/insert-header.ts`：在 `final-*.md` 生成后，于 H1 之后机械插入免责声明 + 讨论截至时间戳（时间戳格式 `YYYY-MM-DD HH:mm:ss`，本地时区；`latestCommentAt` 为 null 时只插免责声明；幂等）
  - `article-v1.md` / `recommendation-v1.md` 删除 disclaimer/timestamp 占位行及相关注释，模板回归纯结构
  - SKILL.md 删除 Step 8 的 disclaimer/timestamp 生成规则（原 Rule 5/6）；Step 11.3 改为调用脚本注入；`03-article.md` 不再承载这两行，评估链路保持干净
  - `recommendation-*.md` 去除时间戳行
- **0.0.7**（2026-06-25）：提示词文档精简（行为不变）
  - 删除 5 个评估 prompt 的 File Access Constraint 块（含过期的 `readFiles`/`writeFiles` 契约）
  - SKILL.md Step 8/12 timestamp 规则指向 asset 模板，去除 zh/en 格式串复述
  - SKILL.md 11.2 WHY 段精简（保留 guardrail）、删除 Boundary 行
  - reader-audit-prompt 内部去重（「无原始评论线程」「只报问题不修」各留一处）
  - README 删除 `architecture.md` 死链；设计决策节 6 → 2 条
  - evaluate-article-prompt aggregation voice 压缩；article-v1.md 删元注释
- **0.0.6**（2026-06-24）：followups
  - 修复 `error-scenarios.test.ts` 4 个过期断言（对齐当前 SKILL.md 措辞；行为不变）
  - `article-v1.md` 生成指令注释块精简去冗，与 `evaluate-article-prompt.md` 的重叠减少
  - `recommendation-v1.md` 推荐摘要文档也加 `latestCommentAt` 时间戳行
- **0.0.5**（2026-06-24）：AI 痕迹治理（C 档）
  - 新增 `references/evaluate-reader-audit-prompt.md`：3 个冷读读者（普通/略读/门外汉或 non-native）只读文章报告卡壳点，并入 Step 11 成为 11.2 读者审计（最多 3 轮，主 agent 拿全上下文修复）
  - 合并 summary 的 3 类 AI 语气模式（虚假互动/讨好全受众/空头承诺）进 `evaluate-ai-tone-prompt.md`，并强化"推销词"纳入空泛强化词
  - `article-v1.md` 新增聚合语气生成规则：禁钟摆式对立复述、禁元叙述式分组开头
  - `evaluate-article-prompt.md` Writing Quality 维度新增"聚合语气"反向检查，让 Step 8 生成循环在源头压住模式
- **0.0.4**（2026-06-24）：时间戳
  - 抓取脚本在统一 JSON 顶层写入 `latestCommentAt`（最新评论的 ISO 8601 UTC 时间）
  - 文章在免责声明下方新增 `<small>` 时间戳行，标注讨论截至时间（Generation Rule 6）
- **0.0.3**（2026-06-09）：标题前缀 + 推荐摘要
  - 文章 H1 标题强制以 `[Hacker News]` 开头（Generation Rule 7 + 评估检查）
  - 新增 Step 12：工作流结束后自动生成多风格推荐摘要文档（技术/爆款/活泼/新闻/播客口播/极简一句话，共 11 段）
  - 新增 `assets/recommendation-v1.md` 推荐摘要模板
  - 新增终端消息 19、20
- **0.0.2**（2026-06-03）：代码清理 + 模板迭代
  - 修复 Algolia 字段名错误（`comment_text` → `text`，`story_text` → `text`），1133 条评论全部有内容
  - 移除死代码：`story_text`、`num_comments`、截断警告逻辑
  - `textContent` 字段从 HTML 改为 markdown（与评论内容一致）
  - 文章模板新增读者友好规则：不用用户名、术语解释、背景钩子、段落限制、章节过渡、总结增量价值
  - 评估 prompt 新增 Writing Quality 维度，按组覆盖检查
  - 可读性检查从 5 维度扩展到 8 维度
  - Description 英文触发词从 3 个扩展到多类别覆盖
- **0.0.1**（2026-06-02）：重构为符合 Claude Code skill 规范的结构
  - 添加 YAML frontmatter（`name` + `description` + `version` + `author`）
  - `fetchers/` → `scripts/`，`templates/` → `assets/`，`__tests__/` → `scripts/__tests__/`
  - 配置文件迁出 skill 目录：`hn-digest/config.json` → `~/.hn-digest/config.json`
  - 缓存迁出 skill 目录：`hn-digest/cache/` → `~/.hn-digest/cache/`
  - 抽出 Appendix A（错误处理）和 Appendix B（终端消息）到 `references/`
  - 主 SKILL.md 从 667 行降至 ~560 行（progressive disclosure）
  - 删除 `tsconfig.json`（bun 不需要）和 `package-lock.json`（与 `bun.lock` 重复）
- 之前版本：见 git history

---

详见 [SKILL.md](./SKILL.md) 与 [scripts/README.md](./scripts/README.md)
