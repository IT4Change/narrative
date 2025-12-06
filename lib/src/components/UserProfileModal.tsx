import { useState, useEffect } from 'react';
import { UserAvatar } from './UserAvatar';
import { QRCodeSVG } from 'qrcode.react';
import type { BaseDocument } from '../schema/document';
import type { TrustAttestation } from '../schema/identity';
import type { TrustedUserProfile } from '../hooks/useAppContext';
import { extractPublicKeyFromDid, base64Encode, getDefaultDisplayName } from '../utils/did';
import { formatRelativeTime, formatFullDateTime } from '../utils/time';
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

  const renderSignatureIcon = (status: SignatureStatus) => {
    if (status === 'pending') {
      return <span className="loading loading-spinner loading-xs"></span>;
    }
    if (status === 'valid') {
      return (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
      );
    }
    if (status === 'invalid') {
      return (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-error" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      );
    }
    return null;
  };

  // QR Code value
  const qrValue = userDocUrl
    ? `narrative://verify/${did}?userDoc=${encodeURIComponent(userDocUrl)}`
    : `narrative://verify/${did}`;

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

        {/* Own Profile: Avatar/Name on top, large QR below */}
        {isOwnProfile ? (
          <>
            {/* Avatar and Name centered */}
            <div className="flex flex-col items-center mb-4 pt-2">
              <div className="relative mb-2">
                <div className="w-20 h-20 rounded-full overflow-hidden ring-2 ring-primary ring-offset-2 ring-offset-base-100">
                  <UserAvatar did={did} avatarUrl={avatarUrl} size={80} />
                </div>
                <div className="absolute -bottom-1 -right-1 badge badge-primary badge-xs">Du</div>
              </div>
              <div className="font-bold text-xl text-center leading-tight">{displayName}</div>
            </div>

            {/* Large QR Code */}
            <div className="flex flex-col items-center mb-4">
              <div className="bg-white p-3 rounded-xl shadow-sm">
                <QRCodeSVG value={qrValue} size={180} level="M" />
              </div>
              <div className="text-sm text-base-content/60 mt-2 text-center">
                Zeig den QR-Code deinen Freunden um dein Netzwerk aufzubauen!
              </div>
            </div>

            {/* DID - Compact */}
            <div className="bg-base-200 rounded-lg p-2 mb-4">
              <div className="text-xs text-base-content/50 mb-0.5">DID</div>
              <code className="text-xs break-all select-all block leading-tight">{did}</code>
            </div>
          </>
        ) : (
          <>
            {/* Other Profile: Centered Avatar */}
            <div className="flex flex-col items-center mb-4 pt-2">
              <div className="relative mb-2">
                <div className="w-20 h-20 rounded-full overflow-hidden ring-2 ring-base-300 ring-offset-2 ring-offset-base-100">
                  <UserAvatar did={did} avatarUrl={avatarUrl} size={80} />
                </div>
                {/* Trust indicator on avatar */}
                {isMutualTrust && (
                  <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-success rounded-full flex items-center justify-center border-2 border-base-100">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-success-content" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                )}
                {hasTrustGiven && !isMutualTrust && (
                  <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-info rounded-full flex items-center justify-center border-2 border-base-100">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-info-content" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                )}
                {hasTrustReceived && !isMutualTrust && !hasTrustGiven && (
                  <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-warning rounded-full flex items-center justify-center border-2 border-base-100">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-warning-content" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                )}
              </div>

              <div className="font-bold text-lg">{displayName}</div>

              {/* Trust Status Badge */}
              {isMutualTrust && (
                <span className="badge badge-success gap-1 mt-1">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                  </svg>
                  Gegenseitiges Vertrauen
                </span>
              )}
              {hasTrustGiven && !isMutualTrust && (
                <span className="badge badge-info gap-1 mt-1">Du vertraust</span>
              )}
              {hasTrustReceived && !isMutualTrust && !hasTrustGiven && (
                <span className="badge badge-warning gap-1 mt-1">Vertraut dir</span>
              )}
            </div>

            {/* DID - Compact */}
            <div className="bg-base-200 rounded-lg p-2 mb-4">
              <div className="text-xs text-base-content/50 mb-0.5">DID</div>
              <code className="text-xs break-all select-all block leading-tight">{did}</code>
            </div>

            {/* Trust Details - Compact inline */}
            {(hasTrustGiven || hasTrustReceived) && (
              <div className="space-y-2 mb-4">
                {hasTrustGiven && trustGiven && (
                  <div className="flex items-center justify-between text-sm bg-base-200 rounded-lg px-3 py-2">
                    <div className="flex items-center gap-2">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-info" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                      <span className="text-base-content/70">Von dir verifiziert</span>
                    </div>
                    <div className="flex items-center gap-1">
                      {renderSignatureIcon(trustGivenStatus)}
                      {trustGiven.createdAt && (
                        <span
                          className="text-xs text-base-content/50"
                          title={formatFullDateTime(trustGiven.createdAt)}
                        >
                          {formatRelativeTime(trustGiven.createdAt)}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {hasTrustReceived && trustReceived && (
                  <div className="flex items-center justify-between text-sm bg-base-200 rounded-lg px-3 py-2">
                    <div className="flex items-center gap-2">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-warning" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 17l-5-5m0 0l5-5m-5 5h12" />
                      </svg>
                      <span className="text-base-content/70">Hat dich verifiziert</span>
                    </div>
                    <div className="flex items-center gap-1">
                      {renderSignatureIcon(trustReceivedStatus)}
                      {trustReceived.createdAt && (
                        <span
                          className="text-xs text-base-content/50"
                          title={formatFullDateTime(trustReceived.createdAt)}
                        >
                          {formatRelativeTime(trustReceived.createdAt)}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
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
                Vertrauen entziehen
              </button>
            ) : (
              <button
                className="btn btn-primary flex-1"
                onClick={() => onTrust?.(did)}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                Verifizieren
              </button>
            )}
            <button className="btn btn-ghost" onClick={onClose}>
              Schließen
            </button>
          </div>
        )}

        {/* Close button for own profile */}
        {isOwnProfile && (
          <button className="btn btn-ghost w-full" onClick={onClose}>
            Schließen
          </button>
        )}
      </div>
      <div className="modal-backdrop" onClick={onClose}></div>
    </div>
  );
}
