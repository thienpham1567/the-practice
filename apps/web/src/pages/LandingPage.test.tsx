import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { LandingPage } from "./LandingPage";

describe("LandingPage", () => {
  it("is a broadsheet with practice as the primary action", () => {
    render(
      <MemoryRouter>
        <LandingPage now={new Date(2026, 7, 26)} />
      </MemoryRouter>,
    );

    expect(screen.getByText("Sit the next paper.")).toBeTruthy();
    expect(screen.getByText("Vol. 1 · 26 August 2026 · English writing")).toBeTruthy();
    expect(screen.getByText("Paper · B1 · Email · 20 min · 80–120 words")).toBeTruthy();
    expect(
      screen.getByText("Write an email to a specific person for a given purpose."),
    ).toBeTruthy();
    expect(
      screen.getByText(
        "Your friend is visiting your city next month. Write to them. Tell them what you can do together and suggest a place to meet.",
      ),
    ).toBeTruthy();

    expect(screen.getByRole("link", { name: "Sit a paper" }).getAttribute("href")).toBe(
      "/register",
    );
    expect(screen.getByRole("link", { name: "Open a draft" }).getAttribute("href")).toBe(
      "/write",
    );
    expect(screen.getByRole("link", { name: "Sign in" }).getAttribute("href")).toBe("/login");
  });
});
