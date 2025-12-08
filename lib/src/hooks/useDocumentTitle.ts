/**
 * useDocumentTitle - Dynamic browser title and favicon management
 *
 * Updates the browser tab title and favicon based on the current workspace.
 * Falls back to app defaults when no workspace is active.
 */

import { useEffect, useRef } from 'react';

export interface UseDocumentTitleOptions {
  /** Workspace name to display */
  workspaceName?: string;
  /** Workspace avatar URL (used as favicon if provided) */
  workspaceAvatar?: string;
  /** App name to show when no workspace is active */
  appName?: string;
  /** Default favicon URL (SVG or PNG) */
  defaultFaviconUrl?: string;
}

/**
 * Updates browser title and favicon based on workspace
 *
 * Title format: "WorkspaceName" or "AppName" if no workspace
 * Favicon: Workspace avatar if available, otherwise default
 */
export function useDocumentTitle({
  workspaceName,
  workspaceAvatar,
  appName = 'Web of Trust',
  defaultFaviconUrl,
}: UseDocumentTitleOptions): void {
  // Track original values for cleanup
  const originalTitle = useRef<string | null>(null);
  const originalFavicon = useRef<string | null>(null);
  const createdFaviconUrl = useRef<string | null>(null);

  useEffect(() => {
    // Store original title on first run
    if (originalTitle.current === null) {
      originalTitle.current = document.title;
    }

    // Update title
    const newTitle = workspaceName || appName;
    document.title = newTitle;

    // Cleanup on unmount - restore original title
    return () => {
      if (originalTitle.current) {
        document.title = originalTitle.current;
      }
    };
  }, [workspaceName, appName]);

  useEffect(() => {
    // Store original favicon on first run
    if (originalFavicon.current === null) {
      const existingFavicon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
      if (existingFavicon) {
        originalFavicon.current = existingFavicon.href;
      }
    }

    // Determine which favicon to use
    let faviconUrl: string | null = null;

    if (workspaceAvatar) {
      faviconUrl = workspaceAvatar;
    } else if (defaultFaviconUrl) {
      faviconUrl = defaultFaviconUrl;
    } else if (originalFavicon.current) {
      faviconUrl = originalFavicon.current;
    }

    if (faviconUrl) {
      // Remove ALL existing favicon links to force browser refresh
      const existingFavicons = document.querySelectorAll<HTMLLinkElement>('link[rel="icon"], link[rel="shortcut icon"]');
      existingFavicons.forEach(link => link.remove());

      // Create new favicon link element
      const newFavicon = document.createElement('link');
      newFavicon.rel = 'icon';
      // For data URLs (SVG), set type explicitly
      if (faviconUrl.startsWith('data:image/svg')) {
        newFavicon.type = 'image/svg+xml';
      }
      newFavicon.href = faviconUrl;
      document.head.appendChild(newFavicon);
    }

    // Cleanup on unmount
    return () => {
      // Revoke any created blob URLs
      if (createdFaviconUrl.current) {
        URL.revokeObjectURL(createdFaviconUrl.current);
        createdFaviconUrl.current = null;
      }
    };
  }, [workspaceAvatar, defaultFaviconUrl]);
}

/**
 * Generate a simple SVG favicon with a letter
 * Returns a data URL that can be used as favicon href
 */
export function generateLetterFavicon(letter: string, bgColor = '#e11d48'): string {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
      <rect width="32" height="32" rx="6" fill="${bgColor}"/>
      <text x="16" y="22" font-family="system-ui, sans-serif" font-size="18" font-weight="bold" fill="white" text-anchor="middle">${letter.toUpperCase()}</text>
    </svg>
  `.trim();

  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/**
 * Generate a home icon favicon (for start/no workspace state)
 * Green background with white house icon, matching the workspace switcher style
 */
export function generateHomeFavicon(): string {
  // House icon - centered in 32x32 box
  // The icon is drawn in a 20x20 space, scaled to ~24x24 and centered (offset 4,4)
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
      <rect width="32" height="32" rx="6" fill="#22c55e"/>
      <g transform="translate(4, 5) scale(1.2)">
        <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" fill="white"/>
      </g>
    </svg>
  `.trim();

  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
