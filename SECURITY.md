# Security Policy

## Supported Versions

Tyravex is currently in early development and has not reached a stable production release.

| Version | Security Support |
|---|---|
| Development builds | Best effort |
| Stable releases | Not yet available |

Development builds are not recommended for production use.

## Reporting a Vulnerability

**Do not report security vulnerabilities in public GitHub issues or discussions.**

Use GitHub's private vulnerability reporting feature, if enabled for this repository:

1. Open the Tyravex panel repository.
2. Select the **Security** tab.
3. Choose **Report a vulnerability**.
4. Provide a clear description and reproduction steps.

If private vulnerability reporting is not yet enabled, please wait for the maintainers to publish an approved private reporting channel. Do not publish exploit details publicly.

## What to Include

When possible, include:

- A description of the vulnerability
- Affected component and version or commit
- Steps to reproduce
- Potential security impact
- Suggested mitigation, if known

Avoid including real user data, live credentials, or unnecessary sensitive information.

## Responsible Disclosure

Please allow maintainers a reasonable opportunity to investigate and address reported vulnerabilities before public disclosure.

## Security Practices

Contributors should:

- Never commit secrets or production credentials.
- Validate and sanitize untrusted input.
- Enforce authentication and authorization on the backend.
- Follow least-privilege principles.
- Review dependencies and security-sensitive changes.
- Avoid exposing Docker or node-management privileges unnecessarily.

## Production Use

Tyravex is not currently considered production-ready. Deploy development versions only in controlled environments where the associated risks are understood.