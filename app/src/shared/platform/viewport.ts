type InstallOptions = {
  /**
   * CSS var name for viewport height in px.
   * Default: `--app-height`
   */
  heightVar?: string;
  /**
   * CSS var name for 1% viewport height in px.
   * Default: `--app-vh`
   */
  vhVar?: string;

  /**
   * Force-install even if browser supports dynamic viewport units (dvh).
   * Default: false
   */
  force?: boolean;
};

/**
 * Cross-browser viewport height fix.
 *
 * Motivation: `100vh` is unreliable on mobile browsers (notably iOS Safari) due to
 * dynamic address bars. We expose real viewport height via CSS variables.
 *
 * Sets:
 * - `--app-height`: `<viewportHeightPx>px`
 * - `--app-vh`: `<viewportHeightPx * 0.01>px`
 */
export function installViewportHeightCssVars(options: InstallOptions = {}) {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  // Modern browsers (Chrome/Firefox/Edge, newer Safari) support dvh/svh/lvh.
  // In those cases, prefer pure CSS units to avoid layout thrashing.
  if (!options.force) {
    const supportsDvh =
      typeof window.CSS?.supports === "function" &&
      (window.CSS.supports("height: 100dvh") || window.CSS.supports("height: 1dvh"));
    if (supportsDvh) return;
  }

  const heightVar = options.heightVar ?? "--app-height";
  const vhVar = options.vhVar ?? "--app-vh";

  const guardKey = "__orchestra_viewport_cssvars_installed__";
  if ((window as any)[guardKey]) return;
  (window as any)[guardKey] = true;

  const root = document.documentElement;

  const setVars = () => {
    // Prefer visualViewport for mobile browsers with dynamic toolbars.
    const viewportHeight =
      window.visualViewport?.height ?? window.innerHeight ?? root.clientHeight;

    const heightPx = `${Math.round(viewportHeight)}px`;
    root.style.setProperty(heightVar, heightPx);
    root.style.setProperty(vhVar, `${viewportHeight * 0.01}px`);
  };

  setVars();

  window.addEventListener("resize", setVars, { passive: true });
  window.addEventListener("orientationchange", setVars, { passive: true });

  // iOS Safari can change visual viewport on scroll (address bar show/hide).
  window.visualViewport?.addEventListener("resize", setVars, { passive: true });
  window.visualViewport?.addEventListener("scroll", setVars, { passive: true });
}

