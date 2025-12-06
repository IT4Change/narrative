import Avatar from 'boring-avatars';

interface UserAvatarProps {
  did: string;
  avatarUrl?: string;
  /** Size in pixels. Use 'full' to fill the parent container (recommended for zoom-safe layouts) */
  size: number | 'full';
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
  const isFull = size === 'full';
  const sizeStyle = isFull ? { width: '100%', height: '100%' } : { width: size, height: size };

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt="Avatar"
        style={sizeStyle}
        className={`object-cover rounded-full flex-shrink-0 ${clickableClass} ${className}`}
        onClick={onClick}
        role={onClick ? 'button' : undefined}
        tabIndex={onClick ? 0 : undefined}
        onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') onClick(); } : undefined}
      />
    );
  }

  // For boring-avatars, we need a numeric size
  const avatarSize = isFull ? 100 : size;

  return (
    <div
      className={`rounded-full overflow-hidden flex-shrink-0 ${clickableClass}`}
      style={sizeStyle}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') onClick(); } : undefined}
    >
      {/* Wrapper div scales the SVG to fill container when size="full" */}
      <div className={isFull ? '[&>svg]:w-full [&>svg]:h-full' : ''}>
        <Avatar
          size={avatarSize}
          name={hashString(did)}
          variant="marble"
          colors={["#fdbf5c", "#f69a0b", "#d43a00", "#9b0800", "#1d2440"]}
        />
      </div>
    </div>
  );
}
