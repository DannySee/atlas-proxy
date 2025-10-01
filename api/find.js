// api/find.js
import { MongoClient } from "mongodb";

let client;
let clientReady;

/** Get (and cache) a MongoClient across invocations */
async function getClient() {
  if (!clientReady) {
    client = new MongoClient(process.env.MONGODB_URI, { maxPoolSize: 5 });
    clientReady = client.connect();
  }
  await clientReady;
  return client;
}

export default async function handler(request, response) {
  if (request.method !== "POST") return response.status(405).json({ error: "Method not allowed" });

  // Simple shared-secret check so your endpoint isn't public
  if (request.headers["x-api-key"] !== process.env.SHORTCUTS_API_KEY) {
    return response.status(401).json({ error: "unauthorized" });
  }

  // Vercel parses JSON into request.body when Content-Type: application/json is set
  // (it falls back to undefined if no/invalid JSON). :contentReference[oaicite:4]{index=4}
  const { db, collection, filter = {}, options = {} } = request.body || {};
  if (!db || !collection) return response.status(400).json({ error: "db & collection required" });

  try {
    const mongo = await getClient();
    const coll = mongo.db(db).collection(collection);
    const docs = await coll.find(filter, options).toArray();
    return response.json({ documents: docs });
  } catch (err) {
    return response.status(500).json({ error: err.message });
  }
}
