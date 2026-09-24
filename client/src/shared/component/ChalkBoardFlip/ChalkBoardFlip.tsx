import { AnimationEvent, FC, useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { Component as AboutUs } from "../../../page/AboutUs/AboutUs";
import { Component as ContactsPage } from "../../../page/ContactsPage/ContactsPage";
import { Component as EventsPage } from "../../../page/EventsPage/EventsPage";
import { Component as HomePage } from "../../../page/HomePage/HomePage";
import { cn } from "../../lib/cn";
import { ChalkFlipContext } from "./chalk-flip-context";
import "./chalk-board-flip.css";

const DESKTOP_QUERY = "(min-width: 720px)";

type Turn = "back" | "front" | null;
type FaceId = "home" | "afisha" | "team" | "contacts";

function useDesktopFlip() {
  const read = () => window.matchMedia(DESKTOP_QUERY).matches;
  const [enabled, setEnabled] = useState(read);

  useEffect(() => {
    const desktop = window.matchMedia(DESKTOP_QUERY);
    const sync = () => setEnabled(desktop.matches);
    desktop.addEventListener("change", sync);
    return () => desktop.removeEventListener("change", sync);
  }, []);

  return enabled;
}

function decodePath(pathname: string) {
  try {
    return decodeURIComponent(pathname);
  } catch {
    return pathname;
  }
}

function faceFromPath(pathname: string): FaceId {
  const path = decodePath(pathname);
  if (path === "/события" || path === "/events") return "afisha";
  if (path === "/команда" || path === "/aboutus") return "team";
  if (path === "/контакты" || path === "/contacts") return "contacts";
  return "home";
}

function FacePage({ id }: { id: FaceId }) {
  if (id === "afisha") return <EventsPage />;
  if (id === "team") return <AboutUs />;
  if (id === "contacts") return <ContactsPage />;
  return <HomePage />;
}

export const ChalkBoardFlipLayout: FC = () => {
  const enabled = useDesktopFlip();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const currentFace = faceFromPath(pathname);
  const [frontId, setFrontId] = useState<FaceId>(currentFace);
  const [backId, setBackId] = useState<FaceId>(currentFace === "home" ? "afisha" : "home");
  const [showing, setShowing] = useState<"front" | "back">("front");
  const [turn, setTurn] = useState<Turn>(null);
  const [pendingPath, setPendingPath] = useState<string | null>(null);

  useEffect(() => {
    if (turn || pendingPath) return;
    const visible = showing === "front" ? frontId : backId;
    if (visible === currentFace) return;
    setFrontId(currentFace);
    setBackId(currentFace === "home" ? "afisha" : "home");
    setShowing("front");
  }, [backId, currentFace, frontId, pendingPath, showing, turn]);

  useEffect(() => {
    if (!pendingPath || !turn) return;
    const nextPath = pendingPath;
    const nextShowing = turn === "back" ? "back" : "front";
    const id = window.setTimeout(() => {
      setShowing(nextShowing);
      setTurn(null);
      setPendingPath(null);
      navigate(nextPath);
    }, 1450);
    return () => window.clearTimeout(id);
  }, [navigate, pendingPath, turn]);

  if (!enabled) return <Outlet />;

  const turnTo = (path: string) => {
    if (turn || pendingPath) return;
    const next = faceFromPath(path);
    const visible = showing === "front" ? frontId : backId;
    if (next === visible) return;
    if (showing === "front") setBackId(next);
    else setFrontId(next);
    setTurn(showing === "front" ? "back" : "front");
    setPendingPath(path);
  };

  const finishTurn = (event: AnimationEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget || !pendingPath || !turn) return;
    const nextPath = pendingPath;
    const nextShowing = turn === "back" ? "back" : "front";
    setShowing(nextShowing);
    setTurn(null);
    setPendingPath(null);
    navigate(nextPath);
  };

  const rotorClass = cn(
    "chalk-flip__rotor",
    !turn && showing === "back" && "chalk-flip__rotor--back",
    turn === "back" && "chalk-flip__rotor--turn-back",
    turn === "front" && "chalk-flip__rotor--turn-front",
  );

  const frontContext = { active: true, face: "front" as const, turning: turn !== null, turnTo };
  const backContext = { active: true, face: "back" as const, turning: turn !== null, turnTo };

  return (
    <div className="chalk-flip">
      <div className={rotorClass} onAnimationEnd={finishTurn}>
        <div className="chalk-flip__edge chalk-flip__edge--left" />
        <div className="chalk-flip__edge chalk-flip__edge--right" />
        <div className="chalk-flip__edge chalk-flip__edge--top" />
        <div className="chalk-flip__edge chalk-flip__edge--bottom" />

        <ChalkFlipContext.Provider value={frontContext}>
          <div className="chalk-flip__face chalk-flip__face--front">
            <div className="chalk-flip__face-clip">
              <FacePage id={frontId} />
            </div>
          </div>
        </ChalkFlipContext.Provider>
        <ChalkFlipContext.Provider value={backContext}>
          <div className="chalk-flip__face chalk-flip__face--back">
            <div className="chalk-flip__face-clip">
              <FacePage id={backId} />
            </div>
          </div>
        </ChalkFlipContext.Provider>
      </div>
    </div>
  );
};
