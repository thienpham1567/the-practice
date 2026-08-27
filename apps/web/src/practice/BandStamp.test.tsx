import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { BandStamp } from "./BandStamp";

afterEach(() => {
  cleanup();
});

describe("BandStamp", () => {
  it("shows band 6.5 with an approximate CEFR conversion label", () => {
    render(<BandStamp band={6.5} />);
    expect(screen.getByText("Band 6.5")).toBeTruthy();
    expect(screen.getByText("≈ B2")).toBeTruthy();
  });

  it("explains the CEFR label as a band conversion, not the practice level", () => {
    render(<BandStamp band={7} />);
    const cefr = screen.getByText("≈ C1");
    expect(cefr.getAttribute("title")).toMatch(/converted from this IELTS band/i);
    expect(cefr.getAttribute("aria-label")).toMatch(/not the practice level/i);
  });
});
