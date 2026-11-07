# Agent handoff files

`.agent/` is local state and must remain gitignored. Keep the files short.

## STATE.md (40 lines max)

Record: update time and agent; branch and HEAD; unpushed commit count; one-sentence goal; active task path; current todo id/title/status; exact `RESUME HERE` file, function/section, and next command; next todo; last green checks and commit hash; blockers/questions.

Example:

```text
Updated: 2026-11-07 10:30 UTC (Codex)
Branch and HEAD: dev / abc1234
Unpushed commit count: 0
Goal: Finish the requested profile settings change.
Active task set: .agent/tasks/02-profile-settings.md
Current todo: T1 Add locale preference | in progress
RESUME HERE: src/app/settings/page.tsx, LocaleSettings; next: npm run lint
Next todo: T2 Verify translations
Last green checks: npm run lint at abc1234
Blockers or questions for the user: None.
```

## CONTEXT.md (120 lines max)

Distill stack and commands, routes, role rules, design tokens and texture/theme behavior, shared components, RTL/fonts, branding, grouped completed work, and open issues labeled `confirmed in code` or `not reproduced`. Never copy secrets or transcript dumps.

## Task file (150 lines max)

```markdown
# NN-slug: short title
Prompt: .agent/prompts/NN-slug.md
Goal: One sentence.
Overrides of AGENTS.md for this set (if any): None.
## Todos
- [ ] T1 Imperative title | accept: observable verification
## Progress log
- Newest first; keep at most 15 lines and collapse older entries.
## Decisions and gotchas
- Record findings successors should not rediscover.
## Left after this set / follow-ups
- Remaining work or None.
```

Save each instruction verbatim in `.agent/prompts/NN-slug.md`. One todo is one commit; record the resulting hash. A finished task file moves to `.agent/archive/`, and `.agent/DONE.md` gets one line: `NN-slug | date | commit | note`. Keep backlog items unticked until started.
