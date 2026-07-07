# Subagent 派发卡顿事故分析与改进

记录日期：2026-07-07
发生场景：用 yiyue31-orchestrator 执行 yiyue31-context 重构计划的 T-03（更新 checker）时，Generator subagent 派发后超过 40 分钟无返回，被用户中断。

## 事故经过

- T-01（重写 SKILL.md）、T-02（在 appendo data/ 上模拟模板）的 Generator/Evaluator subagent 都正常快速返回。
- T-03（更新 checker：grep 判断硬编码/配置、改模块或配置、实现 no-marker 非失败、加测试、跑 build+test）的 Generator subagent 派发后挂起，40 分钟无返回。
- 被中断后检查：subagent 其实做了不少活（改 5 个 src + 4 个 test 文件，新建 allowed-section-validator.ts 并接入 pipeline），它的内部任务清单显示 1/3 完成、2 进行中、4/5 没做。卡在编辑阶段，没跑到 build/test。

## 证据

- tsc 编译零错误，exit 0。
- jest 295 个测试全过，4.79 秒。
- build 和 test 都不卡。

结论：卡顿不是代码、不是 build/test。subagent 卡在编辑阶段，挂点不在代码路径上。

## 直接原因

最可能是 subagent 的 agent 调度循环本身在基础设施层挂起（推断，看不到 subagent transcript）。orchestrator 的 stall 超时（BASH_MAX_OUTPUT_MS，约 10 分钟）只覆盖无输出的 bash 命令，覆盖不到 agent 循环本身的挂起；若 subagent 还在间歇性发工具调用，活动计时被反复重置，超时不触发。

## 责任划分

挂起本身是基础设施层，planner 和 orchestrator 都没直接造成，但两方都有缺口让它变严重。

### planner 的缺口

- T-03 是粗粒度、执行密集、需要迭代的任务（grep 判断 + 改模块/配置 + 实现 no-marker 逻辑 + 加三条 fixture 测试 + 跑 build/test），塞进一次 subagent 派发。
- 现有读规模规则（read-scale hazard）只管只读任务的读取量，没有"执行规模 hazard"来约束 requires-execution + 多文件编辑 + build/test 迭代的任务。
- 改进点：补一条执行规模 hazard，和读规模 hazard 并列。执行密集任务必须拆分；单个 requires-execution 任务的迭代范围要有上限。

### orchestrator 的缺口（这次拖到 40 分钟的主因）

- 派发用阻塞式前台调用，subagent 一挂 orchestrator 只能干等，没有在途检测。
- stall 超时不可靠：只覆盖 bash，不覆盖 agent 循环；间歇工具调用会重置计时。
- 改进点：派发一律改为后台运行 + 轮询 + 可杀（run_in_background 拿 task id → TaskOutput 短超时轮询 → N 分钟无进展则 TaskStop 并报告）。再加一道单次派发硬墙钟上限。把耗时部分（build/test）尽量隔离到 Evaluator 步骤（天然有界），而不是塞在 Generator 里反复跑。

### 主次

粗粒度只是增大挂起概率，缺检测才是让小问题变成长时间无响应的直接原因。这次拖到 40 分钟主要是 orchestrator 的检测缺口。

## 改进措施（待落地）

1. orchestrator skill：派发改后台+轮询+可杀；加单次派发硬墙钟上限；build/test 隔离到 Evaluator。
2. planner skill：补执行规模 hazard 规则；执行密集任务强制拆分。

## 待修改的目标 skill

- C:\Users\liuya\.claude\skills\yiyue31-orchestrator\（SKILL.md）
- C:\Users\liuya\.claude\skills\yiyue31-planner\（SKILL.md）

注意：本次卡顿与 yiyue31-context（正在重构的 skill）无关，yiyue31-context 的内容在执行过程中并未运行，只是它的文件在被编辑。

## 当前处置

经用户同意，先收尾 T-03（由主线程直接完成，不再派 subagent，零挂起风险），再回来改 orchestrator/planner。T-03 半成品状态：能编译、295 测试全绿，缺 allowed-section-validator 的专门测试和三条新行为 fixture 测试，no-marker 非失败逻辑需验证补全。
