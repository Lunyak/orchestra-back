import { createBrowserRouter } from "react-router-dom";
// import EventPage from "../page/EventPage/EventPage";
import App from "../App";
import { ROUTES } from "../shared/model/routes";

export const router = createBrowserRouter([
  {
    element: <App />,
    path: ROUTES.HOME,
    children: [
      {
        path: ROUTES.EVENTS,
        lazy: () => import("../page/EventsPage/EventsPage"),
      },
      {
        path: ROUTES.EVENT,
        lazy: () => import("../page/EventPage/EventPage"),
      },
      {
        path: ROUTES.ABOUTUS,
        lazy: () => import("../page/AboutUs/AboutUs"),
      },
      {
        path: ROUTES.HOME,
        lazy: () => import("../page/HomePage/HomePage"),
      },
      {
        path: ROUTES.CONTACTS,
        lazy: () => import("../page/ContactsPage/ContactsPage"),
      },
    ],
  },
]);
