# isolated-review

Deep code review of a single file, in isolation, from the command line. The tool reads one file — never the rest of the repo — sends it to an AI model with a focused reviewer prompt, and prints a structured set of findings. Optionally, a second model verifies and refines the first pass.

[![npm version](https://img.shields.io/npm/v/isolated-review.svg)](https://www.npmjs.com/package/isolated-review)
[![npm downloads](https://img.shields.io/npm/dm/isolated-review.svg)](https://www.npmjs.com/package/isolated-review)
[![node](https://img.shields.io/node/v/isolated-review.svg)](https://www.npmjs.com/package/isolated-review)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)

```bash
npm install -g isolated-review
review init        # one-time setup (pastes your API keys + picks a default model)
review --pick      # opens a file picker — arrow keys, type to filter, enter to review
```

That's it. Three commands, done.

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

Missing keys produce a clean error pointing you at `review keys`. Keys are **hidden as you paste them** in `review init` / `review keys` (rendered as `*`), and never echoed or logged.

### Paste-immune key entry

If a very long key truncates on paste (some terminals do this), bypass the interactive prompt entirely:

```bash
# From a variable (recommended — nothing ends up in shell history):
read -s ANTH_KEY                                          # silent prompt, paste here
printf %s "$ANTH_KEY" | review keys --provider anthropic --from-stdin
unset ANTH_KEY

# From a file:
review keys --provider openrouter --from-file ~/or-key.txt
```

After every save the CLI echoes a fingerprint (`len=108 sk-a…NeAA`) so you can instantly confirm the saved value matches what you pasted.

### Verifying the install

Every release is published from a pinned GitHub Actions workflow with [npm provenance](https://docs.npmjs.com/generating-provenance-statements) — a sigstore-backed attestation tying each tarball to the commit that built it. After installing, you can verify it yourself:

```bash
npm audit signatures
```

See [`SECURITY.md`](SECURITY.md) for the full supply-chain posture and vulnerability reporting channel.

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
| `review status` | Show current config (keys set, default model, prompts). |
| `review doctor` | Offline health check: Node version, git, config readable, key formats, clipboard backend, default model resolves. |
| `review prompts` | List prompt presets. Subcommands: `new`, `edit`, `show`, `generate`. |
| `review completion <shell>` | Print a shell completion script for `bash`, `zsh`, or `fish`. See "Shell completion" below. |
| `review --last` | Rerun the previous review (same file + flags). Override any flag to change that one. |

### Options

| Option | Description |
|---|---|
| `--pick` | Interactive file picker — fuzzy search across the current directory. Typing narrows the list. |
| `--model <name>` | Primary review model. Default: `claude` (or your `review settings` default). |
| `--verify <name>` | Optional second-pass verifier model. |
| `--notes "<text>"` | Extra context the reviewer should consider. |
| `--patch` | Ask the reviewer to include suggested patches (unified diff). |
| `--diff [base]` | Review only lines changed vs a git base (default: `HEAD`). Great for PR workflows. Falls back to a full-file review with a stderr note for untracked files. |
| `--effort <level>` | Reasoning effort: `none` / `minimal` / `low` / `medium` / `high` / `xhigh`. Maps to Anthropic extended thinking, OpenAI `reasoning_effort`, or OpenRouter `reasoning.effort`. See "Reasoning effort" below. |
| `--copy` | After the review, copy a pasteable markdown summary (for Slack / PR comments / Linear) to the system clipboard. No waiting; just happens. |
| `--open` | Open the first critical finding at its line in `$EDITOR` / `$VISUAL` (falls back to `code`, `open`, `xdg-open`). |
| `--fail-on <severity>` | Exit code 2 if any finding at or above the level exists: `critical` / `medium` / `low`. For CI gates, git hooks. |
| `--last` | Rerun the previous review. Any flag you also pass overrides the last one. |
| `--prompt <name>` | Use a named prompt preset. Run `review prompts` to see the full list. Default: `default`. |
| `--prompt-file <path>` | Use the system prompt from an ad-hoc file (no need to install it into the config dir). Mutually exclusive with `--prompt`. |
| `--json` | Emit machine-readable JSON (stable keys, no spinner, pipe into `jq`). |
| `--plain` | Disable color and unicode formatting (ASCII only). |

### Specialised prompts

Pick the angle that fits the file:

```bash
review src/auth.ts --prompt security    # security-only review
review src/router.ts --prompt perf      # perf-only review
review src/legacy.ts --prompt refactor  # design + maintainability review
review src/foo.ts                        # default = balanced full-spectrum
```

`review prompts` lists everything available. Built-in: `default`, `security`, `perf`, `refactor`.

You can write your own — the easy way:

```bash
# Let AI write it for you from a one-line description:
review prompts generate anchor-audit "Solana Anchor programs, focus on signer/PDA/CPI safety"

# Or scaffold a template and fill it in yourself:
review prompts new anchor-audit    # scaffolds a template and opens $EDITOR

# Iterate on an existing prompt:
review prompts edit anchor-audit
review prompts show anchor-audit   # print it back (handy for debugging)

# Use it:
review src/program.rs --prompt anchor-audit
```

Or point at a file directly for a one-off (no install into the config dir):

```bash
review src/foo.ts --prompt-file ./weird-edge-case.md
```

The schema instruction is appended automatically — your file just needs the system-prompt body.

### Don't want to type the path?

```bash
review --pick                      # choose any source file in the current dir
review --pick --verify claude      # picker + verifier pass
review --pick --diff main          # pick a file, review only its diff vs main
```

The picker walks the current directory (skipping `node_modules`, `dist`, `.git`, etc.), shows matches as you type, and hands the choice straight into the normal review flow. All your other flags work alongside it.

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

- **Pretty** (default, TTY): titled header, summary, findings grouped by severity, exact `file:line` range under each finding (click-through in iTerm / kitty / wezterm / VS Code terminal via OSC 8 hyperlinks), elapsed-time footer with token + cost breakdown. Live token-count + elapsed-seconds ticker during generation so long reviews don't feel frozen.
- **`--plain`**: same layout, ASCII only, no color, no hyperlinks — safe for logs and CI.
- **`--json`**: a versioned envelope wrapping the findings. Stable schema, pipe it into `jq` or any tool.

### JSON envelope shape

```json
{
  "schemaVersion": 1,
  "file": "/abs/path/src/foo.ts",
  "model": "claude-opus-4-7",
  "verifierModel": "gpt-4o",
  "elapsedMs": 4231,
  "usage": { "inputTokens": 2847, "outputTokens": 893, "cachedInputTokens": 1200 },
  "estimatedCostUsd": 0.104,
  "result": {
    "summary": "…",
    "findings": [ /* Finding[] */ ],
    "notes": "…"
  }
}
```

`schemaVersion` will never change silently — a future breaking change bumps it.

## How the review is shaped

The file is sent to the model with line numbers prepended (`  42 | <code>`) and a system prompt that enforces:

- every finding must cite a specific line range,
- no generic advice (no "consider adding tests", "handle errors", etc.),
- an empty `findings` array is a valid, good review when the file is clean,
- severity is defined concretely: `critical` = bug/security/crash in a realistic path, `medium` = concrete maintainability or correctness risk, `low` = localised nit with a clear fix.

Each finding gets a **category** tag alongside severity — one of `correctness`, `security`, `performance`, `maintainability`, or `style`. The pretty renderer shows it inline:

```
  ● Off-by-one allows index out of bounds  [correctness]
    src/foo.ts:42-48
    for (let i = 0; i <= arr.length; i++) { use(arr[i]); }
    Loop runs one past the last index, dereferencing arr[arr.length]…
    Fix — Change `<=` to `<`, or iterate with `for (const x of arr)`.
```

When `--verify` is set, the second model gets the original file and the first review, and is told to drop weak findings, strengthen valid ones, and only add something genuinely missed.

### Reasoning effort

Most 2025/2026-era frontier models expose a "think harder" dial. `--effort <level>` maps to each provider's native parameter:

```bash
review src/tricky.ts --model claude-opus-4-7 --effort high      # ~16k thinking tokens
review src/tricky.ts --model claude-opus-4-7 --effort xhigh     # ~32k thinking tokens
review src/tricky.ts --model gpt-5.4          --effort high     # reasoning_effort: high
review src/tricky.ts --model gpt-5.4          --effort xhigh    # reasoning_effort: xhigh  (5.2+)
review src/tricky.ts --model o3-mini          --effort high     # reasoning_effort: high
review src/tricky.ts --model anthropic/claude-3.5-sonnet --effort high  # OpenRouter reasoning.effort
```

**How each provider interprets it:**

| Level | Anthropic Claude 4.x | OpenAI GPT-5 / o-series | OpenRouter |
|---|---|---|---|
| `none` | thinking disabled (same as not passing) | `reasoning_effort: none` (GPT-5.2+) | `reasoning.effort: none` |
| `minimal` | thinking disabled | `reasoning_effort: minimal` (older GPT-5) | pass-through |
| `low` | `thinking.budget_tokens: 2048` | `reasoning_effort: low` | pass-through |
| `medium` | `thinking.budget_tokens: 8192` | `reasoning_effort: medium` | pass-through |
| `high` | `thinking.budget_tokens: 16384` | `reasoning_effort: high` | pass-through |
| `xhigh` | `thinking.budget_tokens: 32768` | `reasoning_effort: xhigh` (GPT-5.2+) | pass-through |

Notes:
- Extended thinking and `reasoning_effort` both **increase cost** (thinking tokens are billed as output). Start with `medium` when in doubt.
- Claude Haiku and non-reasoning OpenAI models (`gpt-4o` family) don't support the dial — `--effort` is silently ignored for them.
- Not every OpenAI model accepts every level. `xhigh` and `none` exist only on GPT-5.2+. `minimal` is older-GPT-5 only. o-series accepts `low | medium | high`. If the API rejects the level, you'll get a clean 400 — pick a level the model supports.

### Share the result

After any pretty-mode review, a `[c] copy markdown  [q] quit` bar appears. Press `c` and a clean markdown summary — title + model/cost/count line + grouped findings with `file:line` anchors and fixes — lands on your clipboard, ready to paste into Slack, a PR comment, a Linear ticket, or an email. Press `q` or Enter to skip. The prompt auto-exits after 10 seconds.

For scripts and aliases, skip the hint and copy unconditionally:

```bash
review src/foo.ts --copy
```

Clipboard backends: `pbcopy` (macOS), `clip` (Windows), `wl-copy` / `xclip` / `xsel` (Linux — tried in that order). If none are installed the copy fails with a clean message; the review output itself is unaffected.

### CI-friendly exit codes + `--fail-on`

```bash
review src/payment.ts --fail-on critical        # exit 2 if any critical finding
review src/payment.ts --fail-on medium          # exit 2 if medium or critical
review src/payment.ts --fail-on low             # exit 2 if any finding
```

| Exit code | Meaning |
|---|---|
| `0` | Success, threshold not met |
| `1` | Tool error (missing key, bad model, file not found) |
| `2` | Findings meet the `--fail-on` threshold |

Drop into a git pre-commit hook:

```bash
#!/usr/bin/env bash
# .git/hooks/pre-commit
for f in $(git diff --cached --name-only --diff-filter=AM | grep -E '\.(ts|tsx|js|py|rs|go)$'); do
  review "$f" --diff --cached --fail-on critical --plain || exit 1
done
```

### Keyboard shortcuts after a pretty review

```
 [c] copy  [o] open first critical  [q] quit  (auto-exits in 10s)
```

- **c** — copy the markdown summary to your clipboard
- **o** — open the first critical finding at its line in `$EDITOR` / `$VISUAL` (falls back to `code`, `open`, `xdg-open`)
- **q** / Enter / any other key — exit silently

Use `--copy` or `--open` as flags for non-interactive / scripted usage (no waiting, no prompt).

### `review --last`

Rerun the previous review. Any flag you pass overrides that one bit.

```bash
review src/auth.ts --prompt security --model claude-opus --effort high
# ... review runs ...

# later, after editing the file:
review --last                                  # same file, same prompt, same model, same effort
review --last --model gpt-5.4                  # same file & flags, different model
review --last --effort xhigh                   # same file & flags, harder thinking
```

### `review doctor`

Offline sanity check — no API calls, just confirms your setup is healthy:

```
 review doctor  · offline health check
 ───────────────────────────────────────────────
 ✓  Node version       v22.12.0
 ✓  git                found in PATH (required for --diff)
 ✓  Config file        /Users/khubair/.config/isolated-review/config.json
 ✓  Anthropic key      len=108 sk-a…eAAA
 ◆  OpenAI key         not set
 ✓  OpenRouter key     len=73 sk-o…xZ3K
 ✓  Default model      claude → anthropic (claude-sonnet-4-6)
 ✓  Clipboard backend  pbcopy
 ✓  User prompts dir   /Users/khubair/.config/isolated-review/prompts · 2 user prompts
```

Run this first when something feels off. Covers: Node version, git in PATH, config readable, key format (length + prefix + length sanity — catches paste-truncation issues), clipboard backend, and whether your default model actually points at a provider you have a key for.

### Shell completion

Tab-completion for all subcommands, flags, model aliases, effort levels, and prompt names (including your user prompts):

```bash
# zsh
review completion zsh > ~/.zfunc/_review
# make sure ~/.zfunc is on fpath (in .zshrc):
#   fpath=(~/.zfunc $fpath)
#   autoload -Uz compinit && compinit

# bash
review completion bash > ~/.bash_completion.d/review
echo 'source ~/.bash_completion.d/review' >> ~/.bashrc

# fish
review completion fish > ~/.config/fish/completions/review.fish
```

Reload the shell and Tab-completion works. The script includes install instructions at the top.

### Scripted init (Dockerfiles / CI)

For non-interactive setup in containers, CI, or dotfile managers:

```bash
# From an env var
review init --provider anthropic --key "$ANTHROPIC_API_KEY" --default-model claude-opus --yes

# From stdin (recommended for long keys — no shell history, no buffer truncation)
echo -n "$KEY" | review init --provider openrouter --key - --default-model anthropic/claude-3.5-sonnet --yes

# From a file
review init --provider openai --key @/run/secrets/openai_key --default-model gpt-5.4 --yes
```

### Reliability

- **Streaming** — the CLI streams the model's response token-by-token. You see live progress (`3.2kB · 7.4s`) instead of a frozen spinner, even on 20-second reviews.
- **Retry with backoff** — transient failures (HTTP 429 / 500 / 502 / 503 / 504 / network resets, overloaded-provider messages) are retried automatically with a 1s → 3s backoff. Auth errors and 4xx validation errors fail fast.

## What gets sent where

- **Your API keys** never leave your machine. They live in your shell env or in `~/.config/isolated-review/config.json` (`chmod 600`, owner-only) and are used only to construct the SDK client in-process.
- **The file you review** is sent to the provider you selected (Anthropic, OpenAI, or OpenRouter), verbatim, with line numbers prepended. If the file contains anything sensitive (credentials, internal identifiers, PII), consider whether you want that provider to see it.
- **Prompts are cached** on Anthropic via `cache_control: ephemeral` on the system block — repeat runs within ~5 minutes hit the cache and cost ~90% less on the system prompt. OpenAI applies its own automatic prompt caching on longer prompts. OpenRouter passes caching through where the upstream model supports it.
- **Nothing is logged or phoned home** by this CLI itself — output goes to your terminal, exit code is all.

## Troubleshooting

| Symptom | Likely cause / fix |
|---|---|
| `401 invalid x-api-key` | Key revoked, truncated on paste, or wrong workspace. Rotate and resave via `--from-stdin`. Check the fingerprint length matches what you expect (~108 chars for Anthropic, ~164 for OpenAI). |
| `no <provider> API key found` | Run `review keys` and add a key for that provider. |
| `unknown model: …` | Use an alias (`claude`, `claude-opus`, etc.), a recognised prefix (`claude-*`, `gpt-*`, `o[134]-*`), or `vendor/model` for OpenRouter. |
| `--diff requires a git repository` | `cd` into a git-tracked directory. |
| `no changes vs <base>` | The file has no diff against `<base>`. Omit `--diff` for a full review, or pick a different base. |
| `--pick needs an interactive terminal` | You're piping / in CI — pass the file path directly instead. |
| Paste truncated a key | Use `review keys --provider <name> --from-stdin` to bypass the masked paste entirely. |
| Want to see current config at a glance | `review status` — shows every key's fingerprint, default model, and available prompts. |

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
