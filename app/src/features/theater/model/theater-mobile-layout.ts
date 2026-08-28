import { useEffect, useState } from "react";

export type TheaterMobileSheet = "view" | "objects" | "scene" | "save";

export function useMobileTheaterLayout() {
  const readMobile = () => {
    if (typeof window === "undefined") return false;
    return (
      window.matchMedia("(max-width: 1024px)").matches ||
      window.matchMedia("(pointer: coarse)").matches
    );
  };

  const [mobile, setMobile] = useState(readMobile);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const media = window.matchMedia("(max-width: 1024px)");
    const pointer = window.matchMedia("(pointer: coarse)");
    const update = () => setMobile(readMobile());
    update();
    media.addEventListener("change", update);
    pointer.addEventListener("change", update);
    window.addEventListener("resize", update);
    return () => {
      media.removeEventListener("change", update);
      pointer.removeEventListener("change", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  return mobile;
}
