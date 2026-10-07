export const AUTO_WRITE_FONT_OPTIONS = [
  { id: 'sans-serif', label: 'Sans Serif', family: 'system-ui, sans-serif' },
  { id: 'kalam', label: 'Kalam', family: 'Kalam' },
  { id: 'caveat', label: 'Caveat', family: 'Caveat' },
  { id: 'patrick-hand', label: 'Patrick Hand', family: 'Patrick Hand' },
  { id: 'comic-neue', label: 'Comic Neue', family: 'Comic Neue' },
  { id: 'architects-daughter', label: 'Architects Daughter', family: 'Architects Daughter' },
] as const;

export type AutoWriteFontId = (typeof AUTO_WRITE_FONT_OPTIONS)[number]['id'];

export function getAutoWriteFontFamily(fontId: AutoWriteFontId): string {
  const font = AUTO_WRITE_FONT_OPTIONS.find((option) => option.id === fontId);
  if (!font || font.id === 'sans-serif') return 'system-ui, sans-serif';
  return `"${font.family}", cursive`;
}
