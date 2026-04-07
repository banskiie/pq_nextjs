'use client';

import React, { useEffect, useState, useMemo } from 'react'
import { useQuery } from '@apollo/client/react'
import { gql } from '@apollo/client'
import StatusBadge from './StatusBadge'
import useDebouncedValue from '@/hooks/useDebouncedValue'

const PLAYER_LEVELS = {
  'BEGINNER': 'Beginner',
  'INTERMEDIATE': 'Intermediate',
  'UPPERINTERMEDIATE': 'Upper Intermediate',
  'ADVANCED': 'Advanced',
}

const formatPlayerLevel = (value) => PLAYER_LEVELS[value] ?? value

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

const COURTS_QUERY = gql`
  query Courts {
    courts {
      _id
      name
      surfaceType
      indoor
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
    }
  }
`

const SESSION_QUERY = gql`
  query Session($id: ID!) {
    session(id: $id) {
      _id
      name
      status
      price
      courts
      players {
        playerId
        gamesPlayed
      }
      startedAt
      endedAt
      createdAt
      updatedAt
    }
  }
`

const GAMES_QUERY = gql`
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

const BILLING_BY_SESSION_QUERY = gql`
  query BillingBySession($sessionId: ID!) {
    billingBySession(sessionId: $sessionId) {
      ok
      message
      payment {
        _id
        sessionId
        pricePerGame
        totalRevenue
        closedAt
        createdAt
        updatedAt
        players {
          playerId
          gamesPlayed
          total
          status
          checkedOutAt
        }
      }
    }
  }
`

const formatDateTime = (value) => {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  const timeStr = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
  return `${dateStr} at ${timeStr}`
}

const SessionRecordDetail = ({ sessionId, onClose }) => {
  const [activeTab, setActiveTab] = useState('overview')
  const [playerSearchTerm, setPlayerSearchTerm] = useState('')
  const [matchHistorySearchTerm, setMatchHistorySearchTerm] = useState('')
  const [paymentHistorySearchTerm, setPaymentHistorySearchTerm] = useState('')
  const debouncedPlayerSearchTerm = useDebouncedValue(playerSearchTerm, 300)
  const debouncedMatchHistorySearchTerm = useDebouncedValue(matchHistorySearchTerm, 300)
  const debouncedPaymentHistorySearchTerm = useDebouncedValue(paymentHistorySearchTerm, 300)
  const [playerPage, setPlayerPage] = useState(1)
  const [matchHistoryPage, setMatchHistoryPage] = useState(1)
  const [paymentHistoryPage, setPaymentHistoryPage] = useState(1)
  const [paymentHistorySortColumn, setPaymentHistorySortColumn] = useState('checkoutAt')
  const [paymentHistorySortDirection, setPaymentHistorySortDirection] = useState('desc')
  const [expandedPaymentRowId, setExpandedPaymentRowId] = useState(null)
  const playersPerPage = 5
  const matchesPerPage = 5
  const paymentHistoryItemsPerPage = 10

  const { data: sessionData, loading: sessionLoading, error: sessionError } = useQuery(SESSION_QUERY, {
    variables: { id: sessionId }
  })
  const { data: gamesData, loading: gamesLoading } = useQuery(GAMES_QUERY, {
    variables: { sessionId }
  })
  const { data: billingData } = useQuery(BILLING_BY_SESSION_QUERY, {
    variables: { sessionId },
    skip: !sessionId,
  })
  const { data: courtsData } = useQuery(COURTS_QUERY)
  const { data: playersData } = useQuery(PLAYERS_QUERY)

  const session = sessionData?.session
  const courts = courtsData?.courts || []
  const players = useMemo(() => playersData?.players || [], [playersData?.players])
  const billedPlayers = useMemo(() => billingData?.billingBySession?.payment?.players || [], [billingData?.billingBySession?.payment?.players])
  const hasBillingSnapshot = billedPlayers.length > 0

  const gamesPlayedByPlayer = useMemo(() => {
    const map = new Map()
    const games = gamesData?.gamesBySession || []

    games.forEach((game) => {
      if (!Array.isArray(game?.players)) return
      game.players.forEach((playerId) => {
        const key = String(playerId)
        map.set(key, (map.get(key) || 0) + 1)
      })
    })

    return map
  }, [gamesData])

  const allPlayerIds = useMemo(() => {
    const ids = new Set()

    ;(session?.players || []).forEach((item) => {
      if (item?.playerId) ids.add(String(item.playerId))
    })

    billedPlayers.forEach((item) => {
      if (item?.playerId) ids.add(String(item.playerId))
    })

    gamesPlayedByPlayer.forEach((_count, playerId) => ids.add(playerId))

    return Array.from(ids)
  }, [session?.players, billedPlayers, gamesPlayedByPlayer])

  const billingByPlayer = useMemo(() => {
    const map = new Map()

    billedPlayers.forEach((item) => {
      const rawStatus = String(item.status || 'PENDING').toUpperCase()
      const normalizedStatus = rawStatus === 'PENDING' ? 'UNPAID' : rawStatus
      map.set(String(item.playerId), {
        gamesPlayed: Number(item.gamesPlayed || 0),
        status: normalizedStatus,
      })
    })

    return map
  }, [billedPlayers])

  // Filter and calculate player stats
  const playerStats = useMemo(() => {
    if (!gamesData?.gamesBySession) return []

    return allPlayerIds.map(playerId => {
      const player = players.find(p => String(p._id) === playerId)
      
      let wins = 0
      let losses = 0
      
      gamesData.gamesBySession.forEach(game => {
        const gamePlayerIds = Array.isArray(game?.players) ? game.players.map((id) => String(id)) : []
        if (gamePlayerIds.includes(playerId)) {
          const winnerIds = Array.isArray(game?.winnerPlayerIds) ? game.winnerPlayerIds.map((id) => String(id)) : []
          if (winnerIds.length === 0) {
            return
          }
          if (winnerIds.includes(playerId)) {
            wins++
          } else {
            losses++
          }
        }
      })
      
      const totalGames = gamesPlayedByPlayer.get(playerId) || (wins + losses)
      const winRate = totalGames > 0 ? ((wins / totalGames) * 100).toFixed(1) : '0.0'
      const billingEntry = billingByPlayer.get(playerId)
      const billedGamesRaw = Number(billingEntry?.gamesPlayed || 0)
      const billedStatus = billingEntry?.status || 'PENDING'

      const paidGames = hasBillingSnapshot && billedStatus === 'PAID'
        ? Math.min(Number(totalGames || 0), billedGamesRaw)
        : 0
      const unpaidGames = hasBillingSnapshot && billedStatus === 'UNPAID'
        ? Math.min(Number(totalGames || 0), billedGamesRaw)
        : 0
      
      return {
        playerId,
        player,
        gamesPlayed: totalGames,
        paidGames,
        unpaidGames,
        wins,
        losses,
        winRate,
        name: (player?.name || 'Unknown').toUpperCase()
      }
    })
  }, [allPlayerIds, gamesData?.gamesBySession, players, billingByPlayer, gamesPlayedByPlayer, hasBillingSnapshot])

  const paymentTotals = useMemo(() => {
    const totalPaid = playerStats.reduce((sum, stat) => sum + stat.paidGames, 0)
    const totalUnpaid = playerStats.reduce((sum, stat) => sum + stat.unpaidGames, 0)
    const billingPricePerGameRaw = billingData?.billingBySession?.payment?.pricePerGame
    const billingPricePerGame = Number(billingPricePerGameRaw)
    const sessionPrice = Number(session?.price)

    const hasBillingPrice = billingPricePerGameRaw !== null && billingPricePerGameRaw !== undefined && !Number.isNaN(billingPricePerGame)
    const hasSessionPrice = session?.price !== null && session?.price !== undefined && !Number.isNaN(sessionPrice)

    const effectivePricePerGame = hasBillingPrice && billingPricePerGame > 0
      ? billingPricePerGame
      : hasSessionPrice
      ? sessionPrice
      : (hasBillingPrice ? billingPricePerGame : 0)

    const totalPaidAmount = totalPaid * effectivePricePerGame
    const totalUnpaidAmount = totalUnpaid * effectivePricePerGame
    return { totalPaid, totalUnpaid, totalPaidAmount, totalUnpaidAmount, effectivePricePerGame }
  }, [playerStats, billingData, session?.price])

  const paymentHistoryRows = useMemo(() => {
    const payment = billingData?.billingBySession?.payment
    const pricePerGame = Number(payment?.pricePerGame || 0)
    const paymentDocFallbackTime = payment?.closedAt || payment?.updatedAt || payment?.createdAt || null

    const rows = (payment?.players || []).map((entry) => {
      const playerId = String(entry?.playerId)
      const player = players.find((p) => String(p._id) === playerId)
      const rawStatus = String(entry?.status || 'PENDING').toUpperCase()
      const status = rawStatus === 'PENDING' ? 'UNPAID' : rawStatus
      const gamesPlayed = Number(entry?.gamesPlayed || 0)
      const recordedTotal = Number(entry?.total || 0)
      const expectedDueTotal = gamesPlayed * pricePerGame
      const amountDue = status === 'UNPAID' && recordedTotal === 0 ? expectedDueTotal : recordedTotal

      return {
        playerId,
        playerName: (player?.name || 'Unknown').toUpperCase(),
        gamesPlayed,
        status,
        amountDue,
        checkoutAt: entry?.checkedOutAt || paymentDocFallbackTime,
      }
    })

    const direction = paymentHistorySortDirection === 'asc' ? 1 : -1

    return rows.sort((a, b) => {
      if (paymentHistorySortColumn === 'playerName') {
        return a.playerName.localeCompare(b.playerName, undefined, { sensitivity: 'base' }) * direction
      }

      if (paymentHistorySortColumn === 'gamesPlayed') {
        return (a.gamesPlayed - b.gamesPlayed) * direction
      }

      if (paymentHistorySortColumn === 'amountDue') {
        return (a.amountDue - b.amountDue) * direction
      }

      if (paymentHistorySortColumn === 'status') {
        return a.status.localeCompare(b.status, undefined, { sensitivity: 'base' }) * direction
      }

      const aTime = new Date(a.checkoutAt || 0).getTime()
      const bTime = new Date(b.checkoutAt || 0).getTime()
      if (aTime !== bTime) return (aTime - bTime) * direction
      return a.playerName.localeCompare(b.playerName)
    })
  }, [billingData, players, paymentHistorySortColumn, paymentHistorySortDirection])

  const filteredMatchHistory = useMemo(() => {
    const allMatches = gamesData?.gamesBySession || []
    const term = debouncedMatchHistorySearchTerm.trim().toLowerCase()
    if (!term) return allMatches

    return allMatches.filter((game) => {
      const playerIds = Array.isArray(game?.players) ? game.players : []
      return playerIds.some((playerId) => {
        const playerName = players.find((p) => String(p._id) === String(playerId))?.name || ''
        return playerName.toLowerCase().includes(term)
      })
    })
  }, [gamesData?.gamesBySession, debouncedMatchHistorySearchTerm, players])

  const filteredPaymentHistoryRows = useMemo(() => {
    const term = debouncedPaymentHistorySearchTerm.trim().toLowerCase()
    if (!term) return paymentHistoryRows

    return paymentHistoryRows.filter((row) =>
      (row.playerName || '').toLowerCase().includes(term)
    )
  }, [paymentHistoryRows, debouncedPaymentHistorySearchTerm])

  const totalPaymentHistoryPages = Math.max(1, Math.ceil(filteredPaymentHistoryRows.length / paymentHistoryItemsPerPage))

  const paginatedPaymentHistoryRows = useMemo(() => {
    const startIndex = (paymentHistoryPage - 1) * paymentHistoryItemsPerPage
    const endIndex = startIndex + paymentHistoryItemsPerPage
    return filteredPaymentHistoryRows.slice(startIndex, endIndex)
  }, [filteredPaymentHistoryRows, paymentHistoryPage, paymentHistoryItemsPerPage])

  const paymentHistoryVisiblePages = useMemo(() => {
    if (totalPaymentHistoryPages <= 7) {
      return Array.from({ length: totalPaymentHistoryPages }, (_, index) => index + 1)
    }

    const pages = [1]
    const start = Math.max(2, paymentHistoryPage - 1)
    const end = Math.min(totalPaymentHistoryPages - 1, paymentHistoryPage + 1)

    if (start > 2) pages.push('ellipsis-left')

    for (let page = start; page <= end; page += 1) {
      pages.push(page)
    }

    if (end < totalPaymentHistoryPages - 1) pages.push('ellipsis-right')
    pages.push(totalPaymentHistoryPages)

    return pages
  }, [paymentHistoryPage, totalPaymentHistoryPages])

  const handlePaymentHistorySort = (column) => {
    if (paymentHistorySortColumn === column) {
      setPaymentHistorySortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))
      return
    }

    setPaymentHistorySortColumn(column)
    setPaymentHistorySortDirection(column === 'playerName' || column === 'status' ? 'asc' : 'desc')
  }

  const filteredPlayers = useMemo(() => {
    const term = debouncedPlayerSearchTerm.trim().toLowerCase()
    if (term.length === 0) return playerStats
    
    return playerStats.filter(stat => 
      stat.name.toLowerCase().includes(term)
    )
  }, [playerStats, debouncedPlayerSearchTerm])

  const totalPlayerPages = Math.max(1, Math.ceil(filteredPlayers.length / playersPerPage))

  const paginatedPlayers = useMemo(() => {
    const startIndex = (playerPage - 1) * playersPerPage
    const endIndex = startIndex + playersPerPage
    return filteredPlayers.slice(startIndex, endIndex)
  }, [filteredPlayers, playerPage, playersPerPage])

  useEffect(() => {
    setPlayerPage(1)
  }, [debouncedPlayerSearchTerm, sessionId])

  useEffect(() => {
    setMatchHistoryPage(1)
  }, [debouncedMatchHistorySearchTerm, sessionId])

  useEffect(() => {
    if (playerPage > totalPlayerPages) {
      setPlayerPage(totalPlayerPages)
    }
  }, [playerPage, totalPlayerPages])

  useEffect(() => {
    setPaymentHistoryPage(1)
  }, [debouncedPaymentHistorySearchTerm, paymentHistorySortColumn, paymentHistorySortDirection, sessionId])

  useEffect(() => {
    if (paymentHistoryPage > totalPaymentHistoryPages) {
      setPaymentHistoryPage(totalPaymentHistoryPages)
    }
  }, [paymentHistoryPage, totalPaymentHistoryPages])

  if (sessionLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p>Loading session...</p>
      </div>
    )
  }

  if (sessionError || !session) {
    return (
      <div className="text-center">
        <p className="text-rose-300 mb-4">Error loading session</p>
        <button
          onClick={onClose}
          className="inline-flex items-center justify-center rounded-full border border-white/20 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-white/80 transition hover:border-white/40 hover:text-white"
        >
          Close
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-white sm:text-2xl">Session Record</h1>
      </div>

      <div className="space-y-6 overflow-x-hidden">
        {/* Tab Navigation */}
        <div className="-mx-6 flex flex-wrap gap-2 border-b border-white/10 px-6">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-3 text-sm font-semibold transition ${
              activeTab === 'overview'
                ? 'border-b-2 border-emerald-400 text-emerald-400'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('courts')}
            className={`px-4 py-3 text-sm font-semibold transition ${
              activeTab === 'courts'
                ? 'border-b-2 border-emerald-400 text-emerald-400'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Courts
          </button>
          <button
            onClick={() => setActiveTab('players')}
            className={`px-4 py-3 text-sm font-semibold transition ${
              activeTab === 'players'
                ? 'border-b-2 border-emerald-400 text-emerald-400'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Players
          </button>
          <button
            onClick={() => setActiveTab('matches')}
            className={`px-4 py-3 text-sm font-semibold transition ${
              activeTab === 'matches'
                ? 'border-b-2 border-emerald-400 text-emerald-400'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Match History
          </button>
          <button
            onClick={() => setActiveTab('paymentHistory')}
            className={`px-4 py-3 text-sm font-semibold transition ${
              activeTab === 'paymentHistory'
                ? 'border-b-2 border-emerald-400 text-emerald-400'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Payment History
          </button>
        </div>

        {/* Tab Content */}
        <div>
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="space-y-4">
              <div className="space-y-4 rounded-lg border border-white/10 bg-white/5 p-4">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">Name</label>
                  <p className="mt-1 text-lg font-semibold text-white">{session.name}</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">Status</label>
                    <div className="mt-1">
                      <StatusBadge status={session.status} />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">Started</label>
                    <p className="mt-1 text-sm font-bold text-white">{formatDateTime(session.startedAt)}</p>
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">Ended</label>
                    <p className="mt-1 text-sm font-bold text-white">{formatDateTime(session.endedAt)}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">Price Per Game</label>
                    <p className="mt-1 text-sm font-bold text-white">₱{paymentTotals.effectivePricePerGame}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-2 border-t border-white/10">
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-400">Total Paid</label>
                    <p className="mt-1 text-sm font-bold text-emerald-300">{paymentTotals.totalPaid} Game{paymentTotals.totalPaid !== 1 ? 's' : ''} = ₱{paymentTotals.totalPaidAmount}</p>
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-[0.3em] text-amber-400">Total Unpaid</label>
                    <p className="mt-1 text-sm font-bold text-amber-300">{paymentTotals.totalUnpaid} Game{paymentTotals.totalUnpaid !== 1 ? 's' : ''} = ₱{paymentTotals.totalUnpaidAmount}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Courts Tab */}
          {activeTab === 'courts' && (
            <div>
              {(() => {
                const sessionCourts = courts.filter(court => session.courts?.includes(court._id))
                return sessionCourts.length === 0 ? (
                  <p className="text-sm text-slate-400">No courts assigned to this session</p>
                ) : (
                  <div className="space-y-2">
                    {sessionCourts.sort((a, b) => a.name.localeCompare(b.name)).map(court => (
                      <div key={court._id} className="rounded-lg border border-white/10 bg-white/5 p-3">
                        <div className="font-medium text-white">{court.name}</div>
                        <div className="text-xs text-slate-400">{court.indoor ? 'Indoor' : 'Outdoor'} • {court.surfaceType}</div>
                      </div>
                    ))}
                  </div>
                )
              })()}
            </div>
          )}

          {/* Players Tab */}
          {activeTab === 'players' && (
            <div className="space-y-3">
              <div>
                <input
                  id="session-record-player-search"
                  name="sessionRecordPlayerSearch"
                  type="text"
                  placeholder="Search player name..."
                  value={playerSearchTerm}
                  onChange={(e) => setPlayerSearchTerm(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-white placeholder-slate-500 focus:border-white/30 focus:outline-none"
                />
              </div>
              {filteredPlayers.length === 0 ? (
                <p className="text-sm text-slate-400">No players found</p>
              ) : (
                <div className="space-y-2">
                  {paginatedPlayers.map(stat => (
                    <div key={stat.playerId} className="rounded-lg border border-white/10 bg-white/5 p-1.5">
                      <div className="mb-0.5 text-[10px] text-slate-300">
                        <span className="font-semibold text-white">{stat.name}</span>
                        <span className="mx-1 text-slate-500">•</span>
                        <span>{stat.player?.gender || 'N/A'}</span>
                        <span className="mx-1 text-slate-500">•</span>
                        <span>{formatPlayerLevel(stat.player?.playerLevel) || 'N/A'}</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        <div className="text-center flex-1">
                          <div className="text-[9px] font-semibold uppercase tracking-[0.16em] text-slate-400">Played</div>
                          <div className="text-[11px] font-semibold text-white">{stat.gamesPlayed}</div>
                        </div>
                        <div className="text-center flex-1">
                          <div className="text-[9px] font-semibold uppercase tracking-[0.16em] text-emerald-400">Paid</div>
                          <div className="text-[11px] font-semibold text-emerald-300">{stat.paidGames}</div>
                        </div>
                        <div className="text-center flex-1">
                          <div className="text-[9px] font-semibold uppercase tracking-[0.16em] text-amber-400">Unpaid</div>
                          <div className="text-[11px] font-semibold text-amber-300">{stat.unpaidGames}</div>
                        </div>
                        <div className="text-center flex-1">
                          <div className="text-[9px] font-semibold uppercase tracking-[0.16em] text-emerald-400">Won</div>
                          <div className="text-[11px] font-semibold text-emerald-300">{stat.wins}</div>
                        </div>
                        <div className="text-center flex-1">
                          <div className="text-[9px] font-semibold uppercase tracking-[0.16em] text-rose-400">Lost</div>
                          <div className="text-[11px] font-semibold text-rose-300">{stat.losses}</div>
                        </div>
                        <div className="text-center flex-1">
                          <div className="text-[9px] font-semibold uppercase tracking-[0.16em] text-blue-400">Win Rate</div>
                          <div className="text-[11px] font-semibold text-blue-300">{stat.winRate}%</div>
                        </div>
                      </div>
                    </div>
                  ))}

                  {totalPlayerPages > 1 && (
                    <div className="flex items-center justify-between border-t border-white/10 pt-4">
                      <button
                        onClick={() => setPlayerPage(prev => Math.max(1, prev - 1))}
                        disabled={playerPage === 1}
                        className="inline-flex items-center gap-2 rounded-lg border border-white/20 px-4 py-2 text-xs font-semibold text-white/80 transition hover:bg-white/5 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                        Previous
                      </button>

                      <span className="text-xs text-slate-400">
                        Page {playerPage} of {totalPlayerPages}
                      </span>

                      <button
                        onClick={() => setPlayerPage(prev => Math.min(totalPlayerPages, prev + 1))}
                        disabled={playerPage === totalPlayerPages}
                        className="inline-flex items-center gap-2 rounded-lg border border-white/20 px-4 py-2 text-xs font-semibold text-white/80 transition hover:bg-white/5 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Next
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                    </div>
                  )}
                </div>
              )}

                      <div className="hidden items-center gap-1 sm:flex">
                        {buildVisiblePages(playerPage, totalPlayerPages).map((item, index) => {
                          if (typeof item !== 'number') {
                            return (
                              <span key={`${item}-${index}`} className="px-1 text-xs text-slate-400">
                                ...
                              </span>
                            )
                          }

                          const isActive = item === playerPage
                          return (
                            <button
                              key={`record-player-page-${item}`}
                              onClick={() => setPlayerPage(item)}
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
            </div>
          )}

          {/* Match History Tab */}
          {activeTab === 'matches' && (
            <div className="min-w-0">
              <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <label className="text-sm font-semibold text-white">
                  Match History {gamesLoading && <span className="text-xs text-slate-400">(loading...)</span>}
                </label>
                {filteredMatchHistory.length > 0 && (
                  <span className="text-xs text-slate-400">
                    {filteredMatchHistory.length} total match{filteredMatchHistory.length !== 1 ? 'es' : ''}
                  </span>
                )}
              </div>

              <div className="mb-3">
                <input
                  id="session-record-match-search"
                  name="sessionRecordMatchSearch"
                  type="text"
                  placeholder="Search player name in match history..."
                  value={matchHistorySearchTerm}
                  onChange={(e) => setMatchHistorySearchTerm(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-white placeholder-slate-500 focus:border-white/30 focus:outline-none"
                />
              </div>

              {filteredMatchHistory.length === 0 ? (
                <p className="text-sm text-slate-400">No matches recorded yet</p>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-2">
                    {(() => {
                      const allMatches = filteredMatchHistory
                      const startIndex = (matchHistoryPage - 1) * matchesPerPage
                      const endIndex = startIndex + matchesPerPage
                      const paginatedMatches = allMatches.slice(startIndex, endIndex)

                      return paginatedMatches.map(game => {
                        const winnerIds = Array.isArray(game.winnerPlayerIds) ? game.winnerPlayerIds : []
                        const hasWinnerData = winnerIds.length > 0
                        const winners = winnerIds.map(wId => (players.find(p => String(p._id) === String(wId))?.name || 'Unknown').toUpperCase()).join(' / ')
                        const losers = game.players.filter(pId => !winnerIds.includes(pId)).map(pId => (players.find(p => String(p._id) === String(pId))?.name || 'Unknown').toUpperCase()).join(' / ')
                        const midpoint = Math.floor((game.players || []).length / 2)
                        const teamA = (game.players || []).slice(0, midpoint).map(pId => (players.find(p => String(p._id) === String(pId))?.name || 'Unknown').toUpperCase()).join(' / ')
                        const teamB = (game.players || []).slice(midpoint).map(pId => (players.find(p => String(p._id) === String(pId))?.name || 'Unknown').toUpperCase()).join(' / ')
                        const court = courts.find(c => String(c._id) === String(game.courtId))

                        return (
                          <div key={game._id} className="min-w-0 rounded-lg border border-white/10 bg-white/5 p-3">
                            <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                              <div className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">{court?.name || 'Court'}</div>
                              <div className="flex items-center gap-2">
                                {!hasWinnerData && (
                                  <span className="inline-flex items-center rounded-full border border-slate-400/30 bg-slate-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-300">
                                    Casual
                                  </span>
                                )}
                                <span className="text-xs text-slate-500">{formatDateTime(game.finishedAt)}</span>
                              </div>
                            </div>
                            <div className="grid gap-2 text-sm text-white sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-center">
                              <div className="min-w-0 rounded-md border border-white/10 bg-slate-950/30 px-3 py-2">
                                <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">Team</div>
                                <div className="wrap-break-word text-slate-300">{hasWinnerData ? losers : teamA}</div>
                              </div>
                              <div className="justify-self-center text-center text-[10px] font-semibold uppercase tracking-[0.3em] text-slate-500">vs</div>
                              <div className="min-w-0 rounded-md border border-emerald-400/20 bg-emerald-500/10 px-3 py-2">
                                <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-300">{hasWinnerData ? 'Winner' : 'Team'}</div>
                                <div className="wrap-break-word font-semibold text-emerald-200">{hasWinnerData ? winners : teamB}</div>
                              </div>
                            </div>
                          </div>
                        )
                      })
                    })()}
                  </div>
                  
                  {(() => {
                    const allMatches = filteredMatchHistory
                    const totalPages = Math.ceil(allMatches.length / matchesPerPage)
                    const visiblePages = buildVisiblePages(matchHistoryPage, totalPages)
                    
                    if (totalPages <= 1) return null
                    
                    return (
                      <div className="flex flex-col gap-3 border-t border-white/10 pt-4 sm:flex-row sm:items-center sm:justify-between">
                        <button
                          onClick={() => setMatchHistoryPage(prev => Math.max(1, prev - 1))}
                          disabled={matchHistoryPage === 1}
                          className="rounded-full border border-slate-300/40 px-3 py-1 text-xs font-semibold text-slate-200 transition hover:bg-slate-500/10 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Previous
                        </button>

                        <div className="hidden items-center gap-1 sm:flex">
                          {visiblePages.map((item, index) => {
                            if (typeof item !== 'number') {
                              return (
                                <span key={`${item}-${index}`} className="px-1 text-xs text-slate-400">
                                  ...
                                </span>
                              )
                            }

                            const isActive = item === matchHistoryPage
                            return (
                              <button
                                key={`record-match-page-${item}`}
                                onClick={() => setMatchHistoryPage(item)}
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
                        
                        <span className="text-xs text-slate-400">
                          Page {matchHistoryPage} of {totalPages}
                        </span>
                        
                        <button
                          onClick={() => setMatchHistoryPage(prev => Math.min(totalPages, prev + 1))}
                          disabled={matchHistoryPage === totalPages}
                          className="rounded-full border border-slate-300/40 px-3 py-1 text-xs font-semibold text-slate-200 transition hover:bg-slate-500/10 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Next
                        </button>
                      </div>
                    )
                  })()}
                </div>
              )}
            </div>
          )}

          {activeTab === 'paymentHistory' && (
            <div className="space-y-3">
              <div>
                <input
                  id="session-record-payment-search"
                  name="sessionRecordPaymentSearch"
                  type="text"
                  placeholder="Search player name in payment history..."
                  value={paymentHistorySearchTerm}
                  onChange={(e) => setPaymentHistorySearchTerm(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-white placeholder-slate-500 focus:border-white/30 focus:outline-none"
                />
              </div>

              {!billingData?.billingBySession?.ok || filteredPaymentHistoryRows.length === 0 ? (
                <p className="text-sm text-slate-400">No payment history recorded for this session yet.</p>
              ) : (
                <div className="space-y-3">
                  <div className="overflow-x-auto rounded-2xl border border-white/10">
                    <table className="min-w-full border-collapse text-left text-sm text-slate-200">
                      <thead className="bg-white/5 text-xs uppercase tracking-wider text-slate-400">
                        <tr>
                          <th className="px-4 py-3">#</th>
                          <th
                            className="cursor-pointer select-none px-4 py-3"
                            onClick={() => handlePaymentHistorySort('playerName')}
                          >
                            Player {paymentHistorySortColumn === 'playerName' ? (paymentHistorySortDirection === 'asc' ? '↑' : '↓') : ''}
                          </th>
                          <th
                            className="hidden sm:table-cell cursor-pointer select-none px-4 py-3 text-center"
                            onClick={() => handlePaymentHistorySort('gamesPlayed')}
                          >
                            Games {paymentHistorySortColumn === 'gamesPlayed' ? (paymentHistorySortDirection === 'asc' ? '↑' : '↓') : ''}
                          </th>
                          <th
                            className="hidden sm:table-cell cursor-pointer select-none px-4 py-3 text-center"
                            onClick={() => handlePaymentHistorySort('amountDue')}
                          >
                            Amount Due {paymentHistorySortColumn === 'amountDue' ? (paymentHistorySortDirection === 'asc' ? '↑' : '↓') : ''}
                          </th>
                          <th
                            className="hidden sm:table-cell cursor-pointer select-none px-4 py-3 text-center"
                            onClick={() => handlePaymentHistorySort('status')}
                          >
                            Status {paymentHistorySortColumn === 'status' ? (paymentHistorySortDirection === 'asc' ? '↑' : '↓') : ''}
                          </th>
                          <th
                            className="hidden sm:table-cell cursor-pointer select-none px-4 py-3"
                            onClick={() => handlePaymentHistorySort('checkoutAt')}
                          >
                            Checkout Time {paymentHistorySortColumn === 'checkoutAt' ? (paymentHistorySortDirection === 'asc' ? '↑' : '↓') : ''}
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/10">
                        {paginatedPaymentHistoryRows.map((row, index) => {
                          const rowKey = `${row.playerId}-${index}`
                          return (
                            <React.Fragment key={rowKey}>
                              <tr className="transition hover:bg-white/5">
                                <td className="px-4 py-3 text-slate-400">{(paymentHistoryPage - 1) * paymentHistoryItemsPerPage + index + 1}</td>
                                <td className="px-4 py-3 font-medium text-white">
                                  <button
                                    type="button"
                                    onClick={() => setExpandedPaymentRowId((prev) => (prev === rowKey ? null : rowKey))}
                                    className="flex w-full items-center justify-between gap-2 text-left"
                                  >
                                    <span>{row.playerName}</span>
                                    <span className="text-slate-400 sm:hidden">{expandedPaymentRowId === rowKey ? '▼' : '▶'}</span>
                                  </button>
                                </td>
                                <td className="hidden sm:table-cell px-4 py-3 text-center">
                                  <span className="inline-flex items-center justify-center rounded-full bg-slate-500/20 px-3 py-1 text-xs font-semibold text-slate-200">
                                    {row.gamesPlayed}
                                  </span>
                                </td>
                                <td className="hidden sm:table-cell px-4 py-3 text-center font-semibold text-emerald-200">₱{row.amountDue.toFixed(2)}</td>
                                <td className="hidden sm:table-cell px-4 py-3 text-center">
                                  <span
                                    className={`inline-flex items-center justify-center rounded-full px-3 py-1 text-xs font-semibold ${
                                      row.status === 'PAID'
                                        ? 'bg-emerald-500/20 text-emerald-200'
                                        : 'bg-orange-500/20 text-orange-200'
                                    }`}
                                  >
                                    {row.status}
                                  </span>
                                </td>
                                <td className="hidden sm:table-cell px-4 py-3 text-slate-300">{formatDateTime(row.checkoutAt)}</td>
                              </tr>
                              {expandedPaymentRowId === rowKey && (
                                <tr className="bg-slate-800/30 sm:hidden">
                                  <td colSpan={6} className="px-4 py-3">
                                    <div className="space-y-2 text-xs">
                                      <div className="flex justify-between border-b border-white/10 pb-2">
                                        <span className="text-slate-400">Games:</span>
                                        <span className="text-white">{row.gamesPlayed}</span>
                                      </div>
                                      <div className="flex justify-between border-b border-white/10 pb-2">
                                        <span className="text-slate-400">Amount Due:</span>
                                        <span className="text-emerald-200">₱{row.amountDue.toFixed(2)}</span>
                                      </div>
                                      <div className="flex justify-between border-b border-white/10 pb-2">
                                        <span className="text-slate-400">Status:</span>
                                        <span className="text-white">{row.status}</span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-slate-400">Checkout Time:</span>
                                        <span className="text-white">{formatDateTime(row.checkoutAt)}</span>
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>

                  {totalPaymentHistoryPages > 1 && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-400">Page {paymentHistoryPage} of {totalPaymentHistoryPages}</span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setPaymentHistoryPage((prev) => Math.max(1, prev - 1))}
                          disabled={paymentHistoryPage === 1}
                          className="rounded-full border border-slate-300/40 px-3 py-1 text-xs font-semibold text-slate-200 transition hover:bg-slate-500/10 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Previous
                        </button>
                        <div className="hidden items-center gap-1 sm:flex">
                          {paymentHistoryVisiblePages.map((item, index) => {
                            if (typeof item !== 'number') {
                              return (
                                <span key={`${item}-${index}`} className="px-1 text-xs text-slate-400">
                                  ...
                                </span>
                              )
                            }

                            const isActive = item === paymentHistoryPage
                            return (
                              <button
                                key={`payment-page-${item}`}
                                onClick={() => setPaymentHistoryPage(item)}
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
                          onClick={() => setPaymentHistoryPage((prev) => Math.min(totalPaymentHistoryPages, prev + 1))}
                          disabled={paymentHistoryPage === totalPaymentHistoryPages}
                          className="rounded-full border border-slate-300/40 px-3 py-1 text-xs font-semibold text-slate-200 transition hover:bg-slate-500/10 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default SessionRecordDetail
