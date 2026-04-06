export default function Loading() {
  return (
    <div className="absolute inset-0 z-100 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm">
      <div className="w-[min(90vw,22rem)] rounded-xl border border-white/10 bg-slate-900/95 p-5 text-center shadow-2xl">
        <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-slate-600 border-t-emerald-400" />
        <p className="text-sm font-semibold text-white">Loading page...</p>
        <p className="mt-1 text-xs text-slate-400">Please wait while we fetch the latest data.</p>
      </div>
    </div>
  );
}
