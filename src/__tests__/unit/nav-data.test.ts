import {
  isNavItemActive,
  moreSections,
  navSections,
  primaryTabHrefs,
  primaryTabs,
} from "@/components/layout/nav-data";

describe("nav-data", () => {
  it("primaryTabs resolve in display order", () => {
    expect(primaryTabs.map((t) => t.href)).toEqual([...primaryTabHrefs]);
    expect(primaryTabs.map((t) => t.label)).toEqual([
      "Dashboard",
      "Queue",
      "Agents",
      "Calendar",
    ]);
  });

  it("moreSections exclude primary tabs and drop empty sections", () => {
    const moreHrefs = moreSections.flatMap((s) => s.items.map((i) => i.href));
    for (const href of primaryTabHrefs) expect(moreHrefs).not.toContain(href);
    for (const section of moreSections) {
      expect(section.items.length).toBeGreaterThan(0);
    }
    // Studio is not a primary tab but must stay reachable via More
    expect(moreHrefs).toContain("/studio");
    // Every nav item is reachable: either a primary tab or in More
    const all = navSections.flatMap((s) => s.items.map((i) => i.href));
    for (const href of all) {
      expect([...primaryTabHrefs, ...moreHrefs]).toContain(href);
    }
  });

  describe("isNavItemActive", () => {
    it("matches the exact href", () => {
      expect(isNavItemActive("/queue", "/queue")).toBe(true);
    });
    it("matches nested routes", () => {
      expect(isNavItemActive("/campaigns/abc", "/campaigns")).toBe(true);
    });
    it("rejects sibling prefixes", () => {
      expect(isNavItemActive("/queuex", "/queue")).toBe(false);
    });
    it("rejects unrelated routes", () => {
      expect(isNavItemActive("/dashboard", "/queue")).toBe(false);
    });
  });
});
