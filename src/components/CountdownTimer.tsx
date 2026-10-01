import React, { useState, useEffect } from 'react';

interface CountdownTimerProps {
  deadlineIso?: string | null;
  onExpired?: () => void;
}

export const CountdownTimer: React.FC<CountdownTimerProps> = ({ deadlineIso, onExpired }) => {
  const [timeLeft, setTimeLeft] = useState<{
    totalSeconds: number;
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
    isExpired: boolean;
    isUnderOneHour: boolean;
  } | null>(null);

  useEffect(() => {
    if (!deadlineIso) {
      setTimeLeft(null);
      return;
    }

    const calculateTime = () => {
      const target = new Date(deadlineIso).getTime();
      const now = Date.now();
      const diff = target - now;

      if (isNaN(target)) {
        return null;
      }

      if (diff <= 0) {
        return {
          totalSeconds: 0,
          days: 0,
          hours: 0,
          minutes: 0,
          seconds: 0,
          isExpired: true,
          isUnderOneHour: true,
        };
      }

      const totalSeconds = Math.floor(diff / 1000);
      const days = Math.floor(totalSeconds / 86400);
      const hours = Math.floor((totalSeconds % 86400) / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;
      const isUnderOneHour = totalSeconds < 3600;

      return {
        totalSeconds,
        days,
        hours,
        minutes,
        seconds,
        isExpired: false,
        isUnderOneHour,
      };
    };

    const initial = calculateTime();
    setTimeLeft(initial);
    if (initial?.isExpired) {
      onExpired?.();
    }

    const interval = setInterval(() => {
      const updated = calculateTime();
      setTimeLeft(updated);
      if (updated?.isExpired) {
        onExpired?.();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [deadlineIso, onExpired]);

  if (!timeLeft) return null;

  const pad = (n: number) => String(n).padStart(2, '0');

  return (
    <div
      id="campaign-countdown-card"
      className="w-full bg-[#f5f5f7] border border-[#e5e5e7] rounded-[16px] p-4 text-center mb-8"
    >
      <div className="text-[12px] font-medium tracking-wide text-[#86868b] uppercase mb-1">
        Masa Berbaki
      </div>
      {timeLeft.isExpired ? (
        <div className="text-[17px] font-semibold text-[#d70015]">
          Kempen telah tamat.
        </div>
      ) : (
        <div
          className={`text-[26px] font-bold tracking-tight font-mono transition-colors duration-200 ${
            timeLeft.isUnderOneHour ? 'text-[#d70015]' : 'text-[#1d1d1f]'
          }`}
        >
          {timeLeft.days > 0 && `${timeLeft.days}h `}
          {pad(timeLeft.hours)}:{pad(timeLeft.minutes)}:{pad(timeLeft.seconds)}
        </div>
      )}
    </div>
  );
};
