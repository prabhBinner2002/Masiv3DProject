import { useState, useEffect, useCallback } from 'react'
import * as api from './lib/api'
import { Navbar } from './components/Navbar'
import { MapCanvas } from './components/MapCanvas'
import { BuildingDetailCard } from './components/BuildingDetailCard'

function getErrorMessage(err, fallback) {
  if (err?.message && typeof err.message === 'string') return err.message
  return fallback ?? 'Something went wrong'
}

export default function App() {
  const [user, setUser] = useState(null)
  const [usernameInput, setUsernameInput] = useState('')
  const [query, setQuery] = useState('')
  const [projectNameInput, setProjectNameInput] = useState('')
  const [projects, setProjects] = useState([])
  const [projectsOpen, setProjectsOpen] = useState(false)
  const [activeFilters, setActiveFilters] = useState([])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [allBuildings, setAllBuildings] = useState([])
  const [visibleBuildings, setVisibleBuildings] = useState([])
  const [mapMeta, setMapMeta] = useState({ count: 0, fetchedAt: null, origin: null })
  const [mapLoading, setMapLoading] = useState(true)
  const [mapError, setMapError] = useState('')
  const [selectedBuilding, setSelectedBuilding] = useState(null)

  const applyBuildingPayload = useCallback((payload, options = {}) => {
    const list = Array.isArray(payload?.buildings) ? payload.buildings : []
    setVisibleBuildings(list)
    setMapMeta((prev) => ({
      count: payload?.count ?? list.length,
      origin: payload?.origin || prev.origin,
      fetchedAt: payload?.fetched_at_unix ?? prev.fetchedAt,
    }))
    if (options.asBase) {
      setAllBuildings(list)
    }
    if (!options.keepSelection) {
      setSelectedBuilding(null)
    }
  }, [])

  useEffect(() => {
    let ignore = false
    const controller = new AbortController()
    async function loadBuildings() {
      setMapLoading(true)
      setMapError('')
      try {
        const payload = await api.getBuildings({ signal: controller.signal })
        if (ignore) return
        applyBuildingPayload(payload, { asBase: true })
        setMessage((msg) => msg || `Loaded ${payload.count ?? payload.buildings?.length ?? 0} downtown buildings`)
      } catch (err) {
        if (ignore) return
        if (err?.name === 'AbortError') return
        const errMsg = getErrorMessage(err, 'Failed to load building footprints')
        setMapError(errMsg)
        setMessage(errMsg)
      } finally {
        if (ignore) return
        setMapLoading(false)
      }
    }
    loadBuildings()
    return () => {
      ignore = true
      controller.abort()
    }
  }, [applyBuildingPayload])

  const fetchProjects = useCallback(async () => {
    if (!user?.id) return
    try {
      const list = await api.getProjects(user.id)
      setProjects(list)
    } catch {
      setProjects([])
    }
  }, [user?.id])

  useEffect(() => {
    if (user?.id) fetchProjects()
  }, [user?.id, fetchProjects])

  const handleIdentify = async () => {
    const name = usernameInput.trim()
    if (!name) {
      setMessage('Enter a username')
      return
    }
    setLoading(true)
    setMessage('')
    try {
      const u = await api.identifyUser(name)
      setUser(u)
      setUsernameInput('')
      setMessage(`Signed in as ${u.username}`)
    } catch (e) {
      setMessage(getErrorMessage(e, 'Identify failed'))
    } finally {
      setLoading(false)
    }
  }

  const handleRunQuery = async () => {
    const q = query.trim()
    if (!q) {
      setMessage('Enter a query')
      return
    }
    setLoading(true)
    setMessage('')
    try {
      const res = await api.runQuery(q)
      setActiveFilters(res.filters || [])
      applyBuildingPayload(res)
      const count = res.count ?? res.buildings?.length ?? 0
      setMessage(
        res.filters?.length
          ? `${count} building${count === 1 ? '' : 's'} match`
          : `No filters extracted; showing ${count} buildings`,
      )
    } catch (e) {
      setMessage(getErrorMessage(e, 'Query failed'))
    } finally {
      setLoading(false)
    }
  }

  const handleSaveProject = async () => {
    const name = projectNameInput.trim()
    if (!name) {
      setMessage('Enter a project name')
      return
    }
    if (!user?.id) {
      setMessage('Identify yourself first')
      return
    }
    setLoading(true)
    setMessage('')
    try {
      await api.saveProject(user.id, name, activeFilters)
      setProjectNameInput('')
      setMessage(`Saved "${name}"`)
      fetchProjects()
    } catch (e) {
      setMessage(getErrorMessage(e, 'Save failed'))
    } finally {
      setLoading(false)
    }
  }

  const handleLoadProject = async (projectId) => {
    setLoading(true)
    setMessage('')
    try {
      const p = await api.loadProject(projectId)
      const filters = Array.isArray(p.filters) ? p.filters : []
      setActiveFilters(filters)

      let payload
      let refreshBase = false
      if (filters.length) {
        payload = await api.postFilter(filters)
      } else if (allBuildings.length) {
        payload = {
          buildings: allBuildings,
          count: allBuildings.length,
          origin: mapMeta.origin,
          fetched_at_unix: mapMeta.fetchedAt,
        }
      } else {
        payload = await api.getBuildings()
        refreshBase = true
      }

      applyBuildingPayload(payload, { asBase: refreshBase })
      const count = filters.length
        ? payload.count ?? payload.buildings?.length ?? 0
        : allBuildings.length || payload.buildings?.length || 0
      const suffix = filters.length ? ` (${count} match${count === 1 ? '' : 'es'})` : ''
      setMessage(`Loaded "${p.name}"${suffix}`)
      setProjectsOpen(false)
    } catch (e) {
      setMessage(getErrorMessage(e, 'Load failed'))
    } finally {
      setLoading(false)
    }
  }

  const handleResetView = () => {
    if (!allBuildings.length) return
    setActiveFilters([])
    applyBuildingPayload(
      {
        buildings: allBuildings,
        count: allBuildings.length,
        origin: mapMeta.origin,
        fetched_at_unix: mapMeta.fetchedAt,
      },
      { keepSelection: false },
    )
    setMessage('Showing all downtown buildings')
  }

  const canResetView =
    !!allBuildings.length &&
    (activeFilters.length > 0 || visibleBuildings.length !== allBuildings.length)

  const fetchedAtLabel =
    mapMeta.fetchedAt != null
      ? new Date(mapMeta.fetchedAt * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : ''

  return (
    <div className="flex flex-col h-screen w-full bg-slate-900 text-slate-100">
      <Navbar
        user={user}
        usernameInput={usernameInput}
        onUsernameChange={setUsernameInput}
        onIdentify={handleIdentify}
        query={query}
        onQueryChange={setQuery}
        onRunQuery={handleRunQuery}
        projectNameInput={projectNameInput}
        onProjectNameChange={setProjectNameInput}
        onSaveProject={handleSaveProject}
        onOpenProjects={() => setProjectsOpen(!projectsOpen)}
        projects={projects}
        loading={loading}
        message={message}
        canResetView={canResetView}
        onResetView={handleResetView}
      />
      <main className="flex-1 min-h-0 relative bg-slate-900">
        {projectsOpen && projects.length > 0 && (
          <div className="absolute top-2 right-2 z-20 w-64 max-h-60 overflow-y-auto bg-slate-800/95 border border-slate-600 rounded-lg shadow-xl p-2">
            <p className="text-xs text-slate-400 mb-2">Saved projects - click to load</p>
            <ul className="space-y-1">
              {projects.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => handleLoadProject(p.id)}
                    disabled={loading}
                    className="w-full text-left px-2 py-1.5 text-sm text-slate-200 hover:bg-slate-700 rounded"
                  >
                    {p.name}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="absolute inset-0">
          <MapCanvas
            buildings={visibleBuildings}
            selectedBuildingId={selectedBuilding?.id}
            onSelectBuilding={setSelectedBuilding}
            onBackgroundClick={() => setSelectedBuilding(null)}
          />
        </div>

        <div className="pointer-events-none absolute top-4 left-4 z-10 flex flex-col gap-2">
          <div className="pointer-events-auto bg-slate-900/85 border border-slate-700 rounded-lg px-4 py-3 shadow-lg">
            <p className="text-xs uppercase tracking-wide text-slate-400">Buildings</p>
            <p className="text-2xl font-semibold text-white">
              {visibleBuildings.length.toLocaleString('en-CA')}
            </p>
            {fetchedAtLabel && (
              <p className="text-[11px] text-slate-400 mt-0.5">Updated {fetchedAtLabel}</p>
            )}
          </div>
          {activeFilters.length > 0 && (
            <div className="pointer-events-auto bg-slate-900/85 border border-slate-700 rounded-lg px-4 py-3 shadow-lg max-w-xs">
              <p className="text-xs uppercase tracking-wide text-slate-400 mb-1">Active filters</p>
              <div className="flex flex-wrap gap-1">
                {activeFilters.map((f, idx) => (
                  <span
                    key={`${f.attribute ?? 'attr'}-${idx}`}
                    className="text-xs px-2 py-0.5 rounded-full bg-slate-800/80 border border-slate-600 text-slate-200"
                  >
                    {(f.attribute ?? 'attribute').toString()} {f.operator ?? '='}{' '}
                    {typeof f.value === 'number' ? f.value : (f.value ?? '').toString()}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {mapLoading && (
          <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
            <div className="bg-slate-900/80 border border-slate-700 px-6 py-3 rounded-lg text-sm text-slate-200 shadow-2xl">
              Loading downtown footprints...
            </div>
          </div>
        )}

        {mapError && !mapLoading && (
          <div className="absolute inset-0 flex items-start justify-center pt-16 z-10 pointer-events-none">
            <div className="pointer-events-auto bg-rose-950/80 border border-rose-500 px-4 py-3 rounded text-sm text-rose-100 shadow-xl">
              {mapError}
            </div>
          </div>
        )}

        <BuildingDetailCard building={selectedBuilding} />
      </main>
    </div>
  )
}
