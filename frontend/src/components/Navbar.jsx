export function Navbar({
  user,
  usernameInput,
  onUsernameChange,
  onIdentify,
  query,
  onQueryChange,
  onRunQuery,
  canResetView = false,
  onResetView,
  projectNameInput,
  onProjectNameChange,
  onSaveProject,
  onOpenProjects,
  projects = [],
  loading,
  message,
}) {
  return (
    <nav className="flex-shrink-0 px-3 sm:px-4 py-3 bg-slate-800 border-b border-slate-700">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
        <h1 className="text-base sm:text-lg font-semibold text-slate-100 shrink-0">
          Urban Design 3D
        </h1>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-2 min-w-0">
          <input
            type="text"
            placeholder="e.g. buildings over 100 feet"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onRunQuery?.()}
            disabled={loading}
            aria-label="Query"
            className="min-w-0 flex-1 sm:w-48 px-3 py-2.5 sm:py-2 text-sm bg-slate-700 border border-slate-600 rounded text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
          <button
            type="button"
            onClick={() => onRunQuery?.()}
            disabled={loading}
            className="w-full sm:w-auto px-4 py-2.5 sm:py-2 text-sm font-medium bg-indigo-600 hover:bg-indigo-500 text-white rounded disabled:opacity-50 min-h-[44px] sm:min-h-0"
          >
            {loading ? '...' : 'Query'}
          </button>
          {onResetView && (
            <button
              type="button"
              onClick={() => onResetView?.()}
              disabled={!canResetView || loading}
              className="w-full sm:w-auto px-4 py-2.5 sm:py-2 text-sm font-medium bg-slate-700 hover:bg-slate-600 text-slate-100 rounded disabled:opacity-40 min-h-[44px] sm:min-h-0"
            >
              Reset view
            </button>
          )}
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-2 min-w-0">
          {user ? (
            <span className="text-sm text-slate-300 py-2 sm:py-0">Signed in as {user.username}</span>
          ) : (
            <>
              <input
                type="text"
                placeholder="Username"
                value={usernameInput}
                onChange={(e) => onUsernameChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    onIdentify?.()
                  }
                }}
                disabled={loading}
                aria-label="Username"
                autoComplete="username"
                className="min-w-0 flex-1 sm:w-40 px-3 py-2.5 sm:py-2 text-sm bg-slate-700 border border-slate-600 rounded text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
              <button
                type="button"
                onClick={() => onIdentify?.()}
                disabled={loading}
                className="w-full sm:w-auto px-4 py-2.5 sm:py-2 text-sm font-medium bg-slate-600 hover:bg-slate-500 text-white rounded disabled:opacity-50 min-h-[44px] sm:min-h-0"
              >
                Identify
              </button>
            </>
          )}
        </div>

        {user && (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-2 min-w-0">
            <input
              type="text"
              placeholder="Project name"
              value={projectNameInput}
              onChange={(e) => onProjectNameChange(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && onSaveProject?.()}
              disabled={loading}
              aria-label="Project name"
              className="min-w-0 flex-1 sm:w-36 px-3 py-2.5 sm:py-2 text-sm bg-slate-700 border border-slate-600 rounded text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
            <button
              type="button"
              onClick={() => onSaveProject?.()}
              disabled={loading}
              className="w-full sm:w-auto px-4 py-2.5 sm:py-2 text-sm bg-slate-600 hover:bg-slate-500 text-slate-100 rounded disabled:opacity-50 min-h-[44px] sm:min-h-0"
            >
              Save project
            </button>
          </div>
        )}

        <button
          type="button"
          onClick={() => onOpenProjects?.()}
          className="w-full sm:w-auto px-4 py-2.5 sm:py-2 text-sm bg-slate-600 hover:bg-slate-500 text-slate-100 rounded min-h-[44px] sm:min-h-0"
        >
          Projects {projects.length ? `(${projects.length})` : ''}
        </button>
      </div>

      {message && (
        <p className="mt-2 text-sm text-slate-400" role="status">
          {message}
        </p>
      )}
    </nav>
  )
}
