import { Outlet, useNavigation } from "react-router-dom";
import "./App.css";
import Preloader from "./shared/component/Preloader/Preloader";

function App() {
  const navigation = useNavigation();
  const showPreloader = navigation.state === "loading";

  return (
    <div className="App">
      {showPreloader && <Preloader fullscreen />}
      <Outlet />
    </div>
  );
}

export default App;
