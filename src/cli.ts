#!/usr/bin/env node
import { Command } from 'commander';
import { runReview, type ReviewOpts } from './commands/review.js';
import { runKeysSetup } from './commands/keys.js';

const program = new Command();

program
  .name('review')
  .description('Deep code review of a single file in isolation')
  .version('0.1.0');

program
  .command('keys')
  .description('Interactively set API keys (saved to ~/.config/isolated-review/config.json)')
  .action(async () => {
    try {
      const output = await runKeysSetup();
      process.stdout.write(output);
    } catch (e) {
      console.error(`error: ${e instanceof Error ? e.message : String(e)}`);
      process.exit(1);
    }
  });

program
  .argument('<file>', 'path to the file to review')
  .option('--model <name>',  'primary review model', 'claude')
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
