import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { AuthPage } from "./AuthPage";

describe("AuthPage", () => {
  it("sends Back to the editor to /write", () => {
    render(
      <MemoryRouter>
        <AuthPage mode="login" />
      </MemoryRouter>,
    );
    expect(screen.getByRole("link", { name: "Back to the editor" }).getAttribute("href")).toBe(
      "/write",
    );
  });
});
