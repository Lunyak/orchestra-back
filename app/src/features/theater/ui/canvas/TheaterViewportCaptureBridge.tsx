import { useEffect } from "react";
import { useThree } from "@react-three/fiber";
import { registerTheaterViewportCapture } from "../../model/theater-viewport-capture";

/** Регистрирует захват текущего WebGL кадра для обложки картины. */
export function TheaterViewportCaptureBridge() {
  const { gl, scene, camera } = useThree();

  useEffect(() => {
    registerTheaterViewportCapture(() => {
      gl.render(scene, camera);
      return gl.domElement.toDataURL("image/jpeg", 0.82);
    });
    return () => registerTheaterViewportCapture(null);
  }, [camera, gl, scene]);

  return null;
}
