import { render, screen } from "@testing-library/react";

jest.mock(
  "react-router-dom",
  () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const React = require("react");

    return {
      Outlet: () => React.createElement("div", { "data-testid": "outlet" }),
      useNavigation: () => ({ state: "idle" }),
    };
  },
  { virtual: true }
);

import App from "./App";

test("renders app outlet", () => {
  render(<App />);
  expect(screen.getByTestId("outlet")).toBeInTheDocument();
});
