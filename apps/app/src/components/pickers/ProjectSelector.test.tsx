// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ProjectSelector } from "./ProjectSelector";

const projects = Array.from({ length: 6 }, (_, index) => ({
  id: `p${index + 1}`,
  name: index === 5 ? "Docs Engine" : `Project ${index + 1}`,
}));

describe("ProjectSelector", () => {
  afterEach(cleanup);

  it("filters long project lists by name", async () => {
    const onChange = vi.fn();
    render(
      <ProjectSelector projects={projects} value="p1" onChange={onChange} />,
    );

    fireEvent.pointerDown(screen.getByRole("button", { name: "Project" }), {
      button: 0,
    });

    const search = await screen.findByRole("textbox", {
      name: "Search projects",
    });
    expect(document.activeElement).toBe(search);
    fireEvent.change(search, { target: { value: "docs" } });

    const menu = screen.getByRole("menu");
    expect(within(menu).queryByText("Project 1")).toBeNull();

    const match = within(menu).getByRole("menuitem", {
      name: "Docs Engine",
    });
    fireEvent.click(match);

    expect(onChange).toHaveBeenCalledWith("p6");
  });
});
