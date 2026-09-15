# HANDOFF：xl-translator skill 开发交接（冷启动文档）

> **本文自足**：读完即可在任何机器继续任务。文末索引仅供可选深查。
> 最后更新：2026-09-15（M3 回写全部完成，M3 收口）。

## 0. 当前状态与你的任务

| 里程碑 | 状态 |
|---|---|
| M1a-M1c + M2 + M3 前置 | ✅ 已提交 |
| M3 试运行 + 回写 | ✅ **本次提交收口** |
| **M4 全量验收** | ⬜ **下一步**（见 DESIGN §6） |
| M5 部署收尾 | ⬜ 最后 |

**你的任务 = M4 全量验收**：playbook 重跑（验证回写后的 skill 修改在真实语料上工作）+ 验收 10 条 + 红队 4 场景 + 中断续跑演练 + 上下文溢出/compact 恢复实测 + 限流退避演练 + 中途 SessionEnd 演练 + "用户 12 小时不在场"场景。详见 DESIGN §6 M4 行。

## 1. M3 回写完成内容（SKILL.md v0.3.2 + 全套件绿）

### 代码改动（8 项）

| 项 | 文件 | 要点 |
|---|---|---|
| B1 G3 围栏豁免 | verify-mech + final-gate | `fenceAwareAnnotationMatches` |
| B2 R8-c 最长匹配 | handoff | `projectionFor` 短被长吸收 |
| B3 锚行紧贴硬判 | verify-mech | 标题锚行间空行 → FAIL |
| B4 keep-list scope | verify-mech | `scoped` 对象 + `chunkNn` 过滤 |
| B5 inline-code waiver | verify-mech | `parseWaivers` + 豁免转 WARN |
| C1 标题边界锚定 | status | `halfSlices` 标题切点（30%-70%） |
| C2 探针去重 | status | fresh 探针不入队 |
| C3 view/dispatch 拆分 | status | 默认零副作用；dispatch 才物化 |

### 文档改动（6 项）

| 项 | 文件 | 要点 |
|---|---|---|
| C4 派发口径模板 | SKILL.md Step 6 | 行数+起止标题+节名枚举+grep 核对 |
| C5 跨维回核规则 | SKILL.md Step 7 | 采纳非 accuracy 结构性改写后回核数字/比例/极性 |
| C6 括注 doctrine | adjudicate-prompt.md | 首现窗口关闭后补注一次合规；终裁分歧登记不翻转 |
| B1 配套 | adjudicate-prompt.md | 兜底扫描围栏内不改不记 |
| D1 环境处置模板 | SKILL.md 横切 | 429[1302] 即补 / [1308] 等窗 / ≤5 两波 / 流停滞核验后重派 |
| D2 版本与裁决回写 | SKILL.md v0.3.2 + DESIGN §6 M3 行 | 计划文档已删（要义入 DESIGN） |

## 2. 两个仓库

| 仓库 | 内容 |
|---|---|
| **本仓库** | skill 本体 |
| **运行仓库**（refined-stock） | M3 试运行语料与产物（标定记录 + 交付物） |

## 3. 冷启动步骤

1. `git pull` 两仓库
2. 读本文档 → 读 DESIGN §6 M4 行（验收范围与判据）
3. 执行 M4 验收
4. Commit + push

## 4. 环境注意

- **node -e 内联脚本转义不可靠**（Git Bash）→ 非平凡脚本写临时 .mjs
- ESM 绝对路径导入须 `file:///D:/...` URL
- subagent 可用；测试串行 `bash scripts/test/run.sh`
- API 限流处置见 SKILL.md D1 模板
- `agent`（AI 义）译"智能体"、`token`（AI 义）译"词元"

## 5. 可选深查索引

| 文件 | 用途 |
|---|---|
| `DESIGN.md` v2 §6 M4 行 | 下一步验收范围 |
| 运行仓库 `xl-translator/m3-outbox/M3-标定记录.md` | M3 全程时间线 |
| `SKILL.md` v0.3.2 | 五步流水线（含 M3 回写全部规则） |
| `scripts/test/run.sh` | 测试串行入口 |
