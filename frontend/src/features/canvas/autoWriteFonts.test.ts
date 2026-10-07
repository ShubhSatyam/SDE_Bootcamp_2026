import { describe, expect, it } from 'vitest';
import { AUTO_WRITE_FONT_OPTIONS, getAutoWriteFontFamily } from './autoWriteFonts';

describe('auto-write fonts', () => {
  it('uses sans serif as the default font', () => {
    expect(AUTO_WRITE_FONT_OPTIONS[0].id).toBe('sans-serif');
    expect(getAutoWriteFontFamily('sans-serif')).toBe('system-ui, sans-serif');
  });

  it('provides distinct selectable handwriting styles', () => {
    expect(AUTO_WRITE_FONT_OPTIONS.map((font) => getAutoWriteFontFamily(font.id))).toEqual([
      'system-ui, sans-serif',
      '"Kalam", cursive',
      '"Caveat", cursive',
      '"Patrick Hand", cursive',
      '"Comic Neue", cursive',
      '"Architects Daughter", cursive',
    ]);
  });
});
