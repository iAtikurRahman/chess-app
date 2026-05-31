import Pusher from "pusher";

export const pusherServer = new Pusher({
  appId: process.env.PUSHER_APP_ID!,
  key: process.env.PUSHER_KEY!,
  secret: process.env.PUSHER_SECRET!,
  cluster: process.env.PUSHER_CLUSTER!,
  useTLS: true,
});

export const channelName = (roomId: string) => `game-${roomId}`;

/** Personal channel for challenge notifications */
export const personalChannel = (email: string) =>
  `user-${email.replace(/[^a-zA-Z0-9]/g, "-")}`;
