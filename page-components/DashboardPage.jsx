'use client';

import React from 'react'
import SessionStats from '@/components/SessionStats'
import SessionTable from '@/components/SessionTable'

const DashboardPage = ({ 
  sessions, 
  ongoingMatches, 
  matchQueue, 
  players,
  courts,
  isLoading,
  error,
  onViewSession,
  onEditSession,
  onEndSession,
  onCreateSession,
  onNavigateToMatches
}) => {
  // Filter out closed/inactive sessions - only show QUEUED and OPEN, exclude archived sessions
  const activeSessions = sessions.filter(session => session.status !== 'CLOSED' && !session.isArchived)

  return (
    <div className="space-y-4">
      <SessionStats 
        sessions={sessions} 
        ongoingMatches={ongoingMatches} 
        matchQueue={matchQueue} 
        players={players}
        courts={courts}
      />
      
      <SessionTable
        sessions={activeSessions}
        ongoingMatches={ongoingMatches}
        isLoading={isLoading}
        error={error}
        onViewSession={onViewSession}
        onEditSession={onEditSession}
        onEndSession={onEndSession}
        onCreateSession={onCreateSession}
        onNavigateToMatches={onNavigateToMatches}
      />
    </div>
  )
}

export default DashboardPage
