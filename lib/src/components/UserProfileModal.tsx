import { useState, useEffect } from 'react';
import { UserAvatar } from './UserAvatar';
import { QRCodeSVG } from 'qrcode.react';
import type { BaseDocument } from '../schema/document';
import type { TrustAttestation } from '../schema/identity';
import type { TrustedUserProfile } from '../hooks/useAppContext';
import { extractPublicKeyFromDid, base64Encode, getDefaultDisplayName } from '../utils/did';
import { verifyEntitySignature } from '../utils/signature';

type SignatureStatus = 'valid' | 'invalid' | 'missing' | 'pending';

/**
 * Custom action for the profile modal
 */
export interface ProfileAction {
  /** Button label */
  label: string;
  /** Button icon (optional) */
  icon?: React.ReactNode;
  /** Click handler */
  onClick: () => void;
  /** Button variant */
  variant?: 'primary' | 'secondary' | 'error' | 'ghost' | 'outline';
  /** Only show for own profile */
  ownProfileOnly?: boolean;
  /** Only show for other profiles */
  otherProfileOnly?: boolean;
}

interface UserProfileModalProps<TData = unknown> {
  /** The DID of the user to display */
  did: string;
  /** Whether the modal is open */
  isOpen: boolean;
  /** Called when the modal should close */
  onClose: () => void;
  /** The current document (for profile lookup) */
  doc: BaseDocument<TData>;
  /** Current user's DID (to show "You" badge and trust status) */
  currentUserDid?: string;
  /** Trust attestation given to this user (if any) */
  trustGiven?: TrustAttestation;
  /** Trust attestation received from this user (if any) */
  trustReceived?: TrustAttestation;
  /** Called when user wants to trust this profile */
  onTrust?: (did: string) => void;
  /** Called when user wants to revoke trust */
  onRevokeTrust?: (did: string) => void;
  /** User document URL for QR code (only shown for own profile) */
  userDocUrl?: string;
  /** Additional custom actions */
  customActions?: ProfileAction[];
  /** Hide the default trust actions */
  hideTrustActions?: boolean;
  /** Profiles loaded from trusted users' UserDocuments (for avatar/name) */
  trustedUserProfiles?: Record<string, TrustedUserProfile>;
}

/**
 * Verify an attestation's signature
 */
async function verifyAttestationSignature(attestation: TrustAttestation): Promise<SignatureStatus> {
  if (!attestation.signature) return 'missing';

  try {
    const publicKeyBytes = extractPublicKeyFromDid(attestation.trusterDid);
    const publicKeyBase64 = base64Encode(publicKeyBytes);
    const result = await verifyEntitySignature(attestation as unknown as Record<string, unknown>, publicKeyBase64);
    return result.valid ? 'valid' : 'invalid';
  } catch {
    return 'invalid';
  }
}

export function UserProfileModal<TData = unknown>({
  did,
  isOpen,
  onClose,
  doc,
  currentUserDid,
  trustGiven,
  trustReceived,
  onTrust,
  onRevokeTrust,
  userDocUrl,
  customActions = [],
  hideTrustActions = false,
  trustedUserProfiles = {},
}: UserProfileModalProps<TData>) {
  const [trustGivenStatus, setTrustGivenStatus] = useState<SignatureStatus>('pending');
  const [trustReceivedStatus, setTrustReceivedStatus] = useState<SignatureStatus>('pending');

  const isOwnProfile = currentUserDid === did;
  const workspaceProfile = doc.identities?.[did];
  const trustedProfile = trustedUserProfiles[did];
  // Prefer profile from trusted user's UserDoc, fallback to workspace identity, fallback to DID-based name
  const displayName = trustedProfile?.displayName || workspaceProfile?.displayName || getDefaultDisplayName(did);
  const avatarUrl = trustedProfile?.avatarUrl || workspaceProfile?.avatarUrl;

  // Determine trust relationship
  const hasTrustGiven = !!trustGiven;
  const hasTrustReceived = !!trustReceived;
  const isMutualTrust = hasTrustGiven && hasTrustReceived;

  // Verify signatures when attestations change
  useEffect(() => {
    if (!isOpen) return;

    if (trustGiven) {
      setTrustGivenStatus('pending');
      verifyAttestationSignature(trustGiven).then(setTrustGivenStatus);
    } else {
      setTrustGivenStatus('missing');
    }

    if (trustReceived) {
      setTrustReceivedStatus('pending');
      verifyAttestationSignature(trustReceived).then(setTrustReceivedStatus);
    } else {
      setTrustReceivedStatus('missing');
    }
  }, [isOpen, trustGiven, trustReceived]);

  if (!isOpen) return null;

  const renderSignatureBadge = (status: SignatureStatus, label: string) => {
    if (status === 'pending') {
      return (
        <span className="badge badge-ghost badge-sm gap-1">
          <span className="loading loading-spinner loading-xs"></span>
          {label}
        </span>
      );
    }
    if (status === 'valid') {
      return (
        <span className="badge badge-success badge-sm gap-1">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          {label}
        </span>
      );
    }
    if (status === 'invalid') {
      return (
        <span className="badge badge-error badge-sm gap-1">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          Invalid
        </span>
      );
    }
    return null;
  };

  return (
    <div className="modal modal-open z-[9999]">
      <div className="modal-box max-w-md">
        {/* Close button */}
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

        <h3 className="font-bold text-lg mb-4">
          {isOwnProfile ? 'Your Profile' : 'User Profile'}
        </h3>

        {/* Avatar and Name Section */}
        <div className="flex flex-col items-center gap-4 p-4 bg-base-200 rounded-lg mb-4">
          <div className="relative">
            <div className="w-24 h-24 rounded-full overflow-hidden ring-2 ring-primary ring-offset-2 ring-offset-base-100">
              <UserAvatar
                did={did}
                avatarUrl={avatarUrl}
                size={96}
              />
            </div>
            {isOwnProfile && (
              <div className="absolute -bottom-1 -right-1 badge badge-primary badge-sm">You</div>
            )}
          </div>

          <div className="text-center">
            <div className="font-bold text-xl">{displayName}</div>

            {/* Trust badges */}
            <div className="flex flex-wrap justify-center gap-2 mt-2">
              {isMutualTrust && (
                <span className="badge badge-success gap-1">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  </svg>
                  Mutual Trust
                </span>
              )}
              {hasTrustGiven && !isMutualTrust && (
                <span className="badge badge-info gap-1">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  You Trust
                </span>
              )}
              {hasTrustReceived && !isMutualTrust && (
                <span className="badge badge-secondary gap-1">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Trusts You
                </span>
              )}
            </div>
          </div>
        </div>

        {/* DID Section */}
        <div className="p-3 bg-base-200 rounded-lg mb-4">
          <div className="text-sm text-base-content/70 mb-1">DID (Decentralized Identifier)</div>
          <code className="text-xs break-all select-all">{did}</code>
        </div>

        {/* Trust Details Section */}
        {(hasTrustGiven || hasTrustReceived) && !isOwnProfile && (
          <div className="space-y-3 mb-4">
            <div className="text-sm font-semibold">Trust Details</div>

            {hasTrustGiven && trustGiven && (
              <div className="p-3 bg-base-200 rounded-lg">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-base-content/70">You verified this user</span>
                  {renderSignatureBadge(trustGivenStatus, 'Signed')}
                </div>
                <div className="text-xs text-base-content/50">
                  {trustGiven.verificationMethod && (
                    <span className="capitalize">{trustGiven.verificationMethod.replace('-', ' ')}</span>
                  )}
                  {trustGiven.createdAt && (
                    <span> • {new Date(trustGiven.createdAt).toLocaleDateString()}</span>
                  )}
                </div>
                {trustGiven.notes && (
                  <div className="text-xs mt-1 italic">"{trustGiven.notes}"</div>
                )}
              </div>
            )}

            {hasTrustReceived && trustReceived && (
              <div className="p-3 bg-base-200 rounded-lg">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-base-content/70">This user verified you</span>
                  {renderSignatureBadge(trustReceivedStatus, 'Signed')}
                </div>
                <div className="text-xs text-base-content/50">
                  {trustReceived.verificationMethod && (
                    <span className="capitalize">{trustReceived.verificationMethod.replace('-', ' ')}</span>
                  )}
                  {trustReceived.createdAt && (
                    <span> • {new Date(trustReceived.createdAt).toLocaleDateString()}</span>
                  )}
                </div>
                {trustReceived.notes && (
                  <div className="text-xs mt-1 italic">"{trustReceived.notes}"</div>
                )}
              </div>
            )}
          </div>
        )}

        {/* QR Code for own profile */}
        {isOwnProfile && (
          <div className="p-4 bg-base-200 rounded-lg flex flex-col items-center gap-2 mb-4">
            <div className="text-sm text-base-content/70 mb-1">Verification QR Code</div>
            <div className="bg-white p-3 rounded-lg">
              <QRCodeSVG
                value={userDocUrl
                  ? `narrative://verify/${did}?userDoc=${encodeURIComponent(userDocUrl)}`
                  : `narrative://verify/${did}`
                }
                size={160}
                level="M"
              />
            </div>
            <div className="text-xs text-base-content/50 text-center">
              Let others scan this to verify your identity
            </div>
          </div>
        )}

        {/* Custom actions */}
        {customActions.length > 0 && (
          <div className="flex flex-col gap-2 mb-4">
            {customActions
              .filter(action => {
                if (action.ownProfileOnly && !isOwnProfile) return false;
                if (action.otherProfileOnly && isOwnProfile) return false;
                return true;
              })
              .map((action, index) => {
                const variantClass = {
                  primary: 'btn-primary',
                  secondary: 'btn-secondary',
                  error: 'btn-error',
                  ghost: 'btn-ghost',
                  outline: 'btn-outline',
                }[action.variant || 'primary'];

                return (
                  <button
                    key={index}
                    className={`btn ${variantClass} w-full`}
                    onClick={action.onClick}
                  >
                    {action.icon}
                    {action.label}
                  </button>
                );
              })}
          </div>
        )}

        {/* Trust action buttons */}
        {!isOwnProfile && !hideTrustActions && (
          <div className="flex gap-3">
            {hasTrustGiven ? (
              <button
                className="btn btn-error btn-outline flex-1"
                onClick={() => onRevokeTrust?.(did)}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                Revoke Trust
              </button>
            ) : (
              <button
                className="btn btn-primary flex-1"
                onClick={() => onTrust?.(did)}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                Verify & Trust
              </button>
            )}
          </div>
        )}

        {/* Close button at bottom */}
        <div className="modal-action">
          <button className="btn" onClick={onClose}>Close</button>
        </div>
      </div>
      <div className="modal-backdrop" onClick={onClose}></div>
    </div>
  );
}
