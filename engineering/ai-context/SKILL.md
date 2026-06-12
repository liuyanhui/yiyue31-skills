---
name: ai-context
description: Use when user asks to "ai-context","generate CLAUDE.md","生成项目上下文","AI coding friendly","初始化AI上下文","project context", or wants to generate layered CLAUDE.md context files for directories in a project.
version: 0.0.1
---

# AI Context Generator

Generate CLAUDE.md files for every directory in a project, providing layered context for AI coding agents (primarily Claude Code).

## Quick Start

```
/ai-context              # Generate for entire project
/ai-context ./src        # Generate for specific path
/ai-context --exclude=vendor,tmp  # Add extra exclusions
/ai-context --include=dist        # Force include excluded directory
```

## Architecture

**Main agent + subagent** pattern. To prevent context overflow in large projects, the main agent handles decisions and dispatching, subagents handle execution in isolated contexts.

- **Main agent**: scan directory structure, plan tasks, dispatch subagents to handle individual directories, track progress, generate final report.
- **Subagent**: receive a single directory, analyze files, generate summaries, determine entry files, write CLAUDE.md content directly to disk.

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

5. **Generate plan**: List all directories that will receive CLAUDE.md files, indicating:
   - **new**: no CLAUDE.md exists, or exists but has no `# AI Coding Auto Sections` heading
   - **update**: CLAUDE.md exists and already contains `# AI Coding Auto Sections`

6. **Confirm with user**: Present the directory list and counts. Do NOT proceed without user confirmation.

### Step 2: Dispatch Subagents

For each directory (parent before children), dispatch a subagent with the following prompt (fill in `{variables}`):

```text
You are processing directory: {directory_path}
Project language: {language}
Task: Generate a CLAUDE.md section for this directory and write it to disk.

Steps:
1. List all direct children (directories first, then files) — only direct children, not recursive.

2. For each subdirectory, write a one-line description based on the name. If unclear, skip the description.

3. For each file, generate a one-line summary of its purpose. Be extremely concise. Skip binary files. For large files (>500 lines), do not read the full file — extract key info only.

4. Determine entry file based on common conventions for the project type and config file hints. If no clear entry file, skip.

5. Format and write output (see Output Format below).

6. Respond with: {"directory":"...","status":"success|failed","files_processed":N,"file_path_written":"..."}
```

**Output Format — write to `{directory_path}/CLAUDE.md`:**

The content between `<!-- skill: ai-context -->` and `<!-- /ai-context -->` is managed exclusively by this skill. Never modify anything outside these markers.

**If CLAUDE.md does not exist** — create with:

```markdown
# AI Coding Auto Sections
<!-- skill: ai-context | version: 0.0.1 | updated: {date} -->

## {目录结构 / Directory Structure}
{directories first, then files, one line each}

## {入口文件 / Entry File} (if any)
- filename — description

<!-- /ai-context -->
```

**If CLAUDE.md exists with `# AI Coding Auto Sections` heading** — find the heading, replace everything from `<!-- skill: ai-context ... -->` through `<!-- /ai-context -->` (inclusive) with new content. If `<!-- /ai-context -->` is missing, replace from `<!-- skill: ai-context -->` to the next level-1 heading or EOF. Preserve all content before and after the section.

**If CLAUDE.md exists but has NO `# AI Coding Auto Sections` heading** — append to end of file.

**Section heading language**: Match the detected project language. The `# AI Coding Auto Sections` heading and HTML comments always stay in English.

### Step 3: Track Progress & Handle Failures

- Track completed directories. Directories already containing `# AI Coding Auto Sections` are skipped on re-run.
- If a subagent fails, retry once. If retry also fails, mark as failed and continue.
- If context is running low, stop dispatching new subagents and output a partial report.

### Step 4: Final Report

Output a report to the user (in conversation, not to a file) covering: target path, project language, counts of processed/skipped/failed directories, CLAUDE.md created/updated counts, lists of processed and failed directories with reasons.

## Parameters

| Parameter | Description |
|-----------|-------------|
| (none) | Generate for entire project |
| `{path}` | Generate for specific directory subtree |
| `--exclude={dirs}` | Add directories to exclusion list (comma-separated) |
| `--include={dirs}` | Force include normally-excluded directories (comma-separated) |

## Rules

- Never modify content outside `<!-- skill: ai-context -->` ... `<!-- /ai-context -->` markers. These markers protect user-written content from being overwritten — only the section between markers is managed by this skill.
- The `# AI Coding Auto Sections` section is managed exclusively by this skill.
- Confirm plan with user before writing files. This is a write-heavy operation that touches many files across the project — user awareness is essential.
