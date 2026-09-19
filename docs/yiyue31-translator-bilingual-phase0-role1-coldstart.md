# Phase 0 角色①：冷启动读者——自足性缺口清单

- 评审日期：2026-09-19
- 输入：docs/yiyue31-translator-bilingual-handoff.md + 仓库

## 结论一行

自足性**基本成立**：Phase 0→1→2 任务序列、边界（§2"只审文档不实施"+§5 偏离报备/解耦不变量）、全部关键转引（讨论第 4 轮建议 2、M5/M6/R29、assemble 先例、final-gate.mjs:487、动词表/brief/已交付 workdir）均可解析且与仓库一致，冷启动走查全程未实质卡住；发现 9 处缺口（1 中、2 中低、6 低），无一阻塞开工，其中 G1（并行指令与全局串行纪律冲突）与 G2（CHANGELOG 缺项+失实表述）应在收口时修订 HANDOFF。

## 缺口清单

**G1** | §2 L45（"三个**并行**、单轮 subagent"）| （中）执行方式与本机用户级全局纪律直接冲突：/home/claude/.claude/CLAUDE.md 明文"禁止并行调度 subagent 执行任务，包括生成和评估。所有任务严格串行执行"+"低内存机器禁止一轮并行 fan-out 多个 worker"（1.87GB 可用内存，OOM 即失联；xl 测试 README 同源纪律）。 | 冷启动实施者按 HANDOFF 字面并行派发即违反环境硬约束并有人机双失风险——本次实际执行已被主会话改为串行单发（本评审即串行独立完成，属旁证）。 | 建议：§2 措辞改为"三个**串行**、单轮 subagent（低内存纪律：一次一个，等返回再派下一个）"。

**G2** | §6 L102 + T2.7 L87 | （中低）"仓库无常设 CHANGELOG，以 commit message 承载"与事实不符：yiyue31-translator/CHANGELOG.md 存在且活跃维护（最新 v2.5.0，2026-08-25，逐版本记录设计决策，正是 §6 所说"要义"的既有承载处）；且 T2.7 把 translator 升 3.0.0 破坏性版本，T2.1-T2.7 无任何一项是"CHANGELOG.md 补 3.0.0 条目"。 | Phase 2 收口时按 HANDOFF 字面执行会漏掉仓库自身惯例的 CHANGELOG 条目（v2.4.1/v2.5.0 先例俱在）；"要义写进提交信息"与"skill 自带 CHANGELOG"两个口径并存，实施者无所适从。 | 建议：T2 清单补一项"translator/CHANGELOG.md 补 3.0.0 条目（大文档移除+双语+路由，破坏性变更）"；§6 措辞改精确："monorepo 根无常设 CHANGELOG；translator skill 自身的 CHANGELOG.md 按其惯例更新"。

**G3** | §0 L29（"相关仓库 refined-stock（../refined-stock）"）| （低中）相对指针在本机不成立：本机 monorepo 在 /home/claude/skills/yiyue31-skills，refined-stock 实际在 /home/claude/project/refined-stock——两者非兄弟目录；"换机后以 clone 路径为准"的免责只挂在 L25 的 yiyue31-skills 路径行，未覆盖 refined-stock。 | Phase 1 验收"在一个真实已交付 workdir 上跑动词生成双语版"（L77）依赖 refined-stock/xl-translator/ 下的已交付工程（本机实证 3 个：AI-Native-SDLC-playbook、AI-Native-SDLC-playbook-r2、commerce-agents-anatomy，均含 translated-*-zh.md 与 brief.md）；按 ../refined-stock 找会落空，需自行全盘 find。 | 建议：§0 改为"refined-stock 仓库（路径以新机实际布局为准，本机 /home/claude/project/refined-stock；工作目录在其 xl-translator/ 下）"。

**G4** | §0 L26（"两 skill 脚本均为纯 Node（xl 用 .mjs，translator 用 .js），无 npm install 步骤"）| （低）对 translator 当前状态不成立：其 Step 1.5 用 `bun run doc_segmenter/src/cli.ts`（SKILL.md L41），doc_segmenter/ 含 node_modules（bun install 产物，目录内 README 明载 Bun >= 1.0）——该句只在 T2.2 完成后才为真。 | 冷启动者在 Phase 2 之前任何需要运行/验证 translator 现状的场景（如 Phase 0 角色③审计对照、行为等价性基线）会发现缺 bun 运行时，与 §0 声明矛盾，误判"环境没搭对"。 | 建议：§0 改为"xl 纯 Node 零安装；translator 现状 Step 1.5 依赖 bun + doc_segmenter/node_modules（Phase 2 T2.2 删除后消失，届时起纯 Node）"。

**G5** | T2.2 L82（"README 依赖段移除 bun"）| （低）无的放矢：yiyue31-translator/README.md 依赖段（L57-61）只有 Node.js v16+ / Python >= 3.10 / web-access skill，全文无 "bun"；bun 实际存在于 SKILL.md Step 1.5 与 doc_segmenter 内部文件——均已被同任务其余子项（删 Step 1.5、删整目录）覆盖，无残留可清。 | 实施者 grep README 依赖段找不到 bun，短暂怀疑看错文件或版本；而依赖段真正过期的行（Python——SKILL.md 与全部脚本零引用，已核验）反而无人指派处理。 | 建议：该子项改为"删 Step 1.5 与整目录后 bun 引用随之消失；顺带核对依赖段（Python 一行已无消费者，可一并清理）"。

**G6** | 头部 L4（"第 1-7 轮讨论 + 结论汇总"）| （低）转引范围陈旧：讨论记录实为 9 轮 + 结论汇总 + 待决项三部分（第 8 轮 = 任务总账/推送/review 咨询，第 9 轮 = Phase 0 升格 + 换机切换——后者正是 §2 的指令来源）。 | 无实质阻塞（信息多于心述），但冷启动者若按头部描述只读前 7 轮，会漏掉 Phase 0 升格与"冷启动入口"条款的决策出处。 | 建议：头部改"第 1-9 轮讨论 + 结论汇总 + 待决项"。

**G7** | §2 L47-51（三角色表"产出"列）| （低）三份评审清单的落盘路径/命名未约定（本次评审系主会话另行指定路径 docs/yiyue31-translator-bilingual-phase0-role1-coldstart.md）。 | 冷启动者需自行发明路径；收口"三份清单合并去伪"时若三份落点散乱（或进了临时会话目录），增加定位摩擦。 | 建议：§2 产出列补约定（如 docs/yiyue31-translator-bilingual-phase0-role{1,2,3}-<代称>.md）。

**G8** | T1.5 L74（"brief 模板交付配置区新增 `双语对照: 关`"）| （低）指向不存在的物理结构：仓库无 brief 模板文件（brief 缺省值仅在 xl SKILL.md Step 0 正文），真实 brief.md（实证 commerce-agents-anatomy）是扁平 key:value 列表、无任何"区"分区；"交付配置"只是 §1.2/讨论第 5 轮的概念分类。 | 实施者可能短暂搜寻"模板文件/配置区"结构；实际落地只是在 brief 加一行（已核验兼容：parseBrief 只抓白名单数值键，verify-mech.mjs L351-388，新字段零干扰；中文键布尔档位有现成先例 final-gate.mjs:134 `标题双语锚`）。 | 建议：措辞改为"brief（扁平 key:value）新增一行 `双语对照: 关`——概念上归交付配置；解析仿 标题双语锚 先例（final-gate.mjs:134）"。

**G9** | §0 L24（origin `https://github.com/liuyanhui/yiyue31-skills.git`）| （低）与本机事实不符：实际 remote 为 `git@github.com:liuyanhui/yiyue31-skills.git`（SSH）。 | 已 clone 场景零影响（本机推送/拉取正常，master 与 origin 同步）；仅当新机需重新 clone 时才有差异——若仓库为私有，HTTPS 需另行配置凭据（公开与否待核验：gh repo view 或浏览器隐身访问仓库 URL）。 | 建议：§0 改为"origin = liuyanhui/yiyue31-skills（本机配 SSH remote；clone 方式随新机凭据自选）"。

## 已核验无误的证据点

1. **封闭集计数（T1.5 "9 → 10"）**：yiyue31-xl-translator/SKILL.md L22 "scripts/（9）" 实列 9 项（segment/、verify-mech.mjs、status.mjs、merge.mjs、consistency.mjs、final-gate.mjs、probe.mjs、handoff.mjs、word-counter.mjs），与 scripts/ 目录内容一一对应；新增 derive-bilingual.mjs 后 9→10 口径成立。references/（9）同样实列 9 个文件且与 references/ 目录一致。
2. **xl 测试入口**：scripts/test/run.sh 存在、逐文件严格串行（脚本头注释写明缘由）；test README 明文"不用 `node --test <目录>`（多文件并行起进程，1.87GB 内存机器 OOM 风险）"——§0 L27-28 与仓库双向一致。
3. **T1.1 证据准确**：final-gate.mjs:487 确为四子目录（translated-chunks/chunks/adjudications/reviews）扫描行；其余根目录枚举点（L289 `glossary-` 定向 find、L491 manifest.md + cold-read-*）均不会触及根级 bilingual 文件；EXEMPT_GLOBS 机制（L65）存在——T1.1 的"豁免 glob 精确到文件名"兜底可执行。
4. **T1.3 先例真实**：merge.mjs 导出纯函数 `assemble`（L43）且被 final-gate.mjs import 复用（L50）——"interleave 仿 assemble"先例属实；M5（幂等无时间戳）/M6（绝不静默拼残稿）/R29（NN 数值序禁字典序）判据均在 test README 固化登记。
5. **T1.2 可判定**：segment.mjs 导出 14 个纯函数（含 fenceAwareHeadings、parseSections、protectedRanges），final-gate 已有 import segment 函数的先例（L48）——"能 import 就复用"决策规则可落地，无需额外信息。
6. **T1.5 接线点全部存在**：xl SKILL.md 用户动词表（L114）、交付节（L125-129）、Step 0 brief 缺省值落盘（L32）均实存；status.mjs 有已交付态（L295 delivered / L444 人话行）——"已交付态加一行双语版是否已生成"可实施。
7. **brief 加字段零破坏**（见 G8 核验）：BRIEF_KEYMAP 白名单 + `Number.isFinite` 过滤（verify-mech.mjs L351-388），`双语对照: 关` 完全不被机械校验消费；解析先例 final-gate.mjs:134。
8. **版本口径**：xl SKILL.md version 0.3.3（T1.6 "0.3.x → 0.4.0" 成立）；translator SKILL.md version 2.5.0（T2.7 "2.5.0 → 3.0.0" 成立）。
9. **T2 引用全部可解析**：translator Step 1（L24）/Step 1.5（L38，含 bun 命令、chunks/、manifest.md、progress.json、chunk 路径表）/Step 4.5/4.6/审校循环（L141-156：Step 5=准确性、6=翻译腔、7=AI 味，以合并节+表格形式存在而非独立标题）/Step 8/9/10/11/12 与 T2.1-T2.3 引用一一对应；scripts 实存 doc_segmenter/（含 node_modules 与自带 tests）、consistency-checklist.js、verify-pipeline.js、verify-mechanical.js、word-counter.js；role③ grep 关键词（doc_segmenter/chunks/manifest/progress.json/consistency-checklist/translated-chunks）在 git 跟踪文件中全部有命中。
10. **关键转引"措辞见讨论记录第 4 轮建议 2"可解析且内容具体**：讨论记录 L74 给出红线③修订完整措辞（唯一交付物 + bilingual 定位为 PASS 后机械派生只读视图——非交付物、不经终检、sha 不锚、不受手修保护、幂等重生成、命名永不以 -zh.md 结尾）；第 4 轮建议 1/3/5 亦分别与 §1.5①、§1.5③、T1.2 内容一致。
11. **存档与状态**：用户逐字存档 docs/yiyue31-translator-bilingual-discussion-user-inputs.md 存在且带"原状保存，禁止任何修改"头；HANDOFF"实施未开始"属实（两 skill 均无 derive-bilingual.*）；本机 master 与 origin/master 同步（无 ahead/behind），任务总账 #2"已推送"属实。
12. **Phase 1 验收资产在本机可用**（见 G3 的路径修正）：/home/claude/project/refined-stock/xl-translator/ 下 3 个已交付工程实存 translated-*-zh.md；refined-stock/.claude/skills/ 下各 skill 为指向本 monorepo 的符号链接——单一事实源，无"改哪份副本"歧义。
13. **杂项**：pull-all-git-repos.sh 实存于上级目录（/home/claude/skills/）；提交风格（中文+类型前缀+why）与 git log 一致；§6"开发期文档完成后删除"惯例有 commit 94062c6 先例；probe/truth 机制与 xl SKILL.md L112 一致（untracked 的 commerce-agents-r1.json 与嵌套符号链接为本机工作区残留物，不影响 HANDOFF 任何声明，亦不随 clone 传播）。
