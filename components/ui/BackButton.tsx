import React from 'react';
import { useNavigate } from 'react-router-dom';

export const BackButton = ({ className = '' }: { className?: string }) => {
  const navigate = useNavigate();
  return (
    <button
      onClick={() => navigate(-1)}
      className={`inline-flex items-center px-3 py-1 rounded-md text-sm bg-base-200 hover:bg-base-300 text-gray-300 ${className}`}
    >
      ← Volver
    </button>
  );
};
