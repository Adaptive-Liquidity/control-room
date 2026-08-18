/**
 * @jest-environment jsdom
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { MoreSheet } from "@/components/layout/more-sheet";

jest.mock("next/navigation", () => ({
  usePathname: () => "/settings",
}));

jest.mock("next-auth/react", () => ({
  useSession: () => ({
    data: {
      user: { id: "u1", name: "Ops Admin", email: "admin@aeon.test", role: "ADMIN" },
    },
    status: "authenticated",
  }),
  signOut: jest.fn(),
}));

describe("MoreSheet", () => {
  it("renders remaining destinations when open", () => {
    render(<MoreSheet open onOpenChange={() => {}} />);
    expect(screen.getByRole("dialog", { name: "Menu" })).toBeInTheDocument();
    for (const label of [
      "Studio",
      "Attribution",
      "Analytics",
      "A/B Lab",
      "Library",
      "Campaigns",
      "Audit",
      "Team",
      "Settings",
    ]) {
      expect(screen.getByRole("link", { name: label })).toBeInTheDocument();
    }
  });

  it("does not render primary tabs", () => {
    render(<MoreSheet open onOpenChange={() => {}} />);
    expect(screen.queryByRole("link", { name: "Dashboard" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Queue" })).toBeNull();
  });

  it("closes after a destination is chosen", () => {
    const onOpenChange = jest.fn();
    render(<MoreSheet open onOpenChange={onOpenChange} />);
    fireEvent.click(screen.getByRole("link", { name: "Settings" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("renders nothing when closed", () => {
    render(<MoreSheet open={false} onOpenChange={() => {}} />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
