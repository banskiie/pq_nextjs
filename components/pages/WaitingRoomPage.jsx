'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { gql } from '@apollo/client'
import { useQuery } from '@apollo/client/react'
import { createPusherClient } from '@/lib/pusherClient'
import { PUSHER_CHANNEL, PUSHER_EVENTS } from '@/lib/pusherEvents'
import BadmintonCourt from '@/components/BadmintonCourt'
import CourtPreview from '@/components/CourtPreview'

const buildVisiblePages = (currentPage, totalPages) => {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1)
  }

  const pages = [1]
  const start = Math.max(2, currentPage - 1)
  const end = Math.min(totalPages - 1, currentPage + 1)

  if (start > 2) pages.push('ellipsis-left')
  for (let page = start; page <= end; page += 1) pages.push(page)
  if (end < totalPages - 1) pages.push('ellipsis-right')
  pages.push(totalPages)

  return pages
}

const ONGOING_MATCHES_QUERY = gql`
  query OngoingMatches {
    ongoingMatches {
      _id
      sessionId
      courtId
      playerIds
      queued
      startedAt
      createdAt
      updatedAt
    }
  }
`

const COURTS_QUERY = gql`
  query Courts {
    courts {
      _id
      name
      surfaceType
      indoor
      description
      status
      createdAt
      updatedAt
    }
  }
`

const PLAYERS_QUERY = gql`
  query Players {
    players {
      _id
      name
      gender
      playerLevel
      playCount
      winCount
      lossCount
      winRate
      createdAt
      updatedAt
    }
  }
`

const bucketMatchesBySession = (matches = []) => {
  const ongoingBySession = {}
  const queuedBySession = {}

  matches.forEach((match) => {
    const matchWithId = { _id: match._id, ...match }

    if (match.queued) {
      if (!queuedBySession[match.sessionId]) {
        queuedBySession[match.sessionId] = []
      }
      queuedBySession[match.sessionId].push(matchWithId)
    } else {
      if (!ongoingBySession[match.sessionId]) {
        ongoingBySession[match.sessionId] = []
      }
      ongoingBySession[match.sessionId].push(matchWithId)
    }
  })

  return { ongoingBySession, queuedBySession }
}

const WaitingRoomPage = () => {
  const WAITING_ROOM_POLL_INTERVAL_MS = 15000
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0)
  const [countdown, setCountdown] = useState(10)
  const [courtAnimationKey, setCourtAnimationKey] = useState(0)
  const [rotationResetToken, setRotationResetToken] = useState(0)
  const [ongoingMatches, setOngoingMatches] = useState({})
  const [matchQueue, setMatchQueue] = useState({})
  const [activePage, setActivePage] = useState(0)
  const [queuePage, setQueuePage] = useState(0)
  const hasMatchesRef = useRef(false)
  const ITEMS_PER_PAGE = 3

  // Fetch initial data - poll interval handles eventual consistency
  const { data: ongoingQueryData, error: matchesError, refetch: refetchMatches } = useQuery(ONGOING_MATCHES_QUERY, {
    pollInterval: WAITING_ROOM_POLL_INTERVAL_MS,
    onCompleted: (queryData) => {
      const { ongoingBySession, queuedBySession } = bucketMatchesBySession(queryData?.ongoingMatches || [])
      setOngoingMatches(ongoingBySession)
      setMatchQueue(queuedBySession)
    },
  })
  const { data: courtsData } = useQuery(COURTS_QUERY, {
    pollInterval: WAITING_ROOM_POLL_INTERVAL_MS,
  })
  const { data: playersData, refetch: refetchPlayers } = useQuery(PLAYERS_QUERY, {
    pollInterval: WAITING_ROOM_POLL_INTERVAL_MS,
  })

  // Sync query data to state (fallback if onCompleted doesn't fire)
  useEffect(() => {
    if (ongoingQueryData?.ongoingMatches) {
      const { ongoingBySession, queuedBySession } = bucketMatchesBySession(ongoingQueryData.ongoingMatches)
      setOngoingMatches(ongoingBySession)
      setMatchQueue(queuedBySession)
    }
  }, [ongoingQueryData?.ongoingMatches])

  // Pusher real-time updates
  useEffect(() => {
    const pusher = createPusherClient()
    if (!pusher) return undefined
    const channel = pusher.subscribe(PUSHER_CHANNEL)
    const handleMatch = () => { refetchMatches() }
    const handlePlayer = () => { refetchPlayers() }
    channel.bind(PUSHER_EVENTS.MATCH, handleMatch)
    channel.bind(PUSHER_EVENTS.PLAYER, handlePlayer)
    return () => {
      channel.unbind(PUSHER_EVENTS.MATCH, handleMatch)
      channel.unbind(PUSHER_EVENTS.PLAYER, handlePlayer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const courts = courtsData?.courts || []
  const players = useMemo(() => playersData?.players || [], [playersData?.players])

  // Fallback: refetch if query failed
  useEffect(() => {
    if (matchesError) {
      console.error('Query error:', matchesError)
      refetchMatches()
    }
  }, [matchesError, refetchMatches])

  // Flatten all ongoing matches from all sessions
  // Note: ongoingMatches already contains only non-queued matches from bucketing
  const allMatches = Object.values(ongoingMatches).flat()
  
  // Track whether we have matches to avoid countdown reset on subscription updates
  const hasMatches = useMemo(() => allMatches.length > 0, [allMatches.length])
  
  useEffect(() => {
    hasMatchesRef.current = hasMatches
  }, [hasMatches])

  // Get queued matches from matchQueue
  const queuedMatches = Object.values(matchQueue || {})
    .flat()

  const totalActivePages = Math.max(1, Math.ceil(allMatches.length / ITEMS_PER_PAGE))
  const clampedActivePage = allMatches.length > 0 ? Math.min(activePage, totalActivePages - 1) : 0
  const totalQueuePages = Math.max(1, Math.ceil(queuedMatches.length / ITEMS_PER_PAGE))
  const clampedQueuePage = queuedMatches.length > 0 ? Math.min(queuePage, totalQueuePages - 1) : 0
  const activeVisiblePages = useMemo(
    () => buildVisiblePages(clampedActivePage + 1, totalActivePages),
    [clampedActivePage, totalActivePages]
  )
  const queueVisiblePages = useMemo(
    () => buildVisiblePages(clampedQueuePage + 1, totalQueuePages),
    [clampedQueuePage, totalQueuePages]
  )

  const clampedMatchIndex = allMatches.length > 0 ? Math.min(currentMatchIndex, allMatches.length - 1) : 0
  // When a match ends, index can briefly point past the shortened array.
  const currentMatch = allMatches[clampedMatchIndex] || allMatches[0] || null

  const switchToMatchIndex = (nextIndex) => {
    if (nextIndex < 0 || nextIndex >= allMatches.length || nextIndex === clampedMatchIndex) {
      return
    }

    setCurrentMatchIndex(nextIndex)
    setCountdown(10)
    setCourtAnimationKey((prev) => prev + 1)
    setRotationResetToken((prev) => prev + 1)
  }

  const handlePreviewClick = (matchId) => {
    const selectedIndex = allMatches.findIndex(match => match._id === matchId)

    switchToMatchIndex(selectedIndex)
  }

  // Auto-rotate through matches every 10 seconds
  useEffect(() => {
    if (allMatches.length === 0) {
      return
    }

    const timer = setInterval(() => {
      setCurrentMatchIndex((prev) => {
        const nextIndex = (prev + 1) % allMatches.length
        setCourtAnimationKey((key) => key + 1)
        return nextIndex
      })
      setCountdown(10)
    }, 10000) // Switch every 10 seconds

    return () => clearInterval(timer)
  }, [allMatches.length, rotationResetToken])

  // Countdown timer displayed - depends on hasMatches and manual rotationResetToken only
  useEffect(() => {
    if (!hasMatches) {
      return
    }

    const countdownTimer = setInterval(() => {
      setCountdown((prev) => (prev > 0 ? prev - 1 : 0))
    }, 1000)

    return () => clearInterval(countdownTimer)
  }, [hasMatches, rotationResetToken])



  return (
    <div className="min-h-screen bg-linear-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100 overflow-x-hidden flex flex-col">
      <style>{`
        @keyframes fadeInScale {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
        @keyframes fadeOutScale {
          from {
            opacity: 1;
            transform: scale(1);
          }
          to {
            opacity: 0;
            transform: scale(0.95);
          }
        }
        .transition-court {
          animation: fadeInScale 0.45s ease-in-out;
        }
      `}</style>
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-32 right-0 h-80 w-80 rounded-full bg-linear-to-br from-amber-300/40 to-rose-400/30 blur-2xl" />
        <div className="absolute -bottom-40 left-0 h-96 w-96 rounded-full bg-linear-to-br from-sky-300/30 to-emerald-400/20 blur-2xl" />
      </div>

      {/* Header */}
      <div className="text-center py-2 shrink-0">
        <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-emerald-300">
          <span className="h-2 w-2 animate-pulse rounded-full bg-red-400"></span>
          LIVE MATCHES
        </div>
        <h1 className="text-xl font-bold text-white mt-0.5 py-2 sm:text-2xl">Badminton Queue</h1>
      </div>

      {/* Main Content - Responsive Layout */}
      <div className="flex flex-col lg:flex-row px-6 pb-3 gap-4">
        {/* Left Side - Badminton Court */}
        <div className="w-full flex-1 flex flex-col gap-6">
          {allMatches.length > 0 ? (
            <>
              {/* Main Display - Current Match */}
              <div key={`${currentMatch?._id || 'none'}-${courtAnimationKey}`} className="flex-1 flex flex-col items-center justify-center bg-transparent min-h-80 sm:min-h-96 transition-court">
                <div className="text-sm text-slate-400 mb-2 text-center font-semibold">
                  Now Playing - {courts?.find(c => c._id === currentMatch?.courtId)?.name || 'Court'}
                </div>
                <div className="w-full">
                  <BadmintonCourt
                    match={currentMatch}
                    players={players}
                    courts={courts}
                    fullscreen={true}
                  />
                </div>
              </div>

              {/* Ongoing Matches Preview */}
              {allMatches.length > 1 && (
                <div className="flex-1 flex flex-col items-center justify-center">
                  <div className="text-xs text-slate-400 mb-3 text-center uppercase tracking-wider">Currently Used</div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full">
                    {Array.from({ length: Math.min(4, allMatches.length - 1) }).map((_, idx) => {
                      const match = allMatches[(currentMatchIndex + idx + 1) % allMatches.length]
                      const playerIds = match.playerIds || []
                      const midpoint = Math.floor(playerIds.length / 2)
                      const team1 = playerIds.slice(0, midpoint).map(pid => (players?.find(p => p._id === pid)?.name || 'Unknown').toUpperCase())
                      const team2 = playerIds.slice(midpoint).map(pid => (players?.find(p => p._id === pid)?.name || 'Unknown').toUpperCase())
                      const courtName = courts?.find(c => c._id === match.courtId)?.name || 'Court'
                      
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handlePreviewClick(match._id)}
                          className="relative rounded-lg border border-white/10 overflow-hidden cursor-pointer transition-colors hover:border-white/20 h-24"
                        >
                          <div className="absolute inset-0 blur-[1.5px] scale-105">
                            <CourtPreview match={match} />
                          </div>
                          <div className="absolute inset-0 bg-linear-to-br from-emerald-600/30 via-slate-900/50 to-slate-950/70"></div>
                          <div className="relative z-10 inset-0 p-2 flex flex-col justify-center h-full bg-black/10">
                            <div className="text-xs font-bold text-green-300 mb-1 text-center truncate">{courtName}</div>
                            <div className="space-y-0.5 text-[10px] sm:text-xs flex flex-col">
                              <div className="text-slate-200 font-bold flex items-center justify-center min-w-0 gap-1">
                                {team1.length > 0 ? (
                                  team1.map((name, playerIdx) => (
                                    <div key={`${match._id}-prev-t1-${playerIdx}`} className="flex items-center min-w-0">
                                      {playerIdx > 0 && <span className="mx-0.5 shrink-0 text-slate-400">/</span>}
                                      <span className="inline-block max-w-16 sm:max-w-20 truncate" title={name}>{name}</span>
                                    </div>
                                  ))
                                ) : (
                                  <span className="text-slate-500">N/A</span>
                                )}
                              </div>
                              <div className="text-center text-slate-300 text-[10px] sm:text-xs font-semibold">vs</div>
                              <div className="text-slate-200 font-bold flex items-center justify-center min-w-0 gap-1">
                                {team2.length > 0 ? (
                                  team2.map((name, playerIdx) => (
                                    <div key={`${match._id}-prev-t2-${playerIdx}`} className="flex items-center min-w-0">
                                      {playerIdx > 0 && <span className="mx-0.5 shrink-0 text-slate-400">/</span>}
                                      <span className="inline-block max-w-16 sm:max-w-20 truncate" title={name}>{name}</span>
                                    </div>
                                  ))
                                ) : (
                                  <span className="text-slate-500">N/A</span>
                                )}
                              </div>
                            </div>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center rounded-lg border border-white/10 bg-slate-900/50 p-8 text-center backdrop-blur">
              <div className="text-4xl mb-2">😴</div>
              <h2 className="text-lg font-semibold text-white mb-1">
                No Matches in Progress
              </h2>
              <p className="text-sm text-slate-400">
                Matches will appear here when players start playing
              </p>
            </div>
          )}
        </div>

        {/* Middle - Stats Cards (Vertical) - Hidden on mobile */}
        <div className="hidden lg:flex lg:w-40 flex-col justify-center gap-3">
          {/* Match Counter */}
          <div className="rounded-lg border border-white/10 bg-white/5 p-3 text-center">
            <div className="text-xs font-semibold uppercase text-slate-400 tracking-[0.2em]">
              Active
            </div>
            <div className="text-2xl font-bold text-emerald-300 mt-1">
              {allMatches.length}
            </div>
          </div>

          {/* Current Match Index */}
          <div className="rounded-lg border border-white/10 bg-white/5 p-3 text-center">
            <div className="text-xs font-semibold uppercase text-slate-400 tracking-[0.2em]">
              Viewing
            </div>
            <div className="text-2xl font-bold text-blue-300 mt-1">
              {allMatches.length > 0 ? `${clampedMatchIndex + 1}/${allMatches.length}` : '0/0'}
            </div>
          </div>

          {/* Auto-rotation Countdown */}
          <div className="rounded-lg border border-white/10 bg-white/5 p-3 text-center">
            <div className="text-xs font-semibold uppercase text-slate-400 tracking-[0.2em]">
              Switch In
            </div>
            <div className="text-2xl font-bold text-rose-300 mt-1">
              {countdown}s
            </div>
          </div>
        </div>

        {/* Right Side - Active & Queued Matches Tables */}
        <div className="flex-1 flex flex-col gap-4 min-h-0 lg:min-h-auto min-w-0">
          {/* Active Matches Table */}
          <div className="flex flex-col flex-1 min-h-0 min-w-0">
            <div className="flex justify-between items-center mb-3 min-w-0">
              <h3 className="text-lg font-semibold text-white truncate">Active / Ongoing ({allMatches.length})</h3>
              {allMatches.length > ITEMS_PER_PAGE && (
                <div className="text-xs text-slate-400">
                  Page {clampedActivePage + 1} of {totalActivePages}
                </div>
              )}
            </div>
            {allMatches.length > 0 ? (
              <div className="flex flex-col flex-1 min-h-0">
                <div className="bg-slate-900/50 rounded-lg border border-white/10 flex-1 overflow-hidden">
                  <table className="w-full text-sm border-collapse" style={{ tableLayout: 'fixed' }}>
                    <colgroup>
                      <col style={{ width: '2.5rem' }} />
                      <col style={{ width: '6.5rem' }} />
                      <col />
                      <col />
                      <col style={{ width: '4.5rem' }} />
                    </colgroup>
                    <thead className="sticky top-0 bg-slate-800/90 backdrop-blur">
                      <tr className="border-b border-white/10">
                        <th className="text-left px-3 py-3 font-semibold text-slate-300 w-8">#</th>
                        <th className="text-left px-3 py-3 font-semibold text-slate-300 w-24">Court</th>
                        <th className="text-left px-3 py-3 font-semibold text-slate-300">Team 1</th>
                        <th className="text-left px-3 py-3 font-semibold text-slate-300">Team 2</th>
                        <th className="text-left px-3 py-3 font-semibold text-slate-300 w-18 whitespace-nowrap">Type</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allMatches.slice(clampedActivePage * ITEMS_PER_PAGE, (clampedActivePage + 1) * ITEMS_PER_PAGE).map((match, idx) => {
                        const court = courts.find(c => c._id === match.courtId)
                        const playerIds = match.playerIds || []
                        const midpoint = Math.floor(playerIds.length / 2)
                        const team1Players = playerIds.slice(0, midpoint).map(pid => players.find(p => p._id === pid)?.name?.toUpperCase()).filter(Boolean)
                        const team2Players = playerIds.slice(midpoint).map(pid => players.find(p => p._id === pid)?.name?.toUpperCase()).filter(Boolean)
                        
                        return (
                          <tr key={match._id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                            <td className="px-3 py-3 text-slate-300 w-8">{clampedActivePage * ITEMS_PER_PAGE + idx + 1}</td>
                            <td className="px-3 py-3 w-24 truncate">
                              <button
                                type="button"
                                onClick={() => handlePreviewClick(match._id)}
                                className="text-slate-100 hover:text-emerald-300 hover:underline transition-colors cursor-pointer w-full text-left truncate"
                                title={court?.name || 'Click to view'}
                              >
                                {court?.name || 'N/A'}
                              </button>
                            </td>
                            <td className="px-3 py-3 text-blue-300 overflow-hidden">
                              {team1Players.length > 0 ? (
                                <div className="flex items-center min-w-0 gap-1">
                                  {team1Players.map((name, playerIdx) => (
                                    <div key={`${match._id}-t1-${playerIdx}`} className="flex items-center min-w-0">
                                      {playerIdx > 0 && <span className="mx-1 shrink-0 text-slate-400">/</span>}
                                      <span className="inline-block max-w-23.75 sm:max-w-30 truncate" title={name}>{name}</span>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-slate-500">N/A</span>
                              )}
                            </td>
                            <td className="px-3 py-3 text-rose-300 overflow-hidden">
                              {team2Players.length > 0 ? (
                                <div className="flex items-center min-w-0 gap-1">
                                  {team2Players.map((name, playerIdx) => (
                                    <div key={`${match._id}-t2-${playerIdx}`} className="flex items-center min-w-0">
                                      {playerIdx > 0 && <span className="mx-1 shrink-0 text-slate-400">/</span>}
                                      <span className="inline-block max-w-23.75 sm:max-w-30 truncate" title={name}>{name}</span>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-slate-500">N/A</span>
                              )}
                            </td>
                            <td className="px-3 py-3 text-slate-300 w-18 whitespace-nowrap">{team1Players.length}v{team2Players.length}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
                {allMatches.length > ITEMS_PER_PAGE && (
                  <div className="flex justify-between items-center mt-3 px-2">
                    <button
                      onClick={() => setActivePage(p => Math.max(0, p - 1))}
                      disabled={clampedActivePage === 0}
                      className="rounded-full border border-slate-300/40 px-3 py-1 text-xs font-semibold text-slate-200 transition hover:bg-slate-500/10 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Previous
                    </button>
                    <div className="hidden items-center gap-1 sm:flex">
                      {activeVisiblePages.map((item, index) => {
                        if (typeof item !== 'number') {
                          return (
                            <span key={`${item}-${index}`} className="px-1 text-xs text-slate-400">
                              ...
                            </span>
                          )
                        }

                        const isActive = item === clampedActivePage + 1
                        return (
                          <button
                            key={`waiting-active-page-${item}`}
                            onClick={() => setActivePage(item - 1)}
                            className={`rounded-full border px-2.5 py-1 text-xs font-semibold transition ${
                              isActive
                                ? 'border-sky-400/70 bg-sky-500/20 text-sky-100'
                                : 'border-slate-300/40 text-slate-200 hover:bg-slate-500/10'
                            }`}
                          >
                            {item}
                          </button>
                        )
                      })}
                    </div>
                    <button
                      onClick={() => setActivePage(p => Math.min(totalActivePages - 1, p + 1))}
                      disabled={clampedActivePage >= totalActivePages - 1}
                      className="rounded-full border border-slate-300/40 px-3 py-1 text-xs font-semibold text-slate-200 transition hover:bg-slate-500/10 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Next
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-lg border border-white/10 bg-slate-900/50 p-8 text-center text-sm text-slate-400">
                No active matches
              </div>
            )}
          </div>

          {/* Queued Matches Table */}
          <div className="flex flex-col flex-1 min-h-0 min-w-0">
            <div className="flex justify-between items-center mb-3 min-w-0">
              <h3 className="text-lg font-semibold text-white truncate">Queue / Waiting ({queuedMatches.length})</h3>
              {queuedMatches.length > ITEMS_PER_PAGE && (
                <div className="text-xs text-slate-400">
                  Page {clampedQueuePage + 1} of {totalQueuePages}
                </div>
              )}
            </div>
            {queuedMatches.length > 0 ? (
              <div className="flex flex-col flex-1 min-h-0">
                <div className="bg-slate-900/50 rounded-lg border border-white/10 flex-1 overflow-hidden">
                  <table className="w-full text-sm border-collapse" style={{ tableLayout: 'fixed' }}>
                    <colgroup>
                      <col style={{ width: '2.5rem' }} />
                      <col style={{ width: '6.5rem' }} />
                      <col />
                      <col />
                      <col style={{ width: '4.5rem' }} />
                    </colgroup>
                    <thead className="sticky top-0 bg-slate-800/90 backdrop-blur">
                      <tr className="border-b border-white/10">
                        <th className="text-left px-3 py-3 font-semibold text-slate-300 w-8">#</th>
                        <th className="text-left px-3 py-3 font-semibold text-slate-300 w-24 truncate">Court</th>
                        <th className="text-left px-3 py-3 font-semibold text-slate-300">Team 1</th>
                        <th className="text-left px-3 py-3 font-semibold text-slate-300">Team 2</th>
                        <th className="text-left px-3 py-3 font-semibold text-slate-300 w-18 whitespace-nowrap">Type</th>
                      </tr>
                    </thead>
                    <tbody>
                      {queuedMatches.slice(clampedQueuePage * ITEMS_PER_PAGE, (clampedQueuePage + 1) * ITEMS_PER_PAGE).map((match, idx) => {
                        const court = courts.find(c => c._id === match.courtId)
                        const playerIds = match.playerIds || []
                        const midpoint = Math.floor(playerIds.length / 2)
                        const team1Players = playerIds.slice(0, midpoint).map(pid => players.find(p => p._id === pid)?.name?.toUpperCase()).filter(Boolean)
                        const team2Players = playerIds.slice(midpoint).map(pid => players.find(p => p._id === pid)?.name?.toUpperCase()).filter(Boolean)
                        
                        return (
                          <tr key={match._id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                            <td className="px-3 py-3 text-slate-300 w-8">{clampedQueuePage * ITEMS_PER_PAGE + idx + 1}</td>
                            <td className="px-3 py-3 text-slate-100 w-24 truncate">{court?.name || 'N/A'}</td>
                            <td className="px-3 py-3 text-blue-300 overflow-hidden">
                              {team1Players.length > 0 ? (
                                <div className="flex items-center min-w-0 gap-1">
                                  {team1Players.map((name, playerIdx) => (
                                    <div key={`${match._id}-qt1-${playerIdx}`} className="flex items-center min-w-0">
                                      {playerIdx > 0 && <span className="mx-1 shrink-0 text-slate-400">/</span>}
                                      <span className="inline-block max-w-23.75 sm:max-w-30 truncate" title={name}>{name}</span>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-slate-500">N/A</span>
                              )}
                            </td>
                            <td className="px-3 py-3 text-rose-300 overflow-hidden">
                              {team2Players.length > 0 ? (
                                <div className="flex items-center min-w-0 gap-1">
                                  {team2Players.map((name, playerIdx) => (
                                    <div key={`${match._id}-qt2-${playerIdx}`} className="flex items-center min-w-0">
                                      {playerIdx > 0 && <span className="mx-1 shrink-0 text-slate-400">/</span>}
                                      <span className="inline-block max-w-23.75 sm:max-w-30 truncate" title={name}>{name}</span>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-slate-500">N/A</span>
                              )}
                            </td>
                            <td className="px-3 py-3 text-slate-300 w-18 whitespace-nowrap">{team1Players.length}v{team2Players.length}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
                {queuedMatches.length > ITEMS_PER_PAGE && (
                  <div className="flex justify-between items-center mt-3 px-2">
                    <button
                      onClick={() => setQueuePage(p => Math.max(0, p - 1))}
                      disabled={clampedQueuePage === 0}
                      className="rounded-full border border-slate-300/40 px-3 py-1 text-xs font-semibold text-slate-200 transition hover:bg-slate-500/10 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Previous
                    </button>
                    <div className="hidden items-center gap-1 sm:flex">
                      {queueVisiblePages.map((item, index) => {
                        if (typeof item !== 'number') {
                          return (
                            <span key={`${item}-${index}`} className="px-1 text-xs text-slate-400">
                              ...
                            </span>
                          )
                        }

                        const isActive = item === clampedQueuePage + 1
                        return (
                          <button
                            key={`waiting-queue-page-${item}`}
                            onClick={() => setQueuePage(item - 1)}
                            className={`rounded-full border px-2.5 py-1 text-xs font-semibold transition ${
                              isActive
                                ? 'border-sky-400/70 bg-sky-500/20 text-sky-100'
                                : 'border-slate-300/40 text-slate-200 hover:bg-slate-500/10'
                            }`}
                          >
                            {item}
                          </button>
                        )
                      })}
                    </div>
                    <button
                      onClick={() => setQueuePage(p => Math.min(totalQueuePages - 1, p + 1))}
                      disabled={clampedQueuePage >= totalQueuePages - 1}
                      className="rounded-full border border-slate-300/40 px-3 py-1 text-xs font-semibold text-slate-200 transition hover:bg-slate-500/10 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Next
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-lg border border-white/10 bg-slate-900/50 p-8 text-center text-sm text-slate-400">
                No queued matches
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default WaitingRoomPage
