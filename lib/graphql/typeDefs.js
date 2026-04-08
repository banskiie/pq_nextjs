import { gql } from 'graphql-tag';

const typeDefs = gql`
  scalar Date

  # ─── Session ────────────────────────────────────────────────────────────────

  type SessionPlayer {
    playerId: ID!
    gamesPlayed: Int!
  }

  type Session {
    _id: ID!
    name: String!
    status: String!
    isArchived: Boolean!
    courts: [ID!]!
    players: [SessionPlayer!]!
    price: Float
    startedAt: Date
    endedAt: Date
    createdAt: Date!
    updatedAt: Date!
  }

  input CreateSessionInput {
    name: String!
    courtIds: [ID!]!
    playerIds: [ID!]
    price: Float
  }

  input UpdateSessionInput {
    name: String
    courtIds: [ID!]
    playerIds: [ID!]
    price: Float
  }

  input AddSessionPlayersInput {
    playerIds: [ID!]!
  }

  type SessionResult {
    ok: Boolean!
    message: String
    session: Session
  }

  type RemovePlayerFromSessionsResult {
    ok: Boolean!
    message: String
    sessions: [Session!]
  }

  # ─── Player ─────────────────────────────────────────────────────────────────

  type Player {
    _id: ID!
    name: String!
    gender: String
    playerLevel: String
    playCount: Int!
    winCount: Int!
    lossCount: Int!
    winRate: Float!
    createdAt: Date
    updatedAt: Date
  }

  type PlayersPaginatedResult {
    players: [Player!]!
    total: Int!
  }

  input CreatePlayerInput {
    name: String!
    gender: String
    playerLevel: String
  }

  input UpdatePlayerInput {
    name: String
    gender: String
    playerLevel: String
  }

  type PlayerResult {
    ok: Boolean!
    message: String
    player: Player
  }

  type DeleteResult {
    ok: Boolean!
    message: String
  }

  # ─── Court ──────────────────────────────────────────────────────────────────

  type Court {
    _id: ID!
    name: String!
    surfaceType: String!
    indoor: Boolean!
    description: String
    status: String!
    createdAt: Date
    updatedAt: Date
  }

  input CreateCourtInput {
    name: String!
    surfaceType: String
    indoor: Boolean
    description: String
    status: String
  }

  input UpdateCourtInput {
    name: String
    surfaceType: String
    indoor: Boolean
    description: String
    status: String
  }

  type CourtResult {
    ok: Boolean!
    message: String
    court: Court
  }

  # ─── Match ──────────────────────────────────────────────────────────────────

  type Match {
    _id: ID!
    sessionId: ID!
    courtId: ID
    playerIds: [ID!]!
    queued: Boolean!
    startedAt: Date
    createdAt: Date!
    updatedAt: Date!
  }

  input StartMatchInput {
    sessionId: ID!
    courtId: ID
    playerIds: [ID!]!
    queued: Boolean
  }

  input UpdateMatchInput {
    courtId: ID
    playerIds: [ID!]
  }

  type MatchResult {
    ok: Boolean!
    message: String
    match: Match
  }

  type EndMatchResult {
    ok: Boolean!
    message: String
  }

  # ─── Game ───────────────────────────────────────────────────────────────────

  type Game {
    _id: ID!
    sessionId: ID!
    courtId: ID
    players: [ID!]!
    winnerPlayerIds: [ID!]!
    finishedAt: Date
    createdAt: Date!
    updatedAt: Date!
  }

  input RecordGameInput {
    matchId: ID!
    sessionId: ID!
    courtId: ID
    playerIds: [ID!]!
    winnerPlayerIds: [ID!]!
    finishedAt: Date
  }

  type GameResult {
    ok: Boolean!
    message: String
    game: Game
  }

  # ─── Payment ────────────────────────────────────────────────────────────────

  type PaymentPlayer {
    playerId: ID!
    gamesPlayed: Int!
    total: Float!
    status: String!
    checkedOutAt: Date
  }

  type Payment {
    _id: ID!
    sessionId: ID!
    pricePerGame: Float!
    totalRevenue: Float!
    closedAt: Date
    createdAt: Date!
    updatedAt: Date!
    players: [PaymentPlayer!]!
  }

  type PaymentsHistoryResult {
    ok: Boolean!
    message: String
    payments: [Payment!]
  }

  type BillingResult {
    ok: Boolean!
    message: String
    payment: Payment
  }

  # ─── Queries ─────────────────────────────────────────────────────────────────

  type Query {
    sessions: [Session!]!
    session(id: ID!): Session
    closedSessions: [Session!]!
    ongoingMatches: [Match!]!
    courts: [Court!]!
    players: [Player!]!
    playersPaginated(
      limit: Int!
      offset: Int!
      search: String
      skillLevel: String
      sortBy: String
      sortOrder: String
    ): PlayersPaginatedResult!
    playersCount(search: String, skillLevel: String): Int!
    deletedPlayers: [Player!]!
    gamesBySession(sessionId: ID!): [Game!]!
    gamesBySessionIds(sessionIds: [ID!]!): [Game!]!
    paymentsHistory: PaymentsHistoryResult!
    billingBySession(sessionId: ID!): BillingResult!
  }

  # ─── Mutations ───────────────────────────────────────────────────────────────

  type Mutation {
    # Session
    createSession(input: CreateSessionInput!): SessionResult!
    updateSession(id: ID!, input: UpdateSessionInput!): SessionResult!
    startSession(id: ID!): SessionResult!
    endSession(id: ID!): SessionResult!
    archiveSession(id: ID!): SessionResult!
    addPlayersToSession(id: ID!, input: AddSessionPlayersInput!): SessionResult!
    removePlayerFromSessions(
      playerId: ID!
      sessionIds: [ID!]!
      isExempted: Boolean
    ): RemovePlayerFromSessionsResult!

    # Player
    createPlayer(input: CreatePlayerInput!): PlayerResult!
    updatePlayer(id: ID!, input: UpdatePlayerInput!): PlayerResult!
    deletePlayer(id: ID!): DeleteResult!
    restorePlayer(id: ID!, name: String): PlayerResult!

    # Court
    createCourt(input: CreateCourtInput!): CourtResult!
    updateCourt(id: ID!, input: UpdateCourtInput!): CourtResult!
    deleteCourt(id: ID!): CourtResult!

    # Match
    startMatch(input: StartMatchInput!): MatchResult!
    endMatch(id: ID!): EndMatchResult!
    startQueuedMatch(id: ID!, courtId: ID): MatchResult!
    updateMatch(id: ID!, input: UpdateMatchInput!): MatchResult!

    # Game
    recordGame(input: RecordGameInput!): GameResult!
  }
`;

export default typeDefs;
