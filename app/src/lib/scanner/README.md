# Barcode Scanning

Reusable scanning foundation. It gives you a barcode string reliably from either a USB HID
scanner (keyboard wedge) or a device camera — nothing about what that string *means* is this
module's job. Barcode-to-record lookups, "is this a known item," inventory/order side effects —
that all belongs in the feature that consumes a scan, not here.

## Quick start

```tsx
import { useCallback } from "react";
import { ScanInput } from "@/components/ScanInput";

function ReceiveStockPanel() {
  const handleScan = useCallback(async ({ value }: { value: string }) => {
    await api.post("/staff/stock/receive", { barcode: value });
  }, []);

  return <ScanInput onScan={handleScan} />;
}
```

`onScan` may be sync or return a `Promise`. While it's pending, `isProcessing` is `true` and new
scans are dropped rather than queued — one scan is handled at a time.

Need the raw hook instead of the prebuilt ScanInput (custom UI, multiple subscribers, etc.)?

```tsx
import { useEffect } from "react";
import { useBarcodeScanner } from "@/hooks/useBarcodeScanner";

function CustomScanner() {
  const scanner = useBarcodeScanner({ mode: "usb" });

  useEffect(() => scanner.onScan((barcode) => console.log(barcode)), [scanner.onScan]);

  return (
    <button onClick={scanner.isScanning ? scanner.stop : scanner.start}>
      {scanner.isScanning ? "Stop" : "Start"}
    </button>
  );
}
```

## How USB detection works

A USB HID scanner is, to the browser, just a very fast typist. `usbScanner.ts` tells the two
apart by timing, not by any special API:

- A keystroke belongs to the current burst only if it arrives within `maxInterKeyDelayMs`
  (default 50ms) of the previous one. Anything slower resets the buffer — this is what stops
  normal human typing from ever accumulating into a false scan, with no need to special-case
  which element is focused.
- A burst ends on `Enter` (only if it arrived fast enough to actually be part of the burst) or
  after `scanTimeoutMs` (default 150ms) of silence following a valid fast burst — covers
  scanners configured without a terminator keystroke.
- `minLength` (default 3) gates against noise.

The engine listens on `document` in the capture phase, and only while `start()` has been called
— it's opt-in, not a permanent global listener. The one side effect it takes on your page: it
calls `preventDefault()` on the terminating `Enter` of a recognized scan, so a wedge scanner
doesn't accidentally submit whatever form happens to be focused. It never touches the individual
character keystrokes, so if an input is focused, the scanned characters still land in it exactly
like normal typing would.

## How camera detection works

Native `BarcodeDetector` where the browser has it; `@zxing/browser` (wraps `@zxing/library`)
everywhere else — Firefox and Safari don't ship the native API. Camera permission is requested
only inside `start()`, never eagerly. `stop()` always releases the underlying
`MediaStreamTrack`s, so the camera indicator light actually turns off.

## Configuration

```ts
useBarcodeScanner({
  mode: "usb",                    // "usb" | "camera", default "usb"
  usb: {
    minLength: 3,
    maxInterKeyDelayMs: 50,
    scanTimeoutMs: 150,
    endKey: "Enter",
  },
  camera: {
    preferredDeviceId: undefined, // falls back to facingMode: "environment"
    stopOnSuccess: true,
  },
  duplicateIntervalMs: 1500,      // identical scans within this window are ignored
  beepOnScan: true,
  vibrateOnScan: true,
  validate: (code) => true,       // return `true`, or a string error message to reject
});
```

`validate` defaults to a generic check (trimmed, 3–64 characters, non-empty) — override it per
module once you know the real format you're expecting (SKU pattern, checksum, etc.).

## Adding scanning to a new module

1. Call `useBarcodeScanner()` (or drop in `<ScanInput />` if the default UI is enough)
   where you need a scan.
2. Pass a `validate` function once your module knows what a valid code looks like for that
   screen — don't loosen the shared default, override it locally.
3. Handle the scanned code in `onScan` — look it up, mutate state, call your API. Return a
   promise if it's async so `isProcessing`/duplicate-prevention work correctly.
4. If you memoize `validate` or the `options` object you pass in, use `useCallback`/`useMemo` —
   the hook re-subscribes its internal handler whenever these change identity.
