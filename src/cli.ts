#!/usr/bin/env node
import { Command } from 'commander';
import { runReview, meetsFailThreshold, type ReviewOpts } from './commands/review.js';
import { EFFORT_LEVELS, type Effort } from './providers/types.js';
import { copyToClipboard } from './utils/clipboard.js';
import { waitForKey } from './utils/keypress.js';
import { createTheme } from './utils/theme.js';
import { openAtLine } from './utils/open.js';
import { runDoctor } from './commands/doctor.js';
import { runCompletion } from './commands/completion.js';
import { loadLastRun, saveLastRun } from './utils/config.js';
import { runKeysSetup } from './commands/keys.js';
import { runSettings } from './commands/settings.js';
import { runInit } from './commands/init.js';
import { pickFile } from './commands/pick.js';
import { runListPrompts, runPromptNew, runPromptEdit, runPromptShow } from './commands/prompts.js';
import { runPromptGenerate } from './commands/promptGenerate.js';
import { runStatus } from './commands/status.js';

const program = new Command();

program
  .name('review')
  .description('Deep code review of a single file in isolation')
  .version('0.11.0');

function wrap(fn: () => Promise<string>) {
  return async () => {
    try {
      process.stdout.write(await fn());
    } catch (e) {
      if (e instanceof Error && e.name === 'ExitPromptError') {
        console.error('cancelled.');
        process.exit(130);
      }
      console.error(`error: ${e instanceof Error ? e.message : String(e)}`);
      process.exit(1);
    }
  };
}

function wrapArg<A>(fn: (arg: A) => Promise<string>) {
  return async (arg: A) => {
    try {
      process.stdout.write(await fn(arg));
    } catch (e) {
      if (e instanceof Error && e.name === 'ExitPromptError') {
        console.error('cancelled.');
        process.exit(130);
      }
      console.error(`error: ${e instanceof Error ? e.message : String(e)}`);
      process.exit(1);
    }
  };
}

program
  .command('init')
  .description('One-shot setup: API keys + default model. Also supports --provider/--key/--default-model/--yes for scripts.')
  .option('--provider <name>',      'anthropic | openai | openrouter (requires --key)')
  .option('--key <value>',          'API key value, "@/path/to/file", or "-" to read from stdin')
  .option('--default-model <name>', 'set the default model at the same time')
  .option('--yes',                  'confirm non-interactive mode without any prompts')
  .action(async (opts: { provider?: 'anthropic' | 'openai' | 'openrouter'; key?: string; defaultModel?: string; yes?: boolean }) => {
    try {
      process.stdout.write(await runInit(opts));
    } catch (e) {
      if (e instanceof Error && e.name === 'ExitPromptError') { console.error('cancelled.'); process.exit(130); }
      console.error(`error: ${e instanceof Error ? e.message : String(e)}`);
      process.exit(1);
    }
  });

program
  .command('keys')
  .description('Set API keys (Anthropic, OpenAI, OpenRouter). Use --from-stdin for paste-immune entry.')
  .option('--provider <name>',  'which provider to set (required with --from-stdin or --from-file)')
  .option('--from-stdin',       'read the key from stdin (no terminal paste, no truncation risk)')
  .option('--from-file <path>', 'read the key from a file')
  .action(async (opts: { provider?: 'anthropic'|'openai'|'openrouter'; fromStdin?: boolean; fromFile?: string }) => {
    try {
      const out = await runKeysSetup(opts);
      process.stdout.write(out);
    } catch (e) {
      if (e instanceof Error && e.name === 'ExitPromptError') {
        console.error('cancelled.');
        process.exit(130);
      }
      console.error(`error: ${e instanceof Error ? e.message : String(e)}`);
      process.exit(1);
    }
  });

program
  .command('settings')
  .description('Set the default review model')
  .action(wrap(runSettings));

program
  .command('status')
  .description('Show current config: keys set, default model, prompts available')
  .action(wrap(runStatus));

program
  .command('doctor')
  .description('Offline health check: Node, git, config, key formats, clipboard, default model')
  .action(wrap(runDoctor));

program
  .command('completion <shell>')
  .description('Print a shell completion script (bash | zsh | fish). Install instructions in the script comments.')
  .action(async (shell: string) => {
    try {
      process.stdout.write(await runCompletion(shell));
    } catch (e) {
      console.error(`error: ${e instanceof Error ? e.message : String(e)}`);
      process.exit(1);
    }
  });

const promptsCmd = program
  .command('prompts')
  .description('List and manage prompt presets')
  .action(wrap(runListPrompts));
promptsCmd.command('new <name>')
  .description('Scaffold a user prompt and open it in $EDITOR')
  .action(wrapArg(runPromptNew));
promptsCmd.command('edit <name>')
  .description('Open an existing user prompt in $EDITOR')
  .action(wrapArg(runPromptEdit));
promptsCmd.command('show <name>')
  .description('Print a prompt to stdout (for inspection/debugging)')
  .action(wrapArg(runPromptShow));
promptsCmd.command('generate [name] [description]')
  .description('AI-generate a custom reviewer prompt from a one-line description')
  .action(async (name: string | undefined, description: string | undefined) => {
    try {
      process.stdout.write(await runPromptGenerate(name, description));
    } catch (e) {
      if (e instanceof Error && e.name === 'ExitPromptError') {
        console.error('cancelled.');
        process.exit(130);
      }
      console.error(`error: ${e instanceof Error ? e.message : String(e)}`);
      process.exit(1);
    }
  });

program
  .argument('[file]',            'path to the file to review (omit with --pick to choose interactively)')
  .option('--pick',              'interactively pick a file from the current directory', false)
  .option('--model <name>',      'primary review model (default: from settings, or "claude")')
  .option('--verify <name>',     'optional second-pass verifier model')
  .option('--notes <text>',      'extra context for the reviewer')
  .option('--patch',             'ask for suggested patch/diff ideas', false)
  .option('--diff [base]',       'review only lines changed vs a git base (default: HEAD)')
  .option('--effort <level>',    `reasoning effort: ${EFFORT_LEVELS.join(' | ')}. Claude 4.x maps to extended thinking budget; GPT-5.x / o-series maps to reasoning_effort; OpenRouter passes through.`)
  .option('--prompt <name>',     'use a named prompt preset (run "review prompts" to list)', 'default')
  .option('--prompt-file <path>','use the system prompt from an ad-hoc file (mutually exclusive with --prompt)')
  .option('--copy',              'copy a shareable markdown summary to the clipboard after the review', false)
  .option('--open',              'open the first critical finding in $EDITOR after the review', false)
  .option('--fail-on <severity>','exit 2 if any finding >= severity exists (critical | medium | low). For CI gates and pre-commit hooks.')
  .option('--last',              're-run the previous review (same file + flags, unless overridden)', false)
  .option('--json',              'emit machine-readable JSON', false)
  .option('--plain',             'disable color and unicode formatting', false)
  .action(async (file: string | undefined, rawOpts: Omit<ReviewOpts, 'diff' | 'effort' | 'failOn'> & { diff?: string | boolean; pick?: boolean; effort?: string; copy?: boolean; open?: boolean; failOn?: string; last?: boolean }) => {
    const d = rawOpts.diff;
    const diff: string | undefined =
      d === undefined || d === false ? undefined
      : d === true ? 'HEAD'
      : d;
    let effort: Effort | undefined;
    if (rawOpts.effort !== undefined) {
      if (!(EFFORT_LEVELS as readonly string[]).includes(rawOpts.effort)) {
        console.error(`error: invalid --effort value "${rawOpts.effort}". valid: ${EFFORT_LEVELS.join(', ')}`);
        process.exit(1);
      }
      effort = rawOpts.effort as Effort;
    }
    let failOn: 'critical' | 'medium' | 'low' | undefined;
    if (rawOpts.failOn !== undefined) {
      if (!['critical', 'medium', 'low'].includes(rawOpts.failOn)) {
        console.error(`error: invalid --fail-on value "${rawOpts.failOn}". valid: critical, medium, low`);
        process.exit(1);
      }
      failOn = rawOpts.failOn as 'critical' | 'medium' | 'low';
    }
    let opts: ReviewOpts = { ...rawOpts, diff, effort, failOn };
    try {
      let target = file;
      if (rawOpts.last) {
        const last = loadLastRun();
        if (!last) {
          console.error('error: no previous review recorded yet. Run `review <file>` at least once first.');
          process.exit(1);
        }
        target = target ?? last.file;
        opts = {
          ...last,
          ...opts,
          model: opts.model ?? last.model,
          verify: opts.verify ?? last.verify,
          prompt: opts.prompt ?? last.prompt,
          promptFile: opts.promptFile ?? last.promptFile,
          effort: (opts.effort ?? last.effort) as Effort | undefined,
          patch: opts.patch ?? last.patch ?? false,
          diff: opts.diff ?? last.diff,
          notes: opts.notes ?? last.notes,
          failOn
        };
      }
      if (!target && rawOpts.pick) {
        target = await pickFile(process.cwd());
      }
      if (!target) {
        console.error('error: missing file. Pass a path, or use --pick for an interactive picker.');
        process.exit(1);
      }
      const output = await runReview(target, opts);
      try {
        saveLastRun({
          file: target,
          model: opts.model,
          verify: opts.verify,
          prompt: opts.prompt,
          promptFile: opts.promptFile,
          effort: opts.effort,
          patch: opts.patch,
          diff: opts.diff,
          notes: opts.notes,
          ranAt: new Date().toISOString()
        });
      } catch { /* last-run cache is a nice-to-have, never break the review */ }
      console.log(output.text);
      await postRender(output, { autoCopy: !!rawOpts.copy, autoOpen: !!rawOpts.open, json: opts.json, plain: opts.plain });
      if (failOn && meetsFailThreshold(output.findings, failOn)) {
        process.exit(2);
      }
    } catch (e) {
      if (e instanceof Error && e.name === 'ExitPromptError') {
        console.error('cancelled.');
        process.exit(130);
      }
      console.error(`error: ${e instanceof Error ? e.message : String(e)}`);
      process.exit(1);
    }
  });

interface PostRenderContext {
  autoCopy: boolean;
  autoOpen: boolean;
  json: boolean;
  plain: boolean;
}

async function postRender(output: { markdown?: string; firstCritical?: { filePath: string; startLine: number } }, ctx: PostRenderContext): Promise<void> {
  const t = createTheme({ plain: ctx.plain });

  if (ctx.autoCopy && output.markdown) {
    try {
      await copyToClipboard(output.markdown);
      process.stderr.write(` ${t.ok(t.sym.check)} ${t.muted('copied markdown summary to clipboard')}\n`);
    } catch (e) {
      process.stderr.write(` ${t.medium(t.sym.medium)} ${t.muted('copy failed:')} ${e instanceof Error ? e.message : String(e)}\n`);
    }
  }

  if (ctx.autoOpen && output.firstCritical) {
    try {
      const used = await openAtLine(output.firstCritical.filePath, output.firstCritical.startLine);
      process.stderr.write(` ${t.ok(t.sym.check)} ${t.muted('opened:')} ${t.dim(used)}\n`);
    } catch (e) {
      process.stderr.write(` ${t.medium(t.sym.medium)} ${t.muted('open failed:')} ${e instanceof Error ? e.message : String(e)}\n`);
    }
  }

  if (ctx.autoCopy || ctx.autoOpen) return;
  if (ctx.json) return;
  if (!output.markdown) return;
  if (!process.stdout.isTTY) return;
  if (!process.stdin.isTTY) return;

  const canOpen = !!output.firstCritical;
  const hintParts = [
    `${t.dim('[')}${t.accent('c')}${t.dim('] copy')}`,
    canOpen ? `${t.dim('[')}${t.accent('o')}${t.dim('] open first critical')}` : null,
    `${t.dim('[')}${t.accent('q')}${t.dim('] quit')}`
  ].filter(Boolean).join(t.dim('  '));
  process.stdout.write(` ${hintParts}  ${t.dim('(auto-exits in 10s)')}\n`);

  const key = await waitForKey(10_000);
  if (!key) return;
  if (key.name === 'c' && output.markdown) {
    try {
      await copyToClipboard(output.markdown);
      process.stdout.write(` ${t.ok(t.sym.check)} ${t.muted('copied')}\n`);
    } catch (e) {
      process.stdout.write(` ${t.medium(t.sym.medium)} ${t.muted('copy failed:')} ${e instanceof Error ? e.message : String(e)}\n`);
    }
  } else if (key.name === 'o' && output.firstCritical) {
    try {
      const used = await openAtLine(output.firstCritical.filePath, output.firstCritical.startLine);
      process.stdout.write(` ${t.ok(t.sym.check)} ${t.muted('opened:')} ${t.dim(used)}\n`);
    } catch (e) {
      process.stdout.write(` ${t.medium(t.sym.medium)} ${t.muted('open failed:')} ${e instanceof Error ? e.message : String(e)}\n`);
    }
  }
}

program.parseAsync();
