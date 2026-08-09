import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-aeon-navy">
      <Sidebar />
      <div className="flex-1 ml-[270px]">
        <Header />
        <main className="p-6 pb-12">{children}</main>
      </div>
    </div>
  );
}
