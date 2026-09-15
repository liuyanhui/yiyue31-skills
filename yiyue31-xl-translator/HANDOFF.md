# HANDOFF：xl-translator skill 开发交接（冷启动文档）

> **本文自足**：读完即可在任何机器继续任务。文末索引仅供可选深查。
> 最后更新：2026-09-15（M3 回写代码改动完成，文档/测试补全待续）。

## 0. 当前状态与你的任务

| 里程碑 | 状态 |
|---|---|
| M1a-M1c + M2 + M3 前置 | ✅ 已提交 |
| M3 试运行 | ✅ 完成（2026-09-11 终检 PASS） |
| **M3 回写代码 B1-B5 / C1-C3** | ✅ **本次提交（全套件绿）** |
| **M3 回写文档 C4-C6 / D1-D2** | ⬜ **当前任务**（见下） |
| M4 验收 → M5 部署 | ⬜ 待回写后 |

**你的任务 = 完成 M3 回写的文档部分**（`docs/m3-writeback-plan.md` 的 C4-C6 + D1-D2），然后按计划删除计划文档。

### 已完成的代码改动（本次提交）

| 项 | 文件 | 要点 |
|---|---|---|
| B1 G3 围栏豁免 | verify-mech.mjs + final-gate.mjs | `fenceAwareAnnotationMatches` 替代 `englishAnnotationMatches` |
| B2 R8-c 最长匹配 | handoff.mjs | `projectionFor` 短词条被长词条覆盖时吸收 |
| B3 锚行紧贴硬判 | verify-mech.mjs | 标题与 `*English*` 锚行间有空行 → FAIL（check 12） |
| B4 keep-list scope | verify-mech.mjs | `scoped` 对象 + `chunkNn` 参数过滤 |
| B5 inline-code waiver | verify-mech.mjs | `parseWaivers` + altered 项 waiver 匹配跳 FAIL 转 WARN |
| C1 标题边界锚定 | status.mjs | `halfSlices` 字节中点附近取最近标题切点（30%-70% 范围内） |
| C2 探针去重 | status.mjs | `buildQueue` 探针报告 sha 与文本相符即不入队 |
| C3 view/dispatch 拆分 | status.mjs | 默认零副作用；仅 `verb: "dispatch"` 时物化+事件 |

### 待完成的文档改动

| 项 | 改什么 |
|---|---|
| C4 派发口径模板 | SKILL.md Step 6 编排注记：staging 总行数 + 起止标题 + 节名枚举 + 派发前 grep 核对 |
| C5 跨维回核规则 | SKILL.md Step 7 增规则：采纳非 accuracy 维结构性改写后回核数字/比例/极性 |
| C6 括注 doctrine | adjudicate-prompt.md：首现窗口关闭后当前 chunk 唯一处补注一次合规 |
| B1 配套 | adjudicate-prompt.md 兜底扫描条款改为"围栏内不改不记" |
| D1 环境处置模板 | SKILL.md 编排注记：429[1302] 即补 / 429[1308] 等窗 / 并发 ≤5 两波制 / 流停滞核验后重派 |
| D2 版本与裁决回写 | SKILL.md 升 v0.3.2；DESIGN §6 补 M3 行 + §9 裁决补登；删计划文档 |

## 1. 两个仓库

| 仓库 | 内容 |
|---|---|
| **本仓库** | skill 本体 |
| **运行仓库**（refined-stock） | M3 试运行语料与产物（标定记录 + 交付物） |

## 2. 冷启动步骤

1. `git pull` 两仓库
2. 读本文档 → 读 `docs/m3-writeback-plan.md`（仍有未完成的 C4-C6/D1-D2）
3. 按上表"待完成"实施文档改动
4. 完成后删除计划文档（要义入 DESIGN §6 与提交信息）
5. `bash scripts/test/run.sh` 全绿为准
6. Commit + push

## 3. 环境注意

- **Windows Git Bash 下 node -e 内联脚本转义不可靠** → 非平凡脚本写临时 .mjs
- ESM 绝对路径导入须 `file:///D:/...` URL
- subagent 可用；测试串行 `bash scripts/test/run.sh`
- 429[1302] 突发→即补派；429[1308] 配额→定时等窗；并发 ≤5 两波制
- `agent`（AI 义）译"智能体"、`token`（AI 义）译"词元"

## 4. 可选深查索引

| 文件 | 用途 |
|---|---|
| `docs/m3-writeback-plan.md` | 当前任务计划（C4-C6/D1-D2 待完成） |
| 运行仓库 `xl-translator/m3-outbox/M3-标定记录.md` | M3 全程时间线（回写取证权威） |
| `DESIGN.md` v2 | 各步权威规格、冻结契约、里程碑、裁决全录 |
| `SKILL.md` v0.3.1 | 五步流水线（D2 将升 v0.3.2） |
