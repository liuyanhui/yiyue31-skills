# 共享评估 prompt 的版本同步

## 背景

translator、hn-digest 等 skill 都产出中文文本，各自带一份"AI 味检查"评估 prompt（`references/evaluate-ai-tone-prompt.md`）。skill 是自包含的分发单元，prompt 必须随 skill 复制，无法共用同一物理文件，于是同一概念的多份副本各自演化、逐渐漂移，修一处不传导到别处。

## 规则

完整规则见 `CLAUDE.md` 的 "Shared evaluation prompts (cross-skill sync)"。要点：内容一致的副本同版本号、改一处同步全部、靠版本号检测漂移。不同语言（如 summary 的英文）是独立文档，不做内容同步，也不绑版本号。

## ai-tone prompt 的演进

旧版（hn-digest v1.x、summary v0.x）只罗列表层模式、纯禁令。v2.x 升级要点（详见各 prompt 文件）：两副面孔同根、节奏层判定、正向锚点；v2.1 并入 Rule of Three 与 Empty Promises。

## 现状

- **中文版（v2.1）**：translator、hn-digest，内容一致、版本同步。
- **英文版（summary）**：独立文档，结构与中文版对齐（两副面孔、节奏层、正向锚点），但例子与词表英文化，不绑版本号、不做内容同步。

## 待办

- **sibling prompt 表层化（优先级低）**：translationese / readability / article / reader-audit 等评估 prompt 也有"纯禁令、判定停在表层"的通病，但它们不针对 AI 生成痕迹、没有"两副面孔"问题，后续单独处理。
