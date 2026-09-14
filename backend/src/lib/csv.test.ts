import { PassThrough } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { csvRow, writeCsvRow } from './csv';

describe('csvRow', () => {
  it('joins plain fields with commas and a trailing CRLF', () => {
    expect(csvRow(['a', 'b', 1])).toBe('a,b,1\r\n');
  });

  it('quotes a field containing a comma', () => {
    expect(csvRow(['Colombo, Main Branch'])).toBe('"Colombo, Main Branch"\r\n');
  });

  it('quotes and escapes a field containing a double quote', () => {
    expect(csvRow(['She said "hi"'])).toBe('"She said ""hi"""\r\n');
  });

  it('quotes a field containing a newline', () => {
    expect(csvRow(['line1\nline2'])).toBe('"line1\nline2"\r\n');
  });

  it('leaves plain alphanumeric fields unquoted', () => {
    expect(csvRow(['batch_1', 'ACTIVE', 20])).toBe('batch_1,ACTIVE,20\r\n');
  });

  it('prefixes a leading =, +, -, or @ with a single quote to prevent formula injection', () => {
    expect(csvRow(['=cmd|"/c calc"!A1'])).toBe('"\'=cmd|""/c calc""!A1"\r\n');
    expect(csvRow(['+1+1'])).toBe("'+1+1\r\n");
    expect(csvRow(['-1+1'])).toBe("'-1+1\r\n");
    expect(csvRow(['@SUM(A1:A2)'])).toBe("'@SUM(A1:A2)\r\n");
  });
});

describe('writeCsvRow', () => {
  it('writes one escaped CSV row per call to the destination stream', async () => {
    const stream = new PassThrough();
    const chunks: string[] = [];
    stream.on('data', (chunk: Buffer) => chunks.push(chunk.toString('utf-8')));

    writeCsvRow(stream, ['id', 'name']);
    writeCsvRow(stream, ['1', 'Ann, Smith']);
    stream.end();

    await new Promise((resolve) => stream.on('end', resolve));
    expect(chunks.join('')).toBe('id,name\r\n1,"Ann, Smith"\r\n');
  });
});
