import React from 'react';

export const Header: React.FC = () => {
  return (
    <header className="w-full flex flex-col items-center pt-8 pb-6 text-center">
      <div className="flex items-center justify-center mb-3">
        <img
          src="/logo.svg"
          alt="ZUS Coffee Campaign Logo"
          className="h-10 w-auto object-contain"
          referrerPolicy="no-referrer"
        />
      </div>
    </header>
  );
};
