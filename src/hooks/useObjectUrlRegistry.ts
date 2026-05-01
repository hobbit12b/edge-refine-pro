import { useCallback, useEffect, useRef } from 'react';

export function useObjectUrlRegistry() {
  const trackedUrlsRef = useRef<Set<string>>(new Set());

  const trackUrl = useCallback((url: string) => {
    trackedUrlsRef.current.add(url);
    return url;
  }, []);

  const createTrackedUrl = useCallback((blob: Blob) => {
    const url = URL.createObjectURL(blob);
    trackedUrlsRef.current.add(url);
    return url;
  }, []);

  const revokeUrl = useCallback((url: string) => {
    if (!trackedUrlsRef.current.has(url)) return;
    URL.revokeObjectURL(url);
    trackedUrlsRef.current.delete(url);
  }, []);

  const revokeUnused = useCallback((activeUrls: Iterable<string>) => {
    const activeSet = new Set(activeUrls);
    for (const url of trackedUrlsRef.current) {
      if (!activeSet.has(url)) {
        URL.revokeObjectURL(url);
        trackedUrlsRef.current.delete(url);
      }
    }
  }, []);

  const revokeAll = useCallback(() => {
    for (const url of trackedUrlsRef.current) {
      URL.revokeObjectURL(url);
    }
    trackedUrlsRef.current.clear();
  }, []);

  useEffect(() => revokeAll, [revokeAll]);

  return {
    trackUrl,
    createTrackedUrl,
    revokeUrl,
    revokeUnused,
    revokeAll,
  };
}
