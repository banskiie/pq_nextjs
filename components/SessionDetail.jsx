'use client';

import React, { useState, useEffect } from 'react'
import { useQuery } from '@apollo/client/react'
import { gql } from '@apollo/client'
import StatusBadge from './StatusBadge'

const COURT_SURFACE_TYPES = {
  'WOODEN': 'Wooden',
  'SYNTHETIC': 'Synthetic',
  'MAT': 'Mat',
  'CONCRETE': 'Concrete',
}

const PLAYER_LEVELS = {
  'BEGINNER': 'Beginner',
  'INTERMEDIATE': 'Intermediate',
  'UPPERINTERMEDIATE': 'Upper Intermediate',
  'ADVANCED': 'Advanced',
}

const formatCourtSurfaceType = (value) => COURT_SURFACE_TYPES[value] ?? value
const formatPlayerLevel = (value) => PLAYER_LEVELS[value] ?? value

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

const formatDateTime = (value) => {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString()
}

const SessionDetail = ({ 
  session, 
  isOpen, 
  onClose, 
  onUpdate,
  onDelete,
  isLoading 
}) => {
  const [isEditing, setIsEditing] = useState(false)
  const [activeTab, setActiveTab] = useState('overview')
  const [formData, setFormData] = useState({
    name: '',
    courts: [],
    players: [],
  })

  const { data: courtsData, loading: courtsLoading } = useQuery(COURTS_QUERY)
  const { data: playersData, loading: playersLoading } = useQuery(PLAYERS_QUERY)

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (session) {
      setFormData({
        name: session.name,
        courts: session.courts || [],
        players: session.players?.map(p => p.playerId) || [],
      })
      setIsEditing(false)
      setActiveTab('overview')
    }
  }, [session, isOpen])
  /* eslint-enable react-hooks/set-state-in-effect */

  if (!isOpen || !session) return null

  const courts = courtsData?.courts || []
  const players = playersData?.players || []

  const canEdit = session.status === 'QUEUED'
  const canDelete = session.status === 'QUEUED'

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!formData.name.trim() || formData.courts.length === 0 || formData.players.length === 0) {
      alert('Please fill all fields')
      return
    }
    onUpdate(session._id, formData)
    setIsEditing(false)
  }

  const handleCourtToggle = (courtId) => {
    setFormData(prev => ({
      ...prev,
      courts: prev.courts.includes(courtId)
        ? prev.courts.filter(id => id !== courtId)
        : [...prev.courts, courtId]
    }))
  }

  const handlePlayerToggle = (playerId) => {
    setFormData(prev => ({
      ...prev,
      players: prev.players.includes(playerId)
        ? prev.players.filter(id => id !== playerId)
        : [...prev.players, playerId]
    }))
  }

  const handleDelete = () => {
    if (window.confirm(`Are you sure you want to delete session "${session.name}"?`)) {
      onDelete(session._id)
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-white/10 bg-slate-900 p-8 shadow-2xl">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-semibold text-white sm:text-2xl">Session Details</h2>
            {canEdit && (
              <button
                onClick={() => setIsEditing(!isEditing)}
                className="inline-flex items-center justify-center rounded-full border border-blue-300/40 px-3 py-1 text-xs font-semibold text-blue-200 transition hover:bg-blue-500/10 hover:border-blue-200/70"
              >
                {isEditing ? 'Cancel Edit' : 'Edit'}
              </button>
            )}
            {canDelete && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={isLoading}
                className="inline-flex items-center justify-center rounded-full border border-rose-300/40 px-3 py-1 text-xs font-semibold text-rose-200 transition hover:bg-rose-500/10 hover:border-rose-200/70 disabled:opacity-50"
              >
                Delete
              </button>
            )}
          </div>
          <button
            onClick={onClose}
            className="inline-flex items-center justify-center h-6 w-6 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition"
            type="button"
          >
            ✕
          </button>
        </div>

        {isEditing ? (
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Session Name */}
            <div>
              <label className="mb-2 block text-sm font-semibold text-white">
                Session Name
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Enter session name"
                className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-white placeholder-slate-500 focus:border-white/30 focus:outline-none"
              />
            </div>

            {/* Courts Selection */}
            <div>
              <label className="mb-3 block text-sm font-semibold text-white">
                Select Courts {courtsLoading && <span className="text-xs text-slate-400">(loading...)</span>}
              </label>
              <div className="space-y-2">
                {courts.length === 0 ? (
                  <p className="text-sm text-slate-400">No courts available</p>
                ) : (
                  courts.map(court => (
                    <label key={court._id} className="flex items-center gap-3 rounded-lg border border-white/10 p-3 hover:bg-white/5">
                      <input
                        type="checkbox"
                        checked={formData.courts.includes(court._id)}
                        onChange={() => handleCourtToggle(court._id)}
                        className="h-4 w-4 rounded border-white/20 bg-white/10"
                      />
                      <div className="flex-1">
                        <div className="text-sm font-medium text-white">{court.name}</div>
                        <div className="text-xs text-slate-400">
                          {court.indoor ? 'Indoor' : 'Outdoor'} • {formatCourtSurfaceType(court.surfaceType)}
                        </div>
                      </div>
                    </label>
                  ))
                )}
              </div>
            </div>

            {/* Players Selection */}
            <div>
              <label className="mb-3 block text-sm font-semibold text-white">
                Select Players {playersLoading && <span className="text-xs text-slate-400">(loading...)</span>}
              </label>
              <div className="max-h-48 space-y-2 overflow-y-auto">
                {players.length === 0 ? (
                  <p className="text-sm text-slate-400">No players available</p>
                ) : (
                  players.map(player => (
                    <label key={player._id} className="flex items-center gap-3 rounded-lg border border-white/10 p-3 hover:bg-white/5">
                      <input
                        type="checkbox"
                        checked={formData.players.includes(player._id)}
                        onChange={() => handlePlayerToggle(player._id)}
                        className="h-4 w-4 rounded border-white/20 bg-white/10"
                      />
                      <div className="flex-1">
                        <div className="text-sm font-medium text-white">{player.name}</div>
                        <div className="text-xs text-slate-400">{player.gender} • {formatPlayerLevel(player.playerLevel)}</div>
                      </div>
                    </label>
                  ))
                )}
              </div>
            </div>

            {/* Form Actions */}
            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="flex-1 rounded-lg border border-white/20 px-4 py-2 font-semibold text-white/80 transition hover:bg-white/5 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="flex-1 rounded-lg bg-emerald-500/20 px-4 py-2 font-semibold text-emerald-200 transition hover:bg-emerald-500/30 disabled:opacity-50"
              >
                {isLoading ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-6">
            {/* Tab Navigation */}
            <div className="flex gap-2 border-b border-white/10">
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
                Courts ({session.courts?.length || 0})
              </button>
              <button
                onClick={() => setActiveTab('players')}
                className={`px-4 py-3 text-sm font-semibold transition ${
                  activeTab === 'players'
                    ? 'border-b-2 border-emerald-400 text-emerald-400'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Players ({session.players?.length || 0})
              </button>
            </div>

            {/* Tab Content */}
            <div>
              {/* Overview Tab */}
              {activeTab === 'overview' && (
                <div className="space-y-4 rounded-lg border border-white/10 bg-white/5 p-4">
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
                      Name
                    </label>
                    <p className="mt-1 text-lg font-semibold text-white">{session.name}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
                        Status
                      </label>
                      <div className="mt-1">
                        <StatusBadge status={session.status} />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
                        Created
                      </label>
                      <p className="mt-1 text-sm text-white">{formatDateTime(session.createdAt)}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
                        Started
                      </label>
                      <p className="mt-1 text-sm text-white">{formatDateTime(session.startedAt)}</p>
                    </div>
                    <div>
                      <label className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
                        Ended
                      </label>
                      <p className="mt-1 text-sm text-white">{formatDateTime(session.endedAt)}</p>
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
                        {sessionCourts.map(court => (
                          <div key={court._id} className="rounded-lg border border-white/10 bg-white/5 p-3">
                            <div className="font-medium text-white">{court.name}</div>
                            <div className="text-xs text-slate-400">
                              {court.indoor ? 'Indoor' : 'Outdoor'} • {formatCourtSurfaceType(court.surfaceType)}
                            </div>
                          </div>
                        ))}
                      </div>
                    )
                  })()}
                </div>
              )}

              {/* Players Tab */}
              {activeTab === 'players' && (
                <div>
                  {session.players?.length === 0 ? (
                    <p className="text-sm text-slate-400">No players</p>
                  ) : (
                    <div className="space-y-2">
                      {session.players?.map(sessionPlayer => {
                        const player = players.find(p => p._id === sessionPlayer.playerId)
                        return (
                          <div key={sessionPlayer.playerId} className="rounded-lg border border-white/10 bg-white/5 p-3">
                            <div className="flex items-center justify-between">
                              <div>
                                <div className="font-medium text-white">{player?.name || 'Unknown'}</div>
                                <div className="text-xs text-slate-400">{formatPlayerLevel(player?.playerLevel) || 'N/A'}</div>
                              </div>
                              <div className="text-right">
                                <div className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
                                  Games
                                </div>
                                <div className="text-sm font-semibold text-white">{sessionPlayer.gamesPlayed}</div>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-3 border-t border-white/10 pt-6">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-lg border border-white/20 px-4 py-2 font-semibold text-white/80 transition hover:bg-white/5 hover:text-white"
              >
                Close
              </button>
              {canDelete && (
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={isLoading}
                  className="flex-1 rounded-lg bg-rose-500/20 px-4 py-2 font-semibold text-rose-200 transition hover:bg-rose-500/30 disabled:opacity-50"
                >
                  {isLoading ? 'Deleting...' : 'Delete'}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default SessionDetail
