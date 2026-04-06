'use client';

import React, { useState } from "react";
import { useQuery } from "@apollo/client/react";
import { gql } from "@apollo/client";

const COURT_SURFACE_TYPES = {
  'WOODEN': 'Wooden',
  'SYNTHETIC': 'Synthetic',
  'MAT': 'Mat',
  'CONCRETE': 'Concrete',
}

const COURT_STATUS_LABELS = {
  ACTIVE: 'Available',
  OCCUPIED: 'InUse',
  MAINTENANCE: 'Maintenance',
}

const formatCourtStatus = (value) => COURT_STATUS_LABELS[value] ?? value

const COURTS_QUERY = gql`
  query Courts {
    courts {
      _id
      name
      surfaceType
      indoor
      status
    }
  }
`;

const MatchForm = ({
  sessionId,
  sessionPlayers,
  sessionCourtIds,
  isOpen,
  onClose,
  onSubmit,
  isLoading,
  availableCourts,
  ongoingMatches,
}) => {
  const [matchType, setMatchType] = useState("1v1"); // '1v1' or '2v2'
  const [selectedCourt, setSelectedCourt] = useState("");
  const [team1, setTeam1] = useState([]);
  const [team2, setTeam2] = useState([]);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pendingMatchData, setPendingMatchData] = useState(null);

  const { data: courtsData, loading: courtsLoading } = useQuery(COURTS_QUERY);

  if (!isOpen) return null;

  const allCourts = availableCourts || courtsData?.courts || [];
  // Filter courts to only show ones in the session
  const courts = allCourts.filter((court) =>
    sessionCourtIds?.includes(court._id),
  );
  const playersInSession = sessionPlayers || [];

  // Get unselected players
  const selectedPlayerIds = new Set([...team1, ...team2]);
  const unselectedPlayers = playersInSession.filter(
    (p) => !selectedPlayerIds.has(p.playerId),
  );

  const handleAddToTeam = (playerId, team) => {
    if (team === 1) {
      setTeam1([...team1, playerId]);
    } else {
      setTeam2([...team2, playerId]);
    }
  };

  const handleRemoveFromTeam = (playerId, team) => {
    if (team === 1) {
      setTeam1(team1.filter((id) => id !== playerId));
    } else {
      setTeam2(team2.filter((id) => id !== playerId));
    }
  };

  const requiredPlayersPerTeam = matchType === "1v1" ? 1 : 2;
  const isTeam1Complete = team1.length === requiredPlayersPerTeam;
  const isTeam2Complete = team2.length === requiredPlayersPerTeam;
  const canSubmit = isTeam1Complete && isTeam2Complete && selectedCourt;

  // Check if court/players are available or queued
  const allPlayers = [...team1, ...team2];
  const courtBusy = ongoingMatches?.some((m) => m.courtId === selectedCourt);
  const playersInUse = ongoingMatches?.some((m) =>
    allPlayers.some((p) => m.playerIds?.includes(p)),
  );
  const isQueued = courtBusy || playersInUse;
  const getCourtName = () => {
    return allCourts.find((c) => c._id === selectedCourt)?.name || "Unknown";
  };

  const handleSubmitClick = (e) => {
    e.preventDefault();
    if (!canSubmit) return;

    const matchData = {
      sessionId,
      courtId: selectedCourt,
      playerIds: allPlayers,
      winnerPlayerIds: team1,
    };
    setPendingMatchData(matchData);
    setShowConfirm(true);
  };

  const handleConfirmMatch = () => {
    onSubmit(pendingMatchData);
    setShowConfirm(false);
    setPendingMatchData(null);

    // Reset form
    setMatchType("1v1");
    setSelectedCourt("");
    setTeam1([]);
    setTeam2([]);
  };

  const getPlayerName = (playerId) => {
    return (
      playersInSession.find((p) => p.playerId === playerId)?.name || "Unknown"
    );
  };

  const getPlayerGender = (playerId) => {
    return (
      playersInSession.find((p) => p.playerId === playerId)?.gender || "N/A"
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-white/10 bg-slate-900 p-8 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-slate-400 hover:text-white"
          type="button"
        >
          ✕
        </button>

        <h2 className="mb-6 text-2xl font-semibold text-white">Create Match</h2>

        <form onSubmit={handleSubmitClick} className="space-y-6">
          {/* Match Type Selection */}
          <div>
            <label className="mb-3 block text-sm font-semibold text-white">
              Match Type
            </label>
            <div className="flex gap-3">
              {["1v1", "2v2"].map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => {
                    setMatchType(type);
                    setTeam1([]);
                    setTeam2([]);
                  }}
                  className={`flex-1 rounded-lg px-4 py-2 font-semibold transition ${
                    matchType === type
                      ? "bg-emerald-500/30 border border-emerald-300/50 text-emerald-200"
                      : "border border-white/10 bg-white/5 text-white/60 hover:bg-white/10"
                  }`}
                >
                  {type} Match ({type === "1v1" ? "Singles" : "Doubles"})
                </button>
              ))}
            </div>
          </div>

          {/* Court Selection */}
          <div>
            <label className="mb-3 block text-sm font-semibold text-white">
              Select Court{" "}
              {courtsLoading && (
                <span className="text-xs text-slate-400">(loading...)</span>
              )}
            </label>
            <select
              id="match-court"
              name="courtId"
              value={selectedCourt}
              onChange={(e) => setSelectedCourt(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-blue-900 px-4 py-2 text-white focus:border-white/30 focus:outline-none"
            >
              <option value="">Choose a court...</option>
              {courts.map((court) => (
                <option key={court._id} value={court._id}>
                  {court.name} ({formatCourtStatus(court.status)})
                </option>
              ))}
            </select>
          </div>

          {/* Team Selection */}
          <div className="grid grid-cols-2 gap-4">
            {/* Team 1 */}
            <div className="space-y-3">
              <div className="rounded-lg border border-blue-300/30 bg-blue-500/10 p-3">
                <h3 className="mb-3 font-semibold text-blue-200">
                  Team 1{" "}
                  {isTeam1Complete && (
                    <span className="text-xs text-blue-300">✓</span>
                  )}
                </h3>
                {team1.length > 0 ? (
                  <div className="mb-3 space-y-2">
                    {team1.map((playerId) => (
                      <div
                        key={playerId}
                        className="flex items-center justify-between rounded-lg bg-blue-500/20 px-2 py-1"
                      >
                        <div className="text-sm text-white">
                          <div>{getPlayerName(playerId)}</div>
                          <div className="text-xs text-blue-300">{getPlayerGender(playerId)}</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveFromTeam(playerId, 1)}
                          className="text-xs text-blue-300 hover:text-blue-200"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mb-3 text-xs text-slate-400">
                    No players selected
                  </p>
                )}
                {team1.length < requiredPlayersPerTeam && (
                  <div className="space-y-1 text-xs max-h-32 overflow-y-auto">
                    {unselectedPlayers.map((player) => (
                      <button
                        key={player.playerId}
                        type="button"
                        onClick={() => handleAddToTeam(player.playerId, 1)}
                        className="block w-full text-left rounded px-2 py-1 text-slate-300 hover:bg-blue-500/30"
                      >
                        <div>+ {player.name}</div>
                        <div className="text-xs text-slate-500">{player.gender}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Team 2 */}
            <div className="space-y-3">
              <div className="rounded-lg border border-rose-300/30 bg-rose-500/10 p-3">
                <h3 className="mb-3 font-semibold text-rose-200">
                  Team 2{" "}
                  {isTeam2Complete && (
                    <span className="text-xs text-rose-300">✓</span>
                  )}
                </h3>
                {team2.length > 0 ? (
                  <div className="mb-3 space-y-2">
                    {team2.map((playerId) => (
                      <div
                        key={playerId}
                        className="flex items-center justify-between rounded-lg bg-rose-500/20 px-2 py-1"
                      >
                        <div className="text-sm text-white">
                          <div>{getPlayerName(playerId)}</div>
                          <div className="text-xs text-rose-300">{getPlayerGender(playerId)}</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveFromTeam(playerId, 2)}
                          className="text-xs text-rose-300 hover:text-rose-200"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mb-3 text-xs text-slate-400">
                    No players selected
                  </p>
                )}
                {team2.length < requiredPlayersPerTeam && (
                  <div className="space-y-1 text-xs max-h-32 overflow-y-auto">
                    {unselectedPlayers.map((player) => (
                      <button
                        key={player.playerId}
                        type="button"
                        onClick={() => handleAddToTeam(player.playerId, 2)}
                        className="block w-full text-left rounded px-2 py-1 text-slate-300 hover:bg-rose-500/30"
                      >
                        <div>+ {player.name}</div>
                        <div className="text-xs text-slate-500">{player.gender}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-white/20 px-4 py-2 font-semibold text-white/80 transition hover:bg-white/5 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading || !canSubmit}
              className="flex-1 rounded-lg bg-emerald-500/20 px-4 py-2 font-semibold text-emerald-200 transition hover:bg-emerald-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? "Creating..." : "Create Match"}
            </button>
          </div>
        </form>
      </div>

      {/* Confirmation Modal */}
      {showConfirm && pendingMatchData && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/50">
          <div className="relative w-full max-w-md rounded-lg bg-slate-900 p-6 shadow-2xl border border-white/10">
            <button
              onClick={() => {
                setShowConfirm(false);
                setPendingMatchData(null);
              }}
              className="absolute right-4 top-4 text-slate-400 hover:text-white"
              type="button"
            >
              ✕
            </button>

            <h2 className="mb-4 text-xl font-semibold text-white">Confirm Match</h2>

            <div className="mb-6 space-y-3 rounded-lg bg-white/5 p-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
                  Court
                </p>
                <p className="mt-1 text-sm text-white">{getCourtName()}</p>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
                  Match Type
                </p>
                <p className="mt-1 text-sm text-white">
                  {matchType} - {matchType === "1v1" ? "Singles" : "Doubles"}
                </p>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
                  Team 1
                </p>
                <p className="mt-1 text-sm text-blue-200">
                  {team1.map((pId) => getPlayerName(pId)).join(", ")}
                </p>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
                  Team 2
                </p>
                <p className="mt-1 text-sm text-rose-200">
                  {team2.map((pId) => getPlayerName(pId)).join(", ")}
                </p>
              </div>

              {isQueued && (
                <div className="mt-4 rounded-lg bg-amber-500/20 p-3 border border-amber-500/30">
                  <p className="text-xs font-semibold text-amber-200">
                    ⚠️ Court or players busy
                  </p>
                  <p className="mt-1 text-xs text-amber-100">
                    This match will be added to the queue. It will start when the
                    court and all players become available.
                  </p>
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowConfirm(false);
                  setPendingMatchData(null);
                }}
                className="flex-1 rounded-lg border border-white/20 px-4 py-2 font-semibold text-white/80 transition hover:bg-white/5 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmMatch}
                disabled={isLoading}
                className="flex-1 rounded-lg bg-emerald-500/20 px-4 py-2 font-semibold text-emerald-200 transition hover:bg-emerald-500/30 disabled:opacity-50"
              >
                {isLoading ? "Starting..." : isQueued ? "Queue Match" : "Start Match"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MatchForm;
