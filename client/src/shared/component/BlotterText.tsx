import { useEffect, useRef } from "react";

export const BlotterText = () => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadScript = (src: string): Promise<void> => {
      return new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = src;
        script.async = true;
        script.crossOrigin = "anonymous";
        script.onload = () => resolve();
        script.onerror = () => reject(new Error(`Failed to load ${src}`));
        document.head.appendChild(script);
      });
    };

    const initBlotter = async () => {
      try {
        await loadScript("https://cdnjs.cloudflare.com/ajax/libs/Blotter/0.1.0/blotter.min.js");
        await loadScript("https://cdnjs.cloudflare.com/ajax/libs/Blotter/0.1.0/materials/liquidDistortMaterial.min.js");

        // @ts-ignore
        const Blotter = window.Blotter;
        // @ts-ignore
        const Material = window.Blotter.LiquidDistortMaterial;

        const text = new Blotter.Text("ДОФАМИН", {
          family: "Montserrat, sans-serif",
          size: 70,
          fill: "#ffffff",
          paddingLeft: 40,
          paddingRight: 40,
        });

        const material = new Material();
        material.uniforms.uSpeed.value = 0.3;
        material.uniforms.uVolatility.value = 0.15;
        material.uniforms.uSeed.value = 0.1;

        const blotter = new Blotter(material, { texts: text });
        const scope = blotter.forText(text);

        if (containerRef.current) {
          scope.appendTo(containerRef.current);
        }
      } catch (err) {
        console.error("Blotter init failed:", err);
      }
    };

    initBlotter();
  }, []);

  return <div ref={containerRef} style={{ pointerEvents: "none" }} />;
};
