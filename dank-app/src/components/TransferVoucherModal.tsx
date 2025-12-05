/**
 * TransferVoucherModal - Transfer a voucher to another user
 */

import { useState } from 'react';
import type { Voucher } from '../schema';
import type { IdentityProfile } from 'narrative-ui';
import { UserAvatar } from 'narrative-ui';

interface TransferVoucherModalProps {
  isOpen: boolean;
  onClose: () => void;
  voucher: Voucher | null;
  onTransfer: (voucherId: string, toId: string, note?: string) => Promise<void>;
  identities: Record<string, IdentityProfile>;
  currentUserDid: string;
}

export function TransferVoucherModal({
  isOpen,
  onClose,
  voucher,
  onTransfer,
  identities,
  currentUserDid,
}: TransferVoucherModalProps) {
  const [recipientId, setRecipientId] = useState('');
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);

  // Get list of known users (excluding self)
  const knownUsers = Object.entries(identities)
    .filter(([did]) => did !== currentUserDid)
    .map(([did, profile]) => ({
      did,
      displayName: profile.displayName || did.slice(0, 16) + '...',
    }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!recipientId) {
      setError('Bitte Empfaenger auswaehlen');
      return;
    }

    if (!voucher) {
      setError('Kein Gutschein ausgewaehlt');
      return;
    }

    // Show confirmation before proceeding
    if (!showConfirmation) {
      setShowConfirmation(true);
      return;
    }

    setIsSubmitting(true);

    try {
      await onTransfer(voucher.id, recipientId, note || undefined);

      // Reset form
      setRecipientId('');
      setNote('');
      setShowConfirmation(false);

      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Weitergeben');
      setShowConfirmation(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setRecipientId('');
    setNote('');
    setError(null);
    setShowConfirmation(false);
    onClose();
  };

  if (!isOpen || !voucher) return null;

  const recipientName =
    identities[recipientId]?.displayName || recipientId.slice(0, 16) + '...';
  const issuerName =
    identities[voucher.issuerId]?.displayName ||
    voucher.issuerId.slice(0, 16) + '...';

  return (
    <dialog className="modal modal-open">
      <div className="modal-box">
        <h3 className="font-bold text-lg mb-4">Gutschein weitergeben</h3>

        {/* Voucher info */}
        <div className="bg-base-200 rounded-lg p-4 mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-2xl font-bold">
              {voucher.amount} {voucher.unit}
            </span>
          </div>
          {voucher.note && (
            <p className="text-sm text-base-content/70 mb-2">{voucher.note}</p>
          )}
          <div className="flex items-center gap-2">
            <UserAvatar
              did={voucher.issuerId}
              avatarUrl={identities[voucher.issuerId]?.avatarUrl}
              size={20}
            />
            <span className="text-sm">
              Ausgestellt von <strong>{issuerName}</strong>
            </span>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Confirmation View */}
          {showConfirmation ? (
            <div className="alert alert-warning mb-4">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6 shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
              <div>
                <h4 className="font-bold">Bist du sicher?</h4>
                <p>
                  Du gibst{' '}
                  <strong>
                    {voucher.amount} {voucher.unit}
                  </strong>{' '}
                  an <strong>{recipientName}</strong> weiter.
                  {note && (
                    <>
                      <br />
                      Notiz: &quot;{note}&quot;
                    </>
                  )}
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Recipient */}
              <div className="form-control mb-4">
                <label className="label">
                  <span className="label-text">Empfaenger</span>
                </label>
                {knownUsers.length > 0 ? (
                  <select
                    className="select select-bordered w-full"
                    value={recipientId}
                    onChange={(e) => setRecipientId(e.target.value)}
                  >
                    <option value="">Waehle Empfaenger...</option>
                    {knownUsers.map((user) => (
                      <option key={user.did} value={user.did}>
                        {user.displayName}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div>
                    <input
                      type="text"
                      className="input input-bordered w-full"
                      placeholder="DID des Empfaengers (did:key:z6Mk...)"
                      value={recipientId}
                      onChange={(e) => setRecipientId(e.target.value)}
                    />
                    <p className="text-xs text-base-content/50 mt-1">
                      Noch keine anderen Teilnehmer bekannt. DID manuell
                      eingeben.
                    </p>
                  </div>
                )}
              </div>

              {/* Note */}
              <div className="form-control mb-4">
                <label className="label">
                  <span className="label-text">Notiz (optional)</span>
                </label>
                <input
                  type="text"
                  className="input input-bordered w-full"
                  placeholder="z.B. Danke fuer die Hilfe!"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </div>
            </>
          )}

          {/* Error */}
          {error && (
            <div className="alert alert-error mb-4">
              <span>{error}</span>
            </div>
          )}

          {/* Actions */}
          <div className="modal-action">
            {showConfirmation ? (
              <>
                <button
                  type="button"
                  className="btn"
                  onClick={() => setShowConfirmation(false)}
                  disabled={isSubmitting}
                >
                  Zurueck
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <span className="loading loading-spinner loading-sm"></span>
                  ) : (
                    'Bestaetigen & Senden'
                  )}
                </button>
              </>
            ) : (
              <>
                <button type="button" className="btn" onClick={handleClose}>
                  Abbrechen
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={!recipientId}
                >
                  Weiter
                </button>
              </>
            )}
          </div>
        </form>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button onClick={handleClose}>close</button>
      </form>
    </dialog>
  );
}
