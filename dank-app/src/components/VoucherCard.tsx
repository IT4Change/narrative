/**
 * VoucherCard - Display a single voucher with signature status
 */

import type { Voucher, ValidationResult, SignatureStatus } from '../schema';
import { getVoucherStatus } from '../schema';
import { UserAvatar } from 'narrative-ui';
import type { IdentityProfile } from 'narrative-ui';

interface VoucherCardProps {
  voucher: Voucher;
  validationResult?: ValidationResult;
  identities: Record<string, IdentityProfile>;
  currentUserDid: string;
  onTransfer?: (voucherId: string) => void;
  onViewDetails?: (voucherId: string) => void;
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
 * Signature status indicator
 */
function SignatureIndicator({ status }: { status: SignatureStatus }) {
  switch (status) {
    case 'valid':
      return (
        <div className="tooltip" data-tip="Signatur gueltig">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5 text-success"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
              clipRule="evenodd"
            />
          </svg>
        </div>
      );
    case 'invalid':
      return (
        <div className="tooltip" data-tip="Signatur ungueltig!">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5 text-error"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
              clipRule="evenodd"
            />
          </svg>
        </div>
      );
    case 'unknown':
    default:
      return (
        <div className="tooltip" data-tip="Signatur nicht pruefbar">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5 text-warning"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z"
              clipRule="evenodd"
            />
          </svg>
        </div>
      );
  }
}

/**
 * Format date for display
 */
function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/**
 * Status badge
 */
function StatusBadge({ voucher }: { voucher: Voucher }) {
  const status = getVoucherStatus(voucher);

  switch (status) {
    case 'active':
      return <span className="badge badge-success badge-sm">Aktiv</span>;
    case 'redeemed':
      return <span className="badge badge-neutral badge-sm">Eingeloest</span>;
    case 'expired':
      return <span className="badge badge-error badge-sm">Abgelaufen</span>;
  }
}

export function VoucherCard({
  voucher,
  validationResult,
  identities,
  currentUserDid,
  onTransfer,
  onViewDetails,
}: VoucherCardProps) {
  const status = getVoucherStatus(voucher);
  const isHolder = voucher.currentHolderId === currentUserDid;
  const isIssuer = voucher.issuerId === currentUserDid;
  const canTransfer = isHolder && status === 'active';

  return (
    <div className="card bg-base-100 shadow-md hover:shadow-lg transition-shadow">
      <div className="card-body p-4">
        {/* Header: Amount + Unit + Signature Status */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold">{voucher.amount}</span>
            <span className="text-lg text-base-content/70">{voucher.unit}</span>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge voucher={voucher} />
            {validationResult && (
              <SignatureIndicator status={validationResult.overallStatus} />
            )}
          </div>
        </div>

        {/* Note */}
        {voucher.note && (
          <p className="text-sm text-base-content/70 mt-1">{voucher.note}</p>
        )}

        {/* Issuer */}
        <div className="flex items-center gap-2 mt-2">
          <UserAvatar
            did={voucher.issuerId}
            avatarUrl={identities[voucher.issuerId]?.avatarUrl}
            size={24}
          />
          <span className="text-sm">
            {isIssuer ? (
              <span className="font-medium">Von dir ausgestellt</span>
            ) : (
              <>
                Von{' '}
                <span className="font-medium">
                  {getDisplayName(voucher.issuerId, identities)}
                </span>
              </>
            )}
          </span>
        </div>

        {/* Dates */}
        <div className="flex items-center gap-4 text-xs text-base-content/50 mt-2">
          <span>Erstellt: {formatDate(voucher.createdAt)}</span>
          {voucher.expiresAt && (
            <span>Gueltig bis: {formatDate(voucher.expiresAt)}</span>
          )}
        </div>

        {/* Transfer chain info */}
        {voucher.transfers.length > 0 && (
          <div className="text-xs text-base-content/50 mt-1">
            {voucher.transfers.length} Weitergabe
            {voucher.transfers.length !== 1 ? 'n' : ''}
          </div>
        )}

        {/* Actions */}
        <div className="card-actions justify-end mt-3">
          {onViewDetails && (
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => onViewDetails(voucher.id)}
            >
              Details
            </button>
          )}
          {canTransfer && onTransfer && (
            <button
              className="btn btn-primary btn-sm"
              onClick={() => onTransfer(voucher.id)}
            >
              Weitergeben
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
