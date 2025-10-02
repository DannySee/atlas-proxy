// api/find.js
import { MongoClient } from "mongodb";
let client, ready;
async function getClient() {
  if (!ready) { client = new MongoClient(process.env.MONGODB_URI, { maxPoolSize: 5 }); ready = client.connect(); }
  await ready; return client;
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

  const {
    database, collection,
    filter = {},
    projection,
    sort,
    limit,
    skip,
    collation,
    // NEW: if true and sort contains "timestamp", cast it to Date for sort
    sortTimestampAsDate = false
  } = req.body || {};

  if (!database || !collection) return res.status(400).json({ error: "database & collection required" });

  try {
    const coll = (await getClient()).db(database).collection(collection);

    // If we need to cast "timestamp" to a date for sorting, use aggregation
    const timestampSortDir = sort && sort.hasOwnProperty("timestamp") ? coerceSort(sort)["timestamp"] : undefined;
    if (sortTimestampAsDate && timestampSortDir) {
      const pipeline = [
        { $match: filter },
        // cast to a real Date in a temp field (handles ISO strings & unix numbers)
        { $addFields: { _tsSort: { $toDate: "$timestamp" } } },
        { $sort: { _tsSort: timestampSortDir } },
      ];
      if (typeof skip === "number") pipeline.push({ $skip: skip });
      if (typeof limit === "number") pipeline.push({ $limit: limit });
      if (projection) pipeline.push({ $project: projection });

      const docs = await coll.aggregate(pipeline, { collation }).toArray();
      return res.json({ documents: docs });
    }

    // Normal find/sort path
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
