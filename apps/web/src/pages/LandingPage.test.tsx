import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { LandingPage } from "./LandingPage";

describe("LandingPage", () => {
  it("is a single hero with practice as the primary action", () => {
    render(
      <MemoryRouter>
        <LandingPage now={new Date(2026, 7, 26)} />
      </MemoryRouter>,
    );

    expect(screen.getByText("Sit the paper. Take the turn.")).toBeTruthy();
    expect(
      screen.getByText("Daily writing and a timed long turn, marked like an examiner."),
    ).toBeTruthy();
    expect(screen.getByText("WEDNESDAY, 26 AUGUST 2026")).toBeTruthy();

    const begin = screen.getByRole("link", { name: "Begin practice" });
    expect(begin.getAttribute("href")).toBe("/register");
    const draft = screen.getByRole("link", { name: "Open a draft" });
    expect(draft.getAttribute("href")).toBe("/write");
    expect(screen.getByRole("link", { name: "Sign in" }).getAttribute("href")).toBe("/login");
    expect(document.querySelector(".landing-deckle")).toBeNull();
  });
});
