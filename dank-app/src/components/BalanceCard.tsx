/**
 * BalanceCard - Display aggregated balance for a unit
 */

import type { UnitBalance } from '../schema';
import type { IdentityProfile } from 'narrative-ui';

interface BalanceCardProps {
  balance: UnitBalance;
  identities: Record<string, IdentityProfile>;
}

/**
 * Get display name for a DID
 */
function getDisplayName(
  did: string,
  identities: Record<string, IdentityProfile>
): string {
  return identities[did]?.displayName || did.slice(0, 12) + '...';
}

export function BalanceCard({ balance, identities }: BalanceCardProps) {
  const issuerEntries = Object.entries(balance.byIssuer);

  return (
    <div className="stat bg-base-100 rounded-lg shadow">
      <div className="stat-title">{balance.unit}</div>
      <div className="stat-value text-primary">{balance.totalAmount}</div>
      <div className="stat-desc">
        {balance.voucherCount} Gutschein{balance.voucherCount !== 1 ? 'e' : ''}
      </div>

      {/* Breakdown by issuer */}
      {issuerEntries.length > 1 && (
        <div className="mt-2 pt-2 border-t border-base-200">
          <div className="text-xs text-base-content/50 mb-1">Nach Aussteller:</div>
          <div className="space-y-1">
            {issuerEntries.map(([issuerId, amount]) => (
              <div
                key={issuerId}
                className="flex justify-between text-xs text-base-content/70"
              >
                <span>{getDisplayName(issuerId, identities)}</span>
                <span className="font-medium">{amount}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
