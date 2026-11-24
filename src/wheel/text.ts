/** Shortens text at a word. Unlike a CSS ellipsis, the result stays centered when text-align is center. */
export function clip(s: string, max: number): string {
  if (s.length <= max) return s;
  const cut = s.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  return cut.slice(0, space > max * 0.4 ? space : max - 1).replace(/[\s,;:.–-]+$/, "") + "…";
}
