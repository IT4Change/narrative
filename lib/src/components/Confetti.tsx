import { useEffect, useState } from 'react';

interface ConfettiPiece {
  id: number;
  x: number;
  delay: number;
  duration: number;
  color: string;
  size: number;
  rotation: number;
}

const COLORS = [
  '#ff6b6b', // red
  '#feca57', // yellow
  '#48dbfb', // cyan
  '#ff9ff3', // pink
  '#54a0ff', // blue
  '#5f27cd', // purple
  '#00d2d3', // teal
  '#1dd1a1', // green
];

interface ConfettiProps {
  /** Whether to show confetti */
  isActive: boolean;
  /** Duration in ms before auto-hiding */
  duration?: number;
  /** Number of confetti pieces */
  pieces?: number;
  /** Callback when animation completes */
  onComplete?: () => void;
}

/**
 * Confetti animation component
 * CSS-only implementation for celebration effects
 */
export function Confetti({
  isActive,
  duration = 3000,
  pieces = 50,
  onComplete,
}: ConfettiProps) {
  const [confettiPieces, setConfettiPieces] = useState<ConfettiPiece[]>([]);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (isActive) {
      // Generate confetti pieces
      const newPieces: ConfettiPiece[] = [];
      for (let i = 0; i < pieces; i++) {
        newPieces.push({
          id: i,
          x: Math.random() * 100, // 0-100% horizontal position
          delay: Math.random() * 0.5, // 0-0.5s delay
          duration: 2 + Math.random() * 2, // 2-4s fall duration
          color: COLORS[Math.floor(Math.random() * COLORS.length)],
          size: 8 + Math.random() * 8, // 8-16px
          rotation: Math.random() * 360, // initial rotation
        });
      }
      setConfettiPieces(newPieces);
      setIsVisible(true);

      // Auto-hide after duration
      const timer = setTimeout(() => {
        setIsVisible(false);
        setConfettiPieces([]);
        onComplete?.();
      }, duration);

      return () => clearTimeout(timer);
    } else {
      setIsVisible(false);
      setConfettiPieces([]);
    }
  }, [isActive, duration, pieces, onComplete]);

  if (!isVisible || confettiPieces.length === 0) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 pointer-events-none z-[99999] overflow-hidden"
      aria-hidden="true"
    >
      {confettiPieces.map((piece) => (
        <div
          key={piece.id}
          className="absolute animate-confetti-fall"
          style={{
            left: `${piece.x}%`,
            top: '-20px',
            animationDelay: `${piece.delay}s`,
            animationDuration: `${piece.duration}s`,
          }}
        >
          <div
            className="animate-confetti-spin"
            style={{
              width: `${piece.size}px`,
              height: `${piece.size}px`,
              backgroundColor: piece.color,
              transform: `rotate(${piece.rotation}deg)`,
              borderRadius: Math.random() > 0.5 ? '50%' : '2px',
            }}
          />
        </div>
      ))}
      <style>{`
        @keyframes confetti-fall {
          0% {
            transform: translateY(0) translateX(0);
            opacity: 1;
          }
          100% {
            transform: translateY(100vh) translateX(${Math.random() > 0.5 ? '' : '-'}${20 + Math.random() * 40}px);
            opacity: 0;
          }
        }
        @keyframes confetti-spin {
          0% {
            transform: rotate(0deg) scale(1);
          }
          50% {
            transform: rotate(180deg) scale(0.8);
          }
          100% {
            transform: rotate(360deg) scale(1);
          }
        }
        .animate-confetti-fall {
          animation: confetti-fall linear forwards;
        }
        .animate-confetti-spin {
          animation: confetti-spin 1s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
