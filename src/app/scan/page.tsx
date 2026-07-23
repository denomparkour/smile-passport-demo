"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

type Mode  = "camera" | "upload";
type Stage = "pick" | "camera" | "preview";

interface Box { x: number; y: number; width: number; height: number } // normalized 0-1, top-left origin

// Outer lip contour landmark indices (MediaPipe FACEMESH_LIPS)
const LIP_LANDMARKS = [61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291, 375, 321, 405, 314, 17, 84, 181, 91, 146];

const FULL_FRAME_BOX: Box = { x: 0, y: 0, width: 1, height: 1 };

// If the mouth already fills at least this fraction of the frame width, treat it as
// already close-up and skip zooming. Otherwise crop+zoom so the mouth fills ~1/ZOOM_PADDING.
const ZOOM_PADDING = 2.4;
const TARGET_MOUTH_RATIO = 1 / ZOOM_PADDING;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mouthBox(lm: any[]): Box {
  let minX = 1, maxX = 0, minY = 1, maxY = 0;
  for (const idx of LIP_LANDMARKS) {
    const p = lm[idx];
    if (!p) continue;
    minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

function computeCropBox(box: Box, aspect: number): Box {
  if (box.width >= TARGET_MOUTH_RATIO || box.width <= 0) return FULL_FRAME_BOX;
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  let w = box.width * ZOOM_PADDING;
  let h = w / aspect;
  if (h < box.height * ZOOM_PADDING) {
    h = box.height * ZOOM_PADDING;
    w = h * aspect;
  }
  w = Math.min(w, 1);
  h = Math.min(h, 1);
  const x = Math.max(0, Math.min(1 - w, cx - w / 2));
  const y = Math.max(0, Math.min(1 - h, cy - h / 2));
  return { x, y, width: w, height: h };
}

// Eases the live crop box toward a new target instead of snapping to it every frame —
// raw per-frame landmark jitter otherwise makes the zoomed preview visibly vibrate.
function lerpBox(from: Box, to: Box, t: number): Box {
  return {
    x:      from.x      + (to.x      - from.x)      * t,
    y:      from.y      + (to.y      - from.y)      * t,
    width:  from.width  + (to.width  - from.width)  * t,
    height: from.height + (to.height - from.height) * t,
  };
}

const CROP_SMOOTHING = 0.18; // lower = smoother/slower to follow, higher = snappier/more jitter

const STEPS = [
  { key: "front",  label: "Front Smiling",  hint: "Look straight ahead and give your best smile",  optional: false },
  { key: "teeth",  label: "Front Teeth",    hint: "Smile wide so your teeth are clearly visible",   optional: false },
  { key: "side",   label: "Side Profile",   hint: "Turn your head to show your side profile",        optional: true  },
] as const;

type StepKey = "front" | "teeth" | "side";

export default function ScanPage() {
  const videoRef       = useRef<HTMLVideoElement>(null);
  const canvasRef      = useRef<HTMLCanvasElement>(null);
  const fileRef        = useRef<HTMLInputElement>(null);
  const streamRef      = useRef<MediaStream | null>(null);
  const animFrameRef      = useRef<number>(0);
  const smileFramesRef    = useRef(0);
  const teethCropBoxRef   = useRef<Box>(FULL_FRAME_BOX);
  const capturedRef       = useRef(false);
  const detectionSession  = useRef(0);

  const [stepIndex, setStepIndex] = useState(0);
  const [mode, setMode]           = useState<Mode>("camera");
  const [stage, setStage]         = useState<Stage>("pick");
  const [photos, setPhotos]       = useState<Partial<Record<StepKey, string>>>({});
  const [previewPhoto, setPreviewPhoto] = useState<string | null>(null);
  const [gender, setGender]       = useState<"male" | "female" | null>(null);
  const [smileProgress, setSmileProgress] = useState(0);
  const [teethProgress, setTeethProgress] = useState(0);
  const [teethZooming, setTeethZooming]   = useState(false);
  const [faceDetected, setFaceDetected]   = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [cameraLoading, setCameraLoading] = useState(false);
  const [dragOver, setDragOver]   = useState(false);
  const [processingUpload, setProcessingUpload] = useState(false);

  const router = useRouter();
  const step = STEPS[stepIndex];
  const SMILE_HOLD_FRAMES = 18;

  // ── camera helpers ──────────────────────────────────────────────
  const stopCamera = useCallback(() => {
    detectionSession.current++;          // invalidate any in-flight MediaPipe callbacks
    cancelAnimationFrame(animFrameRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    capturedRef.current = false;
    smileFramesRef.current = 0;
    teethCropBoxRef.current = FULL_FRAME_BOX;
    setSmileProgress(0);
    setTeethProgress(0);
    setTeethZooming(false);
    setFaceDetected(false);
  }, []);

  useEffect(() => () => stopCamera(), [stopCamera]);

  const savePhoto = useCallback((dataUrl: string) => {
    setPhotos((prev) => ({ ...prev, [step.key]: dataUrl }));
    setPreviewPhoto(dataUrl);
    stopCamera();
    setStage("preview");
  }, [step.key, stopCamera]);

  const captureSmile = useCallback(() => {
    if (capturedRef.current) return;
    capturedRef.current = true;
    cancelAnimationFrame(animFrameRef.current);
    const video  = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width  = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0);
    savePhoto(canvas.toDataURL("image/jpeg", 0.85));
  }, [savePhoto]);

  const captureTeeth = useCallback(() => {
    if (capturedRef.current) return;
    capturedRef.current = true;
    cancelAnimationFrame(animFrameRef.current);
    const video  = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    const vw = video.videoWidth  || 1280;
    const vh = video.videoHeight || 960;
    const box = teethCropBoxRef.current;
    const sx = box.x * vw, sy = box.y * vh, sw = box.width * vw, sh = box.height * vh;
    const outW = 900;
    const outH = Math.round(outW * (sh / sw));
    canvas.width  = outW;
    canvas.height = outH;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, outW, outH);
    savePhoto(canvas.toDataURL("image/jpeg", 0.85));
  }, [savePhoto]);

  const snapPhoto = useCallback(() => {
    const video  = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    const w = video.videoWidth  || 1280;
    const h = video.videoHeight || 960;
    cancelAnimationFrame(animFrameRef.current);
    canvas.width  = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.translate(w, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, w, h);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    if (dataUrl === "data:,") return; // blank canvas guard
    savePhoto(dataUrl);
  }, [savePhoto]);

  const startDetection = useCallback(() => {
    const sessionId = detectionSession.current; // snapshot — if stopCamera fires, session increments and this becomes stale
    const run = async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mp = await import("@mediapipe/face_mesh") as any;
      if (detectionSession.current !== sessionId) return; // camera was stopped while loading
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const faceMesh = new (mp.FaceMesh as any)({
        locateFile: (f: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${f}`,
      });
      faceMesh.setOptions({ maxNumFaces: 1, refineLandmarks: true, minDetectionConfidence: 0.7, minTrackingConfidence: 0.7 });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      faceMesh.onResults((results: any) => {
        if (detectionSession.current !== sessionId) return; // stale session — ignore
        if (!results.multiFaceLandmarks?.length) {
          setFaceDetected(false);
          smileFramesRef.current = Math.max(0, smileFramesRef.current - 2);
          setSmileProgress(0);
          setTeethProgress(0);
          return;
        }
        setFaceDetected(true);
        const lm = results.multiFaceLandmarks[0];

        if (step.key === "front" || step.key === "teeth") {
          const mouthWidth = Math.abs(lm[291].x - lm[61].x);
          const faceWidth  = Math.abs(lm[454].x - lm[234].x);
          const mouthOpen  = Math.abs(lm[13].y  - lm[14].y);
          const isSmiling  = mouthWidth / faceWidth > 0.42 && mouthOpen > 0.008;

          if (step.key === "teeth") {
            const video = videoRef.current;
            const aspect = video && video.videoWidth ? video.videoWidth / video.videoHeight : 4 / 3;
            const targetBox = computeCropBox(mouthBox(lm), aspect);
            teethCropBoxRef.current = lerpBox(teethCropBoxRef.current, targetBox, CROP_SMOOTHING);
            setTeethZooming(targetBox.width < 1);
          }

          if (isSmiling) smileFramesRef.current += 1;
          else smileFramesRef.current = Math.max(0, smileFramesRef.current - 2);
          const progress = Math.min(100, (smileFramesRef.current / SMILE_HOLD_FRAMES) * 100);
          setSmileProgress(progress);
          setTeethProgress(progress);
          if (smileFramesRef.current >= SMILE_HOLD_FRAMES) {
            if (step.key === "teeth") captureTeeth();
            else captureSmile();
          }
        }
      });
      const detect = async () => {
        if (detectionSession.current !== sessionId) return; // stale — stop loop
        if (videoRef.current && videoRef.current.readyState >= 2) {
          await faceMesh.send({ image: videoRef.current });
        }
        if (detectionSession.current !== sessionId) return; // check again after async send
        animFrameRef.current = requestAnimationFrame(detect);
      };
      detect();
    };
    run().catch(console.error);
  }, [step.key, captureSmile, captureTeeth]);

  const startCamera = useCallback(async () => {
    setError(null);
    setCameraLoading(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 960 }, facingMode: "user", aspectRatio: { ideal: 4 / 3 } },
      });
      streamRef.current = stream;
      const video = videoRef.current!;
      video.srcObject = stream;
      video.onloadedmetadata = () => {
        video.play();
        setCameraLoading(false);
        setStage("camera");
        startDetection();
      };
    } catch {
      setCameraLoading(false);
      setError("Camera access denied. Please allow camera permissions and try again.");
    }
  }, [step.key, startDetection]);

  // Detect the mouth in a static uploaded image and crop/zoom to it if the shot
  // isn't already a close-up (used for the "teeth" step upload path).
  const cropUploadToMouth = useCallback(async (dataUrl: string): Promise<string> => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mp = await import("@mediapipe/face_mesh") as any;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mesh = new (mp.FaceMesh as any)({
        locateFile: (f: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${f}`,
      });
      mesh.setOptions({ maxNumFaces: 1, refineLandmarks: true, minDetectionConfidence: 0.5, minTrackingConfidence: 0.5 });

      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("Failed to load image"));
        img.src = dataUrl;
      });

      const box = await new Promise<Box | null>((resolve) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        mesh.onResults((results: any) => {
          if (results.multiFaceLandmarks?.length) {
            resolve(computeCropBox(mouthBox(results.multiFaceLandmarks[0]), img.width / img.height));
          } else {
            resolve(null);
          }
        });
        mesh.send({ image: img });
      });

      if (!box || box.width >= 1) return dataUrl; // no face found, or already close-up

      const canvas = document.createElement("canvas");
      const sx = box.x * img.width, sy = box.y * img.height, sw = box.width * img.width, sh = box.height * img.height;
      canvas.width  = Math.round(sw);
      canvas.height = Math.round(sh);
      const ctx = canvas.getContext("2d");
      if (!ctx) return dataUrl;
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL("image/jpeg", 0.9);
    } catch {
      return dataUrl; // fall back to the original photo if detection fails
    }
  }, []);

  // ── file upload ──────────────────────────────────────────────────
  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) { setError("Please upload an image file."); return; }
    setError(null);
    const reader = new FileReader();
    reader.onload = async (e) => {
      let dataUrl = e.target?.result as string;
      if (step.key === "teeth") {
        setProcessingUpload(true);
        dataUrl = await cropUploadToMouth(dataUrl);
        setProcessingUpload(false);
      }
      savePhoto(dataUrl);
    };
    reader.readAsDataURL(file);
  }, [savePhoto, step.key, cropUploadToMouth]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, [handleFile]);

  // ── navigation ──────────────────────────────────────────────────
  const retake = () => {
    setPhotos((prev) => { const n = { ...prev }; delete n[step.key]; return n; });
    setPreviewPhoto(null);
    stopCamera();
    setStage("pick");
  };

  const goNext = () => {
    if (stepIndex < STEPS.length - 1) {
      setStepIndex(stepIndex + 1);
      setStage("pick");
    } else {
      const store = (key: string, val: string | undefined) =>
        val ? sessionStorage.setItem(key, val) : sessionStorage.removeItem(key);
      store("sp_photo_front", photos.front);
      store("sp_photo_teeth", photos.teeth);
      store("sp_photo_side",  photos.side);
      router.push("/results");
    }
  };

  const skipStep = () => {
    setPhotos((prev) => { const n = { ...prev }; delete n[step.key]; return n; });
    goNext();
  };

  const allRequiredDone = !!photos.front && !!photos.teeth;

  return (
    <main className="min-h-screen bg-[#faf8f4] flex flex-col">
      {/* Nav */}
      <nav className="sticky top-0 z-30 bg-white/80 backdrop-blur border-b border-[#b8923e]/10">
        <div className="max-w-3xl mx-auto px-5 h-14 flex items-center justify-between">
          <button
            onClick={() => {
              if (stage !== "pick" || stepIndex > 0) {
                stopCamera();
                if (stage !== "pick") setStage("pick");
                else { setStepIndex(stepIndex - 1); setStage("pick"); }
              } else {
                router.push("/");
              }
            }}
            className="text-sm text-[#8c8479] hover:text-[#1a1714] transition-colors"
          >
            ← {stage !== "pick" ? "Back" : stepIndex > 0 ? "Back" : "Home"}
          </button>
          <span className="font-black text-base shimmer-text">Smile Passport</span>
          <div className="w-12" />
        </div>
      </nav>

      {/* Hidden canvas + video */}
      <canvas ref={canvasRef} className="hidden" />
      <video ref={videoRef} className="hidden" playsInline muted />
      <input ref={fileRef} type="file" accept="image/*" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }} />

      <div className="flex-1 flex flex-col items-center px-5 py-8">

        {/* Progress steps */}
        <div className="flex items-start w-full max-w-sm mb-8">
          {STEPS.map((s, i) => (
            <div key={s.key} className="flex flex-col items-center flex-1">
              {/* Circle + connector lines */}
              <div className="flex items-center w-full">
                {/* Left connector */}
                <div className={`flex-1 h-px transition-colors duration-300 ${
                  i === 0 ? "invisible" : photos[STEPS[i - 1].key] ? "bg-[#b8923e]" : "bg-[#e8e0d4]"
                }`} />
                {/* Circle */}
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-all duration-300 ${
                  photos[s.key]
                    ? "text-white"
                    : i === stepIndex
                    ? "border-2 border-[#b8923e] text-[#b8923e]"
                    : "border-2 border-[#e8e0d4] text-[#c0b8b0]"
                }`}
                style={photos[s.key] ? { background: "linear-gradient(135deg, #a07830, #d4a84b)" } : {}}
                >
                  {photos[s.key] ? (
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  ) : i + 1}
                </div>
                {/* Right connector */}
                <div className={`flex-1 h-px transition-colors duration-300 ${
                  i === STEPS.length - 1 ? "invisible" : photos[s.key] ? "bg-[#b8923e]" : "bg-[#e8e0d4]"
                }`} />
              </div>
              {/* Label */}
              <div className="text-center mt-2">
                <p className={`text-[10px] font-semibold tracking-wide leading-tight ${
                  i === stepIndex ? "text-[#b8923e]" : photos[s.key] ? "text-[#b8923e]/60" : "text-[#c0b8b0]"
                }`}>
                  {s.label}
                </p>
                {s.optional && <p className="text-[9px] text-[#c0b8b0] mt-0.5">optional</p>}
              </div>
            </div>
          ))}
        </div>

        <AnimatePresence mode="wait">

          {/* ── PICK MODE ── */}
          {stage === "pick" && (
            <motion.div
              key={`pick-${stepIndex}`}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="w-full max-w-sm flex flex-col items-center gap-6"
            >
              <div className="text-center">
                <p className="text-xs tracking-widest uppercase text-[#b8923e] font-semibold mb-1">
                  Photo {stepIndex + 1} of {STEPS.length}
                </p>
                <h2 className="text-2xl font-black text-[#1a1714]" style={{ letterSpacing: "-0.02em" }}>
                  {step.label}
                </h2>
                <p className="text-[#8c8479] text-sm mt-1">{step.hint}</p>
              </div>

              {/* Mode toggle */}
              <div className="flex gap-1 bg-[#f0ece3] rounded-full p-1 w-full">
                {(["camera", "upload"] as Mode[]).map((m) => (
                  <button key={m} onClick={() => setMode(m)}
                    className={`flex-1 py-2.5 rounded-full text-sm font-semibold transition-all duration-200 flex items-center justify-center gap-2 ${
                      mode === m ? "bg-white text-[#1a1714] shadow-sm" : "text-[#8c8479] hover:text-[#1a1714]"
                    }`}>
                    {m === "camera" ? (
                      <><CameraIcon /> Take Photo</>
                    ) : (
                      <><UploadIcon /> Upload</>
                    )}
                  </button>
                ))}
              </div>

              {mode === "camera" ? (
                <>
                  {error && <p className="text-red-500 text-sm bg-red-50 border border-red-200 rounded-xl px-4 py-3 w-full">{error}</p>}
                  <button onClick={startCamera} disabled={cameraLoading}
                    className="gold-btn w-full rounded-full py-4 text-sm tracking-widest glow-gold disabled:opacity-70 flex items-center justify-center gap-2">
                    {cameraLoading ? <Spinner /> : null}
                    {cameraLoading ? "Starting Camera..." : "Open Camera"}
                  </button>
                </>
              ) : (
                <>
                  <div
                    onClick={() => fileRef.current?.click()}
                    onDrop={handleDrop}
                    onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    className={`w-full rounded-2xl border-2 border-dashed cursor-pointer p-8 flex flex-col items-center gap-3 transition-all duration-200 ${
                      dragOver ? "border-[#b8923e] bg-[#f5ead6]/50" : "border-[#b8923e]/25 bg-white hover:border-[#b8923e]/50 hover:bg-[#f5ead6]/20"
                    }`}>
                    <div className="w-14 h-14 rounded-2xl bg-[#f5ead6] flex items-center justify-center">
                      <UploadIcon size={24} color="#b8923e" />
                    </div>
                    <div className="text-center">
                      <p className="font-semibold text-[#1a1714] text-sm">Drop photo here</p>
                      <p className="text-[#8c8479] text-xs mt-0.5">or tap to browse · JPG, PNG, HEIC</p>
                    </div>
                  </div>
                  {error && <p className="text-red-500 text-sm bg-red-50 border border-red-200 rounded-xl px-4 py-3 w-full">{error}</p>}
                  <button onClick={() => fileRef.current?.click()} disabled={processingUpload}
                    className="gold-btn w-full rounded-full py-4 text-sm tracking-widest glow-gold flex items-center justify-center gap-2 disabled:opacity-70">
                    {processingUpload && <Spinner />}
                    {processingUpload ? "Zooming into your teeth..." : "Choose Photo"}
                  </button>
                </>
              )}

              {step.optional && (
                <button onClick={skipStep} className="text-sm text-[#8c8479] hover:text-[#1a1714] transition-colors underline underline-offset-2">
                  Skip this photo
                </button>
              )}

              {/* Thumbnail strip of captured photos */}
              {(photos.front || photos.teeth) && (
                <div className="flex gap-2 w-full mt-1">
                  {STEPS.slice(0, stepIndex).map((s) => photos[s.key] && (
                    <div key={s.key} className="relative w-14 h-14 rounded-xl overflow-hidden border-2 border-[#b8923e]/30">
                      <img src={photos[s.key]} alt={s.label} className="w-full h-full object-cover object-top" />
                      <div className="absolute inset-0 bg-[#b8923e]/10" />
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* ── CAMERA VIEW ── */}
          {stage === "camera" && (
            <motion.div
              key={`camera-${stepIndex}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="w-full max-w-sm flex flex-col items-center gap-5"
            >
              <div className="relative w-full aspect-[3/4] rounded-2xl overflow-hidden shadow-xl bg-black">
                {step.key === "teeth" ? (
                  <ZoomVideoMirror videoRef={videoRef} cropBoxRef={teethCropBoxRef} />
                ) : (
                  <VideoMirror videoRef={videoRef} />
                )}

                {/* Scan line (step 1 only) */}
                {step.key === "front" && (
                  <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    <div className="absolute left-0 right-0 h-px opacity-50"
                      style={{ background: "linear-gradient(90deg, transparent, #b8923e, transparent)", animation: "scan 2s linear infinite" }} />
                  </div>
                )}

                {/* Corners */}
                {(["top-3 left-3 border-t-2 border-l-2 rounded-tl-lg", "top-3 right-3 border-t-2 border-r-2 rounded-tr-lg",
                   "bottom-3 left-3 border-b-2 border-l-2 rounded-bl-lg", "bottom-3 right-3 border-b-2 border-r-2 rounded-br-lg"] as const
                ).map((cls, i) => <div key={i} className={`absolute w-7 h-7 border-[#b8923e] ${cls}`} />)}

                {/* Status pill */}
                <div className="absolute top-3 left-1/2 -translate-x-1/2 whitespace-nowrap">
                  <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium backdrop-blur transition-all duration-300 ${
                    faceDetected ? "bg-[#b8923e]/90 text-white" : "bg-white/80 text-[#8c8479]"
                  }`}>
                    <div className={`w-1.5 h-1.5 rounded-full ${faceDetected ? "bg-white" : "bg-[#8c8479]"}`}
                      style={faceDetected ? { animation: "blink 1s ease-in-out infinite" } : {}} />
                    {faceDetected ? "Face detected" : "Looking for face..."}
                  </div>
                </div>

                {/* Zooming badge (teeth step, when not already close-up) */}
                {step.key === "teeth" && teethZooming && (
                  <div className="absolute top-3 right-3">
                    <span className="text-xs font-medium text-white bg-[#b8923e]/90 px-2.5 py-1 rounded-full backdrop-blur">
                      🔍 Zooming in
                    </span>
                  </div>
                )}

                {/* Step label overlay */}
                <div className="absolute bottom-3 left-0 right-0 text-center">
                  <span className="text-xs text-white/80 font-medium bg-black/30 px-3 py-1 rounded-full backdrop-blur">
                    {step.label}
                  </span>
                </div>
              </div>

              {/* Step 1: auto smile detection bar */}
              {step.key === "front" && (
                <div className="w-full">
                  <div className="flex justify-between text-xs text-[#8c8479] mb-1.5">
                    <span>Smile detected</span>
                    <span>{Math.round(smileProgress)}%</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-[#f0ece3] overflow-hidden">
                    <motion.div className="h-full rounded-full"
                      style={{ background: "linear-gradient(90deg, #a07830, #d4a84b)" }}
                      animate={{ width: `${smileProgress}%` }}
                      transition={{ duration: 0.1 }} />
                  </div>
                  <p className="text-center text-[#8c8479] text-sm mt-2">
                    {smileProgress > 30 ? "Hold that smile! ✨" : "Smile naturally into the camera"}
                  </p>
                </div>
              )}

              {/* Step 2: same smile detection as step 1, zoomed into the mouth */}
              {step.key === "teeth" && (
                <div className="w-full">
                  <div className="flex justify-between text-xs text-[#8c8479] mb-1.5">
                    <span>Smile detected</span>
                    <span>{Math.round(teethProgress)}%</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-[#f0ece3] overflow-hidden">
                    <motion.div className="h-full rounded-full"
                      style={{ background: "linear-gradient(90deg, #a07830, #d4a84b)" }}
                      animate={{ width: `${teethProgress}%` }}
                      transition={{ duration: 0.1 }} />
                  </div>
                  <p className="text-center text-[#8c8479] text-sm mt-2">
                    {teethProgress > 30 ? "Hold that smile! ✨" : "Smile wide so your teeth are visible"}
                  </p>
                </div>
              )}

              {/* Manual capture button — also usable as an override/fallback */}
              {step.key !== "front" && (
                <button onClick={step.key === "teeth" ? captureTeeth : snapPhoto}
                  className="gold-btn w-full rounded-full py-4 text-sm tracking-widest glow-gold flex items-center justify-center gap-2">
                  📸 Take Photo
                </button>
              )}
            </motion.div>
          )}

          {/* ── PREVIEW ── */}
          {stage === "preview" && previewPhoto && (
            <motion.div
              key={`preview-${stepIndex}`}
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              className="w-full max-w-sm flex flex-col items-center gap-6"
            >
              <div className="relative w-full">
                <div className="absolute -inset-1 rounded-3xl opacity-40"
                  style={{ background: "linear-gradient(135deg, #b8923e, #d4a84b)", filter: "blur(12px)" }} />
                <img src={previewPhoto} alt={step.label}
                  className="relative w-full aspect-[3/4] object-cover object-top rounded-2xl shadow-xl" />
                <div className="absolute -bottom-3 -right-3 w-11 h-11 rounded-full flex items-center justify-center shadow-lg"
                  style={{ background: "linear-gradient(135deg, #a07830, #d4a84b)" }}>
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                    <path d="M3.5 9l4 4 7-7" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              </div>

              <div className="text-center">
                <p className="text-xs tracking-widest uppercase text-[#b8923e] font-semibold mb-0.5">{step.label}</p>
                <h2 className="text-xl font-black text-[#1a1714]" style={{ letterSpacing: "-0.02em" }}>
                  {stepIndex < STEPS.length - 1 ? "Looks great!" : allRequiredDone ? "All done!" : "Got it!"}
                </h2>
                <p className="text-[#8c8479] text-sm mt-0.5">
                  {stepIndex < STEPS.length - 1
                    ? `${STEPS.length - stepIndex - 1} more photo${STEPS.length - stepIndex - 1 !== 1 ? "s" : ""} to go`
                    : "Ready to analyse your smile."}
                </p>
              </div>

              <div className="flex gap-3 w-full">
                <button onClick={goNext}
                  className="gold-btn flex-1 rounded-full py-4 text-sm tracking-widest glow-gold">
                  {stepIndex < STEPS.length - 1 ? "Next Photo →" : "Analyse My Smile →"}
                </button>
                <button onClick={retake}
                  className="flex-1 rounded-full py-4 text-sm font-semibold text-[#8c8479] hover:text-[#1a1714] border border-[#b8923e]/20 bg-white transition-all">
                  Retake
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </main>
  );
}

// ── tiny icon components ─────────────────────────────────────────

function CameraIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <rect x="1" y="3" width="12" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.2"/>
      <circle cx="7" cy="7.5" r="2" stroke="currentColor" strokeWidth="1.2"/>
      <path d="M5 3l.8-1.5h2.4L9 3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
    </svg>
  );
}

function UploadIcon({ size = 14, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none">
      <path d="M7 1v8M4 6l3-3 3 3" stroke={color} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M2 10v1.5A1.5 1.5 0 003.5 13h7a1.5 1.5 0 001.5-1.5V10" stroke={color} strokeWidth="1.2" strokeLinecap="round"/>
    </svg>
  );
}

function Spinner() {
  return (
    <svg className="animate-spin" width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="6" stroke="rgba(255,255,255,0.3)" strokeWidth="2" />
      <path d="M8 2a6 6 0 0 1 6 6" stroke="white" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function VideoMirror({ videoRef }: { videoRef: React.RefObject<HTMLVideoElement | null> }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    const video  = videoRef.current;
    if (!canvas || !video) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf: number;
    const draw = () => {
      if (video.readyState >= 2) {
        canvas.width  = video.videoWidth  || 1280;
        canvas.height = video.videoHeight || 720;
        ctx.save();
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(video, 0, 0);
        ctx.restore();
      }
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [videoRef]);
  return <canvas ref={canvasRef} className="w-full h-full object-cover" />;
}

// Mirrors the video like VideoMirror, but continuously renders a digitally
// zoomed crop (driven by cropBoxRef, updated live from face-landmark detection)
// instead of the raw full frame — so the on-screen preview zooms in automatically.
function ZoomVideoMirror({
  videoRef,
  cropBoxRef,
}: {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  cropBoxRef: React.RefObject<Box>;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    const video  = videoRef.current;
    if (!canvas || !video) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf: number;
    const draw = () => {
      if (video.readyState >= 2) {
        const vw = video.videoWidth  || 1280;
        const vh = video.videoHeight || 720;
        canvas.width  = vw;
        canvas.height = vh;
        const box = cropBoxRef.current;
        const sx = box.x * vw, sy = box.y * vh, sw = box.width * vw, sh = box.height * vh;
        ctx.save();
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
        ctx.restore();
      }
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [videoRef, cropBoxRef]);
  return <canvas ref={canvasRef} className="w-full h-full object-cover" />;
}
