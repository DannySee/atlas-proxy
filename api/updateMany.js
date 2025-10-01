// api/updateMany.js
import { MongoClient } from "mongodb";

let client;
let ready;

async function getClient() {
  if (!ready) {
    client = new MongoClient(process.env.MONGODB_URI, { maxPoolSize: 5 });
    ready = client.connect();
  }
  await ready;
  return client;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  if (req.headers["x-api-key"] !== process.env.SHORTCUTS_API_KEY) {
    return res.status(401).json({ error: "unauthorized" });
  }

  // Body format mirrors the old Data API (minus dataSource)
  // {
  //   "database": "automation",
  //   "collection": "alaska_bot",
  //   "filter": { ... },
  //   "update": { "$set": { ... } },
  //   "upsert": false   // optional (default false)
  // }
  const { database, collection, filter = {}, update, upsert = false } = req.body || {};

  if (!database || !collection) return res.status(400).json({ error: "database & collection required" });
  if (!update || typeof update !== "object") return res.status(400).json({ error: "update object required" });

  try {
    const mongo = await getClient();
    const coll = mongo.db(database).collection(collection);

    const result = await coll.updateMany(filter, update, { upsert });

    // Return a response shape similar to Mongo’s Data API
    return res.json({
      matchedCount: result.matchedCount ?? 0,
      modifiedCount: result.modifiedCount ?? 0,
      upsertedId: result.upsertedId ?? null
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
