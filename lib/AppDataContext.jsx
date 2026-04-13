'use client';

import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { gql } from '@apollo/client';
import { useQuery, useMutation } from '@apollo/client/react';
import { createPusherClient } from '@/lib/pusherClient';
import { PUSHER_CHANNEL, PUSHER_EVENTS } from '@/lib/pusherEvents';

const SESSIONS_QUERY = gql`
  query Sessions {
    sessions {
      _id
      name
      status
      isArchived
      courts
      players {
        playerId
        gamesPlayed
      }
      price
      startedAt
      endedAt
      createdAt
      updatedAt
    }
  }
`;

const CREATE_SESSION_MUTATION = gql`
  mutation CreateSession($input: CreateSessionInput!) {
    createSession(input: $input) {
      ok
      message
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
        price
        startedAt
        endedAt
        createdAt
        updatedAt
      }
    }
  }
`;

const UPDATE_SESSION_MUTATION = gql`
  mutation UpdateSession($id: ID!, $input: UpdateSessionInput!) {
    updateSession(id: $id, input: $input) {
      ok
      message
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
        price
        startedAt
        endedAt
        createdAt
        updatedAt
      }
    }
  }
`;

const START_SESSION_MUTATION = gql`
  mutation StartSession($id: ID!) {
    startSession(id: $id) {
      ok
      message
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
`;

const END_SESSION_MUTATION = gql`
  mutation EndSession($id: ID!) {
    endSession(id: $id) {
      ok
      message
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
`;

const REMOVE_PLAYER_FROM_SESSIONS_MUTATION = gql`
  mutation RemovePlayerFromSessions($playerId: ID!, $sessionIds: [ID!]!, $isExempted: Boolean) {
    removePlayerFromSessions(playerId: $playerId, sessionIds: $sessionIds, isExempted: $isExempted) {
      ok
      message
      sessions {
        _id
        name
        status
        isArchived
        courts
        players {
          playerId
          gamesPlayed
        }
        price
        startedAt
        endedAt
        createdAt
        updatedAt
      }
    }
  }
`;

const ONGOING_MATCHES_QUERY = gql`
  query OngoingMatches {
    ongoingMatches {
      _id
      sessionId
      courtId
      playerIds
      queued
      startedAt
      createdAt
      updatedAt
    }
  }
`;

const START_MATCH_MUTATION = gql`
  mutation StartMatch($input: StartMatchInput!) {
    startMatch(input: $input) {
      ok
      message
      match {
        _id
        sessionId
        courtId
        playerIds
        queued
        startedAt
        createdAt
        updatedAt
      }
    }
  }
`;

const END_MATCH_MUTATION = gql`
  mutation EndMatch($id: ID!) {
    endMatch(id: $id) {
      ok
      message
    }
  }
`;

const START_QUEUED_MATCH_MUTATION = gql`
  mutation StartQueuedMatch($id: ID!, $courtId: ID) {
    startQueuedMatch(id: $id, courtId: $courtId) {
      ok
      message
      match {
        _id
        sessionId
        courtId
        playerIds
        queued
        startedAt
        createdAt
        updatedAt
      }
    }
  }
`;

const RECORD_GAME_MUTATION = gql`
  mutation RecordGame($input: RecordGameInput!) {
    recordGame(input: $input) {
      ok
      message
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
`;

const UPDATE_MATCH_MUTATION = gql`
  mutation UpdateMatch($id: ID!, $input: UpdateMatchInput!) {
    updateMatch(id: $id, input: $input) {
      ok
      message
      match {
        _id
        sessionId
        courtId
        playerIds
        queued
        startedAt
        createdAt
        updatedAt
      }
    }
  }
`;

const COURTS_QUERY = gql`
  query Courts {
    courts {
      _id
      name
      surfaceType
      indoor
      description
      status
    }
  }
`;

const PLAYERS_QUERY = gql`
  query Players {
    players {
      _id
      name
      gender
      playerLevel
      playCount
      winCount
      lossCount
      winRate
    }
  }
`;

const GAMES_BY_SESSION_IDS_QUERY = gql`
  query GamesBySessionIds($sessionIds: [ID!]!) {
    gamesBySessionIds(sessionIds: $sessionIds) {
      _id
      sessionId
      players
      finishedAt
      createdAt
      updatedAt
    }
  }
`;

const PAYMENTS_HISTORY_QUERY = gql`
  query PaymentsHistory {
    paymentsHistory {
      ok
      message
      payments {
        _id
        sessionId
        pricePerGame
        totalRevenue
        closedAt
        createdAt
        updatedAt
        players {
          playerId
          gamesPlayed
          total
          status
          checkedOutAt
        }
      }
    }
  }
`;

const AppDataContext = createContext(null);

export function useAppData() {
  const ctx = useContext(AppDataContext);
  if (!ctx) throw new Error('useAppData must be used inside AppDataProvider');
  return ctx;
}

export function AppDataProvider({ children }) {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editSession, setEditSession] = useState(null);
  const [selectedSessionId, setSelectedSessionId] = useState(null);
  const [ongoingMatches, setOngoingMatches] = useState({});
  const [matchQueue, setMatchQueue] = useState({});
  const [isEditMatchModalOpen, setIsEditMatchModalOpen] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [filteredSessionId, setFilteredSessionId] = useState(null);
  const [isCreateMatchModalOpen, setIsCreateMatchModalOpen] = useState(false);
  const [selectedMatchForWinners, setSelectedMatchForWinners] = useState(null);
  const [winnerTeam, setWinnerTeam] = useState('none');
  const [congratsToast, setCongratsToast] = useState(null);
  const [endSessionTarget, setEndSessionTarget] = useState(null);
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [showEndBlocked, setShowEndBlocked] = useState(false);
  const [isMessageModalOpen, setIsMessageModalOpen] = useState(false);
  const [messageModalText, setMessageModalText] = useState('');
  const [isEndingMatch, setIsEndingMatch] = useState(false);
  const startingQueuedIds = useRef(new Set());
  const isDev = process.env.NODE_ENV === 'development';

  const showMessageModal = (message) => {
    setMessageModalText(message || 'Something went wrong');
    setIsMessageModalOpen(true);
  };

  const { data, loading, error, refetch } = useQuery(SESSIONS_QUERY);
  const { data: ongoingMatchesData, refetch: refetchOngoingMatches } = useQuery(ONGOING_MATCHES_QUERY);
  const { data: courtsData, refetch: refetchCourts } = useQuery(COURTS_QUERY);
  const { data: playersData, refetch: refetchPlayers } = useQuery(PLAYERS_QUERY);
  const sessionIdsForGames = useMemo(
    () => (data?.sessions || []).map((session) => session._id),
    [data?.sessions]
  );
  const { data: gamesBySessionData } = useQuery(GAMES_BY_SESSION_IDS_QUERY, {
    variables: { sessionIds: sessionIdsForGames },
    skip: sessionIdsForGames.length === 0,
  });
  const { data: paymentsHistoryData, refetch: refetchPaymentsHistory } = useQuery(PAYMENTS_HISTORY_QUERY);

  // ─── Pusher real-time subscriptions ────────────────────────────────────────
  const [ongoingMatchSubData, setOngoingMatchSubData] = useState(null);

  useEffect(() => {
    const pusher = createPusherClient();
    if (!pusher) return undefined;
    const channel = pusher.subscribe(PUSHER_CHANNEL);

    const handleSession = () => { refetch(); };
    const handleCourt = () => { refetchCourts(); };
    const handlePayment = () => { refetchPaymentsHistory(); };
    const handleMatch = (payload) => {
      if (payload) setOngoingMatchSubData(payload);
      refetchOngoingMatches();
    };
    channel.bind(PUSHER_EVENTS.SESSION, handleSession);
    channel.bind(PUSHER_EVENTS.COURT, handleCourt);
    channel.bind(PUSHER_EVENTS.PAYMENT, handlePayment);
    channel.bind(PUSHER_EVENTS.MATCH, handleMatch);

    return () => {
      channel.unbind(PUSHER_EVENTS.SESSION, handleSession);
      channel.unbind(PUSHER_EVENTS.COURT, handleCourt);
      channel.unbind(PUSHER_EVENTS.PAYMENT, handlePayment);
      channel.unbind(PUSHER_EVENTS.MATCH, handleMatch);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [createSession, { loading: createLoading }] = useMutation(CREATE_SESSION_MUTATION);
  const [updateSession, { loading: updateLoading }] = useMutation(UPDATE_SESSION_MUTATION);
  const [removePlayerFromSessions] = useMutation(REMOVE_PLAYER_FROM_SESSIONS_MUTATION, {
    refetchQueries: [{ query: SESSIONS_QUERY }, { query: PAYMENTS_HISTORY_QUERY }],
  });
  const [startSession] = useMutation(START_SESSION_MUTATION);
  const [endSession, { loading: endSessionLoading }] = useMutation(END_SESSION_MUTATION, {
    refetchQueries: [{ query: SESSIONS_QUERY }],
  });
  const [startMatch] = useMutation(START_MATCH_MUTATION);
  const [endMatch] = useMutation(END_MATCH_MUTATION);
  const [recordGame, { loading: recordGameLoading }] = useMutation(RECORD_GAME_MUTATION);
  const [updateMatch] = useMutation(UPDATE_MATCH_MUTATION);
  const [startQueuedMatch] = useMutation(START_QUEUED_MATCH_MUTATION);

  const players = playersData?.players || [];

  // Scroll lock when any modal is open
  const isAnyModalOpen = Boolean(
    isFormOpen ||
    isEditMatchModalOpen ||
    isCreateMatchModalOpen ||
    isMessageModalOpen ||
    selectedMatchForWinners ||
    (showEndConfirm && endSessionTarget) ||
    showEndBlocked ||
    selectedSessionId
  );

  useEffect(() => {
    if (!congratsToast) return;
    const timeout = setTimeout(() => setCongratsToast(null), 4000);
    return () => clearTimeout(timeout);
  }, [congratsToast]);

  useEffect(() => {
    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    if (isAnyModalOpen) {
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
    }
    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
    };
  }, [isAnyModalOpen]);

  useEffect(() => {
    if (ongoingMatchesData?.ongoingMatches) {
      const ongoingBySession = {};
      const queuedBySession = {};
      ongoingMatchesData.ongoingMatches.forEach((match) => {
        const matchWithId = { _id: match._id, ...match };
        if (match.queued) {
          if (!queuedBySession[match.sessionId]) queuedBySession[match.sessionId] = [];
          queuedBySession[match.sessionId].push(matchWithId);
        } else {
          if (!ongoingBySession[match.sessionId]) ongoingBySession[match.sessionId] = [];
          ongoingBySession[match.sessionId].push(matchWithId);
        }
      });
      setOngoingMatches(ongoingBySession);
      setMatchQueue(queuedBySession);
    }
  }, [ongoingMatchesData]);

  useEffect(() => {
    if (!ongoingMatchSubData?.match) return;
    const { type, match } = ongoingMatchSubData;
    if (type === 'STARTED' || type === 'UPDATED' || type === 'CREATED') {
      setOngoingMatches((prev) => {
        const updated = { ...prev };
        if (!updated[match.sessionId]) updated[match.sessionId] = [];
        if (match.queued) {
          updated[match.sessionId] = updated[match.sessionId].filter((m) => m._id !== match._id);
          setMatchQueue((q) => {
            const q_updated = { ...q };
            if (!q_updated[match.sessionId]) q_updated[match.sessionId] = [];
            const index = q_updated[match.sessionId].findIndex((m) => m._id === match._id);
            if (index >= 0) {
              q_updated[match.sessionId][index] = { _id: match._id, ...match };
            } else {
              q_updated[match.sessionId].push({ _id: match._id, ...match });
            }
            return q_updated;
          });
        } else {
          setMatchQueue((q) => {
            const q_updated = { ...q };
            if (q_updated[match.sessionId]) {
              q_updated[match.sessionId] = q_updated[match.sessionId].filter((m) => m._id !== match._id);
            }
            return q_updated;
          });
          const index = updated[match.sessionId].findIndex((m) => m._id === match._id);
          if (index >= 0) {
            updated[match.sessionId][index] = { _id: match._id, ...match };
          } else {
            updated[match.sessionId].push({ _id: match._id, ...match });
          }
        }
        return updated;
      });
    } else if (type === 'DELETED' || type === 'ENDED') {
      setOngoingMatches((prev) => {
        const updated = { ...prev };
        if (updated[match.sessionId]) {
          updated[match.sessionId] = updated[match.sessionId].filter((m) => m._id !== match._id);
        }
        return updated;
      });
      setMatchQueue((prev) => {
        const updated = { ...prev };
        if (updated[match.sessionId]) {
          updated[match.sessionId] = updated[match.sessionId].filter((m) => m._id !== match._id);
        }
        return updated;
      });
    }
  }, [ongoingMatchSubData]);

  const sessions = (data?.sessions ?? []).filter((session) => !session?.isArchived);

  // Auto-start queued matches when courts become available
  useEffect(() => {
    const allOngoingMatches = Object.values(ongoingMatches).flat();
    const occupiedCourtIdSet = new Set(
      allOngoingMatches.map((m) => m?.courtId).filter(Boolean).map((id) => String(id))
    );
    const allQueuedMatches = Object.values(matchQueue).flat();
    const queueReservedCourtIdSet = new Set(
      allQueuedMatches.filter((m) => m?.courtId).map((m) => String(m.courtId))
    );
    const courtsAssignedThisRun = new Set();

    Object.entries(matchQueue).forEach(([, queue]) => {
      if (!queue || queue.length === 0) return;
      const availableMatch = queue.find((queuedMatch) => {
        if (!queuedMatch?._id || !queuedMatch.courtId || startingQueuedIds.current.has(queuedMatch._id)) return false;
        const courtBusy = occupiedCourtIdSet.has(String(queuedMatch.courtId));
        const playersInUse = allOngoingMatches.some((m) =>
          queuedMatch.playerIds?.some((p) => m.playerIds?.includes(p))
        );
        return !courtBusy && !playersInUse;
      });
      if (availableMatch) {
        startingQueuedIds.current.add(availableMatch._id);
        startQueuedMatch({ variables: { id: availableMatch._id } })
          .catch((err) => { console.error('Error auto-starting queued match:', err); })
          .finally(() => { setTimeout(() => { startingQueuedIds.current.delete(availableMatch._id); }, 100); });
        return;
      }
    });

    Object.entries(matchQueue).forEach(([sessionId, queue]) => {
      if (!queue || queue.length === 0) return;
      const floatingMatch = queue.find((qm) => {
        if (!qm?._id || qm.courtId || startingQueuedIds.current.has(qm._id)) return false;
        const playersInUse = allOngoingMatches.some((m) =>
          qm.playerIds?.some((p) => m.playerIds?.includes(p))
        );
        return !playersInUse;
      });
      if (!floatingMatch) {
        if (isDev) console.debug('[QueueAutoAssign] skip: no eligible floating match', { sessionId, queueLength: queue.length });
        return;
      }
      const session = sessions?.find((s) => s._id === sessionId);
      const sessionCourtIds = session?.courts || [];
      const sessionCourtIdSet = new Set(sessionCourtIds.map((id) => String(id)));
      const allCourts = courtsData?.courts || [];
      if (!session) {
        if (isDev) console.debug('[QueueAutoAssign] skip: session not found', { sessionId, floatingMatchId: floatingMatch._id });
        return;
      }
      const freeCourt = allCourts.find(
        (c) =>
          sessionCourtIdSet.has(String(c._id)) &&
          !occupiedCourtIdSet.has(String(c._id)) &&
          !queueReservedCourtIdSet.has(String(c._id)) &&
          !courtsAssignedThisRun.has(String(c._id))
      );
      if (!freeCourt) {
        if (isDev) console.debug('[QueueAutoAssign] skip: no free court', { sessionId, floatingMatchId: floatingMatch._id, sessionCourtIds });
        return;
      }
      if (isDev) console.debug('[QueueAutoAssign] start floating match', { sessionId, floatingMatchId: floatingMatch._id, assignedCourtId: freeCourt._id });
      startingQueuedIds.current.add(floatingMatch._id);
      courtsAssignedThisRun.add(String(freeCourt._id));
      startQueuedMatch({ variables: { id: floatingMatch._id, courtId: freeCourt._id } })
        .catch((err) => { console.error('Error auto-starting floating queued match:', err); })
        .finally(() => { setTimeout(() => { startingQueuedIds.current.delete(floatingMatch._id); }, 100); });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchQueue, ongoingMatches, startQueuedMatch, sessions, courtsData]);

  const handleStartSession = async (sessionId) => {
    try {
      const result = await startSession({ variables: { id: sessionId } });
      if (!result.data.startSession.ok) alert(result.data.startSession.message);
    } catch (err) {
      alert(err.message);
    }
  };

  const handleCreateSession = async (formData) => {
    try {
      if (editSession) {
        const input = { name: formData.name, courtIds: formData.courts, playerIds: formData.players };
        if (formData.price !== '' && formData.price !== null && formData.price !== undefined) {
          input.price = parseFloat(formData.price);
        }
        const result = await updateSession({ variables: { id: editSession._id, input } });
        if (result.data.updateSession.ok) {
          setIsFormOpen(false);
          setEditSession(null);
        } else {
          showMessageModal(result.data.updateSession.message);
        }
      } else {
        const input = { name: formData.name, courtIds: formData.courts, playerIds: formData.players };
        if (formData.price !== '' && formData.price !== null && formData.price !== undefined) {
          input.price = parseFloat(formData.price);
        }
        const result = await createSession({ variables: { input } });
        if (result.data.createSession.ok) {
          const newSessionId = result.data.createSession.session._id;
          await handleStartSession(newSessionId);
          setIsFormOpen(false);
        } else {
          alert(result.data.createSession.message);
        }
      }
    } catch (err) {
      alert(err.message);
    }
  };

  const handleViewSession = (session) => {
    setSelectedSessionId(session._id);
  };

  const handleEditSession = (session) => {
    setEditSession(session);
    setIsFormOpen(true);
  };

  const handleEndSessionClick = (session) => {
    setEndSessionTarget(session);
    setShowEndConfirm(true);
  };

  const handleConfirmEndSession = async () => {
    if (!endSessionTarget) return;
    const sessionId = endSessionTarget._id;
    const hasOngoingForSession = (ongoingMatches[sessionId] || []).length > 0;
    const hasQueuedForSession = (matchQueue[sessionId] || []).length > 0;
    if (hasOngoingForSession || hasQueuedForSession) {
      setShowEndBlocked(true);
      return;
    }
    try {
      const result = await endSession({ variables: { id: sessionId } });
      if (result.data?.endSession?.ok) {
        setShowEndConfirm(false);
        setEndSessionTarget(null);
      } else {
        alert(result.data?.endSession?.message || 'Failed to end session');
      }
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  const handleEditMatch = (match) => {
    setSelectedMatch(match);
    setIsEditMatchModalOpen(true);
  };

  const handleEditMatchSubmit = async (formData) => {
    try {
      const result = await updateMatch({
        variables: {
          id: selectedMatch._id,
          input: { courtId: formData.courtId, playerIds: formData.playerIds },
        },
      });
      if (result.data.updateMatch.ok) {
        setIsEditMatchModalOpen(false);
        setSelectedMatch(null);
        await refetchOngoingMatches();
      } else {
        alert(result.data.updateMatch.message);
      }
    } catch (err) {
      alert(err.message);
    }
  };

  const handleCancelMatch = async (match) => {
    const confirmed = window.confirm('Are you sure you want to cancel this queued match?');
    if (!confirmed) return;
    try {
      const result = await endMatch({ variables: { id: match._id } });
      if (result.data.endMatch.ok) {
        await refetchOngoingMatches();
      } else {
        alert(result.data.endMatch.message);
      }
    } catch (err) {
      alert(err.message);
    }
  };

  const handleUpdateOngoingMatch = (match) => {
    setSelectedMatch(match);
    setIsEditMatchModalOpen(true);
  };

  const handleStartQueuedMatch = async (match) => {
    if (!match?.queued) return;
    try {
      const result = await startQueuedMatch({ variables: { id: match._id } });
      if (result.data?.startQueuedMatch?.ok) {
        const updatedMatch = result.data.startQueuedMatch.match;
        setOngoingMatches((prev) => ({
          ...prev,
          [updatedMatch.sessionId]: (prev[updatedMatch.sessionId] || []).map((m) =>
            m._id === updatedMatch._id ? updatedMatch : m
          ),
        }));
      } else {
        alert(result.data?.startQueuedMatch?.message || 'Failed to start match');
      }
    } catch (err) {
      alert(err.message);
    }
  };

  const handleEndOngoingMatch = (match) => {
    setSelectedMatchForWinners(match);
    setWinnerTeam('none');
  };

  const getPlayerName = (playerId) => {
    return players.find((p) => p._id === playerId)?.name || 'Unknown';
  };

  const getTeamsForMatch = (match) => {
    const ids = match?.playerIds || [];
    const midpoint = Math.floor(ids.length / 2);
    return { team1: ids.slice(0, midpoint), team2: ids.slice(midpoint) };
  };

  const handleConfirmEndMatch = async () => {
    if (!selectedMatchForWinners || isEndingMatch) return;
    const { team1, team2 } = getTeamsForMatch(selectedMatchForWinners);
    const hasWinnerSelection = winnerTeam === 'team1' || winnerTeam === 'team2';
    const winnerIds = hasWinnerSelection ? (winnerTeam === 'team1' ? team1 : team2) : [];
    const loserIds = hasWinnerSelection ? (winnerTeam === 'team1' ? team2 : team1) : [];
    if (hasWinnerSelection && (winnerIds.length === 0 || loserIds.length === 0)) {
      alert('Unable to determine teams for this match');
      return;
    }
    const gameInput = {
      matchId: selectedMatchForWinners._id,
      sessionId: selectedMatchForWinners.sessionId,
      courtId: selectedMatchForWinners.courtId,
      playerIds: selectedMatchForWinners.playerIds,
      winnerPlayerIds: winnerIds,
      finishedAt: new Date().toISOString(),
    };
    try {
      setIsEndingMatch(true);
      const recordResult = await recordGame({ variables: { input: gameInput } });
      if (!recordResult.data.recordGame.ok) {
        alert(recordResult.data.recordGame.message);
        return;
      }
      const endResult = await endMatch({ variables: { id: selectedMatchForWinners._id } });
      if (!endResult.data.endMatch.ok && endResult.data.endMatch.message !== 'Match not found') {
        alert(endResult.data.endMatch.message);
        return;
      }
      await refetch();
      await refetchOngoingMatches();
      if (winnerIds.length > 0) {
        setCongratsToast({
          winners: winnerIds.map(getPlayerName),
          losers: loserIds.map(getPlayerName),
        });
      }
      setSelectedMatchForWinners(null);
      setWinnerTeam('none');
    } catch (err) {
      alert(err.message);
    } finally {
      setIsEndingMatch(false);
    }
  };

  const handleCreateMatch = () => {
    setIsCreateMatchModalOpen(true);
  };

  const handleCreateMatchSubmit = async (matchData) => {
    try {
      const result = await startMatch({
        variables: {
          input: {
            sessionId: matchData.sessionId,
            courtId: matchData.courtId,
            playerIds: matchData.playerIds,
            queued: matchData.queued || false,
          },
        },
      });
      if (result.data.startMatch.ok) {
        await refetchOngoingMatches();
        if (result.data.startMatch.match?.queued && result.data.startMatch.message) {
          alert(result.data.startMatch.message);
        }
      } else {
        alert(result.data.startMatch.message);
      }
    } catch (err) {
      alert(err.message);
    }
  };

  const handleFinishPlayer = async (playerId, options = {}) => {
    try {
      const { isExempted, sessionsToRemoveFrom } = options;
      if (sessionsToRemoveFrom && sessionsToRemoveFrom.length > 0) {
        const result = await removePlayerFromSessions({
          variables: { playerId, sessionIds: sessionsToRemoveFrom, isExempted: Boolean(isExempted) },
        });
        if (!result.data.removePlayerFromSessions.ok) {
          alert(result.data.removePlayerFromSessions.message);
        }
      }
    } catch (err) {
      alert(`Error finishing player: ${err.message}`);
    }
  };

  const value = {
    // Data
    sessions,
    players,
    courts: courtsData?.courts || [],
    ongoingMatches,
    matchQueue,
    gamesBySessionData: gamesBySessionData?.gamesBySessionIds || [],
    paymentsHistoryData: paymentsHistoryData?.paymentsHistory?.payments || [],
    isLoading: loading,
    errorMessage: error?.message ?? '',
    // Navigation / filter
    filteredSessionId,
    setFilteredSessionId,
    selectedSessionId,
    setSelectedSessionId,
    // Modal state
    isFormOpen,
    setIsFormOpen,
    editSession,
    setEditSession,
    isEditMatchModalOpen,
    setIsEditMatchModalOpen,
    selectedMatch,
    setSelectedMatch,
    isCreateMatchModalOpen,
    setIsCreateMatchModalOpen,
    selectedMatchForWinners,
    setSelectedMatchForWinners,
    winnerTeam,
    setWinnerTeam,
    congratsToast,
    setCongratsToast,
    endSessionTarget,
    setEndSessionTarget,
    showEndConfirm,
    setShowEndConfirm,
    showEndBlocked,
    setShowEndBlocked,
    isMessageModalOpen,
    setIsMessageModalOpen,
    messageModalText,
    isEndingMatch,
    recordGameLoading,
    endSessionLoading,
    createLoading,
    updateLoading,
    // Handlers
    handleCreateSession,
    handleStartSession,
    handleViewSession,
    handleEditSession,
    handleEndSessionClick,
    handleConfirmEndSession,
    handleEditMatch,
    handleEditMatchSubmit,
    handleCancelMatch,
    handleUpdateOngoingMatch,
    handleStartQueuedMatch,
    handleEndOngoingMatch,
    handleConfirmEndMatch,
    handleCreateMatch,
    handleCreateMatchSubmit,
    handleFinishPlayer,
    refetchPlayers,
  };

  return (
    <AppDataContext.Provider value={value}>
      {children}
    </AppDataContext.Provider>
  );
}
