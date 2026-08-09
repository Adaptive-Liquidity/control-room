"use client";
export default function CalendarPage() {
  const days = [];
  for (let i = 1; i <= 31; i++) {
    const hasContent = [2, 5, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30].includes(i);
    days.push(
      <div key={i} className={`aspect-square p-2 rounded-lg border text-[11px] cursor-pointer transition-all ${hasContent ? "border-aeon-teal bg-aeon-teal/5" : "border-aeon-navy-3 bg-aeon-navy-2 hover:border-aeon-navy-4"}`}>
        <div className="font-bold">{i}</div>
        {hasContent && <div className="flex gap-1 mt-1 flex-wrap"><span className="w-1.5 h-1.5 rounded-full bg-aeon-teal" />{i % 3 === 0 && <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />}{i % 5 === 0 && <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />}</div>}
      </div>
    );
  }
  return (
    <div className="animate-fade-in">
      <div className="p-6 rounded-xl border border-aeon-navy-3 bg-gradient-to-br from-aeon-navy-2 to-aeon-navy-1">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold">📅 Epoch-Aligned Content Calendar — August 2026</h2>
          <div className="flex gap-2">
            <button className="px-3 py-1.5 rounded-lg bg-aeon-navy-3 text-xs">← Prev</button>
            <button className="px-3 py-1.5 rounded-lg bg-aeon-navy-3 text-xs">Next →</button>
          </div>
        </div>
        <div className="grid grid-cols-7 gap-1 mb-2">
          {["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"].map((d) => <div key={d} className="text-center text-[10px] text-muted-foreground font-bold py-1">{d}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1.5">{days}</div>
        <div className="flex gap-4 mt-4 justify-center">
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><span className="w-2 h-2 rounded-full bg-aeon-teal" /> Twitter/X</div>
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><span className="w-2 h-2 rounded-full bg-orange-500" /> Blog</div>
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><span className="w-2 h-2 rounded-full bg-amber-500" /> Email</div>
        </div>
      </div>
    </div>
  );
}
