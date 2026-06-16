# AI Context Checker

CLI 工具，用于扫描目录结构并验证目标文件（如 CLAUDE.md）的覆盖率、编码、标记配对、内容一致性等。

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
│   ├── modules/              # 17 个功能模块
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
│   │   ├── required-pattern-validator.ts # 必填模式校验
│   │   ├── forbidden-pattern-validator.ts # 禁止模式校验
│   │   ├── content-disk-consistency-checker.ts # 内容-磁盘一致性
│   │   ├── file-change-detector.ts   # 文件变更检测（mtime）
│   │   ├── custom-content-analyzer.ts # 自定义内容分析
│   │   ├── pipeline-orchestrator.ts  # 验证流水线编排
│   │   └── report-generator.ts       # 报告生成（JSON + Markdown）
│   └── utils/
│       └── fs-wrapper.ts     # 可 mock 的文件系统包装
├── tests/
│   ├── types/                # 类型编译测试
│   ├── modules/              # 17 个模块单元测试
│   ├── e2e/                  # 端到端集成测试
│   ├── cli-entry.test.ts     # CLI 入口测试
│   └── fixtures/             # 测试固件
├── docs/                     # 设计文档与规划
│   ├── REQUIREMENTS.md       #   需求规格
│   ├── section*.md           #   模块接口设计（17 个）
│   ├── section4-*.md         #   核心数据结构设计
│   ├── section5-*.md         #   验证流水线流程
│   ├── task-list-impl.md     #   实施任务清单
│   ├── work-plan-report.md   #   实施报告
│   ├── observe-logs/         #   执行日志
│   └── ...                   #   其他设计/交接文档
├── package.json
├── tsconfig.json
├── jest.config.ts
├── .eslintrc.json
└── .npmrc
```

## 验证流水线

每个目录依次执行以下检查，前一步失败则跳过后续：

```
文件存在 → 文件大小 → 编码 → 标记配对 → 模式校验 / 一致性 / 变更检测 / 位置分析 / 自定义内容
```

## 命令

```bash
npm run build    # 编译 TypeScript
npm run test     # 运行测试（串行）
npm run lint     # ESLint 检查
```

## 输出

- **JSON 报告**：完整 CheckResult 结构，含 meta、summary、depth_distribution、marker_position_stats、details
- **Markdown 报告**：人类可读，含汇总表、详细问题列表、mtime 可靠性警告

## 技术栈

- Node.js 18+ / TypeScript 5.x
- Jest + ts-jest（测试）
- ESLint（代码规范）
- 无外部运行时依赖
