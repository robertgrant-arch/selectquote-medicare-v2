import type { VercelRequest, VercelResponse } from "@vercel/node";

const CMS_ZIP_API =
  "https://marketplace.api.healthcare.gov/api/v1/counties/by/zip";
const CMS_API_KEY = process.env.CMS_MARKETPLACE_API_KEY ?? "";

function toTitleCase(str: string): string {
  return str
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\bOf\b/g, "of")
    .replace(/\bThe\b/g, "the");
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const zip = (
    typeof req.query.zip === "string" ? req.query.zip : ""
  ).trim();

  if (!zip || !/^\d{5}$/.test(zip)) {
    return res
      .status(400)
      .json({ valid: false, error: "INVALID_FORMAT", counties: [] });
  }

  try {
    const upstream = await fetch(`${CMS_ZIP_API}/${zip}?apikey=${CMS_API_KEY}`, {
      signal: AbortSignal.timeout(8000),
    });

    if (!upstream.ok) {
      const status = upstream.status === 404 ? 404 : 502;
      const error = upstream.status === 404 ? "NOT_FOUND" : "SERVER_ERROR";
      return res.status(status).json({ valid: false, error, counties: [] });
    }

    const data = (await upstream.json()) as {
      counties?: Array<{ state: string; name: string; fips?: string }>;
    };
    const raw = data.counties ?? [];

    if (raw.length === 0) {
      return res
        .status(404)
        .json({ valid: false, error: "NOT_FOUND", counties: [] });
    }

    const counties = raw.map((c) => ({
      name: toTitleCase(c.name) + " County",
      state: c.state.toUpperCase(),
      fips: c.fips,
    }));

    return res.json({ valid: true, counties });
  } catch (err) {
    console.error(`[validate-zip] Error for ZIP ${zip}:`, err);
    return res
      .status(503)
      .json({ valid: false, error: "SERVER_ERROR", counties: [] });
  }
}
