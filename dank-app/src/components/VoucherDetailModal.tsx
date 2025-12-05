/**
 * VoucherDetailModal - Show full voucher details including transfer chain
 */

import type { Voucher, ValidationResult, SignatureStatus } from '../schema';
import { getVoucherStatus } from '../schema';
import type { IdentityProfile } from 'narrative-ui';
import { UserAvatar } from 'narrative-ui';

interface VoucherDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  voucher: Voucher | null;
  validationResult?: ValidationResult;
  identities: Record<string, IdentityProfile>;
  currentUserDid: string;
}

/**
 * Get display name for a DID
 */
function getDisplayName(
  did: string,
  identities: Record<string, IdentityProfile>
): string {
  return identities[did]?.displayName || did.slice(0, 16) + '...';
}

/**
 * Format date and time
 */
function formatDateTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Signature status indicator with text
 */
function SignatureStatus({
  status,
  label,
}: {
  status: SignatureStatus;
  label: string;
}) {
  const getStatusClass = () => {
    switch (status) {
      case 'valid':
        return 'text-success';
      case 'invalid':
        return 'text-error';
      default:
        return 'text-warning';
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'valid':
        return (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
              clipRule="evenodd"
            />
          </svg>
        );
      case 'invalid':
        return (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
              clipRule="evenodd"
            />
          </svg>
        );
      default:
        return (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z"
              clipRule="evenodd"
            />
          </svg>
        );
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'valid':
        return 'Gueltig';
      case 'invalid':
        return 'Ungueltig';
      default:
        return 'Unbekannt';
    }
  };

  return (
    <span className={`flex items-center gap-1 ${getStatusClass()}`}>
      {getStatusIcon()}
      <span className="text-xs">
        {label}: {getStatusText()}
      </span>
    </span>
  );
}

export function VoucherDetailModal({
  isOpen,
  onClose,
  voucher,
  validationResult,
  identities,
  currentUserDid,
}: VoucherDetailModalProps) {
  if (!isOpen || !voucher) return null;

  const status = getVoucherStatus(voucher);
  const isIssuer = voucher.issuerId === currentUserDid;
  const isHolder = voucher.currentHolderId === currentUserDid;

  return (
    <dialog className="modal modal-open">
      <div className="modal-box max-w-2xl">
        <h3 className="font-bold text-lg mb-4">Gutschein-Details</h3>

        {/* Main info */}
        <div className="bg-base-200 rounded-lg p-4 mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-3xl font-bold">
              {voucher.amount} {voucher.unit}
            </span>
            <span
              className={`badge ${
                status === 'active'
                  ? 'badge-success'
                  : status === 'redeemed'
                  ? 'badge-neutral'
                  : 'badge-error'
              }`}
            >
              {status === 'active'
                ? 'Aktiv'
                : status === 'redeemed'
                ? 'Eingeloest'
                : 'Abgelaufen'}
            </span>
          </div>
          {voucher.note && (
            <p className="text-base-content/70 mb-4">{voucher.note}</p>
          )}

          {/* Signature status */}
          {validationResult && (
            <div className="flex flex-wrap gap-4 mt-2 pt-2 border-t border-base-300">
              <SignatureStatus
                status={validationResult.issuerSignatureStatus}
                label="Aussteller-Signatur"
              />
              <SignatureStatus
                status={validationResult.overallStatus}
                label="Gesamt"
              />
            </div>
          )}
        </div>

        {/* Metadata */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <span className="text-xs text-base-content/50">Aussteller</span>
            <div className="flex items-center gap-2 mt-1">
              <UserAvatar
                did={voucher.issuerId}
                avatarUrl={identities[voucher.issuerId]?.avatarUrl}
                size={24}
              />
              <span className="font-medium">
                {isIssuer ? 'Du' : getDisplayName(voucher.issuerId, identities)}
              </span>
            </div>
          </div>
          <div>
            <span className="text-xs text-base-content/50">Aktueller Inhaber</span>
            <div className="flex items-center gap-2 mt-1">
              <UserAvatar
                did={voucher.currentHolderId}
                avatarUrl={identities[voucher.currentHolderId]?.avatarUrl}
                size={24}
              />
              <span className="font-medium">
                {isHolder
                  ? 'Du'
                  : getDisplayName(voucher.currentHolderId, identities)}
              </span>
            </div>
          </div>
          <div>
            <span className="text-xs text-base-content/50">Erstellt am</span>
            <p className="font-medium">{formatDateTime(voucher.createdAt)}</p>
          </div>
          {voucher.expiresAt && (
            <div>
              <span className="text-xs text-base-content/50">
                Gueltig bis
              </span>
              <p className="font-medium">{formatDateTime(voucher.expiresAt)}</p>
            </div>
          )}
          {voucher.redeemedAt && (
            <div>
              <span className="text-xs text-base-content/50">
                Eingeloest am
              </span>
              <p className="font-medium">{formatDateTime(voucher.redeemedAt)}</p>
            </div>
          )}
        </div>

        {/* Transfer chain */}
        <div className="mb-4">
          <h4 className="font-semibold mb-2">
            Weitergabe-Verlauf ({voucher.transfers.length + 1} Stationen)
          </h4>

          <ul className="timeline timeline-vertical">
            {/* Initial creation */}
            <li>
              <div className="timeline-start text-xs text-base-content/50">
                {formatDateTime(voucher.createdAt)}
              </div>
              <div className="timeline-middle">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className="h-5 w-5 text-primary"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div className="timeline-end timeline-box">
                <div className="flex items-center gap-2">
                  <UserAvatar
                    did={voucher.issuerId}
                    avatarUrl={identities[voucher.issuerId]?.avatarUrl}
                    size={20}
                  />
                  <span className="font-medium">
                    {getDisplayName(voucher.issuerId, identities)}
                  </span>
                </div>
                <p className="text-sm text-base-content/70">
                  Ausgestellt an{' '}
                  <strong>
                    {getDisplayName(voucher.initialRecipientId, identities)}
                  </strong>
                </p>
                {validationResult && (
                  <SignatureStatus
                    status={validationResult.issuerSignatureStatus}
                    label="Signatur"
                  />
                )}
              </div>
              <hr />
            </li>

            {/* Transfers */}
            {voucher.transfers.map((transfer, index) => (
              <li key={transfer.id}>
                <hr />
                <div className="timeline-start text-xs text-base-content/50">
                  {formatDateTime(transfer.timestamp)}
                </div>
                <div className="timeline-middle">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    className="h-5 w-5 text-secondary"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <div className="timeline-end timeline-box">
                  <div className="flex items-center gap-2">
                    <UserAvatar
                      did={transfer.fromId}
                      avatarUrl={identities[transfer.fromId]?.avatarUrl}
                      size={20}
                    />
                    <span className="font-medium">
                      {getDisplayName(transfer.fromId, identities)}
                    </span>
                    <span className="text-base-content/50">→</span>
                    <UserAvatar
                      did={transfer.toId}
                      avatarUrl={identities[transfer.toId]?.avatarUrl}
                      size={20}
                    />
                    <span className="font-medium">
                      {getDisplayName(transfer.toId, identities)}
                    </span>
                  </div>
                  {transfer.note && (
                    <p className="text-sm text-base-content/70">
                      &quot;{transfer.note}&quot;
                    </p>
                  )}
                  {validationResult && (
                    <SignatureStatus
                      status={
                        validationResult.transferSignatureStatuses[index] ||
                        'unknown'
                      }
                      label="Signatur"
                    />
                  )}
                </div>
                {index < voucher.transfers.length - 1 && <hr />}
              </li>
            ))}
          </ul>
        </div>

        {/* Technical ID */}
        <div className="text-xs text-base-content/30 mb-4">
          ID: {voucher.id}
        </div>

        {/* Close button */}
        <div className="modal-action">
          <button className="btn" onClick={onClose}>
            Schliessen
          </button>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button onClick={onClose}>close</button>
      </form>
    </dialog>
  );
}
