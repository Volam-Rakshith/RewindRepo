# Contributing to RepoTimeMachine

Thank you for helping improve RepoTimeMachine by VR Developments.

## Development workflow

1. Fork and clone the repository.
2. Install dependencies:

   ```bash
   npm install
   ```

3. Start the app:

   ```bash
   npm run dev
   ```

4. Run checks before submitting:

   ```bash
   npm test
   npm run build
   ```

## Contribution guidelines

- Keep user safety and clear limitations central to every feature.
- Do not add code that executes arbitrary repository code in the main web app.
- Prefer GitHub API/object based retrieval over full clone workflows.
- Add tests for parsing, diffing, preview safety, and API-state handling.
- Keep the interface accessible, responsive, and dark-first.

## Commit style

Use concise, descriptive commit messages, for example:

- `feat: add tag markers to timeline`
- `fix: handle truncated GitHub trees`
- `test: cover package manifest diffing`

## Pull requests

A good PR includes:

- a short problem statement,
- implementation notes,
- screenshots or recordings for UI changes,
- test coverage or an explanation when tests are not applicable,
- security implications if the change touches preview/build behavior.
