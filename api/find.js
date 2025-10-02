// api/find.js
import { MongoClient } from "mongodb";
import { EJSON } from "bson";  // ⬅️ enables {"$date": "..."} parsing

let client, ready;
async function getClient() {
  if (!ready) {
    client = new MongoClient(process.env.MONGODB_URI, { maxPoolSize: 5 });
    ready = client.connect();
  }
  await ready;
  return client;
}

function coerceSort(sort) {
  if (!sort || typeof sort !== "object") return undefined;
  const out = {};
  for (const [k, v] of Object.entries(sort)) out[k] = (v === -1 || v === "-1") ? -1 : 1;
  return out;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (req.headers["x-api-key"] !== process.env.SHORTCUTS_API_KEY) return res.status(401).json({ error: "unauthorized" });

  // IMPORTANT: Deserialize Extended JSON to real types (Date, ObjectId, etc.)
  // Works whether req.body is a string or an already-parsed object.
  const rawBody = req.body ?? {};
  const body = typeof rawBody === "string" ? EJSON.parse(rawBody) : EJSON.deserialize(rawBody);

  const {
    database, collection,
    filter = {},
    projection,
    sort,
    limit,
    skip,
    collation
  } = body;

  if (!database || !collection) return res.status(400).json({ error: "database & collection required" });

  try {
    const coll = (await getClient()).db(database).collection(collection);
    const cursor = coll.find(filter, { projection });

    const sortSpec = coerceSort(sort);
    if (sortSpec) cursor.sort(sortSpec);
    if (typeof skip === "number") cursor.skip(skip);
    if (typeof limit === "number") cursor.limit(limit);
    if (collation) cursor.collation(collation);

    const documents = await cursor.toArray();
    res.json({ documents });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
