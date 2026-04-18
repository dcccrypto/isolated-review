import { describe, it, expect } from 'vitest';
import { writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readSourceFile } from '../src/utils/readFile.js';

const tmp = () => mkdtempSync(join(tmpdir(), 'ir-'));

describe('readSourceFile', () => {
  it('reads a ts file and detects language', async () => {
    const d = tmp();
    const p = join(d, 'a.ts');
    writeFileSync(p, 'export {};');
    const r = await readSourceFile(p);
    expect(r.language).toBe('typescript');
    expect(r.content).toBe('export {};');
    rmSync(d, { recursive: true });
  });

  it('rejects missing file', async () => {
    await expect(readSourceFile('/no/such/file.ts')).rejects.toThrow(/file not found/);
  });

  it('rejects empty file', async () => {
    const d = tmp();
    const p = join(d, 'e.ts');
    writeFileSync(p, '');
    await expect(readSourceFile(p)).rejects.toThrow(/empty/);
    rmSync(d, { recursive: true });
  });

  it('rejects binary file', async () => {
    const d = tmp();
    const p = join(d, 'b.bin');
    writeFileSync(p, Buffer.from([0x00, 0x01, 0x02]));
    await expect(readSourceFile(p)).rejects.toThrow(/binary/);
    rmSync(d, { recursive: true });
  });

  it('rejects oversized file', async () => {
    const d = tmp();
    const p = join(d, 'big.ts');
    writeFileSync(p, 'x'.repeat(1_048_577));
    await expect(readSourceFile(p)).rejects.toThrow(/1 MB/);
    rmSync(d, { recursive: true });
  });

  it('falls back to plaintext for unknown extensions', async () => {
    const d = tmp();
    const p = join(d, 'file.xyz');
    writeFileSync(p, 'hello');
    const r = await readSourceFile(p);
    expect(r.language).toBe('plaintext');
    rmSync(d, { recursive: true });
  });
});
