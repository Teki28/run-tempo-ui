'use client';

import React from 'react';

interface CreditCheckModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentBalance: number;
  requiredCredits: number;
}

export default function CreditCheckModal({ isOpen, onClose, currentBalance, requiredCredits }: CreditCheckModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
        <div className="text-center">
          {/* Warning Icon */}
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
            <svg
              className="h-6 w-6 text-red-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
              />
            </svg>
          </div>

          {/* Title */}
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Insufficient Credits
          </h3>

          {/* Message */}
          <p className="text-sm text-gray-600 mb-4">
            You need at least <span className="font-semibold text-red-600">{requiredCredits} credit(s)</span> to upload.
            <br />
            Your current balance: <span className="font-semibold text-gray-900">{currentBalance} credits</span>
          </p>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors text-sm font-medium"
            >
              Close
            </button>
            <button
              onClick={() => {
                // You can add navigation to a credits page here
                window.open('/credits', '_blank');
                onClose();
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
            >
              Get More Credits
            </button>
          </div>

          {/* Additional Info */}
          <p className="text-xs text-gray-500 mt-4">
            Credits are used for file processing and audio analysis features.
          </p>
        </div>
      </div>
    </div>
  );
} 