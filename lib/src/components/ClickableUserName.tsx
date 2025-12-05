interface ClickableUserNameProps {
  displayName: string;
  onClick: () => void;
  className?: string;
}

/**
 * A clickable user name that opens the user profile when clicked
 */
export function ClickableUserName({ displayName, onClick, className = '' }: ClickableUserNameProps) {
  return (
    <button
      className={`text-left hover:underline hover:text-primary transition-colors cursor-pointer bg-transparent border-none p-0 font-inherit ${className}`}
      onClick={onClick}
    >
      {displayName}
    </button>
  );
}
