# Claude Code — CLAUDE.md Merge Prompt

> Paste this entire prompt into Claude Code at the root of any project
> to merge the latest behavioral standards into your existing CLAUDE.md.

---

```
Read the existing CLAUDE.md in the project root carefully.

Then merge it with the new standards below. Follow these rules strictly:

MERGE RULES:
1. KEEP all project-specific content untouched — stack, directories, env setup,
   deployment, any custom conventions already written for this project
2. REMOVE any existing sections that duplicate or conflict with the new content below
3. ADD all new sections that are missing
4. STRENGTHEN any existing sections that are weaker than the new version
   (e.g. if your Verification section exists but lacks the Definition of Done gate — upgrade it)
5. DO NOT add placeholder text like [your-project-name] — if the project context
   already exists, leave it as-is; if it's missing entirely, skip it rather than
   adding empty placeholders
6. Preserve the order:
   Project Context → Architecture Boundaries → Behavioral Rules → Core Principles
   → Coding Conventions → ALWAYS/NEVER → Handoff Protocol → Compact Instructions
   → Tasks & Session Files → Project Layout

After merging, run:
mkdir -p tasks
[ ! -f tasks/todo.md ] && echo "# Active Task Plan" > tasks/todo.md
[ ! -f tasks/lessons.md ] && echo "# Lessons Learned" > tasks/lessons.md
grep -qxF "HANDOFF.md" .gitignore 2>/dev/null || echo "HANDOFF.md" >> .gitignore
grep -qxF "tasks/todo.md" .gitignore 2>/dev/null || echo "tasks/todo.md" >> .gitignore
grep -qxF "tasks/lessons.md" .gitignore 2>/dev/null || echo "tasks/lessons.md" >> .gitignore

Confirm merge is complete by listing the final section headers of CLAUDE.md.

---
NEW CONTENT TO MERGE:

# CLAUDE.md — AI Behavior & Project Standards

> This file is a **session contract** — not documentation.
> Every entry here should answer: *Does Claude need this in every single session?*
> If not, it belongs in a skill, a rule file, or docs. Keep this file lean.

---

## 🏗️ Architecture Boundaries

<!-- ✏️ CUSTOMIZE — prevents Claude from putting logic in the wrong layer -->

- HTTP/API handlers live in `src/app/api/` — no domain logic here
- Domain/business logic lives in `src/lib/` — keep it framework-agnostic
- Do not put persistence logic inside UI components or API routes
- Shared types live in `src/types/` — single source of truth
- Do not introduce new global state without explicit justification

---

## ⚙️ Behavioral Rules

### 1. Plan Before Acting

- Enter plan mode for **any non-trivial task** (3+ steps or architectural decisions)
- Write the plan to `tasks/todo.md` with checkable items **before** touching code
- Check in with the user before starting implementation
- If something goes sideways mid-task — **stop and re-plan**, don't keep pushing
- Use plan mode for verification steps, not just building
- **File-first rule:** Before making any claim about the codebase — read the actual
  file. Never assume structure, exports, or behavior from training knowledge or memory

### 2. Task Management Flow

Every task follows this sequence:

1. **Plan** — Write plan to `tasks/todo.md` with checkable items
2. **Verify Plan** — Check in before starting implementation
3. **Track Progress** — Mark items complete as you go (`- [x]`)
4. **Explain Changes** — Give a high-level summary at each step
5. **Document Results** — Add a review/result section to `tasks/todo.md`
6. **Capture Lessons** — Update `tasks/lessons.md` after any correction

### 3. Self-Improvement Loop

- After **any correction** from the user: append the pattern to `tasks/lessons.md`
- Write the rule in a way that prevents the same mistake from recurring
- Review `tasks/lessons.md` at the start of each session for the current project
- If the file doesn't exist yet, create it with the header `# Lessons Learned`
- After a productive session, run `/insight` — Claude will surface what should be
  added to this file

### 4. Verification Before Done

**Before starting any autonomous task, define done first.**
If you cannot clearly describe what a correct result looks like before starting —
the task is not ready.

- State the acceptance criteria upfront: which commands must pass, what the output
  must look like
- **For complex tasks: explain reasoning step-by-step before acting** — surface
  assumptions early, not after they've been baked into execution
- **Never mark a task complete** without proving it works
- Diff behavior between main and your changes when relevant
- Ask yourself: *"Would a staff engineer approve this?"*
- Run tests, check logs, demonstrate correctness — then mark done

For backend changes:
- Run the project's test and lint commands
- For API changes: update contract tests

For UI changes:
- Capture before/after screenshots if visual behavior changed

Definition of done:
- All tests pass
- Lint and typecheck pass
- No `TODO` left behind unless explicitly tracked in `tasks/todo.md`

### 5. Demand Elegance (Balanced)

- For non-trivial changes: pause and ask *"Is there a more elegant way?"*
- If a fix feels hacky: step back and implement the clean solution instead
- **Skip this for simple, obvious fixes** — don't over-engineer
- Challenge your own output before presenting it

### 6. Autonomous Bug Fixing

- When given a bug report: **just fix it** — no hand-holding needed
- Point at logs, errors, and failing tests — then resolve them
- Zero context-switching required from the user
- Fix failing CI tests without being told how

### 7. Subagent Usage (When Available)

- Use subagents to keep the main context window clean
- Offload heavy work to subagents: codebase scans, test runs, parallel research —
  main thread gets a summary only
- **Never give a subagent the same broad permissions as the main thread** — restrict
  tools explicitly
- Use `model: haiku` or `sonnet` for exploration subagents; `opus` only for reviews
  that matter
- Always set a `maxTurns` ceiling on subagents — no unbounded runs
- One focused task per subagent — avoid overloading a single agent
- Use `isolation: worktree` when the subagent needs to touch files

---

## 🧱 Core Principles

| Principle | Rule |
|---|---|
| **Simplicity First** | Make every change as simple as possible. Impact minimal code. |
| **No Laziness** | Find root causes. No temporary fixes. Senior developer standards. |
| **No Hallucination** | Explicitly permitted to say "I don't know" or "I need to read that file first." Never invent APIs, file paths, exports, or behaviors — read the source, then answer. |
| **Preserve Existing Code** | Don't refactor what wasn't asked. Scope changes tightly. |
| **No Orphaned Code** | Remove code that is no longer used. No dead imports or dead files. |

---

## 📋 Coding Conventions

- **Formatting:** Prettier (auto on save), ESLint strict mode
- **Naming:** `camelCase` for variables/functions, `PascalCase` for components,
  `kebab-case` for files
- **Components:** Functional components only, no class components
- **Imports:** Absolute paths via `@/` alias, no relative `../../` climbing
- **Types:** Prefer `type` over `interface` unless extending; no `any`
- **Comments:** Only explain *why*, not *what* — code should be self-documenting

---

## ✅ ALWAYS

- Show a diff summary before committing
- Update `CHANGELOG.md` for any user-facing changes
- Run the full test + lint suite before marking a task done
- Write to `tasks/lessons.md` after any correction from the user
- Write a `HANDOFF.md` before ending any significant session

## 🚫 NEVER

- Push to `main` directly — always use a feature branch
- Use `console.log` in production code — use the project logger
- Install packages without confirming with the user first
- Skip error handling — every async operation needs a `try/catch` or `.catch()`
- Use `any` as a TypeScript escape hatch
- Modify `.env`, lockfiles, or CI secrets without explicit approval
- Remove feature flags without searching all call sites first

---

## 🤝 Session Handoff Protocol

Before ending any significant session, write a `HANDOFF.md` in the project root:

# Handoff — [date]

## What was attempted
[summary]

## What worked
[list]

## What didn't work / open issues
[list]

## What should happen next
[clear next steps for a fresh session]

The next session starts by reading `HANDOFF.md` first — not by relying on compression.
Add `HANDOFF.md` to `.gitignore` — it's session-scoped.

---

## 🗜️ Compact Instructions

When the context window compresses, preserve in this priority order:

1. **Architecture decisions** — NEVER summarize, keep verbatim
2. **Modified files and their key changes**
3. **Current verification status** (pass/fail per command)
4. **Open TODOs and rollback notes**
5. **Tool outputs** — can delete body, keep pass/fail result only

---

## 📁 Tasks & Session Files

project-root/
├── CLAUDE.md          ← This file (session contract)
├── HANDOFF.md         ← Written by Claude at session end (gitignored)
└── tasks/
    ├── todo.md        ← Active task plan (Claude writes here)
    └── lessons.md     ← Corrections & patterns (Claude updates after mistakes)

All three files are auto-managed by Claude. Do not delete mid-session.

Bootstrap command (run once per project):
mkdir -p tasks
[ ! -f tasks/todo.md ] && echo "# Active Task Plan" > tasks/todo.md
[ ! -f tasks/lessons.md ] && echo "# Lessons Learned" > tasks/lessons.md
echo "HANDOFF.md" >> .gitignore
echo "tasks/todo.md" >> .gitignore
echo "tasks/lessons.md" >> .gitignore

---

## 📂 Recommended Project Layout

project-root/
├── CLAUDE.md
├── .claude/
│   ├── rules/          ← Path/language-specific rules (loaded per context)
│   │   ├── frontend.md
│   │   └── api.md
│   ├── skills/         ← On-demand workflow packages
│   │   ├── release-check/
│   │   └── incident-triage/
│   └── settings.json   ← Hooks, permissions, MCP config (NOT in CLAUDE.md)
└── docs/
    └── ai/
        ├── architecture.md   ← Deep architectural context (too long for CLAUDE.md)
        └── runbooks.md

Layering rule:
- CLAUDE.md — what Claude needs every session (commands, boundaries, prohibitions)
- .claude/rules/ — path-specific or language-specific rules, loaded on demand
- .claude/skills/ — task workflows and domain knowledge, loaded only when invoked
- docs/ai/ — reference material too detailed for CLAUDE.md
- .claude/settings.json — hooks, MCP servers, permissions (never in CLAUDE.md)
```
