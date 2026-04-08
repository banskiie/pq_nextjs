'use client';

import React from 'react';
import { useAppData } from '@/lib/AppDataContext';
import SessionForm from './SessionForm';
import EditMatchForm from './EditMatchForm';
import CreateMatchForm from './CreateMatchForm';
import SessionDetailPage from './SessionDetailPage';

export default function GlobalModals() {
  const {
    sessions,
    players,
    courts,
    ongoingMatches,
    matchQueue,
    // Session form
    isFormOpen,
    setIsFormOpen,
    editSession,
    setEditSession,
    handleCreateSession,
    createLoading,
    updateLoading,
    // Edit match
    isEditMatchModalOpen,
    setIsEditMatchModalOpen,
    selectedMatch,
    setSelectedMatch,
    handleEditMatchSubmit,
    // Create match
    isCreateMatchModalOpen,
    setIsCreateMatchModalOpen,
    handleCreateMatchSubmit,
    filteredSessionId,
    selectedSessionId: contextSelectedSessionId,
    // Message modal
    isMessageModalOpen,
    setIsMessageModalOpen,
    messageModalText,
    // Winner selection
    selectedMatchForWinners,
    setSelectedMatchForWinners,
    winnerTeam,
    setWinnerTeam,
    handleConfirmEndMatch,
    recordGameLoading,
    isEndingMatch,
    // Congrats toast
    congratsToast,
    setCongratsToast,
    // End session confirm
    endSessionTarget,
    setEndSessionTarget,
    showEndConfirm,
    setShowEndConfirm,
    handleConfirmEndSession,
    endSessionLoading,
    showEndBlocked,
    setShowEndBlocked,
    // Session detail
    selectedSessionId,
    setSelectedSessionId,
    setOngoingMatches,
    setMatchQueue,
  } = useAppData();

  const getPlayerName = (playerId) => {
    return players.find((p) => p._id === playerId)?.name || 'Unknown';
  };

  const getTeamsForMatch = (match) => {
    const ids = match?.playerIds || [];
    const midpoint = Math.floor(ids.length / 2);
    return { team1: ids.slice(0, midpoint), team2: ids.slice(midpoint) };
  };

  return (
    <>
      <SessionForm
        session={editSession}
        sessions={sessions}
        isOpen={isFormOpen}
        onClose={() => {
          setIsFormOpen(false);
          setEditSession(null);
        }}
        onSubmit={handleCreateSession}
        isLoading={editSession ? updateLoading : createLoading}
      />

      <EditMatchForm
        match={selectedMatch}
        courts={courts}
        sessions={sessions}
        players={players}
        ongoingMatches={ongoingMatches}
        matchQueue={matchQueue}
        isOpen={isEditMatchModalOpen}
        onClose={() => {
          setIsEditMatchModalOpen(false);
          setSelectedMatch(null);
        }}
        onSubmit={handleEditMatchSubmit}
        isLoading={false}
      />

      <CreateMatchForm
        sessions={sessions}
        players={players}
        isOpen={isCreateMatchModalOpen}
        onClose={() => setIsCreateMatchModalOpen(false)}
        onSubmit={handleCreateMatchSubmit}
        isLoading={false}
        ongoingMatches={ongoingMatches}
        matchQueue={matchQueue}
        currentSessionId={filteredSessionId || contextSelectedSessionId}
      />

      {isMessageModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="relative w-full max-w-md rounded-xl border border-white/10 bg-slate-900 p-5 shadow-2xl">
            <button
              onClick={() => setIsMessageModalOpen(false)}
              className="absolute right-3 top-3 text-slate-400 hover:text-white"
              type="button"
              aria-label="Close message"
            >
              ✕
            </button>
            <h3 className="mb-2 text-lg font-semibold text-white">Cannot Update Session</h3>
            <p className="mb-4 text-sm text-slate-300">{messageModalText}</p>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setIsMessageModalOpen(false)}
                className="rounded-full bg-emerald-500/20 px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-200 transition hover:bg-emerald-500/30"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedMatchForWinners && (() => {
        const { team1, team2 } = getTeamsForMatch(selectedMatchForWinners);

        const renderTeamCard = (teamKey, label, teamPlayers, styleClasses) => {
          const isSelected = winnerTeam === teamKey;
          return (
            <button
              key={teamKey}
              type="button"
              onClick={() => setWinnerTeam(teamKey)}
              className={`mb-4 w-full rounded-lg border p-3 text-left transition ${
                isSelected ? styleClasses.selected : styleClasses.default
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-300">{label}</div>
                {isSelected && (
                  <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-200">Selected</span>
                )}
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {teamPlayers.length > 0 ? (
                  teamPlayers.map((playerId) => (
                    <span
                      key={playerId}
                      className={`rounded-md border px-2 py-1 text-sm transition ${
                        isSelected
                          ? 'border-emerald-300/50 bg-emerald-500/20 text-emerald-100'
                          : 'border-white/15 bg-white/5 text-white'
                      }`}
                    >
                      {getPlayerName(playerId)}
                    </span>
                  ))
                ) : (
                  <span className="text-sm text-slate-400">Unknown</span>
                )}
              </div>
            </button>
          );
        };

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="relative w-full max-w-md rounded-lg bg-slate-900 p-6 shadow-2xl">
              <button
                onClick={() => setSelectedMatchForWinners(null)}
                className="absolute right-4 top-4 rounded-full bg-slate-800 p-2 hover:bg-slate-700 transition"
              >
                <svg className="h-5 w-5 text-slate-100" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>

              <h2 className="mb-4 text-xl font-semibold text-white">End Match</h2>
              <p className="mb-4 text-sm text-slate-300">Winner selection is optional for casual games.</p>

              <div className="mb-6">
                <button
                  type="button"
                  onClick={() => setWinnerTeam('none')}
                  className={`mb-4 w-full rounded-lg border p-3 text-left transition ${
                    winnerTeam === 'none'
                      ? 'border-emerald-300/50 bg-emerald-500/15'
                      : 'border-white/10 bg-white/5 hover:border-emerald-300/30 hover:bg-emerald-500/10'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-300">Casual Match</div>
                    {winnerTeam === 'none' && (
                      <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-200">Selected</span>
                    )}
                  </div>
                  <div className="mt-2 text-sm text-slate-300">No winner will be recorded.</div>
                </button>

                {renderTeamCard('team1', 'Team 1', team1, {
                  selected: 'border-blue-300/50 bg-blue-500/20',
                  default: 'border-white/10 bg-white/5 hover:border-blue-300/30 hover:bg-blue-500/10',
                })}
                {renderTeamCard('team2', 'Team 2', team2, {
                  selected: 'border-rose-300/50 bg-rose-500/20',
                  default: 'border-white/10 bg-white/5 hover:border-rose-300/30 hover:bg-rose-500/10',
                })}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setSelectedMatchForWinners(null)}
                  className="flex-1 rounded-lg border border-white/20 px-4 py-2 font-semibold text-white/80 transition hover:bg-white/5 hover:text-white"
                >
                  Cancel
                </button>
                {(recordGameLoading || isEndingMatch) ? (
                  <div className="flex-1 rounded-lg overflow-hidden">
                    <div className="relative h-10 w-full animate-pulse rounded-lg bg-emerald-500/20">
                      <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.4s_infinite] bg-linear-to-r from-transparent via-emerald-400/20 to-transparent" />
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={handleConfirmEndMatch}
                    className="flex-1 rounded-lg bg-emerald-500/20 px-4 py-2 font-semibold text-emerald-200 transition hover:bg-emerald-500/30"
                  >
                    End Match
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {congratsToast && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="relative w-full max-w-2xl rounded-2xl border border-emerald-400/20 bg-slate-900/95 p-10 text-center shadow-2xl">
            <button
              onClick={() => setCongratsToast(null)}
              className="absolute right-4 top-4 rounded-full bg-slate-800 p-2 hover:bg-slate-700 transition"
            >
              <svg className="h-5 w-5 text-slate-100" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <div className="mb-4 text-4xl sm:text-5xl">🎉</div>
            <div className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-300 sm:text-sm">Congratulations</div>
            <div className="mt-4 text-2xl font-semibold text-white sm:text-3xl">
              {congratsToast.winners.join(' & ')}
            </div>
            <div className="mt-6 text-xs uppercase tracking-[0.3em] text-slate-400 sm:text-sm">Defeated</div>
            <div className="mt-2 text-lg font-semibold text-slate-300 sm:text-xl">
              {congratsToast.losers.join(' & ')}
            </div>
            <button
              onClick={() => setCongratsToast(null)}
              className="mt-8 w-full rounded-lg bg-emerald-500/30 px-4 py-3 text-base font-semibold text-emerald-100 transition hover:bg-emerald-500/40 sm:text-lg"
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {showEndConfirm && endSessionTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="relative w-full max-w-md rounded-lg bg-slate-900 p-6 shadow-2xl">
            <button
              onClick={() => setShowEndConfirm(false)}
              className="absolute right-4 top-4 rounded-full bg-slate-800 p-2 hover:bg-slate-700 transition"
            >
              <svg className="h-5 w-5 text-slate-100" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <h2 className="mb-4 text-xl font-bold text-white">End Session?</h2>
            <p className="mb-6 text-sm text-slate-300">
              Are you sure you want to end the session &quot;{endSessionTarget.name}&quot;? This will close the session and prevent further matches from being recorded.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowEndConfirm(false)}
                className="flex-1 rounded-lg border border-slate-500 px-4 py-2 font-semibold text-slate-200 transition hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmEndSession}
                disabled={endSessionLoading}
                className="flex-1 rounded-lg bg-rose-500/30 px-4 py-2 font-semibold text-rose-200 transition hover:bg-rose-500/40 disabled:opacity-50"
              >
                {endSessionLoading ? 'Ending...' : 'End Session'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showEndBlocked && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="relative w-full max-w-md rounded-lg bg-slate-900 p-6 shadow-2xl">
            <button
              onClick={() => setShowEndBlocked(false)}
              className="absolute right-4 top-4 rounded-full bg-slate-800 p-2 hover:bg-slate-700 transition"
            >
              <svg className="h-5 w-5 text-slate-100" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <h2 className="mb-4 text-xl font-bold text-white uppercase">Cannot End Session</h2>
            <p className="mb-6 text-sm text-slate-300">
              There are ongoing or queued matches. Please finish or clear them before ending this session.
            </p>
            <button
              onClick={() => setShowEndBlocked(false)}
              className="w-full rounded-lg bg-slate-800 px-4 py-2 font-semibold text-slate-200 transition hover:bg-slate-700"
            >
              OK
            </button>
          </div>
        </div>
      )}

      {selectedSessionId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-8 overflow-auto">
          <div className="relative w-full max-w-4xl my-auto rounded-lg bg-slate-900 shadow-2xl">
            <button
              onClick={() => setSelectedSessionId(null)}
              className="absolute top-4 right-4 z-10 rounded-full bg-slate-800 hover:bg-slate-700 p-2 transition"
            >
              <svg className="h-6 w-6 text-slate-100" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <div className="p-6">
              <SessionDetailPage
                sessionId={selectedSessionId}
                onClose={() => setSelectedSessionId(null)}
                ongoingMatches={Object.values(ongoingMatches).flat() || []}
                setOngoingMatches={(matches) =>
                  setMatchQueue((prev) => ({ ...prev, [selectedSessionId]: matches }))
                }
                matchQueue={matchQueue[selectedSessionId] || []}
                setMatchQueue={(queue) =>
                  setMatchQueue((prev) => ({ ...prev, [selectedSessionId]: queue }))
                }
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
