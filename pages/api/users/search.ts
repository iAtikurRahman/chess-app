import type { NextApiRequest, NextApiResponse } from "next";
import { searchUsers } from "../../../lib/redis";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).end();
  const { q, exclude } = req.query as { q?: string; exclude?: string };
  if (!q?.trim() || q.trim().length < 2) return res.status(400).json({ error: "Query too short" });
  const users = await searchUsers(q.trim(), exclude);
  return res.status(200).json({ users });
}
