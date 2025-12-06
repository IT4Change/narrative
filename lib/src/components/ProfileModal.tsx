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

  if (!isOpen) return null;

  return (
    <div className="modal modal-open z-[9999]">
      <div className="modal-box max-w-md space-y-4">
        <button
          className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
          onClick={onClose}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
        <h3 className="font-bold text-lg">Your Profile</h3>

        {/* Avatar Section */}
        <div className="flex flex-col items-center gap-3 p-4 bg-base-200 rounded-lg">
          <div className="w-24 h-24 rounded-full overflow-hidden ring-2 ring-primary ring-offset-2 ring-offset-base-100">
            <UserAvatar
              did={currentUserDid}
              avatarUrl={avatarPreview || currentAvatarUrl}
              size={96}
            />
          </div>

          <div className="flex flex-col gap-2 w-full">
            <label htmlFor="avatar-upload" className="btn btn-sm btn-outline w-full">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              Upload Avatar
            </label>
            <input
              id="avatar-upload"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarFileSelect}
            />

            {(currentAvatarUrl || avatarPreview) && (
              <button className="btn btn-sm btn-ghost w-full" onClick={handleRemoveAvatar}>
                Remove Avatar
              </button>
            )}

            {avatarError && (
              <div className={`text-xs p-2 rounded ${avatarSizeKB > 50 ? 'bg-warning/20 text-warning' : 'bg-error/20 text-error'}`}>
                {avatarError}
              </div>
            )}
          </div>
        </div>

        <div className="form-control">
          <label className="label">
            <span className="label-text">Display Name</span>
          </label>
          <input
            type="text"
            className="input input-bordered"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            placeholder="Your name"
          />
          <div className="flex justify-between mt-5">
            <button className="btn" onClick={onClose}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={handleSaveName}>
              Save
            </button>
          </div>
        </div>

        <div className="divider">Identity</div>
        <div className="flex flex-col gap-2">
          {/* DID Section */}
          <div className="p-3 bg-base-200 rounded-lg">
            <div className="text-sm text-base-content/70 mb-1">Your DID</div>
            <code className="text-xs break-all">{currentUserDid}</code>
          </div>

          {/* QR Code Section */}
          <div className="p-4 bg-base-200 rounded-lg flex flex-col items-center gap-2">
            <div className="text-sm text-base-content/70 mb-1">Verification QR Code</div>
            <div className="bg-white p-3 rounded-lg">
              <QRCodeSVG
                value={userDocUrl
                  ? `narrative://verify/${currentUserDid}?userDoc=${encodeURIComponent(userDocUrl)}`
                  : `narrative://verify/${currentUserDid}`
                }
                size={160}
                level="M"
              />
            </div>
            <div className="text-xs text-base-content/50 text-center">
              Let others scan this to verify your identity
            </div>
          </div>

          <button className="btn btn-outline btn-sm" onClick={onExportIdentity}>
            Export Identity
          </button>
          <button className="btn btn-outline btn-sm" onClick={onImportIdentity}>
            Import Identity
          </button>
          <button className="btn btn-error btn-sm" onClick={onResetId}>
            Reset ID
          </button>
        </div>
      </div>
      <div className="modal-backdrop" onClick={onClose}></div>
    </div>
  );
}
