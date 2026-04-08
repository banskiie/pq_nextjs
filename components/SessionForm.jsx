'use client';

import React, { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery } from '@apollo/client/react'
import { gql } from '@apollo/client'
import Pusher from 'pusher-js'
import { PUSHER_CHANNEL, PUSHER_EVENTS } from '@/lib/pusherEvents'
import MassAddPlayersModal from './MassAddPlayersModal'
import useDebouncedValue from '@/hooks/useDebouncedValue'
import { getBackendApiUrl } from '@/lib/backendEndpoints'

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

const SKILL_LEVEL_ORDER = {
  'BEGINNER': 1,
  'INTERMEDIATE': 2,
  'UPPERINTERMEDIATE': 3,
  'ADVANCED': 4,
}

const formatCourtSurfaceType = (value) => COURT_SURFACE_TYPES[value] ?? value
const formatPlayerLevel = (value) => PLAYER_LEVELS[value] ?? value
const normalizePlayerName = (value) => value.trim().toLowerCase()

const playersBulkApiUrl = getBackendApiUrl('/api/players/bulk')

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

const DELETED_PLAYERS_QUERY = gql`
  query DeletedPlayers {
    deletedPlayers {
      _id
      name
      gender
      playerLevel
    }
  }
`

const RESTORE_PLAYER_MUTATION = gql`
  mutation RestorePlayer($id: ID!, $name: String) {
    restorePlayer(id: $id, name: $name) {
      ok
      message
      player {
        _id
        name
        gender
        playerLevel
      }
    }
  }
`

const SessionForm = ({ 
  session, 
  sessions = [],
  isOpen, 
  onClose, 
  onSubmit, 
  isLoading 
}) => {
  const [currentStep, setCurrentStep] = useState(1)
  const [playerSearchTerm, setPlayerSearchTerm] = useState('')
  const debouncedPlayerSearchTerm = useDebouncedValue(playerSearchTerm, 200)
  const [playerFilterBySkill, setPlayerFilterBySkill] = useState('all')
  const [playerSortBySkill, setPlayerSortBySkill] = useState('none')
  const [showAvailablePlayersOnly, setShowAvailablePlayersOnly] = useState(false)
  const [playerPage, setPlayerPage] = useState(1)
  const [isMassAddModalOpen, setIsMassAddModalOpen] = useState(false)
  const [notFoundNames, setNotFoundNames] = useState([])
  const [isNotFoundModalOpen, setIsNotFoundModalOpen] = useState(false)
  const [playersState, setPlayersState] = useState([])
  const [showZeroPriceConfirmation, setShowZeroPriceConfirmation] = useState(false)
  const [isAddingMissingPlayers, setIsAddingMissingPlayers] = useState(false)
  const [missingPlayersError, setMissingPlayersError] = useState('')
  const [archivedPlayerMatches, setArchivedPlayerMatches] = useState([])
  const [pendingUnmatchedNames, setPendingUnmatchedNames] = useState([])
  const [isArchivedPlayersModalOpen, setIsArchivedPlayersModalOpen] = useState(false)
  const [isRestoringArchivedPlayers, setIsRestoringArchivedPlayers] = useState(false)
  const [archivedPlayersError, setArchivedPlayersError] = useState('')
  const [archivedPlayerToRename, setArchivedPlayerToRename] = useState(null)
  const [archivedPlayerRenameValue, setArchivedPlayerRenameValue] = useState('')
  const [archivedPlayerRenameError, setArchivedPlayerRenameError] = useState('')
  const PLAYERS_PER_PAGE = 20 // 4x5 grid
  const [formData, setFormData] = useState({
    name: '',
    courts: [],
    players: [],
    price: '',
  })

  const { data: courtsData, loading: courtsLoading } = useQuery(COURTS_QUERY)
  const {
    data: playersData,
    loading: playersLoading,
    refetch: refetchPlayers,
    error: playersError,
  } = useQuery(PLAYERS_QUERY)
  const {
    data: deletedPlayersData,
    refetch: refetchDeletedPlayers,
  } = useQuery(DELETED_PLAYERS_QUERY)
  const { data: playerUpdateData } = { data: null } // replaced by Pusher below

  useEffect(() => {
    const pusher = new Pusher(process.env.NEXT_PUBLIC_PUSHER_KEY, {
      cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER,
    })
    const channel = pusher.subscribe(PUSHER_CHANNEL)
    channel.bind(PUSHER_EVENTS.PLAYER, () => { refetchPlayers() })
    return () => {
      channel.unbind_all()
      pusher.unsubscribe(PUSHER_CHANNEL)
      pusher.disconnect()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Debug: Log if there's an error fetching players
  useEffect(() => {
    if (playersError) {
      console.error('Players query error:', playersError)
    }
  }, [playersError])

  useEffect(() => {
    if (session) {
      // Edit mode
      setFormData({
        name: session.name,
        courts: session.courts || [],
        players: session.players?.map(p => p.playerId) || [],
        price: session.price !== null && session.price !== undefined ? session.price.toString() : '',
      })
    } else {
      // Create mode
      setFormData({
        name: '',
        courts: [],
        players: [],
        price: '',
      })
    }
    setCurrentStep(1)
    setPlayerSearchTerm('')
    setPlayerFilterBySkill('all')
    setPlayerSortBySkill('none')
    setShowAvailablePlayersOnly(false)
    setPlayerPage(1)
    setIsMassAddModalOpen(false)
    setNotFoundNames([])
    setIsNotFoundModalOpen(false)
    setIsAddingMissingPlayers(false)
    setMissingPlayersError('')
    setArchivedPlayerMatches([])
    setPendingUnmatchedNames([])
    setIsArchivedPlayersModalOpen(false)
    setIsRestoringArchivedPlayers(false)
    setArchivedPlayersError('')
    setArchivedPlayerToRename(null)
    setArchivedPlayerRenameValue('')
    setArchivedPlayerRenameError('')
  }, [session, isOpen])

  useEffect(() => {
    if (playersData?.players) {
      setPlayersState(playersData.players)
    }
  }, [playersData?.players])

  const [restorePlayer] = useMutation(RESTORE_PLAYER_MUTATION)

  // Reset to page 1 when search or filter changes
  useEffect(() => {
    setPlayerPage(1)
  }, [debouncedPlayerSearchTerm, playerFilterBySkill, playerSortBySkill, showAvailablePlayersOnly])

  // Validation functions for each step
  const isStep1Valid = () => formData.name.trim() !== ''
  const isStep2Valid = () => formData.courts.length > 0
  const isStep3Valid = () => formData.players.length > 0
  const isStep4Valid = () => true // Price is optional

  const isStepValid = (step) => {
    switch (step) {
      case 1: return isStep1Valid()
      case 2: return isStep2Valid()
      case 3: return isStep3Valid()
      case 4: return isStep4Valid()
      default: return false
    }
  }

  const getPlayerCardClasses = (player) => {
    if (playersInOtherSessions.has(player._id)) {
      return 'border-pink-500/50 bg-pink-500/15 hover:bg-pink-500/25 animate-pulse'
    }

    if (formData.players.includes(player._id)) {
      return 'border-emerald-500 bg-emerald-500/20'
    }
    
    switch (player.playerLevel) {
      case 'BEGINNER':
        return 'border-blue-500/30 bg-blue-500/10 hover:bg-blue-500/20'
      case 'INTERMEDIATE':
        return 'border-yellow-500/30 bg-yellow-500/10 hover:bg-yellow-500/20'
      case 'UPPERINTERMEDIATE':
        return 'border-violet-500/30 bg-violet-500/10 hover:bg-violet-500/20'
      case 'ADVANCED':
        return 'border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20'
      default:
        return 'border-white/10'
    }
  }

  const getCourtCardClasses = (court) => {
    if (courtsInOtherSessions.has(court._id)) {
      return 'border-pink-500/50 bg-pink-500/15 hover:bg-pink-500/25 animate-pulse'
    }

    if (formData.courts.includes(court._id)) {
      return 'border-emerald-500 bg-emerald-500/20'
    }
    
    return court.indoor 
      ? 'border-blue-500/30 bg-blue-500/10 hover:bg-blue-500/20'
      : 'border-yellow-500/30 bg-yellow-500/10 hover:bg-yellow-500/20'
  }

  const courts = courtsData?.courts || []
  const players = playersState
  const deletedPlayers = deletedPlayersData?.deletedPlayers || []
  const courtsInOtherSessions = useMemo(() => {
    const activeSessions = sessions.filter((otherSession) => {
      if (!otherSession?._id || otherSession._id === session?._id) return false
      return otherSession.status === 'QUEUED' || otherSession.status === 'OPEN'
    })

    return new Set(activeSessions.flatMap((otherSession) => otherSession.courts || []))
  }, [session?._id, sessions])
  const playersInOtherSessions = useMemo(() => {
    const activeSessions = sessions.filter((otherSession) => {
      if (!otherSession?._id || otherSession._id === session?._id) return false
      return otherSession.status === 'QUEUED' || otherSession.status === 'OPEN'
    })

    return new Set(
      activeSessions.flatMap((otherSession) =>
        (otherSession.players || []).map((player) => player?.playerId).filter(Boolean)
      )
    )
  }, [session?._id, sessions])

  if (!isOpen) return null

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!formData.name.trim() || formData.courts.length === 0 || formData.players.length === 0) {
      alert('Please fill all fields')
      return
    }
    onSubmit(formData)
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

  const handlePlayersMassAdded = async (result) => {
    setMissingPlayersError('')
    setArchivedPlayersError('')

    const matchedPlayerIds = Array.isArray(result?.matchedPlayerIds)
      ? result.matchedPlayerIds.filter(Boolean)
      : []

    if (matchedPlayerIds.length > 0) {
      setFormData((prev) => ({
        ...prev,
        players: [...new Set([...prev.players, ...matchedPlayerIds])],
      }))
    }

    const archivedMatches = Array.isArray(result?.archivedMatches)
      ? result.archivedMatches.filter((player) => player?._id)
      : []
    const unmatchedNames = Array.isArray(result?.unmatchedNames)
      ? result.unmatchedNames
      : []

    setPendingUnmatchedNames(unmatchedNames)

    if (archivedMatches.length > 0) {
      setArchivedPlayerMatches(archivedMatches)
      setIsArchivedPlayersModalOpen(true)
      return
    }

    if (unmatchedNames.length > 0) {
      setNotFoundNames(unmatchedNames)
      setIsNotFoundModalOpen(true)
    }
  }

  const handleProceedWithUnmatchedNames = () => {
    if (pendingUnmatchedNames.length > 0) {
      setNotFoundNames(pendingUnmatchedNames)
      setIsNotFoundModalOpen(true)
    }
    setPendingUnmatchedNames([])
  }

  const handleArchivedPlayerRestored = async (restoredPlayerId, restoredPlayerName) => {
    const [playersRefetchResult] = await Promise.all([
      refetchPlayers(),
      refetchDeletedPlayers(),
    ])
    const latestPlayers = playersRefetchResult?.data?.players || []

    if (latestPlayers.length > 0) {
      setPlayersState(latestPlayers)
    }

    const resolvedPlayerId = restoredPlayerId || latestPlayers.find(
      (player) => normalizePlayerName(player?.name || '') === normalizePlayerName(restoredPlayerName || '')
    )?._id

    if (resolvedPlayerId) {
      setFormData((prev) => ({
        ...prev,
        players: [...new Set([...prev.players, resolvedPlayerId])],
      }))
    }

    setArchivedPlayerMatches((prev) => prev.filter((player) => player._id !== archivedPlayerToRename?._id && player._id !== restoredPlayerId))
  }

  const handleRestoreArchivedPlayers = async () => {
    if (archivedPlayerMatches.length === 0 || isRestoringArchivedPlayers) return

    setIsRestoringArchivedPlayers(true)
    setArchivedPlayersError('')

    try {
      const remainingArchivedMatches = []

      for (const archivedPlayer of archivedPlayerMatches) {
        const response = await restorePlayer({
          variables: { id: archivedPlayer._id },
        })

        const payload = response?.data?.restorePlayer
        if (!payload?.ok) {
          if ((payload?.message || '').toLowerCase().includes('enter a new name')) {
            setArchivedPlayerToRename(archivedPlayer)
            setArchivedPlayerRenameValue(archivedPlayer.name)
            setArchivedPlayerRenameError(payload.message)
            return
          }

          remainingArchivedMatches.push(archivedPlayer)
          throw new Error(payload?.message || `Failed to restore ${archivedPlayer.name}`)
        }
      }

      const [playersRefetchResult] = await Promise.all([
        refetchPlayers(),
        refetchDeletedPlayers(),
      ])
      const latestPlayers = playersRefetchResult?.data?.players || []

      if (latestPlayers.length > 0) {
        setPlayersState(latestPlayers)
      }

      const latestPlayerMap = new Map(
        latestPlayers
          .filter((player) => player?.name)
          .map((player) => [normalizePlayerName(player.name), player._id])
      )

      const restoredPlayerIds = archivedPlayerMatches
        .map((player) => latestPlayerMap.get(normalizePlayerName(player.name)))
        .filter(Boolean)

      if (restoredPlayerIds.length > 0) {
        setFormData((prev) => ({
          ...prev,
          players: [...new Set([...prev.players, ...restoredPlayerIds])],
        }))
      }

      setArchivedPlayerMatches([])
      setIsArchivedPlayersModalOpen(false)
      handleProceedWithUnmatchedNames()
    } catch (error) {
      console.error('Archived players restore error:', error)
      setArchivedPlayersError(error.message || 'Failed to restore archived players')
      await Promise.all([refetchPlayers(), refetchDeletedPlayers()])
    } finally {
      setIsRestoringArchivedPlayers(false)
    }
  }

  const handleSkipArchivedPlayers = () => {
    setIsArchivedPlayersModalOpen(false)
    setArchivedPlayerMatches([])
    setArchivedPlayersError('')
    setArchivedPlayerToRename(null)
    setArchivedPlayerRenameValue('')
    setArchivedPlayerRenameError('')
    handleProceedWithUnmatchedNames()
  }

  const handleRenameAndRestoreArchivedPlayer = async () => {
    if (!archivedPlayerToRename?._id || isRestoringArchivedPlayers) return

    const nextName = archivedPlayerRenameValue.trim()
    if (!nextName) {
      setArchivedPlayerRenameError('Please enter a new name before restoring.')
      return
    }

    setIsRestoringArchivedPlayers(true)
    setArchivedPlayerRenameError('')

    try {
      const response = await restorePlayer({
        variables: { id: archivedPlayerToRename._id, name: nextName },
      })

      const payload = response?.data?.restorePlayer
      if (!payload?.ok) {
        setArchivedPlayerRenameError(payload?.message || `Failed to restore ${archivedPlayerToRename.name}`)
        return
      }

      await handleArchivedPlayerRestored(payload?.player?._id, payload?.player?.name || nextName)
      setArchivedPlayerToRename(null)
      setArchivedPlayerRenameValue('')
      setArchivedPlayerRenameError('')
    } catch (error) {
      setArchivedPlayerRenameError(error.message || `Failed to restore ${archivedPlayerToRename.name}`)
    } finally {
      setIsRestoringArchivedPlayers(false)
    }
  }

  const handleAddMissingPlayers = async () => {
    if (notFoundNames.length === 0 || isAddingMissingPlayers) return

    setIsAddingMissingPlayers(true)
    setMissingPlayersError('')

    try {
      const response = await fetch(playersBulkApiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ players: notFoundNames }),
      })

      const contentType = response.headers.get('content-type')
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Server returned invalid response. Please check if the backend is running.')
      }

      const result = await response.json()

      if (!response.ok || !result.ok) {
        throw new Error(result.message || `Server error: ${response.status}`)
      }

      const refetchResult = await refetchPlayers()
      const latestPlayers = refetchResult?.data?.players || []

      if (latestPlayers.length > 0) {
        setPlayersState(latestPlayers)
      }

      const latestPlayerMap = new Map(
        latestPlayers
          .filter((player) => player?.name)
          .map((player) => [normalizePlayerName(player.name), player._id])
      )

      const resolvedPlayerIds = notFoundNames
        .map((name) => latestPlayerMap.get(normalizePlayerName(name)))
        .filter(Boolean)

      if (resolvedPlayerIds.length > 0) {
        setFormData((prev) => ({
          ...prev,
          players: [...new Set([...prev.players, ...resolvedPlayerIds])],
        }))
      }

      const unresolvedNames = notFoundNames.filter(
        (name) => !latestPlayerMap.has(normalizePlayerName(name))
      )

      if (unresolvedNames.length > 0) {
        setNotFoundNames(unresolvedNames)
        setMissingPlayersError('Some names could not be added automatically. Please review the remaining list.')
      } else {
        setNotFoundNames([])
        setIsNotFoundModalOpen(false)
      }
    } catch (error) {
      console.error('Missing players add error:', error)
      setMissingPlayersError(error.message || 'Failed to add missing players')
    } finally {
      setIsAddingMissingPlayers(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-white/10 bg-slate-900 p-5 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-slate-400 hover:text-white"
          type="button"
        >
          ✕
        </button>

        <h2 className="mb-3 text-lg font-semibold text-white sm:text-xl">
          {session ? 'Edit Session' : 'Create Session'}
        </h2>

        {/* Step Indicator */}
        <div className="mb-4 flex items-center gap-2">
          {[1, 2, 3, 4].map((step) => {
            const stepValid = isStepValid(step)
            const isCompleted = step < currentStep
            const isCurrent = step === currentStep
            const showError = !stepValid && !isCurrent && step < currentStep
            
            // Determine line color based on current step's validity
            let lineColor = 'bg-white/10' // default
            if (isCompleted) {
              lineColor = stepValid ? 'bg-emerald-500' : 'bg-red-500'
            }
            
            return (
              <React.Fragment key={step}>
                <button
                  onClick={() => setCurrentStep(step)}
                  className={`flex h-10 w-10 items-center justify-center rounded-full font-semibold transition ${
                    isCurrent
                      ? 'bg-emerald-500 text-white shadow-lg'
                      : showError
                      ? 'bg-red-500 text-white'
                      : isCompleted && stepValid
                      ? 'bg-emerald-500/50 text-white'
                      : 'border border-white/20 text-slate-400 hover:text-white'
                  }`}
                >
                  {showError ? '✕' : isCompleted && stepValid ? '✓' : step}
                </button>
                {step < 4 && <div className={`flex-1 h-0.5 ${lineColor}`} />}
              </React.Fragment>
            )
          })}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Step 1: Session Name */}
          {currentStep === 1 && (
            <div className="space-y-3">
              <div>
                <h3 className="mb-1.5 text-base font-semibold text-white">Session Details</h3>
                <p className="mb-3 text-xs text-slate-400">Give your session a name</p>
              </div>
              <div>
                <label htmlFor="session-name" className="mb-1.5 block text-xs font-semibold text-white">
                  Session Name
                </label>
                <input
                  id="session-name"
                  name="sessionName"
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Enter session name"
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white placeholder-slate-500 focus:border-white/30 focus:outline-none"
                  autoFocus
                />
              </div>
            </div>
          )}

          {/* Step 2: Courts Selection */}
          {currentStep === 2 && (
            <div className="space-y-3">
              <div>
                <h3 className="mb-1.5 text-base font-semibold text-white">Select Courts</h3>
                <p className="mb-2 text-xs text-slate-400">Choose the courts for this session</p>
                <div className="flex flex-wrap gap-2 mb-3">
                  <div className="flex items-center gap-1.5 text-xs">
                    <div className="h-2.5 w-2.5 rounded border border-blue-500/30 bg-blue-500/10"></div>
                    <span className="text-slate-400">Indoor</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs">
                    <div className="h-2.5 w-2.5 rounded border border-yellow-500/30 bg-yellow-500/10"></div>
                    <span className="text-slate-400">Outdoor</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs">
                    <div className="h-2.5 w-2.5 rounded border border-emerald-500 bg-emerald-500/20"></div>
                    <span className="text-slate-400">Selected</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs">
                    <div className="h-2.5 w-2.5 rounded border border-pink-500/50 bg-pink-500/15 animate-pulse"></div>
                    <span className="text-slate-400">Used in another session</span>
                  </div>
                </div>
              </div>
              <div>
                <p className="mb-2 block text-xs font-semibold text-white">
                  Courts {courtsLoading && <span className="text-xs text-slate-400">(loading...)</span>}
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1 min-h-32">
                  {courts.length === 0 ? (
                    <p className="text-xs text-slate-400 col-span-full">No courts available</p>
                  ) : (
                    [...courts].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })).map(court => (
                      <label key={court._id} className={`flex flex-col gap-0 rounded-lg px-1.5 py-0.5 cursor-pointer transition border ${getCourtCardClasses(court)}`}>
                        <div className="flex items-center gap-0.5 leading-tight">
                          <input
                            id={`session-court-${court._id}`}
                            name="selectedCourts"
                            type="checkbox"
                            checked={formData.courts.includes(court._id)}
                            onChange={() => handleCourtToggle(court._id)}
                            className="h-2.5 w-2.5 rounded border-white/20 bg-white/10 cursor-pointer shrink-0"
                          />
                          <div className={`text-sm font-medium truncate leading-tight ${
                            formData.courts.includes(court._id) ? 'text-emerald-200' : 'text-white'
                          }`}>{court.name}</div>
                        </div>
                        <div className={`text-[8px] pl-3 leading-none ${
                          formData.courts.includes(court._id) ? 'text-emerald-300' : 'text-slate-400'
                        }`}>{court.indoor ? 'Indoor' : 'Outdoor'} • {formatCourtSurfaceType(court.surfaceType)}</div>
                      </label>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Players Selection */}
          {currentStep === 3 && (
            <div className="space-y-3">
              <div>
                <h3 className="mb-1.5 text-base font-semibold text-white">Select Players</h3>
                <p className="mb-2 text-xs text-slate-400">Choose the players for this session</p>
                <div className="flex flex-wrap gap-2 mb-3">
                  <div className="flex items-center gap-1.5 text-xs">
                    <div className="h-2.5 w-2.5 rounded border border-blue-500/30 bg-blue-500/10"></div>
                    <span className="text-slate-400">Beginner</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs">
                    <div className="h-2.5 w-2.5 rounded border border-yellow-500/30 bg-yellow-500/10"></div>
                    <span className="text-slate-400">Intermediate</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs">
                    <div className="h-2.5 w-2.5 rounded border border-violet-500/30 bg-violet-500/10"></div>
                    <span className="text-slate-400">Upper Int.</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs">
                    <div className="h-2.5 w-2.5 rounded border border-rose-500/30 bg-rose-500/10"></div>
                    <span className="text-slate-400">Advanced</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs">
                    <div className="h-2.5 w-2.5 rounded border border-emerald-500 bg-emerald-500/20"></div>
                    <span className="text-slate-400">Selected</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs">
                    <div className="h-2.5 w-2.5 rounded border border-pink-500/50 bg-pink-500/15 animate-pulse"></div>
                    <span className="text-slate-400">Used in another session</span>
                  </div>
                </div>
              </div>
              <div>
                <p className="mb-2 block text-xs font-semibold text-white">
                  Players {playersLoading && <span className="text-xs text-slate-400">(loading...)</span>}
                </p>
                <div className="mb-2 flex justify-end items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, players: [] }))}
                    disabled={formData.players.length === 0}
                    className="rounded-lg bg-rose-500/20 px-3 py-1.5 text-xs font-semibold text-rose-200 transition hover:bg-rose-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
                    title={formData.players.length === 0 ? 'No players selected' : 'Remove all selected players'}
                  >
                    Unselect All
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      await Promise.all([refetchPlayers(), refetchDeletedPlayers()])
                      setIsMassAddModalOpen(true)
                    }}
                    disabled={playersLoading}
                    title={playersLoading ? 'Loading players...' : ''}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                      playersLoading
                        ? 'bg-slate-500/20 text-slate-400 cursor-not-allowed opacity-50'
                        : 'bg-emerald-500/20 text-emerald-200 hover:bg-emerald-500/30'
                    }`}
                  >
                    {playersLoading ? 'Loading Players...' : 'Batch Add Players'}
                  </button>
                </div>
                <div className="mb-2 rounded-lg border border-white/10 bg-white/5 p-2.5">
                  <p className="mb-2 block text-xs font-semibold text-white">
                    Filter & Sort
                  </p>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <input
                    id="session-player-search"
                    name="playerSearch"
                    type="text"
                    placeholder="Search by player name..."
                    value={playerSearchTerm}
                    onChange={(e) => setPlayerSearchTerm(e.target.value)}
                    className="rounded-lg border border-white/10 bg-slate-800 px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:border-white/30 focus:outline-none"
                  />
                  <select
                    id="session-player-skill-filter"
                    name="playerSkillFilter"
                    value={playerFilterBySkill}
                    onChange={(e) => setPlayerFilterBySkill(e.target.value)}
                    className="rounded-lg border border-white/10 bg-slate-800 px-3 py-1.5 text-xs text-white focus:border-white/30 focus:outline-none"
                  >
                    <option value="all" className='text-black'>All Skill Levels</option>
                    <option value="ADVANCED" className='text-black'>Advanced</option>
                    <option value="UPPERINTERMEDIATE" className='text-black'>Upper Intermediate</option>
                    <option value="INTERMEDIATE" className='text-black'>Intermediate</option>
                    <option value="BEGINNER" className='text-black'>Beginner</option>
                  </select>
                  <select
                    id="session-player-skill-sort"
                    name="playerSkillSort"
                    value={playerSortBySkill}
                    onChange={(e) => setPlayerSortBySkill(e.target.value)}
                    className="rounded-lg border border-white/10 bg-slate-800 px-3 py-1.5 text-xs text-white focus:border-white/30 focus:outline-none"
                  >
                    <option value="none" className='text-black'>Sort: Name A-Z</option>
                    <option value="asc" className='text-black'>Sort: Skill Low-High</option>
                    <option value="desc" className='text-black'>Sort: Skill High-Low</option>
                  </select>
                </div>
                  <label className="mt-2 flex items-center gap-2 text-[10px] text-slate-300">
                    <input
                      id="session-available-only"
                      name="showAvailablePlayersOnly"
                      type="checkbox"
                      checked={showAvailablePlayersOnly}
                      onChange={(e) => setShowAvailablePlayersOnly(e.target.checked)}
                      className="h-3 w-3 rounded border-white/20 bg-white/10"
                    />
                    Available only
                  </label>
                </div>
                {(() => {
                  // Filter and sort players
                  const filteredPlayers = players
                    .filter(player => player.name.toLowerCase().includes(debouncedPlayerSearchTerm.toLowerCase()))
                    .filter(player => playerFilterBySkill === 'all' || player.playerLevel === playerFilterBySkill)
                    .filter(player => !showAvailablePlayersOnly || !playersInOtherSessions.has(player._id))
                    .sort((a, b) => {
                      // First, prioritize selected players
                      const aSelected = formData.players.includes(a._id)
                      const bSelected = formData.players.includes(b._id)
                      
                      if (aSelected && !bSelected) return -1
                      if (!aSelected && bSelected) return 1
                      
                      // If both selected: sort alphabetically/numerically
                      if (aSelected && bSelected) {
                        return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
                      }

                      if (playerSortBySkill === 'asc') {
                        const aOrder = SKILL_LEVEL_ORDER[a.playerLevel] ?? 0
                        const bOrder = SKILL_LEVEL_ORDER[b.playerLevel] ?? 0
                        if (aOrder !== bOrder) {
                          return aOrder - bOrder
                        }
                      }

                      if (playerSortBySkill === 'desc') {
                        const aOrder = SKILL_LEVEL_ORDER[a.playerLevel] ?? 0
                        const bOrder = SKILL_LEVEL_ORDER[b.playerLevel] ?? 0
                        if (aOrder !== bOrder) {
                          return bOrder - aOrder
                        }
                      }

                      return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
                    })

                  // Alphabet-based pagination: 3 letters per page (matches Create/Edit Match)
                  const allLetterGroups = [...new Set(
                    filteredPlayers.map((player) => (player.name?.[0] || '#').toUpperCase())
                  )].sort()
                  const totalPages = Math.max(1, Math.ceil(allLetterGroups.length / 3))
                  const clampedPlayerPage = Math.min(playerPage, totalPages)
                  const pageLetters = allLetterGroups.slice((clampedPlayerPage - 1) * 3, (clampedPlayerPage - 1) * 3 + 3)
                  const pageLetterSet = new Set(pageLetters)
                  const paginatedPlayers = filteredPlayers.filter((player) =>
                    pageLetterSet.has((player.name?.[0] || '#').toUpperCase())
                  )

                  const visiblePlayerPages = (() => {
                    if (totalPages <= 7) {
                      return Array.from({ length: totalPages }, (_, index) => index + 1)
                    }

                    const pages = [1]
                    const start = Math.max(2, clampedPlayerPage - 1)
                    const end = Math.min(totalPages - 1, clampedPlayerPage + 1)

                    if (start > 2) pages.push('ellipsis-left')
                    for (let page = start; page <= end; page += 1) pages.push(page)
                    if (end < totalPages - 1) pages.push('ellipsis-right')
                    pages.push(totalPages)

                    return pages
                  })()

                  return (
                    <>
                      {/* Pagination Controls */}
                      {totalPages > 1 && (
                        <div className="mb-2 flex items-center justify-between gap-2 border-b border-white/10 pb-2 text-xs text-slate-400">
                          <button
                            type="button"
                            onClick={() => setPlayerPage(Math.max(1, clampedPlayerPage - 1))}
                            disabled={clampedPlayerPage === 1}
                            className="rounded-full border border-slate-300/40 px-3 py-1 text-xs font-semibold text-slate-200 transition hover:bg-slate-500/10 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Previous
                          </button>
                          <div className="hidden items-center gap-1 sm:flex">
                            {visiblePlayerPages.map((item, index) => {
                              if (typeof item !== 'number') {
                                return (
                                  <span key={`${item}-${index}`} className="px-1 text-xs text-slate-400">
                                    ...
                                  </span>
                                )
                              }

                              const isActive = item === clampedPlayerPage
                              return (
                                <button
                                  key={`session-player-page-${item}`}
                                  type="button"
                                  onClick={() => setPlayerPage(item)}
                                  className={`rounded-full border px-2.5 py-1 text-xs font-semibold transition ${
                                    isActive
                                      ? 'border-sky-400/70 bg-sky-500/20 text-sky-100'
                                      : 'border-slate-300/40 text-slate-200 hover:bg-slate-500/10'
                                  }`}
                                >
                                  {allLetterGroups.slice((item - 1) * 3, (item - 1) * 3 + 3).join('·')}
                                </button>
                              )
                            })}
                          </div>
                          <span className="inline-flex min-w-6 flex-col items-center leading-none">
                            <span>{pageLetters[0]}</span>
                            {pageLetters.length > 1 && (
                              <>
                                <span>-</span>
                                <span>{pageLetters[pageLetters.length - 1]}</span>
                              </>
                            )}
                          </span>
                          <button
                            type="button"
                            onClick={() => setPlayerPage(Math.min(totalPages, clampedPlayerPage + 1))}
                            disabled={clampedPlayerPage >= totalPages}
                            className="rounded-full border border-slate-300/40 px-3 py-1 text-xs font-semibold text-slate-200 transition hover:bg-slate-500/10 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Next
                          </button>
                        </div>
                      )}

                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 min-h-32">
                        {players.length === 0 ? (
                          <p className="text-sm text-slate-400 col-span-full">No players available</p>
                        ) : filteredPlayers.length === 0 ? (
                          <p className="text-sm text-slate-400 col-span-full">No players match your filters</p>
                        ) : (
                          Object.entries(
                            paginatedPlayers.reduce((groups, player) => {
                              const letter = (player.name?.[0] || '#').toUpperCase()
                              if (!groups[letter]) groups[letter] = []
                              groups[letter].push(player)
                              return groups
                            }, {})
                          ).flatMap(([letter, group]) => [
                            <div key={`session-player-letter-${letter}`} className="col-span-full mb-1 flex items-center gap-2">
                              <span className="text-[10px] font-bold tracking-widest text-slate-500">{letter}</span>
                              <div className="h-px flex-1 bg-white/10" />
                            </div>,
                            ...group.map((player) => (
                              <label key={player._id} className={`group relative cursor-pointer rounded border px-2 py-1.5 text-left transition ${getPlayerCardClasses(player)}`}>
                                <div className="flex items-start gap-1.5">
                                  <input
                                    id={`session-player-${player._id}`}
                                    name="selectedPlayers"
                                    type="checkbox"
                                    checked={formData.players.includes(player._id)}
                                    onChange={() => handlePlayerToggle(player._id)}
                                    className="mt-0.5 h-3 w-3 rounded border-white/20 bg-white/10 cursor-pointer shrink-0"
                                  />
                                  <div className="min-w-0">
                                    <p className={`truncate text-sm font-semibold leading-tight ${
                                      formData.players.includes(player._id) ? 'text-emerald-200' : 'text-white'
                                    }`}>{player.name?.toUpperCase()}</p>
                                    <p className={`text-[10px] leading-tight ${
                                      formData.players.includes(player._id) ? 'text-emerald-300' : 'text-slate-400'
                                    }`}>{formatPlayerLevel(player.playerLevel)}</p>
                                    <p className={`text-[9px] leading-tight ${
                                      formData.players.includes(player._id) ? 'text-emerald-300' : 'text-slate-500'
                                    }`}>{player.gender || 'N/A'}</p>
                                    {formData.players.includes(player._id) && (
                                      <p className="mt-0.5 text-[9px] leading-tight text-emerald-300">● Selected</p>
                                    )}
                                    {!formData.players.includes(player._id) && playersInOtherSessions.has(player._id) && (
                                      <p className="mt-0.5 text-[9px] leading-tight text-pink-300">● In another session</p>
                                    )}
                                  </div>
                                </div>
                              </label>
                            )),
                          ])
                        )}
                      </div>

                    </>
                  )
                })()}
              </div>
            </div>
          )}

          {/* Step 4: Price Per Head Per Game */}
          {currentStep === 4 && (
            <div className="space-y-3">
              <div>
                <h3 className="mb-1.5 text-base font-semibold text-white">Price Per Head Per Game</h3>
                <p className="mb-3 text-xs text-slate-400">Set the price for this session (optional)</p>
              </div>
              <div>
                <label htmlFor="session-price-per-game" className="mb-1.5 block text-xs font-semibold text-white">
                  Price Per Game (₱)
                </label>
                <input
                  id="session-price-per-game"
                  name="pricePerGame"
                  type="number"
                  value={formData.price}
                  onChange={(e) => setFormData(prev => ({ ...prev, price: e.target.value }))}
                  placeholder="Enter price per game"
                  min="0"
                  step="0.01"
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white placeholder-slate-500 focus:border-white/30 focus:outline-none"
                />
              </div>
              <p className="text-xs text-slate-400">Leave empty or 0 for free session</p>
            </div>
          )}

          {/* Form Actions */}
          <div className="flex gap-2 pt-4 border-t border-white/10">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-white/20 px-3 py-1.5 text-xs font-semibold text-white/80 transition hover:bg-white/5 hover:text-white"
            >
              Cancel
            </button>
            {currentStep > 1 && (
              <button
                type="button"
                onClick={() => setCurrentStep(currentStep - 1)}
                className="flex-1 rounded-lg border border-white/20 px-3 py-1.5 text-xs font-semibold text-white/80 transition hover:bg-white/5 hover:text-white"
              >
                Back
              </button>
            )}
            {currentStep < 4 && (
              <button
                type="button"
                onClick={() => {
                  if (currentStep === 1 && !formData.name.trim()) {
                    alert('Please enter a session name')
                    return
                  }
                  if (currentStep === 2 && formData.courts.length === 0) {
                    alert('Please select at least one court')
                    return
                  }
                  setCurrentStep(currentStep + 1)
                }}
                className="flex-1 rounded-lg bg-emerald-500/20 px-3 py-1.5 text-xs font-semibold text-emerald-200 transition hover:bg-emerald-500/30"
              >
                Next
              </button>
            )}
            {currentStep === 4 && (
              <button
                type="button"
                onClick={() => {
                  const price = Number(formData.price) || 0
                  if (price === 0) {
                    setShowZeroPriceConfirmation(true)
                  } else {
                    onSubmit(formData)
                  }
                }}
                disabled={isLoading}
                className="flex-1 rounded-lg bg-emerald-500/20 px-3 py-1.5 text-xs font-semibold text-emerald-200 transition hover:bg-emerald-500/30 disabled:opacity-50"
              >
                {isLoading ? 'Saving...' : session ? 'Update' : 'Create'}
              </button>
            )}
          </div>
        </form>

        <MassAddPlayersModal
          isOpen={isMassAddModalOpen}
          onClose={() => setIsMassAddModalOpen(false)}
          onSuccess={handlePlayersMassAdded}
          matchExistingOnly
          existingPlayers={players}
          archivedPlayers={deletedPlayers}
        />

        {isArchivedPlayersModalOpen && (
          <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 p-4">
            <div className="relative w-full max-w-md rounded-2xl border border-pink-500/30 bg-slate-900 p-5 shadow-2xl">
              <button
                onClick={handleSkipArchivedPlayers}
                className="absolute right-3 top-3 text-slate-400 hover:text-white transition"
                type="button"
              >
                ✕
              </button>
              <h3 className="mb-2 text-base font-semibold text-pink-300">Archived Players Found</h3>
              <p className="mb-3 text-xs text-slate-300">
                These names already exist in the archived player list. Restore them to add them to this session.
              </p>
              {archivedPlayersError && (
                <div className="mb-3 rounded-lg border border-red-500/30 bg-red-500/10 p-2 text-xs text-red-200">
                  {archivedPlayersError}
                </div>
              )}
              <div className="mb-4 max-h-44 overflow-y-auto rounded-lg border border-white/10 bg-white/5 p-2">
                <ul className="space-y-1 text-xs text-slate-200">
                  {archivedPlayerMatches.map((player) => (
                    <li key={player._id}>{player.name}</li>
                  ))}
                </ul>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleSkipArchivedPlayers}
                  disabled={isRestoringArchivedPlayers}
                  className="flex-1 rounded-lg border border-white/20 px-3 py-1.5 text-xs font-semibold text-white/80 transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Add Different Player
                </button>
                <button
                  type="button"
                  onClick={handleRestoreArchivedPlayers}
                  disabled={isRestoringArchivedPlayers || archivedPlayerMatches.length === 0}
                  className="flex-1 rounded-lg bg-pink-500/20 px-3 py-1.5 text-xs font-semibold text-pink-200 transition hover:bg-pink-500/30 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isRestoringArchivedPlayers ? 'Restoring...' : 'Restore and Select'}
                </button>
              </div>
            </div>
          </div>
        )}

        {archivedPlayerToRename && (
          <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 p-4">
            <div className="relative w-full max-w-md rounded-2xl border border-amber-500/30 bg-slate-900 p-5 shadow-2xl">
              <button
                onClick={() => {
                  setArchivedPlayerToRename(null)
                  setArchivedPlayerRenameValue('')
                  setArchivedPlayerRenameError('')
                }}
                className="absolute right-3 top-3 text-slate-400 hover:text-white transition"
                type="button"
              >
                ✕
              </button>
              <h3 className="mb-2 text-base font-semibold text-amber-300">Rename To Restore</h3>
              <p className="mb-3 text-xs text-slate-300">
                An active player already uses this name. Enter a new name for <span className="font-semibold text-white">{archivedPlayerToRename.name}</span> before restoring.
              </p>
              <input
                id="restore-player-name"
                name="restorePlayerName"
                type="text"
                value={archivedPlayerRenameValue}
                onChange={(e) => setArchivedPlayerRenameValue(e.target.value)}
                className="mb-3 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-white/30 focus:outline-none"
                placeholder="Enter a new player name"
                autoFocus
              />
              {archivedPlayerRenameError && (
                <div className="mb-3 rounded-lg border border-red-500/30 bg-red-500/10 p-2 text-xs text-red-200">
                  {archivedPlayerRenameError}
                </div>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setArchivedPlayerToRename(null)
                    setArchivedPlayerRenameValue('')
                    setArchivedPlayerRenameError('')
                  }}
                  disabled={isRestoringArchivedPlayers}
                  className="flex-1 rounded-lg border border-white/20 px-3 py-1.5 text-xs font-semibold text-white/80 transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleRenameAndRestoreArchivedPlayer}
                  disabled={isRestoringArchivedPlayers}
                  className="flex-1 rounded-lg bg-amber-500/20 px-3 py-1.5 text-xs font-semibold text-amber-200 transition hover:bg-amber-500/30 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isRestoringArchivedPlayers ? 'Restoring...' : 'Rename and Restore'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Zero Price Confirmation Modal */}
        {showZeroPriceConfirmation && (
          <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 p-4">
            <div className="relative w-full max-w-md rounded-2xl border border-amber-500/30 bg-slate-900 p-5 shadow-2xl">
              <button
                onClick={() => setShowZeroPriceConfirmation(false)}
                className="absolute right-3 top-3 text-slate-400 hover:text-white transition"
                type="button"
              >
                ✕
              </button>
              <h3 className="mb-2 text-base font-semibold text-amber-300">Proceed Without Price?</h3>
              <p className="mb-4 text-sm text-slate-300">
                No price has been set for this session. Players will not be charged for games. Do you want to proceed?
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowZeroPriceConfirmation(false)}
                  className="flex-1 rounded-lg border border-white/20 px-3 py-1.5 text-xs font-semibold text-white/80 transition hover:bg-white/5"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowZeroPriceConfirmation(false)
                    onSubmit(formData)
                  }}
                  disabled={isLoading}
                  className="flex-1 rounded-lg bg-amber-500/20 px-3 py-1.5 text-xs font-semibold text-amber-200 transition hover:bg-amber-500/30 disabled:opacity-50"
                >
                  {isLoading ? 'Saving...' : 'Yes, Continue'}
                </button>
              </div>
            </div>
          </div>
        )}

        {isNotFoundModalOpen && (
          <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 p-4">
            <div className="relative w-full max-w-md rounded-2xl border border-yellow-500/30 bg-slate-900 p-5 shadow-2xl">
              <button
                onClick={() => {
                  setIsNotFoundModalOpen(false)
                  setNotFoundNames([])
                  setPendingUnmatchedNames([])
                }}
                className="absolute right-3 top-3 text-slate-400 hover:text-white transition"
                type="button"
              >
                ✕
              </button>
              <h3 className="mb-2 text-base font-semibold text-yellow-300">Names Not Found</h3>
              <p className="mb-3 text-xs text-slate-300">
                These names were not matched to existing players and were not added to the session:
              </p>
              <p className="mb-3 text-xs text-slate-400">
                You can add them to the player database with default details, then auto-select them for this session.
              </p>
              {missingPlayersError && (
                <div className="mb-3 rounded-lg border border-red-500/30 bg-red-500/10 p-2 text-xs text-red-200">
                  {missingPlayersError}
                </div>
              )}
              <div className="mb-4 max-h-44 overflow-y-auto rounded-lg border border-white/10 bg-white/5 p-2">
                <ul className="space-y-1 text-xs text-slate-200">
                  {notFoundNames.map((name) => (
                    <li key={name}>{name}</li>
                  ))}
                </ul>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsNotFoundModalOpen(false)
                    setNotFoundNames([])
                    setPendingUnmatchedNames([])
                    setMissingPlayersError('')
                  }}
                  disabled={isAddingMissingPlayers}
                  className="flex-1 rounded-lg border border-white/20 px-3 py-1.5 text-xs font-semibold text-white/80 transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={handleAddMissingPlayers}
                  disabled={isAddingMissingPlayers || notFoundNames.length === 0}
                  className="flex-1 rounded-lg bg-yellow-500/20 px-3 py-1.5 text-xs font-semibold text-yellow-200 transition hover:bg-yellow-500/30 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isAddingMissingPlayers ? 'Adding...' : 'Add and Select'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default SessionForm
