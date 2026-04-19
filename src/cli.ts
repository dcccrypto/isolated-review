#!/usr/bin/env node
import { Command } from 'commander';
import { runReview, type ReviewOpts } from './commands/review.js';
import { runKeysSetup } from './commands/keys.js';
import { runSettings } from './commands/settings.js';
import { runInit } from './commands/init.js';
import { pickFile } from './commands/pick.js';
import { runListPrompts } from './commands/prompts.js';

const program = new Command();

program
  .name('review')
  .description('Deep code review of a single file in isolation')
  .version('0.6.0');

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

program
  .command('init')
  .description('One-shot setup: API keys + default model')
  .action(wrap(runInit));

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
  .command('prompts')
  .description('List built-in and user-defined prompt presets')
  .action(wrap(runListPrompts));

program
  .argument('[file]',        'path to the file to review (omit with --pick to choose interactively)')
  .option('--pick',          'interactively pick a file from the current directory', false)
  .option('--model <name>',  'primary review model (default: from settings, or "claude")')
  .option('--verify <name>', 'optional second-pass verifier model')
  .option('--notes <text>',  'extra context for the reviewer')
  .option('--patch',         'ask for suggested patch/diff ideas', false)
  .option('--diff [base]',   'review only lines changed vs a git base (default: HEAD)')
  .option('--prompt <name>', 'use a named prompt preset (run "review prompts" to list)', 'default')
  .option('--json',          'emit machine-readable JSON', false)
  .option('--plain',         'disable color and unicode formatting', false)
  .action(async (file: string | undefined, rawOpts: Omit<ReviewOpts, 'diff'> & { diff?: string | boolean; pick?: boolean }) => {
    const d = rawOpts.diff;
    const diff: string | undefined =
      d === undefined || d === false ? undefined
      : d === true ? 'HEAD'
      : d;
    const opts: ReviewOpts = { ...rawOpts, diff };
    try {
      let target = file;
      if (!target && rawOpts.pick) {
        target = await pickFile(process.cwd());
      }
      if (!target) {
        console.error('error: missing file. Pass a path, or use --pick for an interactive picker.');
        process.exit(1);
      }
      const output = await runReview(target, opts);
      console.log(output);
    } catch (e) {
      console.error(`error: ${e instanceof Error ? e.message : String(e)}`);
      process.exit(1);
    }
  });

program.parseAsync();
