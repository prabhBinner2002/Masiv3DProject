const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

async function request(path, options = {}) {
  const { method = 'GET', body, signal } = options
  const opts = { method, signal }
  if (body !== undefined) {
    opts.headers = { 'Content-Type': 'application/json' }
    opts.body = JSON.stringify(body)
  }
  const r = await fetch(`${API_BASE}${path}`, opts)
  let data
  try {
    data = await r.json()
  } catch {
    throw new Error(r.ok ? 'Invalid response' : `Request failed (${r.status})`)
  }
  if (!r.ok) throw new Error(data?.error || `Request failed (${r.status})`)
  return data
}

export async function getBuildings(options = {}) {
  const data = await request('/buildings', { signal: options.signal })
  return {
    count: data.count ?? (data.buildings?.length ?? 0),
    buildings: data.buildings ?? [],
    origin: data.origin ?? null,
    fetched_at_unix: data.fetched_at_unix ?? data.fetchedAt ?? null,
  }
}

export async function postFilter(filters) {
  const data = await request('/filter', {
    method: 'POST',
    body: { filters: filters || [] },
  })
  return data
}

export async function identifyUser(username) {
  const name = typeof username === 'string' ? username.trim() : ''
  if (!name) throw new Error('Username is required')
  try {
    return await request('/users/identify', {
      method: 'POST',
      body: { username: name },
    })
  } catch (err) {
    if (err.message?.includes('fetch') || err.name === 'TypeError') {
      throw new Error('Cannot reach server. Is the backend running?')
    }
    throw err
  }
}

export async function getProjects(userId) {
  const data = await request(`/users/${userId}/projects`)
  return Array.isArray(data.projects) ? data.projects : []
}

export async function saveProject(userId, name, filters) {
  return request(`/users/${userId}/projects`, {
    method: 'POST',
    body: { name: name.trim(), filters: filters || [] },
  })
}

export async function loadProject(projectId) {
  return request(`/projects/${projectId}`)
}

export async function runQuery(query) {
  return request('/query', {
    method: 'POST',
    body: { query: query.trim() },
  })
}
