export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-aeon-navy flex items-center justify-center p-6 relative overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 50% -20%, rgba(45, 212, 191, 0.18), transparent), radial-gradient(ellipse 60% 40% at 100% 100%, rgba(16, 185, 129, 0.08), transparent)",
        }}
      />
      <div className="relative w-full max-w-md">{children}</div>
    </div>
  );
}
