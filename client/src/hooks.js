import { useCallback, useEffect, useRef, useState } from 'react';
import { get } from './api.js';

/** Charge une ressource ; expose { data, error, loading, reload, setData }. */
export function useFetch(path, deps = []) {
  const [state, setState] = useState({ data: null, error: null, loading: true });
  const ctrl = useRef();
  const load = useCallback(() => {
    if (!path) return;
    ctrl.current?.abort();
    ctrl.current = new AbortController();
    setState((s) => ({ ...s, loading: true, error: null }));
    get(path, { signal: ctrl.current.signal })
      .then((data) => setState({ data, error: null, loading: false }))
      .catch((error) => {
        if (error.name !== 'AbortError') setState({ data: null, error, loading: false });
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, ...deps]);
  useEffect(() => {
    load();
    return () => ctrl.current?.abort();
  }, [load]);
  const setData = (fn) => setState((s) => ({ ...s, data: typeof fn === 'function' ? fn(s.data) : fn }));
  return { ...state, reload: load, setData };
}

/** Chronomètre le temps passé (en secondes) depuis le montage ou le dernier reset. */
export function useStopwatch() {
  const start = useRef(Date.now());
  return {
    elapsed: () => Math.round((Date.now() - start.current) / 1000),
    reset: () => (start.current = Date.now()),
  };
}

export function useDocumentTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} — DESCOGEF Révision` : 'DESCOGEF Révision';
  }, [title]);
}

/** Envoie le temps passé sur une page à la fermeture/démontage (lecture de fiche, etc.). */
export function useTrackTime(send, minSec = 10) {
  const start = useRef(Date.now());
  const sendRef = useRef(send);
  sendRef.current = send;
  useEffect(() => {
    const flush = () => {
      const sec = Math.round((Date.now() - start.current) / 1000);
      if (sec >= minSec) sendRef.current(Math.min(sec, 4 * 3600));
      start.current = Date.now();
    };
    const onHide = () => document.visibilityState === 'hidden' && flush();
    document.addEventListener('visibilitychange', onHide);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      flush();
    };
  }, [minSec]);
}
