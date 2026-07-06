"use client";

import { useRef, useState } from "react";

const BAR_COUNT = 24;

export function VoiceRecorder({ onRecorded, disabled }: { onRecorded: (blob: Blob) => void; disabled?: boolean }) {
  const [isRecording, setIsRecording] = useState(false);
  const [levels, setLevels] = useState<number[]>(Array(BAR_COUNT).fill(0.05));
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const startRecording = async () => {
    if (disabled || isRecording) return;
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];

      const audioCtx = new AudioContext();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      source.connect(analyser);
      audioCtxRef.current = audioCtx;

      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteFrequencyData(data);
        setLevels(
          Array.from({ length: BAR_COUNT }, (_, i) => {
            const idx = Math.floor((i / BAR_COUNT) * data.length);
            return Math.max(0.08, data[idx] / 255);
          }),
        );
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();

      const recorder = new MediaRecorder(stream);
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        onRecorded(blob);
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
    } catch {
      setError("Microphone access is required to record a voice memo.");
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    if (!isRecording) return;
    mediaRecorderRef.current?.stop();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    audioCtxRef.current?.close();
    setIsRecording(false);
    setLevels(Array(BAR_COUNT).fill(0.05));
  };

  return (
    <div className="flex flex-col items-center gap-4 py-4">
      <button
        type="button"
        disabled={disabled}
        onMouseDown={startRecording}
        onMouseUp={stopRecording}
        onMouseLeave={stopRecording}
        onTouchStart={(e) => {
          e.preventDefault();
          startRecording();
        }}
        onTouchEnd={(e) => {
          e.preventDefault();
          stopRecording();
        }}
        className={`flex h-24 w-24 select-none items-center justify-center rounded-full text-3xl text-white shadow-lg transition-transform disabled:cursor-not-allowed disabled:opacity-40 ${
          isRecording ? "scale-110 bg-red-600" : "bg-brand"
        }`}
      >
        {isRecording ? "■" : "🎙"}
      </button>
      <p className="text-xs text-gray-500">{isRecording ? "Release to stop…" : "Hold to record"}</p>
      <div className="flex h-12 items-end gap-1" aria-hidden>
        {levels.map((level, i) => (
          <div
            key={i}
            className="w-1.5 rounded-full bg-brand transition-all"
            style={{ height: `${Math.max(6, level * 48)}px`, opacity: isRecording ? 1 : 0.25 }}
          />
        ))}
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
