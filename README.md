# isolated-review

Deep code review of a single file, in isolation, from the command line. The tool reads one file — never the rest of the repo — sends it to an AI model with a focused reviewer prompt, and prints a structured set of findings. Optionally, a second model verifies and refines the first pass.

[![npm version](https://img.shields.io/npm/v/isolated-review.svg)](https://www.npmjs.com/package/isolated-review)
[![npm downloads](https://img.shields.io/npm/dm/isolated-review.svg)](https://www.npmjs.com/package/isolated-review)
[![node](https://img.shields.io/node/v/isolated-review.svg)](https://www.npmjs.com/package/isolated-review)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)

```bash
npm install -g isolated-review
review init        # one-time setup: keys + default model
review <file>
```

## Install

From npm (recommended):

```bash
npm install -g isolated-review
# or
pnpm add -g isolated-review
# or
bun install -g isolated-review
```

From source:

```bash
git clone https://github.com/dcccrypto/isolated-review
cd isolated-review
pnpm install && pnpm build && pnpm link --global
```

## Getting started

First-time setup is one command:

```bash
review init
```

It walks you through both API keys and your default model. After that, `review <file>` just works.

### Providers

You only need a key for whichever provider(s) you want to use.

| Provider | Get a key | Covers |
|---|---|---|
| **OpenRouter** | [openrouter.ai/keys](https://openrouter.ai/keys) | Claude, GPT, Gemini, Grok, Llama, etc. — **one key for everything** |
| Anthropic | [console.anthropic.com/settings/keys](https://console.anthropic.com/settings/keys) | Claude (direct) |
| OpenAI | [platform.openai.com/api-keys](https://platform.openai.com/api-keys) | GPT + o-series (direct) |

OpenRouter is the simplest path if you just want to try different models without signing up everywhere.

### Where keys are stored

Resolution order:

1. **Environment variables** (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `OPENROUTER_API_KEY`) — take precedence, useful in CI.
2. **Config file** `~/.config/isolated-review/config.json`, `chmod 600`, written by `review init` / `review keys`.
3. Override the location with `IR_CONFIG_DIR` if you need to.

Missing keys produce a clean error pointing you at `review keys`. Keys are never logged.

## Usage

```bash
review ./src/file.rs --model gpt-5.4
review ./src/file.rs --model gpt-5.4 --verify claude
review ./src/file.rs --notes "This handles settlement logic"
review ./src/file.rs --patch
```

### Commands

| Command | Purpose |
|---|---|
| `review <file>` | Review a single file (the default command). |
| `review init` | One-shot setup — keys + default model in one walk-through. |
| `review keys` | Set API keys only. |
| `review settings` | Set the default review model only. |

### Options

| Option | Description |
|---|---|
| `--model <name>` | Primary review model. Default: `claude` (or your `review settings` default). |
| `--verify <name>` | Optional second-pass verifier model. |
| `--notes "<text>"` | Extra context the reviewer should consider. |
| `--patch` | Ask the reviewer to include suggested patches (unified diff). |
| `--diff [base]` | Review only lines changed vs a git base (default: `HEAD`). Great for PR workflows. |
| `--json` | Emit machine-readable JSON (stable keys, no spinner, pipe into `jq`). |
| `--plain` | Disable color and unicode formatting (ASCII only). |

### Review only what changed

```bash
review src/file.ts --diff              # vs HEAD (unstaged + staged)
review src/file.ts --diff main         # vs the main branch
review src/file.ts --diff HEAD~1       # vs your previous commit
```

The tool sends the full file for context, but tells the reviewer to only report findings on the changed lines. Use this on every PR.

### Tokens and cost in the footer

Every pretty-mode review ends with a token + cost line, e.g.:

```
 ✓ Reviewed in 4.2s · 2 critical · 1 medium · 0 low
   2.8k in (1.2k cached) / 893 out · ~$0.104
```

Cost is estimated against a built-in price table for the latest Claude 4.x tier and common OpenAI models. Unknown models show tokens only, no `$`. Anthropic prompt caching (enabled automatically) makes the `cached` portion ~10× cheaper than fresh input tokens.

## Models

Pass anything recognised below to `--model` or set it as your default with `review settings`.

### Aliases (shorter to type)

| Alias | Resolves to | Provider |
|---|---|---|
| `claude`, `claude-sonnet` | `claude-sonnet-4-6` (latest Sonnet) | Anthropic |
| `claude-opus` | `claude-opus-4-7` (latest Opus) | Anthropic |
| `claude-haiku` | `claude-haiku-4-5-20251001` (latest Haiku) | Anthropic |

### Direct (pass-through to the named SDK)

| Pattern | Example | Provider |
|---|---|---|
| `claude-*` | `claude-opus-4-7` | Anthropic |
| `gpt-*` | `gpt-5.4`, `gpt-4o` | OpenAI |
| `o1-*`, `o3-*`, `o4-*` | `o3-mini` | OpenAI |

### OpenRouter (one key, every model)

Use the `vendor/model` format (OpenRouter's own convention) — anything with a slash routes through OpenRouter automatically:

```bash
review src/foo.ts --model anthropic/claude-3.5-sonnet
review src/foo.ts --model openai/gpt-4o
review src/foo.ts --model google/gemini-pro-1.5
review src/foo.ts --model x-ai/grok-2-1212
review src/foo.ts --model meta-llama/llama-3.3-70b-instruct
```

Browse the full catalogue at [openrouter.ai/models](https://openrouter.ai/models). You can also write `openrouter:<id>` explicitly if you prefer.

## Choosing a model

`--model <name>` overrides for a single run. To set a persistent default:

```bash
review settings          # interactive; pick any alias or explicit model name
review <file>            # now uses your default; no --model needed
```

Resolution order: `--model` flag → `defaultModel` from settings → `claude` (Sonnet).

## Output modes

- **Pretty** (default, TTY): titled header, summary, findings grouped by severity, exact file:line range under each finding, elapsed-time footer.
- **`--plain`**: same layout, ASCII only, no color — safe for logs and CI.
- **`--json`**: the raw `ReviewResult` object. Stable keys; pipe it into `jq` or another reviewer.

## How the review is shaped

The file is sent to the model with line numbers prepended (`  42 | <code>`) and a system prompt that enforces:

- every finding must cite a specific line range,
- no generic advice (no "consider adding tests", "handle errors", etc.),
- an empty `findings` array is a valid, good review when the file is clean,
- severity is defined concretely: `critical` = bug/security/crash in a realistic path, `medium` = concrete maintainability or correctness risk, `low` = localised nit with a clear fix.

When `--verify` is set, the second model gets the original file and the first review, and is told to drop weak findings, strengthen valid ones, and only add something genuinely missed.

## What gets sent where

- **Your API keys** never leave your machine. They live in your shell env or in `~/.config/isolated-review/config.json` (`chmod 600`, owner-only) and are used only to construct the SDK client in-process.
- **The file you review** is sent to the provider you selected (Anthropic, OpenAI, or OpenRouter), verbatim, with line numbers prepended. If the file contains anything sensitive (credentials, internal identifiers, PII), consider whether you want that provider to see it.
- **Prompts are cached** on Anthropic via `cache_control: ephemeral` on the system block — repeat runs within ~5 minutes hit the cache and cost ~90% less on the system prompt. OpenAI applies its own automatic prompt caching on longer prompts. OpenRouter passes caching through where the upstream model supports it.
- **Nothing is logged or phoned home** by this CLI itself — output goes to your terminal, exit code is all.

## What this tool won't do

By design. Rejecting these is the product.

- No repo-wide context, no multi-file ingestion, no symbol resolution.
- No agent loops, no memory, no streaming, no TUI.
- No auth, no databases, no telemetry.
- No auto-fix, no test generation, no git integration.

## Development

```bash
pnpm dev <file>          # run with tsx, no build step
pnpm test                # vitest run
pnpm test:watch          # vitest in watch mode
pnpm typecheck           # tsc --noEmit
pnpm build               # emit dist/
```

## License

[Apache 2.0](LICENSE) © Khubair Nasir
