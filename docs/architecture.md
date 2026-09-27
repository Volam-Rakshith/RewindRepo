# RepoTimeMachine Architecture

RepoTimeMachine is a source-first repository history explorer. The design optimizes for public data availability, user safety, and low bandwidth.

## Goals

1. Reconstruct repository states as accurately as public GitHub data allows.
2. Avoid cloning massive repositories into the browser.
3. Make historical source exploration fast and understandable.
4. Never execute arbitrary repository code in the app runtime.
5. Explain limitations clearly instead of overpromising historical website execution.

## Data flow

```text
User repo URL
  ↓
parseGitHubRepoUrl
  ↓
GitHub REST API
  ├─ /repos/{owner}/{repo}
  ├─ /branches
  ├─ /commits?sha={branch}
  ├─ /tags
  ├─ /releases
  ├─ /git/trees/{sha}?recursive=1
  ├─ /git/blobs/{blobSha}
  └─ /compare/{base}...{head}
  ↓
React application state
  ↓
Timeline, file explorer, file inspector, compare panel, preview panel
```

## Archive model

RepoTimeMachine uses GitHub APIs instead of local cloning:

- **Commits** provide branch history and date-based resolution.
- **Tags and releases** provide named historical anchors.
- **Git tree objects** reconstruct the file hierarchy at a commit.
- **Git blob objects** retrieve file content lazily only when a user opens a file.
- **Compare endpoint** provides file status, rename detection where available, and line patches.

This model is intentionally selective. It avoids pulling the full repository or dependency graph into the browser.

## Timeline model

The timeline merges:

- latest branch commits,
- tags,
- releases,
- date-resolved commits.

Points are sorted older → newer. Activity periods are bucketed from commit dates to show high-change periods without rendering every commit in huge histories.

## File explorer model

The app requests a recursive Git tree at the selected commit. GitHub can mark very large trees as `truncated`; RepoTimeMachine displays that state and continues with available objects.

File content is requested by blob SHA. The app avoids inline display for:

- files over the safe size threshold,
- binary-like file paths,
- decoded content that appears binary.

## Comparison model

Version A ↕ Version B uses GitHub's compare API. The UI surfaces:

- added files,
- removed files,
- modified files,
- renamed files when detectable,
- patch hunks when GitHub returns them,
- additions/deletions totals,
- dependency manifest changes.

Dependency summaries are derived by fetching changed manifests at both refs and comparing normalized package/version maps.

## Preview model

RepoTimeMachine does **not** run historical application builds in the browser. Historical website preview is disabled in the current UI, so unsupported/build-only projects fall back to source exploration and comparison.

Future build preview support should be implemented as a separate sandbox service with strict limits, filesystem isolation, no secrets, network controls, dependency cache boundaries, and disposable workers.

## Caching

The cache stores safe public metadata and previously opened file content in memory and localStorage with TTLs. It avoids storing credentials because the current app does not require user tokens.

Recommended production improvement: move GitHub requests through a small backend/BFF to support authenticated rate limits, request signing, audit logging, cache revalidation, and abuse controls.

## Error handling

The UI maps expected failures to user-facing messages:

- repository unavailable,
- deleted or unreachable commits,
- unavailable files,
- API rate limits,
- huge/truncated repositories,
- binary files,
- unsupported project types,
- network failure.

## Security boundaries

- No repository code execution in the main app.
- Static preview uses `sandbox=""` and stripped scripts.
- No credentials are requested or stored.
- Public GitHub data only.
- Future build execution must use isolated infrastructure, not the web app environment.
