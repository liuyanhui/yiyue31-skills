# 测试套件（scripts/test/）

xl-translator 脚本层的统一测试目录，与源码分离（源码在 `scripts/<模块>.mjs` 与 `scripts/segment/`），随 git 管理。

## 目录结构

```
scripts/test/
├── run.sh                          # 统一入口：逐文件严格串行跑全部测试
├── README.md                       # 本文件
├── unit/                           # 单元层：程序化合成夹具（确定性，不落盘），钉死算法行为
│   ├── segment.test.mjs            #   分段算法：fence 感知/拼接 sha/落带/R11-B/产物/CLI
│   └── verify-mech.test.mjs        #   机械校验：原五+新四硬判、fork 源对照、CLI 冒烟
└── regression/                     # 回归层：git 管理的真实文档夹具，钉死真实世界回归
    ├── segment.regression.test.mjs
    └── fixtures/
        ├── single/  single-NN.md   # 无需切割（总长 ≤ max，单 chunk 是正确形态）
        ├── few/     few-NN.md      # 切成 2-10 个 chunk
        └── many/    many-NN.md     # 切成 ≥11 个 chunk
```

## 怎么跑

```bash
bash scripts/test/run.sh                    # 全部（推荐，逐文件串行）
node --test scripts/test/unit/segment.test.mjs          # 单跑一个文件
node --test scripts/test/regression/segment.regression.test.mjs
```

**串行纪律**：不用 `node --test <目录>`（多文件并行起进程，1.87GB 内存机器 OOM 风险）；单文件内部 node:test 默认串行，一次一个文件即全程串行。

## 两层分工

| | unit/ | regression/ |
|---|---|---|
| 夹具 | 程序化合成，跑时生成进临时目录 | **真实文档，git 版本化**（换真料不换标准） |
| 钉什么 | 算法行为（边界条件、病态输入、关卡退出码） | 真实世界回归（真实标题结构/围栏/表格） |
| 为什么 | 合成样例可精确构造病灶 | 旧 doc_segmenter 的事故（64KB→56 碎片、围栏内 `#` 误判标题）只发生在真实文档上 |

## 回归夹具契约（可替换 / 可增补，评估标准不变）

- **命名**：`<类>-<NN>.md`，NN 两位连续编号；测试按目录自动发现，**新增文档零改码**。
- **替换**：同名覆盖即替换（文件名固定，方便后续换新料）；替换后必须仍满足所在类的角色判据，否则测试 FAIL 提示放错类。
- **增补**：往对应类别目录加 `<类>-<NN>.md` 即被自动纳入。
- **来源**：全部为真实单篇文档（不拼接、不改写内容），当前取样：

| 夹具 | 来源 | 大小 | 角色 |
|---|---|---|---|
| single-01.md | 6-months-to-live-for-open-models | 10.7KB | 单 chunk |
| single-02.md | compaction-in-pi | 7.3KB | 单 chunk |
| few-01.md | **AI-Native-SDLC-playbook（53 碎片事故原文，Yiyue 指定反例）** | 64KB | 5 chunk（旧方案同文 56 碎片） |
| few-02.md | abc-legal-builder-agents | 16.1KB | 2 chunk（刚过 max 的边界例） |
| many-01.md | harness-v2 | 233.5KB | 23 chunk（含 1 个结构性不可合并尾块） |

## 固定评估标准（S1-S8，结构性判据，与具体文档无关）

回归层对每篇夹具套用同一套标准——**换文档、加文档，标准不变**：

| # | 判据 | 防什么 |
|---|---|---|
| S1 | 关卡退出码 = 0（含拼接 sha === 原文 sha 硬关卡） | 任何路径静默失败 |
| S2 | 测试独立复读全部 chunk 按 NN 序拼接，字节级 === 归一化原文 | 偷删/改写分母（只信 run 内部关卡 = 既当运动员又当裁判） |
| S3 | 命名全部匹配 `chunk-<NN>[X]-<slug>.md`，NN 从 01 连续无跳号 | 命名漂移破坏 status/final-gate 的 glob 分辨规则 |
| S4 | 磁盘 chunk 数 === manifest 表 === progress.total_chunks，两产物存在 | 产物间不一致 |
| S5 | 非原子 chunk ≤ max（15KB）；原子 X 免（超限即其形态，R11-B） | 散文超限（审校半块甜点区被破坏） |
| S6 | 非原子 chunk ≥ min（8KB）；唯一豁免 = 末 chunk 且并入前包超 max（结构性不可合并） | **碎片病**（旧方案 66 字节 chunk 的直接死因） |
| S7 | 数量角色：single = 1；few ∈ [2,10]；many ≥ 11 | 类别判据 + 粗粒度总量回归 |
| S8 | chunk 数 ≤ ⌈总字节 / min⌉ | 整体碎片化回归（数量上界兜底） |

S6/S8 的豁免与上界都是**结构性**的（由贪心装包 + 尾块回收的算法性质决定），不是对某篇文档调出来的魔法数——所以标准可以固定不变。

## 维护规约

1. 新脚本的测试进对应层：算法行为 → `unit/<模块>.test.mjs`；真实文档回归 → `regression/<模块>.regression.test.mjs`（夹具放 `regression/fixtures/`，如需新类别目录按 `<类>/<类>-NN.md` 命名）。
2. 夹具是**数据不是代码**：不改写内容；真实事故原文优先（回归价值最高）。
3. 评估标准修改 = 设计变更，须先改 DESIGN 再动测试（防"改标准凑通过"）。
4. 本目录是开发期资产，不属 SKILL.md §5.2 引用封闭集（该集合只管运行时引用文件）。
