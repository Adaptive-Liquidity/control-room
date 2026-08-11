"use client";

import { useState } from "react";
import { MobileTabBar } from "./mobile-tab-bar";
import { MoreSheet } from "./more-sheet";

export function MobileNav() {
  const [moreOpen, setMoreOpen] = useState(false);

  return (
    <>
      <MobileTabBar onOpenMore={() => setMoreOpen(true)} />
      <MoreSheet open={moreOpen} onOpenChange={setMoreOpen} />
    </>
  );
}
