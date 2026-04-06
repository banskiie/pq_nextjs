'use client';

import { useAppData } from '@/lib/AppDataContext';
import OngoingMatchesPage from '@/page-components/OngoingMatchesPage';

export default function OngoingRoute() {
  const {
    ongoingMatches,
    matchQueue,
    sessions,
    players,
    courts,
    handleUpdateOngoingMatch,
    handleEndOngoingMatch,
    handleCreateMatch,
    handleStartQueuedMatch,
    handleEditMatch,
    handleCancelMatch,
    filteredSessionId,
    setFilteredSessionId,
  } = useAppData();

  return (
    <main className="mx-auto w-full max-w-6xl space-y-8 px-6 pb-14 pt-20 lg:pt-4">
      <OngoingMatchesPage
        ongoingMatches={ongoingMatches}
        matchQueue={matchQueue}
        sessions={sessions}
        players={players}
        courts={courts}
        onUpdateMatch={handleUpdateOngoingMatch}
        onEndMatch={handleEndOngoingMatch}
        onCreateMatch={handleCreateMatch}
        onStartMatch={handleStartQueuedMatch}
        onEditMatch={handleEditMatch}
        onCancelMatch={handleCancelMatch}
        filteredSessionId={filteredSessionId}
        onClearFilter={() => setFilteredSessionId(null)}
        onFilterSessionChange={(sessionId) => setFilteredSessionId(sessionId)}
      />
    </main>
  );
}
