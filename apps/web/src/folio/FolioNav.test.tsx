import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useAuthStore } from "../api/auth-store";
import { FolioNav } from "./FolioNav";

const ALL = ["Writing", "Speaking", "Vocabulary", "Progress", "Drafts"];

function renderNav(current?: string) {
  return render(
    <MemoryRouter>
      <FolioNav current={current} />
    </MemoryRouter>,
  );
}

describe("FolioNav", () => {
  beforeEach(() => {
    useAuthStore.setState({ accessToken: null, user: null, status: "ready" });
  });

  afterEach(cleanup);

  it("reaches every other section from any page", () => {
    for (const current of ["/practice", "/speaking", "/vocab", "/progress", "/docs"]) {
      const { unmount } = renderNav(current);
      const shown = screen.getAllByRole("link").map((link) => link.textContent);
      // Bốn đích còn lại đều có mặt — không trang nào là ngõ cụt.
      expect(shown).toHaveLength(ALL.length - 1);
      unmount();
    }
  });

  it("omits a link back to the page you are already on", () => {
    renderNav("/speaking");
    expect(screen.queryByRole("link", { name: "Speaking" })).toBeNull();
    expect(screen.getByRole("link", { name: "Writing" })).toBeTruthy();
  });

  it("shows every destination when no current page is given", () => {
    renderNav();
    for (const label of ALL) {
      expect(screen.getByRole("link", { name: label })).toBeTruthy();
    }
  });

  it("hides sign out until there is a session", () => {
    renderNav("/practice");
    expect(screen.queryByRole("button", { name: "Sign out" })).toBeNull();
    cleanup();

    useAuthStore.setState({
      accessToken: "token",
      user: { id: "u1", email: "writer@example.com" },
      status: "ready",
    });
    renderNav("/practice");
    expect(screen.getByRole("button", { name: "Sign out" })).toBeTruthy();
  });
});
