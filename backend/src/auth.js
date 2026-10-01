import crypto from 'node:crypto';

// Autenticazione admin singolo — zero dipendenze (solo node:crypto).
// - password: scrypt (sale casuale 16B, N=16384 r=8 p=1, chiave 64B),
//   formato `scrypt$N$r$p$sale_b64$hash_b64`, confronto timing-safe.
// - sessione: token HS256 artigianale `b64url(payload).b64url(hmac)`
//   con payload { u: username, iat, exp } (default 8h). Niente JWT lib
//   per non aggiungere dipendenze; formato documentato qui.
// - account in public.admin_users, condivisa con recupera-test-server
//   (stesso login per i due pannelli admin); nessun login da variabili d'ambiente.

const N = 16384;
const R = 8;
const P = 1;
const KEYLEN = 64;
const SALTLEN = 16;

export function hashPassword(password) {
  const salt = crypto.randomBytes(SALTLEN);
  const key = crypto.scryptSync(String(password), salt, KEYLEN, { N, r: R, p: P });
  return `scrypt$${N}$${R}$${P}$${salt.toString('base64')}$${key.toString('base64')}`;
}

export function verifyPassword(password, stored) {
  try {
    const [tag, n, r, p, saltB64, keyB64] = String(stored).split('$');
    if (tag !== 'scrypt' || !saltB64 || !keyB64) return false;
    const key = crypto.scryptSync(String(password), Buffer.from(saltB64, 'base64'), KEYLEN, {
      N: Number(n), r: Number(r), p: Number(p),
    });
    const expected = Buffer.from(keyB64, 'base64');
    return key.length === expected.length && crypto.timingSafeEqual(key, expected);
  } catch {
    return false;
  }
}

const b64url = (buf) => Buffer.from(buf).toString('base64url');
const unb64url = (s) => Buffer.from(String(s), 'base64url').toString('utf8');

let cachedSecret = null;
export function getTokenSecret() {
  if (cachedSecret) return cachedSecret;
  if (process.env.ADMIN_TOKEN_SECRET) {
    cachedSecret = process.env.ADMIN_TOKEN_SECRET;
  } else {
    cachedSecret = crypto.randomBytes(32).toString('hex');
    console.warn('AVVISO: ADMIN_TOKEN_SECRET assente — segreto effimero, le sessioni scadono al riavvio.');
  }
  return cachedSecret;
}

export function signToken(username, ttlSeconds = 8 * 3600) {
  const payload = { u: username, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + ttlSeconds };
  const body = b64url(JSON.stringify(payload));
  const sig = crypto.createHmac('sha256', getTokenSecret()).update(body).digest('base64url');
  return `${body}.${sig}`;
}

export function verifyToken(token) {
  try {
    const [body, sig] = String(token).split('.');
    if (!body || !sig) return null;
    const expected = crypto.createHmac('sha256', getTokenSecret()).update(body).digest();
    const actual = Buffer.from(sig, 'base64url');
    if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) return null;
    const payload = JSON.parse(unb64url(body));
    if (!payload.u || payload.exp * 1000 < Date.now()) return null;
    return { username: payload.u };
  } catch {
    return null;
  }
}

// Middleware: protegge le rotte admin (es. POST /admin/import).
// Risponde 401 con shape { error: { code, message } } di contratto.
export function requireAdmin(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  const admin = token ? verifyToken(token) : null;
  if (!admin) {
    return res.status(401).json({ error: { code: 'unauthorized', message: 'Accesso riservato: effettua l’accesso come amministratore.' } });
  }
  req.admin = admin;
  next();
}

// Throttle login anti brute-force: 10 tentativi / 5 min per IP (in-memory).
const attempts = new Map();
export function loginThrottle(req, res, next) {
  const ip = req.ip || req.socket?.remoteAddress || 'sconosciuto';
  const now = Date.now();
  const entry = attempts.get(ip) || { count: 0, resetAt: now + 5 * 60 * 1000 };
  if (now > entry.resetAt) {
    entry.count = 0;
    entry.resetAt = now + 5 * 60 * 1000;
  }
  entry.count += 1;
  attempts.set(ip, entry);
  if (entry.count > 10) {
    return res.status(429).json({ error: { code: 'rate_limited', message: 'Troppi tentativi di accesso — riprova tra qualche minuto.' } });
  }
  next();
}
