/**
 * UserDocLoader - Invisible component that loads a UserDocument
 *
 * Uses useDocument for reactive updates and reports status via callbacks.
 * This component renders nothing (returns null) - it only manages document loading.
 */

import { useEffect, useRef } from 'react';
import { useDocument, useDocHandle } from '@automerge/automerge-repo-react-hooks';
import type { AutomergeUrl } from '@automerge/automerge-repo';
import type { UserDocument } from '../schema/userDocument';
import type { UserDocLoaderProps } from '../providers/types';

/**
 * Invisible component that loads a UserDocument and reports its state.
 *
 * Uses useDocument for reactive updates - when the document changes,
 * the onLoaded callback is called with the updated profile data.
 */
export function UserDocLoader({
  url,
  expectedDid,
  source,
  onLoaded,
  onUnavailable,
}: UserDocLoaderProps) {
  // Track if we've already reported unavailable (to avoid duplicate calls)
  const reportedUnavailableRef = useRef(false);
  const lastReportedProfileRef = useRef<string | null>(null);

  // Use the standard hooks - useDocument returns [doc, changeDoc] or [undefined, noop]
  const [doc] = useDocument<UserDocument>(url as AutomergeUrl);
  const handle = useDocHandle<UserDocument>(url as AutomergeUrl);

  // Effect to detect UNAVAILABLE state from handle
  useEffect(() => {
    if (!handle) return;

    // Check for unavailable state by polling (events not reliably typed)
    const checkState = () => {
      // DocHandle state can be: 'idle' | 'loading' | 'requesting' | 'ready' | 'unavailable' | 'deleted'
      const state = (handle as unknown as { state?: string }).state;
      if (state === 'unavailable' && !reportedUnavailableRef.current) {
        reportedUnavailableRef.current = true;
        onUnavailable(url);
      }
    };

    // Check immediately
    checkState();

    // Poll periodically for state changes (the 'unavailable' event isn't in typed API)
    const interval = setInterval(checkState, 1000);

    return () => {
      clearInterval(interval);
    };
  }, [handle, url, onUnavailable]);

  // Effect to report loaded document and react to profile changes
  useEffect(() => {
    if (!doc) return;

    const docDid = doc.did;

    // Validate expectedDid if provided
    if (expectedDid && docDid !== expectedDid) {
      console.warn(
        `[UserDocLoader] DID mismatch for ${url.substring(0, 30)}: expected ${expectedDid.substring(0, 20)}, got ${docDid?.substring(0, 20)}`
      );
      // Still report it - the provider can decide what to do
    }

    // Create a stable key for change detection
    const profileKey = JSON.stringify({
      did: docDid,
      displayName: doc.profile?.displayName,
      avatarUrl: doc.profile?.avatarUrl,
      updatedAt: doc.profile?.updatedAt,
      signature: doc.profile?.signature,
    });

    // Only report if profile data has changed
    if (profileKey !== lastReportedProfileRef.current) {
      lastReportedProfileRef.current = profileKey;

      onLoaded(url, docDid, {
        displayName: doc.profile?.displayName,
        avatarUrl: doc.profile?.avatarUrl,
        updatedAt: doc.profile?.updatedAt,
        signature: doc.profile?.signature,
      });
    }
  }, [doc, url, expectedDid, onLoaded, doc?.profile?.displayName, doc?.profile?.avatarUrl, doc?.profile?.updatedAt, doc?.profile?.signature]);

  // This component renders nothing - it's invisible
  return null;
}
