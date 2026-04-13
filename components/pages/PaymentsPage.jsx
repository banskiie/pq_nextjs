'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import useDebouncedValue from '@/hooks/useDebouncedValue'

const INITIAL_RECENCY_SEED = Date.now()

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

const PaymentsPage = ({
  sessions,
  players,
  ongoingMatches,
  matchQueue,
  games,
  payments,
  onFinishPlayer,
  filteredSessionId,
  onFilterSessionChange,
}) => {
  const [activeTab, setActiveTab] = useState('payments')
  const [searchQuery, setSearchQuery] = useState('')
  const [historySearchQuery, setHistorySearchQuery] = useState('')
  const debouncedSearchQuery = useDebouncedValue(searchQuery, 300)
  const debouncedHistorySearchQuery = useDebouncedValue(historySearchQuery, 300)
  const [selectedPlayerForFinish, setSelectedPlayerForFinish] = useState(null)
  const [showNoPaymentConfirm, setShowNoPaymentConfirm] = useState(false)
  const [showPaymentConfirm, setShowPaymentConfirm] = useState(false)
  const [paymentGamesInput, setPaymentGamesInput] = useState('')
  const [showReceipt, setShowReceipt] = useState(false)
  const [receiptPlayer, setReceiptPlayer] = useState(null)
  const [finishedPlayers, setFinishedPlayers] = useState(new Set())
  const [sessionFilterId, setSessionFilterId] = useState(filteredSessionId || '')
  const [selectedPlayersForBatch, setSelectedPlayersForBatch] = useState(new Set())
  const [showBatchPaymentConfirm, setShowBatchPaymentConfirm] = useState(false)
  const [batchPaymentData, setBatchPaymentData] = useState(null)
  const [batchPaymentGamesInput, setBatchPaymentGamesInput] = useState({})
  const [showBatchNoPaymentConfirm, setShowBatchNoPaymentConfirm] = useState(false)
  const [showBatchPaymentConfirmation, setShowBatchPaymentConfirmation] = useState(false)
  const [showBatchReceipt, setShowBatchReceipt] = useState(false)
  const [currentPage, setCurrentPage] = useState(0)
  const [historyPage, setHistoryPage] = useState(0)
  const [sortColumn, setSortColumn] = useState('latestMatchAt')
  const [sortDirection, setSortDirection] = useState('desc')
  const [historySortColumn, setHistorySortColumn] = useState('checkoutAt')
  const [historySortDirection, setHistorySortDirection] = useState('desc')
  const [expandedPaymentPlayerId, setExpandedPaymentPlayerId] = useState(null)
  const [expandedHistoryRowId, setExpandedHistoryRowId] = useState(null)
  const isAnyPaymentsModalOpen = Boolean(
    selectedPlayerForFinish ||
    showNoPaymentConfirm ||
    showPaymentConfirm ||
    showReceipt ||
    showBatchPaymentConfirm ||
    showBatchNoPaymentConfirm ||
    showBatchPaymentConfirmation ||
    showBatchReceipt
  )

  useEffect(() => {
    const previousBodyOverflow = document.body.style.overflow
    const previousHtmlOverflow = document.documentElement.style.overflow

    if (isAnyPaymentsModalOpen) {
      document.body.style.overflow = 'hidden'
      document.documentElement.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = previousBodyOverflow
      document.documentElement.style.overflow = previousHtmlOverflow
    }

    return () => {
      document.body.style.overflow = previousBodyOverflow
      document.documentElement.style.overflow = previousHtmlOverflow
    }
  }, [isAnyPaymentsModalOpen])

  const formatCurrency = (value) => `₱${Number(value || 0).toFixed(2)}`

  const formatDateTime = (value) => {
    if (!value) return 'N/A'
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return 'N/A'
    return date.toLocaleString()
  }

  const normalizeId = (value) => {
    if (value === null || value === undefined) return ''
    return String(value)
  }

  const openSessions = useMemo(
    () => sessions.filter((session) => session.status !== 'CLOSED' && !session.isArchived),
    [sessions]
  )

  const availableSessionsForFilter = useMemo(() => {
    if (activeTab === 'payments') {
      return openSessions
    }

    return sessions.filter((session) => !session.isArchived)
  }, [activeTab, openSessions, sessions])

  const activeSessionId = sessionFilterId || null

  const sessionScope = useMemo(() => {
    if (activeSessionId) {
      return sessions.filter((session) => normalizeId(session._id) === normalizeId(activeSessionId))
    }
    return sessions.filter((session) => session.status !== 'CLOSED' && !session.isArchived)
  }, [sessions, activeSessionId])

  const scopedPlayers = useMemo(() => {
    const allowedPlayerIds = new Set(
      sessionScope.flatMap((session) => (session.players || []).map((item) => normalizeId(item.playerId)))
    )

    return players.filter((player) => allowedPlayerIds.has(normalizeId(player._id)))
  }, [players, sessionScope])

  const scopedSessionIds = useMemo(() => {
    return new Set(sessionScope.map((session) => normalizeId(session._id)))
  }, [sessionScope])

  const playerStats = useMemo(() => {
    const stats = {}
    let recencyFallbackSeed = INITIAL_RECENCY_SEED

    const parseTimestamp = (value) => {
      if (!value) return 0
      const parsed = new Date(value).getTime()
      return Number.isFinite(parsed) ? parsed : 0
    }

    const getRecencyValue = (...values) => {
      const parsedValues = values.map(parseTimestamp)
      const best = Math.max(...parsedValues)
      if (best > 0) return best

      // Fallback path when backend timestamps are missing/invalid.
      recencyFallbackSeed -= 1
      return recencyFallbackSeed
    }

    scopedPlayers.forEach((player) => {
      const playerId = normalizeId(player._id)
      stats[playerId] = {
        name: player.name,
        matchCount: 0,
        liveCount: 0,
        latestMatchAt: 0,
      }
    })

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
          const matchTime = getRecencyValue(match?.startedAt, match?.updatedAt, match?.createdAt)
          match.playerIds.forEach((playerIdRaw) => {
            const playerId = normalizeId(playerIdRaw)
            if (stats[playerId]) {
              stats[playerId].liveCount += 1
              stats[playerId].latestMatchAt = Math.max(stats[playerId].latestMatchAt, matchTime)
            }
          })
        })
      })
    }

    ;(games || []).forEach((game) => {
      if (!scopedSessionIds.has(normalizeId(game?.sessionId))) return
      if (!Array.isArray(game?.players)) return

      const gameTime = getRecencyValue(game?.finishedAt, game?.updatedAt, game?.createdAt)

      game.players.forEach((playerIdRaw) => {
        const playerId = normalizeId(playerIdRaw)
        if (stats[playerId]) {
          stats[playerId].latestMatchAt = Math.max(stats[playerId].latestMatchAt, gameTime)
        }
      })
    })

    countMatchesByPlayer(ongoingMatches)
    countMatchesByPlayer(matchQueue)

    Object.values(stats).forEach((item) => {
      item.matchCount += item.liveCount
      delete item.liveCount
    })

    return Object.entries(stats)
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => {
        if (b.latestMatchAt !== a.latestMatchAt) {
          return b.latestMatchAt - a.latestMatchAt
        }
        if (b.matchCount !== a.matchCount) {
          return b.matchCount - a.matchCount
        }
        return a.name.localeCompare(b.name)
      })
  }, [scopedPlayers, sessionScope, ongoingMatches, matchQueue, scopedSessionIds, games])

  const buildPaymentSummary = useCallback((playerId) => {
    const normalizedPlayerId = normalizeId(playerId)
    const rows = sessionScope
      .map((session) => {
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
      })
      .filter((row) => row.gameCount > 0 || activeSessionId)

    const totalGames = rows.reduce((sum, row) => sum + row.gameCount, 0)
    const totalAmount = rows.reduce((sum, row) => sum + row.subtotal, 0)

    return {
      rows,
      totalGames,
      totalAmount,
    }
  }, [activeSessionId, sessionScope])

  const buildBatchPaymentSummary = (playerIds) => {
    let totalGames = 0
    let totalAmount = 0
    const playerDetails = []

    playerIds.forEach((playerId) => {
      const player = filteredPlayerStats.find((p) => p.id === playerId)
      if (!player) return

      const summary = buildPaymentSummary(playerId)
      playerDetails.push({
        playerId,
        playerName: player.name,
        games: summary.totalGames,
        amount: summary.totalAmount,
        rows: summary.rows,
      })
      totalGames += summary.totalGames
      totalAmount += summary.totalAmount
    })

    return {
      playerDetails,
      totalGames,
      totalAmount,
    }
  }

  const handleBatchPaymentClick = () => {
    if (selectedPlayersForBatch.size === 0) return
    const batchData = buildBatchPaymentSummary(Array.from(selectedPlayersForBatch))
    setBatchPaymentData(batchData)
    const initialGamesInput = {}
    batchData.playerDetails.forEach((detail) => {
      initialGamesInput[detail.playerId] = String(detail.games)
    })
    setBatchPaymentGamesInput(initialGamesInput)
    setShowBatchPaymentConfirm(true)
  }

  const handleTogglePlayerSelection = (playerId) => {
    if (isPlayerInActiveMatch(playerId)) return
    const newSelected = new Set(selectedPlayersForBatch)
    if (newSelected.has(playerId)) {
      newSelected.delete(playerId)
    } else {
      newSelected.add(playerId)
    }
    setSelectedPlayersForBatch(newSelected)
  }

  const getPlayerTotalPayment = useCallback((playerId) => {
    if (finishedPlayers.has(normalizeId(playerId))) {
      return 0
    }
    const summary = buildPaymentSummary(playerId)
    return summary.totalAmount
  }, [buildPaymentSummary, finishedPlayers])

  const activeOrQueuedPlayerIds = useMemo(() => {
    const ids = new Set()

    const collectPlayerIds = (matchesBySession = {}) => {
      Object.values(matchesBySession).forEach((matches) => {
        if (!Array.isArray(matches)) return
        matches.forEach((match) => {
          if (!Array.isArray(match?.playerIds)) return
          match.playerIds.forEach((id) => {
            ids.add(normalizeId(id))
          })
        })
      })
    }

    collectPlayerIds(ongoingMatches || {})
    collectPlayerIds(matchQueue || {})

    return ids
  }, [ongoingMatches, matchQueue])

  const isPlayerInActiveMatch = (playerId) => activeOrQueuedPlayerIds.has(normalizeId(playerId))

  const adjustedBatchPaymentSummary = useMemo(() => {
    if (!batchPaymentData) return null

    const adjustedPlayerDetails = batchPaymentData.playerDetails.map((detail) => {
      const maxGames = Number(detail.games || 0)
      const parsedInput = Number.parseInt(batchPaymentGamesInput[detail.playerId], 10)
      const requestedGames = Number.isFinite(parsedInput) ? parsedInput : 0
      const paidGames = Math.min(Math.max(requestedGames, 0), maxGames)

      let remaining = paidGames
      const adjustedRows = (detail.rows || []).map((row) => {
        const paidGameCount = Math.max(0, Math.min(Number(row.gameCount || 0), remaining))
        remaining -= paidGameCount
        return {
          ...row,
          paidGameCount,
          subtotal: paidGameCount * Number(row.price || 0),
        }
      })

      const amount = adjustedRows.reduce((sum, row) => sum + row.subtotal, 0)

      return {
        ...detail,
        maxGames,
        paidGames,
        amount,
        rows: adjustedRows,
      }
    })

    return {
      playerDetails: adjustedPlayerDetails,
      totalGames: adjustedPlayerDetails.reduce((sum, detail) => sum + detail.paidGames, 0),
      totalAmount: adjustedPlayerDetails.reduce((sum, detail) => sum + detail.amount, 0),
    }
  }, [batchPaymentData, batchPaymentGamesInput])

  const adjustedSinglePaymentSummary = useMemo(() => {
    if (!selectedPlayerForFinish?.paymentSummary) return null

    const baseSummary = selectedPlayerForFinish.paymentSummary
    const maxGames = Number(baseSummary.totalGames || 0)
    const parsedInput = Number.parseInt(paymentGamesInput, 10)
    const requestedGames = Number.isFinite(parsedInput) ? parsedInput : 0
    const clampedGames = Math.min(Math.max(requestedGames, 0), maxGames)

    let remaining = clampedGames
    const adjustedRows = baseSummary.rows.map((row) => {
      const paidGameCount = Math.max(0, Math.min(Number(row.gameCount || 0), remaining))
      remaining -= paidGameCount
      return {
        ...row,
        paidGameCount,
        subtotal: paidGameCount * Number(row.price || 0),
      }
    })

    const totalAmount = adjustedRows.reduce((sum, row) => sum + row.subtotal, 0)

    return {
      maxGames,
      totalGames: clampedGames,
      rows: adjustedRows,
      totalAmount,
    }
  }, [selectedPlayerForFinish, paymentGamesInput])

  // Keep batch selection valid when live queue/match data changes.
  React.useEffect(() => {
    setSelectedPlayersForBatch((prev) => {
      if (prev.size === 0) return prev

      const next = new Set(Array.from(prev).filter((id) => !activeOrQueuedPlayerIds.has(String(id))))
      return next.size === prev.size ? prev : next
    })
  }, [activeOrQueuedPlayerIds])

  const filteredPlayerStats = (() => {
    if (!debouncedSearchQuery.trim()) {
      return playerStats
    }
    const query = debouncedSearchQuery.toLowerCase().trim()
    return playerStats.filter((player) => player.name.toLowerCase().includes(query))
  })()

  const handleSort = (column) => {
    if (sortColumn === column) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))
      return
    }

    setSortColumn(column)
    setSortDirection(column === 'name' ? 'asc' : 'desc')
  }

  const handleHistorySort = (column) => {
    if (historySortColumn === column) {
      setHistorySortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))
      return
    }

    setHistorySortColumn(column)
    setHistorySortDirection(column === 'playerName' || column === 'sessionName' || column === 'status' ? 'asc' : 'desc')
  }

  const sortedPlayerStats = (() => {
    const direction = sortDirection === 'asc' ? 1 : -1
    const sorted = [...filteredPlayerStats]

    sorted.sort((a, b) => {
      if (sortColumn === 'name') {
        const byName = a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
        if (byName !== 0) return byName * direction
        return (b.latestMatchAt - a.latestMatchAt)
      }

      if (sortColumn === 'matchCount') {
        const byCount = (a.matchCount - b.matchCount) * direction
        if (byCount !== 0) return byCount
        return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
      }

      if (sortColumn === 'pendingPayment') {
        const aTotal = getPlayerTotalPayment(a.id)
        const bTotal = getPlayerTotalPayment(b.id)
        const byTotal = (aTotal - bTotal) * direction
        if (byTotal !== 0) return byTotal
        return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
      }

      const byLatest = (a.latestMatchAt - b.latestMatchAt) * direction
      if (byLatest !== 0) return byLatest
      return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
    })

    return sorted
  })()

  const playerNameById = useMemo(() => {
    const map = new Map()
    players.forEach((player) => {
      map.set(normalizeId(player._id), player.name)
    })
    return map
  }, [players])

  const sessionNameById = useMemo(() => {
    const map = new Map()
    sessions.forEach((session) => {
      map.set(normalizeId(session._id), session.name)
    })
    return map
  }, [sessions])

  const paymentsHistoryRows = useMemo(() => {
    const rows = []

    ;(payments || []).forEach((paymentDoc) => {
      const normalizedSessionId = normalizeId(paymentDoc?.sessionId)
      const sessionName = sessionNameById.get(normalizedSessionId) || 'Unknown Session'
      const checkoutAt = paymentDoc?.updatedAt || paymentDoc?.closedAt || paymentDoc?.createdAt
      const pricePerGame = Number(paymentDoc?.pricePerGame || 0)

      ;(paymentDoc?.players || []).forEach((entry) => {
        const normalizedPlayerId = normalizeId(entry?.playerId)
        const gamesPlayed = Number(entry?.gamesPlayed || 0)
        const recordedTotal = Number(entry?.total || 0)
        const rawStatus = String(entry?.status || 'PENDING').toUpperCase()
        const status = rawStatus === 'PENDING' ? 'UNPAID' : rawStatus
        const playerCheckoutAt = entry?.checkedOutAt || paymentDoc?.closedAt || paymentDoc?.updatedAt || paymentDoc?.createdAt
        const expectedDueTotal = gamesPlayed * pricePerGame
        const total = status === 'UNPAID' && recordedTotal === 0
          ? expectedDueTotal
          : recordedTotal

        rows.push({
          id: `${normalizeId(paymentDoc?._id)}-${normalizedPlayerId}`,
          sessionName,
          playerName: (playerNameById.get(normalizedPlayerId) || 'Unknown Player').toUpperCase(),
          gamesPlayed,
          total,
          status,
          checkoutAt: playerCheckoutAt || checkoutAt,
          sessionId: normalizedSessionId,
        })
      })
    })

    const normalizedSearch = debouncedHistorySearchQuery.trim().toLowerCase()

    const filteredRows = rows
      .filter((row) => {
        if (activeSessionId && normalizeId(row.sessionId) !== normalizeId(activeSessionId)) {
          return false
        }

        if (!normalizedSearch) return true

        return (
          row.playerName.toLowerCase().includes(normalizedSearch) ||
          row.sessionName.toLowerCase().includes(normalizedSearch) ||
          row.status.toLowerCase().includes(normalizedSearch)
        )
      })

    const direction = historySortDirection === 'asc' ? 1 : -1

    return filteredRows.sort((a, b) => {
      if (historySortColumn === 'playerName') {
        return a.playerName.localeCompare(b.playerName, undefined, { sensitivity: 'base' }) * direction
      }

      if (historySortColumn === 'sessionName') {
        return a.sessionName.localeCompare(b.sessionName, undefined, { sensitivity: 'base' }) * direction
      }

      if (historySortColumn === 'gamesPlayed') {
        return (a.gamesPlayed - b.gamesPlayed) * direction
      }

      if (historySortColumn === 'total') {
        return (a.total - b.total) * direction
      }

      if (historySortColumn === 'status') {
        return a.status.localeCompare(b.status, undefined, { sensitivity: 'base' }) * direction
      }

      const aTime = new Date(a.checkoutAt || 0).getTime()
      const bTime = new Date(b.checkoutAt || 0).getTime()
      return (aTime - bTime) * direction
    })
  }, [
    payments,
    sessionNameById,
    playerNameById,
    debouncedHistorySearchQuery,
    activeSessionId,
    historySortColumn,
    historySortDirection,
  ])

  // Reset to first page when search query changes
  React.useEffect(() => {
    setCurrentPage(0)
  }, [debouncedSearchQuery, sessionFilterId, sortColumn, sortDirection])

  React.useEffect(() => {
    setHistoryPage(0)
  }, [debouncedHistorySearchQuery, sessionFilterId, historySortColumn, historySortDirection, activeTab])

  // Pagination logic
  const PLAYERS_PER_PAGE = 10
  const totalPages = Math.max(1, Math.ceil(sortedPlayerStats.length / PLAYERS_PER_PAGE))
  const clampedPage = Math.min(currentPage, totalPages - 1)
  const startIndex = clampedPage * PLAYERS_PER_PAGE
  const endIndex = startIndex + PLAYERS_PER_PAGE
  const paginatedPlayerStats = sortedPlayerStats.slice(startIndex, endIndex)
  const paymentsVisiblePages = useMemo(
    () => buildVisiblePages(clampedPage + 1, totalPages),
    [clampedPage, totalPages]
  )

  const HISTORY_ROWS_PER_PAGE = 10
  const totalHistoryPages = Math.max(1, Math.ceil(paymentsHistoryRows.length / HISTORY_ROWS_PER_PAGE))
  const clampedHistoryPage = Math.min(historyPage, totalHistoryPages - 1)
  const historyStartIndex = clampedHistoryPage * HISTORY_ROWS_PER_PAGE
  const historyEndIndex = historyStartIndex + HISTORY_ROWS_PER_PAGE
  const paginatedPaymentsHistoryRows = paymentsHistoryRows.slice(historyStartIndex, historyEndIndex)
  const historyVisiblePages = useMemo(
    () => buildVisiblePages(clampedHistoryPage + 1, totalHistoryPages),
    [clampedHistoryPage, totalHistoryPages]
  )

  return (
    <div className="space-y-6 py-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-white md:text-2xl">Payments</h1>
      </div>

      <div className="inline-flex items-center rounded-xl border border-white/10 bg-white/5 p-1">
        <button
          type="button"
          onClick={() => setActiveTab('payments')}
          className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
            activeTab === 'payments'
              ? 'bg-emerald-500/20 text-emerald-200'
              : 'text-slate-300 hover:bg-white/10 hover:text-white'
          }`}
        >
          Payments
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('paymentsHistory')}
          className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
            activeTab === 'paymentsHistory'
              ? 'bg-emerald-500/20 text-emerald-200'
              : 'text-slate-300 hover:bg-white/10 hover:text-white'
          }`}
        >
          Payments History
        </button>
      </div>

      <div className="flex items-center gap-3 border-b border-white/10 pb-4">
        <span className="text-sm text-slate-400">Session:</span>
        <select
          id="payments-session-filter"
          name="paymentsSessionFilter"
          value={sessionFilterId}
          onChange={(e) => {
            const value = e.target.value
            setSessionFilterId(value)
            if (onFilterSessionChange) {
              onFilterSessionChange(value || null)
            }
          }}
          className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white focus:border-white/30 focus:outline-none"
        >
          <option value="" className="text-black">
            {activeTab === 'payments' ? 'All Active Sessions' : 'All Sessions'}
          </option>
          {availableSessionsForFilter.map((session) => (
            <option className="text-black" key={session._id} value={session._id}>
              {session.name}
            </option>
          ))}
        </select>
      </div>

      {activeTab === 'payments' && (
      <section className="rounded-3xl border border-white/10 bg-white/5 p-4 shadow-xl shadow-black/20">
        <div className="mb-4">
          <input
            id="payments-player-search"
            name="paymentsPlayerSearch"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search players by name..."
            className="w-full rounded-lg border border-white/10 bg-slate-800/50 px-4 py-2 text-sm text-white placeholder-slate-400 focus:border-white/30 focus:outline-none focus:ring-1 focus:ring-white/20"
          />
        </div>

        {selectedPlayersForBatch.size > 0 && (
          <div className="mb-4 flex items-center justify-between rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4">
            <span className="text-sm font-semibold text-emerald-200">
              {selectedPlayersForBatch.size} player{selectedPlayersForBatch.size !== 1 ? 's' : ''} selected
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setSelectedPlayersForBatch(new Set())}
                className="rounded-lg border border-emerald-500/20 px-3 py-1.5 text-xs font-semibold text-emerald-200 transition hover:bg-emerald-500/10"
              >
                Clear
              </button>
              <button
                onClick={handleBatchPaymentClick}
                className="rounded-lg bg-emerald-500/20 px-4 py-1.5 text-xs font-semibold text-emerald-200 transition hover:bg-emerald-500/30"
              >
                Batch Payment
              </button>
            </div>
          </div>
        )}

        <div className="overflow-x-auto rounded-2xl border border-white/10">
          <table className="min-w-full border-collapse text-left text-sm text-slate-200">
            <thead className="bg-white/5 text-xs uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-4 py-3 w-12">
                  {(() => {
                    const selectablePlayers = paginatedPlayerStats.filter((p) => !isPlayerInActiveMatch(p.id))
                    const allSelectableChecked = selectablePlayers.length > 0 && selectablePlayers.every((p) => selectedPlayersForBatch.has(p.id))
                    return (
                  <input
                    id="payments-select-all"
                    name="paymentsSelectAll"
                    type="checkbox"
                    checked={allSelectableChecked}
                    disabled={selectablePlayers.length === 0}
                    onChange={() => {
                      if (allSelectableChecked) {
                        const newSelected = new Set(selectedPlayersForBatch)
                        selectablePlayers.forEach((p) => newSelected.delete(p.id))
                        setSelectedPlayersForBatch(newSelected)
                      } else {
                        const newSelected = new Set(selectedPlayersForBatch)
                        selectablePlayers.forEach((p) => newSelected.add(p.id))
                        setSelectedPlayersForBatch(newSelected)
                      }
                    }}
                    title={selectablePlayers.length === 0 ? 'All players on this page are in a match or queue' : ''}
                    className="h-4 w-4 rounded border-white/20 bg-white/10 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                  />
                    )
                  })()}
                </th>
                <th className="px-4 py-3">#</th>
                <th
                  className="px-4 py-3 cursor-pointer select-none"
                  onClick={() => handleSort('name')}
                >
                  Player Name {sortColumn === 'name' ? (sortDirection === 'asc' ? '↑' : '↓') : ''}
                </th>
                <th
                  className="hidden sm:table-cell px-4 py-3 text-center cursor-pointer select-none"
                  onClick={() => handleSort('matchCount')}
                >
                  Match Count {sortColumn === 'matchCount' ? (sortDirection === 'asc' ? '↑' : '↓') : ''}
                </th>
                <th
                  className="hidden sm:table-cell px-4 py-3 text-center cursor-pointer select-none"
                  onClick={() => handleSort('pendingPayment')}
                >
                  Pending Payment {sortColumn === 'pendingPayment' ? (sortDirection === 'asc' ? '↑' : '↓') : ''}
                </th>
                <th className="px-4 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {paginatedPlayerStats.map((player, index) => (
                <React.Fragment key={player.id}>
                  <tr className="transition hover:bg-white/5">
                    <td className="px-4 py-3">
                      <input
                        id={`payments-select-${player.id}`}
                        name="paymentsSelectedPlayers"
                        type="checkbox"
                        checked={selectedPlayersForBatch.has(player.id)}
                        onChange={() => handleTogglePlayerSelection(player.id)}
                        disabled={isPlayerInActiveMatch(player.id)}
                        title={isPlayerInActiveMatch(player.id) ? 'Player is currently in a match or queue' : ''}
                        className="h-4 w-4 rounded border-white/20 bg-white/10 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                      />
                    </td>
                    <td className="px-4 py-3 text-slate-400">{startIndex + index + 1}</td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => setExpandedPaymentPlayerId((prev) => (prev === player.id ? null : player.id))}
                        className="flex w-full items-center justify-between gap-2 text-left"
                      >
                        <span className="font-medium text-white">{player.name?.toUpperCase()}</span>
                        <span className="text-slate-400 sm:hidden">{expandedPaymentPlayerId === player.id ? '▼' : '▶'}</span>
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
                        ₱{getPlayerTotalPayment(player.id).toFixed(2)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => {
                          const paymentSummary = buildPaymentSummary(player.id)
                          setPaymentGamesInput(String(paymentSummary.totalGames || 0))
                          setSelectedPlayerForFinish({ ...player, paymentSummary })
                        }}
                        disabled={isPlayerInActiveMatch(player.id)}
                        title={isPlayerInActiveMatch(player.id) ? 'Player is currently in a match or queue' : ''}
                        className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                          isPlayerInActiveMatch(player.id)
                            ? 'bg-emerald-500/10 text-emerald-200/50 cursor-not-allowed opacity-50'
                            : 'bg-emerald-500/20 text-emerald-200 hover:bg-emerald-500/30 hover:text-emerald-100'
                        }`}
                      >
                        Player Checkout
                      </button>
                    </td>
                  </tr>
                  {expandedPaymentPlayerId === player.id && (
                    <tr className="bg-slate-800/30 sm:hidden">
                      <td colSpan={6} className="px-4 py-3">
                        <div className="space-y-2 text-xs">
                          <div className="flex justify-between border-b border-white/10 pb-2">
                            <span className="text-slate-400">Match Count:</span>
                            <span className="text-white">{player.matchCount}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">Pending Payment:</span>
                            <span className="text-emerald-200">₱{getPlayerTotalPayment(player.id).toFixed(2)}</span>
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

        {sortedPlayerStats.length > PLAYERS_PER_PAGE && (
          <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-3 rounded-lg border border-white/10 bg-slate-900/40 p-3 sm:p-4">
            <button
              onClick={() => setCurrentPage(Math.max(0, clampedPage - 1))}
              disabled={clampedPage === 0}
              className="rounded-full border border-slate-300/40 px-3 py-1 text-xs font-semibold text-slate-200 transition hover:bg-slate-500/10 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Previous
            </button>
            <div className="hidden items-center gap-1 sm:flex">
              {paymentsVisiblePages.map((item, index) => {
                if (typeof item !== 'number') {
                  return (
                    <span key={`${item}-${index}`} className="px-1 text-xs text-slate-400">
                      ...
                    </span>
                  )
                }

                const isActive = item === clampedPage + 1
                return (
                  <button
                    key={`payments-page-${item}`}
                    onClick={() => setCurrentPage(item - 1)}
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
            <span className="text-xs sm:text-sm text-slate-300">
              Page <span className="font-semibold text-white">{clampedPage + 1}</span> of <span className="font-semibold text-white">{totalPages}</span> • Total Players: <span className="font-semibold text-white">{sortedPlayerStats.length}</span>
            </span>
            <button
              onClick={() => setCurrentPage(Math.min(totalPages - 1, clampedPage + 1))}
              disabled={clampedPage >= totalPages - 1}
              className="rounded-full border border-slate-300/40 px-3 py-1 text-xs font-semibold text-slate-200 transition hover:bg-slate-500/10 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next
            </button>
          </div>
        )}
      </section>
      )}

      {activeTab === 'paymentsHistory' && (
        <section className="rounded-3xl border border-white/10 bg-white/5 p-4 shadow-xl shadow-black/20">
          <div className="mb-4">
            <input
              id="payments-history-search"
              name="paymentsHistorySearch"
              type="text"
              value={historySearchQuery}
              onChange={(e) => setHistorySearchQuery(e.target.value)}
              placeholder="Search by player, session, or status..."
              className="w-full rounded-lg border border-white/10 bg-slate-800/50 px-4 py-2 text-sm text-white placeholder-slate-400 focus:border-white/30 focus:outline-none focus:ring-1 focus:ring-white/20"
            />
          </div>

          <div className="overflow-x-auto rounded-2xl border border-white/10">
            <table className="min-w-full border-collapse text-left text-sm text-slate-200">
              <thead className="bg-white/5 text-xs uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="px-4 py-3">#</th>
                  <th
                    className="cursor-pointer select-none px-4 py-3"
                    onClick={() => handleHistorySort('playerName')}
                  >
                    Player {historySortColumn === 'playerName' ? (historySortDirection === 'asc' ? '↑' : '↓') : ''}
                  </th>
                  <th
                    className="cursor-pointer select-none px-4 py-3"
                    onClick={() => handleHistorySort('sessionName')}
                  >
                    Session {historySortColumn === 'sessionName' ? (historySortDirection === 'asc' ? '↑' : '↓') : ''}
                  </th>
                  <th
                    className="hidden sm:table-cell cursor-pointer select-none px-4 py-3 text-center"
                    onClick={() => handleHistorySort('gamesPlayed')}
                  >
                    Games {historySortColumn === 'gamesPlayed' ? (historySortDirection === 'asc' ? '↑' : '↓') : ''}
                  </th>
                  <th
                    className="hidden sm:table-cell cursor-pointer select-none px-4 py-3 text-center"
                    onClick={() => handleHistorySort('total')}
                  >
                    Amount Due {historySortColumn === 'total' ? (historySortDirection === 'asc' ? '↑' : '↓') : ''}
                  </th>
                  <th
                    className="hidden sm:table-cell cursor-pointer select-none px-4 py-3 text-center"
                    onClick={() => handleHistorySort('status')}
                  >
                    Status {historySortColumn === 'status' ? (historySortDirection === 'asc' ? '↑' : '↓') : ''}
                  </th>
                  <th
                    className="hidden sm:table-cell cursor-pointer select-none px-4 py-3"
                    onClick={() => handleHistorySort('checkoutAt')}
                  >
                    Checkout Time {historySortColumn === 'checkoutAt' ? (historySortDirection === 'asc' ? '↑' : '↓') : ''}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {paginatedPaymentsHistoryRows.length > 0 ? (
                  paginatedPaymentsHistoryRows.map((row, index) => (
                    <React.Fragment key={row.id}>
                      <tr className="transition hover:bg-white/5">
                        <td className="px-4 py-3 text-slate-400">{historyStartIndex + index + 1}</td>
                        <td className="px-4 py-3 font-medium text-white">
                          <button
                            type="button"
                            onClick={() => setExpandedHistoryRowId((prev) => (prev === row.id ? null : row.id))}
                            className="flex w-full items-center justify-between gap-2 text-left"
                          >
                            <span>{row.playerName}</span>
                            <span className="text-slate-400 sm:hidden">{expandedHistoryRowId === row.id ? '▼' : '▶'}</span>
                          </button>
                        </td>
                        <td className="px-4 py-3">{row.sessionName}</td>
                        <td className="hidden sm:table-cell px-4 py-3 text-center">
                          <span className="inline-flex items-center justify-center rounded-full bg-slate-500/20 px-3 py-1 text-xs font-semibold text-slate-200">
                            {row.gamesPlayed}
                          </span>
                        </td>
                        <td className="hidden sm:table-cell px-4 py-3 text-center font-semibold text-emerald-200">{formatCurrency(row.total)}</td>
                        <td className="hidden sm:table-cell px-4 py-3 text-center">
                          <span
                            className={`inline-flex items-center justify-center rounded-full px-3 py-1 text-xs font-semibold ${
                              row.status === 'PAID'
                                ? 'bg-emerald-500/20 text-emerald-200'
                                : row.status === 'UNPAID'
                                  ? 'bg-orange-500/20 text-orange-200'
                                  : 'bg-amber-500/20 text-amber-200'
                            }`}
                          >
                            {row.status}
                          </span>
                        </td>
                        <td className="hidden sm:table-cell px-4 py-3 text-slate-300">{formatDateTime(row.checkoutAt)}</td>
                      </tr>
                      {expandedHistoryRowId === row.id && (
                        <tr className="bg-slate-800/30 sm:hidden">
                          <td colSpan={7} className="px-4 py-3">
                            <div className="space-y-2 text-xs">
                              <div className="flex justify-between border-b border-white/10 pb-2">
                                <span className="text-slate-400">Games:</span>
                                <span className="text-white">{row.gamesPlayed}</span>
                              </div>
                              <div className="flex justify-between border-b border-white/10 pb-2">
                                <span className="text-slate-400">Amount Due:</span>
                                <span className="text-emerald-200">{formatCurrency(row.total)}</span>
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
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-sm text-slate-400">
                      No payment history found for the current filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {paymentsHistoryRows.length > HISTORY_ROWS_PER_PAGE && (
            <div className="mt-4 flex flex-col items-center justify-between gap-3 rounded-lg border border-white/10 bg-slate-900/40 p-3 sm:flex-row sm:p-4">
              <button
                onClick={() => setHistoryPage(Math.max(0, clampedHistoryPage - 1))}
                disabled={clampedHistoryPage === 0}
                className="rounded-full border border-slate-300/40 px-3 py-1 text-xs font-semibold text-slate-200 transition hover:bg-slate-500/10 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Previous
              </button>
              <div className="hidden items-center gap-1 sm:flex">
                {historyVisiblePages.map((item, index) => {
                  if (typeof item !== 'number') {
                    return (
                      <span key={`${item}-${index}`} className="px-1 text-xs text-slate-400">
                        ...
                      </span>
                    )
                  }

                  const isActive = item === clampedHistoryPage + 1
                  return (
                    <button
                      key={`history-page-${item}`}
                      onClick={() => setHistoryPage(item - 1)}
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
              <span className="text-xs text-slate-300 sm:text-sm">
                Page <span className="font-semibold text-white">{clampedHistoryPage + 1}</span> of <span className="font-semibold text-white">{totalHistoryPages}</span> • Total Records: <span className="font-semibold text-white">{paymentsHistoryRows.length}</span>
              </span>
              <button
                onClick={() => setHistoryPage(Math.min(totalHistoryPages - 1, clampedHistoryPage + 1))}
                disabled={clampedHistoryPage >= totalHistoryPages - 1}
                className="rounded-full border border-slate-300/40 px-3 py-1 text-xs font-semibold text-slate-200 transition hover:bg-slate-500/10 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next
              </button>
            </div>
          )}
        </section>
      )}

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
                  {(adjustedSinglePaymentSummary?.rows || selectedPlayerForFinish.paymentSummary.rows).map((row) => (
                    <div key={row.sessionId} className="rounded-md border border-white/10 px-3 py-2">
                      <p className="text-xs font-semibold text-white">{row.sessionName}</p>
                      <p className="mt-1 text-xs text-slate-300">
                        {(row.paidGameCount ?? row.gameCount)} x {row.price.toFixed(2)} ={' '}
                        <span className="font-semibold text-emerald-200">{row.subtotal.toFixed(2)}</span>
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                <label htmlFor="checkout-paid-games-input" className="mb-1 block text-xs text-slate-400">
                  Games To Pay (max {adjustedSinglePaymentSummary?.maxGames ?? selectedPlayerForFinish.paymentSummary.totalGames ?? 0})
                </label>
                <input
                  id="checkout-paid-games-input"
                  type="number"
                  min={0}
                  max={adjustedSinglePaymentSummary?.maxGames ?? selectedPlayerForFinish.paymentSummary.totalGames ?? 0}
                  value={paymentGamesInput}
                  onChange={(e) => setPaymentGamesInput(e.target.value)}
                  className="w-full rounded border border-white/10 bg-slate-800 px-2 py-1 text-xs text-white focus:border-white/30 focus:outline-none"
                />
                <p className="mt-1 text-[10px] text-slate-400">
                  You can pay any number from 0 to {adjustedSinglePaymentSummary?.maxGames ?? selectedPlayerForFinish.paymentSummary.totalGames ?? 0} games.
                </p>
              </div>

              <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                <p className="text-xs text-slate-200">
                  Total Games: <span className="font-semibold text-white">{adjustedSinglePaymentSummary?.totalGames ?? selectedPlayerForFinish.paymentSummary.totalGames}</span>
                </p>
                <p className="mt-2 text-xs text-slate-200">
                  Total Payment:{' '}
                  <span className="font-semibold text-emerald-200">{(adjustedSinglePaymentSummary?.totalAmount ?? selectedPlayerForFinish.paymentSummary.totalAmount).toFixed(2)}</span>
                </p>
              </div>
            </div>

            <div className="flex gap-2 border-t border-white/10 px-5 py-4">
              <button
                onClick={() => {
                  setSelectedPlayerForFinish(null)
                  setPaymentGamesInput('')
                }}
                className="flex-1 rounded-lg border border-white/20 px-3 py-2 text-xs font-semibold text-white/80 transition hover:bg-white/5 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={() => setShowNoPaymentConfirm(true)}
                disabled={isPlayerInActiveMatch(selectedPlayerForFinish.id)}
                title={isPlayerInActiveMatch(selectedPlayerForFinish.id) ? 'Player is currently in a match or queue' : ''}
                className={`flex-1 rounded-lg px-3 py-2 text-xs font-semibold transition ${
                  isPlayerInActiveMatch(selectedPlayerForFinish.id)
                    ? 'bg-orange-500/10 text-orange-200/50 cursor-not-allowed opacity-50'
                    : 'bg-orange-500/20 text-orange-200 hover:bg-orange-500/30'
                }`}
              >
                Finish Without Payment
              </button>
              <button
                onClick={() => {
                  setPaymentGamesInput(String(selectedPlayerForFinish.paymentSummary.totalGames || 0))
                  setShowPaymentConfirm(true)
                }}
                disabled={isPlayerInActiveMatch(selectedPlayerForFinish.id)}
                title={isPlayerInActiveMatch(selectedPlayerForFinish.id) ? 'Player is currently in a match or queue' : ''}
                className={`flex-1 rounded-lg px-3 py-2 text-xs font-semibold transition ${
                  isPlayerInActiveMatch(selectedPlayerForFinish.id)
                    ? 'bg-emerald-500/10 text-emerald-200/50 cursor-not-allowed opacity-50'
                    : 'bg-emerald-500/20 text-emerald-200 hover:bg-emerald-500/30'
                }`}
              >
                Finish With <br />Payment
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
              <p className="mt-1 text-xs text-slate-300">Are you sure you want this to checkout player without payment?</p>
            </div>

            <div className="px-5 py-4">
              <p className="text-sm text-white">
                Player: <span className="font-semibold text-emerald-200">{selectedPlayerForFinish.name}</span>
              </p>
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
                  const sessionsToRemoveFrom = selectedPlayerForFinish.paymentSummary.rows.map((row) => row.sessionId)
                  if (onFinishPlayer) {
                    onFinishPlayer(playerId, { isExempted: true, sessionsToRemoveFrom })
                  }
                  setFinishedPlayers((prev) => new Set([...prev, normalizeId(playerId)]))
                  setShowNoPaymentConfirm(false)
                  setSelectedPlayerForFinish(null)
                  setPaymentGamesInput('')
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
                <p className="text-sm text-white">
                  Player: <span className="font-semibold text-emerald-200">{selectedPlayerForFinish.name}</span>
                </p>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                <p className="mb-2 text-xs text-slate-400">Payment Summary</p>
                {adjustedSinglePaymentSummary?.rows.map((row) => (
                  <p key={row.sessionId} className="mb-1 text-xs text-slate-300">
                    {row.sessionName}: {row.paidGameCount} x {row.price.toFixed(2)} ={' '}
                    <span className="font-semibold text-emerald-200">{row.subtotal.toFixed(2)}</span>
                  </p>
                ))}
                <div className="mt-2 border-t border-white/10 pt-2">
                  <p className="text-xs text-white">
                    Total: <span className="font-semibold text-emerald-200">{adjustedSinglePaymentSummary?.totalAmount.toFixed(2)}</span>
                  </p>
                </div>
              </div>

              <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                <label htmlFor="paid-games-input" className="mb-1 block text-xs text-slate-400">
                  Games To Pay (max {adjustedSinglePaymentSummary?.maxGames ?? 0})
                </label>
                <input
                  id="paid-games-input"
                  type="number"
                  min={0}
                  max={adjustedSinglePaymentSummary?.maxGames ?? 0}
                  value={paymentGamesInput}
                  onChange={(e) => setPaymentGamesInput(e.target.value)}
                  className="w-full rounded border border-white/10 bg-slate-800 px-2 py-1 text-xs text-white focus:border-white/30 focus:outline-none"
                />
                <p className="mt-1 text-[10px] text-slate-400">
                  You can pay any number from 0 to {adjustedSinglePaymentSummary?.maxGames ?? 0} games.
                </p>
              </div>
            </div>

            <div className="flex gap-2 border-t border-white/10 px-5 py-4">
              <button
                onClick={() => {
                  setShowPaymentConfirm(false)
                  setPaymentGamesInput('')
                }}
                className="flex-1 rounded-lg border border-white/20 px-3 py-2 text-xs font-semibold text-white/80 transition hover:bg-white/5 hover:text-white"
              >
                No
              </button>
              <button
                onClick={() => {
                  const playerId = selectedPlayerForFinish.id
                  const sessionsToRemoveFrom = selectedPlayerForFinish.paymentSummary.rows.map((row) => row.sessionId)
                  const receiptData = {
                    ...selectedPlayerForFinish,
                    paymentSummary: {
                      ...selectedPlayerForFinish.paymentSummary,
                      rows: (adjustedSinglePaymentSummary?.rows || []).map((row) => ({
                        ...row,
                        gameCount: row.paidGameCount,
                      })),
                      totalGames: adjustedSinglePaymentSummary?.totalGames ?? 0,
                      totalAmount: adjustedSinglePaymentSummary?.totalAmount ?? 0,
                    },
                  }
                  if (onFinishPlayer) {
                    onFinishPlayer(playerId, {
                      isExempted: false,
                      sessionsToRemoveFrom,
                      paidGames: adjustedSinglePaymentSummary?.totalGames ?? 0,
                    })
                  }
                  setFinishedPlayers((prev) => new Set([...prev, normalizeId(playerId)]))
                  setShowPaymentConfirm(false)
                  setPaymentGamesInput('')
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

      {showBatchPaymentConfirm && batchPaymentData && (
        <div className="fixed inset-0 z-70 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-slate-900 shadow-2xl">
            <div className="border-b border-white/10 px-5 py-4">
              <h3 className="text-base font-semibold text-white">Confirm Batch Payment</h3>
              <p className="mt-1 text-xs text-slate-300">Review players and total payment before confirming.</p>
            </div>

            <div className="space-y-4 px-5 py-4 max-h-96 overflow-y-auto">
              <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                <p className="text-xs text-slate-400 mb-3">Selected Players</p>
                <div className="space-y-2">
                  {adjustedBatchPaymentSummary?.playerDetails.map((detail) => (
                    <div key={detail.playerId} className="flex items-center justify-between rounded-md border border-white/10 px-3 py-2">
                      <div className="min-w-0 flex-1 pr-3">
                        <p className="text-xs font-semibold text-white">{detail.playerName}</p>
                        <p className="text-[10px] text-slate-400">Max: {detail.maxGames} games</p>
                        <div className="mt-1 flex items-center gap-2">
                          <label htmlFor={`batch-paid-games-${detail.playerId}`} className="text-[10px] text-slate-400">
                            Pay:
                          </label>
                          <input
                            id={`batch-paid-games-${detail.playerId}`}
                            type="number"
                            min={0}
                            max={detail.maxGames}
                            value={batchPaymentGamesInput[detail.playerId] ?? String(detail.maxGames)}
                            onChange={(e) => {
                              const nextValue = e.target.value
                              setBatchPaymentGamesInput((prev) => ({ ...prev, [detail.playerId]: nextValue }))
                            }}
                            className="w-20 rounded border border-white/10 bg-slate-800 px-2 py-1 text-[10px] text-white focus:border-white/30 focus:outline-none"
                          />
                        </div>
                      </div>
                      <p className="text-xs font-semibold text-emerald-200">₱{detail.amount.toFixed(2)}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                <div className="flex justify-between mb-2">
                  <span className="text-xs text-slate-200">Total Games:</span>
                  <span className="text-xs font-semibold text-white">{adjustedBatchPaymentSummary?.totalGames ?? 0}</span>
                </div>
                <div className="flex justify-between border-t border-white/10 pt-2">
                  <span className="text-xs text-slate-200">Total Amount:</span>
                  <span className="text-sm font-semibold text-emerald-200">₱{(adjustedBatchPaymentSummary?.totalAmount ?? 0).toFixed(2)}</span>
                </div>
              </div>
            </div>

            <div className="flex gap-2 border-t border-white/10 px-5 py-4">
              <button
                onClick={() => {
                  setShowBatchPaymentConfirm(false)
                  setBatchPaymentData(null)
                  setBatchPaymentGamesInput({})
                }}
                className="flex-1 rounded-lg border border-white/20 px-3 py-2 text-xs font-semibold text-white/80 transition hover:bg-white/5 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowBatchPaymentConfirm(false)
                  setShowBatchNoPaymentConfirm(true)
                }}
                className="flex-1 rounded-lg bg-orange-500/20 px-3 py-2 text-xs font-semibold text-orange-200 transition hover:bg-orange-500/30"
              >
                Finish Without Payment
              </button>
              <button
                onClick={() => {
                  setShowBatchPaymentConfirm(false)
                  setShowBatchPaymentConfirmation(true)
                }}
                className="flex-1 rounded-lg bg-emerald-500/20 px-3 py-2 text-xs font-semibold text-emerald-200 transition hover:bg-emerald-500/30"
              >
                Confirm Payment
              </button>
            </div>
          </div>
        </div>
      )}

      {showBatchNoPaymentConfirm && batchPaymentData && (
        <div className="fixed inset-0 z-70 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-slate-900 shadow-2xl">
            <div className="border-b border-white/10 px-5 py-4">
              <h3 className="text-base font-semibold text-white">Confirm Batch Finish Without Payment</h3>
              <p className="mt-1 text-xs text-slate-300">Are you sure you want to finish these players without payment?</p>
            </div>

            <div className="px-5 py-4 space-y-3 max-h-64 overflow-y-auto">
              <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                <p className="mb-2 text-xs text-slate-400">Selected Players</p>
                <div className="space-y-2">
                  {batchPaymentData.playerDetails.map((detail) => (
                    <div key={detail.playerId} className="flex items-center justify-between text-xs">
                      <p className="text-white">{detail.playerName}</p>
                      <p className="text-slate-400">{detail.games} games</p>
                    </div>
                  ))}
                </div>
              </div>
              <p className="text-xs text-slate-300">This action will mark these players as finished without collecting payment.</p>
            </div>

            <div className="flex gap-2 border-t border-white/10 px-5 py-4">
              <button
                onClick={() => {
                  setShowBatchNoPaymentConfirm(false)
                  setShowBatchPaymentConfirm(true)
                }}
                className="flex-1 rounded-lg border border-orange-500/20 px-3 py-2 text-xs font-semibold text-orange-200 transition hover:bg-orange-500/10"
              >
                No
              </button>
              <button
                onClick={async () => {
                  // Process batch payment without payment sequentially
                  const playerIds = Array.from(selectedPlayersForBatch)
                  for (const playerId of playerIds) {
                    const summary = buildPaymentSummary(playerId)
                    const sessionsToRemoveFrom = summary.rows.map((row) => row.sessionId)
                    if (onFinishPlayer) {
                      await onFinishPlayer(playerId, { isExempted: true, sessionsToRemoveFrom })
                    }
                    setFinishedPlayers((prev) => new Set([...prev, normalizeId(playerId)]))
                  }
                  setShowBatchNoPaymentConfirm(false)
                  setShowBatchPaymentConfirm(false)
                  setBatchPaymentData(null)
                  setSelectedPlayersForBatch(new Set())
                }}
                className="flex-1 rounded-lg bg-orange-500/20 px-3 py-2 text-xs font-semibold text-orange-200 transition hover:bg-orange-500/30"
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

            <div className="space-y-4 px-5 py-6">
              <div className="text-center">
                <p className="text-xs text-slate-400">Player Name</p>
                <p className="text-base font-semibold text-white">{receiptPlayer.name?.toUpperCase()}</p>
              </div>

              <div className="rounded-lg border border-white/10 bg-white/5 p-4">
                <div className="mb-3">
                  <p className="mb-2 text-xs text-slate-400">Session Details</p>
                  {receiptPlayer.paymentSummary.rows.map((row) => (
                    <div key={row.sessionId} className="mb-2 flex justify-between text-xs text-slate-300">
                      <span>{row.sessionName}</span>
                      <span>
                        {row.gameCount} games x {row.price.toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between border-t border-white/10 pt-3">
                  <span className="text-sm font-semibold text-white">Total Games:</span>
                  <span className="text-sm font-semibold text-white">{receiptPlayer.paymentSummary.totalGames}</span>
                </div>
                <div className="mt-2 flex justify-between">
                  <span className="text-sm font-semibold text-white">Total Amount:</span>
                  <span className="text-lg font-bold text-emerald-300">{receiptPlayer.paymentSummary.totalAmount.toFixed(2)}</span>
                </div>
              </div>

              <p className="text-center text-xs text-slate-400">Payment has been recorded</p>
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

      {showBatchPaymentConfirmation && batchPaymentData && (
        <div className="fixed inset-0 z-70 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-slate-900 shadow-2xl">
            <div className="border-b border-white/10 px-5 py-4">
              <h3 className="text-base font-semibold text-white">Confirm Batch Payment</h3>
              <p className="mt-1 text-xs text-slate-300">Are you sure you want to confirm payment for these players?</p>
            </div>

            <div className="px-5 py-4 space-y-3 max-h-64 overflow-y-auto">
              <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                <p className="mb-2 text-xs text-slate-400">Selected Players</p>
                <div className="space-y-2">
                  {adjustedBatchPaymentSummary?.playerDetails.map((detail) => (
                    <div key={detail.playerId} className="flex items-center justify-between text-xs">
                      <p className="text-white font-semibold">{detail.playerName}</p>
                      <p className="text-emerald-200">₱{detail.amount.toFixed(2)}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                <div className="flex justify-between text-xs text-slate-200">
                  <span>Total Payment:</span>
                  <span className="font-semibold text-emerald-200">₱{(adjustedBatchPaymentSummary?.totalAmount ?? 0).toFixed(2)}</span>
                </div>
              </div>
              <p className="text-xs text-slate-300">This action will mark all players as finished with payment recorded.</p>
            </div>

            <div className="flex gap-2 border-t border-white/10 px-5 py-4">
              <button
                onClick={() => {
                  setShowBatchPaymentConfirmation(false)
                  setShowBatchPaymentConfirm(true)
                }}
                className="flex-1 rounded-lg border border-white/20 px-3 py-2 text-xs font-semibold text-white/80 transition hover:bg-white/5 hover:text-white"
              >
                No
              </button>
              <button
                onClick={async () => {
                  // Process batch payment sequentially
                  const adjustedDetails = adjustedBatchPaymentSummary?.playerDetails || []
                  for (const detail of adjustedDetails) {
                    const sessionsToRemoveFrom = (detail.rows || []).map((row) => row.sessionId)
                    if (onFinishPlayer) {
                      await onFinishPlayer(detail.playerId, {
                        isExempted: false,
                        sessionsToRemoveFrom,
                        paidGames: detail.paidGames,
                      })
                    }
                    setFinishedPlayers((prev) => new Set([...prev, normalizeId(detail.playerId)]))
                  }
                  setShowBatchPaymentConfirmation(false)
                  setSelectedPlayersForBatch(new Set())
                  setBatchPaymentData(adjustedBatchPaymentSummary || batchPaymentData)
                  setBatchPaymentGamesInput({})
                  setShowBatchReceipt(true)
                }}
                className="flex-1 rounded-lg bg-emerald-500/20 px-3 py-2 text-xs font-semibold text-emerald-200 transition hover:bg-emerald-500/30"
              >
                Yes
              </button>
            </div>
          </div>
        </div>
      )}

      {showBatchReceipt && batchPaymentData && (
        <div className="fixed inset-0 z-70 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-900 shadow-2xl">
            <div className="border-b border-white/10 px-5 py-4 text-center">
              <h3 className="text-lg font-semibold text-white">Batch Payment Receipt</h3>
              <p className="mt-1 text-xs text-slate-300">Transaction successful</p>
            </div>

            <div className="space-y-4 px-5 py-6">
              <div className="rounded-lg border border-white/10 bg-white/5 p-4">
                <div className="mb-3">
                  <p className="mb-2 text-xs text-slate-400">Players Finished</p>
                  {batchPaymentData.playerDetails.map((detail) => (
                    <div key={detail.playerId} className="mb-2 flex justify-between text-xs text-slate-300">
                      <span>{detail.playerName}</span>
                      <span>
                        {(detail.paidGames ?? detail.games ?? 0)} games
                      </span>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between border-t border-white/10 pt-3">
                  <span className="text-sm font-semibold text-white">Total Games:</span>
                  <span className="text-sm font-semibold text-white">{batchPaymentData.totalGames}</span>
                </div>
                <div className="mt-2 flex justify-between">
                  <span className="text-sm font-semibold text-white">Total Amount Collected:</span>
                  <span className="text-lg font-bold text-emerald-300">₱{batchPaymentData.totalAmount.toFixed(2)}</span>
                </div>
              </div>

              <p className="text-center text-xs text-slate-400">Payments have been recorded</p>
            </div>

            <div className="border-t border-white/10 px-5 py-4">
              <button
                onClick={() => {
                  setShowBatchReceipt(false)
                  setBatchPaymentData(null)
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

export default PaymentsPage
