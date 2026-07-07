# AI Context Checker

CLI 工具，用于扫描目录结构并验证目标文件（如 CLAUDE.md）的覆盖率、编码、标记配对、段名白名单、内容一致性等。配套 yiyue31-context skill 使用。

## 快速开始

```bash
npm install
npm run build
node dist/index.js --target <目录路径>
```

## CLI 参数

| 参数 | 短选项 | 类型 | 必填 | 默认值 | 说明 |
|------|--------|------|------|--------|------|
| `--target` | `-t` | string | 是 | — | 扫描目标目录 |
| `--exclude` | `-e` | string[] | 否 | `[]` | 排除的目录名（逗号分隔，可重复） |
| `--include` | `-i` | string[] | 否 | `[]` | 强制包含的目录名 |
| `--filename` | `-f` | string | 否 | `CLAUDE.md` | 目标文件名 |
| `--config` | `-c` | string | 否 | — | 配置文件路径（JSON） |
| `--help` | `-h` | — | 否 | — | 显示帮助信息 |

## 项目结构

```
scripts/
├── src/
│   ├── index.ts              # 入口
│   ├── cli.ts                # CLI 编排（run 函数）
│   ├── types/                # TypeScript 类型定义
│   │   ├── config.ts         #   CheckConfig, CliArgs, MarkerConfig 等
│   │   ├── report.ts         #   FileReport, CheckResult, ReportDetails 等
│   │   ├── enums.ts          #   MarkerIssueIdentifier 等
│   │   ├── validation.ts     #   ValidationResult, PipelineResult 等 + 错误类
│   │   └── index.ts          #   桶导出
│   ├── modules/              # 19 个功能模块
│   │   ├── cli-parser.ts             # CLI 参数解析
│   │   ├── config-merger.ts          # 配置合并（CLI + 文件 + 默认值）
│   │   ├── input-validator.ts        # 输入校验（10 项前置条件）
│   │   ├── directory-scanner.ts      # 递归目录扫描
│   │   ├── directory-depth-distributor.ts  # 深度分布统计
│   │   ├── file-existence-checker.ts # 文件存在性检查
│   │   ├── file-size-validator.ts    # 文件大小校验
│   │   ├── file-encoding-validator.ts # 编码校验（UTF-8）
│   │   ├── paired-marker-validator.ts # 标记对校验（5 条规则）
│   │   ├── marker-position-analyzer.ts   # 标记位置分析（head/middle/tail）
│   │   ├── marker-matcher.ts     # marker 弹性匹配（前缀+属性，v0.0.2）
│   │   ├── required-pattern-validator.ts # 必填模式校验
│   │   ├── forbidden-pattern-validator.ts # 禁止模式校验
│   │   ├── allowed-section-validator.ts  # 自适应段名校验（六段白名单，v0.0.2 新增）
│   │   ├── content-disk-consistency-checker.ts # 内容-磁盘一致性
│   │   ├── file-change-detector.ts   # 文件变更检测（mtime）
│   │   ├── custom-content-analyzer.ts # 自定义内容分析
│   │   ├── pipeline-orchestrator.ts  # 验证流水线编排
│   │   └── report-generator.ts       # 报告生成（JSON + Markdown）
│   └── utils/
│       └── fs-wrapper.ts     # 可 mock 的文件系统包装
├── tests/
│   ├── types/                # 类型编译测试
│   ├── modules/              # 19 个模块单元测试
│   ├── e2e/                  # 端到端集成测试
│   ├── cli-entry.test.ts     # CLI 入口测试
│   └── fixtures/             # 测试固件
├── docs/                     # 设计文档与规划
│   ├── REQUIREMENTS.md       #   需求规格
│   └── DESIGN_DEFERRED.md    #   设计遗留疑问
├── package.json
├── tsconfig.json
├── jest.config.ts
├── .eslintrc.json
└── .npmrc
```

## 验证流水线

每个目录依次执行以下检查，前一步失败则跳过后续：

```
文件存在 → 文件大小 → 编码 → 手写文件判定(report-only) → 标记配对 → 模式校验 / 段名校验 / 一致性 / 变更检测 / 位置分析 / 自定义内容
```

## v0.0.2 新增/变更校验

随 yiyue31-context skill 改为"修改上下文"模板（六段自适应），checker 同步以下行为：

- **手写文件 report-only**：既无 `# AI Coding Auto Sections` 标题、又无任何 marker 的 CLAUDE.md，视为人工维护文件，`passed=true` 且跳过标记校验（不报缺段/缺 marker 错误）。带标题或带任意 marker 的文件仍走正常配对校验，残缺配对仍判失败。
- **段名白名单（自适应）**：marker 块内的每个 `## ` 段名必须属于 `allowed_section_names`（默认六段中英文名集合）。**自适应**：文件不必含全部六段，空段允许跳过；只标记"出现但不在白名单"的段名。marker 块之外的标题（如人工 `## 雷区` 段）不检查。空数组关闭该校验。
- **新输出字段**：`details.disallowed_sections` 列出段名越界的文件及其标题。

配置项 `allowed_section_names` 在 `DEFAULT_CONFIG` 中给出六段默认值，可通过 `--config` JSON 覆盖。

> marker 弹性匹配（v0.0.2）：checker 默认 marker 为简单形式 `<!-- skill: yiyue31-context -->`，但 skill 实际写带 version 的 `<!-- skill: yiyue31-context | version: 0.0.2 | ... -->`。`marker-matcher` 按稳定前缀 + 允许 `| 属性` + `-->` 匹配，两种形式都能识别（真实 skill 产出不再被判缺 marker；staleness 也能正确读取 `update_time`）。

## 命令

```bash
npm run build    # 编译 TypeScript
npm run test     # 运行测试（串行）
npm run lint     # ESLint 检查
```

## 输出

- **JSON 报告**：完整 CheckResult 结构，含 meta、summary、depth_distribution、marker_position_stats、details（含 disallowed_sections 等）
- **Markdown 报告**：人类可读，含汇总表、详细问题列表、mtime 可靠性警告

## 技术栈

- Node.js 18+ / TypeScript 5.x
- Jest + ts-jest（测试）
- ESLint（代码规范）
- 无外部运行时依赖
