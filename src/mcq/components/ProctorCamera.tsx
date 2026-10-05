import { useState, useEffect, useRef, useCallback } from "react";
import * as faceapi from "face-api.js";
import { Camera, AlertTriangle, Eye, Minimize2, Maximize2, GripVertical, Monitor } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { ViolationType } from "@/mcq/lib/types";

interface ProctorCameraProps {
  warningLimit: number;
  warningCount: number;
  onWarning: (violationType: ViolationType, screenshot?: string) => void;
  screenStream?: MediaStream | null;
}

// Floating webcam widget with face detection (face-api.js tiny detector) and
// screen-share capture. Raises warnings for no/multiple faces, tab switches
// and stopped screen sharing. Model weights live in /public/models.
export default function ProctorCamera({ warningLimit, warningCount, onWarning, screenStream }: ProctorCameraProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const screenVideoRef = useRef<HTMLVideoElement | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const modelLoadedRef = useRef(false);
  const multiFaceTimerRef = useRef<number | null>(null);
  const noFaceTimerRef = useRef<number | null>(null);
  const onWarningRef = useRef(onWarning);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragOffset = useRef({ x: 0, y: 0 });

  const [cameraActive, setCameraActive] = useState(false);
  const [screenShareActive, setScreenShareActive] = useState(false);
  const [flashRed, setFlashRed] = useState(false);
  const [faceStatus, setFaceStatus] = useState<"ok" | "no_face" | "multiple">("ok");
  const [minimized, setMinimized] = useState(false);
  const [position, setPosition] = useState(() => ({ x: Math.max(0, window.innerWidth - 176), y: Math.max(0, window.innerHeight - 160) }));
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    onWarningRef.current = onWarning;
  }, [onWarning]);

  const triggerFlash = useCallback(() => {
    setFlashRed(true);
    setTimeout(() => setFlashRed(false), 800);
  }, []);

  const captureScreenshot = useCallback((): string | undefined => {
    const screenVideo = screenVideoRef.current;
    if (!screenVideo || screenVideo.readyState < 2) return undefined;
    try {
      const canvas = document.createElement("canvas");
      canvas.width = screenVideo.videoWidth || 1280;
      canvas.height = screenVideo.videoHeight || 720;
      const ctx = canvas.getContext("2d");
      if (!ctx) return undefined;
      ctx.drawImage(screenVideo, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL("image/png");
    } catch {
      return undefined;
    }
  }, []);

  const warn = useCallback((type: ViolationType) => {
    triggerFlash();
    onWarningRef.current(type, captureScreenshot());
  }, [captureScreenshot, triggerFlash]);

  // Expose the capture to the page so copy/paste violations can attach a screenshot too.
  useEffect(() => {
    (window as unknown as { __mcqCaptureScreenshot?: () => string | undefined }).__mcqCaptureScreenshot = captureScreenshot;
    return () => {
      delete (window as unknown as { __mcqCaptureScreenshot?: () => string | undefined }).__mcqCaptureScreenshot;
    };
  }, [captureScreenshot]);

  const runDetection = useCallback(async () => {
    const video = videoRef.current;
    if (!video || video.readyState < 2 || !modelLoadedRef.current) return;
    try {
      const detections = await faceapi.detectAllFaces(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.4 }));
      const count = detections.length;
      if (count === 0) {
        setFaceStatus("no_face");
        multiFaceTimerRef.current = null;
        if (noFaceTimerRef.current === null) noFaceTimerRef.current = Date.now();
        else if (Date.now() - noFaceTimerRef.current >= 3000) {
          warn("no_face");
          noFaceTimerRef.current = Date.now();
        }
      } else if (count > 1) {
        setFaceStatus("multiple");
        noFaceTimerRef.current = null;
        if (multiFaceTimerRef.current === null) multiFaceTimerRef.current = Date.now();
        else if (Date.now() - multiFaceTimerRef.current >= 3000) {
          warn("multiple_faces");
          multiFaceTimerRef.current = Date.now();
        }
      } else {
        setFaceStatus("ok");
        multiFaceTimerRef.current = null;
        noFaceTimerRef.current = null;
      }
    } catch {
      /* detection errors are transient */
    }
  }, [warn]);

  const detectionRef = useRef(runDetection);
  useEffect(() => {
    detectionRef.current = runDetection;
  }, [runDetection]);

  useEffect(() => {
    let mounted = true;
    const initCamera = async () => {
      try {
        await faceapi.nets.tinyFaceDetector.loadFromUri("/models");
        modelLoadedRef.current = true;
      } catch (err) {
        console.error("[ProctorCamera] Failed to load face detection model:", err);
        if (mounted) onWarningRef.current("camera_lost");
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 320, height: 240, facingMode: "user" } });
        if (!mounted) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setCameraActive(true);
        intervalRef.current = setInterval(() => { if (mounted) detectionRef.current(); }, 1000);
      } catch {
        if (mounted) onWarningRef.current("camera_lost");
      }
    };
    const startTimer = setTimeout(initCamera, 2000);
    return () => {
      mounted = false;
      clearTimeout(startTimer);
      if (intervalRef.current) clearInterval(intervalRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  useEffect(() => {
    if (!screenStream) return;
    let mounted = true;
    const hiddenVideo = document.createElement("video");
    hiddenVideo.srcObject = screenStream;
    hiddenVideo.muted = true;
    hiddenVideo.playsInline = true;
    hiddenVideo.play().then(() => {
      if (!mounted) return;
      screenVideoRef.current = hiddenVideo;
      setScreenShareActive(true);
    }).catch(() => {});
    const track = screenStream.getVideoTracks()[0];
    const onEnded = () => {
      if (!mounted) return;
      setScreenShareActive(false);
      screenVideoRef.current = null;
      onWarningRef.current("screen_share_stopped");
    };
    track?.addEventListener("ended", onEnded);
    return () => {
      mounted = false;
      track?.removeEventListener("ended", onEnded);
      hiddenVideo.pause();
      hiddenVideo.srcObject = null;
      screenVideoRef.current = null;
      setScreenShareActive(false);
    };
  }, [screenStream]);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden && cameraActive) warn("tab_switch");
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [cameraActive, warn]);

  const handlePointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("button")) return;
    e.preventDefault();
    setIsDragging(true);
    const rect = containerRef.current?.getBoundingClientRect();
    if (rect) dragOffset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };
  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    e.preventDefault();
    setPosition({
      x: Math.max(0, Math.min(window.innerWidth - 60, e.clientX - dragOffset.current.x)),
      y: Math.max(0, Math.min(window.innerHeight - 40, e.clientY - dragOffset.current.y)),
    });
  };

  const remaining = warningLimit - warningCount;
  const isHighRisk = remaining <= 2;

  return (
    <div
      ref={containerRef}
      className="fixed z-50 select-none touch-none"
      style={{ left: `${position.x}px`, top: `${position.y}px` }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={() => setIsDragging(false)}
      data-testid="proctor-camera-container"
    >
      <div className={`relative rounded-lg overflow-hidden border-2 shadow-lg transition-colors bg-black ${flashRed ? "border-destructive" : isHighRisk ? "border-amber-500" : "border-border"}`}>
        <div className="flex items-center justify-between px-1.5 py-0.5 bg-black/80 cursor-grab active:cursor-grabbing">
          <div className="flex items-center gap-1">
            <GripVertical className="w-3 h-3 text-white/60" />
            {cameraActive ? (
              <Badge variant="default" className="text-[9px] px-1 py-0 bg-chart-2 hover:bg-chart-2"><Eye className="w-2.5 h-2.5 mr-0.5" />LIVE</Badge>
            ) : (
              <Badge variant="destructive" className="text-[9px] px-1 py-0"><Camera className="w-2.5 h-2.5 mr-0.5" />LOADING</Badge>
            )}
            {screenShareActive ? (
              <Badge variant="default" className="text-[9px] px-1 py-0 bg-blue-600 hover:bg-blue-600" data-testid="badge-screen-share-active"><Monitor className="w-2.5 h-2.5 mr-0.5" />SCREEN</Badge>
            ) : (
              <Badge variant="secondary" className="text-[9px] px-1 py-0 opacity-60" data-testid="badge-screen-share-off"><Monitor className="w-2.5 h-2.5 mr-0.5" />NO SCR</Badge>
            )}
          </div>
          <div className="flex items-center gap-1">
            <div className={`w-2.5 h-2.5 rounded-full border border-white/50 ${faceStatus === "ok" ? "bg-green-500" : "bg-red-500"}`} data-testid="face-status-indicator" />
            <button type="button" onClick={(e) => { e.stopPropagation(); setMinimized(!minimized); }} className="p-0.5 rounded hover:bg-white/20 transition-colors" aria-label={minimized ? "Expand camera" : "Minimize camera"} data-testid="button-toggle-minimize">
              {minimized ? <Maximize2 className="w-3 h-3 text-white/80" /> : <Minimize2 className="w-3 h-3 text-white/80" />}
            </button>
          </div>
        </div>

        <div className="relative" style={minimized ? { position: "absolute", left: "-9999px", top: "-9999px" } : undefined}>
          <video ref={videoRef} className="w-40 h-[120px] sm:w-44 sm:h-[132px] object-cover bg-black" muted playsInline data-testid="proctor-video" />
          {flashRed && <div className="absolute inset-0 bg-destructive/30 animate-pulse" />}
          {faceStatus === "multiple" && <div className="absolute top-1 right-1 bg-red-600 text-white text-[8px] px-1 rounded">Multiple people</div>}
          {faceStatus === "no_face" && <div className="absolute top-1 right-1 bg-red-600 text-white text-[8px] px-1 rounded">No face</div>}
        </div>

        <div className={`flex items-center justify-between text-[9px] px-1.5 py-0.5 ${isHighRisk ? "bg-destructive/80 text-destructive-foreground" : "bg-black/80 text-white"}`}>
          <span className="flex items-center gap-0.5"><AlertTriangle className="w-2.5 h-2.5" />{warningCount}/{warningLimit}</span>
          <span data-testid="text-proctor-remaining">{remaining > 0 ? `${remaining} left` : "EXCEEDED"}</span>
        </div>
      </div>
    </div>
  );
}

export function captureProctorScreenshot(): string | undefined {
  return (window as unknown as { __mcqCaptureScreenshot?: () => string | undefined }).__mcqCaptureScreenshot?.();
}
