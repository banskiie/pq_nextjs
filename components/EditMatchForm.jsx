'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useMutation, useQuery } from '@apollo/client/react'
import { gql } from '@apollo/client'
import { createPusherClient } from '@/lib/pusherClient'
import { PUSHER_CHANNEL, PUSHER_EVENTS } from '@/lib/pusherEvents'
import { DndContext, DragOverlay, useSensor, useSensors, MouseSensor, TouchSensor } from "@dnd-kit/core";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import useDebouncedValue from '@/hooks/useDebouncedValue'

const ADD_PLAYERS_TO_SESSION_MUTATION = gql`
  mutation AddPlayersToSession($id: ID!, $input: AddSessionPlayersInput!) {
    addPlayersToSession(id: $id, input: $input) {
      ok
      message
      session {
        _id
        players {
          playerId
          gamesPlayed
        }
      }
    }
  }
`;

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
      }
    }
  }
`;

const GAMES_BY_SESSION_QUERY = gql`
  query GamesBySession($sessionId: ID!) {
    gamesBySession(sessionId: $sessionId) {
      _id
      players
      winnerPlayerIds
    }
  }
`;

const PLAYERS_PER_PAGE = 12;

const TEAMMATE_COLOR_PALETTE = [
  { border: 'border-red-400/80', bg: 'bg-red-400/30', hover: 'hover:bg-red-400/45' },
  { border: 'border-blue-400/80', bg: 'bg-blue-400/30', hover: 'hover:bg-blue-400/45' },
  { border: 'border-orange-400/80', bg: 'bg-orange-400/30', hover: 'hover:bg-orange-400/45' },
  { border: 'border-purple-400/80', bg: 'bg-purple-400/30', hover: 'hover:bg-purple-400/45' },
  { border: 'border-pink-400/80', bg: 'bg-pink-400/30', hover: 'hover:bg-pink-400/45' },
  { border: 'border-amber-400/80', bg: 'bg-amber-400/30', hover: 'hover:bg-amber-400/45' },
  { border: 'border-fuchsia-400/80', bg: 'bg-fuchsia-400/30', hover: 'hover:bg-fuchsia-400/45' },
  { border: 'border-indigo-400/80', bg: 'bg-indigo-400/30', hover: 'hover:bg-indigo-400/45' },
  { border: 'border-violet-400/80', bg: 'bg-violet-400/30', hover: 'hover:bg-violet-400/45' },
  { border: 'border-rose-400/80', bg: 'bg-rose-400/30', hover: 'hover:bg-rose-400/45' },
  { border: 'border-sky-400/80', bg: 'bg-sky-400/30', hover: 'hover:bg-sky-400/45' },
  { border: 'border-cyan-400/80', bg: 'bg-cyan-400/30', hover: 'hover:bg-cyan-400/45' },
];

const getTeammateGroupHash = (teammateNames) => {
  if (!Array.isArray(teammateNames) || teammateNames.length === 0) return 0;

  const sorted = [...teammateNames].sort().join('');
  let hash = 0;
  for (let i = 0; i < sorted.length; i++) {
    const char = sorted.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash) % TEAMMATE_COLOR_PALETTE.length;
};

const buildTeammateTooltip = (teammateNames) => {
  if (!Array.isArray(teammateNames) || teammateNames.length === 0) {
    return "";
  }

  return `${teammateNames.join("\n")}`;
};

const COURT_STATUS_LABELS = {
  ACTIVE: "Available",
  OCCUPIED: "InUse",
  MAINTENANCE: "Maintenance",
};

const formatCourtStatus = (value) => COURT_STATUS_LABELS[value] ?? value;

const getSkillLevelTextColor = (skillLevel) => {
  switch (skillLevel) {
    case "BEGINNER":
      return "text-blue-300";
    case "INTERMEDIATE":
      return "text-yellow-300";
    case "UPPERINTERMEDIATE":
      return "text-violet-300";
    case "ADVANCED":
      return "text-rose-300";
    default:
      return "text-slate-300";
  }
};

const formatSkillLevelLabel = (skillLevel) => {
  switch (skillLevel) {
    case "UPPERINTERMEDIATE":
      return "Upper Intermediate";
    case "INTERMEDIATE":
      return "Intermediate";
    case "BEGINNER":
      return "Beginner";
    case "ADVANCED":
      return "Advanced";
    default:
      return skillLevel || "Not Set";
  }
};

const getTeammateGroupColor = (teammateGroupNames) => {
  if (!Array.isArray(teammateGroupNames) || teammateGroupNames.length <= 1) {
    return null;
  }
  const colorIndex = getTeammateGroupHash(teammateGroupNames);
  return TEAMMATE_COLOR_PALETTE[colorIndex];
};

// Draggable Player Card Component
const DraggablePlayer = ({
  player,
  isInUse,
  isAssignedToTeam,
  teammateNames = [],
  teammateGroupNames = [],
}) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: player._id,
  });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        opacity: isDragging ? 0.5 : 1,
      }
    : undefined;

  // Get color based on teammate group or status (not skill level)
  const getSkillColor = () => {
    if (teammateGroupNames.length > 1) {
      const colorIndex = getTeammateGroupHash(teammateGroupNames);
      const color = TEAMMATE_COLOR_PALETTE[colorIndex];
      return `${color.border} ${color.bg} ${color.hover}`;
    }

    if (isAssignedToTeam) return "border-emerald-500/30 bg-emerald-500/10";
    if (isInUse) return "border-amber-500/30 bg-amber-500/10";

    return "border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20";
  };

  const teammateTooltip = buildTeammateTooltip(teammateNames);
  const cardPulseClass = isInUse && !isAssignedToTeam ? "animate-pulse" : "";

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`group relative touch-none cursor-grab active:cursor-grabbing select-none rounded border px-2 py-1.5 text-center transition ${getSkillColor()} ${cardPulseClass}`}
      title={teammateTooltip || undefined}
    >
      <p className="truncate text-sm font-semibold text-white leading-tight">{player.name?.toUpperCase()}</p>
      <p className={`text-[10px] leading-tight ${getSkillLevelTextColor(player.playerLevel)}`}>
        Skill: {formatSkillLevelLabel(player.playerLevel)}
      </p>
      <p className="text-[9px] text-slate-400 leading-tight">Play count this session: {player.gamesPlayed ?? 0}</p>
      <p className="text-[9px] text-slate-500 leading-tight">{player.gender}</p>
      {isAssignedToTeam && <p className="mt-0.5 text-[9px] text-emerald-400 leading-tight">● In Team</p>}
      {isInUse && !isAssignedToTeam && <p className="mt-0.5 text-[9px] text-amber-400 leading-tight">● In Match/Queue</p>}
    </div>
  );
};

// Droppable Team Zone Component
const DroppableTeam = ({ teamNumber, children }) => {
  const { setNodeRef, isOver } = useDroppable({
    id: `team${teamNumber}`,
  });

  return (
    <div
      ref={setNodeRef}
      className={`rounded border p-3 transition min-h-20 ${
        teamNumber === 1
          ? `border-blue-300/30 bg-blue-500/10 ${isOver ? "bg-blue-500/20 border-blue-300/50" : ""}`
          : `border-rose-300/30 bg-rose-500/10 ${isOver ? "bg-rose-500/20 border-rose-300/50" : ""}`
      }`}
    >
      {children}
    </div>
  );
};

const EditMatchForm = ({ 
  match,
  courts,
  sessions = [],
  players,
  isOpen, 
  onClose, 
  onSubmit, 
  isLoading,
  ongoingMatches = {},
  matchQueue = {}
}) => {
  const [team1, setTeam1] = useState([])
  const [team2, setTeam2] = useState([])
  const [courtId, setCourtId] = useState('')
  const [showConfirm, setShowConfirm] = useState(false)
  const [activeDragId, setActiveDragId] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const debouncedSearchTerm = useDebouncedValue(searchTerm, 200)
  const [filterBySkill, setFilterBySkill] = useState('all')
  const [sortBySkill, setSortBySkill] = useState('none')
  const [showAvailableOnly, setShowAvailableOnly] = useState(false)
  const [showInUseOnly, setShowInUseOnly] = useState(false)
  const [showZeroPlayCountOnly, setShowZeroPlayCountOnly] = useState(false)
  const [currentPlayerPage, setCurrentPlayerPage] = useState(0)
  const [addPlayerSearch, setAddPlayerSearch] = useState('')
  const [addPlayerStatus, setAddPlayerStatus] = useState(null)
  const [addPlayerError, setAddPlayerError] = useState('')
  const [popupMessage, setPopupMessage] = useState('')
  const [showPopup, setShowPopup] = useState(false)
  const debouncedAddPlayerSearch = useDebouncedValue(addPlayerSearch, 200)

  const getErrorMessage = useCallback((error, fallbackMessage) => {
    const fromGraphQlFields = error?.graphQLErrors
      ?.flatMap((item) => item?.extensions?.fields || [])
      ?.find((field) => field?.message)?.message
    if (fromGraphQlFields) return fromGraphQlFields

    const fromNetworkFields = error?.networkError?.result?.errors
      ?.flatMap((item) => item?.extensions?.fields || [])
      ?.find((field) => field?.message)?.message
    if (fromNetworkFields) return fromNetworkFields

    const gqlMessage = error?.graphQLErrors?.[0]?.message
    if (gqlMessage && gqlMessage !== 'Validation failed.') return gqlMessage

    const networkMessage = error?.networkError?.result?.errors?.[0]?.message
    if (networkMessage && networkMessage !== 'Validation failed.') return networkMessage

    if (error?.message === 'Validation failed.' || error?.message?.includes('Validation failed')) {
      return fallbackMessage
    }

    if (error?.message) return error.message
    return fallbackMessage
  }, [])

  const showErrorPopup = useCallback((message) => {
    if (!message) return
    setPopupMessage(message)
    setShowPopup(true)
  }, [])

  const [addPlayersToSession] = useMutation(ADD_PLAYERS_TO_SESSION_MUTATION, {
    refetchQueries: ['Sessions'],
  })
  const [createPlayer] = useMutation(CREATE_PLAYER_MUTATION, {
    refetchQueries: ['Players'],
  })

  const selectedSession = sessions.find((session) => session._id === match?.sessionId)
  const selectedSessionId = selectedSession?._id || match?.sessionId || ''

  const { data: sessionGamesData, refetch: refetchGames } = useQuery(GAMES_BY_SESSION_QUERY, {
    variables: { sessionId: selectedSessionId },
    skip: !selectedSessionId,
    fetchPolicy: "cache-and-network",
  })

  useEffect(() => {
    const pusher = createPusherClient()
    if (!pusher) return undefined
    const channel = pusher.subscribe(PUSHER_CHANNEL)
    const handleGame = () => { refetchGames() }
    channel.bind(PUSHER_EVENTS.GAME, handleGame)
    return () => {
      channel.unbind(PUSHER_EVENTS.GAME, handleGame)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 150,
        tolerance: 8,
      },
    })
  );

  useEffect(() => {
    if (match && isOpen) {
      const playerIds = match.playerIds || []
      setCourtId(match.courtId || '')
      
      // Distribute existing players across teams
      if (playerIds.length === 2) {
        setTeam1([playerIds[0]])
        setTeam2([playerIds[1]])
      } else if (playerIds.length === 4) {
        setTeam1([playerIds[0], playerIds[1]])
        setTeam2([playerIds[2], playerIds[3]])
      } else {
        setTeam1([])
        setTeam2([])
      }
      setShowConfirm(false)
      setSearchTerm('')
      setActiveDragId(null)
      setFilterBySkill('all')
      setSortBySkill('none')
      setShowAvailableOnly(false)
      setShowInUseOnly(false)
      setShowZeroPlayCountOnly(false)
      setCurrentPlayerPage(0)
      setAddPlayerSearch('')
      setAddPlayerStatus(null)
      setAddPlayerError('')
      setPopupMessage('')
      setShowPopup(false)
    }
  }, [match, isOpen])

  const handleSearchTermChange = (value) => {
    setSearchTerm(value)
    setCurrentPlayerPage(0)
  }

  const handleFilterBySkillChange = (value) => {
    setFilterBySkill(value)
    setCurrentPlayerPage(0)
  }

  const handleShowAvailableOnlyChange = (value) => {
    setShowAvailableOnly(value)
    if (value) {
      setShowInUseOnly(false)
    }
    setCurrentPlayerPage(0)
  }

  const handleShowInUseOnlyChange = (value) => {
    setShowInUseOnly(value)
    if (value) {
      setShowAvailableOnly(false)
    }
    setCurrentPlayerPage(0)
  }

  const handleShowZeroPlayCountOnlyChange = (value) => {
    setShowZeroPlayCountOnly(value)
    setCurrentPlayerPage(0)
  }

  // Drag and drop handlers
  const handleDragStart = (event) => {
    setActiveDragId(event.active.id);
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;
    setActiveDragId(null);

    if (!over) return;

    const playerId = active.id;
    const dropZone = over.id;

    if (dropZone === "team1" && team1.length < 2 && !team1.includes(playerId)) {
      setTeam1([...team1, playerId]);
    } else if (dropZone === "team2" && team2.length < 2 && !team2.includes(playerId)) {
      setTeam2([...team2, playerId]);
    }
  };

  const handleDragCancel = () => {
    setActiveDragId(null);
  };

  const handleRemoveFromTeam = (playerId, teamNumber) => {
    if (teamNumber === 1) {
      setTeam1(team1.filter((id) => id !== playerId));
    } else {
      setTeam2(team2.filter((id) => id !== playerId));
    }
  };

  const isValidTeamConfiguration = () => {
    return (
      (team1.length === 1 && team2.length === 1) || 
      (team1.length === 2 && team2.length === 2)
    )
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!isValidTeamConfiguration()) {
      alert('Teams must be balanced: 1v1 (1 player per team) or 2v2 (2 players per team)')
      return
    }
    setShowConfirm(true)
  }

  const handleConfirmSubmit = () => {
    const playerIds = [...team1, ...team2]
    onSubmit({
      courtId: effectiveCourtId,
      playerIds
    })
    setShowConfirm(false)
  }

  const getPlayerName = (playerId) => {
    return playersInSession.find(p => p._id === playerId)?.name
      || players?.find(p => p._id === playerId)?.name
      || 'Unknown'
  }

  const getPlayerLevel = (playerId) => {
    return playersInSession.find(p => p._id === playerId)?.playerLevel
      || players?.find(p => p._id === playerId)?.playerLevel
      || 'No Skill Level Assigned'
  }

  const getCourtName = (courtId) => {
    return courts?.find(c => c._id === courtId)?.name || 'Unknown'
  }

  const getFormat = () => {
    const total = team1.length + team2.length
    return total === 2 ? '1v1 (Singles)' : '2v2 (Doubles)'
  }

  const selectedPlayers = [...team1, ...team2]

  const courtsInSession = selectedSession?.courts
    ? courts.filter((court) => selectedSession.courts.includes(court._id))
    : []
  const sessionOngoingMatches = ongoingMatches?.[selectedSessionId] || []
  const sessionQueuedMatches = matchQueue?.[selectedSessionId] || []
  const occupiedCourtIdSet = new Set(
    sessionOngoingMatches
      .filter((sessionMatch) => String(sessionMatch?._id) !== String(match?._id))
      .map((sessionMatch) => sessionMatch?.courtId)
      .filter(Boolean)
      .map(String)
  )
  const reservedQueuedCourtIdSet = new Set(
    sessionQueuedMatches
      .filter((sessionMatch) => String(sessionMatch?._id) !== String(match?._id))
      .map((sessionMatch) => sessionMatch?.courtId)
      .filter(Boolean)
      .map(String)
  )
  const autoAssignedCourtId = !courtId
    ? courtsInSession.find(
        (availableCourt) =>
          !occupiedCourtIdSet.has(String(availableCourt._id)) &&
          !reservedQueuedCourtIdSet.has(String(availableCourt._id))
      )?._id || null
    : null
  const effectiveCourtId = courtId || autoAssignedCourtId || match?.courtId || null
  const sessionPlayerIds = new Set(selectedSession?.players?.map((sessionPlayer) => sessionPlayer.playerId) || [])
  const playersInSession = useMemo(() => (
    selectedSession?.players
      ? selectedSession.players
          .map((sessionPlayer) => {
            const fullPlayer = players?.find((player) => player._id === sessionPlayer.playerId)
            return fullPlayer ? { ...fullPlayer, gamesPlayed: sessionPlayer.gamesPlayed } : null
          })
          .filter(Boolean)
      : []
  ), [players, selectedSession])
  const sessionGames = useMemo(() => {
    return sessionGamesData?.gamesBySession || [];
  }, [sessionGamesData?.gamesBySession]);

  const teammatesByPlayer = useMemo(() => {
    const map = new Map();

    const addTeammatePair = (a, b) => {
      if (!a || !b || a === b) return;
      if (!map.has(a)) map.set(a, new Set());
      map.get(a).add(b);
    };

    for (const game of sessionGames) {
      const players = Array.isArray(game?.players) ? game.players.map(String) : [];
      const winners = Array.isArray(game?.winnerPlayerIds) ? game.winnerPlayerIds.map(String) : [];

      if (players.length < 2) {
        continue;
      }

      let teamA;
      let teamB;
      if (winners.length > 0 && winners.length < players.length) {
        const winnerSet = new Set(winners);
        teamA = players.filter(p => winnerSet.has(p));
        teamB = players.filter(p => !winnerSet.has(p));
      } else {
        const midpoint = Math.floor(players.length / 2);
        teamA = players.slice(0, midpoint);
        teamB = players.slice(midpoint);
      }

      for (let i = 0; i < teamA.length; i += 1) {
        for (let j = i + 1; j < teamA.length; j += 1) {
          addTeammatePair(teamA[i], teamA[j]);
          addTeammatePair(teamA[j], teamA[i]);
        }
      }
      for (let i = 0; i < teamB.length; i += 1) {
        for (let j = i + 1; j < teamB.length; j += 1) {
          addTeammatePair(teamB[i], teamB[j]);
          addTeammatePair(teamB[j], teamB[i]);
        }
      }
    }

    return map;
  }, [sessionGames]);

  const teammateGroupDataByPlayerId = useMemo(() => {
    const playerIdList = playersInSession.map((player) => String(player._id));
    const playerIdSet = new Set(playerIdList);
    const playerNameById = new Map(
      playersInSession.map((player) => [String(player._id), player.name])
    );
    const visited = new Set();
    const groupMap = new Map();

    for (const startId of playerIdList) {
      if (visited.has(startId)) continue;

      const queue = [startId];
      const component = [];
      visited.add(startId);

      while (queue.length > 0) {
        const currentId = queue.shift();
        component.push(currentId);
        const teammates = teammatesByPlayer.get(currentId) || new Set();

        for (const teammateId of teammates) {
          if (!playerIdSet.has(teammateId) || visited.has(teammateId)) {
            continue;
          }
          visited.add(teammateId);
          queue.push(teammateId);
        }
      }

      const teammateGroupNames = component
        .map((id) => playerNameById.get(id))
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b));

      for (const memberId of component) {
        const memberName = playerNameById.get(memberId);
        const teammateNames = teammateGroupNames.filter((name) => name !== memberName);
        groupMap.set(memberId, {
          teammateNames,
          teammateGroupNames,
        });
      }
    }

    return groupMap;
  }, [playersInSession, teammatesByPlayer]);
  const normalizedAddPlayerSearch = debouncedAddPlayerSearch.trim().toLowerCase()
  const exactExistingPlayer = normalizedAddPlayerSearch
    ? (players || []).find(
        (player) => (player?.name || '').trim().toLowerCase() === normalizedAddPlayerSearch
      )
    : null
  const exactNameIsInSession = exactExistingPlayer
    ? sessionPlayerIds.has(exactExistingPlayer._id)
    : false
  const addPlayerResults = debouncedAddPlayerSearch.trim()
    ? (players || [])
        .filter(
          (player) =>
            !sessionPlayerIds.has(player._id) &&
            player.name.toLowerCase().includes(debouncedAddPlayerSearch.trim().toLowerCase())
        )
        .slice(0, 5)
    : []
  const canCreateNewPlayer =
    debouncedAddPlayerSearch.trim() && addPlayerResults.length === 0 && !exactExistingPlayer
  
  // Get players in ongoing matches and queue
  const allMatches = Object.values(ongoingMatches).flat().concat(Object.values(matchQueue).flat())
  const playersInUseSet = new Set(allMatches.flatMap((match) => match.playerIds || []))
  
  let unselectedPlayers = playersInSession.filter((p) => !selectedPlayers.includes(p._id))

  // Filter by search term
  if (debouncedSearchTerm.trim()) {
    unselectedPlayers = unselectedPlayers.filter((p) =>
      p.name.toLowerCase().includes(debouncedSearchTerm.toLowerCase())
    )
  }

  // Filter by skill level
  if (filterBySkill !== 'all') {
    unselectedPlayers = unselectedPlayers.filter((p) =>
      p.playerLevel === filterBySkill
    )
  }

  // Filter available only (exclude players in use)
  if (showAvailableOnly) {
    unselectedPlayers = unselectedPlayers.filter((p) =>
      !playersInUseSet.has(p._id)
    )
  }

  if (showInUseOnly) {
    unselectedPlayers = unselectedPlayers.filter((p) =>
      playersInUseSet.has(p._id)
    )
  }

  if (showZeroPlayCountOnly) {
    unselectedPlayers = unselectedPlayers.filter((p) =>
      (p.gamesPlayed ?? 0) === 0
    )
  }

  // Sort by skill level
  const skillOrder = { BEGINNER: 0, INTERMEDIATE: 1, UPPERINTERMEDIATE: 2, ADVANCED: 3 }

  // Default sort by name (A-Z)
  unselectedPlayers = [...unselectedPlayers].sort((a, b) =>
    (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' })
  )

  if (sortBySkill === 'asc') {
    unselectedPlayers = [...unselectedPlayers].sort((a, b) => 
      (skillOrder[a.playerLevel] || 0) - (skillOrder[b.playerLevel] || 0) ||
      (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' })
    )
  } else if (sortBySkill === 'desc') {
    unselectedPlayers = [...unselectedPlayers].sort((a, b) => 
      (skillOrder[b.playerLevel] || 0) - (skillOrder[a.playerLevel] || 0) ||
      (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' })
    )
  }

  // Single pagination that enforces both constraints: max 3 starting letters and max 15 names per page.
  const playerPages = (() => {
    const pages = []
    let currentPlayers = []
    let currentLetters = []

    for (const player of unselectedPlayers) {
      const letter = (player.name?.[0] || '#').toUpperCase()
      const hasLetter = currentLetters.includes(letter)
      const exceedsLetterLimit = !hasLetter && currentLetters.length >= 3
      const exceedsCountLimit = currentPlayers.length >= PLAYERS_PER_PAGE

      if (currentPlayers.length > 0 && (exceedsLetterLimit || exceedsCountLimit)) {
        pages.push({ players: currentPlayers, letters: currentLetters })
        currentPlayers = []
        currentLetters = []
      }

      if (!currentLetters.includes(letter)) {
        currentLetters.push(letter)
      }
      currentPlayers.push(player)
    }

    if (currentPlayers.length > 0) {
      pages.push({ players: currentPlayers, letters: currentLetters })
    }

    if (pages.length === 0) {
      pages.push({ players: [], letters: [] })
    }

    return pages
  })()

  const totalPlayerPages = playerPages.length
  const clampedPlayerPage = Math.min(currentPlayerPage, totalPlayerPages - 1)
  const currentPageData = playerPages[clampedPlayerPage] || { players: [], letters: [] }
  const pageLetters = currentPageData.letters
  const pagedPlayers = currentPageData.players

  const visiblePlayerPages = (() => {
    const activePage = clampedPlayerPage + 1
    if (totalPlayerPages <= 7) {
      return Array.from({ length: totalPlayerPages }, (_, index) => index + 1)
    }

    const pages = [1]
    const start = Math.max(2, activePage - 1)
    const end = Math.min(totalPlayerPages - 1, activePage + 1)

    if (start > 2) pages.push('ellipsis-left')
    for (let page = start; page <= end; page += 1) pages.push(page)
    if (end < totalPlayerPages - 1) pages.push('ellipsis-right')
    pages.push(totalPlayerPages)

    return pages
  })()

  const handleAddExistingPlayerToSession = async (playerId) => {
    if (!selectedSession?._id) return

    setAddPlayerStatus('adding')
    setAddPlayerError('')

    try {
      const res = await addPlayersToSession({
        variables: { id: selectedSession._id, input: { playerIds: [playerId] } },
      })

      if (res.data?.addPlayersToSession?.ok) {
        setAddPlayerSearch('')
        setAddPlayerStatus('success')
        setTimeout(() => setAddPlayerStatus(null), 2000)
      } else {
        setAddPlayerError(res.data?.addPlayersToSession?.message || 'Failed to add player.')
        setAddPlayerStatus('error')
      }
    } catch (err) {
      const message = getErrorMessage(err, 'Failed to add player to session.')
      setAddPlayerError(message)
      setAddPlayerStatus('error')
      showErrorPopup(message)
    }
  }

  const handleCreateAndAddPlayer = async () => {
    const name = addPlayerSearch.trim()
    if (!name || !selectedSession?._id) return

    const normalizedName = name.toLowerCase()
    const immediateExactExistingPlayer = (players || []).find(
      (player) => (player?.name || '').trim().toLowerCase() === normalizedName
    )
    const immediateExactNameIsInSession = immediateExactExistingPlayer
      ? sessionPlayerIds.has(immediateExactExistingPlayer._id)
      : false

    if (immediateExactExistingPlayer) {
      if (immediateExactNameIsInSession) {
        const message = `"${immediateExactExistingPlayer.name}" is already in this session.`
        setAddPlayerError(message)
        setAddPlayerStatus('error')
        showErrorPopup(message)
        return
      }

      await handleAddExistingPlayerToSession(immediateExactExistingPlayer._id)
      return
    }

    setAddPlayerStatus('adding')
    setAddPlayerError('')

    try {
      const createRes = await createPlayer({ variables: { input: { name } } })
      if (!createRes.data?.createPlayer?.ok) {
        const message = createRes.data?.createPlayer?.message || 'Failed to create player.'
        setAddPlayerError(message)
        setAddPlayerStatus('error')
        showErrorPopup(message)
        return
      }

      const newPlayerId = createRes.data.createPlayer.player._id
      const addRes = await addPlayersToSession({
        variables: { id: selectedSession._id, input: { playerIds: [newPlayerId] } },
      })

      if (addRes.data?.addPlayersToSession?.ok) {
        setAddPlayerSearch('')
        setAddPlayerStatus('success')
        setTimeout(() => setAddPlayerStatus(null), 2000)
      } else {
        const message = addRes.data?.addPlayersToSession?.message || 'Player created but failed to add to session.'
        setAddPlayerError(message)
        setAddPlayerStatus('error')
        showErrorPopup(message)
      }
    } catch (err) {
      const message = getErrorMessage(err, 'Failed to create player. The name may already exist.')
      setAddPlayerError(message)
      setAddPlayerStatus('error')
      showErrorPopup(message)
    }
  }

  // Get the active dragged player
  const activeDragPlayer = activeDragId
    ? playersInSession.find((p) => p._id === activeDragId) || players?.find((p) => p._id === activeDragId)
    : null;

  if (!isOpen) return null

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        {showPopup && (
          <div className="absolute inset-0 z-60 flex items-center justify-center bg-black/60 p-4">
            <div className="w-full max-w-md rounded-xl border border-rose-300/30 bg-slate-900 p-4 shadow-2xl">
              <h3 className="text-sm font-semibold text-rose-200">Unable to Add Player</h3>
              <p className="mt-2 text-xs text-slate-200">{popupMessage}</p>
              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowPopup(false)}
                  className="rounded-full border border-slate-300/40 px-3 py-1 text-xs font-semibold text-slate-200 transition hover:bg-slate-500/10"
                >
                  OK
                </button>
              </div>
            </div>
          </div>
        )}
        <div className="relative max-h-[85vh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-white/10 bg-slate-900 p-4 shadow-2xl">
          <button
            onClick={onClose}
            className="absolute right-3 top-3 text-slate-400 hover:text-white"
            type="button"
          >
            ✕
          </button>

          <h2 className="mb-2 text-base font-semibold text-white sm:text-lg">Edit Match</h2>

          {showConfirm ? (
            <div className="space-y-3">
              <div className="rounded border border-blue-300/30 bg-blue-500/10 p-2.5">
                <h3 className="mb-1 text-sm font-semibold text-blue-200">
                  ✓ Update Match
                </h3>
                <p className="text-xs text-slate-300">
                  {match?.queued 
                    ? "This queued match will be updated with the new court and player selections."
                    : "This ongoing match will be updated with the new court and player selections."}
                </p>
              </div>

              <div className="rounded border border-white/10 bg-white/5 p-2.5">
                <h4 className="mb-1.5 text-xs font-semibold text-white">Match Details</h4>
                <div className="space-y-1.5 text-xs text-slate-300">
                  <div>
                    <strong>Court:</strong> {effectiveCourtId ? getCourtName(effectiveCourtId) : 'Not assigned'}
                    {!courtId && autoAssignedCourtId && <span className="ml-1 text-slate-400">(auto-assigned)</span>}
                  </div>
                  <div>
                    <strong>Format:</strong> {getFormat()}
                  </div>
                  <div>
                    <strong>Team 1:</strong> {team1.map(getPlayerName).join(", ") || "No players"}
                  </div>
                  <div>
                    <strong>Team 2:</strong> {team2.map(getPlayerName).join(", ") || "No players"}
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowConfirm(false)}
                  className="flex-1 rounded-lg border border-white/20 px-3 py-1.5 text-sm font-semibold text-white/80 transition hover:bg-white/5 hover:text-white"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleConfirmSubmit}
                  disabled={isLoading}
                  className="flex-1 rounded-lg bg-emerald-500/20 px-3 py-1.5 text-sm font-semibold text-emerald-200 transition hover:bg-emerald-500/30 disabled:opacity-50"
                >
                  {isLoading ? "Updating..." : "Confirm"}
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              {/* Match Type Display */}
              <div>
                <p className="mb-1.5 block text-xs font-semibold text-white">
                  Match Type
                </p>
                <div className="rounded border border-emerald-500/30 bg-emerald-500/10 px-2 py-1">
                  <p className="text-xs font-semibold text-emerald-200">
                    {getFormat()}
                  </p>
                </div>
              </div>

              {/* Court and Add Player */}
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div>
                  <label htmlFor="edit-match-court" className="mb-1.5 block text-xs font-semibold text-white">
                    Select Court
                  </label>
                  <select
                    id="edit-match-court"
                    name="courtId"
                    value={courtId}
                    onChange={(e) => setCourtId(e.target.value)}
                    className="w-full rounded border border-white/10 bg-slate-800 px-2 py-1 text-xs text-white focus:border-white/30 focus:outline-none"
                  >
                    <option value="">Any available court (auto-assign)</option>
                    {[...courtsInSession].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })).map((court) => (
                      <option key={court._id} value={court._id}>
                        {court.name} ({formatCourtStatus(court.status)})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="edit-match-add-player" className="mb-1.5 block text-xs font-semibold text-white">
                    Add Player to Session
                  </label>
                  <div className="flex gap-1.5">
                    <input
                      id="edit-match-add-player"
                      type="text"
                      placeholder="Search name to add..."
                      value={addPlayerSearch}
                      onChange={(e) => {
                        setAddPlayerSearch(e.target.value)
                        setAddPlayerError('')
                        setAddPlayerStatus(null)
                      }}
                      className="flex-1 rounded border border-white/10 bg-slate-800 px-2 py-1 text-xs text-white placeholder-slate-500 focus:border-white/30 focus:outline-none"
                    />
                    {canCreateNewPlayer && (
                      <button
                        type="button"
                        disabled={addPlayerStatus === 'adding'}
                        onClick={handleCreateAndAddPlayer}
                        className="rounded border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-xs text-emerald-300 hover:bg-emerald-500/20 disabled:opacity-50"
                      >
                        {addPlayerStatus === 'adding' ? 'Adding...' : '+ Create & Add'}
                      </button>
                    )}
                  </div>
                  {addPlayerResults.length > 0 && (
                    <div className="mt-1.5 max-h-28 space-y-0.5 overflow-y-auto">
                      {addPlayerResults.map((player) => (
                        <div key={player._id} className="flex items-center justify-between rounded bg-slate-800 px-2 py-1">
                          <div>
                            <span className="text-xs text-white">{player.name?.toUpperCase()}</span>
                            {player.playerLevel && (
                              <span className="ml-1.5 text-[9px] text-slate-400">{player.playerLevel}</span>
                            )}
                          </div>
                          <button
                            type="button"
                            disabled={addPlayerStatus === 'adding'}
                            onClick={() => handleAddExistingPlayerToSession(player._id)}
                            className="rounded border border-blue-500/30 bg-blue-500/10 px-2 py-0.5 text-[10px] text-blue-300 hover:bg-blue-500/20 disabled:opacity-50"
                          >
                            {addPlayerStatus === 'adding' ? '...' : '+ Add'}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  {addPlayerSearch.trim() && exactExistingPlayer && !addPlayerStatus && (
                    <p className="mt-1 text-[10px] text-amber-300">
                      {exactNameIsInSession
                        ? `"${exactExistingPlayer.name}" already exists in this session.`
                        : `Existing player found: "${exactExistingPlayer.name}". Click + Add to include in this session.`}
                    </p>
                  )}
                  {canCreateNewPlayer && !addPlayerStatus && (
                    <p className="mt-1 text-[10px] text-slate-400">
                      No match - will create new player &quot;{addPlayerSearch.trim()}&quot;
                    </p>
                  )}
                  {addPlayerStatus === 'success' && (
                    <p className="mt-1 text-[10px] text-emerald-400">Player added to session!</p>
                  )}
                  {addPlayerError && (
                    <p className="mt-1 text-[10px] text-rose-400">{addPlayerError}</p>
                  )}
                </div>
              </div>

              {/* Filter and Sort */}
              <div className="order-2 rounded border border-white/10 bg-white/5 p-2.5">
                  <p className="mb-1.5 block text-xs font-semibold text-white">
                    Filter & Sort
                  </p>
                  <div className="flex gap-1.5">
                    <div className="flex-1">
                      <input
                        id="edit-match-player-search"
                        name="playerSearch"
                        type="text"
                        placeholder="Name..."
                        value={searchTerm}
                        onChange={(e) => handleSearchTermChange(e.target.value)}
                        className="w-full rounded border border-white/10 bg-slate-800 px-2 py-1 text-xs text-white placeholder-slate-500 focus:border-white/30 focus:outline-none"
                      />
                    </div>
                    <select
                      id="edit-match-skill-filter"
                      name="playerSkillFilter"
                      value={filterBySkill}
                      onChange={(e) => handleFilterBySkillChange(e.target.value)}
                      className="rounded border border-white/10 bg-slate-800 px-2 py-1 text-xs text-white focus:border-white/30 focus:outline-none"
                    >
                      <option value="all">All Levels</option>
                      <option value="BEGINNER">Beginner</option>
                      <option value="INTERMEDIATE">Intermediate</option>
                      <option value="UPPERINTERMEDIATE">Upper Int</option>
                      <option value="ADVANCED">Advanced</option>
                    </select>
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[9px] text-slate-300">
                    <label className="flex items-center gap-2" title="Excludes players in ongoing matches and queue">
                      <input
                        id="edit-match-available-only"
                        name="showAvailableOnly"
                        type="checkbox"
                        checked={showAvailableOnly}
                        onChange={(e) => handleShowAvailableOnlyChange(e.target.checked)}
                        className="h-3 w-3 rounded border-white/20 bg-white/10"
                      />
                      Available only
                    </label>
                    <label className="flex items-center gap-2" title="Show players who have not played yet in this session">
                      <input
                        id="edit-match-zero-play-only"
                        name="showZeroPlayCountOnly"
                        type="checkbox"
                        checked={showZeroPlayCountOnly}
                        onChange={(e) => handleShowZeroPlayCountOnlyChange(e.target.checked)}
                        className="h-3 w-3 rounded border-white/20 bg-white/10"
                      />
                      Players who have not played yet
                    </label>
                    <label className="flex items-center gap-2" title="Show players who are in an ongoing match or queue">
                      <input
                        id="edit-match-in-use-only"
                        name="showInUseOnly"
                        type="checkbox"
                        checked={showInUseOnly}
                        onChange={(e) => handleShowInUseOnlyChange(e.target.checked)}
                        className="h-3 w-3 rounded border-white/20 bg-white/10"
                      />
                      In match/queue only
                    </label>
                  </div>
                </div>

              {/* Player Grid */}
              <div className="order-3">
                <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="w-full">
                    <div className="flex w-full flex-wrap items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 p-1.5 text-[9px] text-slate-300">
                        <span className="hidden items-center gap-1 sm:inline-flex sm:mr-1">
                          <span className="h-2 w-2 rounded-full bg-[conic-gradient(from_0deg,red,orange,yellow,green,cyan,blue,violet,red)] animate-spin [animation-duration:1.6s]" />
                          <span>Players that have played as teammates</span>
                        </span>
                      <button
                        type="button"
                        onClick={() => handleFilterBySkillChange(filterBySkill === 'BEGINNER' ? 'all' : 'BEGINNER')}
                        className={`flex items-center gap-1 whitespace-nowrap rounded px-1.5 py-0.5 transition ${
                          filterBySkill === 'BEGINNER'
                            ? 'border border-blue-500/50 bg-blue-500/30'
                            : 'hover:bg-blue-500/10'
                        }`}
                      >
                        <div className="h-2 w-2 rounded border border-blue-500/50 bg-blue-500/20"></div>
                        <span>Beginner</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleFilterBySkillChange(filterBySkill === 'INTERMEDIATE' ? 'all' : 'INTERMEDIATE')}
                        className={`flex items-center gap-1 whitespace-nowrap rounded px-1.5 py-0.5 transition ${
                          filterBySkill === 'INTERMEDIATE'
                            ? 'border border-yellow-500/50 bg-yellow-500/30'
                            : 'hover:bg-yellow-500/10'
                        }`}
                      >
                        <div className="h-2 w-2 rounded border border-yellow-500/50 bg-yellow-500/20"></div>
                        <span>Intermediate</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleFilterBySkillChange(filterBySkill === 'UPPERINTERMEDIATE' ? 'all' : 'UPPERINTERMEDIATE')}
                        className={`flex items-center gap-1 whitespace-nowrap rounded px-1.5 py-0.5 transition ${
                          filterBySkill === 'UPPERINTERMEDIATE'
                            ? 'border border-violet-500/50 bg-violet-500/30'
                            : 'hover:bg-violet-500/10'
                        }`}
                      >
                        <div className="h-2 w-2 rounded border border-violet-500/50 bg-violet-500/20"></div>
                        <span>Upper Int</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleFilterBySkillChange(filterBySkill === 'ADVANCED' ? 'all' : 'ADVANCED')}
                        className={`flex items-center gap-1 whitespace-nowrap rounded px-1.5 py-0.5 transition ${
                          filterBySkill === 'ADVANCED'
                            ? 'border border-rose-500/50 bg-rose-500/30'
                            : 'hover:bg-rose-500/10'
                        }`}
                      >
                        <div className="h-2 w-2 rounded border border-rose-500/50 bg-rose-500/20"></div>
                        <span>Advanced</span>
                      </button>
                    </div>
                  </div>
                  {totalPlayerPages > 1 && (
                    <div className="flex w-full items-center justify-between gap-2 text-xs text-slate-400 sm:w-auto sm:justify-end sm:gap-2">
                      <button
                        type="button"
                        onClick={() => setCurrentPlayerPage(Math.max(0, currentPlayerPage - 1))}
                        disabled={currentPlayerPage === 0}
                        className="rounded-full border border-slate-300/40 px-2.5 py-1 text-xs font-semibold text-slate-200 transition hover:bg-slate-500/10 disabled:cursor-not-allowed disabled:opacity-50 sm:px-3"
                      >
                        <span className="sm:hidden">Prev</span>
                        <span className="hidden sm:inline">Previous</span>
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

                          const isActive = item === clampedPlayerPage + 1
                          return (
                            <button
                              key={`edit-player-page-${item}`}
                              type="button"
                              onClick={() => setCurrentPlayerPage(item - 1)}
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
                      <span className="inline-flex min-w-14 justify-center rounded-full border border-slate-300/30 bg-slate-800/70 px-2 py-1 text-[10px] font-semibold text-slate-200">
                        {pageLetters[0]
                          ? `${pageLetters[0]}${pageLetters.length > 1 ? ` – ${pageLetters[pageLetters.length - 1]}` : ''}`
                          : '-'}
                      </span>
                      <button
                        type="button"
                        onClick={() => setCurrentPlayerPage(Math.min(totalPlayerPages - 1, currentPlayerPage + 1))}
                        disabled={currentPlayerPage >= totalPlayerPages - 1}
                        className="rounded-full border border-slate-300/40 px-2.5 py-1 text-xs font-semibold text-slate-200 transition hover:bg-slate-500/10 disabled:cursor-not-allowed disabled:opacity-50 sm:px-3"
                      >
                        <span className="sm:hidden">Next</span>
                        <span className="hidden sm:inline">Next</span>
                      </button>
                    </div>
                  )}
                </div>
                <div className="mb-3 space-y-2">
                  {pagedPlayers.length === 0 ? (
                    <div className="rounded border border-white/10 bg-white/5 py-3 text-center text-xs text-slate-400">
                      No available players
                    </div>
                  ) : (
                    Object.entries(
                      pagedPlayers.reduce((groups, player) => {
                        const letter = (player.name?.[0] || '#').toUpperCase()
                        if (!groups[letter]) groups[letter] = []
                        groups[letter].push(player)
                        return groups
                      }, {})
                    ).map(([letter, group]) => (
                      <div key={letter}>
                        <div className="mb-1 flex items-center gap-2">
                          <span className="text-[10px] font-bold tracking-widest text-slate-500">{letter}</span>
                          <div className="h-px flex-1 bg-white/10" />
                        </div>
                        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                          {group.map((player) => {
                            const teammateData = teammateGroupDataByPlayerId.get(String(player._id));
                            const teammateNames = teammateData?.teammateNames || [];
                            const teammateGroupNames = teammateData?.teammateGroupNames || [];
                            return (
                              <DraggablePlayer
                                key={player._id}
                                player={player}
                                isInUse={playersInUseSet.has(player._id)}
                                isAssignedToTeam={false}
                                teammateNames={teammateNames}
                                teammateGroupNames={teammateGroupNames}
                              />
                            )
                          })}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Team Selection Grid */}
              <div className="order-1">
                <p className="mb-2 text-xs font-semibold text-white">Drag to Teams</p>
                <div className="grid grid-cols-2 gap-3">
                <DroppableTeam teamNumber={1}>
                  <h3 className="mb-2 text-xs font-semibold text-blue-200">
                    Team 1{" "}
                    {team1.length > 0 && (
                      <span className="ml-2 text-xs text-blue-300">
                        ({team1.length})
                      </span>
                    )}
                  </h3>
                  <div className="min-h-20">
                    {team1.length > 0 ? (
                      <div className="space-y-1.5">
                        {team1.map((playerId) => {
                          const playerLevel = getPlayerLevel(playerId)
                          const teammateData = teammateGroupDataByPlayerId.get(String(playerId));
                          const teammateNames = teammateData?.teammateNames || [];
                          const teammateGroupNames = teammateData?.teammateGroupNames || [];
                          const teammateColor = getTeammateGroupColor(teammateGroupNames);
                          const teammateTooltip = buildTeammateTooltip(teammateNames);
                          return (
                            <div
                              key={playerId}
                              className={`group relative flex items-center justify-between rounded border px-1.5 py-0.5 ${
                                teammateColor
                                  ? `${teammateColor.border} ${teammateColor.bg}`
                                  : "border-blue-300/30 bg-blue-500/10"
                              } ${playersInUseSet.has(playerId) ? "animate-pulse" : ""}`}
                              title={teammateTooltip || undefined}
                            >
                              <div className="text-[11px] text-white">
                                <div className="font-semibold leading-tight">
                                  {getPlayerName(playerId)?.toUpperCase()}
                                </div>
                                <div className={`text-[10px] leading-tight ${getSkillLevelTextColor(playerLevel)}`}>
                                  Skill: {formatSkillLevelLabel(playerLevel)}
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleRemoveFromTeam(playerId, 1)}
                                className="text-[9px] text-blue-300 hover:text-blue-200 ml-1"
                              >
                                ✕
                              </button>
                            </div>
                          )
                        })}
                      </div>
                    ) : (
                      <div className="flex h-20 items-center justify-center rounded border-2 border-dashed border-blue-300/30 bg-blue-500/5">
                        <p className="text-[11px] text-slate-400">Drop players here</p>
                      </div>
                    )}
                  </div>
                </DroppableTeam>

                <DroppableTeam teamNumber={2}>
                  <h3 className="mb-2 text-xs font-semibold text-rose-200">
                    Team 2{" "}
                    {team2.length > 0 && (
                      <span className="ml-2 text-xs text-rose-300">
                        ({team2.length})
                      </span>
                    )}
                  </h3>
                  <div className="min-h-20">
                    {team2.length > 0 ? (
                      <div className="space-y-1.5">
                        {team2.map((playerId) => {
                          const playerLevel = getPlayerLevel(playerId)
                          const teammateData = teammateGroupDataByPlayerId.get(String(playerId));
                          const teammateNames = teammateData?.teammateNames || [];
                          const teammateGroupNames = teammateData?.teammateGroupNames || [];
                          const teammateColor = getTeammateGroupColor(teammateGroupNames);
                          const teammateTooltip = buildTeammateTooltip(teammateNames);
                          return (
                            <div
                              key={playerId}
                              className={`group relative flex items-center justify-between rounded border px-1.5 py-0.5 ${
                                teammateColor
                                  ? `${teammateColor.border} ${teammateColor.bg}`
                                  : "border-rose-300/30 bg-rose-500/10"
                              } ${playersInUseSet.has(playerId) ? "animate-pulse" : ""}`}
                              title={teammateTooltip || undefined}
                            >
                              <div className="text-[11px] text-white">
                                <div className="font-semibold leading-tight">
                                  {getPlayerName(playerId)?.toUpperCase()}
                                </div>
                                <div className={`text-[10px] leading-tight ${getSkillLevelTextColor(playerLevel)}`}>
                                  Skill: {formatSkillLevelLabel(playerLevel)}
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleRemoveFromTeam(playerId, 2)}
                                className="text-[9px] text-rose-300 hover:text-rose-200 ml-1"
                              >
                                ✕
                              </button>
                            </div>
                          )
                        })}
                      </div>
                    ) : (
                      <div className="flex h-20 items-center justify-center rounded border-2 border-dashed border-rose-300/30 bg-rose-500/5">
                        <p className="text-[11px] text-slate-400">Drop players here</p>
                      </div>
                    )}
                  </div>
                </DroppableTeam>
                </div>
              </div>

              {/* Form Actions */}
              <div className="order-4 flex gap-3 border-t border-white/10 pt-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 rounded-lg border border-white/20 px-3 py-1.5 text-sm font-semibold text-white/80 transition hover:bg-white/5 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoading || !isValidTeamConfiguration()}
                  className="flex-1 rounded-lg bg-emerald-500/20 px-3 py-1.5 text-sm font-semibold text-emerald-200 transition hover:bg-emerald-500/30 disabled:opacity-50"
                >
                  {isLoading ? 'Updating...' : 'Continue'}
                </button>
              </div>
            </form>
          )}

          <DragOverlay>
            {activeDragPlayer ? (
              <DraggablePlayer
                player={activeDragPlayer}
                isInUse={false}
                isAssignedToTeam={selectedPlayers.includes(activeDragPlayer._id)}
              />
            ) : null}
          </DragOverlay>
        </div>
      </div>
    </DndContext>  )
}

export default EditMatchForm