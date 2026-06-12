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

**Main agent + subagent** pattern to avoid context overflow:

- **Main agent**: scan directory structure, plan tasks, dispatch subagents to handle individual directories, track progress, generate final report. Never read file contents for summarization — delegate that to subagents.
- **Subagent**: receive a single directory, analyze files, generate summaries, determine entry files, write CLAUDE.md content directly to disk.

Parent directories are processed before their children. Up to 5 subagents run concurrently.

## Workflows

### Phase 1: Scan & Plan

1. **Detect project language**:
   - Check if root `CLAUDE.md` or `README.md` (or `README.*`) exists.
   - If exists, read the first 50 lines and detect language: if it contains Chinese characters, use Chinese; otherwise English.
   - If no such file exists, default to Chinese (中文).

2. **Read `.gitignore` files**: Read all `.gitignore` files in the project and use their patterns as additional exclusion rules.

3. **Build exclusion rules** (three layers combined):
   - **Built-in default excludes**: `node_modules`, `.git`, `dist`, `build`, `__pycache__`, `venv`, `.env`, `.next`, `.nuxt`, `coverage`, `.turbo`, `.cache`, `target`, `vendor/bundle`, `Pods`
   - **`.gitignore` patterns** from every level
   - **`--exclude`** parameter additions; **`--include`** overrides both defaults and `.gitignore`
   - Skip binary files by extension: images, fonts, audio, video, archives, compiled binaries

4. **Scan directory tree**: List all directories under the target path. Apply exclusion rules bidirectionally (excluded directories are neither scanned nor written to). Skip symlinks pointing outside the project root.

5. **Generate plan**: List all directories that will receive CLAUDE.md files, indicating:
   - **new**: no CLAUDE.md exists, or exists but has no `# AI Coding Auto Sections` heading
   - **update**: CLAUDE.md exists and already contains `# AI Coding Auto Sections`

6. **Confirm with user**: Present the directory list and counts. Do NOT proceed without user confirmation.

### Phase 2: Dispatch Subagents

For each directory (parent before children), dispatch a subagent with the following prompt (fill in `{variables}`):

```text
You are processing directory: {directory_path}
Project language: {language}
Task: Generate a CLAUDE.md section for this directory and write it to disk.

Steps:
1. List all direct children (directories first, then files) — only direct children, not recursive.

2. For each subdirectory, write a one-line description based on the name. If unclear, skip the description.

3. For each file:
   a. Skip binary files by extension.
   b. Read the first 20 lines. Try rule-based extraction:
      - File header comment describing purpose
      - Exported function/class/type names and their doc comments
      - For package.json/Cargo.toml/pyproject.toml: read "description" or "name" field
   c. If rule-based extraction yields nothing, AND file is <=500 lines, read full file and generate a one-line summary. Be extremely concise.
   d. If file >500 lines and rule-based extraction failed, just list the filename without description.

4. Determine entry file based on common conventions for the project type and config file hints. If no clear entry file, skip.

5. Format and write output (see Output Format below).

6. Respond with: {"directory":"...","status":"success|failed","files_processed":N,"file_path_written":"..."}
```

**Output Format — write to `{directory_path}/CLAUDE.md`:**

The content between `<!-- skill: ai-context -->` and `<!-- /ai-context -->` is managed exclusively by this skill. Never modify anything outside these markers.

**If CLAUDE.md does not exist** — create with:

```markdown
# AI Coding Auto Sections
<!-- skill: ai-context | version: 0.0.1 | generated: {date} -->

## {Section headings in detected language}

{content}

<!-- /ai-context -->
```

**If CLAUDE.md exists with `# AI Coding Auto Sections` heading** — find the heading, replace everything from `<!-- skill: ai-context ... -->` through `<!-- /ai-context -->` (inclusive) with new content. If `<!-- /ai-context -->` is missing, replace from `<!-- skill: ai-context -->` to the next level-1 heading or EOF. Preserve all content before and after the section.

**If CLAUDE.md exists but has NO `# AI Coding Auto Sections` heading** — append to end of file.

**Section heading language**:
- Chinese: `## 目录结构`, `## 入口文件`
- English: `## Directory Structure`, `## Entry File`
- The `# AI Coding Auto Sections` heading and HTML comments always stay in English.

### Phase 3: Track Progress & Handle Failures

- Track completed directories. Directories already containing `# AI Coding Auto Sections` are skipped on re-run.
- If a subagent fails, retry once. If retry also fails, mark as failed and continue.
- If context is running low, stop dispatching new subagents and output a partial report.

### Phase 4: Final Report

Output to user (in conversation, not to a file):

```markdown
## AI Context Generation Report

- **Target path**: {path}
- **Project language**: {language}
- **Directories processed**: {count}
- **Directories skipped**: {count} (with reasons)
- **Directories failed**: {count} (with names)
- **CLAUDE.md created**: {count}
- **CLAUDE.md updated**: {count}

### Processed Directories
{list of all processed directory paths}

### Skipped Directories
{list with reasons}

### Failed Directories
{list with error descriptions}
```

To process remaining directories, re-run `/ai-context` — already-processed directories are automatically skipped.

## Parameters

| Parameter | Description |
|-----------|-------------|
| (none) | Generate for entire project |
| `{path}` | Generate for specific directory subtree |
| `--exclude={dirs}` | Add directories to exclusion list (comma-separated) |
| `--include={dirs}` | Force include normally-excluded directories (comma-separated) |

## Rules

- Directory depth: only describe **direct children** (one level deep). Deeper content belongs to child directory CLAUDE.md files.
- File summary: one line per file, as concise as possible. No filler words.
- Large files (>500 lines): rule-based extraction only, no full read.
- Binary files: skip entirely, do not attempt to read.
- Symlinks pointing outside project root: skip.
- Never modify content outside `<!-- skill: ai-context -->` ... `<!-- /ai-context -->` markers in existing CLAUDE.md files.
- The `# AI Coding Auto Sections` section is managed exclusively by this skill.
- Parent directories must be processed before their children.
- Confirm plan with user before writing files.
