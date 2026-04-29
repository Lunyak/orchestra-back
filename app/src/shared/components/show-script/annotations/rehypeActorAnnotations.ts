import type { ActorAnnotation } from "../../../../sync/api/actor-notes";

export type HastNode =
  | { type: "root"; children?: HastNode[] }
  | {
      type: "element";
      tagName: string;
      properties?: any;
      children?: HastNode[];
    }
  | { type: "text"; value: string }
  | { type: string; [k: string]: any };

export function rehypeActorAnnotations(opts: {
  annotations: ActorAnnotation[];
  activeId: string | null;
}) {
  const input = (opts.annotations ?? [])
    .slice()
    .filter((a) => a && typeof a.id === "string")
    .map((a) => ({
      id: a.id,
      start: Math.max(0, Math.trunc(Number(a.startOffset))),
      end: Math.max(0, Math.trunc(Number(a.endOffset))),
    }))
    .filter(
      (a) =>
        Number.isFinite(a.start) && Number.isFinite(a.end) && a.end > a.start,
    )
    .sort((a, b) => a.start - b.start || a.end - b.end);

  return function transformer(tree: HastNode) {
    let pos = 0;
    let idx = 0;

    const wrap = (id: string, text: string) =>
      ({
        type: "element",
        tagName: "mark",
        properties: {
          className: ["actor-annotations-mark"],
          "data-anno-id": id,
          "data-active": opts.activeId === id ? "true" : "false",
        },
        children: [{ type: "text", value: text }],
      }) as HastNode;

    const walk = (node: HastNode): HastNode => {
      if (!node) return node;
      if (node.type === "text") {
        const value = String((node as any).value ?? "");
        const len = value.length;
        if (len === 0) return node;

        // fast-forward annotations that already ended
        while (idx < input.length && input[idx].end <= pos) idx += 1;
        if (idx >= input.length) {
          pos += len;
          return node;
        }

        const startPos = pos;
        const endPos = pos + len;
        if (input[idx].start >= endPos) {
          pos += len;
          return node;
        }

        const out: HastNode[] = [];
        let localCursor = 0;
        while (idx < input.length) {
          const a = input[idx];
          if (a.start >= endPos) break;
          const s = Math.max(a.start, startPos) - startPos;
          const e = Math.min(a.end, endPos) - startPos;
          if (e <= localCursor) {
            idx += 1;
            continue;
          }
          if (s > localCursor) {
            out.push({
              type: "text",
              value: value.slice(localCursor, s),
            } as HastNode);
          }
          out.push(wrap(a.id, value.slice(s, e)));
          localCursor = e;
          if (a.end <= endPos) idx += 1;
          // если аннотация заканчивается позже — overlap, пока игнорируем продолжение
        }
        if (localCursor < len) {
          out.push({
            type: "text",
            value: value.slice(localCursor),
          } as HastNode);
        }

        pos += len;
        if (out.length === 1) return out[0];
        return {
          type: "element",
          tagName: "span",
          properties: {},
          children: out,
        } as HastNode;
      }

      const children = (node as any).children;
      if (Array.isArray(children)) {
        const nextChildren: HastNode[] = [];
        for (const child of children) {
          nextChildren.push(walk(child));
        }
        (node as any).children = nextChildren;
      }
      return node;
    };

    walk(tree);
  };
}
