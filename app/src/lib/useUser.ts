import { useCallback, useEffect, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

const KEY = "same-excuse.userId";

function readStored(): Id<"users"> | null {
  try {
    return (localStorage.getItem(KEY) as Id<"users"> | null) ?? null;
  } catch {
    return null;
  }
}

// Anonymous identity: the browser remembers its user id, Convex holds the user.
export function useUser() {
  const [userId, setUserId] = useState<Id<"users"> | null>(readStored);
  const user = useQuery(api.users.get, userId ? { userId } : "skip");

  // A stale id (deployment wiped, or a different backend) comes back null: forget it.
  useEffect(() => {
    if (userId && user === null) {
      try {
        localStorage.removeItem(KEY);
      } catch {
        /* ignore */
      }
      setUserId(null);
    }
  }, [userId, user]);

  const signIn = useCallback((id: Id<"users">) => {
    try {
      localStorage.setItem(KEY, id);
    } catch {
      /* ignore */
    }
    setUserId(id);
  }, []);

  const signOut = useCallback(() => {
    try {
      localStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
    setUserId(null);
  }, []);

  return { userId, user: user ?? null, loading: userId !== null && user === undefined, signIn, signOut };
}
