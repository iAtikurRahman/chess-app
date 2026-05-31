import type { NextApiRequest, NextApiResponse } from "next";
import { registerUser } from "../../../lib/redis";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();
  const { email, name } = req.body as { email?: string; name?: string };
  if (!email?.trim()) return res.status(400).json({ error: "Email required" });
  await registerUser(email.trim(), name?.trim() || email.trim());
  return res.status(200).json({ ok: true });
}
