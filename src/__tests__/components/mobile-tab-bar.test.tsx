/**
 * @jest-environment jsdom
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { MobileTabBar } from "@/components/layout/mobile-tab-bar";

jest.mock("next/navigation", () => ({
  usePathname: () => "/queue",
}));

describe("MobileTabBar", () => {
  it("renders the four primary tabs and a More button", () => {
    render(<MobileTabBar onOpenMore={() => {}} />);
    for (const label of ["Dashboard", "Queue", "Agents", "Calendar"]) {
      expect(screen.getByRole("link", { name: label })).toBeInTheDocument();
    }
    expect(screen.getByRole("button", { name: /more/i })).toBeInTheDocument();
  });

  it("marks the current tab as active", () => {
    render(<MobileTabBar onOpenMore={() => {}} />);
    expect(screen.getByRole("link", { name: "Queue" })).toHaveAttribute(
      "aria-current",
      "page"
    );
    expect(screen.getByRole("link", { name: "Dashboard" })).not.toHaveAttribute(
      "aria-current"
    );
  });

  it("calls onOpenMore when More is pressed", () => {
    const onOpenMore = jest.fn();
    render(<MobileTabBar onOpenMore={onOpenMore} />);
    fireEvent.click(screen.getByRole("button", { name: /more/i }));
    expect(onOpenMore).toHaveBeenCalledTimes(1);
  });
});
