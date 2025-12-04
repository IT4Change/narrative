import { useState, useEffect } from 'react';
import type { BaseDocument } from '../schema/document';
import type { TrustAttestation } from '../schema/identity';
import { UserAvatar } from './UserAvatar';

interface TrustReciprocityModalProps<TData = unknown> {
  pendingAttestations: TrustAttestation[];
  doc: BaseDocument<TData>;
  currentUserDid: string;
  onTrustBack: (trusterDid: string) => void;
  onDecline: (attestationId: string) => void;
  onShowToast?: (message: string) => void;
}

export function TrustReciprocityModal<TData = unknown>({
  pendingAttestations,
  doc,
  currentUserDid,
  onTrustBack,
  onDecline,
  onShowToast,
}: TrustReciprocityModalProps<TData>) {
  const [currentIndex, setCurrentIndex] = useState(0);

  // Reset index when pending attestations change
  useEffect(() => {
    if (pendingAttestations.length === 0) {
      setCurrentIndex(0);
    } else if (currentIndex >= pendingAttestations.length) {
      setCurrentIndex(0);
    }
  }, [pendingAttestations, currentIndex]);

  if (pendingAttestations.length === 0 || currentIndex >= pendingAttestations.length) {
    return null;
  }

  const currentAttestation = pendingAttestations[currentIndex];
  const trusterDid = currentAttestation.trusterDid;
  const profile = doc.identities[trusterDid];
  const displayName = profile?.displayName || 'Anonymous User';

  const handleTrustBack = () => {
    onTrustBack(trusterDid);
    if (onShowToast) {
      onShowToast(`Du vertraust jetzt ${displayName}`);
    }
    // Move to next attestation or close
    if (currentIndex < pendingAttestations.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handleDecline = () => {
    onDecline(currentAttestation.id);
    // Move to next attestation or close
    if (currentIndex < pendingAttestations.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const remainingCount = pendingAttestations.length - currentIndex - 1;

  return (
    <div className="modal modal-open z-[10000]">
      <div className="modal-box max-w-md">
        <h3 className="font-bold text-lg mb-4">Vertrauensanfrage</h3>

        <div className="flex flex-col items-center gap-4 p-4 bg-base-200 rounded-lg mb-4">
          <div className="w-20 h-20 rounded-full overflow-hidden ring-2 ring-primary ring-offset-2 ring-offset-base-100">
            <UserAvatar
              did={trusterDid}
              avatarUrl={profile?.avatarUrl}
              size={80}
            />
          </div>
          <div className="text-center">
            <div className="font-bold text-lg">{displayName}</div>
            <div className="text-xs text-base-content/50 break-all mt-2">
              {trusterDid}
            </div>
          </div>
        </div>

        <div className="alert alert-info mb-4">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            className="stroke-current shrink-0 w-6 h-6"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            ></path>
          </svg>
          <span className="text-sm">
            <strong>{displayName}</strong> hat deine Identität verifiziert. Möchtest du auch dieser Person vertrauen?
          </span>
        </div>

        {remainingCount > 0 && (
          <div className="text-sm text-base-content/60 text-center mb-4">
            {remainingCount} weitere Anfrage{remainingCount > 1 ? 'n' : ''} ausstehend
          </div>
        )}

        <div className="flex gap-3">
          <button className="btn btn-ghost flex-1" onClick={handleDecline}>
            Ablehnen
          </button>
          <button className="btn btn-primary flex-1" onClick={handleTrustBack}>
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
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            Auch vertrauen
          </button>
        </div>
      </div>
      <div className="modal-backdrop"></div>
    </div>
  );
}
