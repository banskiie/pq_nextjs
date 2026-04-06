'use client';

import React, { useMemo } from 'react'

const STATUS_ORDER = ['OPEN', 'TRANSFERRING']

const STATUS_LABELS = {
  OPEN: 'Open Sessions',
  TRANSFERRING: 'Ongoing Matches',
}

const SessionStats = ({ sessions, ongoingMatches, matchQueue, players, courts }) => {
  const counts = useMemo(() => {
    return sessions.reduce(
      (acc, session) => {
        acc.total += 1
        const status = session.status ?? 'UNKNOWN'
        acc.byStatus[status] = (acc.byStatus[status] ?? 0) + 1
        return acc
      },
      { total: 0, byStatus: {} },
    )
  }, [sessions])

  const totalOngoingMatches = useMemo(() => {
    if (!ongoingMatches) return 0
    return Object.values(ongoingMatches).reduce((total, matches) => total + (Array.isArray(matches) ? matches.length : 0), 0)
  }, [ongoingMatches])

  const totalQueuedMatches = useMemo(() => {
    if (!matchQueue) return 0
    return Object.values(matchQueue).reduce((total, matches) => total + (Array.isArray(matches) ? matches.length : 0), 0)
  }, [matchQueue])

  const totalPlayers = players?.length ?? 0

  const availableCourts = useMemo(() => {
    if (!courts || !ongoingMatches) return 0
    const busyCourtIds = new Set()
    Object.values(ongoingMatches).forEach(matches => {
      if (Array.isArray(matches)) {
        matches.forEach(match => {
          if (match.courtId) {
            busyCourtIds.add(match.courtId)
          }
        })
      }
    })
    return courts.length - busyCourtIds.size
  }, [courts, ongoingMatches])

  return (
    <section className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
      <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 p-3 shadow-lg shadow-black/10">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-200/70">
            Total sessions
          </p>
          <p className="mt-1 text-xl font-semibold text-white">{counts.total}</p>
        </div>
        
      </div>
      <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 p-3 shadow-lg shadow-black/10">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-indigo-200/70">
            Total players
          </p>
          <p className="mt-1 text-xl font-semibold text-white">{totalPlayers}</p>
        </div>
        
      </div>
      <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 p-3 shadow-lg shadow-black/10">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-amber-200/70">
            Available courts
          </p>
          <p className="mt-1 text-xl font-semibold text-white">{availableCourts}</p>
        </div>
        
      </div>
      {STATUS_ORDER.map((status) => {

        if (status === 'TRANSFERRING') {
          return (
            <div
              key={status}
              className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3"
            >
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                  Ongoing Matches
                </p>
                <p className="mt-1 text-xl font-semibold text-white">
                  {totalOngoingMatches}
                </p>
              </div>
            </div>
          )
        }
        return (
          <div
            key={status}
            className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3"
          >
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                {STATUS_LABELS[status]}
              </p>
              <p className="mt-1 text-xl font-semibold text-white">
                {counts.byStatus[status] ?? 0}
              </p>
            </div>
          </div>
        )
      })}
      <div className="flex items-center gap-3 rounded-xl border border-purple-300/20 bg-purple-500/10 p-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
            Queued Matches
          </p>
          <p className="mt-1 text-xl font-semibold text-white">
            {totalQueuedMatches}
          </p>
        </div>
      </div>
    </section>
  )
}

export default SessionStats
