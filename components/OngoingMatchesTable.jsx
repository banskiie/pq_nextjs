'use client';

import React, { useCallback, useMemo, useState } from 'react'

const formatDateTime = (value) => {
  if (!value) return '—'
  const date = new Date(Number(value)) // Convert string timestamp to number
  if (Number.isNaN(date.getTime())) return '—'
  
  // Format: "Feb 26, 3:45 PM"
  const options = {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  }
  return date.toLocaleString('en-US', options)
}

const OngoingMatchesTable = ({ ongoingMatches, sessions, players, courts, onUpdateMatch, onEndMatch, onCreateMatch, onStartMatch }) => {
  const [currentPage, setCurrentPage] = useState(1)
  const [expandedMatchId, setExpandedMatchId] = useState(null)
  const [sortColumn, setSortColumn] = useState(null)
  const [sortDirection, setSortDirection] = useState('asc')
  const matchesPerPage = 4
  // Flatten ongoingMatches by sessionId
  const flattenedMatches = useMemo(() => {
    const matches = []
    
    Object.entries(ongoingMatches).forEach(([sessionId, sessionMatches]) => {
      const session = sessions.find(s => s._id === sessionId)
      sessionMatches.forEach((match) => {
        matches.push({
          ...match,
          sessionId,
          sessionName: session?.name || 'Unknown',
        })
      })
    })
    
    return matches
  }, [ongoingMatches, sessions])

  const totalPages = Math.max(1, Math.ceil(flattenedMatches.length / matchesPerPage))
  const displayPage = Math.min(currentPage, totalPages)

  const getCourtName = useCallback((courtId) => {
    return courts?.find(c => c._id === courtId)?.name || 'Unknown Court'
  }, [courts])

  const getSortValue = useCallback((match, column) => {
    if (column === 'session') return (match.sessionName || '').toLowerCase()
    if (column === 'court') return (getCourtName(match.courtId) || '').toLowerCase()
    if (column === 'players') {
      const names = (match.playerIds || [])
        .map((playerId) => players?.find((player) => player._id === playerId)?.name || 'Unknown')
        .join(' ')
      return names.toLowerCase()
    }
    if (column === 'format') return match.playerIds?.length === 2 ? 1 : 2
    if (column === 'started') return Number(match.startedAt || match.createdAt || 0)
    return ''
  }, [getCourtName, players])

  const sortedMatches = useMemo(() => {
    if (!sortColumn) return flattenedMatches

    const sorted = [...flattenedMatches].sort((a, b) => {
      const aValue = getSortValue(a, sortColumn)
      const bValue = getSortValue(b, sortColumn)

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1
      return 0
    })

    return sorted
  }, [flattenedMatches, getSortValue, sortColumn, sortDirection])

  const handleSort = (column) => {
    setCurrentPage(1)
    if (sortColumn === column) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))
      return
    }

    setSortColumn(column)
    setSortDirection('asc')
  }

  const getSortIndicator = (column) => {
    if (sortColumn !== column) return '↕'
    return sortDirection === 'asc' ? '↑' : '↓'
  }

  const paginatedMatches = useMemo(() => {
    const startIndex = (displayPage - 1) * matchesPerPage
    return sortedMatches.slice(startIndex, startIndex + matchesPerPage)
  }, [displayPage, sortedMatches])

  const visiblePages = useMemo(() => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, index) => index + 1)
    }

    const pages = [1]
    const start = Math.max(2, displayPage - 1)
    const end = Math.min(totalPages - 1, displayPage + 1)

    if (start > 2) pages.push('ellipsis-left')
    for (let page = start; page <= end; page += 1) pages.push(page)
    if (end < totalPages - 1) pages.push('ellipsis-right')
    pages.push(totalPages)

    return pages
  }, [displayPage, totalPages])

  function getPlayerNames(playerIds) {
    const names = playerIds.map(pId => players?.find(p => p._id === pId)?.name || 'Unknown')
    
    // For 2v2, return JSX with highlighted teams
    if (names.length === 4) {
      return (
        <div className="flex items-center gap-2">
          <span className="uppercase inline-flex items-center gap-1 rounded-full bg-blue-500/20 px-2 py-0.5 text-[10px] font-semibold text-blue-200">
            {names[0]} & {names[1]}
          </span>
          <span className="text-slate-400">vs</span>
          <span className="uppercase inline-flex items-center gap-1 rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-semibold text-amber-200">
            {names[2]} & {names[3]}
          </span>
        </div>
      )
    }
    
    // For 1v1, return JSX with highlighted teams
    if (names.length === 2) {
      return (
        <div className="flex items-center gap-2">
          <span className="uppercase inline-flex items-center gap-1 rounded-full bg-blue-500/20 px-2 py-0.5 text-[10px] font-semibold text-blue-200">
            {names[0]}
          </span>
          <span className="text-slate-400">vs</span>
          <span className="uppercase inline-flex items-center gap-1 rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-semibold text-amber-200">
            {names[1]}
          </span>
        </div>
      )
    }
    
    // Fallback
    return names.join(' vs ')
  }

  function getFormat(playerIds) {
    return playerIds.length === 2 ? '1v1 (Singles)' : '2v2 (Doubles)'
  }

  if (flattenedMatches.length === 0) {
    return (
      <section className="rounded-3xl border border-white/10 bg-white/5 p-4 shadow-xl shadow-black/20">
        <header className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-white sm:text-lg">Ongoing Matches</h3>
            <p className="mt-1 text-xs text-slate-300">
              Matches currently in progress.
            </p>
          </div>
          <div className="flex gap-2">
            {onCreateMatch && (
              <button
                onClick={onCreateMatch}
                className="rounded-lg bg-emerald-500/20 px-4 py-2 text-xs font-semibold text-emerald-200 transition hover:bg-emerald-500/30"
              >
                + Create Match
              </button>
            )}
          </div>
        </header>
        <div className="rounded-2xl border border-white/10 overflow-hidden">
          <div className="px-4 py-6 text-center text-sm text-slate-300">
            No ongoing matches.
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="rounded-3xl border border-white/10 bg-white/5 p-4 shadow-xl shadow-black/20">
      <header className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-white sm:text-lg">Ongoing Matches</h3>
          <p className="mt-1 text-xs text-slate-300">
            {flattenedMatches.length} match{flattenedMatches.length !== 1 ? 'es' : ''} currently in progress.
          </p>
        </div>
        <div className="flex gap-2">
          {onCreateMatch && (
            <button
              onClick={onCreateMatch}
              className="rounded-lg bg-emerald-500/20 px-4 py-2 text-xs font-semibold text-emerald-200 transition hover:bg-emerald-500/30"
            >
              + Create Match
            </button>
          )}
        </div>
      </header>

      <div className="overflow-x-auto rounded-2xl border border-white/10">
        <table className="min-w-full border-collapse text-left text-xs text-slate-200">
          <thead className="bg-white/5 text-[10px] uppercase tracking-[0.3em] text-slate-400">
            <tr>
              <th className="px-3 py-3">
                <button type="button" onClick={() => handleSort('session')} className="flex items-center gap-1 hover:text-white">
                  Session <span>{getSortIndicator('session')}</span>
                </button>
              </th>
              <th className="hidden sm:table-cell px-3 py-3">
                <button type="button" onClick={() => handleSort('court')} className="flex items-center gap-1 hover:text-white">
                  Court <span>{getSortIndicator('court')}</span>
                </button>
              </th>
              <th className="hidden md:table-cell px-3 py-3">
                <button type="button" onClick={() => handleSort('players')} className="flex items-center gap-1 hover:text-white">
                  Players <span>{getSortIndicator('players')}</span>
                </button>
              </th>
              <th className="hidden sm:table-cell px-3 py-3">
                <button type="button" onClick={() => handleSort('format')} className="flex items-center gap-1 hover:text-white">
                  Format <span>{getSortIndicator('format')}</span>
                </button>
              </th>
              <th className="hidden sm:table-cell px-3 py-3">
                <button type="button" onClick={() => handleSort('started')} className="flex items-center gap-1 hover:text-white">
                  Started <span>{getSortIndicator('started')}</span>
                </button>
              </th>
              <th className="px-3 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {paginatedMatches.map((match) => (
              <React.Fragment key={`${match.sessionId}-${match._id}`}>
                <tr className="transition hover:bg-white/5">
                  <td className="px-3 py-3">
                    <button
                      type="button"
                      onClick={() => setExpandedMatchId((prev) => (prev === match._id ? null : match._id))}
                      className="flex w-full items-center justify-between gap-2 text-left"
                    >
                      <span className="font-semibold text-white text-xs">{match.sessionName}</span>
                      <span className="text-slate-400 sm:hidden">{expandedMatchId === match._id ? '▼' : '▶'}</span>
                    </button>
                    <div className="mt-1 text-[11px] text-slate-400 sm:hidden">
                      {getCourtName(match.courtId)}
                    </div>
                  </td>
                  <td className="hidden sm:table-cell px-3 py-3 text-xs">{getCourtName(match.courtId)}</td>
                  <td className="hidden md:table-cell px-3 py-3 text-xs">{getPlayerNames(match.playerIds)}</td>
                  <td className="hidden sm:table-cell px-3 py-3">
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-500/20 px-2 py-0.5 text-[10px] font-semibold text-slate-200">
                      {getFormat(match.playerIds)}
                    </span>
                  </td>
                  <td className="hidden sm:table-cell px-3 py-3 text-xs text-slate-300">
                    {match.queued ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-yellow-500/20 px-2 py-0.5 text-[10px] font-semibold text-yellow-200">
                        Ready to start
                      </span>
                    ) : (
                      formatDateTime(match.startedAt)
                    )}
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                      {onStartMatch && (
                        <button
                          onClick={() => onStartMatch(match)}
                          disabled={!match.queued}
                          className="rounded-lg bg-emerald-500/20 px-3 py-1.5 text-xs font-semibold text-emerald-200 transition hover:bg-emerald-500/30 hover:text-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
                          title={match.queued ? "Start match" : "Match already started"}
                        >
                          Started
                        </button>
                      )}
                      <button
                        onClick={() => onUpdateMatch && onUpdateMatch(match)}
                        className="rounded-lg bg-blue-500/20 px-3 py-1.5 text-xs font-semibold text-blue-200 transition hover:bg-blue-500/30 hover:text-blue-100"
                        title="Edit match"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => onEndMatch && onEndMatch(match)}
                        disabled={match.queued}
                        className="rounded-lg bg-red-500/20 px-3 py-1.5 text-xs font-semibold text-red-200 transition hover:bg-red-500/30 hover:text-red-100"
                        title={match.queued ? 'Start the match first before ending it' : 'End match'}
                      >
                        End Match
                      </button>
                    </div>
                  </td>
                </tr>
                {expandedMatchId === match._id && (
                  <tr className="bg-slate-800/30 sm:hidden">
                    <td colSpan={2} className="px-3 py-3">
                      <div className="space-y-2 text-xs">
                        <div className="flex justify-between border-b border-white/10 pb-2">
                          <span className="text-slate-400">Players:</span>
                          <span className="text-white">{(match.playerIds || []).map((playerId) => players?.find((player) => player._id === playerId)?.name || 'Unknown').join(' vs ')}</span>
                        </div>
                        <div className="flex justify-between border-b border-white/10 pb-2">
                          <span className="text-slate-400">Format:</span>
                          <span className="text-white">{getFormat(match.playerIds)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Started:</span>
                          <span className="text-white">{match.queued ? 'Ready to start' : formatDateTime(match.startedAt)}</span>
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

      {flattenedMatches.length > matchesPerPage && (
        <div className="mt-3 flex items-center justify-between">
          <span className="text-xs text-slate-400">
            Page {displayPage} of {totalPages}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(Math.max(displayPage - 1, 1))}
              disabled={displayPage === 1}
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

                const isActive = item === displayPage
                return (
                  <button
                    key={`ongoing-page-${item}`}
                    onClick={() => setCurrentPage(item)}
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
              onClick={() => setCurrentPage(Math.min(displayPage + 1, totalPages))}
              disabled={displayPage === totalPages}
              className="rounded-full border border-slate-300/40 px-3 py-1 text-xs font-semibold text-slate-200 transition hover:bg-slate-500/10 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </section>
  )
}

export default OngoingMatchesTable
