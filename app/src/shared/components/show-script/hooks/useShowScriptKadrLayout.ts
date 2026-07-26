export function isShowScriptKadrLayoutEnabled(markdownMode: string): boolean {
  return markdownMode === "explication" || markdownMode === "play";
}

export function useShowScriptKadrLayout(args: {
  activeMarkdown: string | undefined;
  markdownMode: string;
}) {
  const { markdownMode } = args;
  const kadrLayoutEnabled = isShowScriptKadrLayoutEnabled(markdownMode);

  return {
    kadrLayoutEnabled,
  };
}
