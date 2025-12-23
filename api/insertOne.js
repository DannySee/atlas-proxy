// api/insertOne.js
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

  // Accept Extended JSON anywhere in the body (dates, ObjectId, etc.)
  const rawBody = req.body ?? {};
  const body = typeof rawBody === "string" ? EJSON.parse(rawBody) : EJSON.deserialize(rawBody);

  const { database, collection, document } = body;
  if (!database || !collection) return res.status(400).json({ error: "database & collection required" });
  if (!document) return res.status(400).json({ error: "document required" });

  try {
    const coll = (await getClient()).db(database).collection(collection);
    const result = await coll.insertOne(document);
    res.json({ insertedId: result.insertedId ?? null });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
