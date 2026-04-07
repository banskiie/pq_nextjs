'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { gql } from '@apollo/client'
import { useMutation, useQuery, useSubscription } from '@apollo/client/react'
import SessionRecordDetail from '@/components/SessionRecordDetail'
import useDebouncedValue from '@/hooks/useDebouncedValue'

const CLOSED_SESSIONS_QUERY = gql`
  query ClosedSessions {
    closedSessions {
      _id
      name
      status
      isArchived
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

const SESSION_SUBSCRIPTION = gql`
  subscription SessionSub {
    sessionSub {
      type
      session {
        _id
        name
        status
        isArchived
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
  }
`

const ARCHIVE_SESSION_MUTATION = gql`
  mutation ArchiveSession($id: ID!) {
    archiveSession(id: $id) {
      ok
      message
      session {
        _id
        isArchived
      }
    }
  }
`

const formatDateTime = (value) => {
  if (!value) return '—'
  // Handle both ISO strings and timestamp numbers
  const date = typeof value === 'string' && value.includes('-') 
    ? new Date(value) 
    : new Date(Number(value))
  if (Number.isNaN(date.getTime())) return '—'
  
  const options = {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  }
  return date.toLocaleString('en-US', options)
}

const RecordsPage = () => {
  const { data: sessionsData, loading: sessionsLoading, refetch: refetchSessions } = useQuery(CLOSED_SESSIONS_QUERY, {
    fetchPolicy: 'network-only'
  })
  const sessionIds = sessionsData?.closedSessions?.map(s => s._id) || []
  const { data, loading, error, refetch: refetchGames } = useQuery(GAMES_BY_SESSION_IDS_QUERY, {
    variables: { sessionIds },
    skip: sessionIds.length === 0, // Skip query if no archived sessions
    fetchPolicy: 'network-only'
  })
  const { data: subData } = useSubscription(GAMES_SUBSCRIPTION)
  const { data: sessionSubData } = useSubscription(SESSION_SUBSCRIPTION)
  const sessionSub = sessionSubData?.sessionSub
  const [searchTerm, setSearchTerm] = useState('')
  const debouncedSearchTerm = useDebouncedValue(searchTerm, 300)
  const [sortOrder, setSortOrder] = useState('desc')
  const [sortColumn, setSortColumn] = useState('startedAt')
  const [dateFilter, setDateFilter] = useState('')
  const [selectedSessions, setSelectedSessions] = useState([])
  const [expandedRecordId, setExpandedRecordId] = useState(null)
  const [viewingSessionId, setViewingSessionId] = useState(null)
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false)
  const [archivePendingIds, setArchivePendingIds] = useState([])
  const [archiveErrorMessage, setArchiveErrorMessage] = useState('')
  const selectAllRef = useRef(null)
  const [archiveSession, { loading: archiveLoading }] = useMutation(ARCHIVE_SESSION_MUTATION)
  
  const sessions = useMemo(() => sessionsData?.closedSessions || [], [sessionsData?.closedSessions])
  
  // Handle subscription updates - refetch when games are created or sessions change status
  useEffect(() => {
    // When a game is created, refetch to capture any newly-closed sessions and games
    if (subData?.gameSub?.type === 'CREATED') {
      refetchSessions()
      refetchGames()
    }
  }, [subData?.gameSub?.type, refetchSessions, refetchGames])

  // Handle session status changes
  useEffect(() => {
    if (!sessionSub) return
    const { type } = sessionSub
    // Refetch on any session change: CLOSED, UPDATED, ARCHIVED
    if (type === 'CLOSED' || type === 'UPDATED' || type === 'ARCHIVED') {
      refetchSessions()
      refetchGames()
    }
  }, [sessionSub, refetchSessions, refetchGames])

  const games = useMemo(() => {
    const baseGames = data?.gamesBySessionIds || []
    
    // Merge subscription data
    if (subData?.gameSub?.game) {
      const newGame = subData.gameSub.game
      const exists = baseGames.some(g => g._id === newGame._id)
      return exists ? baseGames : [...baseGames, newGame]
    }
    
    return baseGames
  }, [data?.gamesBySessionIds, subData?.gameSub?.game])

  const getDateValue = (value) => {
    if (!value) return 0
    const date = typeof value === 'string' && value.includes('-')
      ? new Date(value)
      : new Date(Number(value))
    return Number.isNaN(date.getTime()) ? 0 : date.getTime()
  }

  const getDateKey = (value) => {
    if (!value) return ''
    const date = typeof value === 'string' && value.includes('-')
      ? new Date(value)
      : new Date(Number(value))
    if (Number.isNaN(date.getTime())) return ''
    return date.toISOString().slice(0, 10)
  }

  // Aggregate sessions with statistics
  const sessionRecords = useMemo(() => {
    const sessionMap = new Map()
    const processedGameIds = new Set() // Track processed games to avoid duplicates
    const processedSessionIds = new Set() // Track processed sessions to avoid duplicates

    // Seed with all sessions so closed sessions with zero games still show up
    sessions.forEach(session => {
      if (!session?._id || processedSessionIds.has(session._id)) return
      processedSessionIds.add(session._id)
      sessionMap.set(session._id, {
        sessionId: session._id,
        playCount: 0,
        playerIds: new Set(),
        courtIds: new Set(session.courts || []), // Add all courts from the session
        session,
      })
    })

    // Aggregate game data by session (skip games from archived sessions)
    games.forEach(game => {
      // Defensive checks for invalid game data
      if (!game || !game._id) return
      if (processedGameIds.has(game._id)) return
      if (!game.sessionId) return // Skip games with missing sessionId
      if (!sessionMap.has(game.sessionId)) return // Skip games from sessions not in the list
      
      processedGameIds.add(game._id)
      const record = sessionMap.get(game.sessionId)
      
      record.playCount++
      
      // Safely add players
      if (Array.isArray(game.players) && game.players.length > 0) {
        game.players.forEach(p => {
          if (p) record.playerIds.add(p)
        })
      }
    })

    // Convert to array with session details
    return Array.from(sessionMap.values())
      .map(record => {
        const session = record.session
        return {
          ...record,
          session,
          sessionName: session?.name || 'Unknown Session',
          playerCount: record.playerIds.size,
          courtCount: record.courtIds.size,
          startedAt: session?.startedAt,
          endedAt: session?.endedAt
        }
      })
  }, [games, sessions])

  const filteredSessions = useMemo(() => {
    const term = debouncedSearchTerm.trim().toLowerCase()
    const filtered = sessionRecords.filter((record) => {
      const matchesName = term.length === 0
        ? true
        : record.sessionName.toLowerCase().includes(term)
      const matchesDate = dateFilter.length === 0
        ? true
        : getDateKey(record.startedAt) === dateFilter
      return matchesName && matchesDate
    })

    return [...filtered].sort((a, b) => {
      let aValue
      let bValue

      switch (sortColumn) {
        case 'sessionName':
          aValue = a.sessionName || ''
          bValue = b.sessionName || ''
          break
        case 'playCount':
          aValue = Number(a.playCount || 0)
          bValue = Number(b.playCount || 0)
          break
        case 'playerCount':
          aValue = Number(a.playerCount || 0)
          bValue = Number(b.playerCount || 0)
          break
        case 'courtCount':
          aValue = Number(a.courtCount || 0)
          bValue = Number(b.courtCount || 0)
          break
        case 'startedAt':
        default:
          aValue = getDateValue(a.startedAt)
          bValue = getDateValue(b.startedAt)
          break
      }

      if (typeof aValue === 'string' || typeof bValue === 'string') {
        const result = String(aValue).localeCompare(String(bValue), undefined, { sensitivity: 'base' })
        return sortOrder === 'asc' ? result : -result
      }

      const result = Number(aValue) - Number(bValue)
      return sortOrder === 'asc' ? result : -result
    })
  }, [sessionRecords, debouncedSearchTerm, sortOrder, sortColumn, dateFilter])

  const handleHeaderSort = (column) => {
    if (sortColumn === column) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))
      return
    }

    setSortColumn(column)
    setSortOrder(column === 'sessionName' ? 'asc' : 'desc')
  }

  const getSortIndicator = (column) => {
    if (sortColumn !== column) return ''
    return sortOrder === 'asc' ? ' ↑' : ' ↓'
  }

  const visibleSessionIds = useMemo(
    () => filteredSessions.map(record => record.sessionId).filter(Boolean),
    [filteredSessions]
  )
  const sessionRecordIds = useMemo(
    () => sessionRecords.map((record) => record.sessionId).filter(Boolean),
    [sessionRecords]
  )
  const allVisibleSelected = visibleSessionIds.length > 0 && visibleSessionIds.every(id => selectedSessions.includes(id))
  const hasVisibleSelections = visibleSessionIds.some(id => selectedSessions.includes(id))

  useEffect(() => {
    // Only filter out selections if sessions were actually deleted
    setSelectedSessions(prev => {
      const allowedIds = new Set(sessionRecordIds)
      const filtered = prev.filter(id => allowedIds.has(id))
      // Only update state if something actually changed
      return filtered.length === prev.length ? prev : filtered
    })
  }, [sessionRecordIds])


  useEffect(() => {
    if (!selectAllRef.current) return
    selectAllRef.current.indeterminate = hasVisibleSelections && !allVisibleSelected
  }, [hasVisibleSelections, allVisibleSelected])

  const toggleSessionSelection = (sessionId) => {
    if (!sessionId) return
    setSelectedSessions(prev =>
      prev.includes(sessionId)
        ? prev.filter(id => id !== sessionId)
        : [...prev, sessionId]
    )
  }

  const toggleSelectAll = () => {
    if (visibleSessionIds.length === 0) return
    if (allVisibleSelected) {
      setSelectedSessions(prev => prev.filter(id => !visibleSessionIds.includes(id)))
      return
    }
    const merged = new Set([...selectedSessions, ...visibleSessionIds])
    setSelectedSessions(Array.from(merged))
  }

  const handleArchiveSelected = async () => {
    if (selectedSessions.length === 0) return
    setArchivePendingIds([...selectedSessions])
    setShowArchiveConfirm(true)
  }

  const handleConfirmArchiveSelected = async () => {
    if (archivePendingIds.length === 0) {
      setShowArchiveConfirm(false)
      return
    }

    try {
      for (const sessionId of archivePendingIds) {
        const result = await archiveSession({ variables: { id: sessionId } })
        if (!result.data?.archiveSession?.ok) {
          throw new Error(result.data?.archiveSession?.message || 'Failed to archive session')
        }
      }
      setSelectedSessions([])
      setArchivePendingIds([])
      setShowArchiveConfirm(false)
      // Refetch sessions to immediately update the list
      refetchSessions()
    } catch (err) {
      setShowArchiveConfirm(false)
      setArchiveErrorMessage(err.message)
    }
  }

  const formatTimeRange = (startedAt, endedAt) => {
    if (!startedAt) return '—'
    const start = formatDateTime(startedAt)
    const end = endedAt ? formatDateTime(endedAt) : 'Ongoing'
    return `${start} - ${end}`
  }

  if (loading || sessionsLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-slate-300">Loading records...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-red-300">Error loading records: {error.message}</div>
      </div>
    )
  }

  if (sessionRecords.length === 0) {
    return (
      <div className='py-5'>
        <section className="rounded-3xl border border-white/10 bg-white/5 p-4 shadow-xl shadow-black/20">
          <header className="mb-4">
            <h3 className="text-base font-semibold text-white sm:text-lg">Session Records</h3>
            <p className="mt-1 text-xs text-slate-300">
              All session statistics
            </p>
          </header>
          <div className="rounded-2xl border border-white/10 overflow-hidden">
            <div className="px-4 py-6 text-center text-sm text-slate-300">
              No session records yet.
            </div>
          </div>
        </section>
      </div>
    )
  }

  return (
    <div className='py-5'>
      <section className="rounded-3xl border border-white/10 bg-white/5 p-4 shadow-xl shadow-black/20">
      <header className="mb-4 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h3 className="text-base font-semibold text-white sm:text-lg">Session Records</h3>
          <p className="mt-1 text-xs text-slate-300">
            {filteredSessions.length} session{filteredSessions.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <input
            id="records-search"
            name="recordsSearch"
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search session name"
            className="w-56 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-100 placeholder:text-slate-400 focus:border-emerald-400/60 focus:outline-none"
          />
          <input
            id="records-date-filter"
            name="recordsDateFilter"
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-100 focus:border-emerald-400/60 focus:outline-none"
          />
          <select
            id="records-sort-order"
            name="recordsSortOrder"
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-100 focus:border-emerald-400/60 focus:outline-none"
          >
            <option value="desc" className='text-black'>Newest first</option>
            <option value="asc">Oldest first</option>
          </select>
          <button
            onClick={handleArchiveSelected}
            disabled={selectedSessions.length === 0 || archiveLoading}
            className="inline-flex items-center justify-center rounded-lg border border-emerald-300/40 px-3 py-2 text-xs font-semibold text-emerald-200 transition hover:bg-emerald-500/10 hover:border-emerald-200/70 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {archiveLoading ? 'Archiving...' : `Archive Selected${selectedSessions.length ? ` (${selectedSessions.length})` : ''}`}
          </button>
        </div>
      </header>

      <div className="overflow-x-auto rounded-2xl border border-white/10">
        <table className="min-w-full border-collapse text-left text-xs text-slate-200">
          <thead className="bg-white/5 text-[10px] uppercase tracking-[0.3em] text-slate-400">
            <tr>
              <th className="px-3 py-3 w-12">
                <div className="flex items-center justify-center">
                  <input
                    id="records-select-all"
                    name="recordsSelectAll"
                    ref={selectAllRef}
                    type="checkbox"
                    checked={allVisibleSelected && visibleSessionIds.length > 0}
                    onChange={toggleSelectAll}
                    className="h-4 w-4 rounded border-white/30 bg-transparent text-emerald-400 focus:ring-emerald-500/40"
                  />
                </div>
              </th>
              <th className="px-3 py-3">
                <button type="button" onClick={() => handleHeaderSort('sessionName')} className="font-semibold text-slate-400 hover:text-white">
                  Session Name{getSortIndicator('sessionName')}
                </button>
              </th>
              <th className="hidden sm:table-cell px-3 py-3">
                <button type="button" onClick={() => handleHeaderSort('playCount')} className="font-semibold text-slate-400 hover:text-white">
                  Play Count{getSortIndicator('playCount')}
                </button>
              </th>
              <th className="hidden sm:table-cell px-3 py-3">
                <button type="button" onClick={() => handleHeaderSort('playerCount')} className="font-semibold text-slate-400 hover:text-white">
                  Players{getSortIndicator('playerCount')}
                </button>
              </th>
              <th className="hidden sm:table-cell px-3 py-3">
                <button type="button" onClick={() => handleHeaderSort('courtCount')} className="font-semibold text-slate-400 hover:text-white">
                  Courts{getSortIndicator('courtCount')}
                </button>
              </th>
              <th className="hidden md:table-cell px-3 py-3">
                <button type="button" onClick={() => handleHeaderSort('startedAt')} className="font-semibold text-slate-400 hover:text-white">
                  Duration{getSortIndicator('startedAt')}
                </button>
              </th>
              <th className="px-3 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {filteredSessions.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-12 text-center align-middle text-xs text-slate-300">
                  No sessions found.
                </td>
              </tr>
            ) : (
              filteredSessions.map((record) => (
                <React.Fragment key={record.sessionId}>
                  <tr
                    className={`transition ${selectedSessions.includes(record.sessionId) ? 'bg-white/10' : 'hover:bg-white/5'}`}
                  >
                    <td className="px-3 py-3">
                      <div className="flex items-center justify-center">
                        <input
                          id={`records-select-${record.sessionId}`}
                          name="recordsSelectedSessions"
                          type="checkbox"
                          checked={selectedSessions.includes(record.sessionId)}
                          onChange={() => toggleSessionSelection(record.sessionId)}
                          className="h-4 w-4 rounded border-white/30 bg-transparent text-emerald-400 focus:ring-emerald-500/40"
                        />
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <button
                        type="button"
                        onClick={() => setExpandedRecordId((prev) => (prev === record.sessionId ? null : record.sessionId))}
                        className="flex w-full items-center justify-between gap-2 text-left"
                      >
                        <span className="font-semibold text-white text-xs">{record.sessionName}</span>
                        <span className="text-slate-400 sm:hidden">{expandedRecordId === record.sessionId ? '▼' : '▶'}</span>
                      </button>
                    </td>
                    <td className="hidden sm:table-cell px-3 py-3">
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-200">
                        {record.playCount} {record.playCount === 1 ? 'match' : 'matches'}
                      </span>
                    </td>
                    <td className="hidden sm:table-cell px-3 py-3">
                      <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/20 px-2 py-0.5 text-[10px] font-semibold text-blue-200">
                        {record.playerCount} {record.playerCount === 1 ? 'player' : 'players'}
                      </span>
                    </td>
                    <td className="hidden sm:table-cell px-3 py-3">
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-semibold text-amber-200">
                        {record.courtCount} {record.courtCount === 1 ? 'court' : 'courts'}
                      </span>
                    </td>
                    <td className="hidden md:table-cell px-3 py-3 text-xs text-slate-300">
                      {formatTimeRange(record.startedAt, record.endedAt)}
                    </td>
                    <td className="px-3 py-3">
                      <button
                        onClick={() => setViewingSessionId(record.sessionId)}
                        className="inline-flex items-center justify-center rounded-full border border-slate-300/40 px-3 py-1 text-xs font-semibold text-slate-200 transition hover:bg-slate-500/10 hover:border-slate-200/70"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                  {expandedRecordId === record.sessionId && (
                    <tr className="bg-slate-800/30 sm:hidden">
                      <td colSpan={3} className="px-3 py-3">
                        <div className="space-y-2 text-xs">
                          <div className="flex justify-between border-b border-white/10 pb-2">
                            <span className="text-slate-400">Play Count:</span>
                            <span className="text-white">{record.playCount}</span>
                          </div>
                          <div className="flex justify-between border-b border-white/10 pb-2">
                            <span className="text-slate-400">Players:</span>
                            <span className="text-white">{record.playerCount}</span>
                          </div>
                          <div className="flex justify-between border-b border-white/10 pb-2">
                            <span className="text-slate-400">Courts:</span>
                            <span className="text-white">{record.courtCount}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">Duration:</span>
                            <span className="text-white">{formatTimeRange(record.startedAt, record.endedAt)}</span>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>

    {/* Session Detail Modal */}
    {viewingSessionId && (
      <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 p-3 sm:flex sm:items-center sm:justify-center sm:p-8">
        <div className="relative my-4 w-full max-w-4xl rounded-lg bg-slate-900 shadow-2xl sm:my-auto max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-h-[calc(100vh-4rem)]">
          <button
            onClick={() => setViewingSessionId(null)}
            className="absolute top-4 right-4 z-10 rounded-full bg-slate-800 hover:bg-slate-700 p-2 transition"
          >
            <svg className="h-6 w-6 text-slate-100" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <div className="p-6">
            <SessionRecordDetail 
              sessionId={viewingSessionId}
              onClose={() => setViewingSessionId(null)}
            />
          </div>
        </div>
      </div>
    )}

    {showArchiveConfirm && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="relative w-full max-w-md rounded-lg bg-slate-900 p-6 shadow-2xl">
          <button
            onClick={() => {
              setShowArchiveConfirm(false)
              setArchivePendingIds([])
            }}
            className="absolute right-4 top-4 rounded-full bg-slate-800 p-2 transition hover:bg-slate-700"
          >
            <svg className="h-5 w-5 text-slate-100" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          <h2 className="mb-4 text-xl font-bold text-white">Archive Session Records?</h2>
          <p className="mb-6 text-sm text-slate-300">
            Archive {archivePendingIds.length} session{archivePendingIds.length === 1 ? '' : 's'}? You can still access archived records later.
          </p>

          <div className="flex gap-3">
            <button
              onClick={() => {
                setShowArchiveConfirm(false)
                setArchivePendingIds([])
              }}
              className="flex-1 rounded-lg border border-slate-500 px-4 py-2 font-semibold text-slate-200 transition hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirmArchiveSelected}
              disabled={archiveLoading}
              className="flex-1 rounded-lg bg-emerald-500/30 px-4 py-2 font-semibold text-emerald-100 transition hover:bg-emerald-500/40 disabled:opacity-50"
            >
              {archiveLoading ? 'Archiving...' : 'Archive'}
            </button>
          </div>
        </div>
      </div>
    )}

    {archiveErrorMessage && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="relative w-full max-w-md rounded-lg bg-slate-900 p-6 shadow-2xl">
          <button
            onClick={() => setArchiveErrorMessage('')}
            className="absolute right-4 top-4 rounded-full bg-slate-800 p-2 transition hover:bg-slate-700"
          >
            <svg className="h-5 w-5 text-slate-100" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          <h2 className="mb-4 text-xl font-bold text-white">Archive Failed</h2>
          <p className="mb-6 text-sm text-slate-300">{archiveErrorMessage}</p>

          <button
            onClick={() => setArchiveErrorMessage('')}
            className="w-full rounded-lg bg-slate-800 px-4 py-2 font-semibold text-slate-200 transition hover:bg-slate-700"
          >
            OK
          </button>
        </div>
      </div>
    )}
    </div>
  )
}

export default RecordsPage
