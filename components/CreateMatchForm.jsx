'use client';

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useQuery, useSubscription, useMutation } from "@apollo/client/react";
import { gql } from "@apollo/client";
import { DndContext, DragOverlay, useSensor, useSensors, MouseSensor, TouchSensor } from "@dnd-kit/core";
import { useDraggable, useDroppable } from "@dnd-kit/core";

const COURT_SURFACE_TYPES = {
  'WOODEN': 'Wooden',
  'SYNTHETIC': 'Synthetic',
  'MAT': 'Mat',
  'CONCRETE': 'Concrete',
}

const COURT_STATUS_LABELS = {
  'ACTIVE': 'Available',
  'OCCUPIED': 'InUse',
  'MAINTENANCE': 'Maintenance'
}

const formatCourtStatus = (value) => COURT_STATUS_LABELS[value] ?? value

const COURTS_QUERY = gql`
  query Courts {
    courts {
      _id
      name
      surfaceType
      indoor
      status
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

const GAMES_SUBSCRIPTION = gql`
  subscription GameSub {
    gameSub {
      type
      game {
        _id
        sessionId
        players
        winnerPlayerIds
      }
    }
  }
`;

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

const LAST_SESSION_KEY = "lastCreateMatchSessionId";
const PLAYERS_PER_PAGE = 12;

const buildTeammateTooltip = (teammateNames) => {
  if (!Array.isArray(teammateNames) || teammateNames.length === 0) {
    return "";
  }

  return `${teammateNames.join("\n")}`;
};

const TeammateIndicator = ({ tooltip, className, tooltipClassName = "" }) => {
  if (!tooltip) {
    return null;
  }

  return (
    <span className={`absolute ${className}`}>
      <span
        className="block h-full w-full rounded-full bg-blue-500 ring-1 ring-slate-900"
        aria-label={tooltip}
      />
      <span
        className={`pointer-events-none absolute z-30 hidden max-w-48 whitespace-pre-line rounded border border-sky-400/30 bg-slate-950/95 px-2 py-1 text-[10px] font-medium leading-tight text-sky-50 shadow-lg shadow-slate-950/40 group-hover:block group-focus-within:block ${tooltipClassName}`}
      >
        {tooltip}
      </span>
    </span>
  );
};

// Draggable Player Card Component
const DraggablePlayer = ({ player, isInUse, isAssignedToTeam, teammateNames = [] }) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: player._id,
  });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        opacity: isDragging ? 0.5 : 1,
      }
    : undefined;

  // Get color based on skill level
  const getSkillColor = () => {
    if (isAssignedToTeam) return "border-emerald-500/30 bg-emerald-500/10";
    if (isInUse) return "border-amber-500/30 bg-amber-500/10";
    
    switch (player.playerLevel) {
      case "BEGINNER":
        return "border-blue-500/30 bg-blue-500/10 hover:bg-blue-500/20";
      case "INTERMEDIATE":
        return "border-yellow-500/30 bg-yellow-500/10 hover:bg-yellow-500/20";
      case "UPPERINTERMEDIATE":
        return "border-violet-500/30 bg-violet-500/10 hover:bg-violet-500/20";
      case "ADVANCED":
        return "border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20";
      default:
        return "border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20";
    }
  };

  const teammateTooltip = buildTeammateTooltip(teammateNames);
  const hasTeammateIndicator = teammateNames.length > 0;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`group relative touch-none cursor-grab active:cursor-grabbing select-none rounded border px-2 py-1.5 text-center transition ${getSkillColor()}`}
    >
      {hasTeammateIndicator && (
        <TeammateIndicator
          tooltip={teammateTooltip}
          className="right-1 top-1 h-2 w-2"
          tooltipClassName="right-0 top-4"
        />
      )}
      <p className="truncate text-sm font-semibold text-white leading-tight">{player.name?.toUpperCase()}</p>
      <p className="text-[10px] text-slate-400 leading-tight">{player.playerLevel}</p>
      <p className="text-[9px] text-slate-400 leading-tight">Play count this session: {player.gamesPlayed ?? 0}</p>
      <p className="text-[9px] text-slate-500 leading-tight">{player.gender}</p>
      {isAssignedToTeam && <p className="mt-0.5 text-[9px] text-emerald-400 leading-tight">● In Team</p>}
      {isInUse && !isAssignedToTeam && <p className="mt-0.5 text-[9px] text-amber-400 leading-tight animate-pulse">● In Match/Queue</p>}
    </div>
  );
};

const DraggableSelectedPlayer = ({ playerId, children }) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: playerId,
  });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        opacity: isDragging ? 0.6 : 1,
      }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className="touch-none cursor-grab active:cursor-grabbing"
    >
      {children}
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
      className={`rounded border p-2 transition ${
        teamNumber === 1
          ? `border-blue-300/30 bg-blue-500/10 ${isOver ? "bg-blue-500/20 border-blue-300/50" : ""}`
          : `border-rose-300/30 bg-rose-500/10 ${isOver ? "bg-rose-500/20 border-rose-300/50" : ""}`
      }`}
    >
      {children}
    </div>
  );
};

// Helper function to get skill level color for team display
const getSkillLevelColor = (skillLevel) => {
  switch (skillLevel) {
    case "BEGINNER":
      return "bg-blue-500/20 border-blue-300/50";
    case "INTERMEDIATE":
      return "bg-yellow-500/20 border-yellow-300/50";
    case "UPPERINTERMEDIATE":
      return "bg-violet-500/20 border-violet-300/50";
    case "ADVANCED":
      return "bg-rose-500/20 border-rose-300/50";
    default:
      return "bg-slate-500/20 border-slate-300/50";
  }
};

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

const CreateMatchForm = ({
  sessions,
  players,
  isOpen,
  onClose,
  onSubmit,
  isLoading,
  ongoingMatches,
  matchQueue,
  currentSessionId,
}) => {
  const [selectedSessionId, setSelectedSessionId] = useState(currentSessionId || "");
  const [matchType, setMatchType] = useState("1v1");
  const [selectedCourt, setSelectedCourt] = useState("");
  const [team1, setTeam1] = useState([]);
  const [team2, setTeam2] = useState([]);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pendingMatchData, setPendingMatchData] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBySkill, setSortBySkill] = useState("none"); // none, asc, desc
  const [filterBySkill, setFilterBySkill] = useState("all"); // all, BEGINNER, INTERMEDIATE, UPPERINTERMEDIATE, ADVANCED
  const [showAvailableOnly, setShowAvailableOnly] = useState(false);
  const [showInUseOnly, setShowInUseOnly] = useState(false);
  const [showZeroPlayCountOnly, setShowZeroPlayCountOnly] = useState(false);
  const [currentPlayerPage, setCurrentPlayerPage] = useState(0);
  const [activeDragId, setActiveDragId] = useState(null);
  const [addPlayerSearch, setAddPlayerSearch] = useState("");
  const [debouncedAddPlayerSearch, setDebouncedAddPlayerSearch] = useState("");
  const [addPlayerStatus, setAddPlayerStatus] = useState(null); // null | 'adding' | 'success' | 'error'
  const [addPlayerError, setAddPlayerError] = useState("");
  const [popupMessage, setPopupMessage] = useState("");
  const [showPopup, setShowPopup] = useState(false);

  const getErrorMessage = useCallback((error, fallbackMessage) => {
    const fromGraphQlFields = error?.graphQLErrors
      ?.flatMap((item) => item?.extensions?.fields || [])
      ?.find((field) => field?.message)?.message;
    if (fromGraphQlFields) return fromGraphQlFields;

    const fromNetworkFields = error?.networkError?.result?.errors
      ?.flatMap((item) => item?.extensions?.fields || [])
      ?.find((field) => field?.message)?.message;
    if (fromNetworkFields) return fromNetworkFields;

    const gqlMessage = error?.graphQLErrors?.[0]?.message;
    if (gqlMessage && gqlMessage !== "Validation failed.") return gqlMessage;

    const networkMessage = error?.networkError?.result?.errors?.[0]?.message;
    if (networkMessage && networkMessage !== "Validation failed.") return networkMessage;

    if (error?.message === "Validation failed." || error?.message?.includes("Validation failed")) {
      return fallbackMessage;
    }

    if (error?.message) return error.message;
    return fallbackMessage;
  }, []);

  const showErrorPopup = useCallback((message) => {
    if (!message) return;
    setPopupMessage(message);
    setShowPopup(true);
  }, []);

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

  const { data: courtsData } = useQuery(COURTS_QUERY);
  const { data: sessionGamesData } = useQuery(GAMES_BY_SESSION_QUERY, {
    variables: { sessionId: selectedSessionId },
    skip: !selectedSessionId,
    fetchPolicy: "cache-and-network",
  });
  const { data: gameSubData } = useSubscription(GAMES_SUBSCRIPTION, {
    skip: !isOpen,
  });

  const [addPlayersToSession] = useMutation(ADD_PLAYERS_TO_SESSION_MUTATION, {
    refetchQueries: ["Sessions"],
  });
  const [createPlayer] = useMutation(CREATE_PLAYER_MUTATION, {
    refetchQueries: ["Players"],
  });

  const getPreferredSessionId = useCallback(() => {
    if (currentSessionId && sessions?.some((s) => s._id === currentSessionId && s.status === "OPEN")) {
      return currentSessionId;
    }

    const storedSessionId = localStorage.getItem(LAST_SESSION_KEY);
    if (storedSessionId && sessions?.some((s) => s._id === storedSessionId && s.status === "OPEN")) {
      return storedSessionId;
    }

    return "";
  }, [currentSessionId, sessions]);

  /* eslint-disable react-hooks/set-state-in-effect */
  // Reset form when closed, but remember last used session
  useEffect(() => {
    if (!isOpen) {
      setSelectedSessionId(getPreferredSessionId());
      setMatchType("1v1");
      setSelectedCourt("");
      setTeam1([]);
      setTeam2([]);
      setShowConfirm(false);
      setPendingMatchData(null);
      setSearchTerm("");
      setSortBySkill("none");
      setFilterBySkill("all");
      setShowAvailableOnly(false);
      setShowInUseOnly(false);
      setShowZeroPlayCountOnly(false);
      setAddPlayerSearch("");
      setDebouncedAddPlayerSearch("");
      setAddPlayerStatus(null);
      setAddPlayerError("");
      setPopupMessage("");
      setShowPopup(false);
    }
  }, [getPreferredSessionId, isOpen]);

  // Prefill session from last used selection when modal opens
  useEffect(() => {
    if (!isOpen) return;
    const preferredSessionId = getPreferredSessionId();
    if (preferredSessionId && preferredSessionId !== selectedSessionId) {
      setSelectedSessionId(preferredSessionId);
    }
  }, [getPreferredSessionId, isOpen, selectedSessionId]);

  // Auto-detect match type based on team configuration
  useEffect(() => {
    if (team1.length === 1 && team2.length === 1) {
      setMatchType("1v1");
    } else if (team1.length === 2 && team2.length === 2) {
      setMatchType("2v2");
    }
  }, [team1, team2]);

  // Reset player page when search/sort/filter changes
  // Reset list pagination whenever filters change.
  useEffect(() => {
    setCurrentPlayerPage(0);
  }, [searchTerm, sortBySkill, filterBySkill, showAvailableOnly, showInUseOnly, showZeroPlayCountOnly]);

  // Debounce add-player text matching to avoid recomputing suggestions on every keypress.
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setDebouncedAddPlayerSearch(addPlayerSearch);
    }, 200);

    return () => clearTimeout(timeoutId);
  }, [addPlayerSearch]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Drag and drop handlers
  const handleDragStart = (event) => {
    setActiveDragId(event.active.id);
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;
    setActiveDragId(null);
    const playerId = active.id;
    const isInTeam1 = team1.includes(playerId);
    const isInTeam2 = team2.includes(playerId);

    if (!over) {
      if (isInTeam1) {
        setTeam1(team1.filter((id) => id !== playerId));
      }
      if (isInTeam2) {
        setTeam2(team2.filter((id) => id !== playerId));
      }
      return;
    }

    const dropZone = over.id;

    if (dropZone === "team1") {
      if (isInTeam1) return;
      if (team1.length >= 2) return;

      setTeam1([...team1, playerId]);
      if (isInTeam2) {
        setTeam2(team2.filter((id) => id !== playerId));
      }
      return;
    }

    if (dropZone === "team2") {
      if (isInTeam2) return;
      if (team2.length >= 2) return;

      setTeam2([...team2, playerId]);
      if (isInTeam1) {
        setTeam1(team1.filter((id) => id !== playerId));
      }
    }
  };

  const handleDragCancel = () => {
    setActiveDragId(null);
  };

  const selectedSession = sessions?.find(s => s._id === selectedSessionId);
  const allCourts = courtsData?.courts || [];
  
  // Filter courts to only show ones in the selected session
  const courts = selectedSessionId && selectedSession
    ? allCourts.filter((court) => selectedSession.courts?.includes(court._id))
    : [];
  
  // Get players for the selected session - map playerIds to full player objects
  const playersInSession = selectedSession?.players
    ? selectedSession.players.map(sp => {
        const fullPlayer = players?.find(p => p._id === sp.playerId);
        return fullPlayer ? { ...fullPlayer, gamesPlayed: sp.gamesPlayed } : null;
      }).filter(Boolean)
    : [];

  // Players already in session (for add-player widget exclusion)
  const sessionPlayerIds = new Set(selectedSession?.players?.map((sp) => sp.playerId) || []);
  const normalizedAddPlayerSearch = debouncedAddPlayerSearch.trim().toLowerCase();
  const exactExistingPlayer = normalizedAddPlayerSearch
    ? (players || []).find(
        (p) => (p?.name || '').trim().toLowerCase() === normalizedAddPlayerSearch
      )
    : null;
  const exactNameIsInSession = exactExistingPlayer
    ? sessionPlayerIds.has(exactExistingPlayer._id)
    : false;

  const addPlayerResults = debouncedAddPlayerSearch.trim()
    ? (players || [])
        .filter(
          (p) =>
            !sessionPlayerIds.has(p._id) &&
            p.name.toLowerCase().includes(debouncedAddPlayerSearch.trim().toLowerCase())
        )
        .slice(0, 5)
    : [];
  const canCreateNewPlayer =
    debouncedAddPlayerSearch.trim() && addPlayerResults.length === 0 && !exactExistingPlayer;

  // Get unselected players
  const selectedPlayerIds = new Set([...team1, ...team2]);
  let unselectedPlayers = playersInSession.filter(
    (p) => !selectedPlayerIds.has(p._id)
  );


  const handleSearchTermChange = (value) => {
    setSearchTerm(value);
    setCurrentPlayerPage(0);
  };

  const handleFilterBySkillChange = (value) => {
    setFilterBySkill(value);
    setCurrentPlayerPage(0);
  };

  const handleShowAvailableOnlyChange = (value) => {
    setShowAvailableOnly(value);
    if (value) {
      setShowInUseOnly(false);
    }
    setCurrentPlayerPage(0);
  };

  const handleShowInUseOnlyChange = (value) => {
    setShowInUseOnly(value);
    if (value) {
      setShowAvailableOnly(false);
    }
    setCurrentPlayerPage(0);
  };

  const handleShowZeroPlayCountOnlyChange = (value) => {
    setShowZeroPlayCountOnly(value);
    setCurrentPlayerPage(0);
  };

  const sessionOngoingMatches = ongoingMatches?.[selectedSessionId] || [];
  const sessionQueuedMatches = matchQueue?.[selectedSessionId] || [];
  const sessionAllMatches = [...sessionOngoingMatches, ...sessionQueuedMatches];
  const sessionGames = useMemo(() => {
    const baseGames = sessionGamesData?.gamesBySession || [];
    const subGame = gameSubData?.gameSub?.game;

    if (!subGame || String(subGame.sessionId) !== String(selectedSessionId)) {
      return baseGames;
    }

    const exists = baseGames.some((game) => String(game._id) === String(subGame._id));
    return exists ? baseGames : [subGame, ...baseGames];
  }, [sessionGamesData?.gamesBySession, gameSubData?.gameSub?.game, selectedSessionId]);
  const playersInUseSet = new Set(
    sessionAllMatches.flatMap((match) => match.playerIds || [])
  );

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

      // Determine teams based on winners
      // If we have winner info, use it to determine teams
      // Otherwise fall back to splitting in half
      let teamA, teamB;
      if (winners.length > 0 && winners.length < players.length) {
        const winnerSet = new Set(winners);
        teamA = players.filter(p => winnerSet.has(p));
        teamB = players.filter(p => !winnerSet.has(p));
      } else {
        // Fallback: split in half
        const midpoint = Math.floor(players.length / 2);
        teamA = players.slice(0, midpoint);
        teamB = players.slice(midpoint);
      }

      // Add teammate relationships within each team.
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

  const teammateNamesByPlayerId = useMemo(() => {
    const selectedIds = [...team1, ...team2].map(String);
    const selectedNameById = new Map(
      playersInSession.map((player) => [String(player._id), player.name])
    );
    const map = new Map();

    for (const selectedId of selectedIds) {
      const teammates = teammatesByPlayer.get(selectedId);
      const selectedName = selectedNameById.get(selectedId);
      if (!teammates) continue;

      for (const teammateId of teammates) {
        if (teammateId === selectedId || !selectedName) {
          continue;
        }

        if (!map.has(teammateId)) {
          map.set(teammateId, []);
        }

        const names = map.get(teammateId);
        if (!names.includes(selectedName)) {
          names.push(selectedName);
        }
      }
    }

    return map;
  }, [playersInSession, team1, team2, teammatesByPlayer]);

  // Filter by search term
  if (searchTerm.trim()) {
    unselectedPlayers = unselectedPlayers.filter((p) =>
      p.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }

  // Filter by skill level
  if (filterBySkill !== "all") {
    unselectedPlayers = unselectedPlayers.filter((p) =>
      p.playerLevel === filterBySkill
    );
  }

  // Filter by availability
  if (showAvailableOnly) {
    unselectedPlayers = unselectedPlayers.filter((p) =>
      !playersInUseSet.has(p._id)
    );
  }

  if (showInUseOnly) {
    unselectedPlayers = unselectedPlayers.filter((p) =>
      playersInUseSet.has(p._id)
    );
  }

  if (showZeroPlayCountOnly) {
    unselectedPlayers = unselectedPlayers.filter((p) =>
      (p.gamesPlayed ?? 0) === 0
    );
  }

  // Default sort by name (A-Z)
  unselectedPlayers = [...unselectedPlayers].sort((a, b) =>
    (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' })
  );

  // Sort by skill level
  const skillLevelOrder = {
    'BEGINNER': 1,
    'INTERMEDIATE': 2,
    'UPPERINTERMEDIATE': 3,
    'ADVANCED': 4,
  };

  if (sortBySkill === "asc") {
    unselectedPlayers = [...unselectedPlayers].sort((a, b) => 
      (skillLevelOrder[a.playerLevel] || 0) - (skillLevelOrder[b.playerLevel] || 0) ||
      (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' })
    );
  } else if (sortBySkill === "desc") {
    unselectedPlayers = [...unselectedPlayers].sort((a, b) => 
      (skillLevelOrder[b.playerLevel] || 0) - (skillLevelOrder[a.playerLevel] || 0) ||
      (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' })
    );
  }

  // Single pagination that enforces both constraints: max 3 starting letters and max 15 names per page.
  const playerPages = (() => {
    const pages = [];
    let currentPlayers = [];
    let currentLetters = [];

    for (const player of unselectedPlayers) {
      const letter = (player.name?.[0] || '#').toUpperCase();
      const hasLetter = currentLetters.includes(letter);
      const exceedsLetterLimit = !hasLetter && currentLetters.length >= 3;
      const exceedsCountLimit = currentPlayers.length >= PLAYERS_PER_PAGE;

      if (currentPlayers.length > 0 && (exceedsLetterLimit || exceedsCountLimit)) {
        pages.push({ players: currentPlayers, letters: currentLetters });
        currentPlayers = [];
        currentLetters = [];
      }

      if (!currentLetters.includes(letter)) {
        currentLetters.push(letter);
      }
      currentPlayers.push(player);
    }

    if (currentPlayers.length > 0) {
      pages.push({ players: currentPlayers, letters: currentLetters });
    }

    if (pages.length === 0) {
      pages.push({ players: [], letters: [] });
    }

    return pages;
  })();

  const totalPlayerPages = playerPages.length;
  const clampedPlayerPage = Math.min(currentPlayerPage, totalPlayerPages - 1);
  const currentPageData = playerPages[clampedPlayerPage] || { players: [], letters: [] };
  const pageLetters = currentPageData.letters;
  const pagedPlayers = currentPageData.players;

  const visiblePlayerPages = useMemo(() => {
    const activePage = clampedPlayerPage + 1;
    if (totalPlayerPages <= 7) {
      return Array.from({ length: totalPlayerPages }, (_, index) => index + 1);
    }

    const pages = [1];
    const start = Math.max(2, activePage - 1);
    const end = Math.min(totalPlayerPages - 1, activePage + 1);

    if (start > 2) pages.push('ellipsis-left');
    for (let page = start; page <= end; page += 1) pages.push(page);
    if (end < totalPlayerPages - 1) pages.push('ellipsis-right');
    pages.push(totalPlayerPages);

    return pages;
  }, [clampedPlayerPage, totalPlayerPages]);

  // Calculate team skill levels
  const calculateTeamSkillLevel = (teamPlayerIds) => {
    if (teamPlayerIds.length === 0) return 0;
    const total = teamPlayerIds.reduce((sum, playerId) => {
      const player = playersInSession.find(p => p._id === playerId);
      return sum + (skillLevelOrder[player?.playerLevel] || 0);
    }, 0);
    return (total / teamPlayerIds.length).toFixed(1);
  };

  const team1SkillLevel = calculateTeamSkillLevel(team1);
  const team2SkillLevel = calculateTeamSkillLevel(team2);

  const handleRemoveFromTeam = (playerId, team) => {
    if (team === 1) {
      setTeam1(team1.filter((id) => id !== playerId));
    } else {
      setTeam2(team2.filter((id) => id !== playerId));
    }
  };

  const handleAddExistingPlayerToSession = async (playerId) => {
    if (!selectedSessionId) return;
    setAddPlayerStatus("adding");
    setAddPlayerError("");
    try {
      const res = await addPlayersToSession({
        variables: { id: selectedSessionId, input: { playerIds: [playerId] } },
      });
      if (res.data?.addPlayersToSession?.ok) {
        setAddPlayerSearch("");
        setAddPlayerStatus("success");
        setTimeout(() => setAddPlayerStatus(null), 2000);
      } else {
        setAddPlayerError(res.data?.addPlayersToSession?.message || "Failed to add player.");
        setAddPlayerStatus("error");
      }
    } catch (err) {
      const message = getErrorMessage(err, "Failed to add player to session.");
      setAddPlayerError(message);
      setAddPlayerStatus("error");
      showErrorPopup(message);
    }
  };

  const handleCreateAndAddPlayer = async () => {
    const name = addPlayerSearch.trim();
    if (!name || !selectedSessionId) return;

    const normalizedName = name.toLowerCase();
    const immediateExactExistingPlayer = (players || []).find(
      (p) => (p?.name || '').trim().toLowerCase() === normalizedName
    );
    const immediateExactNameIsInSession = immediateExactExistingPlayer
      ? sessionPlayerIds.has(immediateExactExistingPlayer._id)
      : false;

    if (immediateExactExistingPlayer) {
      if (immediateExactNameIsInSession) {
        const message = `"${immediateExactExistingPlayer.name}" is already in this session.`;
        setAddPlayerError(message);
        setAddPlayerStatus("error");
        showErrorPopup(message);
        return;
      }

      await handleAddExistingPlayerToSession(immediateExactExistingPlayer._id);
      return;
    }

    setAddPlayerStatus("adding");
    setAddPlayerError("");
    try {
      const createRes = await createPlayer({ variables: { input: { name } } });
      if (!createRes.data?.createPlayer?.ok) {
        const message = createRes.data?.createPlayer?.message || "Failed to create player.";
        setAddPlayerError(message);
        setAddPlayerStatus("error");
        showErrorPopup(message);
        return;
      }
      const newPlayerId = createRes.data.createPlayer.player._id;
      const addRes = await addPlayersToSession({
        variables: { id: selectedSessionId, input: { playerIds: [newPlayerId] } },
      });
      if (addRes.data?.addPlayersToSession?.ok) {
        setAddPlayerSearch("");
        setAddPlayerStatus("success");
        setTimeout(() => setAddPlayerStatus(null), 2000);
      } else {
        const message = addRes.data?.addPlayersToSession?.message || "Player created but failed to add to session.";
        setAddPlayerError(message);
        setAddPlayerStatus("error");
        showErrorPopup(message);
      }
    } catch (err) {
      const message = getErrorMessage(err, "Failed to create player. The name may already exist.");
      setAddPlayerError(message);
      setAddPlayerStatus("error");
      showErrorPopup(message);
    }
  };

  // Allow up to 2 players per team (match type auto-detects at 1v1 or 2v2)
  const isValidMatch = (
    (team1.length === 1 && team2.length === 1) || 
    (team1.length === 2 && team2.length === 2)
  );
  const canSubmit = isValidMatch && selectedSessionId;

  // Check if court/players are available or queued
  const allPlayers = [...team1, ...team2];
  const courtBusy = sessionAllMatches.some((m) => m.courtId === selectedCourt);
  const playersInUse = sessionAllMatches.some((m) =>
    allPlayers.some((p) => m.playerIds?.includes(p))
  );
  // No court selected = always queued (auto-assigned to next free court)
  const isQueued = !selectedCourt || courtBusy || playersInUse;
  
  const getCourtName = () => {
    return allCourts.find((c) => c._id === selectedCourt)?.name || "Unknown";
  };

  const handleSubmitClick = (e) => {
    e.preventDefault();
    if (!canSubmit) return;

    const matchData = {
      sessionId: selectedSessionId,
      courtId: selectedCourt || null,
      playerIds: allPlayers,
      queued: isQueued,
    };
    setPendingMatchData(matchData);
    setShowConfirm(true);
  };

  const handleConfirmMatch = () => {
    onSubmit(pendingMatchData);
    setShowConfirm(false);
    setPendingMatchData(null);

    // Reset form
    setSelectedSessionId("");
    setMatchType("1v1");
    setSelectedCourt("");
    setTeam1([]);
    setTeam2([]);
  };

  const getPlayerName = (playerId) => {
    return (
      playersInSession.find((p) => p._id === playerId)?.name || "Unknown"
    );
  };

  // Get the active dragged player
  const activeDragPlayer = activeDragId ? playersInSession.find(p => p._id === activeDragId) : null;

  // Filter only OPEN sessions
  const openSessions = sessions?.filter(s => s.status === 'OPEN') || [];

  if (!isOpen) return null;

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

        <h2 className="mb-2 text-base font-semibold text-white sm:text-lg">Create Match</h2>

        {showConfirm ? (
          <div className="space-y-3">
            <div className="rounded border border-yellow-300/30 bg-yellow-500/10 p-2.5">
              <h3 className="mb-1 text-sm font-semibold text-yellow-200">
                  {!selectedCourt
                    ? "⏳ Queued — court will be auto-assigned"
                    : isQueued
                    ? "⏳ Match will be Queued"
                    : "✓ Match will start immediately"}
              </h3>
              <p className="text-xs text-slate-300">
                  {!selectedCourt
                    ? "No court selected. This match will be queued and automatically assigned to the next available court in this session."
                    : isQueued
                    ? "The court or players are currently busy. This match will be added to the queue."
                    : "The court and players are available. Match will start immediately."}
              </p>
            </div>

            <div className="rounded border border-white/10 bg-white/5 p-2.5">
              <h4 className="mb-1.5 text-xs font-semibold text-white">Match Details</h4>
              <div className="space-y-1.5 text-xs text-slate-300">
                <div>
                  <strong>Session:</strong> {selectedSession?.name}
                </div>
                <div>
                  <strong>Court:</strong> {getCourtName()}
                  {!selectedCourt && <span className="ml-1 text-slate-400">(auto-assign)</span>}
                </div>
                <div>
                  <strong>Format:</strong> {matchType}
                </div>
                <div>
                  <strong>Team 1:</strong> {team1.map(getPlayerName).join(", ")}
                </div>
                <div>
                  <strong>Team 2:</strong> {team2.map(getPlayerName).join(", ")}
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
                onClick={handleConfirmMatch}
                disabled={isLoading}
                className="flex-1 rounded-lg bg-emerald-500/20 px-3 py-1.5 text-sm font-semibold text-emerald-200 transition hover:bg-emerald-500/30 disabled:opacity-50"
              >
                {isLoading ? "Creating..." : "Confirm"}
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmitClick} className="space-y-3">
            {/* Session Selection, Match Type, Court Selection - 2x2 Grid */}
            <div className="grid grid-cols-2 gap-3">
              {/* Session Selection */}
              <div>
                <label htmlFor="create-match-session" className="mb-1.5 block text-xs font-semibold text-white">
                  Select Session
                </label>
                <select
                  id="create-match-session"
                  name="sessionId"
                  value={selectedSessionId}
                  onChange={(e) => {
                    const nextSessionId = e.target.value;
                    setSelectedSessionId(nextSessionId);
                    if (nextSessionId) {
                      localStorage.setItem(LAST_SESSION_KEY, nextSessionId);
                    } else {
                      localStorage.removeItem(LAST_SESSION_KEY);
                    }
                    setSelectedCourt("");
                    setTeam1([]);
                    setTeam2([]);
                    setAddPlayerSearch("");
                    setAddPlayerStatus(null);
                    setAddPlayerError("");
                  }}
                  className="w-full rounded border border-white/10 bg-slate-800 px-2 py-1 text-xs text-white focus:border-white/30 focus:outline-none"
                >
                  <option value="">Choose a session...</option>
                  {openSessions.map((session) => (
                    <option key={session._id} value={session._id}>
                      {session.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Match Type Display (Auto-detected) */}
              <div>
                <p className="mb-1.5 block text-xs font-semibold text-white">
                  Match Type
                </p>
                <div className="rounded border border-emerald-500/30 bg-emerald-500/10 px-2 py-1">
                  <p className="text-xs font-semibold text-emerald-200">
                    {matchType} ({matchType === "1v1" ? "Singles" : "Doubles"})
                  </p>
                  <p className="text-[8px] text-slate-400">
                    Auto-detected
                  </p>
                </div>
              </div>
            </div>

            {selectedSessionId && (
              <div className="flex flex-col gap-3">
                {/* Select Court + Add Player */}
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {/* Court Selection */}
                  <div>
                    <label htmlFor="create-match-court" className="mb-1.5 block text-xs font-semibold text-white">
                      Select Court
                    </label>
                    <select
                      id="create-match-court"
                      name="courtId"
                      value={selectedCourt}
                      onChange={(e) => setSelectedCourt(e.target.value)}
                      className="w-full rounded border border-white/10 bg-slate-800 px-2 py-1 text-xs text-white focus:border-white/30 focus:outline-none"
                    >
                      <option value="">— Any available court (auto-assign) —</option>

                      {[...courts].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })).map((court) => (
                        <option key={court._id} value={court._id}>
                          {court.name} ({formatCourtStatus(court.status)})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Add Player to Session */}
                  <div>
                    <label htmlFor="create-match-add-player" className="mb-1.5 block text-xs font-semibold text-white">
                      Add Player to Session
                    </label>
                    <div className="flex gap-1.5">
                      <input
                        id="create-match-add-player"
                        type="text"
                        placeholder="Search name to add..."
                        value={addPlayerSearch}
                        onChange={(e) => {
                          setAddPlayerSearch(e.target.value);
                          setAddPlayerError("");
                          setAddPlayerStatus(null);
                        }}
                        className="flex-1 rounded border border-white/10 bg-slate-800 px-2 py-1 text-xs text-white placeholder-slate-500 focus:border-white/30 focus:outline-none"
                      />
                      {canCreateNewPlayer && (
                        <button
                          type="button"
                          disabled={addPlayerStatus === "adding"}
                          onClick={handleCreateAndAddPlayer}
                          className="rounded border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-xs text-emerald-300 hover:bg-emerald-500/20 disabled:opacity-50"
                        >
                          {addPlayerStatus === "adding" ? "Adding..." : "+ Create & Add"}
                        </button>
                      )}
                    </div>
                    {addPlayerResults.length > 0 && (
                      <div className="mt-1.5 max-h-28 space-y-0.5 overflow-y-auto">
                        {addPlayerResults.map((p) => (
                          <div key={p._id} className="flex items-center justify-between rounded bg-slate-800 px-2 py-1">
                            <div>
                              <span className="text-xs text-white">{p.name}</span>
                              {p.playerLevel && (
                                <span className="ml-1.5 text-[9px] text-slate-400">{p.playerLevel}</span>
                              )}
                            </div>
                            <button
                              type="button"
                              disabled={addPlayerStatus === "adding"}
                              onClick={() => handleAddExistingPlayerToSession(p._id)}
                              className="rounded border border-blue-500/30 bg-blue-500/10 px-2 py-0.5 text-[10px] text-blue-300 hover:bg-blue-500/20 disabled:opacity-50"
                            >
                              {addPlayerStatus === "adding" ? "..." : "+ Add"}
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
                        No match — will create new player &quot;{addPlayerSearch.trim()}&quot;
                      </p>
                    )}
                    {addPlayerStatus === "success" && (
                      <p className="mt-1 text-[10px] text-emerald-400">✓ Player added to session!</p>
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
                        id="create-match-player-search"
                        name="playerSearch"
                        type="text"
                        placeholder="Name..."
                        value={searchTerm}
                        onChange={(e) => handleSearchTermChange(e.target.value)}
                        className="w-full rounded border border-white/10 bg-slate-800 px-2 py-1 text-xs text-white placeholder-slate-500 focus:border-white/30 focus:outline-none"
                      />
                    </div>
                    <select
                      id="create-match-skill-filter"
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
                        id="create-match-available-only"
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
                        id="create-match-zero-play-only"
                        name="showZeroPlayCountOnly"
                        type="checkbox"
                        checked={showZeroPlayCountOnly}
                        onChange={(e) => handleShowZeroPlayCountOnlyChange(e.target.checked)}
                        className="h-3 w-3 rounded border-white/20 bg-white/10"
                      />
                      Show 0 play count only
                    </label>
                    <label className="flex items-center gap-2" title="Show players who are in an ongoing match or queue">
                      <input
                        id="create-match-in-use-only"
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

                {/* Player Grid - 4x3 with Pagination */}
                <div className="order-3">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2 text-[9px] text-slate-400">
                        <span className="inline-flex items-center gap-1">
                          <span className="h-2 w-2 rounded-full bg-blue-500" />
                          <span>Hover to see teammate history</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => handleFilterBySkillChange(filterBySkill === 'BEGINNER' ? 'all' : 'BEGINNER')}
                          className={`flex items-center gap-1 rounded px-1.5 py-0.5 transition ${
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
                          className={`flex items-center gap-1 rounded px-1.5 py-0.5 transition ${
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
                          className={`flex items-center gap-1 rounded px-1.5 py-0.5 transition ${
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
                          className={`flex items-center gap-1 rounded px-1.5 py-0.5 transition ${
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
                      <div className="flex items-center gap-2 text-xs text-slate-400">
                        <button
                          type="button"
                          onClick={() => setCurrentPlayerPage(Math.max(0, currentPlayerPage - 1))}
                          disabled={currentPlayerPage === 0}
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
                              );
                            }

                            const isActive = item === clampedPlayerPage + 1;
                            return (
                              <button
                                key={`create-player-page-${item}`}
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
                            );
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
                          onClick={() => setCurrentPlayerPage(Math.min(totalPlayerPages - 1, currentPlayerPage + 1))}
                          disabled={currentPlayerPage >= totalPlayerPages - 1}
                          className="rounded-full border border-slate-300/40 px-3 py-1 text-xs font-semibold text-slate-200 transition hover:bg-slate-500/10 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Next
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="mb-3 space-y-2">
                    {pagedPlayers.length > 0 ? (
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
                              const teammateNames = teammateNamesByPlayerId.get(String(player._id)) || [];
                              return (
                                <DraggablePlayer
                                  key={player._id}
                                  player={player}
                                  isInUse={playersInUseSet.has(player._id)}
                                  isAssignedToTeam={team1.includes(player._id) || team2.includes(player._id)}
                                  teammateNames={teammateNames}
                                />
                              );
                            })}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="rounded border border-white/10 bg-white/5 p-2 text-center text-xs text-slate-400">
                        No players available
                      </div>
                    )}
                  </div>
                </div>

                {/* Team Selection - Droppable Zones */}
                <div className="order-1">
                  <p className="mb-2 text-xs font-semibold text-white">Drag to Teams</p>
                  <div className="grid grid-cols-2 gap-3">
                  {/* Team 1 */}
                  <DroppableTeam teamNumber={1}>
                    <h3 className="mb-2 text-xs font-semibold text-blue-200">
                      Team 1{" "}
                      {team1.length > 0 && team1.length === team2.length && (
                        <span className="text-xs text-blue-300">✓</span>
                      )}
                      {team1.length > 0 && (
                        <span className="ml-2 text-xs text-blue-300">
                          (Skill: {team1SkillLevel})
                        </span>
                      )}
                    </h3>
                    <div className="min-h-20">
                      {team1.length > 0 ? (
                        <div className="space-y-1.5">
                          {team1.map((playerId) => {
                            const player = playersInSession.find(p => p._id === playerId);
                            const playerLevel = player?.playerLevel || "No Skill Level Assinged";
                            const teammateNames = teammateNamesByPlayerId.get(String(playerId)) || [];
                            const teammateTooltip = buildTeammateTooltip(teammateNames);
                            return (
                            <DraggableSelectedPlayer key={playerId} playerId={playerId}>
                              <div
                                className={`group relative flex items-center justify-between rounded border px-1.5 py-0.5 ${getSkillLevelColor(player?.playerLevel)}`}
                              >
                                {teammateNames.length > 0 && (
                                  <TeammateIndicator
                                    tooltip={teammateTooltip}
                                    className="-right-1 -top-1 h-2.5 w-2.5"
                                    tooltipClassName="right-0 top-4"
                                  />
                                )}
                                <div className="text-[11px] text-white">
                                  <div className="font-semibold leading-tight">
                                    {getPlayerName(playerId)?.toUpperCase()}
                                    <span className={`ml-1 ${getSkillLevelTextColor(playerLevel)}`}>
                                      - {playerLevel}
                                    </span>
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
                            </DraggableSelectedPlayer>
                            );
                            })}
                        </div>
                      ) : (
                        <div className="flex h-20 items-center justify-center rounded border-2 border-dashed border-blue-300/30 bg-blue-500/5">
                          <p className="text-[11px] text-slate-400">Drop players here</p>
                        </div>
                      )}
                    </div>
                  </DroppableTeam>

                  {/* Team 2 */}
                  <DroppableTeam teamNumber={2}>
                    <h3 className="mb-2 text-xs font-semibold text-rose-200">
                      Team 2{" "}
                      {team2.length > 0 && team2.length === team1.length && (
                        <span className="text-xs text-rose-300">✓</span>
                      )}
                      {team2.length > 0 && (
                        <span className="ml-2 text-xs text-rose-300">
                          (Skill: {team2SkillLevel})
                        </span>
                      )}
                    </h3>
                    <div className="min-h-20">
                      {team2.length > 0 ? (
                        <div className="space-y-1.5">
                          {team2.map((playerId) => {
                            const player = playersInSession.find(p => p._id === playerId);
                            const playerLevel = player?.playerLevel || "No Skill Level Assigned";
                            const teammateNames = teammateNamesByPlayerId.get(String(playerId)) || [];
                            const teammateTooltip = buildTeammateTooltip(teammateNames);
                            return (
                            <DraggableSelectedPlayer key={playerId} playerId={playerId}>
                              <div
                                className={`group relative flex items-center justify-between rounded border px-1.5 py-0.5 ${getSkillLevelColor(player?.playerLevel)}`}
                              >
                                {teammateNames.length > 0 && (
                                  <TeammateIndicator
                                    tooltip={teammateTooltip}
                                    className="-right-1 -top-1 h-2.5 w-2.5"
                                    tooltipClassName="right-0 top-4"
                                  />
                                )}
                                <div className="text-[11px] text-white">
                                  <div className="font-semibold leading-tight">
                                    {getPlayerName(playerId)?.toUpperCase()}
                                    <span className={`ml-1 ${getSkillLevelTextColor(playerLevel)}`}>
                                      - {playerLevel}
                                    </span>
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
                            </DraggableSelectedPlayer>
                            );
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
              </div>
            )}

            {/* Form Actions */}
            <div className="flex gap-3 pt-3 border-t border-white/10">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-lg border border-white/20 px-3 py-1.5 text-sm font-semibold text-white/80 transition hover:bg-white/5 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!canSubmit}
                className="flex-1 rounded-lg bg-emerald-500/20 px-3 py-1.5 text-sm font-semibold text-emerald-200 transition hover:bg-emerald-500/30 disabled:opacity-50"
              >
                Continue
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
      <DragOverlay>
        {activeDragId && activeDragPlayer ? (
          <div className="cursor-grabbing rounded-lg border border-emerald-500/50 bg-emerald-500/20 p-2 text-center shadow-lg">
            <p className="truncate text-xs font-semibold text-white">{activeDragPlayer.name?.toUpperCase()}</p>
            <p className="text-[10px] text-slate-300">{activeDragPlayer.playerLevel}</p>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
};

export default CreateMatchForm;
