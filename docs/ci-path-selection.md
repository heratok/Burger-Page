# Path-aware CI selection

`CI Pipeline / CI gate` is the stable status check to require in branch protection. It always exists, fails when path selection fails, and accepts each expensive job only when it either succeeds or was intentionally skipped by the selector.

## Change-area matrix

| Changed area | Validate | E2E | Migration drift | Reason |
| --- | --- | --- | --- | --- |
| `frontend/**` | Run | Run | Skip | Validate builds/tests the frontend; Playwright exercises it. |
| `backend/**` | Run | Run | Skip | Validate builds/tests the backend; Playwright boots the live backend. |
| `packages/contracts/**` | Run | Run | Skip | Both applications consume the compiled shared contracts. |
| `database/01_schema.sql` | Run | Run | Run | Both Postgres suites load it and migration drift compares against it. |
| `database/02_seed.sql` | Run | Run | Skip | Both Postgres suites load fixtures from it; drift does not inspect seed data. |
| `database/migrations/**` | Skip | Skip | Run | Drift applies, reverses, and reapplies migrations. The other jobs load the baseline, not migrations. |
| Drift scripts/fingerprint | Skip | Skip | Run | They implement the drift oracle itself. |
| Other `database/**` | Skip | Skip | Skip | Database documentation and local-only helpers are not inputs to current CI jobs. |
| `pnpm-lock.yaml`, root `package.json`, `pnpm-workspace.yaml`, any `tsconfig*.json` | Run | Run | Run | Dependency/workspace/compiler changes can invalidate every job. |
| `.github/workflows/ci.yml` | Run | Run | Run | Changes to the selector or job definitions must exercise the full workflow. |
| Other `.github/workflows/**` | Skip | Skip | Skip | They are not inputs to this workflow's application checks; review their own trigger and parse them separately. |
| `load-tests/**`, `openspec/**`, `odd/**`, `**/*.md` | Skip | Skip | Skip | These are not inputs to current CI jobs. |

## Why this mechanism

Workflow-level `paths`/`paths-ignore` would avoid even starting CI, but a filtered workflow produces no stable check. With no required checks today, that is a silent green and leaves no guardrail to require later. A small, first-party shell selector keeps the dependency surface unchanged, job-level conditions avoid provisioning expensive service jobs, and the aggregate gate provides one stable status. No third-party changed-files action is needed for three booleans and a short path table.

Superseded runs share a branch/PR concurrency group and are cancelled. On a branch with three quick pushes during a 16–18 minute E2E run, only the newest run completes instead of as many as nine shard-runs, typically saving roughly two full three-shard executions (32–36 minutes of per-shard runner time, plus validate/drift time).

## Reviewer checks and regression risks

- Require `CI Pipeline / CI gate` in branch protection before relying on skipped jobs as a merge guardrail.
- Check every new source root, workspace config, database input, or CI job is added to the selector. A missing path can silently skip the job that should protect it.
- Check selector output names continue to match job conditions and that the gate still lists every conditional job.
- Preserve the fail-safe-to-full behavior when a comparison base cannot be resolved.
- The Azure deployment workflow remains independent and keeps its main-push path trigger, including `.dockerignore` because it changes the Docker build context.
