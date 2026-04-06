'use client';

import React, { useMemo, useState } from 'react'
import { gql } from '@apollo/client'
import { useQuery, useSubscription } from '@apollo/client/react'
import useDebouncedValue from '@/hooks/useDebouncedValue'

const GAMES_BY_SESSION_QUERY = gql`
  query GamesBySession($sessionId: ID!) {
    gamesBySession(sessionId: $sessionId) {
      _id
      sessionId
      courtId
      players
      winnerPlayerIds
      finishedAt
      createdAt
      updatedAt
    }
  }
`

const GAMES_BY_SESSION_IDS_QUERY = gql`
  query GamesBySessionIds($sessionIds: [ID!]!) {
    gamesBySessionIds(sessionIds: $sessionIds) {
      _id
      sessionId
      courtId
      players
      winnerPlayerIds
      finishedAt
      createdAt
      updatedAt
    }
  }
`

const GAMES_SUBSCRIPTION = gql`
  subscription GameSub {
    gameSub {
      type
      game {
        _id
        sessionId
        courtId
        players
        winnerPlayerIds
        finishedAt
        createdAt
        updatedAt
      }
    }
  }
`

const formatDateTime = (value) => {
  if (!value) return 'In progress'

  const date = typeof value === 'string' && value.includes('-')
    ? new Date(value)
    : new Date(Number(value))

  if (Number.isNaN(date.getTime())) return 'In progress'

  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

const getMatchTimestamp = (game) => {
  const value = game?.finishedAt || game?.updatedAt || game?.createdAt
  if (!value) return 0

  const asNumber = Number(value)
  if (!Number.isNaN(asNumber) && asNumber > 0) return asNumber

  const asDate = new Date(value)
  return Number.isNaN(asDate.getTime()) ? 0 : asDate.getTime()
}

const SessionMatchRecordModal = ({ sessionId, sessionIds = [], sessions = [], sessionName, players, courts, onClose }) => {
  const isAllSessionsMode = !sessionId
  const [searchTerm, setSearchTerm] = useState('')
  const debouncedSearchTerm = useDebouncedValue(searchTerm, 200)
  const [playCountFilter, setPlayCountFilter] = useState('')

  const { data: singleData, loading: singleLoading, error: singleError } = useQuery(GAMES_BY_SESSION_QUERY, {
    variables: { sessionId },
    skip: !sessionId,
    fetchPolicy: 'cache-and-network',
  })

  const { data: allData, loading: allLoading, error: allError } = useQuery(GAMES_BY_SESSION_IDS_QUERY, {
    variables: { sessionIds },
    skip: !isAllSessionsMode || sessionIds.length === 0,
    fetchPolicy: 'cache-and-network',
  })

  const { data: subData } = useSubscription(GAMES_SUBSCRIPTION, {
    skip: !sessionId && sessionIds.length === 0,
  })

  const loading = isAllSessionsMode ? allLoading : singleLoading
  const error = isAllSessionsMode ? allError : singleError

  const sessionGames = useMemo(() => {
    const baseGames = isAllSessionsMode
      ? (allData?.gamesBySessionIds || [])
      : (singleData?.gamesBySession || [])
    const subGame = subData?.gameSub?.game

    const sessionIdSet = new Set((sessionIds || []).map(String))

    if (!subGame) {
      return [...baseGames].sort((left, right) => getMatchTimestamp(right) - getMatchTimestamp(left))
    }

    const shouldIncludeSubGame = isAllSessionsMode
      ? sessionIdSet.has(String(subGame.sessionId))
      : String(subGame.sessionId) === String(sessionId)

    if (!shouldIncludeSubGame) {
      return [...baseGames].sort((left, right) => getMatchTimestamp(right) - getMatchTimestamp(left))
    }

    const exists = baseGames.some((game) => String(game._id) === String(subGame._id))
    const mergedGames = exists ? baseGames : [subGame, ...baseGames]

    return [...mergedGames].sort((left, right) => getMatchTimestamp(right) - getMatchTimestamp(left))
  }, [allData?.gamesBySessionIds, isAllSessionsMode, sessionId, sessionIds, singleData?.gamesBySession, subData?.gameSub?.game])

  const playerNameById = useMemo(
    () => new Map((players || []).map((player) => [String(player._id), (player.name || 'Unknown').toUpperCase()])),
    [players]
  )

  const courtNameById = useMemo(
    () => new Map((courts || []).map((court) => [String(court._id), court.name || 'Unknown Court'])),
    [courts]
  )

  const sessionNameById = useMemo(
    () => new Map((sessions || []).map((session) => [String(session._id), session.name || 'Unknown Session'])),
    [sessions]
  )

  const matchRecords = useMemo(() => {
    return sessionGames.map((game, index) => {
      const playerIds = Array.isArray(game?.players) ? game.players.map(String) : []
      const winnerIds = Array.isArray(game?.winnerPlayerIds) ? game.winnerPlayerIds.map(String) : []

      let teamA
      let teamB

      if (winnerIds.length > 0 && winnerIds.length < playerIds.length) {
        const winnerSet = new Set(winnerIds)
        teamA = playerIds.filter((playerId) => winnerSet.has(playerId))
        teamB = playerIds.filter((playerId) => !winnerSet.has(playerId))
      } else {
        const midpoint = Math.floor(playerIds.length / 2)
        teamA = playerIds.slice(0, midpoint)
        teamB = playerIds.slice(midpoint)
      }

      return {
        id: String(game._id || `match-${index}`),
        label: `Match ${sessionGames.length - index}`,
        sessionLabel: sessionNameById.get(String(game.sessionId)) || 'Unknown Session',
        winners: teamA.map((playerId) => playerNameById.get(playerId) || 'Unknown'),
        opponents: teamB.map((playerId) => playerNameById.get(playerId) || 'Unknown'),
        courtName: courtNameById.get(String(game.courtId)) || 'Unknown Court',
        completedAt: formatDateTime(game.finishedAt || game.updatedAt || game.createdAt),
        hasWinnerData: winnerIds.length > 0,
      }
    })
  }, [courtNameById, playerNameById, sessionGames, sessionNameById])

  const playerMatchCountMap = useMemo(() => {
    const map = new Map()
    sessionGames.forEach((game) => {
      const playerIds = Array.isArray(game?.players) ? game.players.map(String) : []
      playerIds.forEach((playerId) => {
        map.set(playerId, (map.get(playerId) || 0) + 1)
      })
    })
    return map
  }, [sessionGames])

  const playersMatchingPlayCount = useMemo(() => {
    const target = Number(playCountFilter)
    if (playCountFilter.trim() === '' || Number.isNaN(target) || target < 0) return []

    const ids = [...playerMatchCountMap.entries()]
      .filter(([, count]) => count === target)
      .map(([playerId]) => playerId)

    return ids
      .map((id) => playerNameById.get(id) || 'Unknown')
      .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
  }, [playCountFilter, playerMatchCountMap, playerNameById])

  const filteredMatchRecords = useMemo(() => {
    const term = debouncedSearchTerm.trim().toLowerCase()
    const targetPlayCount = Number(playCountFilter)
    const hasPlayCountFilter = playCountFilter.trim() !== '' && !Number.isNaN(targetPlayCount) && targetPlayCount >= 0

    return matchRecords.filter((record) => {
      const matchesPlayer = !term || (() => {
        const allPlayers = [...record.winners, ...record.opponents]
        return allPlayers.some((name) => (name || '').toLowerCase().includes(term))
      })()

      const matchesPlayCount = !hasPlayCountFilter || (() => {
        const game = sessionGames.find((item, index) => String(item._id || `match-${index}`) === record.id)
        const gamePlayers = Array.isArray(game?.players) ? game.players.map(String) : []
        return gamePlayers.some((playerId) => (playerMatchCountMap.get(playerId) || 0) === targetPlayCount)
      })()

      return matchesPlayer && matchesPlayCount
    })
  }, [matchRecords, debouncedSearchTerm, playCountFilter, sessionGames, playerMatchCountMap])

  if (!sessionId && sessionIds.length === 0) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="relative w-full max-w-2xl rounded-2xl border border-white/10 bg-slate-900 p-5 shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 text-slate-400 transition hover:text-white"
          aria-label="Close match history"
        >
          ✕
        </button>

        <div className="mb-4 border-b border-white/10 pb-4 pr-8">
          <h2 className="text-lg font-semibold text-white">Match History</h2>
          <p className="mt-1 text-sm text-slate-300">{isAllSessionsMode ? 'All Sessions' : (sessionName || 'Selected Session')}</p>
          <p className="mt-2 text-xs text-slate-400">
            {loading ? 'Loading matches...' : `${filteredMatchRecords.length} recorded match${filteredMatchRecords.length !== 1 ? 'es' : ''}`}
          </p>
        </div>

        <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <input
            id="match-record-player-search"
            name="matchRecordPlayerSearch"
            type="text"
            placeholder="Search player name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-white/30 focus:outline-none"
          />
          <input
            id="match-record-number-filter"
            name="matchRecordPlayCountFilter"
            type="number"
            min="0"
            placeholder="Play count (e.g. 5)"
            value={playCountFilter}
            onChange={(e) => setPlayCountFilter(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-white/30 focus:outline-none"
          />
        </div>

        {playCountFilter.trim() !== '' && (
          <div className="mb-3 rounded-lg border border-white/10 bg-white/5 p-2 text-xs text-slate-300">
            {playersMatchingPlayCount.length > 0
              ? `Players with play count ${playCountFilter}: ${playersMatchingPlayCount.join(', ')}`
              : `No player found with play count ${playCountFilter}.`}
          </div>
        )}

        <div className="max-h-[60vh] overflow-y-auto pr-1">
          {error && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
              Error loading match history: {error.message}
            </div>
          )}

          {!error && !loading && filteredMatchRecords.length === 0 && (
            <div className="rounded-lg border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
              {(debouncedSearchTerm.trim() || playCountFilter.trim())
                ? 'No matches found for the current filters.'
                : 'No matches recorded yet for this session.'}
            </div>
          )}

          {!error && filteredMatchRecords.length > 0 && (
            <div className="space-y-3">
              {filteredMatchRecords.map((record) => (
                <div key={record.id} className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-white">{record.label}</div>
                      <div className="mt-1 text-xs text-slate-400">
                        {isAllSessionsMode ? `${record.sessionLabel} • ${record.courtName}` : record.courtName}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-slate-400">{record.completedAt}</div>
                      {!record.hasWinnerData && (
                        <span className="mt-1 inline-flex items-center rounded-full border border-slate-400/30 bg-slate-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-300">
                          Casual
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="mt-3 space-y-2">
                    <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-2">
                      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-300">
                        {record.hasWinnerData ? 'Winners' : 'Team A'}
                      </div>
                      <div className="mt-1 text-sm text-emerald-100">{record.winners.join(' / ') || 'Unknown'}</div>
                    </div>

                    <div className="rounded-lg border border-slate-500/20 bg-slate-500/10 p-2">
                      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-300">
                        {record.hasWinnerData ? 'Opponents' : 'Team B'}
                      </div>
                      <div className="mt-1 text-sm text-slate-100">{record.opponents.join(' / ') || 'Unknown'}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default SessionMatchRecordModal