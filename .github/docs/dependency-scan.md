# Dependency Scan (Grype)

`grype-scan.yml` is a reusable workflow that scans Software Bill of Materials (SBOM) files for known
vulnerabilities with [Grype](https://github.com/anchore/grype). The caller builds the SBOMs, this workflow
scans them and publishes a report.

## How it works

```
caller workflow
  |
  +-- build job         has the credentials; builds the app, writes SBOMs, uploads them as an artifact
  |
  +-- scan job          calls grype-scan.yml; no permissions, no secrets, never checks out the repo
        |
        +-- downloads the SBOM artifact
        +-- verifies and installs Grype
        +-- writes a summary on the run page and uploads the reports as an artifact
```

### Trust model

Grype is treated as untrusted code, so the scan runs in its own job on its own runner:

- no token permissions, no secrets and no cloud credentials
- it only reads an SBOM artifact and only writes a report artifact and the Grype database cache, and the caller
  decides whether the cache can be saved (see "Cache")
- the worst a compromised Grype can do is publish a false report, or leave a bad database in the cache for later
  runs, so keep independent signals (for example a registry scan or `npm audit`) alongside it

Do not add secrets, `id-token`, checkout or any other cache or artifact writes to this workflow. The Grype database
cache is the one cache write it makes.

## Usage

Example caller:

```yaml
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      # ... checkout, build, and write the SBOMs into <dir>/sbom/ (see "Input artifact" below) ...
      - uses: actions/upload-artifact@<sha> # v7.x.x
        with:
          name: sbom-${{ github.run_id }}-${{ github.run_attempt }}
          path: <dir>/

  scan:
    needs: build
    permissions: {}   # required: the called workflow cannot get more than this
    cache-mode: read  # use write only for trusted runs from the default branch
    uses: openpass-sso/shared-public-actions/.github/workflows/grype-scan.yml@main
    with:
      sbom-artifact: sbom-${{ github.run_id }}-${{ github.run_attempt }}
      fail-on: critical
```

Always set `permissions: {}` on the calling job.

### Input artifact

The artifact named by `sbom-artifact` must contain:

| Path | Required | Content |
|------|----------|---------|
| `sbom/*.json` | yes | One or more SBOMs, in SPDX or CycloneDX JSON |
| `config/grype.yaml` | no | A [Grype configuration](https://github.com/anchore/grype#configuration) |

Ways to produce an SBOM without extra tools:

- npm lockfile: `npm sbom --package-lock-only --sbom-format cyclonedx > sbom/sbom-npm.cdx.json`
- container image: BuildKit generates the SBOM during the build and attaches it to the image as an attestation.
  Then you read it back from the registry:

  ```bash
  # The default docker driver cannot store attestations, so use a docker-container builder
  docker buildx create --name sbom-builder --driver docker-container --use

  # --push is required: the SBOM is stored with the image in the registry
  # The scanner (Syft) is pinned by digest, so the same tool runs every time
  docker buildx build --push \
    --sbom=generator=docker/buildkit-syft-scanner:1.12.1@sha256:873a7458c3c8ac8e32c7b796c10e1600b07b963d2aa000a72a2d97aaaa2d6315 \
    -t <image> .

  docker buildx imagetools inspect <image> --format '{{ json .SBOM.SPDX }}' > sbom/sbom-image.spdx.json
  ```

  Check that the file is not empty or `null`. That means no SBOM attestation was found on the image.
  To update the scanner, pick a new `docker/buildkit-syft-scanner` tag and pin its digest.
  `--provenance=mode=max` is optional. It records the base image digest and build materials in a separate
  attestation, which helps when you need to trace what an image was built from.

Only `sbom/*.json` is scanned. Other folders in the artifact are carried along but ignored, so you can keep an
SBOM with the build without scanning it, for example in `archive/`.

An npm SBOM lists the libraries bundled into your app. An image SBOM lists the OS packages and runtime in the
container. Neither replaces the other, so keep both when you build an image. If the image already contains
the same npm packages, scanning both reports the same findings twice. In that case scan the image SBOM and put
the npm SBOM in `archive/`. When the image no longer contains `node_modules`, for example with a multi-stage
build, scan the npm SBOM again, because it is then the only record of the bundled libraries.

### Inputs

| Input | Required | Default | Description |
|-------|----------|---------|-------------|
| `sbom-artifact` | yes | | Name of the artifact described above |
| `fail-on` | no | `critical` | Fail the job on findings at or above this severity: `negligible`, `low`, `medium`, `high` or `critical` |
| `report-artifact` | no | `grype-reports` | Base name of the report artifact. The run attempt is appended, so the default produces `grype-reports-1` |
| `retention-days` | no | `30` | How long the report artifact is kept |

Artifact names must be unique within a run, so a second upload with the same name fails:

- Include `github.run_attempt` in the SBOM artifact name, as in the example. "Re-run failed jobs" keeps the artifacts
  of earlier attempts, and this workflow is meant to fail on findings, so re-runs are common. The workflow appends
  the attempt to the report name itself.
- Give every call in a run its own `report-artifact` and `sbom-artifact`, for example in a matrix:
  `report-artifact: grype-reports-${{ matrix.service }}`.

## Reading the result

Each run shows a summary with one section per SBOM:

- what was scanned: the number of packages by ecosystem (for example `2319 npm · 35 apk · 1 generic`), and
  the binaries that were detected, such as `node 24.22.1`
- the number of findings by severity
- a table sorted by risk, highest first

A "How to read this report" section in the summary explains the columns. The full table and a JSON report
are in the report artifact.

- The table lists only packages that have findings. A package with no known vulnerability, including Node,
  does not appear in it. To see everything that was scanned, search the SBOM itself, for example
  `jq -r '.packages[] | select(.name=="node") | "\(.name) \(.versionInfo)"' sbom-image.spdx.json` for an SPDX
  SBOM, or `.components[]` and `.version` for CycloneDX.
- The counts are findings, not unique vulnerabilities. A CVE that affects two packages counts twice.
- A finding is not always exploitable in your app. Packages that only build the app are not shipped.
- No findings does not mean safe. Grype only knows published vulnerabilities for what is in the SBOM, so
  anything downloaded at runtime is not covered.

## Keeping SBOMs for later

SBOMs are not only for this scan. They can be exported to any other tool, or kept for point-in-time analysis.
When a new vulnerability or a compromised package is announced, you can search old SBOMs to see which builds
contained the affected version, and re-scan them against an up-to-date database, without rebuilding anything.
Report artifacts and SBOM artifacts expire according to their retention settings, so keep SBOMs for as long as
you need to look back.

## Cache

The Grype vulnerability database is cached to speed up scans. Callers choose the cache access with
`cache-mode` on the calling job: `write` only for trusted runs from the default branch, `read` for everything
else. A run that can write the cache could leave a bad database for later runs, which is why `write` is limited to
trusted runs. GitHub enforces it, and this workflow cannot get more than the caller grants. The cache belongs to the
calling repository.

See https://github.blog/changelog/2026-09-10-control-github-actions-cache-access-with-cache-mode/

## Configuration

An optional `config/grype.yaml` in the input artifact is passed to Grype. Typical use is `by-cve: true` to report
CVE ids instead of GitHub advisory ids.

Be careful with `ignore:` rules, because they hide findings. Review changes to this file like code, and put a
reason next to every rule. VEX documents are deliberately not supported, for the same reason.

## How Grype is installed

The workflow does not use a third-party action. It downloads a pinned release and checks it three ways before
running it:

1. the release checksums are signed by Anchore's release workflow (verified with `cosign`)
2. the tarball matches those signed checksums
3. the tarball matches a SHA-256 pinned in the workflow

To update Grype, change `GRYPE_VERSION` and `GRYPE_RELEASE_SHA` together. The SHA is in the release's
`grype_<version>_checksums.txt`. The signer identity only changes if Anchore changes its release workflow.

## After adopting it

- Add the workflow to the caller's pinact config, because it is referenced by branch rather than SHA:

  ```yaml
  ignore_actions:
    - name: openpass-sso/shared-public-actions/.github/workflows/grype-scan.yml
      ref: main
  ```

- If a branch protection rule requires this check, its name is `<calling job name> / Dependency Scan`.
  Renaming the calling job changes it.
