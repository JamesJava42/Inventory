export function toDisplay(totalUnits: number, unitsPerCase: number, unitsPerPack: number) {
  const cases = Math.floor(totalUnits / unitsPerCase);
  const remainder = totalUnits % unitsPerCase;
  if (unitsPerPack <= 1) return { cases, packs: 0, singles: remainder };
  const packs = Math.floor(remainder / unitsPerPack);
  const singles = remainder % unitsPerPack;
  return { cases, packs, singles };
}

export function displayStr(totalUnits: number, unitsPerCase: number, unitsPerPack: number): string {
  if (totalUnits === 0) return '0';
  const { cases, packs, singles } = toDisplay(totalUnits, unitsPerCase, unitsPerPack);
  const parts: string[] = [];
  if (cases) parts.push(`${cases} case${cases !== 1 ? 's' : ''}`);
  if (packs) parts.push(`${packs} pack${packs !== 1 ? 's' : ''}`);
  if (singles) parts.push(`${singles} single${singles !== 1 ? 's' : ''}`);
  return parts.join(', ');
}
