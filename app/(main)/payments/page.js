'use client';

import { useAppData } from '@/lib/AppDataContext';
import PaymentsPage from '@/components/pages/PaymentsPage';

export default function PaymentsRoute() {
  const {
    sessions,
    players,
    ongoingMatches,
    matchQueue,
    gamesBySessionData,
    paymentsHistoryData,
    handleFinishPlayer,
    filteredSessionId,
    setFilteredSessionId,
  } = useAppData();

  return (
    <main className="mx-auto w-full max-w-6xl space-y-8 px-6 pb-14 pt-20 lg:pt-4">
      <PaymentsPage
        sessions={sessions}
        players={players}
        ongoingMatches={ongoingMatches}
        matchQueue={matchQueue}
        games={gamesBySessionData}
        payments={paymentsHistoryData}
        onFinishPlayer={handleFinishPlayer}
        filteredSessionId={filteredSessionId}
        onFilterSessionChange={(sessionId) => setFilteredSessionId(sessionId)}
      />
    </main>
  );
}
