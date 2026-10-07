import { useRef, useState, type FormEvent } from "react";
import { useAction, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { EXCUSES, excuseLabel } from "../../convex/excuses";
import { useLog } from "../lib/log";
import { Camera, Sparkle } from "./Icons";

type Props = { excuse: string; userId: Id<"users">; onPick: (key: string) => void; onPosted: () => void };

export function PostCard({ excuse, userId, onPick, onPosted }: Props) {
  const { log } = useLog();
  const polish = useAction(api.coach.polish);
  const generateUploadUrl = useMutation(api.cards.generateUploadUrl);
  const post = useMutation(api.cards.post);

  const [rough, setRough] = useState("");
  const [sentence, setSentence] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [polishing, setPolishing] = useState(false);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  function pickFile(f: File | null) {
    setFile(f);
    setPreview(f ? URL.createObjectURL(f) : null);
  }

  async function doPolish() {
    setError(null);
    setPolishing(true);
    try {
      log("action", "coach.polish", "Node runtime → Claude");
      const result = await polish({ rough, excuse });
      setSentence(result.sentence);
      log("action", "coach.polish", `served by ${result.model}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setPolishing(false);
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setPosting(true);
    try {
      let imageId: Id<"_storage"> | undefined;
      if (file) {
        log("storage", "cards.generateUploadUrl", "one-time upload URL");
        const url = await generateUploadUrl();
        const res = await fetch(url, { method: "POST", headers: { "Content-Type": file.type }, body: file });
        if (!res.ok) throw new Error("The photo didn't upload. Try a smaller one.");
        const json = (await res.json()) as { storageId: Id<"_storage"> };
        imageId = json.storageId;
        log("storage", "upload", `${Math.round(file.size / 1024)} KB stored`);
      }
      const text = sentence.trim() || rough.trim();
      log("mutation", "cards.post", `excuse=${excuse}`);
      await post({ userId, excuse, sentence: text, imageId });
      setRough("");
      setSentence("");
      pickFile(null);
      if (fileInput.current) fileInput.current.value = "";
      onPosted();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setPosting(false);
    }
  }

  const canPost = rough.trim().length >= 3 || sentence.trim().length >= 3;

  return (
    <form onSubmit={submit} className="flex flex-col h-full px-5 pb-4 gap-4">
      <div className="pt-1">
        <h2 className="text-[26px] font-extrabold tracking-tight leading-tight">Your thirty seconds</h2>
        <p className="text-ink-2 text-sm mt-1">Do the small thing. Then say it in one line.</p>
      </div>

      <div>
        <p className="text-xs font-semibold text-ink-2 mb-2">The excuse you beat</p>
        <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-5 px-5">
          {EXCUSES.map((e) => (
            <button
              type="button"
              key={e.key}
              onClick={() => onPick(e.key)}
              aria-pressed={e.key === excuse}
              className={`shrink-0 rounded-full px-3.5 py-2 text-sm font-semibold transition ${
                e.key === excuse ? "bg-fire text-white" : "bg-surface border border-line hover:border-ink-3"
              }`}
            >
              {e.label}
            </button>
          ))}
        </div>
      </div>

      <label className="grid gap-1.5">
        <span className="text-xs font-semibold text-ink-2">What did you just do? Rough is fine.</span>
        <textarea
          id="rough"
          value={rough}
          onChange={(e) => setRough(e.target.value)}
          rows={3}
          maxLength={300}
          placeholder="ran in the rain 10 min almost didnt"
          className="w-full bg-surface border border-line rounded-2xl px-4 py-3.5 text-[16px] outline-none focus:border-ink transition resize-none placeholder:text-ink-3"
        />
      </label>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={doPolish}
          disabled={polishing || rough.trim().length < 3}
          className="inline-flex items-center gap-1.5 rounded-full bg-surface border border-line px-4 py-2 text-sm font-semibold hover:border-ink-3 disabled:opacity-40 transition"
        >
          <Sparkle className={`w-4 h-4 text-fire ${polishing ? "blink" : ""}`} />
          {polishing ? "Tidying…" : "Tidy it up"}
        </button>
        <span className="text-xs text-ink-3">Claude turns the note into a card line.</span>
      </div>

      <label className="grid gap-1.5">
        <span className="text-xs font-semibold text-ink-2">The line on your card</span>
        <input
          id="sentence"
          value={sentence}
          onChange={(e) => setSentence(e.target.value)}
          maxLength={140}
          placeholder={rough.trim() || "Ran ten minutes. Rain. Almost didn't."}
          className="w-full bg-surface border border-line rounded-2xl px-4 py-3.5 text-[16px] font-semibold outline-none focus:border-ink transition placeholder:text-ink-3 placeholder:font-normal"
        />
      </label>

      <div>
        <input id="photo" ref={fileInput} type="file" accept="image/*" capture="user" onChange={(e) => pickFile(e.target.files?.[0] ?? null)} className="sr-only" />
        <label
          htmlFor="photo"
          className="flex items-center gap-3 rounded-2xl border border-dashed border-ink-3/60 bg-surface px-4 py-3 cursor-pointer hover:border-ink transition"
        >
          {preview ? (
            <img src={preview} alt="" className="w-12 h-12 rounded-xl object-cover" />
          ) : (
            <span className="w-12 h-12 rounded-xl bg-bg grid place-items-center text-ink-2">
              <Camera className="w-6 h-6" />
            </span>
          )}
          <span className="text-sm">
            <span className="font-semibold block">{preview ? "Change photo" : "Your face, right after"}</span>
            <span className="text-ink-3">Optional. It's what makes strangers real.</span>
          </span>
        </label>
      </div>

      {error && <p className="text-fire text-sm font-medium">{error}</p>}

      <div className="mt-auto pt-2">
        <button
          type="submit"
          disabled={posting || !canPost}
          className="w-full bg-fire text-white font-bold rounded-2xl py-4 text-[16px] shadow-float hover:brightness-105 active:scale-[0.99] disabled:opacity-40 disabled:shadow-none transition"
        >
          {posting ? "Posting…" : `Post · beat “${excuseLabel(excuse)}”`}
        </button>
      </div>
    </form>
  );
}
