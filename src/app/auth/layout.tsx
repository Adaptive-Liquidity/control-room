export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center justify-center gap-2 text-center">
          <div className="flex h-7 w-7 items-center justify-center rounded-md border border-border bg-secondary text-[12px] font-semibold text-foreground/90">
            A
          </div>
          <div className="text-left">
            <div className="text-[13px] font-semibold tracking-tight text-foreground/90">AEON</div>
            <div className="font-mono text-[10px] tracking-wide text-muted-foreground">Control Room</div>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}
