// api/findOne.js
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

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (req.headers["x-api-key"] !== process.env.SHORTCUTS_API_KEY) {
    return res.status(401).json({ error: "unauthorized" });
  }

  // Extended JSON support
  const rawBody = req.body ?? {};
  const body = typeof rawBody === "string" ? EJSON.parse(rawBody) : EJSON.deserialize(rawBody);

  const { database, collection, filter = {}, projection = null, sort = null } = body || {};
  if (!database || !collection) return res.status(400).json({ error: "database & collection required" });

  try {
    const coll = (await getClient()).db(database).collection(collection);

    let cursor = coll.find(filter, projection ? { projection } : undefined);
    if (sort) cursor = cursor.sort(sort);
    const doc = await cursor.limit(1).next();

    // Return as Extended JSON so ObjectIds/Dates are safe
    return res.json({ document: doc ? EJSON.serialize(doc) : null });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
