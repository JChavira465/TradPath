"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";

export function SignaturePad({
  label,
  onSave,
  saving,
}: {
  label: string;
  onSave: (blob: Blob) => void;
  saving?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const [hasStrokes, setHasStrokes] = useState(false);

  const getPoint = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const ctx = canvasRef.current!.getContext("2d")!;
    const { x, y } = getPoint(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    drawingRef.current = true;
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    const ctx = canvasRef.current!.getContext("2d")!;
    const { x, y } = getPoint(e);
    ctx.lineTo(x, y);
    ctx.strokeStyle = "#1B2A4A";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.stroke();
    setHasStrokes(true);
  };

  const stopDrawing = () => {
    drawingRef.current = false;
  };

  const clear = () => {
    const canvas = canvasRef.current!;
    canvas.getContext("2d")!.clearRect(0, 0, canvas.width, canvas.height);
    setHasStrokes(false);
  };

  const save = () => {
    canvasRef.current!.toBlob((blob) => {
      if (blob) onSave(blob);
    }, "image/png");
  };

  return (
    <div>
      <p className="mb-2 text-sm font-medium text-gray-700">{label}</p>
      <canvas
        ref={canvasRef}
        width={500}
        height={180}
        className="w-full touch-none rounded-md border border-gray-300 bg-white"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={stopDrawing}
        onPointerLeave={stopDrawing}
      />
      <div className="mt-2 flex justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={clear}>
          Clear
        </Button>
        <Button type="button" size="sm" onClick={save} disabled={!hasStrokes || saving}>
          {saving ? "Saving…" : "Save Signature"}
        </Button>
      </div>
    </div>
  );
}
