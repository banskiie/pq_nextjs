'use client';

import React, { useEffect, useMemo, useState } from 'react'
import { gql } from '@apollo/client'
import { useQuery } from '@apollo/client/react'
import StatusBadge from './StatusBadge'

const GAMES_BY_SESSION_IDS_QUERY = gql`
  query GamesBySessionIds($sessionIds: [ID!]!) {
    gamesBySessionIds(sessionIds: $sessionIds) {
      _id
      sessionId
      players
    }
  }
`

const formatDateTime = (value) => {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString()
}

const getOngoingMatchCount = (sessionId, ongoingMatches) => {
  if (!ongoingMatches || !ongoingMatches[sessionId]) return 0
  const matches = ongoingMatches[sessionId]
  return Array.isArray(matches) ? matches.length : 0
}

const getSessionRevenue = (session, playerParticipationsBySession) => {
  const pricePerGame = Number(session?.price || 0)
  const paidParticipations = Number(playerParticipationsBySession?.get(session?._id) || 0)
  return paidParticipations * pricePerGame
}

const formatCurrency = (amount) => {
  const value = Number(amount || 0)
  return `P${value.toLocaleString('en-US', { maximumFractionDigits: 2 })}`
}

const SessionTable = ({ sessions, ongoingMatches, isLoading, error, onViewSession, onEditSession, onEndSession, onCreateSession, onNavigateToMatches }) => {
  const [currentPage, setCurrentPage] = useState(1)
  const [expandedSessionId, setExpandedSessionId] = useState(null)
  const itemsPerPage = 4
  const sessionIds = sessions.map((session) => session._id).filter(Boolean)
  const { data: gamesData } = useQuery(GAMES_BY_SESSION_IDS_QUERY, {
    variables: { sessionIds },
    skip: sessionIds.length === 0,
    fetchPolicy: 'network-only',
  })

  const playerParticipationsBySession = (gamesData?.gamesBySessionIds || []).reduce((map, game) => {
    const key = game?.sessionId
    if (!key) return map
    const playerCount = Array.isArray(game?.players) ? game.players.length : 0
    map.set(key, (map.get(key) || 0) + playerCount)
    return map
  }, new Map())

  const canEnd = (session) => session.status === 'OPEN'

  // Pagination calculations
  const totalPages = Math.max(1, Math.ceil(sessions.length / itemsPerPage))
  const clampedPage = Math.min(currentPage, totalPages)
  const startIndex = (clampedPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedSessions = sessions.slice(startIndex, endIndex)

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages)
    }
  }, [currentPage, totalPages])

  const handleNextPage = () => {
    if (clampedPage < totalPages) {
      setCurrentPage(clampedPage + 1)
    }
  }

  const handlePreviousPage = () => {
    if (clampedPage > 1) {
      setCurrentPage(clampedPage - 1)
    }
  }

  const visiblePages = useMemo(() => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, index) => index + 1)
    }

    const pages = [1]
    const start = Math.max(2, clampedPage - 1)
    const end = Math.min(totalPages - 1, clampedPage + 1)

    if (start > 2) pages.push('ellipsis-left')
    for (let page = start; page <= end; page += 1) pages.push(page)
    if (end < totalPages - 1) pages.push('ellipsis-right')
    pages.push(totalPages)

    return pages
  }, [clampedPage, totalPages])
  return (
    <section className="rounded-3xl border border-white/10 bg-white/5 p-4 shadow-xl shadow-black/20">
      <header className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-white sm:text-base">Current sessions</h2>
          <p className="text-xs text-slate-300">
            Live queue overview for courts and active sessions.
          </p>
        </div>
        <button
          onClick={onCreateSession}
          className="inline-flex items-center justify-center self-start rounded-full bg-emerald-500/20 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-200 transition hover:bg-emerald-500/30 md:self-auto"
        >
          + Create Session
        </button>
      </header>

      <div className="mt-2 overflow-x-auto rounded-2xl border border-white/10">
        <table className="min-w-full border-collapse text-left text-xs text-slate-200">
          <thead className="bg-white/5 text-[9px] uppercase tracking-[0.2em] text-slate-400">
            <tr>
              <th className="px-3 py-2">Session</th>
              <th className="hidden sm:table-cell px-3 py-2">Status</th>
              <th className="hidden sm:table-cell px-3 py-2">Courts</th>
              <th className="hidden sm:table-cell px-3 py-2">Players</th>
              <th className="hidden md:table-cell px-3 py-2">Games</th>
              <th className="hidden sm:table-cell px-3 py-2">Revenue</th>
              <th className="hidden md:table-cell px-3 py-2">Started</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {isLoading ? (
              <tr>
                <td colSpan="8" className="px-3 py-3 text-center text-xs text-slate-300">
                  Loading sessions...
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan="8" className="px-3 py-3 text-center text-xs text-rose-200">
                  <div className="space-y-3">
                    <p>{error}</p>
                  </div>
                </td>
              </tr>
            ) : sessions.length === 0 ? (
              <tr>
                <td colSpan="8" className="px-3 py-3 text-center text-xs text-slate-300">
                  No sessions yet.
                </td>
              </tr>
            ) : (
              paginatedSessions.map((session) => (
                <React.Fragment key={session._id}>
                  <tr className="transition hover:bg-white/5">
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0 flex items-center gap-2">
                          <button
                            onClick={() => onNavigateToMatches(session)}
                            className="truncate text-sm font-semibold text-emerald-300 hover:text-emerald-200 hover:underline transition text-left"
                          >
                            {session.name}
                          </button>
                          <span className="sm:hidden">
                            <StatusBadge status={session.status} />
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setExpandedSessionId((prev) => (prev === session._id ? null : session._id))}
                          className="text-slate-400 sm:hidden"
                        >
                          {expandedSessionId === session._id ? '▼' : '▶'}
                        </button>
                      </div>
                    </td>
                    <td className="hidden sm:table-cell px-3 py-2">
                      <StatusBadge status={session.status} />
                    </td>
                    <td className="hidden sm:table-cell px-3 py-2">{session.courts?.length ?? 0}</td>
                    <td className="hidden sm:table-cell px-3 py-2">{session.players?.length ?? 0}</td>
                    <td className="hidden md:table-cell px-3 py-2">{getOngoingMatchCount(session._id, ongoingMatches)}</td>
                    <td className="hidden sm:table-cell px-3 py-2">
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-200">
                        {formatCurrency(getSessionRevenue(session, playerParticipationsBySession))}
                      </span>
                    </td>
                    <td className="hidden md:table-cell px-3 py-2 text-xs">{formatDateTime(session.startedAt)}</td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-1">
                        <button
                          onClick={() => onViewSession(session)}
                          className="inline-flex items-center justify-center rounded-full border border-slate-300/40 px-2 py-0.5 text-[11px] font-semibold text-slate-200 transition hover:bg-slate-500/10 hover:border-slate-200/70"
                        >
                          View
                        </button>
                        <button
                          onClick={() => onEditSession(session)}
                          className="inline-flex items-center justify-center rounded-full border border-blue-300/40 px-2 py-0.5 text-[11px] font-semibold text-blue-200 transition hover:bg-blue-500/10 hover:border-blue-200/70"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => onEndSession(session)}
                          disabled={!canEnd(session)}
                          className="inline-flex items-center justify-center rounded-full border border-rose-300/40 px-2 py-0.5 text-[11px] font-semibold text-rose-200 transition hover:bg-rose-500/10 hover:border-rose-200/70 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          End Session
                        </button>
                      </div>
                    </td>
                  </tr>
                  {expandedSessionId === session._id && (
                    <tr className="bg-slate-800/30 sm:hidden">
                      <td colSpan={2} className="px-3 py-3">
                        <div className="space-y-2 text-xs">
                          <div className="flex justify-between border-b border-white/10 pb-2">
                            <span className="text-slate-400">Courts:</span>
                            <span className="text-white">{session.courts?.length ?? 0}</span>
                          </div>
                          <div className="flex justify-between border-b border-white/10 pb-2">
                            <span className="text-slate-400">Players:</span>
                            <span className="text-white">{session.players?.length ?? 0}</span>
                          </div>
                          <div className="flex justify-between border-b border-white/10 pb-2">
                            <span className="text-slate-400">Games:</span>
                            <span className="text-white">{getOngoingMatchCount(session._id, ongoingMatches)}</span>
                          </div>
                          <div className="flex justify-between border-b border-white/10 pb-2">
                            <span className="text-slate-400">Revenue:</span>
                            <span className="text-emerald-200">{formatCurrency(getSessionRevenue(session, playerParticipationsBySession))}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">Started:</span>
                            <span className="text-white">{formatDateTime(session.startedAt)}</span>
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

      {sessions.length > 0 && (
        <div className="mt-3 flex items-center justify-between">
          <span className="text-xs text-slate-400">
            Page {clampedPage} of {totalPages}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePreviousPage}
              disabled={clampedPage === 1}
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

                const isActive = item === clampedPage
                return (
                  <button
                    key={`session-page-${item}`}
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
              onClick={handleNextPage}
              disabled={clampedPage === totalPages}
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

export default SessionTable
