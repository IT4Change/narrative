import { UserAvatar } from './UserAvatar';
import { processImageFile } from '../utils/imageProcessing';
import { loadSharedIdentity, saveSharedIdentity } from '../utils/storage';
import { useState, useEffect } from 'react';
import type { BaseDocument } from '../schema/document';
import type { UserDocument } from '../schema/userDocument';
import { QRCodeSVG } from 'qrcode.react';

interface ProfileModalProps<TData = unknown> {
  isOpen: boolean;
  onClose: () => void;
  currentUserDid: string;
  doc: BaseDocument<TData>;
  /** UserDocument for consistent profile data (preferred source) */
  userDoc?: UserDocument | null;
  onUpdateIdentity: (updates: { displayName?: string; avatarUrl?: string }) => void;
  onExportIdentity: () => void;
  onImportIdentity: () => void;
  onResetId: () => void;
  initialDisplayName?: string;
  /** User document URL for bidirectional trust synchronization */
  userDocUrl?: string;
}

export function ProfileModal<TData = unknown>({
  isOpen,
  onClose,
  currentUserDid,
  doc,
  userDoc,
  onUpdateIdentity,
  onExportIdentity,
  onImportIdentity,
  onResetId,
  initialDisplayName = '',
  userDocUrl,
}: ProfileModalProps<TData>) {
  // Derive current values from UserDocument (preferred) or workspace doc (fallback)
  const workspaceProfile = doc?.identities?.[currentUserDid];
  const currentDisplayName = userDoc?.profile?.displayName || workspaceProfile?.displayName || initialDisplayName;
  const currentAvatarUrl = userDoc?.profile?.avatarUrl || workspaceProfile?.avatarUrl;

  const [nameInput, setNameInput] = useState(currentDisplayName);
  const [isEditingName, setIsEditingName] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarSizeKB, setAvatarSizeKB] = useState<number>(0);
  const [avatarError, setAvatarError] = useState<string>('');

  // Sync nameInput when external data changes (e.g., cross-tab sync)
  useEffect(() => {
    setNameInput(currentDisplayName);
  }, [currentDisplayName]);

  const handleAvatarFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAvatarError('');

    try {
      const { dataUrl, sizeKB } = await processImageFile(file, 128, 0.8);
      setAvatarPreview(dataUrl);
      setAvatarSizeKB(sizeKB);

      if (sizeKB > 50) {
        setAvatarError(`Warning: Avatar is ${sizeKB}KB (recommended: max 50KB). May cause slow sync.`);
      }
    } catch (error) {
      setAvatarError(error instanceof Error ? error.message : 'Error processing image');
      setAvatarPreview(null);
    }
  };

  const handleRemoveAvatar = () => {
    onUpdateIdentity({ avatarUrl: '' });
    setAvatarPreview(null);
    setAvatarSizeKB(0);
    setAvatarError('');
  };

  const handleSaveName = () => {
    const next = nameInput.trim();
    if (!next) return;

    // Save both display name and avatar (if changed)
    onUpdateIdentity({
      displayName: next,
      ...(avatarPreview ? { avatarUrl: avatarPreview } : {})
    });

    // Update shared identity in localStorage
    const storedIdentity = loadSharedIdentity();
    if (storedIdentity) {
      storedIdentity.displayName = next;
      saveSharedIdentity(storedIdentity);
    }

    // Reset avatar preview after saving
    setAvatarPreview(null);
    setAvatarSizeKB(0);
    setAvatarError('');

    onClose();
  };

  // QR Code value
  const qrValue = userDocUrl
    ? `narrative://verify/${currentUserDid}?userDoc=${encodeURIComponent(userDocUrl)}`
    : `narrative://verify/${currentUserDid}`;

  if (!isOpen) return null;

  return (
    <div className="modal modal-open z-[9999]">
      <div className="modal-box max-w-sm p-6">
        {/* Close button */}
        <button
          className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2 z-10"
          onClick={onClose}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Avatar centered with edit overlay */}
        <div className="flex flex-col items-center mb-4 pt-2">
          <div className="relative mb-2">
            <div className="w-20 h-20 rounded-full overflow-hidden ring-2 ring-primary ring-offset-2 ring-offset-base-100">
              <UserAvatar
                did={currentUserDid}
                avatarUrl={avatarPreview || currentAvatarUrl}
                size={80}
              />
            </div>
            {/* Edit overlay */}
            <label
              htmlFor="avatar-upload"
              className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full opacity-0 hover:opacity-100 transition-opacity cursor-pointer"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </label>
            <input
              id="avatar-upload"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarFileSelect}
            />
            {/* Delete avatar button - bottom right */}
            {(currentAvatarUrl || avatarPreview) && (
              <button
                className="absolute -bottom-1 -right-2 w-8 h-8 bg-error rounded-lg flex items-center justify-center border-2 border-base-100 hover:bg-error/80 transition-colors"
                onClick={handleRemoveAvatar}
                title="Avatar entfernen"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-error-content" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            )}
          </div>

          {/* Name display or edit */}
          {isEditingName ? (
            <div className="w-full max-w-[280px] mt-2">
              <div className="form-control">
                <input
                  type="text"
                  className="input input-bordered w-full"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  placeholder="Dein Name"
                  autoFocus
                />
              </div>
              <div className="flex gap-2 mt-2">
                <button
                  className="btn btn-ghost btn-sm flex-1"
                  onClick={() => {
                    setNameInput(currentDisplayName);
                    setIsEditingName(false);
                  }}
                >
                  Abbrechen
                </button>
                <button
                  className="btn btn-primary btn-sm flex-1"
                  onClick={() => setIsEditingName(false)}
                >
                  OK
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center w-full mt-2">
              {/* Invisible spacer to balance the edit button */}
              <div className="w-8 h-8 invisible" />
              <span
                className="font-bold text-3xl text-center cursor-pointer hover:text-primary transition-colors"
                onClick={() => setIsEditingName(true)}
              >
                {nameInput || currentDisplayName || 'Unbenannt'}
              </span>
              <button
                className="btn btn-ghost btn-sm btn-circle ml-1"
                onClick={() => setIsEditingName(true)}
                title="Name bearbeiten"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </button>
            </div>
          )}

          {avatarError && (
            <div className={`text-xs p-2 rounded mt-2 ${avatarSizeKB > 50 ? 'bg-warning/20 text-warning' : 'bg-error/20 text-error'}`}>
              {avatarError}
            </div>
          )}
        </div>

        {/* Large QR Code */}
        <div className="flex flex-col items-center mb-4">
          <div className="bg-white p-3 rounded-xl shadow-sm">
            <QRCodeSVG value={qrValue} size={180} level="M" />
          </div>
          <div className="text-sm text-base-content/60 mt-2 text-center">
            Zeig den QR-Code deinen Freunden!
          </div>
        </div>

        {/* DID - Compact */}
        <div className="bg-base-200 rounded-lg p-2 mb-4">
          <div className="text-xs text-base-content/50 mb-0.5">DID</div>
          <code className="text-xs break-all select-all block leading-tight">{currentUserDid}</code>
        </div>

        {/* Action buttons */}
        <div className="flex gap-3 mb-4">
          <button className="btn btn-ghost flex-1" onClick={onClose}>
            Abbrechen
          </button>
          <button className="btn btn-primary flex-1" onClick={handleSaveName}>
            Speichern
          </button>
        </div>

        {/* Identity management - collapsible */}
        <details className="collapse collapse-arrow bg-base-200 rounded-lg mb-2">
          <summary className="collapse-title">
            Identität verwalten
          </summary>
          <div className="collapse-content">
            <div className="flex flex-col gap-2 pt-2">
              <button className="btn btn-outline btn-sm" onClick={onExportIdentity}>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                Exportieren
              </button>
              <button className="btn btn-outline btn-sm" onClick={onImportIdentity}>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Importieren
              </button>
              <button className="btn btn-error btn-sm" onClick={onResetId}>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Zurücksetzen
              </button>
            </div>
          </div>
        </details>
      </div>
      <div className="modal-backdrop" onClick={onClose}></div>
    </div>
  );
}
