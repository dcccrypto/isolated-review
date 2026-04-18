# isolated-review

Deep code review of a single file, in isolation, from the command line. The tool reads one file — never the rest of the repo — sends it to an AI model with a focused reviewer prompt, and prints a structured set of findings. Optionally, a second model verifies and refines the first pass.

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)

## Install

```bash
pnpm install
pnpm build
pnpm link --global
review --help
```

## API keys

You only need a key for whichever provider(s) you plan to use. There are three ways to set them, in resolution order:

1. **`review keys`** (recommended) — interactive prompt, saves to `~/.config/isolated-review/config.json` with `chmod 600`.

   ```bash
   review keys
   ```

   Existing values are masked in the preview (`sk-a…K9fF`). Leave a field blank to keep it, or type `-` to clear it.

2. **Environment variables** — take precedence over the config file, useful in CI or one-shot sessions.

   ```bash
   export ANTHROPIC_API_KEY=sk-ant-...
   export OPENAI_API_KEY=sk-...
   ```

3. **Override the config location** — set `IR_CONFIG_DIR` to use a directory other than `~/.config/isolated-review`.

Missing keys produce a clean error pointing you at `review keys`, never a stack trace. Keys are never logged.

## Usage

```bash
review ./src/file.rs --model gpt-5
review ./src/file.rs --model gpt-5 --verify claude
review ./src/file.rs --notes "This handles settlement logic"
review ./src/file.rs --patch
```

### Commands

| Command | Purpose |
|---|---|
| `review <file>` | Review a single file (the default command). |
| `review keys` | Interactively set API keys (writes `~/.config/isolated-review/config.json`, `chmod 600`). |
| `review settings` | Interactively set the default review model (same config file). |

### Options

| Option | Description |
|---|---|
| `--model <name>` | Primary review model. Default: `claude`. |
| `--verify <name>` | Optional second-pass verifier model. |
| `--notes "<text>"` | Extra context the reviewer should consider. |
| `--patch` | Ask the reviewer to include suggested patches (unified diff). |
| `--json` | Emit machine-readable JSON (stable keys, no spinner, pipe into `jq`). |
| `--plain` | Disable color and unicode formatting (ASCII only). |

## Model aliases

You can pass any model name the underlying SDK accepts. These short aliases are also recognised:

| Alias | Resolves to | Provider |
|---|---|---|
| `claude`, `claude-sonnet` | `claude-sonnet-4-6` (latest Sonnet) | Anthropic |
| `claude-opus` | `claude-opus-4-7` (latest Opus) | Anthropic |
| `claude-haiku` | `claude-haiku-4-5-20251001` (latest Haiku) | Anthropic |
| `claude-*` | passed through | Anthropic |
| `gpt-*` | passed through | OpenAI |
| `o1-*`, `o3-*`, `o4-*` | passed through | OpenAI |

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
