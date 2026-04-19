# Security

## Reporting a vulnerability

If you think you've found a vulnerability in `isolated-review`, **please do not open a public GitHub issue or post about it on social media**. Report it privately first so a fix can ship before disclosure.

Preferred channel: **[GitHub Private Vulnerability Reporting](https://github.com/dcccrypto/isolated-review/security/advisories/new)**.

Fallback: email **khubairnasir26@gmail.com** with subject `isolated-review security`.

Expect:

- An acknowledgment within 48 hours.
- An initial assessment (confirmed / not applicable / duplicate) within 7 days.
- A fix released within 30 days of confirmation for actively exploitable issues, sooner for high-severity ones.
- Public credit in the changelog and advisory when the fix ships, unless you ask otherwise.

## What is in scope

- The published `isolated-review` package on npm.
- Code on the `main` branch of this repository.
- API keys handling, file I/O, and provider integrations.

## What is out of scope

- Third-party model outputs themselves (we don't vouch for what Anthropic / OpenAI / OpenRouter return).
- Bugs in `@anthropic-ai/sdk`, `openai`, or `@inquirer/prompts` — please report those upstream.
- Rate-limiting or billing issues with providers.

## Supply-chain posture

- **npm provenance**: every release is published from a pinned GitHub Actions workflow using OIDC (trusted publishing). Verify with `npm audit signatures` after install.
- **2FA**: publish requires 2FA (OTP or OIDC).
- **`pnpm audit`**: runs in CI on every push and on every release; production dependencies must be clean to publish.
- **Frozen lockfile**: CI and publish installs use `--frozen-lockfile`.
- **Minimal runtime deps**: 6 direct runtime dependencies, all from well-known maintainers.

## Verifying a release

```bash
npm install -g isolated-review
npm audit signatures
```

`npm audit signatures` will confirm the tarball's provenance attestation points at this repository and the `.github/workflows/publish.yml` workflow.
