import React from 'react';

/**
 * The campaign's main call-to-action button — Participate, I Agree, Submit.
 * Red #e22000 (4.73:1 with white, WCAG AA), 52px tall, half the width of its
 * container, centred. Callers add only spacing (e.g. `mt-8`).
 */
export const PrimaryButton: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement>> = ({
  className = '',
  type = 'button',
  ...props
}) => (
  <button
    type={type}
    className={`block mx-auto w-1/2 h-[52px] bg-[#e22000] hover:bg-[#c41c00] active:bg-[#a81800] text-white text-[17px] font-semibold whitespace-nowrap rounded-[980px] transition cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e22000] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-[#e22000] ${className}`}
    {...props}
  />
);
