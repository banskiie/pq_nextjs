'use client';

import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { gql } from '@apollo/client'
import { useMutation, useQuery } from '@apollo/client/react'
import { createPusherClient } from '@/lib/pusherClient'
import { PUSHER_CHANNEL, PUSHER_EVENTS } from '@/lib/pusherEvents'
import MassAddPlayersModal from '@/components/MassAddPlayersModal'

const PLAYERS_QUERY = gql`
  query PlayersWithPagination($limit: Int!, $offset: Int!, $search: String, $skillLevel: String, $sortBy: String, $sortOrder: String) {
    playersPaginated(limit: $limit, offset: $offset, search: $search, skillLevel: $skillLevel, sortBy: $sortBy, sortOrder: $sortOrder) {
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
      total
    }
  }
`

const PLAYERS_COUNT_QUERY = gql`
  query PlayersCount($search: String, $skillLevel: String) {
    playersCount(search: $search, skillLevel: $skillLevel)
  }
`

const CREATE_PLAYER_MUTATION = gql`
  mutation CreatePlayer($input: CreatePlayerInput!) {
    createPlayer(input: $input) {
      ok
      message
      player {
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
  }
`

const DELETE_PLAYER_MUTATION = gql`
  mutation DeletePlayer($id: ID!) {
    deletePlayer(id: $id) {
      ok
      message
    }
  }
`

const UPDATE_PLAYER_MUTATION = gql`
  mutation UpdatePlayer($id: ID!, $input: UpdatePlayerInput!) {
    updatePlayer(id: $id, input: $input) {
      ok
      message
      player {
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
  }
`

const DELETED_PLAYERS_QUERY = gql`
  query DeletedPlayers {
    deletedPlayers {
      _id
      name
      gender
      playerLevel
      playCount
      winCount
      lossCount
      winRate
      createdAt
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
      }
    }
  }
`

const PLAYER_LEVELS = {
  BEGINNER: 'Beginner',
  INTERMEDIATE: 'Intermediate',
  UPPERINTERMEDIATE: 'Upper Intermediate',
  ADVANCED: 'Advanced',
}

const formatGender = (gender) => {
  if (gender === 'MALE') return '♂ Male'
  if (gender === 'FEMALE') return '♀ Female'
  if (gender === 'OTHER') return 'Other'
  return 'Not set'
}

const formatPlayerLevel = (playerLevel) => {
  return PLAYER_LEVELS[playerLevel] || playerLevel || 'Not set'
}

const getPlayerErrorMessage = (error) => {
  const graphQLErrors = [
    ...(error?.graphQLErrors || []),
    ...(error?.errors || []),
    ...(error?.cause?.graphQLErrors || []),
  ]

  const fieldErrors = graphQLErrors.flatMap((gqlError) => gqlError?.extensions?.fields || [])

  if (fieldErrors.length > 0) {
    const duplicateNameError = fieldErrors.find(
      (field) => field?.path === 'name' && /exist/i.test(field?.message || '')
    )

    if (duplicateNameError) {
      return 'An active player with this name already exists. Please input a unique name.'
    }

    return fieldErrors
      .map((field) => `${field.path}: ${field.message}`)
      .join('\n')
  }

  if (/validation failed/i.test(error?.message || '')) {
    return 'Please review the player details and try again.'
  }

  return error?.message || 'Failed to save player.'
}

// Memoized player row component to prevent unnecessary re-renders
const PlayerRow = React.memo(({
  player,
  selectedPlayerIds,
  expandedPlayerId,
  isPlayerInOngoingMatch,
  onCheckboxChange,
  onNameClick,
  onEditClick,
  onDeleteClick,
}) => {
  return (
    <React.Fragment key={player._id}>
      <tr className="border-b border-white/10 transition hover:bg-white/5">
        <td className="px-2 sm:px-3.5 py-2 text-center">
          <input
            id={`players-select-${player._id}`}
            name="playersSelected"
            type="checkbox"
            checked={selectedPlayerIds.has(player._id)}
            onChange={() => onCheckboxChange(player._id)}
            disabled={isPlayerInOngoingMatch(player._id)}
            title={isPlayerInOngoingMatch(player._id) ? 'Player is in a match or queue' : ''}
            className={`w-4 h-4 rounded border-2 transition cursor-pointer ${
              isPlayerInOngoingMatch(player._id)
                ? 'border-slate-600 bg-slate-700 cursor-not-allowed opacity-50'
                : 'border-rose-500/50 bg-slate-800 checked:bg-rose-500 checked:border-rose-500 focus:ring-2 focus:ring-rose-500/50'
            }`}
          />
        </td>
        <td 
          className="px-2 sm:px-3.5 py-2 text-xs sm:text-sm text-white cursor-pointer hover:text-blue-300 transition sm:cursor-default sm:hover:text-white font-medium"
          onClick={() => onNameClick(player._id)}
        >
          <div className="flex items-center justify-between sm:justify-start">
            <div className="flex flex-col">
              <span>{player.name?.toUpperCase()}</span>
              {/* Mobile stats preview */}
              <span className="sm:hidden text-slate-400 text-xs mt-0.5">
                {player.playCount || 0} games • {player.winCount || 0}W • {player.lossCount || 0}L
              </span>
            </div>
            <span className="sm:hidden text-slate-400">
              {expandedPlayerId === player._id ? '▼' : '▶'}
            </span>
          </div>
        </td>
        <td className="px-2 sm:px-3.5 py-2 hidden sm:table-cell">
          <span className="inline-flex items-center rounded-full bg-slate-800/50 px-2 py-0.5 text-xs text-slate-200">
            {formatGender(player.gender)}
          </span>
        </td>
        <td className="px-2 sm:px-3.5 py-2 hidden sm:table-cell">
          <span className="inline-flex items-center rounded-full bg-blue-500/20 px-2 py-0.5 text-xs text-blue-200">
            {formatPlayerLevel(player.playerLevel)}
          </span>
        </td>
        <td className="px-2 sm:px-3.5 py-2 text-center text-xs sm:text-sm text-white hidden md:table-cell">
          {player.playCount || 0}
        </td>
        <td className="px-2 sm:px-3.5 py-2 text-center text-xs sm:text-sm text-emerald-200 hidden md:table-cell">
          {player.winCount || 0}
        </td>
        <td className="px-2 sm:px-3.5 py-2 text-center text-xs sm:text-sm text-rose-200 hidden md:table-cell">
          {player.lossCount || 0}
        </td>
        <td className="px-2 sm:px-3.5 py-2 text-center hidden md:table-cell">
          <span className="inline-flex items-center rounded-full bg-amber-500/20 px-2 py-0.5 text-xs text-amber-200">
            {player.winRate || 0}%
          </span>
        </td>
        <td className="px-2 sm:px-3.5 py-2 text-center">
          <div className="flex gap-0.5 sm:gap-1 justify-center flex-wrap">
            <button
              onClick={() => onEditClick(player)}
              className="inline-flex items-center justify-center rounded bg-blue-500/20 px-2 py-0.5 text-xs text-blue-200 transition hover:bg-blue-500/30 whitespace-nowrap"
            >
              Edit
            </button>
            <button
              onClick={() => onDeleteClick(player._id)}
              disabled={isPlayerInOngoingMatch(player._id)}
              title={isPlayerInOngoingMatch(player._id) ? 'Cannot delete player currently in a match' : 'Delete player'}
              className={`inline-flex items-center justify-center rounded px-2 py-0.5 text-xs transition whitespace-nowrap ${
                isPlayerInOngoingMatch(player._id)
                  ? 'bg-slate-600/20 text-slate-400 cursor-not-allowed'
                  : 'bg-rose-500/20 text-rose-200 hover:bg-rose-500/30'
              }`}
            >
              Delete
            </button>
          </div>
        </td>
      </tr>
      
      {/* Mobile expandable details row */}
      {expandedPlayerId === player._id && (
        <tr className="bg-slate-800/30 border-b border-white/10 sm:hidden">
          <td colSpan={2} className="px-2 py-3">
            <div className="space-y-2 text-xs">
              <div className="flex justify-between items-center border-b border-white/10 pb-2">
                <span className="text-slate-400">Gender:</span>
                <span className="text-white">
                  {formatGender(player.gender)}
                </span>
              </div>
              <div className="flex justify-between items-center border-b border-white/10 pb-2">
                <span className="text-slate-400">Skill Level:</span>
                <span className="text-blue-200">
                  {formatPlayerLevel(player.playerLevel)}
                </span>
              </div>
              <div className="flex justify-between items-center border-b border-white/10 pb-2">
                <span className="text-slate-400">Games:</span>
                <span className="text-white">{player.playCount || 0}</span>
              </div>
              <div className="flex justify-between items-center border-b border-white/10 pb-2">
                <span className="text-slate-400">Wins:</span>
                <span className="text-emerald-200">{player.winCount || 0}</span>
              </div>
              <div className="flex justify-between items-center border-b border-white/10 pb-2">
                <span className="text-slate-400">Losses:</span>
                <span className="text-rose-200">{player.lossCount || 0}</span>
              </div>
              <div className="flex justify-between items-center pt-2">
                <span className="text-slate-400">Win Rate:</span>
                <span className="text-amber-200">{player.winRate || 0}%</span>
              </div>
            </div>
          </td>
        </tr>
      )}

      {/* Tablet expandable details row (for hidden stats on md breakpoint) */}
      {expandedPlayerId === player._id && (
        <tr className="bg-slate-800/30 border-b border-white/10 hidden sm:table-row md:hidden">
          <td colSpan={4} className="px-2 py-3">
            <div className="space-y-2 text-xs">
              <div className="flex justify-between items-center border-b border-white/10 pb-2">
                <span className="text-slate-400">Games:</span>
                <span className="text-white">{player.playCount || 0}</span>
              </div>
              <div className="flex justify-between items-center border-b border-white/10 pb-2">
                <span className="text-slate-400">Wins:</span>
                <span className="text-emerald-200">{player.winCount || 0}</span>
              </div>
              <div className="flex justify-between items-center border-b border-white/10 pb-2">
                <span className="text-slate-400">Losses:</span>
                <span className="text-rose-200">{player.lossCount || 0}</span>
              </div>
              <div className="flex justify-between items-center pt-2">
                <span className="text-slate-400">Win Rate:</span>
                <span className="text-amber-200">{player.winRate || 0}%</span>
              </div>
            </div>
          </td>
        </tr>
      )}
    </React.Fragment>
  )
})

PlayerRow.displayName = 'PlayerRow'

const PlayersPage = ({ onPlayersUpdated, ongoingMatches = {}, matchQueue = {} }) => {
  const [formData, setFormData] = useState({
    name: '',
    gender: '',
    playerLevel: '',
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [sortBy, setSortBy] = useState('')
  const [sortColumn, setSortColumn] = useState('name')
  const [sortDirection, setSortDirection] = useState('asc')
  const [editingPlayer, setEditingPlayer] = useState(null)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [isMassAddModalOpen, setIsMassAddModalOpen] = useState(false)
  const [isAddSuccessModalOpen, setIsAddSuccessModalOpen] = useState(false)
  const [addedPlayerName, setAddedPlayerName] = useState('')
  const [isEditSuccessModalOpen, setIsEditSuccessModalOpen] = useState(false)
  const [editedPlayerName, setEditedPlayerName] = useState('')
  const [isErrorModalOpen, setIsErrorModalOpen] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [isDeleteConfirmModalOpen, setIsDeleteConfirmModalOpen] = useState(false)
  const [playerToDelete, setPlayerToDelete] = useState(null)
  const [playerNameToDelete, setPlayerNameToDelete] = useState('')
  const [editFormData, setEditFormData] = useState({
    name: '',
    gender: '',
    playerLevel: '',
  })
  const [currentPage, setCurrentPage] = useState(1)
  const [playersState, setPlayersState] = useState([])
  const [selectedPlayerIds, setSelectedPlayerIds] = useState(new Set())
  const [isBulkDeleteConfirmModalOpen, setIsBulkDeleteConfirmModalOpen] = useState(false)
  const [bulkDeletePlayerNames, setBulkDeletePlayerNames] = useState('')
  const [bulkDeleteCount, setBulkDeleteCount] = useState(0)
  const headerCheckboxRef = useRef(null)
  const playersPerPage = 10
  const [expandedPlayerId, setExpandedPlayerId] = useState(null)
  const [isArchivedModalOpen, setIsArchivedModalOpen] = useState(false)
  const [deletedPlayersState, setDeletedPlayersState] = useState([])
  const [isRestoreConfirmModalOpen, setIsRestoreConfirmModalOpen] = useState(false)
  const [playerToRestore, setPlayerToRestore] = useState(null)
  const [playerNameToRestore, setPlayerNameToRestore] = useState('')
  const [isRestoreRenameModalOpen, setIsRestoreRenameModalOpen] = useState(false)
  const [restoreRenameValue, setRestoreRenameValue] = useState('')
  const [restoreRenameError, setRestoreRenameError] = useState('')
  const [restoreRenameTarget, setRestoreRenameTarget] = useState(null)
  const [restoreRenameContext, setRestoreRenameContext] = useState('list')
  const [isArchivedNameConflictModalOpen, setIsArchivedNameConflictModalOpen] = useState(false)
  const [archivedNameConflictPlayer, setArchivedNameConflictPlayer] = useState(null)
  const [pendingCreateInput, setPendingCreateInput] = useState(null)
  const [totalPlayersCount, setTotalPlayersCount] = useState(0)
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('')
  const debounceTimerRef = useRef(null)
  
  // Debounce search input (300ms delay)
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }
    
    debounceTimerRef.current = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm)
      setCurrentPage(1) // Reset to page 1 when search changes
    }, 300)
    
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [searchTerm])
  
  // GraphQL queries for lazy loading with filters
  const { data: playersData, loading: playersLoading, refetch: refetchPlayers } = useQuery(PLAYERS_QUERY, {
    variables: {
      limit: playersPerPage,
      offset: (currentPage - 1) * playersPerPage,
      search: debouncedSearchTerm || null,
      skillLevel: sortBy || null,
      sortBy: sortColumn,
      sortOrder: sortDirection,
    },
  })

  const { data: countData, refetch: refetchCount } = useQuery(PLAYERS_COUNT_QUERY, {
    variables: {
      search: debouncedSearchTerm || null,
      skillLevel: sortBy || null,
    },
  })

  const { data: deletedPlayersData, loading: deletedPlayersLoading, refetch: refetchDeletedPlayers } = useQuery(DELETED_PLAYERS_QUERY)

  const { data: playerUpdateData } = { data: null } // replaced by Pusher below

  useEffect(() => {
    const pusher = createPusherClient()
    if (!pusher) return undefined
    const channel = pusher.subscribe(PUSHER_CHANNEL)
    const handlePlayerEvent = () => {
      refetchPlayers()
      refetchCount()
      refetchDeletedPlayers()
    }
    channel.bind(PUSHER_EVENTS.PLAYER, handlePlayerEvent)

    return () => {
      channel.unbind(PUSHER_EVENTS.PLAYER, handlePlayerEvent)
      pusher.unsubscribe(PUSHER_CHANNEL)
      pusher.disconnect()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (countData?.playersCount) {
      setTotalPlayersCount(countData.playersCount)
    }
  }, [countData])

  useEffect(() => {
    if (deletedPlayersData?.deletedPlayers) {
      setDeletedPlayersState(deletedPlayersData.deletedPlayers)
    }
  }, [deletedPlayersData])

  useEffect(() => {
    if (playersData?.playersPaginated?.players) {
      setPlayersState(playersData.playersPaginated.players)
    }
  }, [playersData])

  const displayedPlayers = useMemo(() => {
    const sorted = [...playersState]
    const direction = sortDirection === 'asc' ? 1 : -1

    sorted.sort((a, b) => {
      if (sortColumn === 'name') {
        return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }) * direction
      }

      if (sortColumn === 'playCount' || sortColumn === 'winCount' || sortColumn === 'lossCount' || sortColumn === 'winRate') {
        const aNum = Number(a[sortColumn] ?? 0)
        const bNum = Number(b[sortColumn] ?? 0)
        return (aNum - bNum) * direction
      }

      if (sortColumn === 'createdAt') {
        const aDate = new Date(a.createdAt || 0).getTime()
        const bDate = new Date(b.createdAt || 0).getTime()
        return (aDate - bDate) * direction
      }

      const aValue = String(a[sortColumn] ?? '')
      const bValue = String(b[sortColumn] ?? '')
      return aValue.localeCompare(bValue, undefined, { sensitivity: 'base' }) * direction
    })

    return sorted
  }, [playersState, sortColumn, sortDirection])
  const filteredPlayers = displayedPlayers
  const totalPages = Math.ceil(totalPlayersCount / playersPerPage)
  const paginatedPlayers = displayedPlayers

  const [createPlayer] = useMutation(CREATE_PLAYER_MUTATION, {
    onCompleted: (data) => {
      if (data.createPlayer.ok) {
        const createdName = data.createPlayer.player?.name || formData.name.trim()
        setFormData({ name: '', gender: '', playerLevel: '' })
        setIsAddModalOpen(false)
        setAddedPlayerName(createdName)
        setIsAddSuccessModalOpen(true)
        if (onPlayersUpdated) {
          onPlayersUpdated()
        }
      } else {
        setErrorMessage(data.createPlayer.message)
        setIsErrorModalOpen(true)
      }
      setIsSubmitting(false)
    },
  })

  const [deletePlayer] = useMutation(DELETE_PLAYER_MUTATION, {
    onCompleted: (data) => {
      if (data.deletePlayer.ok) {
        if (onPlayersUpdated) {
          onPlayersUpdated()
        }
        // Success - no modal needed for delete
      } else {
        setErrorMessage(data.deletePlayer.message)
        setIsErrorModalOpen(true)
      }
    },
    onError: (error) => {
      setErrorMessage(error.message)
      setIsErrorModalOpen(true)
    },
  })

  const [restorePlayer] = useMutation(RESTORE_PLAYER_MUTATION)

  const [updatePlayer] = useMutation(UPDATE_PLAYER_MUTATION, {
    onCompleted: (data) => {
      if (data.updatePlayer.ok) {
        const updatedName = data.updatePlayer.player?.name || editFormData.name.trim()
        setIsEditModalOpen(false)
        setEditingPlayer(null)
        setEditFormData({ name: '', gender: '', playerLevel: '' })
        setEditedPlayerName(updatedName)
        setIsEditSuccessModalOpen(true)
        if (onPlayersUpdated) {
          onPlayersUpdated()
        }
      } else {
        setErrorMessage(data.updatePlayer.message)
        setIsErrorModalOpen(true)
      }
    },
    onError: (error) => {
      setErrorMessage(error.message)
      setIsErrorModalOpen(true)
    },
  })

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!formData.name.trim()) {
      setErrorMessage('Please enter a player name')
      setIsErrorModalOpen(true)
      return
    }

    const normalizedName = formData.name.trim().toLowerCase()
    const matchingArchivedPlayer = deletedPlayersState.find(
      (player) => player?.name?.trim().toLowerCase() === normalizedName
    )

    if (matchingArchivedPlayer) {
      setPendingCreateInput({
        name: formData.name.trim(),
        gender: formData.gender || null,
        playerLevel: formData.playerLevel || null,
      })
      setArchivedNameConflictPlayer(matchingArchivedPlayer)
      setIsArchivedNameConflictModalOpen(true)
      return
    }

    setIsSubmitting(true)
    try {
      await createPlayer({
        variables: {
          input: {
            name: formData.name.trim(),
            gender: formData.gender || null,
            playerLevel: formData.playerLevel || null,
          },
        },
      })
    } catch (error) {
      setErrorMessage(getPlayerErrorMessage(error))
      setIsErrorModalOpen(true)
      setIsSubmitting(false)
    }
  }

  const handleCreateNewPlayerAnyway = async () => {
    if (!pendingCreateInput || isSubmitting) return

    setIsArchivedNameConflictModalOpen(false)
    setArchivedNameConflictPlayer(null)
    setIsSubmitting(true)

    try {
      await createPlayer({
        variables: {
          input: pendingCreateInput,
        },
      })
    } catch (error) {
      setErrorMessage(getPlayerErrorMessage(error))
      setIsErrorModalOpen(true)
      setIsSubmitting(false)
    } finally {
      setPendingCreateInput(null)
    }
  }

  const completeRestoreFlow = async (restoredId, context) => {
    if (restoredId) {
      setDeletedPlayersState(prev => prev.filter(p => p._id !== restoredId))
    }

    await Promise.all([refetchPlayers(), refetchCount(), refetchDeletedPlayers()])

    if (context === 'add-conflict') {
      setIsArchivedNameConflictModalOpen(false)
      setArchivedNameConflictPlayer(null)
      setPendingCreateInput(null)
      setFormData({ name: '', gender: '', playerLevel: '' })
      setIsAddModalOpen(false)
    }

    setIsRestoreConfirmModalOpen(false)
    setPlayerToRestore(null)
    setPlayerNameToRestore('')
    setIsRestoreRenameModalOpen(false)
    setRestoreRenameValue('')
    setRestoreRenameError('')
    setRestoreRenameTarget(null)
    setRestoreRenameContext('list')

    if (onPlayersUpdated) onPlayersUpdated()
  }

  const openRestoreRenameModal = (player, context, message) => {
    setIsRestoreConfirmModalOpen(false)
    setRestoreRenameTarget(player)
    setRestoreRenameContext(context)
    setRestoreRenameValue(player?.name || '')
    setRestoreRenameError(message || 'An active player with this name already exists. Enter a new name to restore this player.')
    setIsRestoreRenameModalOpen(true)
  }

  const handleRestoreArchivedFromAdd = async () => {
    if (!archivedNameConflictPlayer?._id || isSubmitting) return

    setIsSubmitting(true)

    try {
      const result = await restorePlayer({ variables: { id: archivedNameConflictPlayer._id } })
      const payload = result?.data?.restorePlayer

      if (!payload?.ok) {
        if ((payload?.message || '').toLowerCase().includes('enter a new name')) {
          openRestoreRenameModal(archivedNameConflictPlayer, 'add-conflict', payload.message)
        } else {
          setErrorMessage(payload?.message || 'Failed to restore archived player')
          setIsErrorModalOpen(true)
        }
        return
      }

      await completeRestoreFlow(payload?.player?._id, 'add-conflict')
    } catch (error) {
      setErrorMessage(error.message || 'Failed to restore archived player')
      setIsErrorModalOpen(true)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCancelArchivedNameConflict = () => {
    setIsArchivedNameConflictModalOpen(false)
    setArchivedNameConflictPlayer(null)
    setPendingCreateInput(null)
  }

  const handleDelete = (playerId) => {
    const playerName = displayedPlayers.find(p => p._id === playerId)?.name || 'Unknown'
    setPlayerToDelete(playerId)
    setPlayerNameToDelete(playerName)
    setIsDeleteConfirmModalOpen(true)
  }

  const handleConfirmDelete = async () => {
    if (playerToDelete) {
      await deletePlayer({
        variables: { id: playerToDelete },
      })
      setIsDeleteConfirmModalOpen(false)
      setPlayerToDelete(null)
      setPlayerNameToDelete('')
    }
  }

  const handleCancelDelete = () => {
    setIsDeleteConfirmModalOpen(false)
    setPlayerToDelete(null)
    setPlayerNameToDelete('')
  }

  const handleRestoreClick = (player) => {
    setPlayerToRestore(player._id)
    setPlayerNameToRestore(player.name)
    setIsRestoreConfirmModalOpen(true)
  }

  const handleConfirmRestore = async () => {
    if (playerToRestore) {
      try {
        const deletedPlayer = deletedPlayersState.find((player) => player._id === playerToRestore)
        const result = await restorePlayer({ variables: { id: playerToRestore } })
        const payload = result?.data?.restorePlayer

        if (!payload?.ok) {
          if ((payload?.message || '').toLowerCase().includes('enter a new name')) {
            openRestoreRenameModal(
              deletedPlayer || { _id: playerToRestore, name: playerNameToRestore },
              'list',
              payload.message,
            )
          } else {
            setErrorMessage(payload?.message || 'Failed to restore player')
            setIsErrorModalOpen(true)
          }
          return
        }

        await completeRestoreFlow(payload?.player?._id, 'list')
      } catch (error) {
        setErrorMessage(error.message || 'Failed to restore player')
        setIsErrorModalOpen(true)
      }
    }
  }

  const handleCancelRestore = () => {
    setIsRestoreConfirmModalOpen(false)
    setPlayerToRestore(null)
    setPlayerNameToRestore('')
  }

  const handleConfirmRestoreRename = async () => {
    if (!restoreRenameTarget?._id || isSubmitting) return

    const nextName = restoreRenameValue.trim()
    if (!nextName) {
      setRestoreRenameError('Please enter a new name before restoring.')
      return
    }

    setIsSubmitting(true)
    setRestoreRenameError('')

    try {
      const result = await restorePlayer({
        variables: { id: restoreRenameTarget._id, name: nextName },
      })
      const payload = result?.data?.restorePlayer

      if (!payload?.ok) {
        setRestoreRenameError(payload?.message || 'Failed to restore player with the new name.')
        return
      }

      await completeRestoreFlow(payload?.player?._id, restoreRenameContext)
    } catch (error) {
      setRestoreRenameError(error.message || 'Failed to restore player with the new name.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCancelRestoreRename = () => {
    setIsRestoreRenameModalOpen(false)
    setRestoreRenameValue('')
    setRestoreRenameError('')
    setRestoreRenameTarget(null)
    setRestoreRenameContext('list')
  }

  const isPlayerInOngoingMatch = useCallback((playerId) => {
    const allMatches = Object.values(ongoingMatches).flat()
    const inMatch = allMatches.some((match) => {
      const playerIds = match.playerIds || []
      return playerIds.includes(playerId)
    })
    if (inMatch) return true
    const allQueued = Object.values(matchQueue).flat()
    return allQueued.some((match) => {
      const playerIds = match.playerIds || []
      return playerIds.includes(playerId)
    })
  }, [ongoingMatches, matchQueue])

  const handleEditClick = (player) => {
    setEditingPlayer(player)
    setEditFormData({
      name: player.name,
      gender: player.gender ?? '',
      playerLevel: player.playerLevel ?? '',
    })
    setIsEditModalOpen(true)
  }

  const handleBulkDeleteToggle = () => {
    if (selectedPlayerIds.size > 0) {
      // Show confirmation modal
      const playersToDelete = Array.from(selectedPlayerIds)
      const playerNames = playersToDelete
        .map(id => displayedPlayers.find(p => p._id === id)?.name)
        .filter(Boolean)
        .join(', ')
      
      setBulkDeletePlayerNames(playerNames)
      setBulkDeleteCount(playersToDelete.length)
      setIsBulkDeleteConfirmModalOpen(true)
    }
  }

  const handleConfirmBulkDelete = async () => {
    const playersToDelete = Array.from(selectedPlayerIds)
    setIsBulkDeleteConfirmModalOpen(false)
    
    try {
      // Delete all selected players
      for (const playerId of playersToDelete) {
        await deletePlayer({
          variables: { id: playerId },
        })
      }
      // Reset selection
      setSelectedPlayerIds(new Set())
    } catch (error) {
      console.error('Error deleting players:', error)
      setErrorMessage('Failed to delete some players. Please try again.')
      setIsErrorModalOpen(true)
    }
  }

  const handleCancelBulkDelete = () => {
    setIsBulkDeleteConfirmModalOpen(false)
    setBulkDeletePlayerNames('')
    setBulkDeleteCount(0)
  }

  const handlePlayerCheckboxChange = (playerId) => {
    setSelectedPlayerIds(prev => {
      const newSet = new Set(prev)
      if (newSet.has(playerId)) {
        newSet.delete(playerId)
      } else {
        newSet.add(playerId)
      }
      return newSet
    })
  }

  const handleSelectAllToggle = () => {
    // Get all players that can be selected (not in ongoing matches)
    const selectablePlayers = paginatedPlayers.filter(player => !isPlayerInOngoingMatch(player._id))
    const selectableIds = selectablePlayers.map(p => p._id)
    
    // Check if all selectable players are already selected
    const allSelected = selectableIds.every(id => selectedPlayerIds.has(id))
    
    if (allSelected) {
      // Unselect all from current page
      setSelectedPlayerIds(prev => {
        const newSet = new Set(prev)
        selectableIds.forEach(id => newSet.delete(id))
        return newSet
      })
    } else {
      // Select all from current page
      setSelectedPlayerIds(prev => {
        const newSet = new Set(prev)
        selectableIds.forEach(id => newSet.add(id))
        return newSet
      })
    }
  }

  const getHeaderCheckboxState = useCallback(() => {
    const selectablePlayers = paginatedPlayers.filter(player => !isPlayerInOngoingMatch(player._id))
    if (selectablePlayers.length === 0) return { checked: false, indeterminate: false }
    
    const selectedCount = selectablePlayers.filter(p => selectedPlayerIds.has(p._id)).length
    
    if (selectedCount === 0) {
      return { checked: false, indeterminate: false }
    } else if (selectedCount === selectablePlayers.length) {
      return { checked: true, indeterminate: false }
    } else {
      return { checked: false, indeterminate: true }
    }
  }, [paginatedPlayers, isPlayerInOngoingMatch, selectedPlayerIds])

  // Update header checkbox indeterminate state
  useEffect(() => {
    if (headerCheckboxRef.current) {
      const checkboxState = getHeaderCheckboxState()
      headerCheckboxRef.current.indeterminate = checkboxState.indeterminate
    }
  }, [selectedPlayerIds, currentPage, searchTerm, sortBy, getHeaderCheckboxState])

  const handleEditInputChange = (e) => {
    const { name, value } = e.target
    setEditFormData((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  const handleEditSubmit = async (e) => {
    e.preventDefault()
    if (!editFormData.name.trim()) {
      setErrorMessage('Please enter a player name')
      setIsErrorModalOpen(true)
      return
    }
    await updatePlayer({
      variables: {
        id: editingPlayer._id,
        input: {
          name: editFormData.name.trim(),
          gender: editFormData.gender || null,
          playerLevel: editFormData.playerLevel || null,
        },
      },
    })
  }

  // Handle column header click for sorting
  const handleSort = (column) => {
    if (sortColumn === column) {
      // Toggle direction if clicking the same column
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      // New column, default to ascending
      setSortColumn(column)
      setSortDirection('asc')
    }
  }

  // Reset to page 1 when search or sort changes
  useEffect(() => {
    setCurrentPage(1)
    // Also reset selection when filters change
    setSelectedPlayerIds(new Set())
  }, [debouncedSearchTerm, sortBy, sortColumn, sortDirection])

  return (
    <div className="space-y-6 py-5">
      <div className="mb-3 flex items-center justify-between gap-2 flex-wrap">
        <h3 className="text-base font-semibold text-white sm:text-lg">Players List</h3>
        <div className="flex gap-2 flex-wrap">
          {selectedPlayerIds.size > 0 && (
            <>
              <button
                onClick={() => setSelectedPlayerIds(new Set())}
                className="inline-flex items-center justify-center rounded-lg bg-slate-500/20 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-200 transition hover:bg-slate-500/30"
                title="Uncheck all players"
              >
                ☐ Uncheck All
              </button>
              <button
                onClick={handleBulkDeleteToggle}
                className="inline-flex items-center justify-center rounded-lg bg-rose-500/20 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-rose-200 transition hover:bg-rose-500/30"
                title={`Delete ${selectedPlayerIds.size} selected player(s)`}
              >
                🗑 Archive Selected({selectedPlayerIds.size})
              </button>
            </>
          )}
          <button
            onClick={() => setIsArchivedModalOpen(true)}
            className="inline-flex items-center justify-center rounded-lg bg-slate-500/20 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-200 transition hover:bg-slate-500/30"
          >
            🗂 View Archived{deletedPlayersState.length > 0 ? ` (${deletedPlayersState.length})` : ''}
          </button>
          <button
            onClick={() => setIsMassAddModalOpen(true)}
            className="inline-flex items-center justify-center rounded-lg bg-blue-500/20 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-blue-200 transition hover:bg-blue-500/30"
          >
            📥 Batch Add
          </button>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="inline-flex items-center justify-center rounded-lg bg-emerald-500/20 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-200 transition hover:bg-emerald-500/30"
          >
            + Add New Player
          </button>
        </div>
      </div>

      {/* Search and Sort Controls */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <input
          id="players-search"
          name="playersSearch"
          type="text"
          placeholder="Search by player name..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-white placeholder-slate-500 focus:border-white/30 focus:outline-none"
        />
        <select
          id="players-skill-filter"
          name="playersSkillFilter"
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-white focus:border-white/30 focus:outline-none"
        >
          <option value="" className='text-black'>All Skill Levels</option>
          {Object.entries(PLAYER_LEVELS).map(([key, label]) => (
            <option key={key} value={key} className='text-black'>
              {label}
            </option>
          ))}
        </select>
      </div>

      {/* Players Table */}
      <div className="overflow-x-auto rounded-lg border border-white/10 bg-slate-900/40">
        <table className="w-full text-sm sm:text-base">
          <thead>
            <tr className="border-b border-white/10 bg-slate-900/80">
              <th className="px-2 sm:px-3.5 py-2 text-center text-xs font-semibold text-slate-200 w-12">
                <input
                  id="players-select-all"
                  name="playersSelectAll"
                  ref={headerCheckboxRef}
                  type="checkbox"
                  checked={getHeaderCheckboxState().checked}
                  onChange={handleSelectAllToggle}
                  className="w-4 h-4 rounded border-2 border-rose-500/50 bg-slate-800 checked:bg-rose-500 checked:border-rose-500 focus:ring-2 focus:ring-rose-500/50 cursor-pointer transition"
                  title="Select/Deselect all players on this page"
                />
              </th>
              <th 
                className="px-2 sm:px-3.5 py-2 text-left text-xs sm:text-sm font-semibold text-slate-200 cursor-pointer hover:bg-slate-800/50 transition-colors select-none"
                onClick={() => handleSort('name')}
              >
                <div className="flex items-center gap-1">
                  Name
                  {sortColumn === 'name' && (
                    <span className="text-blue-400">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                  )}
                </div>
              </th>
              <th 
                className="px-2 sm:px-3.5 py-2 text-center sm:text-left text-xs sm:text-sm font-semibold text-slate-200 cursor-pointer hover:bg-slate-800/50 transition-colors select-none hidden sm:table-cell"
                onClick={() => handleSort('gender')}
              >
                <div className="flex items-center gap-1">
                  Gender
                  {sortColumn === 'gender' && (
                    <span className="text-blue-400">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                  )}
                </div>
              </th>
              <th 
                className="px-2 sm:px-3.5 py-2 text-center sm:text-left text-xs sm:text-sm font-semibold text-slate-200 cursor-pointer hover:bg-slate-800/50 transition-colors select-none hidden sm:table-cell"
                onClick={() => handleSort('playerLevel')}
              >
                <div className="flex items-center gap-1">
                  Skill Level
                  {sortColumn === 'playerLevel' && (
                    <span className="text-blue-400">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                  )}
                </div>
              </th>
              <th 
                className="px-2 sm:px-3.5 py-2 text-center text-xs sm:text-sm font-semibold text-slate-200 cursor-pointer hover:bg-slate-800/50 transition-colors select-none hidden md:table-cell"
                onClick={() => handleSort('playCount')}
              >
                <div className="flex items-center justify-center gap-1">
                  Games
                  {sortColumn === 'playCount' && (
                    <span className="text-blue-400">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                  )}
                </div>
              </th>
              <th 
                className="px-2 sm:px-3.5 py-2 text-center text-xs sm:text-sm font-semibold text-slate-200 cursor-pointer hover:bg-slate-800/50 transition-colors select-none hidden md:table-cell"
                onClick={() => handleSort('winCount')}
              >
                <div className="flex items-center justify-center gap-1">
                  Wins
                  {sortColumn === 'winCount' && (
                    <span className="text-blue-400">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                  )}
                </div>
              </th>
              <th 
                className="px-2 sm:px-3.5 py-2 text-center text-xs sm:text-sm font-semibold text-slate-200 cursor-pointer hover:bg-slate-800/50 transition-colors select-none hidden md:table-cell"
                onClick={() => handleSort('lossCount')}
              >
                <div className="flex items-center justify-center gap-1">
                  Losses
                  {sortColumn === 'lossCount' && (
                    <span className="text-blue-400">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                  )}
                </div>
              </th>
              <th 
                className="px-2 sm:px-3.5 py-2 text-center text-xs sm:text-sm font-semibold text-slate-200 cursor-pointer hover:bg-slate-800/50 transition-colors select-none hidden md:table-cell"
                onClick={() => handleSort('winRate')}
              >
                <div className="flex items-center justify-center gap-1">
                  Win Rate
                  {sortColumn === 'winRate' && (
                    <span className="text-blue-400">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                  )}
                </div>
              </th>
              <th className="px-2 sm:px-3.5 py-2 text-center text-xs sm:text-sm font-semibold text-slate-200">
                Action
              </th>
            </tr>
          </thead>
          <tbody>
            {playersLoading && (
              <tr>
                <td colSpan={10} className="px-3.5 py-8 text-center text-sm text-slate-400">
                  Loading players...
                </td>
              </tr>
            )}
            {!playersLoading && filteredPlayers && filteredPlayers.length > 0 ? (
              paginatedPlayers.map((player) => (
                <PlayerRow
                  key={player._id}
                  player={player}
                  selectedPlayerIds={selectedPlayerIds}
                  expandedPlayerId={expandedPlayerId}
                  isPlayerInOngoingMatch={isPlayerInOngoingMatch}
                  onCheckboxChange={handlePlayerCheckboxChange}
                  onNameClick={(playerId) => setExpandedPlayerId(expandedPlayerId === playerId ? null : playerId)}
                  onEditClick={handleEditClick}
                  onDeleteClick={handleDelete}
                />
              ))
            ) : (
              <tr>
                <td
                  colSpan={9}
                  className="px-3.5 py-4 text-center text-sm text-slate-400"
                >
                  No players found. Add a player to get started.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>


      {displayedPlayers && displayedPlayers.length > 0 && (
        <div className="space-y-4">
          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 rounded-lg border border-white/10 bg-slate-900/40 p-3 sm:p-4">
              <button
                onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                disabled={currentPage === 1 || playersLoading}
                className="rounded-lg bg-slate-700 px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-white transition hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
              >
                ← Prev
              </button>
              <div className="flex items-center gap-1 sm:gap-2 flex-wrap justify-center">
                {playersLoading && (
                  <span className="text-xs text-slate-400">Loading...</span>
                )}
                {!playersLoading && (() => {
                  const maxButtonsToShow = window.innerWidth < 640 ? 5 : 7
                  let startPage = Math.max(1, currentPage - Math.floor(maxButtonsToShow / 2))
                  let endPage = Math.min(totalPages, startPage + maxButtonsToShow - 1)
                  
                  if (endPage - startPage + 1 < maxButtonsToShow) {
                    startPage = Math.max(1, endPage - maxButtonsToShow + 1)
                  }
                  
                  return Array.from({ length: endPage - startPage + 1 }, (_, i) => startPage + i).map((page) => (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      disabled={playersLoading}
                      className={`h-7 w-7 sm:h-8 sm:w-8 rounded-lg text-xs sm:text-sm font-semibold transition ${
                        currentPage === page
                          ? 'bg-emerald-500/20 text-emerald-200'
                          : 'bg-slate-700 text-white hover:bg-slate-600 disabled:opacity-50'
                      }`}
                    >
                      {page}
                    </button>
                  ))
                })()}
              </div>
              <button
                onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages || playersLoading}
                className="rounded-lg bg-slate-700 px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-white transition hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
              >
                Next →
              </button>
            </div>
          )}

          <div className="rounded-lg border border-white/10 bg-slate-900/40 p-4">
            <p className="text-sm text-slate-300">
              Page <span className="font-semibold text-white">{currentPage}</span> of <span className="font-semibold text-white">{totalPages}</span> • Total Players: <span className="font-semibold text-white">{totalPlayersCount}</span>
            </p>
          </div>
        </div>
      )}

      {/* Archived Players Modal */}
      {isArchivedModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-6xl rounded-lg border border-amber-500/30 bg-slate-900 p-4 sm:p-6">
            <div className="mb-3 flex items-center justify-between">
              <h4 className="text-sm font-semibold text-amber-300">🗂 Archived Players</h4>
              <button
                onClick={() => setIsArchivedModalOpen(false)}
                className="text-xs text-slate-400 hover:text-white transition"
              >
                ✕ Close
              </button>
            </div>
            <div className="max-h-[70vh] overflow-auto rounded-lg border border-amber-500/20 bg-slate-900/40">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 bg-slate-900/80">
                    <th className="px-3.5 py-2 text-left text-xs font-semibold text-slate-200">Name</th>
                    <th className="px-3.5 py-2 text-left text-xs font-semibold text-slate-200 hidden sm:table-cell">Gender</th>
                    <th className="px-3.5 py-2 text-left text-xs font-semibold text-slate-200 hidden sm:table-cell">Skill Level</th>
                    <th className="px-3.5 py-2 text-center text-xs font-semibold text-slate-200 hidden md:table-cell">Games</th>
                    <th className="px-3.5 py-2 text-center text-xs font-semibold text-slate-200 hidden md:table-cell">W / L</th>
                    <th className="px-3.5 py-2 text-center text-xs font-semibold text-slate-200">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {deletedPlayersLoading ? (
                    <tr>
                      <td colSpan={6} className="px-3.5 py-6 text-center text-sm text-slate-400">Loading archived players...</td>
                    </tr>
                  ) : deletedPlayersState.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-3.5 py-6 text-center text-sm text-slate-400">No archived players.</td>
                    </tr>
                  ) : (
                    deletedPlayersState.map((player) => (
                      <tr key={player._id} className="border-b border-white/10 opacity-70 transition hover:bg-white/5 hover:opacity-100">
                        <td className="px-3.5 py-2 text-sm font-medium text-slate-300">{player.name?.toUpperCase()}</td>
                        <td className="hidden px-3.5 py-2 sm:table-cell">
                          <span className="inline-flex items-center rounded-full bg-slate-800/50 px-2 py-0.5 text-xs text-slate-200">
                            {player.gender === 'MALE' ? '♂ Male' : player.gender === 'FEMALE' ? '♀ Female' : '—'}
                          </span>
                        </td>
                        <td className="hidden px-3.5 py-2 sm:table-cell">
                          <span className="inline-flex items-center rounded-full bg-blue-500/20 px-2 py-0.5 text-xs text-blue-200">
                            {PLAYER_LEVELS[player.playerLevel] || player.playerLevel || '—'}
                          </span>
                        </td>
                        <td className="hidden px-3.5 py-2 text-center text-xs text-slate-300 md:table-cell">{player.playCount || 0}</td>
                        <td className="hidden px-3.5 py-2 text-center text-xs md:table-cell">
                          <span className="text-emerald-300">{player.winCount || 0}W</span>
                          {' / '}
                          <span className="text-rose-300">{player.lossCount || 0}L</span>
                        </td>
                        <td className="px-3.5 py-2 text-center">
                          <button
                            onClick={() => handleRestoreClick(player)}
                            className="inline-flex items-center justify-center rounded bg-emerald-500/20 px-2 py-0.5 text-xs text-emerald-200 transition hover:bg-emerald-500/30 whitespace-nowrap"
                          >
                            ↩ Restore
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Edit Player Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-lg border border-white/10 bg-slate-900 p-6">
            <h3 className="mb-4 text-lg font-semibold text-white">Add New Player</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div>
                  <label htmlFor="add-player-name" className="block text-sm font-medium text-slate-200">
                    Player Name <span className="text-red-400">*</span>
                  </label>
                  <input
                    id="add-player-name"
                    type="text"
                    name="name"
                    autoComplete="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    placeholder="Enter player name"
                    className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-white placeholder-slate-500 focus:border-white/30 focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="add-player-gender" className="block text-sm font-medium text-slate-200">
                    Gender
                  </label>
                  <select
                    id="add-player-gender"
                    name="gender"
                    autoComplete="sex"
                    value={formData.gender}
                    onChange={handleInputChange}
                    className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-white focus:border-white/30 focus:outline-none"
                  >
                    <option value="" className='text-black'>Not specified</option>
                    <option value="MALE" className='text-black'>Male</option>
                    <option value="FEMALE" className='text-black'>Female</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="add-player-level" className="block text-sm font-medium text-slate-200">
                    Skill Level
                  </label>
                  <select
                    id="add-player-level"
                    name="playerLevel"
                    autoComplete="off"
                    value={formData.playerLevel}
                    onChange={handleInputChange}
                    className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-white focus:border-white/30 focus:outline-none"
                  >
                    <option value="" className='text-black'>Not specified</option>
                    {Object.entries(PLAYER_LEVELS).map(([key, label]) => (
                      <option key={key} value={key} className='text-black'>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 rounded-lg bg-emerald-500/20 px-4 py-2 text-sm font-semibold text-emerald-200 transition hover:bg-emerald-500/30 disabled:opacity-50"
                >
                  {isSubmitting ? 'Adding...' : 'Add Player'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsAddModalOpen(false)
                    setFormData({ name: '', gender: '', playerLevel: '' })
                  }}
                  className="flex-1 rounded-lg bg-slate-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-600"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isEditModalOpen && editingPlayer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-lg border border-white/10 bg-slate-900 p-6">
            <h3 className="mb-4 text-lg font-semibold text-white">Edit Player</h3>
            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <label htmlFor="edit-player-name" className="block text-sm font-medium text-slate-200">
                  Player Name <span className="text-red-400">*</span>
                </label>
                <input
                  id="edit-player-name"
                  type="text"
                  name="name"
                  autoComplete="name"
                  value={editFormData.name}
                  onChange={handleEditInputChange}
                  placeholder="Enter player name"
                  className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-white placeholder-slate-500 focus:border-white/30 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label htmlFor="edit-player-gender" className="block text-sm font-medium text-slate-200">
                  Gender
                </label>
                <select
                  id="edit-player-gender"
                  name="gender"
                  autoComplete="sex"
                  value={editFormData.gender}
                  onChange={handleEditInputChange}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-white focus:border-white/30 focus:outline-none"
                >
                  <option value="" className='text-black'>Not specified</option>
                  <option value="MALE" className='text-black'>Male</option>
                  <option value="FEMALE" className='text-black'>Female</option>
                </select>
              </div>

              <div>
                <label htmlFor="edit-player-level" className="block text-sm font-medium text-slate-200">
                  Skill Level
                </label>
                <select
                  id="edit-player-level"
                  name="playerLevel"
                  autoComplete="off"
                  value={editFormData.playerLevel}
                  onChange={handleEditInputChange}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-white focus:border-white/30 focus:outline-none"
                >
                  <option value="" className='text-black'>Not specified</option>
                  {Object.entries(PLAYER_LEVELS).map(([key, label]) => (
                    <option key={key} value={key} className='text-black'>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-3">
                <button
                  type="submit"
                  className="flex-1 rounded-lg bg-emerald-500/20 px-4 py-2 text-sm font-semibold text-emerald-200 transition hover:bg-emerald-500/30"
                >
                  Save Changes
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsEditModalOpen(false)
                    setEditingPlayer(null)
                  }}
                  className="flex-1 rounded-lg bg-slate-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-600"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isArchivedNameConflictModalOpen && archivedNameConflictPlayer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-lg border border-amber-500/30 bg-slate-900 p-6">
            <h3 className="mb-2 text-lg font-semibold text-amber-300">Archived Player Found</h3>
            <p className="mb-4 text-sm text-slate-300">
              <span className="font-semibold text-white">{archivedNameConflictPlayer.name}</span> already exists in archived players.
            </p>
            <p className="mb-5 text-xs text-slate-400">
              You can restore the archived player or create a brand new active player with the same name.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleCancelArchivedNameConflict}
                disabled={isSubmitting}
                className="flex-1 rounded-lg bg-slate-700 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-slate-600 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateNewPlayerAnyway}
                disabled={isSubmitting}
                className="flex-1 rounded-lg bg-amber-500/20 px-4 py-2 text-sm font-semibold text-amber-200 transition hover:bg-amber-500/30 disabled:opacity-50"
              >
                Create New
              </button>
              <button
                type="button"
                onClick={handleRestoreArchivedFromAdd}
                disabled={isSubmitting}
                className="flex-1 rounded-lg bg-emerald-500/20 px-4 py-2 text-sm font-semibold text-emerald-200 transition hover:bg-emerald-500/30 disabled:opacity-50"
              >
                Restore
              </button>
            </div>
          </div>
        </div>
      )}

      {isAddSuccessModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-lg border border-white/10 bg-slate-900 p-6">
            <h3 className="mb-2 text-lg font-semibold text-white">Player Added</h3>
            <p className="mb-5 text-sm text-slate-300">
              Added ({addedPlayerName})
            </p>
            <button
              type="button"
              onClick={() => {
                setIsAddSuccessModalOpen(false)
                setAddedPlayerName('')
              }}
              className="w-full rounded-lg bg-emerald-500/20 px-4 py-2 text-sm font-semibold text-emerald-200 transition hover:bg-emerald-500/30"
            >
              OK
            </button>
          </div>
        </div>
      )}

      {isEditSuccessModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-lg border border-white/10 bg-slate-900 p-6">
            <h3 className="mb-2 text-lg font-semibold text-white">Player Updated</h3>
            <p className="mb-5 text-sm text-slate-300">
              Updated ({editedPlayerName})
            </p>
            <button
              type="button"
              onClick={() => {
                setIsEditSuccessModalOpen(false)
                setEditedPlayerName('')
              }}
              className="w-full rounded-lg bg-emerald-500/20 px-4 py-2 text-sm font-semibold text-emerald-200 transition hover:bg-emerald-500/30"
            >
              OK
            </button>
          </div>
        </div>
      )}

      {isErrorModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-lg border border-rose-500/30 bg-slate-900 p-6">
            <h3 className="mb-2 text-lg font-semibold text-rose-400">Error</h3>
            <p className="mb-5 whitespace-pre-line text-sm text-slate-300">
              {errorMessage}
            </p>
            <button
              type="button"
              onClick={() => {
                setIsErrorModalOpen(false)
                setErrorMessage('')
              }}
              className="w-full rounded-lg bg-rose-500/20 px-4 py-2 text-sm font-semibold text-rose-200 transition hover:bg-rose-500/30"
            >
              OK
            </button>
          </div>
        </div>
      )}

      {isDeleteConfirmModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-lg border border-rose-500/30 bg-slate-900 p-6">
            <h3 className="mb-2 text-lg font-semibold text-rose-400">Delete Player</h3>
            <p className="mb-5 text-sm text-slate-300">
              Are you sure you want to archive <span className="font-semibold text-white">{playerNameToDelete}</span>? The player will be hidden but can be restored later from the Archived section.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleCancelDelete}
                className="flex-1 rounded-lg bg-slate-700 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-slate-600"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="flex-1 rounded-lg bg-rose-500/20 px-4 py-2 text-sm font-semibold text-rose-200 transition hover:bg-rose-500/30"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {isBulkDeleteConfirmModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-lg border border-rose-500/30 bg-slate-900 p-6">
            <h3 className="mb-2 text-lg font-semibold text-rose-400">Archive Players</h3>
            <p className="mb-3 text-sm text-slate-300">
              Are you sure you want to archive <span className="font-semibold text-white">{bulkDeleteCount} player(s)</span>?
            </p>
            <div className="mb-5 max-h-32 overflow-y-auto rounded-lg border border-white/10 bg-slate-800/50 p-3">
              <p className="text-xs text-slate-400 mb-2">Players to be deleted:</p>
              <p className="text-sm text-white">{bulkDeletePlayerNames}</p>
            </div>
            <p className="mb-5 text-xs text-slate-400">Archived players can be restored later from the Archived section.</p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleCancelBulkDelete}
                className="flex-1 rounded-lg bg-slate-700 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-slate-600"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmBulkDelete}
                className="flex-1 rounded-lg bg-rose-500/20 px-4 py-2 text-sm font-semibold text-rose-200 transition hover:bg-rose-500/30"
              >
                Archive All
              </button>
            </div>
          </div>
        </div>
      )}

      {isRestoreConfirmModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-lg border border-emerald-500/30 bg-slate-900 p-6">
            <h3 className="mb-2 text-lg font-semibold text-emerald-400">Restore Player</h3>
            <p className="mb-5 text-sm text-slate-300">
              Restore <span className="font-semibold text-white">{playerNameToRestore}</span> to the active player list?
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleCancelRestore}
                className="flex-1 rounded-lg bg-slate-700 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-slate-600"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmRestore}
                className="flex-1 rounded-lg bg-emerald-500/20 px-4 py-2 text-sm font-semibold text-emerald-200 transition hover:bg-emerald-500/30"
              >
                Restore
              </button>
            </div>
          </div>
        </div>
      )}

      {isRestoreRenameModalOpen && restoreRenameTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-lg border border-amber-500/30 bg-slate-900 p-6">
            <h3 className="mb-2 text-lg font-semibold text-amber-300">Rename To Restore</h3>
            <p className="mb-4 text-sm text-slate-300">
              A player with this name already exists in the active list. Enter a new name for <span className="font-semibold text-white">{restoreRenameTarget.name}</span> before restoring.
            </p>
            <label htmlFor="players-restore-rename" className="mb-2 block text-sm font-medium text-slate-200">
              New Player Name
            </label>
            <input
              id="players-restore-rename"
              name="playersRestoreRename"
              type="text"
              autoComplete="name"
              value={restoreRenameValue}
              onChange={(e) => setRestoreRenameValue(e.target.value)}
              className="mb-3 w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-white placeholder-slate-500 focus:border-white/30 focus:outline-none"
              placeholder="Enter a new player name"
              autoFocus
            />
            {restoreRenameError && (
              <div className="mb-4 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200">
                {restoreRenameError}
              </div>
            )}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleCancelRestoreRename}
                disabled={isSubmitting}
                className="flex-1 rounded-lg bg-slate-700 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-slate-600 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmRestoreRename}
                disabled={isSubmitting}
                className="flex-1 rounded-lg bg-emerald-500/20 px-4 py-2 text-sm font-semibold text-emerald-200 transition hover:bg-emerald-500/30 disabled:opacity-50"
              >
                {isSubmitting ? 'Restoring...' : 'Rename and Restore'}
              </button>
            </div>
          </div>
        </div>
      )}

      <MassAddPlayersModal
        isOpen={isMassAddModalOpen}
        onClose={() => setIsMassAddModalOpen(false)}
        onPlayersUpdated={() => {
          // Refetch both queries to reflect newly added players
          refetchPlayers()
          refetchCount()
          if (onPlayersUpdated) {
            onPlayersUpdated()
          }
        }}
      />
    </div>
  )
}

export default PlayersPage
