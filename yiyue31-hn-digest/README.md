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
| `--depth N` | 5 | 分析保留的评论树深度（1–10），Step 5 过滤用 |
| `--minReplies N` | 3 | 单条评论最少需要的子评论数 |
| `--maxComments N` | 80 | 入选评论上限（5–150） |
| `--fetchDepth N` | 10 | Firebase 抓取深度（1–15），仅在 Algolia 失败时生效 |
| `--maxFetchComments N` | 500 | Firebase 抓取评论数安全帽（1–2000，2GB / 时间防护） |
| `--lang zh\|en` | `zh` | 输出文章语言 |
| `--outputDir path` | `hn-digest/` | 输出目录 |
| `--with-original` | 关 | 同时抓取原文链接内容作为背景 |
| `--groupBy topic,stance` | `topic,stance` | 分组维度 |
| `--sort-groups relevance\|engagement` | `relevance` | 分组排序方式 |
| `--templateVersion v1` | `v1` | 模板版本 |

## 工作流程

1. 解析输入 → 2. 加载配置 → 3. 抓取数据 → 4. 准备输出并校验 → 5. 过滤评论 → 6. 分组 → 7. 生成文章（最多 3 轮 generate-evaluate）→ 8. AI 语气检查 → 9. 翻译腔检查（条件）→ 10. 可读性检查 + 读者审计 + 最终输出（注入声明）→ 11. 推荐摘要 → `final-*.md`（注入后交付件）+ `recommendation-*.md`

主流程见 [SKILL.md](./SKILL.md)。

## 输出

每个帖子在 `{outputDir}/{postId}-{slug}/` 下生成（`outputDir` 默认 `hn-digest/`，项目级配置见运行时数据节）：

```
01-raw-data.json              # 原始统一 JSON（顶层含 latestCommentAt；post 含 postScore）
02-filtered.json              # Step 5 过滤结果（active + outlierPool + outlierBatches，精简索引无正文）
02-grouped.json               # 分组结果
03-article.md                 # 定稿文章（注入声明前）
final-{slug}-{postId}.md      # 最终交付：03-article.md 经 insert-header.ts 在 H1 后注入声明段落（disclaimer + 方法论 + 快照：时间戳/分数/评论数）
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
├── scripts/                  # 抓取器与预处理（详见 scripts/README.md）
│   ├── algolia.ts
│   ├── firebase.ts
│   ├── preprocess.ts         # Step 5 代码驱动过滤 + outlier 分批
│   ├── check-coverage.ts     # Step 6.5 覆盖校验
│   ├── insert-header.ts      # Step 10.3 声明注入
│   ├── README.md             # scripts/ 详细文档
│   ├── lib/utils.ts
│   ├── lib/filter.ts         # Step 5 过滤实现（共享）
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
```

> 运行时数据（写在项目根 / 运行目录，不在 skill 目录里）：`hn-digest.config.json`（项目级配置，手动创建，不自动生成以避免冻结旧默认值）、`hn-digest/`（产物输出目录，含各 `{postId}-{slug}/` 子目录）。

## 依赖

- [Bun](https://bun.sh/) 运行时（执行抓取脚本与测试）
- `turndown`（HTML → Markdown，已在 `package.json` 中）
- Jina Reader：`https://r.jina.ai`，备用 `https://r.jinaai.cn`（仅用于 Step 4 抓原文；评论链路不再使用）
- 目标机器 2GB 内存：LLM 推理在服务端不占本地内存，本地仅 bun 脚本处理 JSON；Firebase 抓取受 `--maxFetchComments` 约束，防超大线程建全树 OOM

## 测试

```bash
bun test
```

当前规模：9 个测试文件，120 个 pass / 5 个 skip（需网络的集成测试） / 0 个 fail。

## 设计决策

架构与设计决策见 [SKILL.md](./SKILL.md) 顶部（主 agent 执行全流程 + 只读评估 subagent；抓取脚本是可执行 TypeScript，可单独 `bun scripts/algolia.ts <postId>` 调试）。

## Changelog

- **0.2.7**（2026-08-12）：声明整合 + 标题/小标题统一 + 意外之声收敛（在 0.2.6 基线上重落此前被并发覆盖的改动）
  - 声明：`insert-header.ts` 在 H1 后注入**单个** `<small>` 段落（disclaimer + 方法论/中立性 + 快照：时间戳/分数/评论数）；**删除文末 coverage note**（与开头重复）；SKILL 10.3 描述同步
  - 标题：H1 前缀 `[Hacker News]` → `[HN]`；zh 文章 H1 改 post.title 中文译名 + 原标题 small 行
  - 小标题：全部**单语**（跟随 config.lang），不再双语并列（修 SKILL.md 与模板/评估 prompt 的规范自相矛盾）
  - 意外之声：单节，英文 `Standout takes` → **Surprising takes**；候选源 **outlierPool 优先**（active 仅罕见例外，不复述正文）；加硬意外门槛 + 不足 2 条输出空并省略；渲染沿用 0.2.6 的"源语言原话 + 作者/翻译/入选原因"标签，并**修正字段间空 `>` 行**（0.2.6 的连续 `>` 行在 HTML 仍会塌成一行）
  - 原因：0.2.6 在另一台机器未及时 push，导致本机 0.2.6 基于过时基线、rebase 后 1-5 点被整文件覆盖；本次在 0.2.6 之上重新落回，并合并两版 standout 设计（保留 0.2.6 的 schema 扩字段与标签格式 + 采用本机商定的改名/选材门槛/空行修正）
- **0.2.6**（2026-08-05）：「意外之声」四段式 + 公式 LaTeX 化
  - 「意外之声 / Standout takes」每条改为：blockquote 引评论**源语言原话（不翻译 quote；zh 文章也引英文原话）** + 三行标签 **作者 / 翻译 / 入选原因**（「为何意外」改名「入选原因」；zh 模式带翻译，源语言 = config.lang 时省略翻译行）—— 根除此前 49085698 引中文、49089755 引英文的中英混用
  - `02-grouped.json` `standouts` schema 扩字段：`{ commentId, author, quote, translation?, reason }`（quote 始终源语言原话；translation 在源 ≠ config.lang 时必填）
  - 公式改 LaTeX 渲染：行间 `$$...$$`、行内 `$...$`，禁止纯散文丢下标（如 `$S_t = S_{t-1} + \beta_t(v_t - S_{t-1}k_t)k_t^T$`）；HTML 发布端加 MathJax/KaTeX 脚本渲染
  - 原因：用户指出「意外之声」引用语言不一致、缺作者/翻译、公式退化；统一为「原文 + 作者 + 翻译 + 入选原因」，公式专业化（LaTeX + MathJax）
- **0.2.5**（2026-08-03）：02-filtered 瘦身（去 contentMarkdown，正文按 id 从 01 join）
  - `preprocess.ts`：`slim()` 从 active/outlierPool 输出中剥离 `contentMarkdown`——`02-filtered.json` 变成精简索引（id/author/parentId/childIds/depth/isOP），不再重复正文（每条 body 是 `01-raw-data.json` 的逐字副本，约占单条 90%）
  - SKILL.md Step 5/6/7：需要评论正文时按 id 从 `01-raw-data.json` join（6.4 standout 与 Step 7 生成）
  - `filter.ts` / `check-coverage.ts` 不变（过滤从不读 contentMarkdown）
  - `preprocess.test.ts`：新增 slim 契约断言（outlierPool + 带子树 active 路径）
  - 原因：`02-filtered.json` 与 `01-raw-data.json` 正文逐字重复，是死重；瘦身为只留索引，正文单一来源
- **0.2.4**（2026-07-29）：移除正文每节覆盖标记，改为文末单句覆盖说明
  - 去掉每个 `###` 小节 / roundup 项末尾的 `（N / M 条）` 比值标记——该比值是内部覆盖指标，读者无法解读，且与编辑型正文语体冲突
  - 改为文末（`## 参考资料` 之后）一行 `<small>` 覆盖说明：`本摘要基于该 Hacker News 帖子的 {inputCount} 条评论，按"回复数与讨论深度"选取 {activeCount} 条代表性观点归纳，不同立场的比重反映其在原讨论中的份量，而非编辑倾向。`（计数取自 `02-filtered.json` `meta`，跟随 config.lang）
  - 只讲筛选原则，不暴露原始参数（depth / minReplies / maxComments）
  - 原因：标记是操作者/QA 的覆盖审计产物，原样搬进读者文档造成语体割裂与歧义；文末单句既给规模感又化解"是否 cherry-pick"的疑虑，覆盖审计仍由 `check-coverage.ts` 保障
- **0.2.3**（2026-07-29）：分组强制全覆盖 + 兜底组 + 确定性覆盖校验
  - SKILL.md Step 6：6.1 改为"每条 active 必归且仅归一组 + 不归主题的进兜底组 `其他观点`"(dimension topic),不再丢弃;overflow 合并改为并集 `commentIds` 不丢;新增 6.5 强制跑 `check-coverage.ts` 直到 clean 才进 Step 7
  - Step 7：兜底组 `其他观点` 只做简短 roundup 或并入 `## 要点`,不作正文主角小节(仍带 marker)
  - 新增 `scripts/check-coverage.ts`：确定性校验 active 是否全归组、有无跨组重复、有无引用非 active;clean 退出 0 否则 1;导出纯函数 `checkCoverage` 供单测
  - 新增 `scripts/__tests__/check-coverage.test.ts`：clean / 父组+同组子组非重复 / missing / duplicate / extra
  - 原因：诊断发现分组只归 depth 0-1 共 28 条,把全部 depth ≥2 丢弃,致文章分母 M 卡在 ~30,与 maxComments 无关;强制全覆盖 + 兜底组 + 校验三管齐下根治,校验脚本已在 49076057 产物上复现(52 missing + 1 duplicate)
- **0.2.2**（2026-07-29）：config 从全局 homedir 迁到项目内 + 消除默认值快照陷阱
  - SKILL.md Step 2：config 路径 `{homedir}/.hn-digest/config.json` → `{cwd}/hn-digest.config.json`（项目根，独立于 outputDir）；首次运行不再写默认值快照（文件缺失即用默认值、不创建文件）；新增运行时打印生效配置 + 来源；废弃全局 `~/.hn-digest/config.json`（不再读取，可删）
  - 优先级：`CLI args > config.json > defaults` → `CLI args > hn-digest.config.json > defaults`
  - 原因：全局 config 在首次运行时快照了旧默认值（depth=2, maxComments=30），后来默认值改 5/80 后被静默盖过，导致 `（N / 30 条）` 仍为 30；迁项目内 + 不快照 + 打印三处一并根治
- **0.2.1**（2026-07-28）：评估完善 + 文档精简（subagent 评审跟进）
  - SKILL.md：Step 6 显式写 `02-grouped.json`；`active` 空 / outlier 非空 边界；Step 9 采样明确取 `active`；"terminate silently" 改明确报错；架构说明单数→复数；删 Jina 移除史 / 2GB note / 重复 2GB 短语 / 7.7 marker 复述 / 6.4 忠实度句 / Algolia 注（C1/C2/C4/C5/C6 + T1–T6）
  - evaluate-article-prompt.md：D3 加 References check + 语种一致性 check；D5 加原文引用 check；**空话双扣修复**——空话统一交 AI Tone Check、D5 不再扣；D1/D4 fabrication 划清观点/事实不双扣；D3/D5 锚点映射 major/minor 严重度；输出格式矛盾修正；D2 删复述；Heat marker check 拆行（P1/P2/P3/P4/P5/P6/P7 + S1/S2/S5）
  - reader-audit-prompt.md：AI Tone Check 引用 Step 9 → Step 8（C3）
- **0.2.0**（2026-07-28）：Step 5 过滤改代码驱动 + standout map-reduce
  - 新增 `scripts/preprocess.ts`：读 `01-raw-data.json` 跑确定性过滤（depth → activity → 分层选择），输出 `02-filtered.json`（active + outlierPool + outlierBatches）
  - 过滤逻辑抽到共享 `scripts/lib/filter.ts`；`filter.test.ts` 由"镜像参考实现"改为测真·实现，消除手工同步
  - outlier 池 > 60 时预分批（~40/批），standout pass 走 map-reduce（每批选候选 → 合并定 2–4），防单次 LLM 调用超上下文
  - SKILL.md Step 5 改为调用 preprocess.ts；Step 6 读 `02-filtered.json`
  - 2GB：单次读小 JSON 文本（<1MB），无需流式
  - 原因：用户第 2 点要"程序辅助预处理/预分组"突破上下文上限；代码驱动让过滤确定性可测，分批让大线程 standout 不超上下文
- **0.1.0**（2026-07-28）：数据覆盖 + 双轨产物重构
  - 抓取：移除评论链路的 Jina（完备性优先于可用性），方法链改 Algolia → Firebase；`firebase.ts` 抓取深度配置化（`--fetchDepth`，默认 10）并加 `--maxFetchComments` 安全帽（默认 500，2GB 防护）；保留 Step 4 抓原文的 Jina Reader URL
  - 过滤：Step 5 由"纯热度 top-N"改为多样性分层选择（OP + 每子树 ≥1 代表 + 热度补齐），低回复的离群评论保留供 standout 挑选；`maxComments` 默认 30→80（上限 150）、`depth` 默认 2→5（上限 10）
  - 产物：新增 standout 判定 pass，文章加跨类型 `## 意外之声 / Standout takes` 小节（冷门/离谱轨，与热点反差，提升趣味）；`02-grouped.json` 加 `standouts` 字段
  - 标记：`（精选 N 条）` 改为 `（N / M 条）` 比值（M = digest 实际分组的评论总数），消除"精选"措辞歧义
  - 原因：digest 原本只分析 ≤30 条热评，既丢冷门观点又让标记分母含义模糊；扩覆盖 + 双轨 + 比值标记一并解决。超大线程（500+）的 map-reduce 留待后续
- **0.0.11**（2026-07-27）：正文可见热度标记
  - 每个 `###` 小节和 roundup 项末尾追加 `（精选 N 条）` / `(N selected comments)`（N = 该小节映射到的 `02-grouped.json` 分组去重评论数）；H1/背景/争议点/总结/参考资料不加
  - 原因：正文按编辑判断排序而非纯热度（relevance 优于 engagement），但热度对读者不可见；标记让读者看见讨论热度，同时不动排序
  - 边界：标记是已按热度筛选后的精选评论数，非全帖评论数，用「精选/selected」字样避免在千楼帖里被误读为「只有 N 人讨论」
- **0.0.10**（2026-07-13）：移除抓取缓存，每次运行重新抓取
  - 删除 SKILL.md Step 3（Check Cache），原 Step 4-12 重编号为 3-11；主流程不再读写 `~/.hn-digest/cache/`（抓取脚本本就只往 stdout 输出，未改动）
  - 原因：缓存与"反复迭代生成"工作流冲突，增量合并在兜底抓取方式上也不省力；改为每次全量抓取，新鲜度优先，代价是每次联网（已确认接受）
  - 测试：删除 error-scenarios Scenario 3（缓存损坏校验），其余场景重编号；e2e `.skip` 块去掉 cache 措辞
  - README 目录树与流程图同步去掉 cache/；`.gitignore` 删除 `cache/`
- **0.0.9**（2026-07-10）：zh 文章的 OP 标记由 [OP] 改为 [楼主]
  - SKILL.md Generation Rule：zh 用 `> **[楼主]** `，en 仍用 `> **[OP]** `，marker 跟随 `config.lang`，避免 zh 文章里出现未翻译的 [OP]
  - `evaluate-article-prompt.md` 与 `e2e-output.test.ts` 的 OP 高亮校验同步覆盖 [楼主]/[OP]
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
