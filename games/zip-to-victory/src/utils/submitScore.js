import { APP_CONFIG } from '../data/appConfig.js'
import { getToken } from './token.js'

// DEV_MODE: log only, no network. Production: POST to gamescore.php; resolve only
// when the API returns Status: true.
export async function submitScore({ score }) {
  const token = getToken()
  const payload = { Game_SR_No: APP_CONFIG.GAME_SR_NO, Score: score, token }

  if (APP_CONFIG.DEV_MODE) {
    console.log('[DEV_MODE] submitScore skipped. Would POST:', payload)
    return { Status: true, dev: true }
  }

  const form = new FormData()
  form.append('Game_SR_No', String(APP_CONFIG.GAME_SR_NO))
  form.append('Score', String(score))
  form.append('token', token ?? '')

  const response = await fetch(`${APP_CONFIG.API_BASE_URL}/gamescore.php`, {
    method: 'POST',
    body: form,
  })

  let data
  try {
    data = await response.json()
  } catch {
    throw new Error(`Unexpected response (HTTP ${response.status}).`)
  }
  if (!response.ok || !data?.Status) {
    throw new Error(data?.Message || `Score submission failed (HTTP ${response.status}).`)
  }
  return data
}
