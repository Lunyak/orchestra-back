import { createBrowserRouter } from "react-router-dom";
// import EventPage from "../page/EventPage/EventPage";
import App from "../App";
import { Component as AboutUs } from "../page/AboutUs/AboutUs";
import { Component as ContactsPage } from "../page/ContactsPage/ContactsPage";
import { Component as EventsPage } from "../page/EventsPage/EventsPage";
import { Component as HomePage } from "../page/HomePage/HomePage";
import { ChalkBoardFlipLayout } from "../shared/component/ChalkBoardFlip/ChalkBoardFlip";
import { ROUTES } from "../shared/model/routes";

export const router = createBrowserRouter([
  {
    element: <App />,
    path: ROUTES.HOME,
    children: [
      {
        element: <ChalkBoardFlipLayout />,
        children: [
          {
            path: ROUTES.HOME,
            element: <HomePage />,
          },
          {
            path: ROUTES.EVENTS,
            element: <EventsPage />,
          },
          {
            path: ROUTES.LEGACY_EVENTS,
            element: <EventsPage />,
          },
          {
            path: ROUTES.ABOUTUS,
            element: <AboutUs />,
          },
          {
            path: ROUTES.LEGACY_ABOUTUS,
            element: <AboutUs />,
          },
          {
            path: ROUTES.CONTACTS,
            element: <ContactsPage />,
          },
          {
            path: ROUTES.LEGACY_CONTACTS,
            element: <ContactsPage />,
          },
        ],
      },
      {
        path: ROUTES.EVENT,
        lazy: () => import("../page/EventPage/EventPage"),
      },
      {
        path: ROUTES.LEGACY_EVENT,
        lazy: () => import("../page/EventPage/EventPage"),
      },
    ],
  },
]);
