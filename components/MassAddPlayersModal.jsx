'use client';

import React, { useState } from 'react'

const MassAddPlayersModal = ({
  isOpen,
  onClose,
  onSuccess,
  onPlayersUpdated,
  matchExistingOnly = false,
  existingPlayers = [],
  archivedPlayers = [],
}) => {
  const [activeTab, setActiveTab] = useState('paste') // 'paste' or 'upload'
  const [textarea, setTextarea] = useState('')
  const [uploadFile, setUploadFile] = useState(null)
  const [successMessage, setSuccessMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (!isOpen) return null

  const normalizePlayerName = (line) =>
    line
      .replace(/^\s*(?:\d+\s*[.)\-:]\s*|[-*•]+\s*)/, '')
      .trim()

  const parsePlayerNames = (rawText) =>
    rawText
      .split('\n')
      .map((line) => normalizePlayerName(line))
      .filter((line) => line.length > 0)

  const getUniqueNames = (names) => {
    const seen = new Set()
    return names.filter((name) => {
      const key = name.toLowerCase()
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }

  const createExistingPlayersMatchResult = (names) => {
    const uniqueNames = getUniqueNames(names).map((name) => name.trim())
    const existingMap = new Map(
      existingPlayers
        .filter((player) => player?.name)
        .map((player) => [player.name.trim().toLowerCase(), player])
    )
    const archivedMap = new Map(
      archivedPlayers
        .filter((player) => player?.name)
        .map((player) => [player.name.trim().toLowerCase(), player])
    )

    const matchedPlayers = []
    const archivedMatches = []
    const unmatchedNames = []

    uniqueNames.forEach((name) => {
      const normalizedName = name.toLowerCase()
      const activePlayer = existingMap.get(normalizedName)
      if (activePlayer) {
        matchedPlayers.push(activePlayer)
        return
      }

      const archivedPlayer = archivedMap.get(normalizedName)
      if (archivedPlayer) {
        archivedMatches.push({
          ...archivedPlayer,
          requestedName: name,
        })
        return
      }

      unmatchedNames.push(name)
    })

    return {
      ok: true,
      mode: 'match-existing',
      matchedPlayerIds: matchedPlayers.map((player) => player._id),
      matchedNames: matchedPlayers.map((player) => player.name),
      archivedMatches,
      unmatchedNames,
      requestedNames: uniqueNames,
    }
  }

  const detectPlayerCount = () => {
    if (activeTab === 'paste') {
      return parsePlayerNames(textarea).length
    }
    return 0
  }

  const handlePasteSubmit = async (e) => {
    e.preventDefault()
    setErrorMessage('')
    setSuccessMessage('')

    const playerNames = parsePlayerNames(textarea)

    if (playerNames.length === 0) {
      setErrorMessage('Please enter at least one player name')
      return
    }

    if (matchExistingOnly) {
      const data = createExistingPlayersMatchResult(playerNames)
      const callback = onSuccess || onPlayersUpdated
      if (callback) {
        callback(data)
      }
      handleClose()
      return
    }

    setIsSubmitting(true)
    try {
      // Get backend URL from environment or use default
      const _backendHost = typeof window !== 'undefined' ? `${window.location.protocol}//${window.location.hostname}` : 'http://localhost'
      const backendUrl = process.env.NEXT_PUBLIC_GRAPHQL_URL || `${_backendHost}:${process.env.NEXT_PUBLIC_BACKEND_PORT || '4000'}/graphql`
      const apiUrl = backendUrl.replace('/graphql', '/api/players/bulk')

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ players: playerNames }),
      })

      // Check if response has content before parsing
      const contentType = response.headers.get('content-type')
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Server returned invalid response. Please check if the backend is running.')
      }

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || `Server error: ${response.status}`)
      }

      if (data.ok) {
        setSuccessMessage(
          `✓ ${data.added} player(s) added successfully${data.skipped > 0 ? `. ${data.skipped} duplicate(s) skipped.` : '.'}`
        )
        setTextarea('')

        // Trigger whichever callback the parent provided.
        const callback = onSuccess || onPlayersUpdated
        if (callback) {
          callback(data)
          handleClose()
        }
      } else {
        setErrorMessage(data.message || 'Failed to add players')
      }
    } catch (error) {
      console.error('Bulk add error:', error)
      setErrorMessage(error.message || 'An error occurred while adding players')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleFileSubmit = async (e) => {
    e.preventDefault()
    setErrorMessage('')
    setSuccessMessage('')

    if (!uploadFile) {
      setErrorMessage('Please select a file')
      return
    }

    if (matchExistingOnly) {
      try {
        const fileText = await uploadFile.text()
        const playerNames = parsePlayerNames(fileText)

        if (playerNames.length === 0) {
          setErrorMessage('No valid player names found in file')
          return
        }

        const data = createExistingPlayersMatchResult(playerNames)
        const callback = onSuccess || onPlayersUpdated
        if (callback) {
          callback(data)
        }
        handleClose()
        return
      } catch (error) {
        setErrorMessage(error.message || 'Failed to read file')
        return
      }
    }

    setIsSubmitting(true)
    try {
      const formData = new FormData()
      formData.append('file', uploadFile)

      // Get backend URL from environment or use default
      const _backendHost2 = typeof window !== 'undefined' ? `${window.location.protocol}//${window.location.hostname}` : 'http://localhost'
      const backendUrl = process.env.NEXT_PUBLIC_GRAPHQL_URL || `${_backendHost2}:${process.env.NEXT_PUBLIC_BACKEND_PORT || '4000'}/graphql`
      const uploadUrl = backendUrl.replace('/graphql', '/api/players/upload')

      const response = await fetch(uploadUrl, {
        method: 'POST',
        body: formData,
      })

      // Check if response has content before parsing
      const contentType = response.headers.get('content-type')
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Server returned invalid response. Please check if the backend is running.')
      }

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || `Server error: ${response.status}`)
      }

      if (data.ok) {
        setSuccessMessage(
          `✓ ${data.added} player(s) added successfully${data.skipped > 0 ? `. ${data.skipped} duplicate(s) skipped.` : '.'}`
        )
        setUploadFile(null)

        // Reset file input
        const fileInput = document.getElementById('file-input')
        if (fileInput) fileInput.value = ''

        // Trigger whichever callback the parent provided.
        const callback = onSuccess || onPlayersUpdated
        if (callback) {
          callback(data)
          handleClose()
        }
      } else {
        setErrorMessage(data.message || 'Failed to add players')
      }
    } catch (error) {
      console.error('File upload error:', error)
      setErrorMessage(error.message || 'An error occurred while uploading file')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleClose = () => {
    setTextarea('')
    setUploadFile(null)
    setSuccessMessage('')
    setErrorMessage('')
    onClose()
  }

  const playerCount = detectPlayerCount()

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-lg border border-white/10 bg-slate-900 p-6">
        <h3 className="mb-4 text-xl font-semibold text-white">Batch Add Players</h3>

        {/* Tabs */}
        <div className="mb-6 flex gap-2 border-b border-white/10">
          <button
            onClick={() => {
              setActiveTab('paste')
              setErrorMessage('')
              setSuccessMessage('')
            }}
            className={`pb-3 px-4 font-semibold transition ${
              activeTab === 'paste'
                ? 'border-b-2 border-emerald-500 text-emerald-200'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            Paste Names
          </button>
          <button
            onClick={() => {
              setActiveTab('upload')
              setErrorMessage('')
              setSuccessMessage('')
            }}
            className={`pb-3 px-4 font-semibold transition ${
              activeTab === 'upload'
                ? 'border-b-2 border-emerald-500 text-emerald-200'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            Upload File
          </button>
        </div>

        {/* Error Message */}
        {errorMessage && (
          <div className="mb-4 rounded-lg bg-red-500/20 border border-red-500/30 p-3 text-sm text-red-200">
            {errorMessage}
          </div>
        )}

        {/* Success Message */}
        {successMessage && (
          <div className="mb-4 rounded-lg bg-emerald-500/20 border border-emerald-500/30 p-3 text-sm text-emerald-200">
            {successMessage}
          </div>
        )}

        {/* Paste Tab */}
        {activeTab === 'paste' && (
          <form onSubmit={handlePasteSubmit} className="space-y-4">
            <div>
              <label htmlFor="mass-player-input" className="block text-sm font-medium text-slate-200 mb-2">
                Player Names
                {playerCount > 0 && (
                  <span className="ml-2 text-emerald-400">
                    (Detected: {playerCount})
                  </span>
                )}
              </label>
              <textarea
                id="mass-player-input"
                name="playerNamesText"
                value={textarea}
                onChange={(e) => setTextarea(e.target.value)}
                placeholder={'Paste player names\nOne per line\n\nExample:\nJohn Smith\nMark Johnson\nLuke Wilson'}
                className="w-full h-40 rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-white placeholder-slate-500 focus:border-white/30 focus:outline-none resize-none"
                disabled={isSubmitting}
              />
              <p className="mt-2 text-xs text-slate-400">
                Empty lines will be ignored. Names will be trimmed.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={isSubmitting || playerCount === 0}
                className="flex-1 rounded-lg bg-emerald-500/20 px-4 py-2 text-sm font-semibold text-emerald-200 transition hover:bg-emerald-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Adding...' : `Add ${playerCount} Player${playerCount !== 1 ? 's' : ''}`}
              </button>
              <button
                type="button"
                onClick={handleClose}
                disabled={isSubmitting}
                className="flex-1 rounded-lg bg-slate-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-600 disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {/* Upload Tab */}
        {activeTab === 'upload' && (
          <form onSubmit={handleFileSubmit} className="space-y-4">
            <div>
              <label htmlFor="file-input" className="block text-sm font-medium text-slate-200 mb-2">
                Select .txt File
              </label>
              <input
                id="file-input"
                name="playersFile"
                type="file"
                accept=".txt"
                onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-white file:rounded file:border-0 file:bg-emerald-500/20 file:px-3 file:py-1 file:text-emerald-200 focus:border-white/30 focus:outline-none"
                disabled={isSubmitting}
              />
              {uploadFile && (
                <p className="mt-2 text-sm text-emerald-200">
                  ✓ Selected: {uploadFile.name}
                </p>
              )}
              <p className="mt-2 text-xs text-slate-400">
                Upload a .txt file with one player name per line.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={isSubmitting || !uploadFile}
                className="flex-1 rounded-lg bg-emerald-500/20 px-4 py-2 text-sm font-semibold text-emerald-200 transition hover:bg-emerald-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Uploading...' : 'Upload Players'}
              </button>
              <button
                type="button"
                onClick={handleClose}
                disabled={isSubmitting}
                className="flex-1 rounded-lg bg-slate-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-600 disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

export default MassAddPlayersModal
