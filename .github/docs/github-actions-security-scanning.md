# GitHub Actions Security Scanning

Two reusable workflows enforce supply chain security on all GitHub Actions workflow files.
They run automatically on PRs that modify `.github/**` and can also be triggered manually.

## How it works

```
PR modifies .github/**
  |
  +-- actions-scan.yml (caller)
       |
       +-- pinact-scan.yml   Verifies action version pinning
       +-- zizmor-scan.yml   Audits workflow security configuration
```

`actions-scan.yml` calls both reusable workflows in parallel.

## Usage

Example:
```yaml
name: "Security: Actions Scan"

on:
  pull_request:
    branches:
      - master
    paths:
      - '.github/**'

  # this allows us to manually run this job
  workflow_dispatch:

permissions:
  contents: read # needed for private or internal repos
  actions: read  # needed for workflow API

jobs:
  pinact-scan:
    uses: openpass-sso/shared-public-actions/.github/workflows/pinact-scan.yml@main
    with:
      config: ./.github/config/pinact.yaml

  zizmor-scan:
    uses: openpass-sso/shared-public-actions/.github/workflows/zizmor-scan.yml@main
    with:
      config: ./.github/config/zizmor.yaml
```


**Why this matters:**

- Git tags are mutable - a compromised action maintainer can repoint `v4` to malicious code or a fork commit
- LLMs (Claude, Copilot) can hallucinate commit SHAs that don't match the claimed version
- Developers or bots like Dependabot might forget to update version comment
- It is easy to accidentally write insecure Actions workflows that are vulnerable to code injections

## pinact — Action Version Pinning

[pinact](https://github.com/suzuki-shunsuke/pinact) ensures all GitHub Actions and reusable
workflows reference commit SHAs instead of mutable tags.

**What it checks:**

| Check | Example |
|-------|---------|
| Actions must be pinned to a commit SHA | `actions/checkout@v4` fails; `actions/checkout@abc123 # v4.3.1` passes |
| Pinned SHAs must match their version comment | `actions/checkout@abc123 # v4.3.1` fails if `abc123` is actually `v3.1.0` |


Important: this [verification](https://github.com/suzuki-shunsuke/pinact/blob/main/docs/codes/001.md) works only if the version annotation is semver like `v4.3.1` and not `v4`.

**Output:** Inline PR annotations on the "Files changed" tab — findings appear directly on the relevant lines.

**When a developer adds an unpinned action:**

The check fails with a diff showing the expected fix:
```
.github/workflows/my-workflow.yml:12
-    uses: actions/checkout@v4
+    uses: actions/checkout@abc123def456 # v4.3.1
```

The developer uses the suggested SHA (or runs `pinact` locally) and pushes.

### Configuration

Config file: `.github/config/pinact.yaml`

Example:
```yaml
version: 3

ignore_actions:
  # Allow tag refs for official GitHub actions
  - name: actions/.*
    ref: "v\\d+"
```

The `ignore_actions` list uses regex matching. Actions not in this list must be pinned to
a full commit SHA.

## zizmor — Workflow Security Audit

[zizmor](https://github.com/zizmorcore/zizmor) is a static analysis tool for GitHub Actions
that detects security issues including template injection, dangerous triggers, excessive
permissions, credential exposure, and unpinned dependencies.

**What it checks (selected examples):**

| Rule | What it detects |
|------|----------------|
| `template-injection` | `${{ }}` expressions in `run:` blocks that could lead to injections |
| `unpinned-uses` | Actions without commit SHA pins (complements pinact) |
| `impostor-commit` | Pinned SHAs that belong to a fork, not the upstream repo (online checks only) |
| `dangerous-triggers` | `pull_request_target` and other risky workflow triggers |

Full rule documentation: https://docs.zizmor.sh/audits/

**Output:** Inline PR annotations on the "Files changed" tab — findings appear directly on the relevant lines.

### Configuration

Config file: `.github/config/zizmor.yaml`

Example:
```yaml
rules:
  unpinned-uses:
    config:
      policies:
        # Allow tag refs for these orgs
        actions/*: ref-pin
        openpass-sso/shared-public-actions/*: ref-pin
```

## How pinact and zizmor complement each other

| Capability | pinact | zizmor |
|-----------|--------|--------|
| Detect unpinned actions | Yes | Yes |
| Auto-fix (suggest correct commit SHA) | Yes | No |
| Verify SHA matches version tag in comments | Yes (`--verify`) | Yes (online mode, `ref-version-mismatch`) |
| Detect SHAs from forks (impostor commits) | No | Yes (online mode) |
| Template injection detection | No | Yes |
| Dangerous trigger detection | No | Yes |
| Container image pinning in workflows | No | Yes |
