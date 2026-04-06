'use client';

import React from 'react'

const BadmintonCourt = ({ match, players, courts, preview = false, fullscreen = false }) => {
  if (!match) {
    return (
      <div className="flex h-32 items-center justify-center">
        <div className="text-center">
          <p className="text-sm font-semibold text-slate-300">No matches</p>
        </div>
      </div>
    )
  }

  const getPlayerName = (playerId) => {
    return (players?.find(p => p._id === playerId)?.name || 'Unknown').toUpperCase()
  }
  
  const getCourtName = (courtId) => {
    return courts?.find(c => c._id === courtId)?.name || 'Court'
  }

  const playerIds = match.playerIds || []
  const midpoint = Math.floor(playerIds.length / 2)
  const team1 = playerIds.slice(0, midpoint).map(getPlayerName)
  const team2 = playerIds.slice(midpoint).map(getPlayerName)

  // Preview mode dimensions - responsive for mobile
  const previewClass = preview ? 'w-16 h-10 sm:w-20 sm:h-12' : fullscreen ? 'w-full min-h-72 sm:min-h-80 lg:min-h-96' : 'w-full h-64 sm:h-48 md:h-40'
  const titleSize = preview ? 'text-xs' : 'text-sm sm:text-base'
  const subtitleSize = preview ? 'hidden' : fullscreen ? 'hidden' : 'text-[10px] sm:text-xs'
  const borderSize = preview ? 'border-1 sm:border-2' : 'border-2 sm:border-4'
  const playerNameSize = preview ? 'text-[8px]' : 'text-xs sm:text-sm md:text-base'
  const teamLabelSize = preview ? 'text-[8px]' : 'text-[11px] sm:text-sm md:text-base'

  // Horizontal court layout (left/right teams) - Compact
  return (
    <div className={`flex flex-col items-center justify-center ${fullscreen ? 'w-full' : 'space-y-1'} w-full ${preview ? 'max-w-xs' : fullscreen ? '' : 'w-full px-2 sm:px-0'}`}>
      {!fullscreen && (
        <div className="text-center">
          <h2 className={`font-bold text-emerald-300 uppercase ${titleSize}`}>{getCourtName(match.courtId)}</h2>
          <p className={`text-slate-400 ${subtitleSize}`}>Match in Progress</p>
        </div>
      )}

      {/* Badminton Court Layout - Proper Aspect Ratio */}
      <div className={`relative ${fullscreen ? 'w-full min-h-72 sm:min-h-80 lg:min-h-96' : previewClass} rounded-lg ${borderSize} border-yellow-600 bg-emerald-700 shadow-xl overflow-hidden`}>
        {/* The Main Court Lines (Including Singles Sidelines) */}
        <div className="absolute inset-0 border-4 sm:border-[5px] md:border-[6px] border-white mx-[3%] sm:mx-[5%]">
          {/* Center Net */}
          <div className="absolute inset-y-0 left-1/2 w-1 bg-white/70 z-20 -translate-x-1/2"></div>

          <div className="flex h-full w-full">
            {/* LEFT HALF */}
            <div className="relative flex-1 grid grid-cols-[12%_1fr_28%] border-r border-white/50">
              <div className="border-r-2 border-white h-full"></div>
              <div className="relative grid grid-rows-2">
                <div className="border-b-2 border-white"></div>
                <div></div>
              </div>
              <div className="bg-emerald-800/30 border-l-2 border-white"></div>
            </div>

            {/* RIGHT HALF */}
            <div className="relative flex-1 grid grid-cols-[28%_1fr_12%] border-l border-white/50">
              <div className="bg-emerald-800/30 border-r-2 border-white"></div>
              <div className="relative grid grid-rows-2">
                <div className="border-b-2 border-white"></div>
                <div></div>
              </div>
              <div className="border-l-2 border-white h-full"></div>
            </div>
          </div>
        </div>

        {/* Team 1 Players - Left Side */}
        <div className="absolute left-0 top-0 bottom-0 w-1/2 pointer-events-none flex items-center justify-center p-2 sm:p-3 md:p-4">
          <div className="absolute top-1 sm:top-2 left-1 sm:left-1">
            <div className="inline-flex items-center gap-1 sm:gap-2 rounded-full bg-blue-500 px-3 sm:px-4 py-1.5 sm:py-2 border border-blue-400/40">
              <div className="h-2 w-2 sm:h-2.5 sm:w-2.5 rounded-full bg-green-300 animate-pulse" />
              <span className={`font-bold text-blue-100 ${teamLabelSize}`}>Team 1</span>
            </div>
          </div>

          <div className="flex flex-col gap-1 sm:gap-2 h-full items-center justify-center">
            {team1.map((name, idx) => (
              <div key={idx} className="flex items-center justify-center">
                <div className={`rounded px-3 sm:px-4 py-1.5 sm:py-2 font-semibold text-white bg-blue-500 border border-blue-400 whitespace-nowrap ${playerNameSize}`}>
                  {name.length > 8 ? name.slice(0, 8) : name}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Team 2 Players - Right Side */}
        <div className="absolute right-0 top-0 bottom-0 w-1/2 pointer-events-none flex items-center justify-center p-2 sm:p-3 md:p-4">
          <div className="absolute top-1 sm:top-2 right-1 sm:right-2">
            <div className="inline-flex items-center gap-1 sm:gap-2 rounded-full bg-red-800 px-3 sm:px-4 py-1.5 sm:py-2 border border-red-400">
              <div className="h-2 w-2 sm:h-2.5 sm:w-2.5 rounded-full bg-green-300 animate-pulse" />
              <span className={`font-bold text-rose-100 ${teamLabelSize}`}>Team 2</span>
            </div>
          </div>

          <div className="flex flex-col gap-1 sm:gap-2 h-full items-center justify-center">
            {team2.map((name, idx) => (
              <div key={idx} className="flex items-center justify-center">
                <div className={`rounded px-3 sm:px-4 py-1.5 sm:py-2 font-semibold text-rose-100 bg-red-800 border border-rose-400/40 whitespace-nowrap ${playerNameSize}`}>
                  {name.length > 8 ? name.slice(0, 8) : name}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {!fullscreen && (
        <div className="text-center text-[10px] sm:text-xs text-slate-400">
          {playerIds.length === 2 ? '1v1 (Singles)' : '2v2 (Doubles)'}
        </div>
      )}
    </div>
  )
}

export default BadmintonCourt
