# shared-public-actions

Repository to contain shared public facing GitHub Action workflows.

- [GitHub Actions Security Scanning](.github/docs/github-actions-security-scanning.md)
- [Dependency Scan (Grype)](.github/docs/dependency-scan.md)

## Secret scanning

Use the reusable [Betterleaks workflow](.github/workflows/secret-scan.yml) from
a workflow in the repository being scanned:

```yaml
name: Secret scanning
on:
  pull_request:
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

Set the push branch to the caller's default branch. Do not restrict PR paths:
secrets can be introduced in any file. Do not pass deployment secrets or
`secrets: inherit`. The shared workflow checks out the caller's repository,
installs checksum-verified Betterleaks 1.9.0, and scans introduced commits,
including add-then-delete secrets and merge-resolution changes. Scheduled and
manual caller runs scan history reachable from HEAD. Output is redacted, live
credential validation is disabled, and scan reports are not uploaded.

This definition runs only through `workflow_call`; it adds no automatic scan
of this repository. Existing workflow-security checks remain in place.
