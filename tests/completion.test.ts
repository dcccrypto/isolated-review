import { describe, it, expect } from 'vitest';
import { completionScript, runCompletion } from '../src/commands/completion.js';

describe('completionScript', () => {
  it('zsh script references the shell and the subcommands', async () => {
    const s = completionScript('zsh');
    expect(s).toContain('#compdef review');
    expect(s).toContain('compdef _review review');
    expect(s).toMatch(/init|keys|settings|status|prompts|doctor|completion/);
  });

  it('bash script sets up completion function', async () => {
    const s = completionScript('bash');
    expect(s).toContain('complete -F _review review');
    expect(s).toContain('_review()');
    expect(s).toMatch(/--model|--verify|--prompt|--effort/);
  });

  it('fish script declares completions', async () => {
    const s = completionScript('fish');
    expect(s).toContain('complete -c review');
    // fish uses `-l <name>` for long options, not `--name`
    expect(s).toMatch(/-l model|-l effort|-l prompt/);
  });

  it('each shell script includes the model aliases and effort levels', async () => {
    for (const shell of ['zsh', 'bash', 'fish'] as const) {
      const s = completionScript(shell);
      expect(s, `${shell} script must mention "claude"`).toContain('claude');
      expect(s, `${shell} script must mention "claude-opus"`).toContain('claude-opus');
      expect(s, `${shell} script must mention "medium"`).toContain('medium');
      expect(s, `${shell} script must mention "xhigh"`).toContain('xhigh');
    }
  });

  it('each shell script dynamically walks the user prompts dir', async () => {
    for (const shell of ['zsh', 'bash', 'fish'] as const) {
      const s = completionScript(shell);
      // each script references the prompts dir so user-defined prompts appear in tab-complete
      expect(s).toMatch(/isolated-review\/prompts|IR_CONFIG_DIR/);
    }
  });
});

describe('runCompletion', () => {
  it('returns the script for a valid shell', async () => {
    await expect(runCompletion('zsh')).resolves.toContain('#compdef review');
    await expect(runCompletion('bash')).resolves.toContain('_review()');
    await expect(runCompletion('fish')).resolves.toContain('complete -c review');
  });

  it('is case-insensitive', async () => {
    await expect(runCompletion('ZSH')).resolves.toContain('#compdef review');
  });

  it('throws on unknown shell with a helpful message', async () => {
    await expect(runCompletion('tcsh')).rejects.toThrow(/unknown shell.*bash.*zsh.*fish/i);
    await expect(runCompletion('powershell')).rejects.toThrow(/unknown shell/);
  });
});
