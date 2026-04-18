import { createInterface } from 'node:readline/promises';
import { createTheme } from '../utils/theme.js';
import { getConfigPath } from '../utils/config.js';
import { promptForKeys, applyKeyPatch } from './keys.js';
import { promptForDefaultModel, applyDefaultModel, warnIfKeyMissing } from './settings.js';

export async function runInit(): Promise<string> {
  const t = createTheme();
  const rl = createInterface({ input: process.stdin, output: process.stdout });

  let keysPatch, modelChoice;
  try {
    console.log('');
    console.log(` ${t.header('review init')}  ${t.muted('· one-shot setup (keys + default model)')}`);
    keysPatch = await promptForKeys(rl, t);
    modelChoice = await promptForDefaultModel(rl, t);
  } finally {
    rl.close();
  }

  const keysResult  = applyKeyPatch(keysPatch);
  const modelResult = applyDefaultModel(modelChoice);

  const lines: string[] = [''];
  if (keysResult.changed)  lines.push(` ${t.ok(t.sym.check)} Keys updated`);
  if (modelResult.changed) lines.push(` ${t.ok(t.sym.check)} Default model: ${t.accent(String(modelResult.after ?? '(cleared)'))}`);
  if (!keysResult.changed && !modelResult.changed) lines.push(` ${t.muted('No changes.')}`);
  else lines.push(`   ${t.muted(`saved to ${getConfigPath()}`)}`);

  if (modelResult.after) {
    const warn = warnIfKeyMissing(modelResult.after, t);
    if (warn) lines.push('', warn);
  }
  lines.push('', ` ${t.dim('Next: run')} ${t.accent('review <file>')} ${t.dim('to try it out.')}`);
  lines.push('');
  return lines.join('\n');
}
