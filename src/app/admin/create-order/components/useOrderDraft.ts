'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { orderDraftWorthSaving, type OrderDraftContent } from '@/utils/createOrderDraft';

/**
 * The order being entered saves itself as a draft (shared with the other admins), the same way Communication messages do:
 * a moment after typing stops, when the tab is left, and when the page is closed. Nothing is saved for an untouched form.
 */
export function useOrderDraft(token: string | null, content: OrderDraftContent, enabled: boolean, onChanged: () => void) {
  const latest = useRef(content);
  latest.current = content;
  const idRef = useRef<string | null>(null);
  const lastSaved = useRef('');
  // just opened a draft: what is on screen now is what is saved, so opening must not save (it would change who saved it last)
  const adopted = useRef(false);
  const chain = useRef<Promise<void>>(Promise.resolve());
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;
  const [state, setState] = useState<{ status: 'idle' | 'saving' | 'saved' | 'error'; at?: string }>({ status: 'idle' });

  const save = useCallback(() => {
    chain.current = chain.current.then(async () => {
      if (!enabledRef.current || !token) return;
      const body = JSON.stringify(latest.current);
      if (adopted.current) {
        adopted.current = false;
        lastSaved.current = body;
        return;
      }
      if (body === lastSaved.current) return;
      if (!idRef.current && !orderDraftWorthSaving(latest.current)) return;
      setState((cur) => ({ ...cur, status: 'saving' }));
      for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
          const existing = idRef.current;
          const res = await fetch(existing ? `/api/admin/create-order-drafts/${existing}` : '/api/admin/create-order-drafts', {
            method: existing ? 'PUT' : 'POST',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body,
            cache: 'no-store',
            keepalive: body.length < 60_000,
          });
          const json = await res.json().catch(() => ({}));
          if (res.status === 404 && existing) {
            // deleted somewhere else: keep the work by starting a new draft
            idRef.current = null;
            continue;
          }
          if (!res.ok) throw new Error('save failed');
          if (!existing) idRef.current = json.data.id as string;
          lastSaved.current = body;
          setState({ status: 'saved', at: json.data.updatedAt as string });
          onChanged();
          return;
        } catch {
          break;
        }
      }
      setState((cur) => ({ status: 'error', at: cur.at }));
    });
  }, [token, onChanged]);

  const contentKey = JSON.stringify(content);
  useEffect(() => {
    if (!enabled) return;
    const t = setTimeout(save, 1500);
    return () => clearTimeout(t);
  }, [contentKey, enabled, save]);
  useEffect(() => {
    window.addEventListener('pagehide', save);
    return () => {
      window.removeEventListener('pagehide', save);
      save();
    };
  }, [save]);

  return {
    state,
    /** an opened draft: keep saving into it */
    adopt: (id: string, at?: string, by?: string) => {
      idRef.current = id;
      adopted.current = true;
      setState({ status: 'saved', at });
      void by;
    },
    /** the next thing typed starts a new draft */
    forget: () => {
      idRef.current = null;
      adopted.current = false;
      lastSaved.current = '';
      setState({ status: 'idle' });
    },
    /** the order was created: its draft is no longer needed */
    finish: () => {
      const id = idRef.current;
      idRef.current = null;
      adopted.current = false;
      lastSaved.current = '';
      setState({ status: 'idle' });
      if (id && token) {
        fetch(`/api/admin/create-order-drafts/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` }, keepalive: true }).catch(() => undefined).finally(onChanged);
      }
    },
    currentId: () => idRef.current,
  };
}
