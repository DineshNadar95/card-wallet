---
name: team-cycle
description: "Run one cycle of the Card Wallet agent team on a scope (a screen, a phase, or 'everything'): ui-ux-expert and testing-expert find gaps and file bugs, dev-lead triages, developer fixes approved bugs, dev-lead reviews, devops-expert reports deploy status. Use when asked to run the team, do a review cycle, or 'find and fix bugs'."
---

# Team cycle

You are the coordinator. The roles are the agents in `.claude/agents/`; read `docs/TEAM.md`
for the handoffs and `bugs/TEMPLATE.md` for the bug format. Scope is `$ARGUMENTS` (default:
"everything built so far").

Run the steps in order with the Agent tool, one agent per step, passing each agent the scope
and the names of the files produced by the step before. Wait for each step before the next;
the later steps depend on the earlier ones. Never do an agent's job yourself.

1. **Discover** (these two are independent; start both at once):
   - `ui-ux-expert`: review the flows in scope; write/refresh `docs/ux/*.md`; file design-gap
     bugs (`proposed`).
   - `testing-expert`: audit the scope against `CLAUDE.md` and `design/`; run the suites and
     the app; file bugs (`proposed`).
2. **Triage**: `dev-lead` reads every `proposed` bug and sets `approved` / `rejected` /
   `needs-info` with a lead note.
3. **Fix**: `developer` works through `approved` bugs in severity order (blockers first),
   one at a time, each with tests and its own commit, ending in `in-review`.
4. **Review**: `dev-lead` reviews each `in-review` bug: runs the checks, sets `done` or sends
   it back with specifics. If anything goes back, run step 3 again for just those bugs, then
   review again (at most two rounds; after that, report what's still open).
5. **Deploy status**: `devops-expert` checks that `main` is green in CI and what the live
   deployments report, and lists any dashboard steps the owner still has to do.

Report at the end, briefly: bugs filed (by severity), approved/rejected, fixed and reviewed
(`done`), still open and why, commits made, and the deploy status. Link each bug file.
Don't push to the remote unless the user asked for that in the scope.
