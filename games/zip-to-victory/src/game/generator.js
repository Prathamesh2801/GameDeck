/*
  Random solvable Zip puzzle generation.

  A puzzle is built backwards from its solution: first a random Hamiltonian
  path over the grid (visits every cell exactly once), then numbered
  waypoints placed along it, then walls added only on edges the solution
  does not use — so every generated board is guaranteed solvable.
*/

export const GRID_SIZE = 6
export const NUMBER_COUNT = 8

export const rowOf = (idx, size) => Math.floor(idx / size)
export const colOf = (idx, size) => idx % size

export function areAdjacent(a, b, size) {
  const dr = Math.abs(rowOf(a, size) - rowOf(b, size))
  const dc = Math.abs(colOf(a, size) - colOf(b, size))
  return dr + dc === 1
}

/* Canonical key for the edge between two adjacent cells. */
export const wallKey = (a, b) => (a < b ? `${a}-${b}` : `${b}-${a}`)

function neighbors(idx, size) {
  const r = rowOf(idx, size)
  const c = colOf(idx, size)
  const out = []
  if (r > 0) out.push(idx - size)
  if (r < size - 1) out.push(idx + size)
  if (c > 0) out.push(idx - 1)
  if (c < size - 1) out.push(idx + 1)
  return out
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

/*
  Randomized DFS with backtracking. Neighbors are tried fewest-exits-first
  (Warnsdorff's heuristic, random tie-break), which finds a full path on a
  6×6 grid almost immediately.
*/
function hamiltonianPath(size) {
  const N = size * size

  for (let attempt = 0; attempt < 60; attempt++) {
    const start = Math.floor(Math.random() * N)
    const visited = new Array(N).fill(false)
    const path = [start]
    visited[start] = true

    const options = (cell) => {
      const open = shuffle(neighbors(cell, size).filter((n) => !visited[n]))
      // pop() consumes from the end, so sort most-exits-first to try
      // fewest-exits (dead-end-prone) cells first.
      open.sort(
        (a, b) =>
          neighbors(b, size).filter((n) => !visited[n]).length -
          neighbors(a, size).filter((n) => !visited[n]).length,
      )
      return open
    }

    const choiceStack = [options(start)]
    let steps = 0

    while (path.length > 0 && path.length < N && steps++ < 250000) {
      const opts = choiceStack[choiceStack.length - 1]
      let next = -1
      while (opts.length) {
        const cand = opts.pop()
        if (!visited[cand]) {
          next = cand
          break
        }
      }
      if (next === -1) {
        visited[path.pop()] = false
        choiceStack.pop()
      } else {
        visited[next] = true
        path.push(next)
        choiceStack.push(options(next))
      }
    }

    if (path.length === N) return path
  }
  throw new Error('Failed to generate a Hamiltonian path')
}

/*
  Waypoint indices along the solution: 1 at the start, the last number at the
  end, the rest at jittered even intervals (always strictly increasing).
*/
function numberPositions(pathLength, count) {
  const seg = (pathLength - 1) / (count - 1)
  const positions = [0]
  for (let k = 1; k < count - 1; k++) {
    let pos = Math.round(k * seg + (Math.random() - 0.5) * seg * 0.7)
    pos = Math.max(positions[k - 1] + 1, Math.min(pos, pathLength - 1 - (count - 1 - k)))
    positions.push(pos)
  }
  positions.push(pathLength - 1)
  return positions
}

export function generatePuzzle(size = GRID_SIZE, numberCount = NUMBER_COUNT) {
  const solution = hamiltonianPath(size)

  const numbers = {} // cellIdx -> 1..numberCount
  const numberCells = [] // numberCells[n-1] = cellIdx
  for (const [i, pos] of numberPositions(solution.length, numberCount).entries()) {
    numbers[solution[pos]] = i + 1
    numberCells.push(solution[pos])
  }

  // Walls go only on edges not used by the solution.
  const used = new Set()
  for (let i = 0; i < solution.length - 1; i++) {
    used.add(wallKey(solution[i], solution[i + 1]))
  }
  const candidates = []
  for (let idx = 0; idx < size * size; idx++) {
    for (const n of neighbors(idx, size)) {
      if (n > idx && !used.has(wallKey(idx, n))) candidates.push(wallKey(idx, n))
    }
  }
  const wallCount = 4 + Math.floor(Math.random() * 3)
  const walls = new Set(shuffle(candidates).slice(0, wallCount))

  return {
    id: `${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
    size,
    solution,
    numbers,
    numberCells,
    walls,
  }
}
