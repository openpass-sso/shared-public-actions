# shared-public-actions

Repository to contain shared public facing GitHub Action workflows.

- [GitHub Actions Security Scanning](.github/docs/github-actions-security-scanning.md)
- [Dependency Scan (Grype)](.github/docs/dependency-scan.md)

## Secret scanning

The reusable [Betterleaks workflow](.github/workflows/secret-scan.yml) is invoked
only through `workflow_call`. It adds no automatic jobs in this repository.
Define the triggers in each repository being scanned:

```yaml
name: Secret scanning
on:
  pull_request:
  merge_group:
  push:
    branches: [main]
  schedule:
    - cron: '17 4 * * 1'
  workflow_dispatch:
permissions:
  contents: read
jobs:
  secret-scan:
    uses: openpass-sso/shared-public-actions/.github/workflows/secret-scan.yml@main
```

Set the push branch to the caller's default branch. Do not filter PR paths:
secrets can occur in any file. Do not use `secrets: inherit` or pass deployment
secrets. The workflow checks out the caller, installs checksum-verified Betterleaks
1.9.0, and preserves the `secret-scan / secret-scan` check name for this example.
Confirm the actual context and GitHub Actions App before making a check required.

| Event | Coverage |
|---|---|
| PR or merge queue | Every introduced commit, including merge-resolution changes |
| Push | Introduced commits; first default-branch push scans its reachable history |
| New ref or unavailable old push tip | Commits not reachable from the default branch |
| Schedule/manual | Every commit reachable from fetched branches and tags |

Deleted refs or event ranges with no new commits are skipped. An explicit empty
range and unsupported events fail. Optional `base`/`head` inputs select a fetched
range; `head` alone scans its reachable history. Overrides never change which
commit supplies the scanner policy. Add-then-delete secrets are included.

### Scanner policy

`ignore-file` defaults to `.betterleaksignore`. `config` optionally selects a
self-contained TOML file; empty uses built-in rules. Both are loaded from the
PR/merge-group base, or otherwise the default branch. PR content cannot add its
own policy exceptions. Inline `betterleaks:allow` and `gitleaks:allow` comments
are ignored in CI. Custom configs may use `extend.useDefault`; `extend.path` is
rejected because it could load policy from the untrusted checkout.

Revoke real credentials first. For a verified false positive or remediated
historical finding, request a narrowly scoped exception in a separate reviewed
policy PR. Protect policy files with CODEOWNERS. Fingerprints appear in the job
summary; they include commit SHAs in Betterleaks 1.x and change after rebasing or
squashing. Never baseline live credentials or ignore entire paths/repositories.

Output is redacted, raw scanner output cannot issue runner commands, and the
scanner disables external diff/textconv helpers and Git hooks/fsmonitor. Reports
exist only in the temporary job directory and are not uploaded. Live credential
validation is disabled. Keep scanner upgrades reviewed, checksum-pinned, and
consistent with the repository's seven-day release-age guidance.

### Local checks

Repositories using pre-commit reference the upstream Betterleaks hook at a pinned
revision in their own `.pre-commit-config.yaml`, then run `pre-commit install`
once per clone. Repositories already using Husky keep Husky, invoke an installed
`betterleaks-v1` or `betterleaks` binary directly before lint-staged, and warn/skip
when no binary is installed. Husky v8 retains its `_/husky.sh` header. Local Husky
versions are not pinned; CI is the pinned gate. Local checks are optional and
never replace CI. No hook implementation or installer is hosted here.
