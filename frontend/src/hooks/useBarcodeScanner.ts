import { useEffect, useRef } from 'react';

/**
 * Detects USB/Bluetooth barcode scanner input.
 * Scanners send keystrokes very quickly (<100ms between chars) and press Enter at the end.
 * This hook captures that burst and calls onScan with the full barcode string.
 */
export function useBarcodeScanner(onScan: (barcode: string) => void, enabled = true) {
  const buffer = useRef('');
  const lastKeyTime = useRef(0);

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const now = Date.now();
      const timeDiff = now - lastKeyTime.current;

      // If too much time passed, reset buffer (user typing, not scanner)
      if (timeDiff > 500 && buffer.current.length > 0) {
        buffer.current = '';
      }

      lastKeyTime.current = now;

      if (e.key === 'Enter') {
        const code = buffer.current.trim();
        if (code.length >= 3) {
          onScan(code);
        }
        buffer.current = '';
        return;
      }

      // Only capture printable characters
      if (e.key.length === 1) {
        buffer.current += e.key;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onScan, enabled]);
}
