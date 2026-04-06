'use client';

import React from 'react'

const STATUS_LABELS = {
  QUEUED: 'QUEUED',
  OPEN: 'ONGOING',
  CLOSED: 'INACTIVE',
}

const STATUS_STYLES = {
  QUEUED: 'border-amber-400/40 bg-amber-400/15 text-amber-200',
  OPEN: 'border-emerald-400/40 bg-emerald-400/15 text-emerald-200',
  CLOSED: 'border-slate-400/40 bg-slate-400/15 text-slate-200',
}

const StatusBadge = ({ status }) => {
  const label = STATUS_LABELS[status] ?? 'Unknown'
  const styles = STATUS_STYLES[status] ?? 'border-slate-500/40 bg-slate-500/15 text-slate-200'

  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${styles}`}
    >
      {label}
    </span>
  )
}

export default StatusBadge
