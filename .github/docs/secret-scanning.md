# Shared Betterleaks secret scanning

Use this workflow from a repository workflow with the same events as the example:

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

Set the push branch to the caller's default branch. Do not restrict PR paths: a
secret may be introduced anywhere, including documentation. Do not pass deployment
secrets or `secrets: inherit`; the read-only built-in token is sufficient.

The workflow checks out the caller's repository with full Git history. It scans
all introduced commits on PRs/pushes, including add-then-delete and merge-resolution
changes. Scheduled/manual runs scan full HEAD ancestry. Betterleaks 1.9.0 is installed
from the upstream release and verified against a pinned SHA256. Detection runs
without live credential validation; output is redacted and no reports are uploaded.
Local commit hooks use the same CLI release; see [hook setup](../secret-scanning.md).

This repository runs the reusable implementation directly on its own PRs, so it
can be tested before consumers use it at `main`. Merge this PR before consumer PRs;
their reference cannot resolve until this workflow exists on `main`. After merging,
rerun consumers and verify the exact nested check context before requiring it.
The `main` reference is explicitly trusted for this OpenPass-managed repository.
