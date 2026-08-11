import { Sidebar } from "@/components/layout/sidebar";
import { IconRail } from "@/components/layout/icon-rail";
import { MobileNav } from "@/components/layout/mobile-nav";
import { Header } from "@/components/layout/header";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <IconRail />
      <div className="flex min-h-screen flex-col md:ml-14 lg:ml-[212px]">
        <Header />
        <main className="animate-fade-in flex-1 px-4 py-4 pb-[calc(6rem+env(safe-area-inset-bottom))] sm:px-6 md:py-6 md:pb-10 lg:px-7">
          {children}
        </main>
      </div>
      <MobileNav />
    </div>
  );
}
