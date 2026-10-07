// The twelve things people say to themselves. Shared by the backend (validation)
// and the frontend (the picker). The excuse is the spine of the whole app.
export const EXCUSES = [
  { key: "rain", label: "It's raining.", turn: "Now it is your rain." },
  { key: "tired", label: "I'm too tired.", turn: "Now it is your tired." },
  { key: "time", label: "No time today.", turn: "Now it is your no time." },
  { key: "monday", label: "I'll start Monday.", turn: "Now it is your Monday." },
  { key: "episode", label: "One more episode.", turn: "Now it is your episode." },
  { key: "nobody", label: "Nobody would notice.", turn: "Now it is your nobody." },
  { key: "later", label: "Later, after this.", turn: "Now it is your later." },
  { key: "mood", label: "Not in the mood.", turn: "Now it is your mood." },
] as const;

export type ExcuseKey = (typeof EXCUSES)[number]["key"];

export const EXCUSE_KEYS = EXCUSES.map((e) => e.key) as ExcuseKey[];

export function isExcuseKey(key: string): key is ExcuseKey {
  return (EXCUSE_KEYS as string[]).includes(key);
}

export function excuseLabel(key: string): string {
  return EXCUSES.find((e) => e.key === key)?.label ?? key;
}
