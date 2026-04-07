'use client';

import React, { useEffect, useMemo, useState } from 'react'
import { gql } from '@apollo/client'
import { useMutation, useQuery, useSubscription } from '@apollo/client/react'

const COURTS_QUERY = gql`
  query CourtsPage {
    courts {
      _id
      name
      surfaceType
      indoor
      description
      status
      createdAt
      updatedAt
    }
  }
`

const CREATE_COURT_MUTATION = gql`
  mutation CreateCourtPage($input: CreateCourtInput!) {
    createCourt(input: $input) {
      ok
      message
      court {
        _id
        name
        surfaceType
        indoor
        description
        status
        createdAt
        updatedAt
      }
    }
  }
`

const UPDATE_COURT_MUTATION = gql`
  mutation UpdateCourtPage($id: ID!, $input: UpdateCourtInput!) {
    updateCourt(id: $id, input: $input) {
      ok
      message
      court {
        _id
        name
        surfaceType
        indoor
        description
        status
        createdAt
        updatedAt
      }
    }
  }
`

const DELETE_COURT_MUTATION = gql`
  mutation DeleteCourtPage($id: ID!) {
    deleteCourt(id: $id) {
      ok
      message
      court {
        _id
      }
    }
  }
`

const COURT_SUBSCRIPTION = gql`
  subscription CourtsPageSub {
    courtSub {
      type
      court {
        _id
        name
        surfaceType
        indoor
        description
        status
        createdAt
        updatedAt
      }
    }
  }
`

const SURFACE_OPTIONS = ['WOODEN', 'RUBBER']
const STATUS_OPTIONS = ['ACTIVE', 'OCCUPIED', 'MAINTENANCE']

const EMPTY_FORM = {
  name: '',
  surfaceType: 'WOODEN',
  indoor: true,
  description: '',
  status: 'ACTIVE',
}

const formatLabel = (value) => (value ? value.replace(/_/g, ' ') : '—')

const statusColors = {
  ACTIVE: 'bg-emerald-500/20 text-emerald-200',
  OCCUPIED: 'bg-amber-500/20 text-amber-200',
  MAINTENANCE: 'bg-rose-500/20 text-rose-200',
}

// ─── Add / Edit Modal ────────────────────────────────────────────────────────

const CourtFormModal = ({ isOpen, onClose, court, onSubmit, isSubmitting, errorMessage }) => {
  const [formData, setFormData] = useState(EMPTY_FORM)

  useEffect(() => {
    if (!isOpen) return
    setFormData(
      court
        ? {
            name: court.name || '',
            surfaceType: court.surfaceType || 'WOODEN',
            indoor: Boolean(court.indoor),
            description: court.description || '',
            status: court.status || 'ACTIVE',
          }
        : EMPTY_FORM
    )
  }, [isOpen, court])

  if (!isOpen) return null

  const handleChange = (field, value) => setFormData((prev) => ({ ...prev, [field]: value }))

  const handleSubmit = (e) => {
    e.preventDefault()
    onSubmit(formData)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="relative w-full max-w-md rounded-2xl border border-white/10 bg-slate-900 shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full bg-slate-800 p-2 text-slate-300 transition hover:bg-slate-700 hover:text-white"
          aria-label="Close"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="p-6">
          <div className="mb-5 pr-8">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-sky-300">
              {court ? 'Edit Court' : 'New Court'}
            </p>
            <h2 className="mt-1 text-xl font-semibold text-white">
              {court ? `Update ${court.name}` : 'Add a court'}
            </h2>
          </div>

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-200" htmlFor="cf-name">
                Court name
              </label>
              <input
                id="cf-name"
                type="text"
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                placeholder="Court 1"
                className="w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-white outline-none transition focus:border-emerald-300/40"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-200" htmlFor="cf-surface">
                  Surface type
                </label>
                <select
                  id="cf-surface"
                  value={formData.surfaceType}
                  onChange={(e) => handleChange('surfaceType', e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-white outline-none transition focus:border-emerald-300/40"
                >
                  {SURFACE_OPTIONS.map((o) => (
                    <option key={o} value={o} className="text-white">
                      {formatLabel(o)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-200" htmlFor="cf-status">
                  Status
                </label>
                <select
                  id="cf-status"
                  value={formData.status}
                  onChange={(e) => handleChange('status', e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-white outline-none transition focus:border-emerald-300/40"
                >
                  {STATUS_OPTIONS.map((o) => (
                    <option key={o} value={o} className="text-white">
                      {formatLabel(o)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <span className="mb-1.5 block text-sm font-medium text-slate-200">Location</span>
              <div className="flex gap-2">
                {[true, false].map((val) => (
                  <button
                    key={String(val)}
                    type="button"
                    onClick={() => handleChange('indoor', val)}
                    className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition ${
                      formData.indoor === val
                        ? 'border-emerald-300/40 bg-emerald-500/20 text-emerald-100'
                        : 'border-white/10 bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    {val ? 'Indoor' : 'Outdoor'}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-200" htmlFor="cf-desc">
                Description
              </label>
              <textarea
                id="cf-desc"
                rows={3}
                value={formData.description}
                onChange={(e) => handleChange('description', e.target.value)}
                placeholder="Optional notes about this court"
                className="w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-white outline-none transition focus:border-emerald-300/40"
              />
            </div>

            {errorMessage && (
              <div className="rounded-lg border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
                {errorMessage}
              </div>
            )}

            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-lg border border-white/15 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 rounded-lg bg-emerald-500/20 px-4 py-2 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-500/30 disabled:opacity-50"
              >
                {isSubmitting ? 'Saving…' : court ? 'Save Changes' : 'Create Court'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

// ─── Delete Confirm Modal ─────────────────────────────────────────────────────

const DeleteConfirmModal = ({ court, onConfirm, onCancel, isDeleting }) => {
  if (!court) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="relative w-full max-w-sm rounded-2xl border border-white/10 bg-slate-900 p-6 shadow-2xl">
        <h2 className="mb-2 text-lg font-semibold text-white">Delete court?</h2>
        <p className="mb-6 text-sm text-slate-300">
          Are you sure you want to delete <span className="font-semibold text-white">{court.name}</span>? This action cannot be undone.
        </p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-lg border border-white/15 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            className="flex-1 rounded-lg bg-rose-500/20 px-4 py-2 text-sm font-semibold text-rose-200 transition hover:bg-rose-500/30 disabled:opacity-50"
          >
            {isDeleting ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Courts Page ──────────────────────────────────────────────────────────────

const COURTS_PER_PAGE = 10

const CourtsPage = () => {
  const [courtsState, setCourtsState] = useState([])
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingCourt, setEditingCourt] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [formError, setFormError] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [expandedCourtId, setExpandedCourtId] = useState(null)
  const [sortKey, setSortKey] = useState('name')
  const [sortDir, setSortDir] = useState('asc')

  const { data: courtsData, refetch: refetchCourts } = useQuery(COURTS_QUERY)

  useSubscription(COURT_SUBSCRIPTION, {
    onData: () => { refetchCourts() },
    onError: () => { refetchCourts() },
  })

  useEffect(() => {
    if (courtsData?.courts) {
      setCourtsState(courtsData.courts)
    }
  }, [courtsData])

  const [createCourt] = useMutation(CREATE_COURT_MUTATION)
  const [updateCourt] = useMutation(UPDATE_COURT_MUTATION)
  const [deleteCourt] = useMutation(DELETE_COURT_MUTATION)

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
    setCurrentPage(1)
  }

  const filtered = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()
    let list = term
      ? courtsState.filter(
          (c) =>
            c.name.toLowerCase().includes(term) ||
            c.surfaceType?.toLowerCase().includes(term) ||
            c.status?.toLowerCase().includes(term)
        )
      : [...courtsState]

    list = [...list].sort((a, b) => {
      let av = a[sortKey] ?? ''
      let bv = b[sortKey] ?? ''
      if (typeof av === 'boolean') { av = av ? 1 : 0; bv = bv ? 1 : 0 }
      const cmp =
        typeof av === 'string'
          ? av.localeCompare(bv, undefined, { numeric: true, sensitivity: 'base' })
          : av - bv
      return sortDir === 'asc' ? cmp : -cmp
    })
    return list
  }, [courtsState, searchTerm, sortKey, sortDir])

  const totalPages = Math.max(1, Math.ceil(filtered.length / COURTS_PER_PAGE))
  const paginated = filtered.slice((currentPage - 1) * COURTS_PER_PAGE, currentPage * COURTS_PER_PAGE)

  // Reset to page 1 whenever the search term changes
  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm])

  const openAdd = () => {
    setEditingCourt(null)
    setFormError('')
    setIsFormOpen(true)
  }

  const openEdit = (court) => {
    setEditingCourt(court)
    setFormError('')
    setIsFormOpen(true)
  }

  const handleFormSubmit = async (formData) => {
    const trimmedName = formData.name.trim()
    if (!trimmedName) {
      setFormError('Court name is required.')
      return
    }

    setIsSubmitting(true)
    setFormError('')

    const payload = {
      name: trimmedName,
      surfaceType: formData.surfaceType,
      indoor: formData.indoor,
      description: formData.description?.trim() ?? '',
      status: formData.status,
    }

    try {
      if (editingCourt) {
        const result = await updateCourt({ variables: { id: editingCourt._id, input: payload } })
        if (!result.data?.updateCourt?.ok) {
          setFormError(result.data?.updateCourt?.message || 'Failed to update court.')
          return
        }
      } else {
        const result = await createCourt({ variables: { input: payload } })
        if (!result.data?.createCourt?.ok) {
          setFormError(result.data?.createCourt?.message || 'Failed to create court.')
          return
        }
      }
      await refetchCourts()
      setIsFormOpen(false)
      setEditingCourt(null)
    } catch (err) {
      setFormError(err.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return
    setIsDeleting(true)
    try {
      const result = await deleteCourt({ variables: { id: deleteTarget._id } })
      if (!result.data?.deleteCourt?.ok) {
        alert(result.data?.deleteCourt?.message || 'Failed to delete court.')
        return
      }
      await refetchCourts()
      setDeleteTarget(null)
    } catch (err) {
      alert(err.message)
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="space-y-6 py-5">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-base font-semibold text-white sm:text-lg">Courts List</h3>
        <button
          onClick={openAdd}
          className="inline-flex items-center justify-center rounded-lg bg-emerald-500/20 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-200 transition hover:bg-emerald-500/30"
        >
          + Add New Court
        </button>
      </div>

      {/* Search */}
      <div>
        <input
          type="text"
          placeholder="Search by name, surface, or status…"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-white placeholder-slate-500 focus:border-white/30 focus:outline-none"
        />
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-white/10 bg-slate-900/40">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10 bg-slate-900/80">
              {[{ key: 'name', label: 'Name' },].map(({ key, label }) => (
                <th
                  key={key}
                  onClick={() => handleSort(key)}
                  className="cursor-pointer select-none px-3.5 py-3 text-left text-xs font-semibold uppercase tracking-[0.15em] text-slate-400 hover:text-white"
                >
                  <span className="inline-flex items-center gap-1">
                    {label}
                    <span className="text-slate-500">{sortKey === key ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}</span>
                  </span>
                </th>
              ))}
              {[{ key: 'surfaceType', label: 'Surface' },].map(({ key, label }) => (
                <th
                  key={key}
                  onClick={() => handleSort(key)}
                  className="hidden cursor-pointer select-none px-3.5 py-3 text-left text-xs font-semibold uppercase tracking-[0.15em] text-slate-400 hover:text-white sm:table-cell"
                >
                  <span className="inline-flex items-center gap-1">
                    {label}
                    <span className="text-slate-500">{sortKey === key ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}</span>
                  </span>
                </th>
              ))}
              {[{ key: 'indoor', label: 'Location' },].map(({ key, label }) => (
                <th
                  key={key}
                  onClick={() => handleSort(key)}
                  className="hidden cursor-pointer select-none px-3.5 py-3 text-left text-xs font-semibold uppercase tracking-[0.15em] text-slate-400 hover:text-white sm:table-cell"
                >
                  <span className="inline-flex items-center gap-1">
                    {label}
                    <span className="text-slate-500">{sortKey === key ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}</span>
                  </span>
                </th>
              ))}
              {[{ key: 'status', label: 'Status' },].map(({ key, label }) => (
                <th
                  key={key}
                  onClick={() => handleSort(key)}
                  className="cursor-pointer select-none px-3.5 py-3 text-left text-xs font-semibold uppercase tracking-[0.15em] text-slate-400 hover:text-white"
                >
                  <span className="inline-flex items-center gap-1">
                    {label}
                    <span className="text-slate-500">{sortKey === key ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}</span>
                  </span>
                </th>
              ))}
              {[{ key: 'description', label: 'Description' },].map(({ key, label }) => (
                <th
                  key={key}
                  onClick={() => handleSort(key)}
                  className="hidden cursor-pointer select-none px-3.5 py-3 text-left text-xs font-semibold uppercase tracking-[0.15em] text-slate-400 hover:text-white md:table-cell"
                >
                  <span className="inline-flex items-center gap-1">
                    {label}
                    <span className="text-slate-500">{sortKey === key ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}</span>
                  </span>
                </th>
              ))}
              <th className="px-3.5 py-3 text-center text-xs font-semibold uppercase tracking-[0.15em] text-slate-400">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {paginated.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3.5 py-10 text-center text-sm text-slate-500">
                  {searchTerm ? 'No courts match your search.' : 'No courts found. Add one to get started.'}
                </td>
              </tr>
            ) : (
              paginated.map((court) => (
                <React.Fragment key={court._id}>
                  <tr className="border-b border-white/10 transition hover:bg-white/5">
                    <td className="px-3.5 py-3 font-medium text-white">
                      <button
                        type="button"
                        onClick={() => setExpandedCourtId((prev) => (prev === court._id ? null : court._id))}
                        className="flex w-full items-center justify-between gap-2 text-left"
                      >
                        <span>{court.name}</span>
                        <span className="text-slate-400 sm:hidden">{expandedCourtId === court._id ? '▼' : '▶'}</span>
                      </button>
                    </td>
                    <td className="hidden px-3.5 py-3 text-slate-300 sm:table-cell">
                      {formatLabel(court.surfaceType)}
                    </td>
                    <td className="hidden px-3.5 py-3 sm:table-cell">
                      <span className="inline-flex items-center rounded-full bg-slate-800/60 px-2.5 py-0.5 text-xs text-slate-300">
                        {court.indoor ? 'Indoor' : 'Outdoor'}
                      </span>
                    </td>
                    <td className="px-3.5 py-3">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColors[court.status] || 'bg-slate-700/50 text-slate-300'}`}>
                        {formatLabel(court.status)}
                      </span>
                    </td>
                    <td className="hidden max-w-55 truncate px-3.5 py-3 text-sm text-slate-400 md:table-cell">
                      {court.description || '—'}
                    </td>
                    <td className="px-3.5 py-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => openEdit(court)}
                          className="inline-flex items-center justify-center rounded bg-blue-500/20 px-2.5 py-1 text-xs font-medium text-blue-200 transition hover:bg-blue-500/30 whitespace-nowrap"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(court)}
                          className="inline-flex items-center justify-center rounded bg-rose-500/20 px-2.5 py-1 text-xs font-medium text-rose-200 transition hover:bg-rose-500/30 whitespace-nowrap"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                  {expandedCourtId === court._id && (
                    <tr className="bg-slate-800/30 sm:hidden">
                      <td colSpan={3} className="px-3.5 py-3">
                        <div className="space-y-2 text-xs">
                          <div className="flex justify-between border-b border-white/10 pb-2">
                            <span className="text-slate-400">Surface:</span>
                            <span className="text-white">{formatLabel(court.surfaceType)}</span>
                          </div>
                          <div className="flex justify-between border-b border-white/10 pb-2">
                            <span className="text-slate-400">Location:</span>
                            <span className="text-white">{court.indoor ? 'Indoor' : 'Outdoor'}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">Description:</span>
                            <span className="max-w-[60%] text-right text-white">{court.description || '—'}</span>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex flex-col items-center gap-2">
        <p className="text-xs text-slate-500">
          {filtered.length} court{filtered.length !== 1 ? 's' : ''} {searchTerm ? 'found' : 'total'}
          {totalPages > 1 && ` · page ${currentPage} of ${totalPages}`}
        </p>

        {totalPages > 1 && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
              className="rounded px-2 py-1 text-xs text-slate-400 transition hover:bg-white/10 disabled:opacity-30"
              aria-label="First page"
            >
              «
            </button>
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="rounded px-2 py-1 text-xs text-slate-400 transition hover:bg-white/10 disabled:opacity-30"
              aria-label="Previous page"
            >
              ‹
            </button>

            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter((page) => page === 1 || page === totalPages || Math.abs(page - currentPage) <= 1)
              .reduce((acc, page, idx, arr) => {
                if (idx > 0 && page - arr[idx - 1] > 1) {
                  acc.push('…')
                }
                acc.push(page)
                return acc
              }, [])
              .map((item, idx) =>
                item === '…' ? (
                  <span key={`ellipsis-${idx}`} className="px-1 text-xs text-slate-500">…</span>
                ) : (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setCurrentPage(item)}
                    className={`min-w-7 rounded px-2 py-1 text-xs font-medium transition ${
                      currentPage === item
                        ? 'bg-emerald-500/20 text-emerald-200'
                        : 'text-slate-400 hover:bg-white/10'
                    }`}
                  >
                    {item}
                  </button>
                )
              )}

            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="rounded px-2 py-1 text-xs text-slate-400 transition hover:bg-white/10 disabled:opacity-30"
              aria-label="Next page"
            >
              ›
            </button>
            <button
              type="button"
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages}
              className="rounded px-2 py-1 text-xs text-slate-400 transition hover:bg-white/10 disabled:opacity-30"
              aria-label="Last page"
            >
              »
            </button>
          </div>
        )}
      </div>

      {/* Add / Edit modal */}
      <CourtFormModal
        isOpen={isFormOpen}
        onClose={() => { setIsFormOpen(false); setEditingCourt(null) }}
        court={editingCourt}
        onSubmit={handleFormSubmit}
        isSubmitting={isSubmitting}
        errorMessage={formError}
      />

      {/* Delete confirm modal */}
      <DeleteConfirmModal
        court={deleteTarget}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTarget(null)}
        isDeleting={isDeleting}
      />
    </div>
  )
}

export default CourtsPage
