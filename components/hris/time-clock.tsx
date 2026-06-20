"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Camera, LogIn, LogOut, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { recordAttendance } from "@/lib/hris/actions";
import { formatManila } from "@/lib/date";
import type { AttendanceKind } from "@/lib/supabase/types";

export function TimeClock({
  branchId,
  branchName,
  userName,
}: {
  branchId: string;
  branchName: string;
  userName: string;
}) {
  const router = useRouter();
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const [ready, setReady] = React.useState(false);
  const [camError, setCamError] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const [done, setDone] = React.useState<{ kind: AttendanceKind; at: string; photo?: string } | null>(null);

  React.useEffect(() => {
    let stream: MediaStream | null = null;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: 480, height: 480 },
          audio: false,
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setReady(true);
        }
      } catch {
        setCamError(true);
      }
    })();
    return () => stream?.getTracks().forEach((t) => t.stop());
  }, []);

  function grab(): string | undefined {
    const video = videoRef.current;
    if (!video || !ready) return undefined;
    const size = 360;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return undefined;
    // Center-crop square from the video frame.
    const vw = video.videoWidth, vh = video.videoHeight;
    const side = Math.min(vw, vh);
    ctx.drawImage(video, (vw - side) / 2, (vh - side) / 2, side, side, 0, 0, size, size);
    return canvas.toDataURL("image/jpeg", 0.6);
  }

  function clock(kind: AttendanceKind) {
    const photo = grab();
    startTransition(async () => {
      const res = await recordAttendance({ branchId, kind, photo });
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      setDone({ kind, at: new Date().toISOString(), photo });
      toast.success(kind === "clock_in" ? "Clocked in" : "Clocked out");
      router.refresh();
    });
  }

  if (done) {
    return (
      <div className="mx-auto max-w-sm rounded-2xl border border-white/10 bg-white/[0.04] p-6 text-center backdrop-blur-xl">
        <CheckCircle2 className="mx-auto size-12 text-teal-300" />
        <h2 className="mt-3 text-lg font-semibold">
          {done.kind === "clock_in" ? "Clocked in" : "Clocked out"}
        </h2>
        <p className="text-sm text-muted-foreground">
          {userName} · {branchName}
        </p>
        <p className="text-sm text-muted-foreground">{formatManila(done.at)}</p>
        {done.photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={done.photo} alt="Verification selfie" className="mx-auto mt-4 size-32 rounded-xl object-cover" />
        ) : null}
        <Button variant="outline" className="mt-5 w-full" onClick={() => setDone(null)}>
          Done
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-sm rounded-2xl border border-white/10 bg-white/[0.04] p-6 text-center backdrop-blur-xl">
      <p className="text-sm text-muted-foreground">Clocking at</p>
      <p className="font-semibold">{branchName}</p>
      <p className="mt-1 text-lg font-semibold">{userName}</p>

      <div className="relative mx-auto mt-4 aspect-square w-56 overflow-hidden rounded-2xl bg-black/40 ring-1 ring-white/10">
        <video ref={videoRef} muted playsInline className="size-full -scale-x-100 object-cover" />
        {!ready && !camError ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-xs text-muted-foreground">
            <Camera className="size-6" />
            Starting camera…
          </div>
        ) : null}
        {camError ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-4 text-xs text-muted-foreground">
            <Camera className="size-6" />
            Camera unavailable — you can still clock without a photo.
          </div>
        ) : null}
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <Button
          className="bg-gradient-to-r from-teal-500 to-cyan-600"
          disabled={pending}
          onClick={() => clock("clock_in")}
        >
          {pending ? <Loader2 className="size-4 animate-spin" /> : <LogIn className="size-4" />}
          Clock in
        </Button>
        <Button variant="outline" disabled={pending} onClick={() => clock("clock_out")}>
          <LogOut className="size-4" />
          Clock out
        </Button>
      </div>
      <p className="mt-3 text-[11px] text-muted-foreground">
        A selfie is captured for verification when you clock.
      </p>
    </div>
  );
}
