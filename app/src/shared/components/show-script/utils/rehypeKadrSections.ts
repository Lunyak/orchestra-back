type HastNode =
  | { type: "root"; children?: HastNode[] }
  | { type: "element"; tagName: string; properties?: any; children?: HastNode[] }
  | { type: "text"; value: string }
  | { type: string; [k: string]: any };

type Section = {
  heading: HastNode | null;
  level: number | null;
  body: HastNode[];
};

function headingLevel(node: HastNode): number | null {
  if (!node || node.type !== "element") return null;
  const tag = String((node as any).tagName ?? "").toLowerCase();
  if (tag === "h1") return 1;
  if (tag === "h2") return 2;
  if (tag === "h3") return 3;
  return null;
}

function isIgnorableWhitespaceText(node: HastNode): boolean {
  if (!node || node.type !== "text") return false;
  return /^[\s\u00A0\u200B\u200C\u200D\uFEFF]*$/.test(String((node as any).value ?? ""));
}

/** Paragraph whose only meaningful children are <img> (one or more), e.g. after paste/merge. */
function extractImgsFromImgOnlyParagraph(node: HastNode): HastNode[] | null {
  if (!node || node.type !== "element") return null;
  const tag = String((node as any).tagName ?? "").toLowerCase();
  if (tag !== "p") return null;
  const children = Array.isArray((node as any).children) ? ((node as any).children as HastNode[]) : [];
  const meaningful = children.filter((c) => !isIgnorableWhitespaceText(c));
  if (meaningful.length === 0) return null;
  const imgs: HastNode[] = [];
  for (const m of meaningful) {
    if (!m || m.type !== "element") return null;
    if (String((m as any).tagName ?? "").toLowerCase() !== "img") return null;
    imgs.push(m);
  }
  return imgs;
}

function isBareImg(node: HastNode): boolean {
  if (!node || node.type !== "element") return false;
  return String((node as any).tagName ?? "").toLowerCase() === "img";
}

function makeEl(tagName: string, classNames: string[], props?: Record<string, any>, children?: HastNode[]): HastNode {
  return {
    type: "element",
    tagName,
    properties: { className: classNames, ...(props ?? {}) },
    children: children ?? [],
  } as HastNode;
}

function splitIntoSections(children: HastNode[], maxHeadingLevel: number): Section[] {
  const out: Section[] = [];
  let current: Section = { heading: null, level: null, body: [] };

  const flush = () => {
    if (current.heading || current.body.some((n) => !isIgnorableWhitespaceText(n))) {
      out.push(current);
    }
    current = { heading: null, level: null, body: [] };
  };

  for (const node of children) {
    const lvl = headingLevel(node);
    if (lvl != null && lvl <= maxHeadingLevel) {
      flush();
      current.heading = node;
      current.level = lvl;
      continue;
    }
    current.body.push(node);
  }
  flush();

  return out.length ? out : [{ heading: null, level: null, body: children }];
}

function moveImagesToRight(body: HastNode[]): { left: HastNode[]; right: HastNode[] } {
  const left: HastNode[] = [];
  const right: HastNode[] = [];
  for (const node of body) {
    const fromP = extractImgsFromImgOnlyParagraph(node);
    if (fromP) {
      right.push(...fromP);
      continue;
    }
    if (isBareImg(node)) {
      right.push(node);
      continue;
    }
    left.push(node);
  }
  return { left, right };
}

export function rehypeKadrSections(opts?: { enabled?: boolean; headingMaxLevel?: number }) {
  const enabled = Boolean(opts?.enabled ?? true);
  const maxHeadingLevel = Math.max(1, Math.min(6, Math.trunc(Number(opts?.headingMaxLevel ?? 3))));

  return function transformer(tree: HastNode) {
    if (!enabled) return;
    if (!tree || tree.type !== "root") return;
    const rootChildren = Array.isArray((tree as any).children) ? ((tree as any).children as HastNode[]) : [];
    if (rootChildren.length === 0) return;

    const sections = splitIntoSections(rootChildren, maxHeadingLevel);

    const nextChildren: HastNode[] = [];
    for (const s of sections) {
      const { left, right } = moveImagesToRight(s.body);
      const hasImage = right.some((n) => n && (n.type !== "text" || !isIgnorableWhitespaceText(n)));

      const leftContent: HastNode[] = [];
      if (s.heading) leftContent.push(s.heading);
      leftContent.push(...left);

      const leftWrap = makeEl("div", ["markdown-kadr__left"], {}, leftContent);
      const rightWrap = makeEl(
        "div",
        ["markdown-kadr__right"],
        hasImage ? {} : { "data-empty": "true" },
        right,
      );
      const grid = makeEl("div", ["markdown-kadr__grid"], {}, [leftWrap, rightWrap]);

      const sectionEl = makeEl(
        "section",
        ["markdown-kadr"],
        {
          "data-has-image": hasImage ? "true" : "false",
          "data-level": s.level != null ? String(s.level) : undefined,
        },
        [grid],
      );
      nextChildren.push(sectionEl);
    }

    (tree as any).children = nextChildren;
  };
}

