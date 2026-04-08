'use client';

import { useRouter } from 'next/navigation';
import { useAppData } from '@/lib/AppDataContext';
import DashboardPage from '@/components/pages/DashboardPage';

export default function HomePage() {
  const router = useRouter();
  const {
    sessions,
    ongoingMatches,
    matchQueue,
    players,
    courts,
    isLoading,
    errorMessage,
    handleStartSession,
    handleViewSession,
    handleEditSession,
    handleEndSessionClick,
    setIsFormOpen,
    setEditSession,
    setFilteredSessionId,
  } = useAppData();

  const handleNavigateToMatches = (session) => {
    setFilteredSessionId(session._id);
    router.push('/ongoing');
  };

  return (
    <>
      <header className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-6 py-10 pt-20 lg:pt-10">
        <h1 className="text-xl font-semibold text-white md:text-2xl">DASHBOARD</h1>
        <p className="max-w-1xl text-sm text-slate-300 sm:text-base">
          C-ONE SPORT CENTER BADMINTON QUEUING
        </p>
      </header>
      <main className="mx-auto w-full max-w-6xl space-y-8 px-6 pb-14 pt-0">
        <DashboardPage
          sessions={sessions}
          ongoingMatches={ongoingMatches}
          matchQueue={matchQueue}
          players={players}
          courts={courts}
          isLoading={isLoading}
          error={errorMessage}
          onStartSession={handleStartSession}
          onViewSession={handleViewSession}
          onEditSession={handleEditSession}
          onEndSession={handleEndSessionClick}
          onCreateSession={() => {
            setEditSession(null);
            setIsFormOpen(true);
          }}
          onNavigateToMatches={handleNavigateToMatches}
        />
      </main>
    </>
  );
}
