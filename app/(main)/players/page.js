'use client';

import { useAppData } from '@/lib/AppDataContext';
import PlayersPage from '@/components/pages/PlayersPage';

export default function PlayersRoute() {
  const { players, refetchPlayers, ongoingMatches, matchQueue } = useAppData();
  return (
    <main className="mx-auto w-full max-w-6xl space-y-8 px-6 pb-14 pt-20 lg:pt-4">
      <PlayersPage
        players={players}
        onPlayersUpdated={() => refetchPlayers()}
        ongoingMatches={ongoingMatches}
        matchQueue={matchQueue}
      />
    </main>
  );
}
