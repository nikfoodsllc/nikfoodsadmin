import jwt from 'jsonwebtoken';

/**
 * Read-only access to the website's Google Analytics 4 property, for the Dashboard's visitor numbers.
 *
 * Needs GA_SERVICE_ACCOUNT_JSON (the read-only service account's key file, as JSON text) on the admin project. GA_PROPERTY_ID is
 * optional (defaults to the NikFoods property). The account only has Viewer access, so nothing here can change Analytics.
 */
const DEFAULT_PROPERTY = '563601036';
const SCOPE = 'https://www.googleapis.com/auth/analytics.readonly';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';

interface ServiceAccount {
  client_email: string;
  private_key: string;
}

function serviceAccount(): ServiceAccount | null {
  const raw = process.env.GA_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<ServiceAccount>;
    if (!parsed.client_email || !parsed.private_key) return null;
    return { client_email: parsed.client_email, private_key: parsed.private_key.replace(/\\n/g, '\n') };
  } catch {
    return null;
  }
}

export function analyticsConfigured(): boolean {
  return serviceAccount() !== null;
}

let cached: { token: string; expiresAt: number } | null = null;

async function accessToken(): Promise<string> {
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;
  const account = serviceAccount();
  if (!account) throw new Error('Google Analytics is not connected');
  const now = Math.floor(Date.now() / 1000);
  const assertion = jwt.sign({ iss: account.client_email, scope: SCOPE, aud: TOKEN_URL, iat: now, exp: now + 3600 }, account.private_key, { algorithm: 'RS256' });
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
    cache: 'no-store',
  });
  const json = (await response.json().catch(() => ({}))) as { access_token?: string; expires_in?: number; error?: string };
  if (!response.ok || !json.access_token) throw new Error(`Google sign-in failed (${json.error ?? response.status})`);
  cached = { token: json.access_token, expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000 };
  return json.access_token;
}

export interface ReportRow {
  dimensions: string[];
  metrics: number[];
}

async function call(method: 'runReport' | 'runRealtimeReport', body: unknown): Promise<ReportRow[]> {
  const property = process.env.GA_PROPERTY_ID || DEFAULT_PROPERTY;
  const response = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${property}:${method}`, {
    method: 'POST',
    headers: { authorization: `Bearer ${await accessToken()}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
    cache: 'no-store',
    signal: AbortSignal.timeout(15_000),
  });
  const json = (await response.json().catch(() => ({}))) as {
    rows?: Array<{ dimensionValues?: Array<{ value?: string }>; metricValues?: Array<{ value?: string }> }>;
    error?: { message?: string };
  };
  if (!response.ok) throw new Error(json.error?.message || `Google Analytics answered ${response.status}`);
  return (json.rows ?? []).map((r) => ({
    dimensions: (r.dimensionValues ?? []).map((d) => d.value ?? ''),
    metrics: (r.metricValues ?? []).map((m) => Number(m.value ?? 0) || 0),
  }));
}

/** People on the website now: in the last 5 minutes and in the last 30 minutes */
export async function activeNow(): Promise<{ last5: number; last30: number }> {
  const [five, thirty] = await Promise.all([
    call('runRealtimeReport', { metrics: [{ name: 'activeUsers' }], minuteRanges: [{ startMinutesAgo: 4, endMinutesAgo: 0 }] }),
    call('runRealtimeReport', { metrics: [{ name: 'activeUsers' }] }),
  ]);
  return { last5: five[0]?.metrics[0] ?? 0, last30: thirty[0]?.metrics[0] ?? 0 };
}

/** Visitors of a period: unique visitors, new visitors and visits, plus the same per day ('YYYYMMDD') */
export async function visitorsFor(from: string, to: string): Promise<{ totals: { visitors: number; newVisitors: number; visits: number }; days: Array<{ day: string; visitors: number; visits: number }> }> {
  const metrics = [{ name: 'totalUsers' }, { name: 'newUsers' }, { name: 'sessions' }];
  const dateRanges = [{ startDate: from, endDate: to }];
  const [totals, days] = await Promise.all([
    call('runReport', { dateRanges, metrics }),
    call('runReport', { dateRanges, metrics: [{ name: 'totalUsers' }, { name: 'sessions' }], dimensions: [{ name: 'date' }], limit: 1000 }),
  ]);
  const t = totals[0]?.metrics ?? [0, 0, 0];
  return {
    totals: { visitors: t[0] ?? 0, newVisitors: t[1] ?? 0, visits: t[2] ?? 0 },
    days: days
      .map((r) => ({ day: `${r.dimensions[0].slice(0, 4)}-${r.dimensions[0].slice(4, 6)}-${r.dimensions[0].slice(6, 8)}`, visitors: r.metrics[0] ?? 0, visits: r.metrics[1] ?? 0 }))
      .sort((a, b) => a.day.localeCompare(b.day)),
  };
}
