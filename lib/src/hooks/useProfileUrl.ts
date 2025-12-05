import { useState, useEffect, useCallback } from 'react';

/**
 * Hook for managing profile viewing via URL hash
 *
 * URL format: #profile=did:key:z6Mk...
 *
 * This allows profiles to be shared via URL and deep-linked.
 */
export function useProfileUrl() {
  const [profileDid, setProfileDid] = useState<string | null>(null);

  // Parse profile DID from hash on mount and hash changes
  useEffect(() => {
    const parseHash = () => {
      const hash = window.location.hash;
      const match = hash.match(/profile=([^&]+)/);
      if (match) {
        const did = decodeURIComponent(match[1]);
        setProfileDid(did);
      } else {
        setProfileDid(null);
      }
    };

    parseHash();
    window.addEventListener('hashchange', parseHash);
    return () => window.removeEventListener('hashchange', parseHash);
  }, []);

  /**
   * Open a profile by setting the URL hash
   */
  const openProfile = useCallback((did: string) => {
    const hash = window.location.hash;

    // Preserve existing hash parameters (like doc=...)
    if (hash.includes('profile=')) {
      // Replace existing profile parameter
      const newHash = hash.replace(/profile=[^&]+/, `profile=${encodeURIComponent(did)}`);
      window.location.hash = newHash;
    } else if (hash) {
      // Add profile parameter to existing hash
      window.location.hash = `${hash}&profile=${encodeURIComponent(did)}`;
    } else {
      // New hash with just profile
      window.location.hash = `profile=${encodeURIComponent(did)}`;
    }

    setProfileDid(did);
  }, []);

  /**
   * Close the profile by removing it from the URL hash
   */
  const closeProfile = useCallback(() => {
    const hash = window.location.hash;

    if (hash.includes('profile=')) {
      // Remove profile parameter
      let newHash = hash
        .replace(/&?profile=[^&]+/, '')
        .replace(/^#&/, '#')
        .replace(/&#/, '#');

      // Clean up empty hash
      if (newHash === '#' || newHash === '') {
        // If only doc= remains, keep it; otherwise clear
        history.replaceState(null, '', window.location.pathname + window.location.search + (newHash === '#' ? '' : newHash));
      } else {
        window.location.hash = newHash;
      }
    }

    setProfileDid(null);
  }, []);

  return {
    /** Currently open profile DID (null if no profile open) */
    profileDid,
    /** Open a profile (sets URL hash) */
    openProfile,
    /** Close the current profile (removes from URL hash) */
    closeProfile,
    /** Whether a profile is currently open */
    isProfileOpen: profileDid !== null,
  };
}
