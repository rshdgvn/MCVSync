import { useEffect, useRef, useState, type FormEvent } from "react";
import { Camera, Keyboard, ScanLine, Square } from "lucide-react";
import { FormError } from "@/components/FormError";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useBarcodeScanner } from "@/hooks/useBarcodeScanner";
import type { ScannerMode, UseBarcodeScannerOptions } from "@/lib/scanner/types";
import { cn } from "@/lib/utils";
import { useScanSessionStore } from "@/stores/scanSession.store";

export interface ScanEvent {
  value: string;
  mode: ScannerMode;
}

type Flash = "success" | "error" | null;

interface ScanInputProps {
  onScan: (scan: ScanEvent) => void | Promise<void>;
  options?: UseBarcodeScannerOptions;
  placeholder?: string;
}

const FLASH_DURATION_MS = 600;

const FLASH_CLASS: Record<Exclude<Flash, null>, string> = {
  success: "border-success ring-3 ring-success/20",
  error: "border-danger ring-3 ring-danger/20",
};

export function ScanInput({ onScan, options, placeholder = "Scan or type a barcode" }: ScanInputProps) {
  const scanner = useBarcodeScanner(options);
  const { mode, setMode, start, stop, isScanning, lastError, videoRef, onScan: subscribe } = scanner;
  const [manualCode, setManualCode] = useState("");
  const [flash, setFlash] = useState<Flash>(null);
  const flashTimer = useRef<number | undefined>(undefined);
  const enterSession = useScanSessionStore((state) => state.enter);
  const leaveSession = useScanSessionStore((state) => state.leave);

  useEffect(() => {
    enterSession();
    return leaveSession;
  }, [enterSession, leaveSession]);

  function showFlash(next: Exclude<Flash, null>) {
    window.clearTimeout(flashTimer.current);
    setFlash(next);
    flashTimer.current = window.setTimeout(() => setFlash(null), FLASH_DURATION_MS);
  }

  useEffect(() => {
    return subscribe(async (code) => {
      setManualCode("");
      showFlash("success");
      await onScan({ value: code, mode });
    });
  }, [subscribe, onScan, mode]);

  useEffect(() => {
    if (lastError) {
      showFlash("error");
    }
  }, [lastError]);

  useEffect(() => {
    if (mode === "usb") {
      start();
    }
  }, [mode, start]);

  useEffect(() => () => window.clearTimeout(flashTimer.current), []);

  function submitManual(event: FormEvent) {
    event.preventDefault();
    const value = manualCode.trim();
    if (!value) {
      return;
    }
    setManualCode("");
    showFlash("success");
    void onScan({ value, mode: "usb" });
  }

  function toggleMode(next: ScannerMode) {
    setMode(next);
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span
          className={cn(
            "inline-flex items-center gap-1.5 text-xs font-medium",
            isScanning ? "text-success" : "text-muted-foreground",
          )}
        >
          {mode === "usb" ? <Keyboard className="size-3.5" /> : <Camera className="size-3.5" />}
          {mode === "usb" ? (isScanning ? "USB scanner ready" : "USB scanner paused") : isScanning ? "Camera active" : "Camera off"}
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => toggleMode(mode === "usb" ? "camera" : "usb")}
        >
          {mode === "usb" ? <Camera /> : <Keyboard />}
          {mode === "usb" ? "Use Camera" : "Use USB Scanner"}
        </Button>
      </div>

      <form onSubmit={submitManual} className="flex gap-2">
        <div className="relative min-w-0 flex-1">
          <ScanLine className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-faint" />
          <Input
            aria-label="Barcode"
            autoComplete="off"
            enterKeyHint="go"
            placeholder={placeholder}
            value={manualCode}
            onChange={(event) => setManualCode(event.target.value)}
            className={cn("h-12 pl-9 font-mono transition-[border-color,box-shadow] duration-100 md:h-9", flash && FLASH_CLASS[flash])}
          />
        </div>
        <Button type="submit" variant="outline" className="h-12 md:h-9">
          Add
        </Button>
      </form>

      {mode === "camera" && (
        <div className="space-y-2">
          <video ref={videoRef} className="aspect-video w-full bg-foreground object-cover" muted playsInline />
          {isScanning ? (
            <Button type="button" variant="outline" className="h-12 w-full md:h-9" onClick={stop}>
              <Square />
              Stop Camera
            </Button>
          ) : (
            <Button type="button" className="h-12 w-full md:h-9" onClick={start}>
              <Camera />
              Start Camera Scan
            </Button>
          )}
        </div>
      )}

      <FormError message={lastError} />
    </div>
  );
}
