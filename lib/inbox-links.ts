// Where to answer each kind of DM. Client-safe (no Node imports), shared by the Today page and the webhook.
export const INBOX_URL = { instagram: "https://www.instagram.com/direct/inbox/", facebook: "https://business.facebook.com/latest/inbox/all" } as const;
export const CHANNEL_LABEL = { instagram: "Instagram", facebook: "Facebook" } as const;
