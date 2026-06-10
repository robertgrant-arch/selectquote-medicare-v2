import type { VercelRequest, VercelResponse } from '@vercel/node';

const CMS_ZIP_API = 'https://marketplace.api.healthcare.gov/api/v1/counties/by/zip';
const CMS_API_KEY = process.env.CMS_MARKETPLACE_API_KEY ?? '';

export default async function handler(req: VercelRequest, res: VercelResponse) {
const allowedOrigins = ['https://medicare-quote-app.vercel.app', 'http://localhost:5173'];
const origin = req.headers.origin || '';
res.setHeader('Access-Control-Allow-Origin', allowedOrigins.includes(origin) ? origin : allowedOrigins[0]);
res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
if (req.method === 'OPTIONS') return res.status(200).end();

const zip = (typeof req.query.zip === 'string' ? req.query.zip : '').trim();
if (!zip || !/^\d{5}$/.test(zip)) {
return res.status(400).json({ valid: false, error: 'INVALID_FORMAT' });
}

try {
const cmsRes = await fetch(`${CMS_ZIP_API}/${zip}?apikey=${CMS_API_KEY}`, {
signal: AbortSignal.timeout(8000),
});
if (!cmsRes.ok) {
return res.status(502).json({ valid: false, error: 'SERVER_ERROR' });
}
const data = await cmsRes.json() as any;
const counties = data.counties;
if (!counties || counties.length === 0) {
return res.status(404).json({ valid: false, error: 'NOT_FOUND' });
}
return res.status(200).json({
valid: true,
counties: counties.map((c: any) => ({ name: c.name, state: c.state, fips: c.fips })),
});
} catch {
return res.status(502).json({ valid: false, error: 'SERVER_ERROR' });
}
}
