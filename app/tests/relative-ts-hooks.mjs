const isRelative = (specifier) =>
  specifier.startsWith("./") || specifier.startsWith("../");

const hasExplicitExtension = (specifier) =>
  /\.[cm]?[jt]sx?$/.test(specifier);

export async function resolve(specifier, context, nextResolve) {
  if (isRelative(specifier) && !hasExplicitExtension(specifier)) {
    try {
      return await nextResolve(`${specifier}.ts`, context);
    } catch {
      return nextResolve(specifier, context);
    }
  }

  return nextResolve(specifier, context);
}
