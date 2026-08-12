# scripts/

hn-digest 的抓取器（fetcher）代码。每个 fetcher 是一个独立的可执行 TypeScript 脚本，负责把 HN 帖子评论抓下来并输出为统一的 JSON 结构。

两个 fetcher 是同一个目标（"获取 HN 评论"）的两种实现，按优先级 fallback：Algolia → Firebase。（评论链路的 Jina 已移除：完备性优先于可用性，且其 markdown 抓取脆弱；抓"原文"仍用 Jina Reader URL，见 SKILL.md Step 4。）

`preprocess.ts` 不是 fetcher，是 Step 5 的代码驱动过滤器：读 fetcher 产出的 `01-raw-data.json`，确定性过滤后写 `02-filtered.json`（active + outlierPool + outlierBatches）。

`check-coverage.ts`（Step 6.5）和 `insert-header.ts`（Step 10.3）也不是 fetcher：前者确定性校验分组覆盖率，后者把声明段落注入最终文章。

## 用法

每个脚本独立调用：

```bash
bun scripts/algolia.ts <postId>
bun scripts/firebase.ts <postId> [--fetchDepth N] [--maxFetchComments N]
bun scripts/preprocess.ts <01-raw-data.json> [--depth N] [--minReplies N] [--maxComments N]
bun scripts/check-coverage.ts <02-filtered.json> <02-grouped.json>   # Step 6.5 覆盖校验；clean 退出 0
bun scripts/insert-header.ts <target-md> <01-raw-data.json> [zh|en]   # Step 10.3 声明注入；幂等
```

`<postId>` 是 HN 帖子的纯数字 ID（例如 `8863`）。脚本会输出统一 JSON 到 stdout，错误信息到 stderr，退出码 0 表示成功。

## 文件

| 脚本 | 抓取方式 | 输出 |
|------|---------|------|
| `algolia.ts` | HN Algolia Search API (`hn.algolia.com/api/v1/items/<id>`) | 统一 JSON |
| `firebase.ts` | HN Firebase API (`hn.firebaseio.com/v0/item/<id>`)，递归抓取子评论，受 `--fetchDepth` / `--maxFetchComments` 约束 | 统一 JSON |
| `preprocess.ts` | Step 5 代码驱动过滤：读 `01-raw-data.json`，depth → activity → 分层选择；outlier 池 > 60 时分批 | `02-filtered.json` |
| `check-coverage.ts` | Step 6.5 确定性覆盖校验：active 是否全归组、有无跨组重复、有无引用非 active；clean 退出 0 否则 1 | stderr 报告 |
| `insert-header.ts` | Step 10.3 声明注入：读 `01-raw-data.json` 的 `latestCommentAt`/`post.postScore`/`comments.length`，在 H1 后写入单个 `<small>` 段落（disclaimer + 方法论 + 快照）；幂等 | 原地改写目标 .md |
| `lib/utils.ts` | 共享工具函数 | — |
| `lib/filter.ts` | Step 5 过滤实现（`preprocess.ts` 与 `filter.test.ts` 共用同一份） | — |

## 统一 JSON 结构

`algolia.ts` 和 `firebase.ts` 输出此结构。

```typescript
{
  source: "algolia" | "firebase",
  latestCommentAt: string | null,   // 顶层：最新评论的 ISO 8601 UTC 时间，供 insert-header.ts 快照用
  post: {
    id: string,
    title: string,
    author: string,
    url: string | null,
    postScore: number,              // HN 帖子分数，供 insert-header.ts 快照用
    textContent: string | null      // 帖子自身正文（Ask HN 等），无则 null
  },
  comments: [
    {
      id: string,
      author: string,
      parentId: string | null,
      childIds: string[],   // 直接子评论 ID
      depth: number,        // 0 = 顶层
      contentMarkdown: string
    },
    // ...
  ],
  meta?: {
    totalFetched: number,        // 仅 firebase
    skippedDeleted: number,      // 仅 firebase
    skippedDead: number,         // 仅 firebase
    maxDepthReached: boolean,    // 仅 firebase
    maxCommentsReached: boolean, // 仅 firebase；触达 --maxFetchComments 安全帽
    fetchDepth: number,          // 仅 firebase
    maxFetchComments: number     // 仅 firebase
  }
}
```

## lib/utils.ts

共享工具：

| 函数 | 作用 |
|------|------|
| `parsePostId(input)` | 把 URL 或纯数字解析为 postId |
| `htmlToMarkdown(html)` | HTML 转 Markdown（用 `turndown`） |
| `flattenCommentTree(tree)` | 把树状评论结构展平为带 `depth` 的数组 |
| `ensureDir(path)` | 递归创建目录（`fs.mkdir` 的 Promise 包装） |
| `writeJSON(path, data)` | 写 JSON 文件（自动 `JSON.stringify` + 创建父目录） |
| `fetchWithTimeout(url, opts, timeoutMs)` | 带超时的 `fetch`，默认 30s |
| `delay(ms)` | Promise 风格的 sleep |

## lib/filter.ts

Step 5 过滤的实现，`preprocess.ts`（生产）与 `__tests__/filter.test.ts`（测试）共用同一份，无需手工同步：

| 函数 | 作用 |
|------|------|
| `depthTruncate(comments, depth)` | 砍掉超过深度的评论 + 重算 childIds |
| `partitionByActivity(filtered, minReplies)` | 拆分为 active set 与 outlier pool |
| `selectDiverse(active, config, postAuthor, byId)` | 分层选择到 maxComments（OP + 每子树 ≥1 代表 + 热度补齐） |
| `applyFilters(comments, config, postAuthor)` | 上面三步的组合，返回选中的 active 集 |

## 错误处理

每个脚本失败时退出码为 1，stderr 包含错误描述。SKILL.md 的 Step 3 描述了上层（Claude）如何根据错误类型决定 retry / fallback / terminate。

常见错误：
- `Post not found: <id>` → 404
- `HTTP error 429` → rate limit（上层会等待并重试）
- `Fetch error: ...timeout...` → 网络超时
- `Invalid postId: <input>` → 输入非数字

## 测试

测试文件位于 `./__tests__/`：

| 文件 | 测试内容 |
|------|---------|
| `fetchers.test.ts` | 两个 fetcher 的集成测试（需网络，默认 skip） |
| `utils.test.ts` | `lib/utils.ts` 的单元测试（40 个 pass） |
| `error-scenarios.test.ts` | fetcher 在错误场景下的行为（部分需网络） |
| `filter.test.ts` | `lib/filter.ts` 过滤逻辑测试（Step 5） |
| `preprocess.test.ts` | `preprocess.ts` 输出形状 + outlier 分批 + 参数解析 + slim 契约 |
| `check-coverage.test.ts` | `check-coverage.ts` 覆盖校验（clean / missing / duplicate / extra） |
| `insert-header.test.ts` | `insert-header.ts` 声明段落构建 + 注入 + 幂等 + 快照抽取 |
| `grouped-schema.test.ts` | 分组输出 schema 校验（含 standouts author/translation 字段） |
| `e2e-output.test.ts` | 端到端输出测试 |

跑测试（在 skill 根目录）：

```bash
bun test
```

bun 默认递归发现 `*.test.ts`，包括 `scripts/__tests__/`。

## 实现备注

- Algolia `/items/{id}` 端点单请求返回完整评论树，无截断，是主路径（最完备、内存最省）
- Firebase 是递归抓取（一个请求拿一条评论），可拿全量，但请求量大；受 `--fetchDepth`（默认 10）与 `--maxFetchComments`（默认 500）约束，防止超大线程在低内存（2GB）机器上建全树失控或请求超时
- 评论链路的 Jina 已移除；抓"原文"仍走 Jina Reader URL（见 SKILL.md Step 4）
