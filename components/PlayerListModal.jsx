'use client';

import React, { useMemo, useState } from 'react'
import useDebouncedValue from '@/hooks/useDebouncedValue'

const PlayerListModal = ({
  isOpen,
  onClose,
  players,
  sessions,
  activeSessionId,
  ongoingMatches,
  matchQueue,
  onFinishPlayer,
}) => {
  const [searchQuery, setSearchQuery] = useState('')
  const debouncedSearchQuery = useDebouncedValue(searchQuery, 200)
  const [selectedPlayerForFinish, setSelectedPlayerForFinish] = useState(null)
  const [showNoPaymentConfirm, setShowNoPaymentConfirm] = useState(false)
  const [showPaymentConfirm, setShowPaymentConfirm] = useState(false)
  const [showReceipt, setShowReceipt] = useState(false)
  const [receiptPlayer, setReceiptPlayer] = useState(null)
  const [finishedPlayers, setFinishedPlayers] = useState(new Set())
  const [expandedPlayerId, setExpandedPlayerId] = useState(null)

  const normalizeId = (value) => {
    if (value === null || value === undefined) return ''
    return String(value)
  }

  const sessionScope = useMemo(() => {
    if (activeSessionId) {
      return sessions.filter((session) => normalizeId(session._id) === normalizeId(activeSessionId))
    }
    return sessions.filter((session) => session.status !== 'CLOSED' && !session.isArchived)
  }, [sessions, activeSessionId])

  const scopedPlayers = useMemo(() => {

    const allowedPlayerIds = new Set(
      sessionScope.flatMap((session) =>
        (session.players || []).map((item) => normalizeId(item.playerId))
      )
    )

    return players.filter((player) => allowedPlayerIds.has(normalizeId(player._id)))
  }, [players, sessionScope])

  const scopedSessionIds = useMemo(() => {
    return new Set(sessionScope.map((session) => normalizeId(session._id)))
  }, [sessionScope])

  const playerStats = useMemo(() => {
    const stats = {}

    scopedPlayers.forEach((player) => {
      const playerId = normalizeId(player._id)
      stats[playerId] = {
        name: player.name,
        matchCount: 0,
        liveCount: 0,
      }
    })

    // Primary source: persisted per-session games played
    sessionScope.forEach((session) => {
      ;(session.players || []).forEach((item) => {
        const playerId = normalizeId(item.playerId)
        if (!stats[playerId]) return
        stats[playerId].matchCount += Number(item.gamesPlayed || 0)
      })
    })

    const countMatchesByPlayer = (matchesBySession = {}) => {
      Object.entries(matchesBySession).forEach(([sessionId, sessionMatches]) => {
        if (!scopedSessionIds.has(normalizeId(sessionId))) return
        if (!Array.isArray(sessionMatches)) return
        sessionMatches.forEach((match) => {
          if (!Array.isArray(match?.playerIds)) return
          match.playerIds.forEach((playerIdRaw) => {
            const playerId = normalizeId(playerIdRaw)
            if (stats[playerId]) {
              stats[playerId].liveCount += 1
            }
          })
        })
      })
    }

    countMatchesByPlayer(ongoingMatches)
    countMatchesByPlayer(matchQueue)

    // Show total of completed games + active matches (real-time)
    Object.values(stats).forEach((item) => {
      item.matchCount += item.liveCount
      delete item.liveCount
    })

    return Object.entries(stats)
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => {
        if (b.matchCount !== a.matchCount) {
          return b.matchCount - a.matchCount
        }
        return a.name.localeCompare(b.name)
      })
  }, [scopedPlayers, sessionScope, ongoingMatches, matchQueue, scopedSessionIds])

  const buildPaymentSummary = (playerId) => {
    const normalizedPlayerId = normalizeId(playerId)
    const rows = sessionScope.map((session) => {
      const sessionPlayer = (session.players || []).find(
        (item) => normalizeId(item.playerId) === normalizedPlayerId
      )
      const gameCount = Number(sessionPlayer?.gamesPlayed || 0)
      const price = Number(session.price || 0)
      const subtotal = gameCount * price

      return {
        sessionId: normalizeId(session._id),
        sessionName: session.name,
        gameCount,
        price,
        subtotal,
      }
    }).filter((row) => row.gameCount > 0 || activeSessionId)

    const totalGames = rows.reduce((sum, row) => sum + row.gameCount, 0)
    const totalAmount = rows.reduce((sum, row) => sum + row.subtotal, 0)

    return {
      rows,
      totalGames,
      totalAmount,
    }
  }

  const getPlayerTotalPayment = (playerId) => {
    if (finishedPlayers.has(normalizeId(playerId))) {
      return 0
    }
    const summary = buildPaymentSummary(playerId)
    return summary.totalAmount
  }

  const isPlayerInActiveMatch = (playerId) => {
    const normalizedPlayerId = normalizeId(playerId)
    
    // Check ongoing matches
    const inOngoing = Object.values(ongoingMatches || {}).some((matches) => {
      if (!Array.isArray(matches)) return false
      return matches.some((match) =>
        Array.isArray(match?.playerIds) &&
        match.playerIds.some((id) => normalizeId(id) === normalizedPlayerId)
      )
    })
    
    // Check queued matches
    const inQueue = Object.values(matchQueue || {}).some((matches) => {
      if (!Array.isArray(matches)) return false
      return matches.some((match) =>
        Array.isArray(match?.playerIds) &&
        match.playerIds.some((id) => normalizeId(id) === normalizedPlayerId)
      )
    })
    
    return inOngoing || inQueue
  }

  const handleOpenFinishConfirm = (player) => {
    const paymentSummary = buildPaymentSummary(player.id)
    setSelectedPlayerForFinish({
      ...player,
      paymentSummary,
    })
  }



  // Filter players based on search query
  const filteredPlayerStats = useMemo(() => {
    if (!debouncedSearchQuery.trim()) {
      return playerStats
    }
    const query = debouncedSearchQuery.toLowerCase().trim()
    return playerStats.filter(player => 
      player.name.toLowerCase().includes(query)
    )
  }, [playerStats, debouncedSearchQuery])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="relative w-full max-w-3xl max-h-[90vh] overflow-hidden rounded-2xl border border-white/10 bg-slate-900 shadow-2xl">
        {/* Header */}
        <div className="border-b border-white/10 bg-white/5 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">Player List</h2>
              <p className="mt-1 text-xs text-slate-300">
                View all players and their match counts
              </p>
            </div>
            <button
              onClick={onClose}
              className="rounded-lg p-2 text-slate-400 transition hover:bg-white/10 hover:text-white"
              aria-label="Close"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="border-b border-white/10 bg-white/5 px-6 py-3">
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search players by name..."
              className="w-full rounded-lg border border-white/10 bg-slate-800/50 px-4 py-2 pl-10 text-sm text-white placeholder-slate-400 focus:border-white/30 focus:outline-none focus:ring-1 focus:ring-white/20"
            />
            <svg 
              className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>

        {/* Content */}
        <div className="overflow-y-auto p-6" style={{ maxHeight: 'calc(90vh - 200px)' }}>
          {scopedPlayers.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-400">
              No players in this session scope
            </div>
          ) : filteredPlayerStats.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-400">
              No players found matching &quot;{searchQuery}&quot;
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-white/10">
              <table className="min-w-full border-collapse text-left text-sm text-slate-200">
                <thead className="bg-white/5 text-xs uppercase tracking-wider text-slate-400">
                  <tr>
                    <th className="px-4 py-3">#</th>
                    <th className="px-4 py-3">Player Name</th>
                    <th className="hidden sm:table-cell px-4 py-3 text-center">Match Count</th>
                    <th className="hidden sm:table-cell px-4 py-3 text-center">Pending Payment</th>
                    <th className="px-4 py-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {filteredPlayerStats.map((player, index) => (
                    <React.Fragment key={player.id}>
                      <tr className="transition hover:bg-white/5">
                        <td className="px-4 py-3 text-slate-400">{index + 1}</td>
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => setExpandedPlayerId((prev) => (prev === player.id ? null : player.id))}
                            className="flex w-full items-center justify-between gap-2 text-left"
                          >
                            <span className="font-medium text-white">{player.name}</span>
                            <span className="text-slate-400 sm:hidden">{expandedPlayerId === player.id ? '▼' : '▶'}</span>
                          </button>
                        </td>
                        <td className="hidden sm:table-cell px-4 py-3 text-center">
                          <span 
                            className={`inline-flex items-center justify-center rounded-full px-3 py-1 text-xs font-semibold ${
                              player.matchCount > 0
                                ? 'bg-emerald-500/20 text-emerald-200'
                                : 'bg-slate-500/20 text-slate-300'
                            }`}
                          >
                            {player.matchCount}
                          </span>
                        </td>
                        <td className="hidden sm:table-cell px-4 py-3 text-center">
                          <span className="text-sm font-semibold text-emerald-200">
                            {getPlayerTotalPayment(player.id).toFixed(2)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => handleOpenFinishConfirm(player)}
                            disabled={isPlayerInActiveMatch(player.id)}
                            title={isPlayerInActiveMatch(player.id) ? "Player is currently in a match or queue" : ""}
                            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                              isPlayerInActiveMatch(player.id)
                                ? 'bg-emerald-500/10 text-emerald-200/50 cursor-not-allowed opacity-50'
                                : 'bg-emerald-500/20 text-emerald-200 hover:bg-emerald-500/30 hover:text-emerald-100'
                            }`}
                          >
                            Finish
                          </button>
                        </td>
                      </tr>
                      {expandedPlayerId === player.id && (
                        <tr className="bg-slate-800/30 sm:hidden">
                          <td colSpan={5} className="px-4 py-3">
                            <div className="space-y-2 text-xs">
                              <div className="flex justify-between border-b border-white/10 pb-2">
                                <span className="text-slate-400">Match Count:</span>
                                <span className="text-white">{player.matchCount}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-slate-400">Pending Payment:</span>
                                <span className="text-emerald-200">{getPlayerTotalPayment(player.id).toFixed(2)}</span>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-white/10 bg-white/5 px-6 py-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-400">
              {searchQuery.trim() ? (
                <>Showing {filteredPlayerStats.length} of {scopedPlayers.length} players</>
              ) : (
                <>Total Players: {scopedPlayers.length}</>
              )}
            </p>
            <button
              onClick={onClose}
              className="rounded-lg bg-slate-500/20 px-4 py-2 text-xs font-semibold text-slate-200 transition hover:bg-slate-500/30"
            >
              Close
            </button>
          </div>
        </div>
      </div>

      {selectedPlayerForFinish && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-slate-900 shadow-2xl">
            <div className="border-b border-white/10 px-5 py-4">
              <h3 className="text-base font-semibold text-white">Confirm Player Checkout</h3>
              <p className="mt-1 text-xs text-slate-300">Review player details and payment before confirming.</p>
            </div>

            <div className="space-y-4 px-5 py-4">
              <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                <p className="text-xs text-slate-400">Player</p>
                <p className="text-sm font-semibold text-white">{selectedPlayerForFinish.name}</p>
              </div>

              <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                <p className="mb-2 text-xs text-slate-400">Payment Calculation</p>
                <div className="space-y-2">
                  {selectedPlayerForFinish.paymentSummary.rows.map((row) => (
                    <div key={row.sessionId} className="rounded-md border border-white/10 px-3 py-2">
                      <p className="text-xs font-semibold text-white">{row.sessionName}</p>
                      <p className="mt-1 text-xs text-slate-300">
                        {row.gameCount} x {row.price.toFixed(2)} = <span className="font-semibold text-emerald-200">{row.subtotal.toFixed(2)}</span>
                      </p>
                    </div>
                  ))}
                </div>
                <div className="mt-3 border-t border-white/10 pt-2"></div>
              </div>

              <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                <p className="text-xs text-slate-200">Total Games: <span className="font-semibold text-white">{selectedPlayerForFinish.paymentSummary.totalGames}</span></p>
                <p className="mt-2 text-xs text-slate-200">Total Payment: <span className="font-semibold text-emerald-200">{selectedPlayerForFinish.paymentSummary.totalAmount.toFixed(2)}</span></p>
              </div>
            </div>

            <div className="flex gap-2 border-t border-white/10 px-5 py-4">
              <button
                onClick={() => setSelectedPlayerForFinish(null)}
                className="flex-1 rounded-lg border border-white/20 px-3 py-2 text-xs font-semibold text-white/80 transition hover:bg-white/5 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={() => setShowNoPaymentConfirm(true)}
                disabled={isPlayerInActiveMatch(selectedPlayerForFinish.id)}
                title={isPlayerInActiveMatch(selectedPlayerForFinish.id) ? "Player is currently in a match or queue" : ""}
                className={`flex-1 rounded-lg px-3 py-2 text-xs font-semibold transition ${
                  isPlayerInActiveMatch(selectedPlayerForFinish.id)
                    ? 'bg-orange-500/10 text-orange-200/50 cursor-not-allowed opacity-50'
                    : 'bg-orange-500/20 text-orange-200 hover:bg-orange-500/30'
                }`}
              >
                Finish Without Payment
              </button>
              <button
                onClick={() => setShowPaymentConfirm(true)}
                disabled={isPlayerInActiveMatch(selectedPlayerForFinish.id)}
                title={isPlayerInActiveMatch(selectedPlayerForFinish.id) ? "Player is currently in a match or queue" : ""}
                className={`flex-1 rounded-lg px-3 py-2 text-xs font-semibold transition ${
                  isPlayerInActiveMatch(selectedPlayerForFinish.id)
                    ? 'bg-emerald-500/10 text-emerald-200/50 cursor-not-allowed opacity-50'
                    : 'bg-emerald-500/20 text-emerald-200 hover:bg-emerald-500/30'
                }`}
              >
                Finish With <br/>Payment
              </button>
            </div>
          </div>
        </div>
      )}

      {showNoPaymentConfirm && selectedPlayerForFinish && (
        <div className="fixed inset-0 z-70 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-slate-900 shadow-2xl">
            <div className="border-b border-white/10 px-5 py-4">
              <h3 className="text-base font-semibold text-white">Confirm Without Payment</h3>
              <p className="mt-1 text-xs text-slate-300">Are you sure you want to finish this player without payment?</p>
            </div>

            <div className="px-5 py-4">
              <p className="text-sm text-white">Player: <span className="font-semibold text-emerald-200">{selectedPlayerForFinish.name}</span></p>
              <p className="mt-2 text-xs text-slate-300">This action will mark the player as finished without collecting payment.</p>
            </div>

            <div className="flex gap-2 border-t border-white/10 px-5 py-4">
              <button
                onClick={() => {
                  setShowNoPaymentConfirm(false)
                  setSelectedPlayerForFinish(null)
                }}
                className="flex-1 rounded-lg border border-orange-500/20 px-3 py-2 text-xs font-semibold text-orange-200 transition hover:bg-orange-500/10"
              >
                No
              </button>
              <button
                onClick={() => {
                  const playerId = selectedPlayerForFinish.id
                  const sessionsToRemoveFrom = selectedPlayerForFinish.paymentSummary.rows.map(row => row.sessionId)
                  if (onFinishPlayer) {
                    onFinishPlayer(playerId, { isExempted: true, sessionsToRemoveFrom })
                  }
                  setFinishedPlayers(prev => new Set([...prev, normalizeId(playerId)]))
                  setShowNoPaymentConfirm(false)
                  setSelectedPlayerForFinish(null)
                }}
                className="flex-1 rounded-lg bg-orange-500/20 px-3 py-2 text-xs font-semibold text-orange-200 transition hover:bg-orange-500/30"
              >
                Yes
              </button>
            </div>
          </div>
        </div>
      )}

      {showPaymentConfirm && selectedPlayerForFinish && (
        <div className="fixed inset-0 z-70 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-slate-900 shadow-2xl">
            <div className="border-b border-white/10 px-5 py-4">
              <h3 className="text-base font-semibold text-white">Confirm Payment</h3>
              <p className="mt-1 text-xs text-slate-300">Are you sure you want to finish this player with payment?</p>
            </div>

            <div className="px-5 py-4 space-y-3">
              <div>
                <p className="text-sm text-white">Player: <span className="font-semibold text-emerald-200">{selectedPlayerForFinish.name}</span></p>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                <p className="text-xs text-slate-400 mb-2">Payment Summary</p>
                {selectedPlayerForFinish.paymentSummary.rows.map((row) => (
                  <p key={row.sessionId} className="text-xs text-slate-300 mb-1">
                    {row.sessionName}: {row.gameCount} × {row.price.toFixed(2)} = <span className="font-semibold text-emerald-200">{row.subtotal.toFixed(2)}</span>
                  </p>
                ))}
                <div className="border-t border-white/10 mt-2 pt-2">
                  <p className="text-xs text-white">Total: <span className="font-semibold text-emerald-200">{selectedPlayerForFinish.paymentSummary.totalAmount.toFixed(2)}</span></p>
                </div>
              </div>
            </div>

            <div className="flex gap-2 border-t border-white/10 px-5 py-4">
              <button
                onClick={() => setShowPaymentConfirm(false)}
                className="flex-1 rounded-lg border border-white/20 px-3 py-2 text-xs font-semibold text-white/80 transition hover:bg-white/5 hover:text-white"
              >
                No
              </button>
              <button
                onClick={() => {
                  const playerId = selectedPlayerForFinish.id
                  const sessionsToRemoveFrom = selectedPlayerForFinish.paymentSummary.rows.map(row => row.sessionId)
                  const receiptData = { ...selectedPlayerForFinish }
                  if (onFinishPlayer) {
                    onFinishPlayer(playerId, { isExempted: false, sessionsToRemoveFrom })
                  }
                  setFinishedPlayers(prev => new Set([...prev, normalizeId(playerId)]))
                  setShowPaymentConfirm(false)
                  setReceiptPlayer(receiptData)
                  setSelectedPlayerForFinish(null)
                  setShowReceipt(true)
                }}
                className="flex-1 rounded-lg bg-emerald-500/20 px-3 py-2 text-xs font-semibold text-emerald-200 transition hover:bg-emerald-500/30"
              >
                Yes
              </button>
            </div>
          </div>
        </div>
      )}

      {showReceipt && receiptPlayer && (
        <div className="fixed inset-0 z-70 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-900 shadow-2xl">
            <div className="border-b border-white/10 px-5 py-4 text-center">
              <h3 className="text-lg font-semibold text-white">Payment Receipt</h3>
              <p className="mt-1 text-xs text-slate-300">Transaction successful</p>
            </div>

            <div className="px-5 py-6 space-y-4">
              <div className="text-center">
                <p className="text-xs text-slate-400">Player Name</p>
                <p className="text-base font-semibold text-white">{receiptPlayer.name}</p>
              </div>

              <div className="rounded-lg border border-white/10 bg-white/5 p-4">
                <div className="mb-3">
                  <p className="text-xs text-slate-400 mb-2">Session Details</p>
                  {receiptPlayer.paymentSummary.rows.map((row) => (
                    <div key={row.sessionId} className="flex justify-between text-xs text-slate-300 mb-2">
                      <span>{row.sessionName}</span>
                      <span>{row.gameCount} games × {row.price.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
                <div className="border-t border-white/10 pt-3 flex justify-between">
                  <span className="text-sm font-semibold text-white">Total Games:</span>
                  <span className="text-sm font-semibold text-white">{receiptPlayer.paymentSummary.totalGames}</span>
                </div>
                <div className="flex justify-between mt-2">
                  <span className="text-sm font-semibold text-white">Total Amount:</span>
                  <span className="text-lg font-bold text-emerald-300">{receiptPlayer.paymentSummary.totalAmount.toFixed(2)}</span>
                </div>
              </div>

              <p className="text-xs text-slate-400 text-center">Payment has been recorded</p>
            </div>

            <div className="border-t border-white/10 px-5 py-4">
              <button
                onClick={() => {
                  setShowReceipt(false)
                  setReceiptPlayer(null)
                }}
                className="w-full rounded-lg bg-emerald-500/20 px-4 py-2 text-xs font-semibold text-emerald-200 transition hover:bg-emerald-500/30"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default PlayerListModal
