import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BandStamp } from "./BandStamp";

describe("BandStamp", () => {
  it("shows band 6.5 with the CEFR label B2", () => {
    render(<BandStamp band={6.5} />);
    expect(screen.getByText("Band 6.5")).toBeTruthy();
    expect(screen.getByText("B2")).toBeTruthy();
  });
});
