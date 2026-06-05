import { isLightKadrAnchorLine } from "../../../../features/theater/model/light-kadrs";

type HastNode =
  | { type: "root"; children?: HastNode[] }
  | { type: "element"; tagName: string; properties?: unknown; children?: HastNode[] }
  | { type: "text"; value: string }
  | { type: string; [k: string]: unknown };

function isKadrAnchorNode(node: HastNode): boolean {
  if (!node) return false;
  const value = String((node as { value?: string }).value ?? "").trim();
  if (node.type === "comment") return isLightKadrAnchorLine(value);
  if (node.type === "raw" || node.type === "html") {
    return isLightKadrAnchorLine(value);
  }
  return false;
}

function stripChildren(nodes: HastNode[]): HastNode[] {
  const next: HastNode[] = [];
  for (const node of nodes) {
    if (isKadrAnchorNode(node)) continue;
    if (Array.isArray((node as any).children)) {
      (node as any).children = stripChildren((node as any).children as HastNode[]);
    }
    next.push(node);
  }
  return next;
}

/** Убрать служебные `<!-- lk:uuid -->` из превью тех. карты (в markdown они остаются). */
export function rehypeStripLightKadrAnchors() {
  return function transformer(tree: HastNode) {
    if (!tree || tree.type !== "root") return;
    const children = (tree as any).children;
    if (!Array.isArray(children)) return;
    (tree as any).children = stripChildren(children);
  };
}
