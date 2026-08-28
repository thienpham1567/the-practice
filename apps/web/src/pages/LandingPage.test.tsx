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

    expect(screen.getByText("Sit the paper. Take the turn.")).toBeTruthy();
    expect(
      screen.getByText("Daily writing and a timed long turn, marked like an examiner."),
    ).toBeTruthy();
    expect(screen.getByText("Vol. 1 · 26 August 2026 · Writing & speaking")).toBeTruthy();
    expect(screen.getByText("Paper · B1 · Email · 20 min · 80–120 words")).toBeTruthy();
    expect(
      screen.getByText("Write an email to a specific person for a given purpose."),
    ).toBeTruthy();
    expect(
      screen.getByText(
        "Your friend is visiting your city next month. Write to them. Tell them what you can do together and suggest a place to meet.",
      ),
    ).toBeTruthy();
    expect(screen.getByText("Talk · B1 · Part 2 · 1 min prep · 2 min")).toBeTruthy();
    expect(
      screen.getByText("One minute to prepare. Then speak for up to two minutes."),
    ).toBeTruthy();
    expect(
      screen.getByText(
        "Describe a place you like to go in your free time. You should say where it is, what you do there, and why you enjoy it.",
      ),
    ).toBeTruthy();

    expect(screen.getByRole("link", { name: "Begin practice" }).getAttribute("href")).toBe(
      "/register",
    );
    expect(screen.getByRole("link", { name: "Open a draft" }).getAttribute("href")).toBe(
      "/write",
    );
    expect(screen.getByRole("link", { name: "Sign in" }).getAttribute("href")).toBe("/login");
  });
});
