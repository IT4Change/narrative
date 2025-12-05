/**
 * CreateVoucherModal - Form to create a new voucher
 */

import { useState } from 'react';
import type { IdentityProfile } from 'narrative-ui';

interface CreateVoucherModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateVoucher: (params: {
    recipientId: string;
    amount: number;
    unit: string;
    note?: string;
    expiresAt?: number;
  }) => Promise<void>;
  identities: Record<string, IdentityProfile>;
  currentUserDid: string;
}

/**
 * Common units for quick selection
 */
const COMMON_UNITS = [
  'Minuten',
  'Stunden',
  'EUR',
  'CHF',
  'Stueck',
  'kg',
];

export function CreateVoucherModal({
  isOpen,
  onClose,
  onCreateVoucher,
  identities,
  currentUserDid,
}: CreateVoucherModalProps) {
  const [recipientId, setRecipientId] = useState('');
  const [amount, setAmount] = useState<number>(1);
  const [unit, setUnit] = useState('');
  const [customUnit, setCustomUnit] = useState('');
  const [note, setNote] = useState('');
  const [hasExpiry, setHasExpiry] = useState(false);
  const [expiryDate, setExpiryDate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get list of known users (excluding self)
  const knownUsers = Object.entries(identities)
    .filter(([did]) => did !== currentUserDid)
    .map(([did, profile]) => ({
      did,
      displayName: profile.displayName || did.slice(0, 16) + '...',
    }));

  const effectiveUnit = unit === 'custom' ? customUnit : unit;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!recipientId) {
      setError('Bitte Empfaenger auswaehlen');
      return;
    }

    if (amount <= 0) {
      setError('Betrag muss groesser als 0 sein');
      return;
    }

    if (!effectiveUnit) {
      setError('Bitte Einheit angeben');
      return;
    }

    setIsSubmitting(true);

    try {
      let expiresAt: number | undefined;
      if (hasExpiry && expiryDate) {
        expiresAt = new Date(expiryDate).getTime();
        if (expiresAt <= Date.now()) {
          setError('Ablaufdatum muss in der Zukunft liegen');
          setIsSubmitting(false);
          return;
        }
      }

      await onCreateVoucher({
        recipientId,
        amount,
        unit: effectiveUnit,
        note: note || undefined,
        expiresAt,
      });

      // Reset form
      setRecipientId('');
      setAmount(1);
      setUnit('');
      setCustomUnit('');
      setNote('');
      setHasExpiry(false);
      setExpiryDate('');

      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Erstellen');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <dialog className="modal modal-open">
      <div className="modal-box">
        <h3 className="font-bold text-lg mb-4">Neuen Gutschein erstellen</h3>

        <form onSubmit={handleSubmit}>
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
                  Noch keine anderen Teilnehmer bekannt. DID manuell eingeben.
                </p>
              </div>
            )}
          </div>

          {/* Amount + Unit */}
          <div className="flex gap-4 mb-4">
            <div className="form-control flex-1">
              <label className="label">
                <span className="label-text">Anzahl</span>
              </label>
              <input
                type="number"
                className="input input-bordered w-full"
                min="0.01"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
              />
            </div>
            <div className="form-control flex-1">
              <label className="label">
                <span className="label-text">Einheit</span>
              </label>
              <select
                className="select select-bordered w-full"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
              >
                <option value="">Waehle...</option>
                {COMMON_UNITS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
                <option value="custom">Andere...</option>
              </select>
            </div>
          </div>

          {/* Custom unit input */}
          {unit === 'custom' && (
            <div className="form-control mb-4">
              <input
                type="text"
                className="input input-bordered w-full"
                placeholder="z.B. Aepfel, Kuchen, Stunden Gartenarbeit..."
                value={customUnit}
                onChange={(e) => setCustomUnit(e.target.value)}
              />
            </div>
          )}

          {/* Note */}
          <div className="form-control mb-4">
            <label className="label">
              <span className="label-text">Beschreibung (optional)</span>
            </label>
            <textarea
              className="textarea textarea-bordered w-full"
              placeholder="z.B. Fuer die Hilfe beim Umzug..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
            />
          </div>

          {/* Expiry */}
          <div className="form-control mb-4">
            <label className="label cursor-pointer justify-start gap-2">
              <input
                type="checkbox"
                className="checkbox"
                checked={hasExpiry}
                onChange={(e) => setHasExpiry(e.target.checked)}
              />
              <span className="label-text">Ablaufdatum setzen</span>
            </label>
            {hasExpiry && (
              <input
                type="date"
                className="input input-bordered w-full mt-2"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
              />
            )}
          </div>

          {/* Preview */}
          {recipientId && amount > 0 && effectiveUnit && (
            <div className="alert mb-4">
              <div>
                <strong>Vorschau:</strong> Du erstellst einen Gutschein ueber{' '}
                <strong>
                  {amount} {effectiveUnit}
                </strong>{' '}
                fuer{' '}
                <strong>
                  {identities[recipientId]?.displayName ||
                    recipientId.slice(0, 16) + '...'}
                </strong>
                {hasExpiry && expiryDate && (
                  <>
                    , gueltig bis{' '}
                    <strong>
                      {new Date(expiryDate).toLocaleDateString('de-DE')}
                    </strong>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="alert alert-error mb-4">
              <span>{error}</span>
            </div>
          )}

          {/* Actions */}
          <div className="modal-action">
            <button
              type="button"
              className="btn"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Abbrechen
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <span className="loading loading-spinner loading-sm"></span>
              ) : (
                'Erstellen & Senden'
              )}
            </button>
          </div>
        </form>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button onClick={onClose}>close</button>
      </form>
    </dialog>
  );
}
