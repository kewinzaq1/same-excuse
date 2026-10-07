import { useEffect, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import type { Doc, Id } from "../convex/_generated/dataModel";
import { LogProvider, useLog } from "./lib/log";
import { useUser } from "./lib/useUser";
import { Onboarding } from "./components/Onboarding";
import { Deck } from "./components/Deck";
import { PostCard } from "./components/PostCard";
import { MeTab } from "./components/MeTab";
import { PingBanner } from "./components/PingBanner";
import { ConvexPanel } from "./components/ConvexPanel";
import { Camera, Code, Cross, Flame, Layers, Person } from "./components/Icons";

const EXCUSE_KEY = "same-excuse.excuse";
type Tab = "deck" | "post" | "me";

export default function App() {
  return (
    <LogProvider>
      <Shell />
    </LogProvider>
  );
}

function Shell() {
  const { userId, user, loading, signIn, signOut } = useUser();

  if (!userId) return <Frame><Onboarding onDone={signIn} /></Frame>;
  if (loading || !user) {
    return (
      <Frame>
        <div className="flex-1 grid place-items-center text-ink-3 text-sm">Connecting…</div>
      </Frame>
    );
  }
  return <Home userId={userId} user={user} signOut={signOut} />;
}

// The phone: full screen on mobile, a centered device on desktop.
function Frame({ children, aside }: { children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div className="min-h-screen md:py-6 md:px-6 md:flex md:justify-center md:gap-6 md:items-start">
      <div className="relative w-full md:w-[430px] min-h-screen md:min-h-0 md:h-[860px] bg-bg md:rounded-[40px] md:border md:border-line md:shadow-card flex flex-col overflow-hidden">
        {children}
      </div>
      {aside}
    </div>
  );
}

type HomeProps = { userId: Id<"users">; user: Doc<"users">; signOut: () => void };

function Home({ userId, user, signOut }: HomeProps) {
  const { log } = useLog();
  const [tab, setTab] = useState<Tab>("deck");
  const [dev, setDev] = useState(false);
  const [excuse, setExcuse] = useState<string>(() => {
    try {
      return localStorage.getItem(EXCUSE_KEY) ?? "rain";
    } catch {
      return "rain";
    }
  });
  const counts = useQuery(api.cards.countsToday);

  useEffect(() => {
    log("query", "users.get", "subscribed · fires-left is live");
    log("query", "cards.countsToday", "subscribed");
    log("query", "pings.current", "subscribed · waiting for a ping");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function pick(key: string) {
    setExcuse(key);
    try {
      localStorage.setItem(EXCUSE_KEY, key);
    } catch {
      /* ignore */
    }
  }

  const aside = dev ? (
    <div className="fixed inset-0 z-40 md:static md:inset-auto md:z-auto md:w-[380px] md:h-[860px]">
      <div className="absolute inset-0 bg-ink/30 md:hidden" onClick={() => setDev(false)} />
      <div className="absolute inset-x-0 bottom-0 top-12 md:static md:h-full bg-surface md:rounded-[28px] md:border md:border-line md:shadow-card rounded-t-[28px] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-line">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Code className="w-4 h-4 text-ink-2" /> Under the hood
          </div>
          <button onClick={() => setDev(false)} className="w-8 h-8 rounded-full grid place-items-center hover:bg-bg" aria-label="Close">
            <Cross className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-auto">
          <ConvexPanel userId={userId} />
        </div>
      </div>
    </div>
  ) : null;

  return (
    <Frame aside={aside}>
      <header className="flex items-center justify-between px-5 pt-[calc(env(safe-area-inset-top,0px)+14px)] pb-3">
        <span className="font-extrabold tracking-tight text-[17px]">same excuse</span>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-fire-soft text-fire font-bold text-sm px-2.5 py-1 tnum" title="Your fires today">
            <Flame className="w-4 h-4" /> {user.firesLeft}
          </span>
          <button
            onClick={() => setDev((d) => !d)}
            className={`w-9 h-9 rounded-full grid place-items-center transition ${dev ? "bg-ink text-surface" : "hover:bg-line text-ink-2"}`}
            aria-label="Under the hood"
            aria-pressed={dev}
          >
            <Code className="w-4 h-4" />
          </button>
        </div>
      </header>

      <PingBanner userId={userId} excuse={excuse} onPost={() => setTab("post")} />

      <main className="flex-1 min-h-0 overflow-auto no-scrollbar">
        {tab === "deck" && <Deck excuse={excuse} userId={userId} counts={counts} onPick={pick} />}
        {tab === "post" && <PostCard excuse={excuse} userId={userId} onPick={pick} onPosted={() => setTab("deck")} />}
        {tab === "me" && <MeTab userId={userId} user={user} signOut={signOut} />}
      </main>

      <nav className="grid grid-cols-3 border-t border-line bg-surface pb-[env(safe-area-inset-bottom,0px)]">
        <TabButton active={tab === "deck"} onClick={() => setTab("deck")} icon={<Layers />} label="Deck" />
        <TabButton active={tab === "post"} onClick={() => setTab("post")} icon={<Camera />} label="Post" accent />
        <TabButton active={tab === "me"} onClick={() => setTab("me")} icon={<Person />} label="Me" />
      </nav>
    </Frame>
  );
}

function TabButton({ active, onClick, icon, label, accent }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string; accent?: boolean }) {
  return (
    <button
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={`flex flex-col items-center gap-1 py-2.5 text-[11px] font-semibold transition ${
        active ? (accent ? "text-fire" : "text-ink") : "text-ink-3 hover:text-ink-2"
      }`}
    >
      <span className={`w-11 h-7 grid place-items-center rounded-full transition ${active ? (accent ? "bg-fire-soft" : "bg-line") : ""}`}>{icon}</span>
      {label}
    </button>
  );
}
