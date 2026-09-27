# RepoTimeMachine

**RepoTimeMachine by VR Developments**  
_Tagline: Explore a repository across time._

RepoTimeMachine lets users inspect a public GitHub repository at different points in its history. Enter a repository, choose a branch, select a commit/tag/release/date, and inspect the reconstructed source tree without cloning the whole repository into the browser.

## What it does

- Accepts public GitHub repository URLs, SSH URLs, and `owner/repo` shorthand.
- Displays a time-machine style timeline of commits, tags, releases, and activity periods.
- Reconstructs historical source trees at selected commits using GitHub Git object APIs.
- Lazily opens source files, READMEs, configuration files, and manifests.
- Compares Version A ↕ Version B with added, removed, modified, and renamed files where GitHub can detect them.
- Summarizes dependency changes across common manifest types.
- Provides a safe historical preview only when the repository state contains a static HTML entry or README source.
- Handles API rate limits, unavailable repositories, binary files, huge/truncated trees, and unsupported build-only projects with clear messages.

## Safety principles

RepoTimeMachine **does not execute arbitrary repository code** in the main application environment. Static HTML preview is rendered in a sandboxed iframe with scripts removed. Build-based preview support should only be added with a separate isolated sandbox.

## Architecture at a glance

- **Frontend:** React + TypeScript + Vite.
- **Data:** Public GitHub REST APIs.
- **Archive model:** no full clone, no browser-side Git checkout; uses commits, tags, releases, trees, blobs, contents, and compare endpoints.
- **Caching:** short-lived localStorage + in-memory cache for safe public metadata and file content.
- **Tests:** Vitest unit tests for parsing, dependency diffing, and preview safety logic.

See [`docs/architecture.md`](docs/architecture.md) for the detailed design.

## Getting started

```bash
npm install
npm run dev
```

Open the Vite URL shown in the terminal.

## Scripts

```bash
npm run dev       # start development server
npm run build     # type-check and produce production build
npm run preview   # preview production build
npm test          # run unit tests
npm run lint      # TypeScript validation
```

## Limitations

GitHub's public anonymous API is rate limited. Large repositories may return truncated trees. Some commits, tags, or releases may be unavailable if Git objects were deleted or force-pushed away. RepoTimeMachine does not claim arbitrary historical websites can always be rebuilt or executed.

## License

MIT © VR Developments
