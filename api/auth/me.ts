export default async function handler(req: any, res: any) {
  try {
    const { getSessionUser, methodNotAllowed } = await import('./_utils.js')
    if (req.method !== 'GET') return methodNotAllowed(res, 'GET')
    const user = await getSessionUser(req)
    res.setHeader('Cache-Control', 'no-store')
    if (!user) return res.status(401).json({ user: null })
    return res.status(200).json({ user })
  } catch (error: any) {
    return res.status(500).json({ error: 'Unable to verify session', detail: String(error?.message ?? error).slice(0, 200) })
  }
}
