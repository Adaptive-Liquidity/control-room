import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <div className="ml-[240px] min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 px-6 py-5 pb-10">{children}</main>
      </div>
    </div>
  );
}
