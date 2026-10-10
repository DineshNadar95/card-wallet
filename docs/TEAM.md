# How the Card Wallet team works

Five Claude Code agents live in `.claude/agents/`. Each one reads this file first.

| Role | Agent | Does | Never does |
|---|---|---|---|
| UI/UX Expert | `ui-ux-expert` | designs and reviews flows; writes `docs/ux/*.md`; files design-gap bugs | writes app code |
| Testing Expert | `testing-expert` | audits product vs `CLAUDE.md` and `design/`; runs suites and the app; files bugs | fixes code |
| Development Lead | `dev-lead` | triages bugs; reviews fixes; sets `done` | writes feature code |
| Developer | `developer` | implements **approved** bugs with tests; opens them for review | picks its own work; decides scope |
| DevOps Expert | `devops-expert` | deploys every component; owns deploy configs and `DEPLOY.md` | handles secrets |

## The cycle

```
ui-ux-expert  ──flow specs / design-gap bugs──┐
testing-expert ──bug reports (proposed)───────┤
                                              ▼
                                   dev-lead triages
                                   approved │ rejected │ needs-info
                                            ▼
                                   developer fixes (in-progress → in-review)
                                            ▼
                                   dev-lead reviews → done (or back to in-progress)
                                            ▼
                                   devops-expert deploys from main
```

Run it with `/team-cycle` (see `.claude/skills/team-cycle/SKILL.md`), or invoke one agent for one
step: "use the testing-expert agent to audit the offers screens", "use dev-lead to triage
bugs/BUG-003", "use developer on BUG-003", "use devops-expert to check the Render deploy".

## Bugs

One file per bug in `bugs/`, named `BUG-NNN-short-slug.md`, from `bugs/TEMPLATE.md`.

Status flow: `proposed` → (`approved` | `rejected` | `needs-info`) → `in-progress` → `in-review`
→ (`done` | back to `in-progress`).

Who may set which status:
- `proposed`: testing-expert, ui-ux-expert (also anyone on the team filing by hand)
- `approved`, `rejected`, `needs-info`, `done`: dev-lead only
- `in-progress`, `in-review`: developer only

Every status change adds a dated line to the bug's **History**. Nobody rewrites another role's
text; add to it.

Severity: `blocker` (can't use a core flow, data at risk, a CLAUDE.md rule broken),
`major` (a flow works but wrong or with a clear gap vs the design), `minor` (polish).

## Ground rules for everyone
- `CLAUDE.md` is the spec. If the spec and the design disagree, say so in the bug and let the
  lead decide; don't guess.
- Tests are part of the change, not an afterthought. A fix without a test isn't done.
- Real card terms are never typed by hand. Fixtures and demos use "Demo Card A".
- Say what you actually ran and what it returned. "Tests pass" means you ran them.
