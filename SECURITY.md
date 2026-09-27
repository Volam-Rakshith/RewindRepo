# Security Policy

## Supported versions

RepoTimeMachine is currently in early development. Security fixes target the latest `main` branch unless maintainers publish versioned releases.

## Reporting a vulnerability

Please report vulnerabilities privately to the maintainers of VR Developments before public disclosure. Include:

- affected component,
- reproduction steps,
- impact,
- suggested mitigation if known.

## Security model

RepoTimeMachine is designed around a strict safety boundary:

- It uses public GitHub information only.
- It does not request or store user GitHub credentials.
- It does not execute arbitrary repository code in the main app environment.
- Static HTML preview strips scripts and renders with a sandboxed iframe.
- Build-based previews must be implemented only in a disposable, isolated sandbox.

## Out of scope

The following are expected limitations rather than vulnerabilities:

- GitHub anonymous API rate limits.
- Missing data for deleted or unreachable Git objects.
- Truncated trees for very large repositories.
- Source-only fallback for unsupported project types.
