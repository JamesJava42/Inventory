'use client';
import { useEffect, useRef, useState } from 'react';

interface Props {
  onDetected: (upc: string) => void;
  onClose: () => void;
}

export default function BarcodeScanner({ onDetected, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(true);
  const detectedRef = useRef(false);

  useEffect(() => {
    let codeReader: import('@zxing/browser').BrowserMultiFormatReader | null = null;
    let stream: MediaStream | null = null;

    const start = async () => {
      try {
        const { BrowserMultiFormatReader } = await import('@zxing/browser');
        codeReader = new BrowserMultiFormatReader();

        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        });

        if (!videoRef.current) return;
        videoRef.current.srcObject = stream;
        await videoRef.current.play();

        codeReader.decodeFromVideoElement(videoRef.current, (result, err) => {
          if (result && !detectedRef.current) {
            detectedRef.current = true;
            setScanning(false);
            onDetected(result.getText());
          }
        });
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        if (msg.includes('Permission') || msg.includes('NotAllowed')) {
          setError('Camera permission denied. Allow camera access and try again.');
        } else {
          setError('Camera unavailable. Make sure no other app is using it.');
        }
      }
    };

    start();

    return () => {
      if (stream) stream.getTracks().forEach(t => t.stop());
      // BrowserMultiFormatReader cleanup handled via stream tracks above
    };
  }, [onDetected]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black" onClick={e => e.stopPropagation()}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3">
        <p className="text-sm font-medium text-slate-300">
          {scanning ? 'Point at a barcode…' : 'Barcode detected'}
        </p>
        <button onClick={onClose} className="rounded-full bg-slate-800 px-3 py-1 text-sm text-slate-300 hover:text-white">
          Cancel
        </button>
      </div>

      {/* Viewfinder */}
      <div className="relative flex-1 overflow-hidden">
        <video ref={videoRef} playsInline muted className="h-full w-full object-cover" />

        {/* Scan guide */}
        {scanning && !error && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="relative h-40 w-72">
              {/* Corner brackets */}
              {['top-left', 'top-right', 'bottom-left', 'bottom-right'].map(pos => (
                <div key={pos} className={`absolute h-8 w-8 border-amber-400 border-2 ${
                  pos === 'top-left'     ? 'top-0 left-0 border-r-0 border-b-0' :
                  pos === 'top-right'    ? 'top-0 right-0 border-l-0 border-b-0' :
                  pos === 'bottom-left'  ? 'bottom-0 left-0 border-r-0 border-t-0' :
                                          'bottom-0 right-0 border-l-0 border-t-0'
                }`} />
              ))}
              {/* Scan line animation */}
              <div className="absolute left-2 right-2 top-1/2 h-0.5 animate-pulse bg-amber-400/70" />
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80 px-8">
            <div className="text-center">
              <p className="text-2xl mb-2">📷</p>
              <p className="text-sm text-red-400">{error}</p>
              <button onClick={onClose}
                className="mt-4 rounded-lg bg-slate-700 px-4 py-2 text-sm text-slate-100 hover:bg-slate-600">
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
