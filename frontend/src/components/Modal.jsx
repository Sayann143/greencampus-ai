import React, { useEffect } from 'react';

/**
 * Reusable modal component with simple fade‑in/out animation using Tailwind.
 * Props:
 *  - isOpen: boolean – controls visibility
 *  - onClose: () => void – callback when the overlay or close button is clicked
 *  - children: ReactNode – modal content
 */
export default function Modal({ isOpen, onClose, children }) {
  // Prevent background scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40 backdrop-blur-sm transition-opacity duration-300"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6 relative animate-[fadeIn_0.3s_ease-out]"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          className="absolute top-2 right-2 text-gray-500 hover:text-gray-700"
          onClick={onClose}
          aria-label="Close modal"
        >
          ×
        </button>
        {children}
      </div>
    </div>
  );
}

// Tailwind custom animation (fallback if not defined in config)
// Add this to your index.css if you need a custom keyframe:
// @layer utilities {
//   @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
//   .animate-\[fadeIn_0\.3s_ease-out\] { animation: fadeIn 0.3s ease-out; }
// }
