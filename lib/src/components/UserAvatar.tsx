import Avatar from 'boring-avatars';

interface UserAvatarProps {
  did: string;
  avatarUrl?: string;
  size: number;
  className?: string;
  /** If provided, makes the avatar clickable */
  onClick?: () => void;
}

// Simple hash function to create consistent avatar seeds
function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
}

/**
 * UserAvatar component that shows either custom avatar or boring-avatars fallback
 * Optionally clickable when onClick is provided
 */
export function UserAvatar({ did, avatarUrl, size, className = '', onClick }: UserAvatarProps) {
  const clickableClass = onClick ? 'cursor-pointer hover:ring-2 hover:ring-primary hover:ring-offset-2 transition-all' : '';

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt="Avatar"
        style={{ width: size, height: size }}
        className={`object-cover rounded-full flex-shrink-0 ${clickableClass} ${className}`}
        onClick={onClick}
        role={onClick ? 'button' : undefined}
        tabIndex={onClick ? 0 : undefined}
        onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') onClick(); } : undefined}
      />
    );
  }

  return (
    <div
      className={`rounded-full overflow-hidden flex-shrink-0 ${clickableClass}`}
      style={{ width: size, height: size }}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') onClick(); } : undefined}
    >
      <Avatar
        size={size}
        name={hashString(did)}
        variant="marble"
        colors={["#fdbf5c", "#f69a0b", "#d43a00", "#9b0800", "#1d2440"]}
      />
    </div>
  );
}
