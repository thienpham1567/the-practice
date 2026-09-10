import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Editor } from "./Editor";

vi.mock("../api/ai", () => ({
  getAiStatus: () => Promise.resolve({ enabled: false }),
}));

afterEach(() => {
  cleanup();
});

function renderEditor(
  props: Partial<{
    title: string;
    onTitleChange: (title: string) => void;
  }> = {},
) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <Editor mode="write" onChange={() => undefined} onAnalysis={() => undefined} {...props} />
    </QueryClientProvider>,
  );
}

describe("Editor sheet", () => {
  it("puts the document title on the sheet when provided", () => {
    renderEditor({ title: "Untitled", onTitleChange: () => undefined });

    const title = screen.getByLabelText("Document title");
    expect(title.closest(".editor-sheet")).not.toBeNull();
  });

  it("does not show a title field without onTitleChange", () => {
    renderEditor();
    expect(screen.queryByLabelText("Document title")).toBeNull();
  });

  it("keeps the toolbar the same width as the sheet", () => {
    renderEditor();
    const bar = screen.getByTestId("editor-toolbar-bar");
    expect(bar.className).toContain("max-w-[46rem]");
    expect(bar.className).toContain("mx-auto");
  });
});
