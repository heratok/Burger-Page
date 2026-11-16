# Path-aware CI selection

`CI Pipeline / CI gate` is the stable status check to require in branch protection. It always exists, fails when path selection fails, and accepts each expensive job only when it succeeds, or when it was skipped **and** the selector did not request it. That pair check keeps a broken job condition or a renamed output from turning a required job into a silent skip the gate would bless.

Two fail-safe rules matter as much as the table: if the comparison base or head cannot be resolved, or the `git diff` itself fails, every job runs. The selector must fail toward more verification, never less.

## Change-area matrix

| Changed area | Validate | E2E | Migration drift | Reason |
| --- | --- | --- | --- | --- |
| `frontend/**` | Run | Run | Skip | Validate builds/tests the frontend; Playwright exercises it. |
| `backend/**` | Run | Run | Skip | Validate builds/tests the backend; Playwright boots the live backend. |
| `packages/**` (today only `packages/contracts`) | Run | Run | Skip | `pnpm-workspace.yaml` globs `packages/*`, so any workspace package is installed and consumed by the apps. |
| `database/01_schema.sql` | Run | Run | Run | Both Postgres suites load it and migration drift compares against it. |
| `database/02_seed.sql` | Run | Run | Skip | Both Postgres suites load fixtures from it; drift does not inspect seed data. |
| `database/migrations/**` | Skip | Skip | Run | Drift applies, reverses, and reapplies migrations. The other jobs load the baseline, not migrations. |
| Drift scripts/fingerprint | Skip | Skip | Run | They implement the drift oracle itself. |
| Other `database/**` | Skip | Skip | Skip | Database documentation and local-only helpers are not inputs to current CI jobs. |
| `pnpm-lock.yaml`, root `package.json`, `pnpm-workspace.yaml`, `tsconfig*.json` (root and one level) | Run | Run | Run | Dependency/workspace/compiler changes can invalidate every job. Every tsconfig in the repo sits one level deep today, so the arms are exact rather than a recursive glob. |
| `.github/workflows/ci.yml` | Run | Run | Run | Changes to the selector or job definitions must exercise the full workflow. |
| Other `.github/workflows/**` | Skip | Skip | Skip | They are not inputs to this workflow's application checks; review their own trigger and parse them separately. |
| `load-tests/**`, `openspec/**`, `odd/**`, markdown outside a selected root | Skip | Skip | Skip | Not inputs to current CI jobs. A markdown file **inside** `frontend/`, `backend/` or `packages/` still selects those jobs, because the path prefixes win; the selector reads paths, not extensions. |

## Why this mechanism

Workflow-level `paths`/`paths-ignore` would avoid even starting CI, but a filtered workflow produces no stable check. With no required checks today, that is a silent green and leaves no guardrail to require later. A small, first-party shell selector keeps the dependency surface unchanged, job-level conditions avoid provisioning expensive service jobs, and the aggregate gate provides one stable status. No third-party changed-files action is needed for three booleans and a short path table.

Superseded runs share a branch/PR concurrency group and are cancelled. On a branch with three quick pushes during a 16–18 minute E2E run, only the newest run completes instead of as many as nine shard-runs, typically saving roughly two full three-shard executions (32–36 minutes of per-shard runner time, plus validate/drift time).

## Reviewer checks and regression risks

- Require `CI Pipeline / CI gate` in branch protection before relying on skipped jobs as a merge guardrail.
- Check every new source root, workspace config, database input, or CI job is added to the selector. A missing path can silently skip the job that should protect it.
- Check selector output names continue to match job conditions and that the gate still lists every conditional job.
- Preserve the fail-safe-to-full behavior when a comparison base or head cannot be resolved, and when the diff command fails: `set -e` does not see a failure inside a process substitution, which is why the selector writes the diff to a file instead.
- Do not restore `cancel-in-progress: true` for push events. A PR's newer run re-covers the whole branch, but a push run diffs only the newest commits, so cancelling an older `main` run would drop that push's verification permanently.
- The Azure deployment workflow remains independent and keeps its main-push path trigger, including `.dockerignore` because it changes the Docker build context.

## Known limitation

`migration-drift` resolves its own base from the live `origin/<base_ref>` and falls back to `origin/main`, which differs from the selector's event-time `base.sha`. On a push with unresolvable history (a force-push or a rewritten `main`) that fallback can treat the head as its own base and report "No new migrations" — a vacuous pass. The behaviour predates this selection work and is deliberately out of scope here; the fix is to reuse the selector's resolved base or to exit non-zero instead of falling back.
