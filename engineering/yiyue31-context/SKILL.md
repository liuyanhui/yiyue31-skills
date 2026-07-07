---
name: yiyue31-context
description: Use when user asks to "generate CLAUDE.md","生成项目上下文","AI coding friendly","初始化AI上下文","project context", or wants to generate modification context for AI coding agents — what an agent needs to know to change code in a package without breaking things.
version: 0.0.2
---

# AI Context Generator

Generate CLAUDE.md files for every directory in a project, providing modification context for AI coding agents: what an agent needs to know to change code in a package without breaking things. Humans are a secondary audience.

## Quick Start

```
/yiyue31-context              # Generate for entire project
/yiyue31-context ./src        # Generate for specific path
/yiyue31-context --exclude=vendor,tmp  # Add extra exclusions
/yiyue31-context --include=dist        # Force include excluded directory
```

## Architecture

**Main agent + subagent** pattern. To prevent context overflow in large projects, the main agent handles decisions and dispatching, subagents handle execution in isolated contexts.

- **Main agent**: scan directory structure, plan tasks, dispatch subagents to handle individual directories, track progress, generate final report.
- **Subagent**: receive a single directory, run four analyses (dead-file, convention, sync-edit-point, dependency+purpose), produce the six auto-managed sections, write CLAUDE.md content directly to disk.

Parent directories are processed before their children so that higher-level context is available before diving into subdirectories. Up to 5 subagents run concurrently.

## Workflows

### Step 1: Scan & Plan

1. **Detect project language**: Determine the language from existing CLAUDE.md or README files. Default to Chinese (中文) if none found.

2. **Read `.gitignore` files**: Read all `.gitignore` files in the project and use their patterns as additional exclusion rules.

3. **Build exclusion rules** (three layers):
   - Exclude dependency directories, build outputs, cache directories, IDE configs, and environment directories. Skip binary files.
   - `.gitignore` patterns from every level
   - `--exclude` additions; `--include` overrides

4. **Scan directory tree**: List all directories under the target path. Apply exclusion rules bidirectionally (excluded directories are neither scanned nor written to). Skip symlinks pointing outside the project root.

5. **Generate plan**: Classify every directory that would receive a CLAUDE.md:
   - **new**: no CLAUDE.md exists → create fresh (auto-managed block + 雷区 stub).
   - **update**: CLAUDE.md exists and already contains `# AI Coding Auto Sections` → replace only the content between markers.
   - **report-only**: CLAUDE.md exists but has NO `# AI Coding Auto Sections` heading → DO NOT write. Surface the file path to the user and let them decide.

6. **Confirm with user**: Present the directory list and counts (including report-only files). Do NOT proceed without user confirmation.

### Step 2: Dispatch Subagents

For each directory (parent before children), dispatch a subagent with the following prompt (fill in `{variables}`):

```text
You are processing directory: {directory_path}
Project language: {language}
Task: Generate the auto-managed CLAUDE.md section for this directory and write it to disk.

Steps:
1. List all direct children (directories first, then files) — only direct children, not recursive. Skip binary files. For large files (>500 lines), do not read the full file — extract key info only.

2. Run FOUR analyses:
   a. Dead-file detection: for each file, search the module for references/imports of its name. Files with zero in-module references are marked 已废弃 (deprecated/dead).
   b. Convention detection: scan method bodies for a shared lock object, uniform return types, error-handling style, and centralized constants.
   c. Sync-edit-point detection: when several classes implement the same interface with near-identical method bodies, flag that they must be edited together.
   d. Dependency + purpose inference: from imports and class shape, infer depends-on / depended-by and the one-line package purpose.

3. Produce EXACTLY these six sections, in this order. SKIP any section that has no content — never output a heading with empty content behind it:
   - 目录职责 / Directory Purpose — one line: what this package does as a unit.
   - 关键文件 / Key Files — a table (file | role | notes). Role classifies the file (interface / impl / factory / util / data class / activity / etc.). A file with zero in-module references is marked 已废弃.
   - 设计要点与原因 / Design Notes & Why — non-obvious structural choices and the reason they exist (this prevents over-refactoring things that exist for a purpose).
   - 约定与陷阱 / Conventions & Traps — the detectable conventions from analysis (b). Human-known traps do NOT go here; they live in the 雷区 / Traps region outside the auto-managed markers.
   - 依赖关系 / Dependencies — depends-on / depended-by from analysis (d).
   - 扩展指南 / Extension Guide — the modification contract: how to add or change X without breaking things; which files must change together. Record sync-edit-point flags from analysis (c) here.

4. Section-heading language: match the detected project language. For a Chinese project use 目录职责, 关键文件, 设计要点与原因, 约定与陷阱, 依赖关系, 扩展指南. For an English project use Directory Purpose, Key Files, Design Notes & Why, Conventions & Traps, Dependencies, Extension Guide. The `# AI Coding Auto Sections` heading and all HTML comments always stay English.

5. Write the result to disk per the Output Format rules below.

6. Respond with: {"directory":"...","status":"success|failed","files_processed":N,"file_path_written":"...","report_only":false}
```

**Output Format — write to `{directory_path}/CLAUDE.md`:**

The content between `<!-- skill: yiyue31-context -->` and `<!-- /yiyue31-context -->` is managed exclusively by this skill. Never modify anything outside these markers — these markers protect user-written content so that regenerable auto-content does not clobber hand-written context.

**If CLAUDE.md does not exist** — create with (first generation writes the auto-managed block AND a stub for the human-maintained 雷区 region outside the markers):

```markdown
# AI Coding Auto Sections
<!-- skill: yiyue31-context | version: 0.0.2 | update_time: {date} -->

## 目录职责 / Directory Purpose
{one line: what this package does as a unit}

## 关键文件 / Key Files
| 文件 / file | 角色 / role | 说明 / notes |
|------|------|------|
| ... | interface / impl / factory / util / data class / activity / ... | ... |

A file with zero in-module references is marked 已废弃 (deprecated/dead).

## 设计要点与原因 / Design Notes & Why
{non-obvious structural choices and the reason they exist}

## 约定与陷阱 / Conventions & Traps
{detectable conventions: shared lock object, uniform return types, error-handling style, centralized constants}

## 依赖关系 / Dependencies
depends-on: ...
depended-by: ...

## 扩展指南 / Extension Guide
{modification contract: how to add or change X without breaking things; which files must change together}

<!-- /yiyue31-context -->

## 雷区 / Traps (Human-Maintained)
<!-- OUTSIDE the yiyue31-context auto-managed markers. The skill NEVER overwrites this region. It holds traps only a human knows. Add them below. -->
```

Skip any of the six auto-managed sections that has no content — never output a heading with empty content behind it. The `## 雷区 / Traps (Human-Maintained)` region is NOT one of the six auto sections; it is a stub written once on first generation only.

Section-heading language matches the detected project language (Chinese projects use the Chinese names above; English projects use the English names). The `# AI Coding Auto Sections` heading and all HTML comments always stay English.

**If CLAUDE.md exists with `# AI Coding Auto Sections` heading** — replace ONLY the content from `<!-- skill: yiyue31-context ... -->` through `<!-- /yiyue31-context -->` (inclusive) with the new auto-managed block. If `<!-- /yiyue31-context -->` is missing, replace from `<!-- skill: yiyue31-context -->` to the next level-1 heading or EOF. Preserve ALL content outside the markers, including any human-maintained 雷区 / Traps region — on re-runs only the content between markers is replaced, so the 雷区 region is preserved.

**If CLAUDE.md exists but has NO `# AI Coding Auto Sections` heading** — REPORT-ONLY. Do NOT append, do NOT rewrite. Surface the file path to the user and let them decide whether and how to integrate it.

### Step 3: Track Progress & Handle Failures

- Track completed directories. Directories already containing `# AI Coding Auto Sections` are skipped on re-run.
- If a subagent fails, retry once. If retry also fails, mark as failed and continue.
- If context is running low, stop dispatching new subagents and output a partial report.

### Step 4: Final Report

Output a report to the user (in conversation, not to a file) covering: target path, project language, counts of processed/skipped/failed/report-only directories, CLAUDE.md created/updated counts, and lists of processed, failed, and report-only directories with reasons.

## Parameters

| Parameter | Description |
|-----------|-------------|
| (none) | Generate for entire project |
| `{path}` | Generate for specific directory subtree |
| `--exclude={dirs}` | Add directories to exclusion list (comma-separated) |
| `--include={dirs}` | Force include normally-excluded directories (comma-separated) |

## Rules

- Never modify content outside `<!-- skill: yiyue31-context -->` ... `<!-- /yiyue31-context -->` markers. These markers protect user-written content so that regenerable auto-content does not clobber hand-written context.
- The `# AI Coding Auto Sections` section (between the markers) is managed exclusively by this skill.
- The `## 雷区 / Traps (Human-Maintained)` region sits OUTSIDE the markers. The skill NEVER overwrites it — it holds traps only a human knows. First generation writes a stub for it; re-runs only replace content between the auto markers, so this region is preserved.
- Adaptive output: skip any auto-managed section that has no content. Never output a heading with empty content behind it.
- Parent directories are processed before their children so that higher-level context is available before diving into subdirectories.
- If CLAUDE.md exists but has NO `# AI Coding Auto Sections` heading: REPORT-ONLY. Do not append or rewrite; surface the file to the user and let them decide.
- Confirm plan with user before writing files. This is a write-heavy operation that touches many files across the project — user awareness is essential.
