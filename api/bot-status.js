const crypto = require("crypto");
const { MongoClient } = require("mongodb");

let cachedClient = null;

function safeEqual(a, b) {
  const aBuf = Buffer.from(a || "");
  const bBuf = Buffer.from(b || "");
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}

async function getClient() {
  if (cachedClient) return cachedClient;

  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("Missing MONGODB_URI env var");

  cachedClient = new MongoClient(uri, {
    // optional: helps in some corporate/proxy environments
    serverSelectionTimeoutMS: 5000,
  });

  await cachedClient.connect();
  return cachedClient;
}

module.exports = async (req, res) => {
  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return res.status(405).json({ ok: false, error: "method not allowed" });
    }

    // --- Auth (simple bearer token) ---
    const auth = req.headers.authorization || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    const expected = process.env.BOT_STATUS_TOKEN || "";

    if (!expected || !token || !safeEqual(token, expected)) {
      return res.status(401).json({ ok: false, error: "unauthorized" });
    }

    // --- Parse body ---
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;

    const { botName, runId, status, message, ts } = body || {};
    if (!botName || !status) {
      return res.status(400).json({ ok: false, error: "invalid payload" });
    }

    // --- Write to MongoDB ---
    const client = await getClient();
    const dbName = process.env.MONGODB_DB || "bot_status";
    const colName = process.env.MONGODB_COLLECTION || "runs";

    const newRunId = runId || crypto.randomUUID();

    await client.db(dbName).collection(colName).insertOne({
      botName,
      runId: newRunId,
      status,              // "started" | "success" | "failed" (or whatever you want)
      message: message ?? null,
      ts: ts ? new Date(ts) : new Date(),
      receivedAt: new Date(),
    });

    return res.status(200).json({ ok: true, runId: newRunId });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message || "server error" });
  }
};
