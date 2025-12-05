import type { BaseDocument, UserIdentity } from 'narrative-ui';
import { createBaseDocument } from 'narrative-ui';

/**
 * Voucher status
 */
export type VoucherStatus = 'active' | 'redeemed' | 'expired';

/**
 * A single transfer in the voucher's chain of custody
 * Each transfer is signed by the sender, building on the previous signature
 */
export interface Transfer {
  id: string;
  voucherId: string;
  fromId: string;             // DID of sender
  toId: string;               // DID of recipient
  timestamp: number;
  note?: string;

  // Signature of the sender (signs: voucherId, fromId, toId, timestamp, previousSignature)
  signature: string;          // JWS compact serialization
}

/**
 * A voucher (Gutschein) - a promise of value from issuer to holder
 *
 * Lifecycle:
 * 1. Issuer creates voucher, signs it, sends to initial recipient
 * 2. Holder can transfer to another user (signed transfer added to chain)
 * 3. When voucher returns to issuer, it's automatically redeemed
 * 4. If expiresAt is set and passed, voucher expires
 */
export interface Voucher {
  id: string;

  // Creation data (immutable after creation)
  issuerId: string;           // DID of issuer (creator)
  amount: number;             // e.g., 10
  unit: string;               // e.g., "Minuten", "Äpfel", "EUR"
  note?: string;              // Description of the value promise
  createdAt: number;
  expiresAt?: number;         // Optional expiration timestamp

  // Initial recipient
  initialRecipientId: string;

  // Current state
  currentHolderId: string;    // Who currently holds the voucher
  status: VoucherStatus;
  redeemedAt?: number;        // When returned to issuer

  // Issuer's signature (signs: id, issuerId, amount, unit, createdAt, expiresAt, initialRecipientId)
  issuerSignature: string;    // JWS compact serialization

  // Chain of transfers (append-only)
  transfers: Transfer[];
}

/**
 * Aggregated balance for a specific unit
 */
export interface UnitBalance {
  unit: string;
  totalAmount: number;
  voucherCount: number;
  byIssuer: Record<string, number>;  // DID -> amount from that issuer
}

/**
 * Signature validation status
 */
export type SignatureStatus = 'valid' | 'invalid' | 'unknown';

/**
 * Cached validation result for a voucher
 */
export interface ValidationResult {
  voucherId: string;
  issuerSignatureStatus: SignatureStatus;
  transferSignatureStatuses: SignatureStatus[];
  overallStatus: SignatureStatus;
  lastValidated: number;
  error?: string;
}

/**
 * Dank Wallet app-specific data
 */
export interface DankWalletData {
  vouchers: Record<string, Voucher>;
}

/**
 * Full Dank Wallet Document
 */
export type DankWalletDoc = BaseDocument<DankWalletData>;

/**
 * Creates an empty Dank Wallet document
 *
 * @param creatorIdentity - Identity of the user creating the document
 * @param workspaceName - Optional workspace name
 * @param workspaceAvatar - Optional workspace avatar (data URL)
 */
export function createEmptyDankWalletDoc(
  creatorIdentity: UserIdentity,
  workspaceName?: string,
  workspaceAvatar?: string
): DankWalletDoc {
  return createBaseDocument<DankWalletData>(
    {
      vouchers: {},
    },
    creatorIdentity,
    workspaceName,
    workspaceAvatar
  );
}

/**
 * Generate a unique ID for vouchers and transfers
 */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Check if a voucher is expired
 */
export function isVoucherExpired(voucher: Voucher): boolean {
  if (!voucher.expiresAt) return false;
  return Date.now() > voucher.expiresAt;
}

/**
 * Check if a voucher is redeemed (back at issuer)
 */
export function isVoucherRedeemed(voucher: Voucher): boolean {
  return voucher.currentHolderId === voucher.issuerId;
}

/**
 * Get the effective status of a voucher (checking expiration)
 */
export function getVoucherStatus(voucher: Voucher): VoucherStatus {
  if (voucher.status === 'redeemed') return 'redeemed';
  if (isVoucherExpired(voucher)) return 'expired';
  return voucher.status;
}

/**
 * Calculate balances by unit for a given holder
 */
export function calculateBalances(
  vouchers: Record<string, Voucher>,
  holderId: string
): UnitBalance[] {
  const balanceMap = new Map<string, UnitBalance>();

  for (const voucher of Object.values(vouchers)) {
    // Only count active vouchers held by this user
    if (voucher.currentHolderId !== holderId) continue;
    if (getVoucherStatus(voucher) !== 'active') continue;

    const unit = voucher.unit;
    let balance = balanceMap.get(unit);

    if (!balance) {
      balance = {
        unit,
        totalAmount: 0,
        voucherCount: 0,
        byIssuer: {},
      };
      balanceMap.set(unit, balance);
    }

    balance.totalAmount += voucher.amount;
    balance.voucherCount += 1;
    balance.byIssuer[voucher.issuerId] =
      (balance.byIssuer[voucher.issuerId] || 0) + voucher.amount;
  }

  return Array.from(balanceMap.values());
}

/**
 * Get vouchers issued by a specific user
 */
export function getIssuedVouchers(
  vouchers: Record<string, Voucher>,
  issuerId: string
): Voucher[] {
  return Object.values(vouchers).filter(v => v.issuerId === issuerId);
}

/**
 * Get vouchers held by a specific user
 */
export function getHeldVouchers(
  vouchers: Record<string, Voucher>,
  holderId: string
): Voucher[] {
  return Object.values(vouchers).filter(v => v.currentHolderId === holderId);
}

/**
 * Get active vouchers held by a specific user
 */
export function getActiveHeldVouchers(
  vouchers: Record<string, Voucher>,
  holderId: string
): Voucher[] {
  return Object.values(vouchers).filter(
    v => v.currentHolderId === holderId && getVoucherStatus(v) === 'active'
  );
}
