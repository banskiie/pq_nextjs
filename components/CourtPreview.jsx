'use client';

import React from 'react'

const CourtPreview = ({ match }) => {
  if (!match) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-emerald-700">
        <p className="text-[8px] text-slate-300">No match</p>
      </div>
    )
  }

  return (
    <div className="relative w-full h-full bg-emerald-700 overflow-hidden">
      {/* Court outer border with singles sidelines */}
      <div className="absolute inset-0 border-[3px] border-white mx-[3%]">
        {/* Center Net */}
        <div className="absolute inset-y-0 left-1/2 w-0.5 bg-white/70 z-20 -translate-x-1/2"></div>

        <div className="flex h-full w-full">
          {/* LEFT HALF */}
          <div className="relative flex-1 grid grid-cols-[12%_1fr_28%] border-r-2 border-white/50">
            <div className="border-r-2 border-white h-full"></div>
            <div className="relative grid grid-rows-2">
              <div className="border-b-2 border-white"></div>
              <div></div>
            </div>
            <div className="bg-emerald-800/30 border-l-2 border-white"></div>
          </div>

          {/* RIGHT HALF */}
          <div className="relative flex-1 grid grid-cols-[28%_1fr_12%] border-l-2 border-white/50">
            <div className="bg-emerald-800/30 border-r-2 border-white"></div>
            <div className="relative grid grid-rows-2">
              <div className="border-b-2 border-white"></div>
              <div></div>
            </div>
            <div className="border-l-2 border-white h-full"></div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default CourtPreview
