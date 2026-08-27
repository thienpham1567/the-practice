import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ToolbarPlugin } from "./ToolbarPlugin";

afterEach(() => {
  cleanup();
});

describe("ToolbarPlugin", () => {
  it("scrolls horizontally instead of expanding narrow viewports", () => {
    render(
      <LexicalComposer
        initialConfig={{
          namespace: "toolbar-overflow-test",
          onError: (error) => {
            throw error;
          },
        }}
      >
        <ToolbarPlugin />
      </LexicalComposer>,
    );

    const toolbar = screen.getByTestId("editor-toolbar");
    expect(toolbar.className).toMatch(/\boverflow-x-auto\b/);
    expect(toolbar.className).toMatch(/\bmin-w-0\b/);
    // Tools stay available — not permanently hidden on narrow screens.
    expect(screen.getByLabelText("Numbered list")).toBeTruthy();
    expect(screen.getByLabelText("Quote")).toBeTruthy();
  });
});
