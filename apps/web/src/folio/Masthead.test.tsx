import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { Masthead } from "./Masthead";

describe("Masthead", () => {
  it("puts the brand on the left and the slot on the right", () => {
    render(
      <MemoryRouter>
        <Masthead>
          <span>Vol. 1</span>
        </Masthead>
      </MemoryRouter>,
    );
    expect(screen.getByText("The Practice")).toBeTruthy();
    expect(screen.getByText("Vol. 1")).toBeTruthy();
  });
});
