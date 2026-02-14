function formatCoord(value) {
  if (value == null || Number.isNaN(Number(value))) return null
  return Number(value).toFixed(6)
}

export function BuildingDetailCard({ building }) {
  if (!building) {
    return (
      <div className="absolute bottom-4 left-4 right-4 sm:right-auto sm:w-80 bg-slate-800/95 border border-slate-600 rounded-lg shadow-xl p-4 text-slate-200">
        <h3 className="text-sm font-semibold text-slate-100">Building Details</h3>
        <p className="text-sm text-slate-400 mt-1">Select a building to inspect attributes.</p>
      </div>
    )
  }

  const latStr = formatCoord(building.centroid?.lat)
  const lngStr = formatCoord(building.centroid?.lng)

  return (
    <div className="absolute bottom-4 left-4 right-4 sm:right-auto sm:w-96 bg-slate-800/95 border border-slate-600 rounded-lg shadow-xl p-4 text-slate-200">
      <h3 className="text-sm font-semibold text-slate-100 break-words">{building.address}</h3>
      {building.community && (
        <p className="text-xs text-slate-400 mt-0.5">{building.community}</p>
      )}
      <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
        {latStr != null && (
          <>
            <dt className="text-slate-400">Latitude</dt>
            <dd className="font-mono text-xs break-all">{latStr}</dd>
          </>
        )}
        {lngStr != null && (
          <>
            <dt className="text-slate-400">Longitude</dt>
            <dd className="font-mono text-xs break-all">{lngStr}</dd>
          </>
        )}
        <dt className="text-slate-400">Height</dt>
        <dd>
          {building.height_m != null && !Number.isNaN(Number(building.height_m))
            ? `${Number(building.height_m).toFixed(1)} m`
            : '—'}
        </dd>
        <dt className="text-slate-400">Zoning</dt>
        <dd>{building.zoning ?? '—'}</dd>
      </dl>
    </div>
  )
}
