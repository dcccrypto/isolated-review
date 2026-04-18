# isolated-review

Deep code review of a single file, in isolation, from the command line. The tool reads one file — never the rest of the repo — sends it to an AI model with a focused reviewer prompt, and prints a structured set of findings. Optionally, a second model verifies and refines the first pass.

## Install

```bash
pnpm install
pnpm build
pnpm link --global
review --help
```

## Environment

Set your API keys. Either export them in your shell or copy `.env.example` to `.env` and source it.

```bash
export ANTHROPIC_API_KEY=sk-ant-...
export OPENAI_API_KEY=sk-...
```

You only need the key for whichever provider(s) you use. Missing keys produce a clean error, not a stack trace.

## Usage

```bash
review ./src/file.rs --model gpt-5
review ./src/file.rs --model gpt-5 --verify claude
review ./src/file.rs --notes "This handles settlement logic"
review ./src/file.rs --patch
```

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
| `claude` | `claude-sonnet-4-5-20250929` | Anthropic |
| `claude-opus` | `claude-opus-4-6` | Anthropic |
| `claude-*` | passed through | Anthropic |
| `gpt-*` | passed through | OpenAI |
| `o1-*`, `o3-*`, `o4-*` | passed through | OpenAI |

## Output modes

- **Pretty** (default, TTY): titled header, summary, findings grouped by severity, elapsed-time footer.
- **`--plain`**: same layout, ASCII only, no color — safe for logs and CI.
- **`--json`**: the raw `ReviewResult` object. Stable keys; pipe it into `jq` or another reviewer.

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
