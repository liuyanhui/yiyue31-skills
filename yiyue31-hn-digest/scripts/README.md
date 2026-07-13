# scripts/

hn-digest 的抓取器（fetcher）代码。每个 fetcher 是一个独立的可执行 TypeScript 脚本，负责把 HN 帖子评论抓下来并输出为统一的 JSON 结构。

三个 fetcher 是同一个目标（"获取 HN 评论"）的三种实现，按优先级 fallback：Algolia → Firebase → Jina。

## 用法

每个脚本独立调用：

```bash
bun scripts/algolia.ts <postId>
bun scripts/firebase.ts <postId>
bun scripts/jina.ts <postId>
```

`<postId>` 是 HN 帖子的纯数字 ID（例如 `8863`）。脚本会输出统一 JSON 到 stdout，错误信息到 stderr，退出码 0 表示成功。

## 文件

| 脚本 | 抓取方式 | 输出 |
|------|---------|------|
| `algolia.ts` | HN Algolia Search API (`hn.algolia.com/api/v1/items/<id>`) | 统一 JSON |
| `firebase.ts` | HN Firebase API (`hn.firebaseio.com/v0/item/<id>`)，递归抓取所有子评论 | 统一 JSON |
| `jina.ts` | Jina Reader (`r.jina.ai/{hn-url}`)，把 HN 网页转 Markdown | Markdown 文本（非 JSON，需 AI 后处理） |
| `lib/utils.ts` | 共享工具函数 | — |

## 统一 JSON 结构

`algolia.ts` 和 `firebase.ts` 输出此结构。`jina.ts` 输出原始 Markdown，由 SKILL.md Step 3 Method 3 描述的 AI 正规化流程转换为这个结构。

```typescript
{
  source: "algolia" | "firebase",
  post: {
    id: string,
    title: string,
    author: string,
    url: string | null,
    // ...其他元数据
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
    maxDepthReached: boolean     // 仅 firebase
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
| `fetchers.test.ts` | 三个 fetcher 的集成测试（需网络，默认 skip） |
| `jina-integration.test.ts` | Jina 特定集成测试（需网络，默认 skip） |
| `utils.test.ts` | `lib/utils.ts` 的单元测试（40 个 pass） |
| `error-scenarios.test.ts` | fetcher 在错误场景下的行为（部分需网络） |
| `filter.test.ts` | 过滤管道的镜像实现测试（与 SKILL.md Step 5 对齐） |
| `grouped-schema.test.ts` | 分组输出 schema 校验 |
| `e2e-output.test.ts` | 端到端输出测试 |

跑测试（在 skill 根目录）：

```bash
bun test
```

bun 默认递归发现 `*.test.ts`，包括 `scripts/__tests__/`。

## 实现备注

- Algolia `/items/{id}` 端点返回完整评论树，无截断
- Firebase 是递归抓取（一个请求拿一条评论，再并发抓所有子评论），可以拿到全量数据，但请求量大
- Jina Reader 不返回 JSON，而是把整个 HN 页面转 Markdown，输出格式依赖 HN 的 HTML 结构，相对脆弱
- 主备用 URL：`r.jina.ai` → `r.jinaai.cn`（国内镜像，`jina.ts` 在主 URL 失败时自动切换）
