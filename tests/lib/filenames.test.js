import { describe, it, expect } from 'vitest';

import { sanitizeFilename } from '../../src/lib/filenames.js';

describe('sanitizeFilename', () => {
  it('returns an empty string for empty input', () => {
    expect(sanitizeFilename('')).toBe('');
    expect(sanitizeFilename(null)).toBe('');
  });

  it('strips characters that are unsafe in filenames', () => {
    expect(sanitizeFilename('a<b>c:d"e/f\\g|h?i*j')).toBe('a_b_c_d_e_f_g_h_i_j');
  });

  it('strips control characters (defends against header/CRLF injection downstream)', () => {
    // \r and \n are each replaced individually, so a CRLF becomes two underscores.
    expect(sanitizeFilename('evil\r\nname')).toBe('evil__name');
    expect(sanitizeFilename('evil\r\nname')).not.toMatch(/[\r\n]/);
  });

  it('collapses internal whitespace and trims trailing dots', () => {
    expect(sanitizeFilename('  my   file...  ')).toBe('my file');
  });

  it('leaves an ordinary name untouched', () => {
    expect(sanitizeFilename('logo-2024')).toBe('logo-2024');
  });
});
