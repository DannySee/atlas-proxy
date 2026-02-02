// api/bot-status.js
import { MongoClient } from "mongodb";
import { EJSON } from "bson";

let client, ready;

async function getClient() {
  if (!ready) {
    client = new MongoClient(process.env.MONGODB_URI, { maxPoolSize: 5 });
    ready = client.connect();
  }
  await ready;
  return client;
}

/**
 * POST /api/bot-status
 * Auth: x-api-key must match SHORTCUTS_API_KEY
 *
 * Body (supports Extended JSON):
 * {
 *   "database": "your_db",
 *   "collection": "your_collection",
 *   "timestamp": "2026-02-01", // or Extended JSON date
 *   "job_status": "bot running",
 *   "to_create": 0,
 *   "created": 0
 * }
 *
 * Behavior:
 * - Upsert a single "daily" doc keyed by { timestamp }
 * - $set: job_status, to_create, created, timestamp
 * - Also sets updated_at each call; sets created_at on insert only
 */
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (req.headers["x-api-key"] !== process.env.SHORTCUTS_API_KEY) {
    return res.status(401).json({ error: "unauthorized" });
  }

  // Accept Extended JSON anywhere in the body
  const rawBody = req.body ?? {};
  const body = typeof rawBody === "string" ? EJSON.parse(rawBody) : EJSON.deserialize(rawBody);

  const {
    database,
    collection,
    timestamp,
    job_status = "bot running",
    to_create = 0,
    created = 0,
  } = body || {};

  if (!database || !collection) return res.status(400).json({ error: "database & collection required" });
  if (timestamp === undefined || timestamp === null) {
    return res.status(400).json({ error: "timestamp required" });
  }

  try {
    const coll = (await getClient()).db(database).collection(collection);

    const filter = { timestamp };

    const update = {
      $set: {
        job_status,
        timestamp,
        to_create,
        created,
        updated_at: new Date(),
      },
      $setOnInsert: {
        created_at: new Date(),
      },
    };

    const result = await coll.updateOne(filter, update, { upsert: true });

    return res.json({
      ok: true,
      matchedCount: result.matchedCount ?? 0,
      modifiedCount: result.modifiedCount ?? 0,
      upsertedId: result.upsertedId ?? null,
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
