# Secret Scan (Betterleaks)

`secret-scan.yml` is a reusable workflow that scans a repository's Git history for secrets with
[Betterleaks](https://github.com/betterleaks/betterleaks). It scans the commits each change introduces, and
every branch and tag on a schedule.

## How it works

```
caller workflow (pull_request, merge_group, push, schedule, workflow_dispatch)
  |
  +-- secret-scan job      calls secret-scan.yml; contents: read, no secrets
        |
        +-- checks out the repository with full history
        +-- verifies and installs Betterleaks
        +-- chooses the commits to scan from the event
        +-- loads the config and ignore file from a trusted commit
        +-- scans, annotates findings and writes a summary
```

What is scanned depends on the event:

| Event | Scanned |
|---|---|
| `pull_request` | The PR's commits (base..head) |
| `merge_group` | The queued commits |
| `push` | The pushed commits. A new branch or tag, or a force push, is scanned from the default branch. A first push to the default branch scans its whole history. |
| `schedule`, `workflow_dispatch` | Every commit on every branch and tag (audit) |
| Anything else | The job fails, so it never passes without scanning. Set the `base` and `head` inputs to scan a range. |

Each commit is compared with its first parent, so changes made while resolving merge conflicts are scanned too.
Only added lines are scanned: a secret added and removed within one PR is still found. Deleted refs and ranges
with no new commits are skipped.

### Trust model

- The scanned history is untrusted, because a PR can come from a fork. Betterleaks reads it with `git log`, and
  the job disables Git hooks, fsmonitor, external diff and textconv helpers.
- The config and ignore file come from a **trusted commit**: the base of a PR or merge group, otherwise the
  default branch. The commits being scanned never decide their own policy. A PR that adds an ignore entry for its
  own finding still fails.
- Inline `betterleaks:allow` and `gitleaks:allow` comments are part of the scanned change, so they are ignored
  unless the caller sets `allow-comments: true`.
- The job only has `contents: read` and takes no secrets. Do not pass `secrets: inherit`.
- Scanner output is redacted and cannot issue runner commands.

## Usage

Example caller:

```yaml
name: "Security: Secret Scan"

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

Set the push branch to your default branch. Don't restrict PRs with `paths`: a secret can be added in any file,
including documentation.

### Inputs

| Input | Default | Description |
|---|---|---|
| `config` | empty | Path to a self-contained Betterleaks config (TOML), read from the trusted commit. Empty uses the built-in rules. See "Custom config". |
| `ignore-file` | `.betterleaksignore` | Path to the ignore file, read from the trusted commit. A missing file is fine. |
| `validate` | `false` | Check findings against provider APIs. See "Validation". |
| `validation-max-requests` | `100` | Maximum validation requests per provider; `0` is unlimited |
| `allow-comments` | `false` | Honor `betterleaks:allow` and `gitleaks:allow` comments |
| `base`, `head` | empty | Scan this range instead of the event's. `head` alone scans its whole history. They never change which commit supplies the config and ignore file. |

## Reading the result

- Each finding is annotated on its file and line, and listed in the job summary with its rule, commit and
  **fingerprint**. No report file is uploaded.
- Secrets are redacted everywhere.
- A failure that says "Betterleaks failed" is not a finding. The scan did not finish, so treat the result as
  unknown and re-run it.

## Handling findings

First decide whether the finding is a real secret. Then pick the mechanism for the case:

| Case | What to do |
|---|---|
| A real secret, in any commit | **Revoke or rotate it first.** Deleting it from the code does not remove it from history, and anyone who cloned or forked the repository may have it. Then accept the historical finding with an ignore entry (below). |
| A false positive that keeps coming back, for example fixtures | Add a narrow `[[allowlists]]` entry to the `config` file (see "Custom config") |
| An old finding in history that is no longer a risk | Add an entry to the ignore file |
| A one-off false positive in a PR | Add a `betterleaks:allow` comment, if the caller has set `allow-comments: true`. Otherwise use the config allowlist. |

Never accept a live secret, and don't allowlist whole directories such as `test/`. That also hides every future
secret in them. Policy changes go in their own reviewed PR, because the PR that adds an exception is still scanned
without it.

### The ignore file

The ignore file lists findings to skip, one fingerprint per line. In Betterleaks 1.x a fingerprint is
`<commit>:<file>:<rule>:<line>`. Copy it from the failed run's job summary. Blank lines and lines starting with
`#` are ignored.

Write a comment for every entry: where the finding is, why it is safe, and who confirmed it and when.

```text
# Betterleaks ignore file. Each entry is <commit>:<file>:<rule>:<line>.
# Only add findings that are already in history and are no longer a risk.

# API key in example/server.js on branch feature-x, 2024.
# Revoked in the provider console by <name> on 2026-11-05 (TICKET-123).
1111111111111111111111111111111111111111:example/server.js:generic-api-key:19

# Same key in tags v0.1.0 and v1.0.0.
# Revoked by <name> on 2026-11-05 (TICKET-123).
2222222222222222222222222222222222222222:example/server.js:generic-api-key:19
```

Some rules can check whether a credential is live (see "Validation"). Generic rules such as `generic-api-key`
cannot, so for those, a person has to confirm the revocation, and the comment is the record of it.

How the workflow uses the file:

- It is read from the trusted commit. Add entries in **their own PR**. The next scan after the merge passes.
- Entries contain the commit SHA, so they only work for commits that won't change: the default branch, tags and
  other published history. They don't work for a PR's own commits, because squash and rebase merges create new
  commits with different SHAs, and the merged commit is flagged again. For those, use the config allowlist.
- Any copy of `.betterleaksignore` or `.gitleaksignore` in the checkout is deleted before the scan, so only the
  trusted file applies.
- Local scans read `.betterleaksignore` from the checkout. CI reads the trusted-base copy, so local results can differ while policy changes are pending review.

Protect the file with CODEOWNERS, because every entry is an exception to secret scanning:

```text
/.betterleaksignore  @openpass-sso/<security-reviewers>
```

Betterleaks 2.x uses a different fingerprint format: a SHA-256 hash of the secret's value. When this workflow
moves to 2.x, every entry has to be regenerated with `betterleaks fingerprint`. Squash merges then stop mattering.

### Custom config

`config` points to a TOML file in the caller's repository. It is read from the trusted commit and must be
self-contained: `extend.path` is rejected in every case-equivalent table, because it could load a file from the untrusted checkout. Ambiguous case-equivalent policy sections/keys are rejected, and `useDefault` must be a TOML boolean.

**Keep `useDefault = true`.** Without it, the built-in rules are not used and the config scans with only its own
rules. The workflow fails a config that has an empty rules list (or no rules) and no `useDefault`, and warns on one that has rules but no
`useDefault`.

```toml
# .betterleaks.toml
[extend]
useDefault = true

[[allowlists]]
description = "Sample tokens in the test fixtures"
paths = ['''^fixtures/sample\.txt$''']
```

Match the exact file, not a directory. If the configured file does not exist in the trusted commit, the job
fails. In a repository's first PR that adds both the config and `config:`, merge the config file first, then set
the input.

## Validation

With `validate: true`, Betterleaks sends each detected credential to the provider that issued it, to check
whether it is live. Only findings the provider confirmed are `invalid` or `revoked` are dropped. Findings whose
rule has no validator, and findings the provider could not check (`unknown`, `error`), are still reported, so a
provider outage never turns the check green.

Validation needs network access from the runner and sends the detected credential to the provider, which is why
it is off by default. It reduces noise from provider tokens such as GitHub, AWS or Slack, but does nothing for
generic rules.

## How Betterleaks is installed

The workflow downloads a pinned release with `gh`, using the job's token so the download is not subject to the
anonymous rate limit. It runs the binary only if the tarball matches the SHA-256 pinned in the workflow
(`BL_SHA256`).

To update Betterleaks, change `BL_VERSION` and `BL_SHA256` together in one reviewed PR. The SHA is in the
release's `checksums.txt`. Renovate waits 7 days before automated upgrades. Document any reviewed manual
exception in the upgrade PR; the configured waiting period remains unchanged.

## Local scans and pre-commit hook

A pre-commit hook catches a secret before it is committed, which is cheaper than revoking it after a push. The
hook is optional and can be skipped (`git commit --no-verify`), and it doesn't run for edits made in the GitHub
web editor. The workflow is the enforcement. This repository hosts no hook: each repository uses the tool it
already has.

### Repositories using pre-commit

Betterleaks publishes hooks for the [pre-commit](https://pre-commit.com) framework. Use the `betterleaks` hook,
and set `rev` to the version the workflow pins:

```yaml
# .pre-commit-config.yaml
repos:
  - repo: https://github.com/betterleaks/betterleaks
    rev: 8d77e1712fb06fd14444cc648686f1d5655e28a8 # v1.10.0
    hooks:
      - id: betterleaks
```

Install pre-commit, then run `pre-commit install` once per clone. It builds the scanner
from the pinned revision; no separate Betterleaks binary installation is needed.

- Don't use `betterleaks-docker`: it runs the moving `latest` image.
- Don't use `betterleaks-system` with Homebrew: the `betterleaks@1` cask installs the command as `betterleaks-v1`,
  and the hook calls `betterleaks`.
- Keep `rev` on a 1.x tag. The 2.x hook pipes `git diff` into `betterleaks stdin`, and `args` no longer reach
  Betterleaks.

### Repositories using Husky

Husky only runs a shell script and installs no tools, so the hook calls a Betterleaks binary each developer has
installed. The version is not pinned locally, which is acceptable because CI is the pinned gate. Add this to
`.husky/pre-commit`, before `lint-staged`:

```sh
# Optional local secret scan; the CI secret-scan workflow is the gate
bl=$(command -v betterleaks-v1 || command -v betterleaks || true)
if [ -n "$bl" ]; then
  "$bl" git --pre-commit --staged --no-banner --redact || exit 1
else
  echo "betterleaks not found -- skipping local secret scan (brew install --cask betterleaks/tap/betterleaks@1)."
  echo "  CI's secret-scan job will still check this change."
fi
```

Keep `|| exit 1`, so a finding cannot fall through to the next command. Husky v8 hooks also keep the
`. "$(dirname -- "$0")/_/husky.sh"` line at the top.

### Manual scans

Install the same version (macOS: `brew install --cask betterleaks/tap/betterleaks@1`, which provides
`betterleaks-v1`), then:

```sh
betterleaks-v1 git . --redact                        # all branches and tags, like the scheduled audit
betterleaks-v1 git --pre-commit --staged --redact    # staged changes only
```

## After adopting it

- Add the workflow to the caller's pinact config, because it is referenced by branch rather than SHA:

  ```yaml
  ignore_actions:
    - name: openpass-sso/shared-public-actions/.github/workflows/secret-scan.yml
      ref: main
  ```

- Run it once with `workflow_dispatch` to audit existing history. Revoke what is real, and add accepted historical
  findings to the ignore file in one reviewed PR.
- If a branch protection rule requires this check, its name is `<calling job name> / secret-scan`. Renaming the
  calling job changes it.
