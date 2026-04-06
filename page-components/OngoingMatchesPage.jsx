'use client';

import React, { useMemo, useState } from 'react'
import { gql } from '@apollo/client'
import { useQuery } from '@apollo/client/react'
import OngoingMatchesTable from '@/components/OngoingMatchesTable'
import QueuedMatchesTable from '@/components/QueuedMatchesTable'
import SessionMatchRecordModal from '@/components/SessionMatchRecordModal'

const GAMES_BY_SESSION_QUERY = gql`
  query GamesBySession($sessionId: ID!) {
    gamesBySession(sessionId: $sessionId) {
      _id
    }
  }
`

const GAMES_BY_SESSION_IDS_QUERY = gql`
  query GamesBySessionIds($sessionIds: [ID!]!) {
    gamesBySessionIds(sessionIds: $sessionIds) {
      _id
      sessionId
    }
  }
`

const OngoingMatchesPage = ({
  ongoingMatches,
  matchQueue,
  sessions,
  players,
  courts,
  onUpdateMatch,
  onEndMatch,
  onCreateMatch,
  onStartMatch,
  onEditMatch,
  onCancelMatch,
  filteredSessionId,
  onClearFilter,
  onFilterSessionChange,
}) => {
  const [sessionFilterId, setSessionFilterId] = useState(filteredSessionId || '')
  const [recordSessionId, setRecordSessionId] = useState(null)

  const effectiveSessionFilterId = filteredSessionId ?? sessionFilterId

  const openSessions = useMemo(
    () => sessions.filter((session) => session.status !== 'CLOSED' && !session.isArchived),
    [sessions]
  )
  const openSessionIds = useMemo(() => openSessions.map((session) => session._id), [openSessions])

  const activeFilterSessionId = effectiveSessionFilterId || null
  const { data: sessionGamesData, loading: sessionGamesLoading } = useQuery(GAMES_BY_SESSION_QUERY, {
    variables: { sessionId: activeFilterSessionId },
    skip: !activeFilterSessionId,
    fetchPolicy: 'cache-and-network',
  })
  const { data: allGamesData, loading: allGamesLoading } = useQuery(GAMES_BY_SESSION_IDS_QUERY, {
    variables: { sessionIds: openSessionIds },
    skip: !!activeFilterSessionId || openSessionIds.length === 0,
    fetchPolicy: 'cache-and-network',
  })
  const matchRecordCount = activeFilterSessionId
    ? (sessionGamesData?.gamesBySession?.length || 0)
    : (allGamesData?.gamesBySessionIds?.length || 0)
  const isMatchRecordLoading = activeFilterSessionId ? sessionGamesLoading : allGamesLoading

  // Filter matches by session if a filter is active
  const filteredOngoingMatches = activeFilterSessionId
    ? { [activeFilterSessionId]: ongoingMatches[activeFilterSessionId] || [] }
    : ongoingMatches

  const filteredMatchQueue = activeFilterSessionId
    ? { [activeFilterSessionId]: matchQueue[activeFilterSessionId] || [] }
    : matchQueue

  const filteredSession = activeFilterSessionId
    ? sessions.find(s => s._id === activeFilterSessionId)
    : null

  const handleClearAllSessionFilters = () => {
    setSessionFilterId('')
    if (onFilterSessionChange) {
      onFilterSessionChange(null)
    }
    if (onClearFilter) {
      onClearFilter()
    }
  }

  const handleSessionFilterChange = (value) => {
    setSessionFilterId(value)
    if (onFilterSessionChange) {
      onFilterSessionChange(value || null)
    }
  }

  const handleOpenMatchRecord = () => {
    if (activeFilterSessionId) {
      setRecordSessionId(activeFilterSessionId)
      return
    }

    if (openSessionIds.length > 0) {
      setRecordSessionId('__ALL__')
    }
  }

  return (
    <div className="space-y-6 py-5">
      <div className="flex items-center gap-3 border-b border-white/10 pb-4 mb-6">
        <span className="text-sm text-slate-400">Filter:</span>
        <select
          id="ongoing-session-filter"
          name="ongoingSessionFilter"
          value={effectiveSessionFilterId}
          onChange={(e) => handleSessionFilterChange(e.target.value)}
          className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white focus:border-white/30 focus:outline-none"
        >
          <option value="" className='text-black'>All Sessions</option>
          {openSessions.map((session) => (
            <option className='text-black' key={session._id} value={session._id}>
              {session.name}
            </option>
          ))}
        </select>
        {activeFilterSessionId && filteredSession && (
          <span className="inline-flex items-center gap-2 rounded-full bg-emerald-500/20 px-3 py-1 text-xs">
            <span className="text-emerald-200">{filteredSession.name}</span>
            <button
              onClick={handleClearAllSessionFilters}
              className="text-emerald-300 hover:text-emerald-100 transition"
            >
              ✕
            </button>
          </span>
        )}
        <button
          type="button"
          onClick={handleOpenMatchRecord}
          disabled={openSessionIds.length === 0}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-500/20 px-3 py-1.5 text-xs font-semibold text-blue-200 transition hover:bg-blue-500/30 disabled:cursor-not-allowed disabled:opacity-40"
          title={openSessionIds.length > 0 ? 'Open match histpry' : 'No open sessions available'}
        >
          <span>Match History</span>
          <span className="rounded-full bg-blue-500/30 px-2 py-0.5 text-[10px] text-blue-100">
            {isMatchRecordLoading ? '...' : matchRecordCount}
          </span>
        </button>
      </div>

      <OngoingMatchesTable
        key={`ongoing-${activeFilterSessionId || 'all'}`}
        ongoingMatches={filteredOngoingMatches}
        sessions={sessions}
        players={players}
        courts={courts}
        onUpdateMatch={onUpdateMatch}
        onEndMatch={onEndMatch}
        onCreateMatch={onCreateMatch}
        onStartMatch={onStartMatch}
        paginationResetKey={activeFilterSessionId || 'all'}
      />

      <QueuedMatchesTable
        matchQueue={filteredMatchQueue}
        sessions={sessions}
        players={players}
        courts={courts}
        onEditMatch={onEditMatch}
        onCancelMatch={onCancelMatch}
        paginationResetKey={activeFilterSessionId || 'all'}
      />

      {recordSessionId && (
        <SessionMatchRecordModal
          sessionId={recordSessionId === '__ALL__' ? null : recordSessionId}
          sessionIds={recordSessionId === '__ALL__' ? openSessionIds : []}
          sessions={sessions}
          sessionName={filteredSession?.name}
          players={players}
          courts={courts}
          onClose={() => setRecordSessionId(null)}
        />
      )}
    </div>
  )
}

export default OngoingMatchesPage
