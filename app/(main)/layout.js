import Sidebar from '@/components/Sidebar';

export default function MainLayout({ children }) {
  return (
    <div className="relative min-h-screen bg-slate-950 text-slate-100">
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-32 right-0 h-80 w-80 rounded-full bg-linear-to-br from-amber-300/60 to-rose-400/50 blur-2xl" />
        <div className="absolute -bottom-40 left-0 h-96 w-96 rounded-full bg-linear-to-br from-sky-400/40 to-emerald-400/30 blur-2xl" />
      </div>
      <Sidebar />
      <div className="lg:ml-72">
        {children}
      </div>
    </div>
  );
}
