/** Магнит Z к линии зала при перетаскивании (граница audienceStartZ). */
export function snapModelZToAudienceLine(
  z: number,
  halfDepth: number,
  audienceStartZ: number,
  threshold = 0.2,
): number {
  const targetZ = audienceStartZ - halfDepth;
  return Math.abs(z - targetZ) <= threshold ? targetZ : z;
}
