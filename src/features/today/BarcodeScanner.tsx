import { useEffect, useRef, useState } from 'react';
import { IconBarcode, IconCamera } from '../../components/icons';

type BarcodeScannerProps = {
  busy: boolean;
  onDetected: (code: string) => void;
};

type ScannerControls = { stop: () => void };

type BarcodeDetectorLike = {
  detect: (source: HTMLVideoElement) => Promise<{ rawValue: string }[]>;
};

type BarcodeDetectorConstructor = new (options?: {
  formats?: string[];
}) => BarcodeDetectorLike;

const FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128'];

export function BarcodeScanner({ busy, onDetected }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const controlsRef = useRef<ScannerControls | null>(null);
  const timerRef = useRef<number | null>(null);
  const doneRef = useRef(false);
  const startingRef = useRef(false);
  const mountedRef = useRef(true);
  const onDetectedRef = useRef(onDetected);
  onDetectedRef.current = onDetected;

  const [manual, setManual] = useState('');
  const [error, setError] = useState('');
  const [status, setStatus] = useState(
    'Camera is off. Start the camera or enter the barcode below.'
  );
  const [cameraOn, setCameraOn] = useState(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      stopCameraTracks();
    };
  }, []);

  function stopCameraTracks() {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = null;
    controlsRef.current?.stop();
    controlsRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }

  function stopCamera() {
    stopCameraTracks();
    setCameraOn(false);
    setStatus('Camera stopped. Enter the barcode below.');
  }

  async function startCamera() {
    if (startingRef.current) return;
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Camera is not available in this browser. Enter the barcode below.');
      return;
    }

    startingRef.current = true;
    doneRef.current = false;
    setError('');
    setCameraOn(true);
    setStatus('Starting camera…');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false
      });

      if (!mountedRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) {
        stream.getTracks().forEach((track) => track.stop());
        setCameraOn(false);
        setStatus('Camera is not ready. Enter the barcode below.');
        return;
      }

      video.srcObject = stream;
      await video.play().catch(() => undefined);
      setStatus('Point the camera at a barcode.');

      const Detector = (
        window as unknown as { BarcodeDetector?: BarcodeDetectorConstructor }
      ).BarcodeDetector;

      if (Detector) {
        const detector = new Detector({ formats: FORMATS });
        const scan = async () => {
          if (
            !mountedRef.current ||
            doneRef.current ||
            !videoRef.current ||
            !streamRef.current
          ) {
            return;
          }
          try {
            const codes = await detector.detect(videoRef.current);
            const value = codes[0]?.rawValue?.replace(/\D/g, '');
            if (value && value.length >= 8 && value.length <= 14) {
              doneRef.current = true;
              onDetectedRef.current(value);
              return;
            }
          } catch {
            // A single failed frame is normal; keep scanning.
          }
          timerRef.current = window.setTimeout(scan, 280);
        };
        void scan();
      } else {
        setStatus('Scanning with the JavaScript fallback…');
        const { BrowserMultiFormatReader } = await import('@zxing/browser');
        if (!mountedRef.current) return;

        const reader = new BrowserMultiFormatReader();
        const controls = await reader.decodeFromVideoElement(video, (result) => {
          const value = result?.getText().replace(/\D/g, '');
          if (value && value.length >= 8 && value.length <= 14 && !doneRef.current) {
            doneRef.current = true;
            onDetectedRef.current(value);
          }
        });
        controlsRef.current = controls;
      }
    } catch {
      if (!mountedRef.current) return;
      stopCameraTracks();
      setCameraOn(false);
      setError(
        'Camera permission was not granted. You can still type the barcode below.'
      );
      setStatus('Enter the barcode manually.');
    } finally {
      startingRef.current = false;
    }
  }

  function submitManual(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const code = manual.replace(/\D/g, '');
    if (!/^\d{8,14}$/.test(code)) {
      setError('Enter an 8 to 14 digit barcode.');
      return;
    }
    setError('');
    doneRef.current = true;
    onDetected(code);
  }

  return (
    <div className="barcode-scanner">
      <div className="barcode-video-wrap" hidden={!cameraOn}>
        <video
          ref={videoRef}
          className="barcode-video"
          muted
          playsInline
          aria-label="Camera preview for barcode scanning"
        />
        <div className="barcode-frame" aria-hidden="true" />
        <button type="button" className="btn btn-ghost btn-small" onClick={stopCamera}>
          Stop camera
        </button>
      </div>

      {!cameraOn ? (
        <button type="button" className="btn btn-ghost btn-block" onClick={startCamera}>
          <IconCamera size={16} /> Start camera
        </button>
      ) : null}

      <p className="scanner-status" role="status">
        {busy ? 'Looking up barcode…' : status}
      </p>

      <form className="form barcode-manual" onSubmit={submitManual} noValidate>
        <label className="field">
          <span className="field-label">
            <IconBarcode size={15} /> Barcode number
          </span>
          <span className="unit-input">
            <input
              value={manual}
              onChange={(event) => {
                setManual(event.target.value);
                setError('');
              }}
              inputMode="numeric"
              autoComplete="off"
              placeholder="0123456789012"
              aria-invalid={Boolean(error)}
            />
          </span>
          {error ? (
            <span className="field-error" role="alert">
              {error}
            </span>
          ) : null}
        </label>
        <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
          Look up barcode
        </button>
      </form>

      <p className="fine-print">
        Barcode data comes from Open Food Facts. If the product is missing, use search or
        create a custom food. Camera frames stay on this device.
      </p>
    </div>
  );
}
