import React from 'react';

export const PageFooter: React.FC = () => (
  <footer className="w-full py-6 text-center border-t border-[#f5f5f7]">
    <p className="text-[12px] text-[#86868b]">
      &copy; {new Date().getFullYear()} MYDATA Analytics Sdn Bhd | All rights reserved.
    </p>
  </footer>
);
