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

function isIgnorableBetweenImgs(node: HastNode): boolean {
  if (isIgnorableWhitespaceText(node)) return true;
  if (!node || node.type !== "element") return false;
  return String((node as any).tagName ?? "").toLowerCase() === "br";
}

/** Paragraph whose only meaningful children are <img> (one or more), e.g. after paste/merge. */
function extractImgsFromImgOnlyParagraph(node: HastNode): HastNode[] | null {
  if (!node || node.type !== "element") return null;
  const tag = String((node as any).tagName ?? "").toLowerCase();
  if (tag !== "p") return null;
  const children = Array.isArray((node as any).children) ? ((node as any).children as HastNode[]) : [];
  const meaningful = children.filter((c) => !isIgnorableBetweenImgs(c));
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

function nodePlainText(node: HastNode): string {
  const parts: string[] = [];
  const walk = (n: HastNode) => {
    if (!n) return;
    if (n.type === "text") parts.push(String((n as { value?: string }).value ?? ""));
    const children = (n as any).children;
    if (Array.isArray(children)) children.forEach(walk);
  };
  walk(node);
  return parts.join("").trim();
}

function normalizeKadrLabelText(text: string): string {
  return String(text ?? "")
    .trim()
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/\s+/g, " ");
}

function nodeHasLightPanelMarker(node: HastNode): boolean {
  let found = false;
  const walk = (n: HastNode) => {
    if (!n || found) return;
    if (n.type === "element") {
      const props = (n as any).properties ?? {};
      const className = props.className;
      const classes = Array.isArray(className)
        ? className.map(String)
        : typeof className === "string"
          ? className.split(/\s+/)
          : [];
      if (classes.includes("markdown-light-split-host")) found = true;
      if (typeof props["data-lk-id"] === "string" && props["data-lk-id"]) found = true;
    }
    if (n.type === "text" && /\{\{\s*lightpanel\s*:/i.test(String((n as any).value ?? ""))) {
      found = true;
    }
    const children = (n as any).children;
    if (Array.isArray(children)) children.forEach(walk);
  };
  walk(node);
  return found;
}

function isLightParagraph(node: HastNode): boolean {
  if (!node || node.type !== "element") return false;
  const tag = String((node as any).tagName ?? "").toLowerCase();
  if (tag !== "p" && tag !== "li") return false;
  const text = normalizeKadrLabelText(nodePlainText(node));
  if (/\{\{\s*lightpanel\s*:/i.test(text)) return true;
  if (/\{\{\s*(?:light|blackout|program|fader)\b/i.test(text)) return true;
  if (nodeHasLightPanelMarker(node)) return true;
  if (/\*\*свет\*\*:/.test(text) || text.includes("свет:")) return true;
  return false;
}

function isLightTokenOnlyBlock(node: HastNode): boolean {
  if (!node || node.type !== "element") return false;
  const text = nodePlainText(node).trim();
  if (/\{\{\s*lightpanel\s*:/i.test(text)) return true;
  if (/\{\{\s*(?:light|blackout|program|fader)\b/i.test(text)) return true;
  return nodeHasLightPanelMarker(node);
}

function isKadrRestFieldBlock(node: HastNode): boolean {
  if (!node || node.type !== "element") return false;
  const text = normalizeKadrLabelText(nodePlainText(node));
  return /(?:\*\*)?(?:звук|видео|проектор|действие(?:\/задача)?|переход)(?:\*\*)?\s*:/.test(text);
}

function isLightRelatedBlock(node: HastNode): boolean {
  return isLightParagraph(node) || isLightTokenOnlyBlock(node);
}

function trySplitLightRestListItem(node: HastNode): {
  lightBlocks: HastNode[];
  restLi: HastNode;
  images: HastNode[];
} | null {
  if (!node || node.type !== "element") return null;
  if (String((node as any).tagName ?? "").toLowerCase() !== "li") return null;

  const inner = liInnerBlocks(node);
  const images: HastNode[] = [];
  const lightBlocks: HastNode[] = [];
  const restBlocks: HastNode[] = [];

  for (const block of inner) {
    if (isPictureLabelBlock(block)) {
      images.push(...collectImgsDeep(block));
      continue;
    }
    const fromP = extractImgsFromImgOnlyParagraph(block);
    if (fromP) {
      images.push(...fromP);
      continue;
    }
    if (isBareImg(block)) {
      images.push(block);
      continue;
    }
    if (isLightRelatedBlock(block)) {
      lightBlocks.push(block);
      continue;
    }
    if (isKadrRestFieldBlock(block)) {
      restBlocks.push(block);
      continue;
    }
    restBlocks.push(block);
  }

  if (lightBlocks.length === 0 || restBlocks.length === 0) return null;
  return {
    lightBlocks,
    restLi: makeEl("li", [], {}, restBlocks),
    images,
  };
}

function resolveLightContent(node: HastNode): HastNode | HastNode[] | null {
  if (!node || node.type !== "element") return null;

  const split = trySplitLightRestListItem(node);
  if (split) return split.lightBlocks;

  const tag = String((node as any).tagName ?? "").toLowerCase();
  if (tag !== "li") {
    return isLightRelatedBlock(node) ? node : null;
  }

  const inner = liInnerBlocks(node);
  if (inner.length === 0) return null;
  if (inner.every((block) => isLightRelatedBlock(block))) return node;
  if (inner.length === 1 && isLightRelatedBlock(inner[0]!)) return node;
  return null;
}

function toLightContentNodes(light: HastNode | HastNode[] | null): HastNode[] {
  if (!light) return [];
  if (Array.isArray(light)) return light;
  return unwrapListItemToBlocks(light);
}

function isPictureLabelBlock(node: HastNode): boolean {
  if (!node || node.type !== "element") return false;
  const tag = String((node as any).tagName ?? "").toLowerCase();
  if (tag !== "p" && tag !== "li") return false;
  const text = normalizeKadrLabelText(nodePlainText(node));
  return /(?:^|[-–—]\s*)(?:\*\*)?(?:картинка|мизансцена)(?:\*\*)?\s*:/.test(text);
}

function collectImgsDeep(node: HastNode): HastNode[] {
  const imgs: HastNode[] = [];
  const walk = (n: HastNode) => {
    if (!n) return;
    if (n.type === "element") {
      const tag = String((n as any).tagName ?? "").toLowerCase();
      if (tag === "img") imgs.push(n);
      const children = (n as any).children;
      if (Array.isArray(children)) children.forEach(walk);
    }
  };
  walk(node);
  return imgs;
}

/** Label-only «Картинка:» without images — skip in body, do not duplicate in picture column text. */
function isPictureLabelOnlyBlock(node: HastNode): boolean {
  if (!isPictureLabelBlock(node)) return false;
  if (collectImgsDeep(node).length > 0) return false;
  const text = normalizeKadrLabelText(nodePlainText(node));
  const withoutLabel = text
    .replace(/^[-–—]?\s*(?:\*\*)?(?:картинка|мизансцена)(?:\*\*)?\s*:?\s*/i, "")
    .trim();
  return withoutLabel === "" || withoutLabel === "_";
}

function isPictureLabelParagraph(node: HastNode): boolean {
  return isPictureLabelOnlyBlock(node);
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

function expandListBlocks(body: HastNode[]): HastNode[] {
  const out: HastNode[] = [];
  for (const node of body) {
    if (!node || node.type !== "element") {
      out.push(node);
      continue;
    }
    const tag = String((node as any).tagName ?? "").toLowerCase();
    if (tag === "ul" || tag === "ol") {
      const children = Array.isArray((node as any).children) ? ((node as any).children as HastNode[]) : [];
      for (const child of children) {
        if (child && child.type === "element" && String((child as any).tagName ?? "").toLowerCase() === "li") {
          out.push(child);
        }
      }
      continue;
    }
    out.push(node);
  }
  return out;
}

function liInnerBlocks(node: HastNode): HastNode[] {
  if (!node || node.type !== "element") return [];
  if (String((node as any).tagName ?? "").toLowerCase() !== "li") return [node];
  return (Array.isArray((node as any).children) ? ((node as any).children as HastNode[]) : []).filter(
    (c) => !isIgnorableWhitespaceText(c),
  );
}

function collectImgsFromBlocks(blocks: HastNode[]): HastNode[] {
  const imgs: HastNode[] = [];
  for (const block of blocks) {
    const fromP = extractImgsFromImgOnlyParagraph(block);
    if (fromP) {
      imgs.push(...fromP);
      continue;
    }
    if (isBareImg(block)) {
      imgs.push(block);
    }
  }
  return imgs;
}

function extractImgsFromLi(node: HastNode): HastNode[] | null {
  const inner = liInnerBlocks(node);
  if (inner.length === 0) return null;

  if (inner.length === 1) {
    const only = inner[0]!;
    if (isPictureLabelBlock(only)) {
      const imgs = collectImgsDeep(only);
      return imgs.length > 0 ? imgs : null;
    }
    const fromP = extractImgsFromImgOnlyParagraph(only);
    if (fromP) return fromP;
    if (isBareImg(only)) return [only];
    return null;
  }

  let sawPictureLabel = false;
  const imgs: HastNode[] = [];
  const contentBlocks: HastNode[] = [];
  for (const block of inner) {
    if (isPictureLabelBlock(block)) {
      sawPictureLabel = true;
      imgs.push(...collectImgsDeep(block));
      continue;
    }
    if (isLightParagraph(block)) {
      return null;
    }
    contentBlocks.push(block);
  }

  if (!sawPictureLabel) return null;
  imgs.push(...collectImgsFromBlocks(contentBlocks));
  return imgs.length > 0 ? imgs : null;
}

function unwrapListItemToBlocks(li: HastNode): HastNode[] {
  if (!li || li.type !== "element" || String((li as any).tagName ?? "").toLowerCase() !== "li") {
    return [li];
  }
  return (Array.isArray((li as any).children) ? ((li as any).children as HastNode[]) : []).filter(
    (c) => !isIgnorableWhitespaceText(c),
  );
}

function listItemTag(node: HastNode): string {
  return String((node as any).tagName ?? "").toLowerCase();
}

/** Пункт списка кадра → обычный абзац без маркера (превью рисует строки само). */
function listItemToFieldParagraph(li: HastNode): HastNode {
  const blocks = unwrapListItemToBlocks(li);
  if (blocks.length === 0) {
    return makeEl("p", ["markdown-kadr__field"], {}, []);
  }
  if (blocks.length === 1) {
    const only = blocks[0]!;
    if (only.type === "element" && listItemTag(only) === "p") {
      const inner = Array.isArray((only as any).children) ? ((only as any).children as HastNode[]) : [];
      return makeEl("p", ["markdown-kadr__field"], {}, inner);
    }
  }
  const merged: HastNode[] = [];
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i]!;
    if (block.type === "element" && listItemTag(block) === "p") {
      const inner = Array.isArray((block as any).children) ? ((block as any).children as HastNode[]) : [];
      merged.push(...inner);
    } else {
      merged.push(block);
    }
    if (i + 1 < blocks.length) {
      merged.push({ type: "element", tagName: "br", properties: {}, children: [] } as HastNode);
    }
  }
  return makeEl("p", ["markdown-kadr__field"], {}, merged);
}

function normalizeKadrBodyRestNodes(nodes: HastNode[]): HastNode[] {
  const result: HastNode[] = [];
  for (const node of nodes) {
    if (!node || node.type !== "element") {
      result.push(node);
      continue;
    }
    const tag = listItemTag(node);
    if (tag === "ul" || tag === "ol") {
      const children = Array.isArray((node as any).children) ? ((node as any).children as HastNode[]) : [];
      for (const child of children) {
        if (child && child.type === "element" && listItemTag(child) === "li") {
          result.push(listItemToFieldParagraph(child));
        } else if (child) {
          result.push(child);
        }
      }
      continue;
    }
    if (tag === "li") {
      result.push(listItemToFieldParagraph(node));
      continue;
    }
    if (tag === "p") {
      const className = (node as any).properties?.className;
      const classes = Array.isArray(className)
        ? className.map(String)
        : typeof className === "string"
          ? className.split(/\s+/)
          : [];
      if (!classes.includes("markdown-kadr__field")) {
        result.push(
          makeEl(
            "p",
            ["markdown-kadr__field", ...classes],
            { ...(node as any).properties },
            Array.isArray((node as any).children) ? ((node as any).children as HastNode[]) : [],
          ),
        );
        continue;
      }
    }
    result.push(node);
  }
  return result;
}

function partitionKadrBody(body: HastNode[]): {
  images: HastNode[];
  light: HastNode | HastNode[] | null;
  rest: HastNode[];
} {
  const images: HastNode[] = [];
  const restNodes: HastNode[] = [];
  let light: HastNode | HastNode[] | null = null;

  for (const node of expandListBlocks(body)) {
    const split = trySplitLightRestListItem(node);
    if (split) {
      images.push(...split.images);
      if (!light) light = split.lightBlocks;
      restNodes.push(listItemToFieldParagraph(split.restLi));
      continue;
    }

    const fromLi = extractImgsFromLi(node);
    if (fromLi) {
      images.push(...fromLi);
      continue;
    }
    const fromP = extractImgsFromImgOnlyParagraph(node);
    if (fromP) {
      images.push(...fromP);
      continue;
    }
    if (isBareImg(node)) {
      images.push(node);
      continue;
    }
    if (isPictureLabelBlock(node)) {
      images.push(...collectImgsDeep(node));
      continue;
    }
    if (!light) {
      const lightNode = resolveLightContent(node);
      if (lightNode) {
        light = lightNode;
        continue;
      }
    }
    if (isPictureLabelParagraph(node)) {
      continue;
    }
    restNodes.push(node);
  }

  return { images, light, rest: normalizeKadrBodyRestNodes(restNodes) };
}

export type KadrSectionIdLookup = { kadrNo: number; id: string | null };

function headingPlainText(node: HastNode): string {
  return nodePlainText(node);
}

function resolveKadrIdFromHeading(
  heading: HastNode | null,
  lookups: KadrSectionIdLookup[] | undefined,
): string | undefined {
  if (!heading || !lookups?.length) return undefined;
  const m = /Картина\s+(\d+)/i.exec(headingPlainText(heading));
  if (!m) return undefined;
  const kadrNo = Math.max(1, Math.trunc(Number(m[1]) || 1));
  const id = lookups.find((s) => s.kadrNo === kadrNo)?.id;
  return id ?? undefined;
}

function wrapKadrHeading(
  heading: HastNode,
  lkId: string | undefined,
  blackoutIds: Set<string>,
): HastNode {
  if (!lkId || !blackoutIds.has(lkId)) return heading;
  return makeEl("div", ["markdown-kadr__heading-row"], {}, [
    heading,
    makeEl("span", ["markdown-kadr-blackout-badge"], {}, [
      { type: "text", value: "Блекаут" } as HastNode,
    ]),
  ]);
}

export function rehypeKadrSections(opts?: {
  enabled?: boolean;
  headingMaxLevel?: number;
  kadrIdLookups?: KadrSectionIdLookup[];
  kadrBlackoutIds?: string[];
  /** Колонка «картинка + свет» — только тех. карта (`notes`). */
  splitLayoutEnabled?: boolean;
}) {
  const enabled = Boolean(opts?.enabled ?? true);
  const splitLayoutEnabled = Boolean(opts?.splitLayoutEnabled ?? false);
  const maxHeadingLevel = Math.max(1, Math.min(6, Math.trunc(Number(opts?.headingMaxLevel ?? 3))));
  const blackoutIds = new Set((opts?.kadrBlackoutIds ?? []).filter(Boolean));

  return function transformer(tree: HastNode) {
    if (!enabled) return;
    if (!tree || tree.type !== "root") return;
    const rootChildren = Array.isArray((tree as any).children) ? ((tree as any).children as HastNode[]) : [];
    if (rootChildren.length === 0) return;

    const sections = splitIntoSections(rootChildren, maxHeadingLevel);

    const nextChildren: HastNode[] = [];
    for (const s of sections) {
      const sectionChildren: HastNode[] = [];
      const lkId = resolveKadrIdFromHeading(s.heading, opts?.kadrIdLookups);
      if (s.heading) {
        sectionChildren.push(wrapKadrHeading(s.heading, lkId, blackoutIds));
      }

      let hasImage = false;
      if (splitLayoutEnabled) {
        const { images, light, rest } = partitionKadrBody(s.body);
        hasImage = images.length > 0;

        const lightContent = toLightContentNodes(light);
        const lightEl = makeEl(
          "div",
          ["markdown-kadr__light"],
          light ? {} : { "data-empty": "true" },
          lightContent,
        );

        const hasRest = rest.some((n) => !isIgnorableWhitespaceText(n));
        const splitLeft = hasImage
          ? makeEl(
              "div",
              ["markdown-kadr__stack"],
              {},
              hasRest
                ? [
                    lightEl,
                    makeEl("div", ["markdown-kadr__body", "markdown-kadr__body--in-stack"], {}, rest),
                  ]
                : [lightEl],
            )
          : lightEl;

        const splitChildren: HastNode[] = [splitLeft];
        if (hasImage) {
          splitChildren.push(makeEl("div", ["markdown-kadr__picture"], {}, images));
        }
        const splitClass = hasImage
          ? ["markdown-kadr__split"]
          : ["markdown-kadr__split", "markdown-kadr__split--no-picture"];
        sectionChildren.push(makeEl("div", splitClass, {}, splitChildren));

        if (!hasImage && hasRest) {
          sectionChildren.push(makeEl("div", ["markdown-kadr__body"], {}, rest));
        }
      } else if (s.body.some((n) => !isIgnorableWhitespaceText(n))) {
        sectionChildren.push(makeEl("div", ["markdown-kadr__body"], {}, s.body));
      }

      const sectionEl = makeEl(
        "section",
        ["markdown-kadr"],
        {
          "data-has-image": hasImage ? "true" : "false",
          "data-level": s.level != null ? String(s.level) : undefined,
          "data-lk-id": lkId,
          "data-blackout": lkId && blackoutIds.has(lkId) ? "true" : undefined,
        },
        sectionChildren,
      );
      nextChildren.push(sectionEl);
    }

    (tree as any).children = nextChildren;
  };
}
