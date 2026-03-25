import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HomeShell } from "@/components/home-shell";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

describe("HomeShell", () => {
  it("opens session creation panel", () => {
    render(<HomeShell />);

    fireEvent.click(screen.getByRole("button", { name: "새 세션 시작" }));

    expect(screen.getByText("Create Session")).toBeInTheDocument();
    expect(screen.getByText("진행자 AI")).toBeInTheDocument();
  });
});
