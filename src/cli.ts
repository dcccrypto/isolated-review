#!/usr/bin/env node
import { Command } from 'commander';
import { runReview, type ReviewOpts } from './commands/review.js';
import { runKeysSetup } from './commands/keys.js';
import { runSettings } from './commands/settings.js';
import { runInit } from './commands/init.js';

const program = new Command();

program
  .name('review')
  .description('Deep code review of a single file in isolation')
  .version('0.2.1');

function wrap(fn: () => Promise<string>) {
  return async () => {
    try {
      process.stdout.write(await fn());
    } catch (e) {
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
  .description('Set API keys (Anthropic, OpenAI, OpenRouter)')
  .action(wrap(runKeysSetup));

program
  .command('settings')
  .description('Set the default review model')
  .action(wrap(runSettings));

program
  .argument('<file>', 'path to the file to review')
  .option('--model <name>',  'primary review model (default: from settings, or "claude")')
  .option('--verify <name>', 'optional second-pass verifier model')
  .option('--notes <text>',  'extra context for the reviewer')
  .option('--patch',         'ask for suggested patch/diff ideas', false)
  .option('--json',          'emit machine-readable JSON', false)
  .option('--plain',         'disable color and unicode formatting', false)
  .action(async (file: string, opts: ReviewOpts) => {
    try {
      const output = await runReview(file, opts);
      console.log(output);
    } catch (e) {
      console.error(`error: ${e instanceof Error ? e.message : String(e)}`);
      process.exit(1);
    }
  });

program.parseAsync();
