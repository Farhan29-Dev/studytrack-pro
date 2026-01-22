import React from 'react';

interface StudyTrackLogoProps {
  className?: string;
  size?: number;
}

export function StudyTrackLogo({ className = "", size = 24 }: StudyTrackLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Book */}
      <path
        d="M4 6C4 4.89543 4.89543 4 6 4H18C19.1046 4 20 4.89543 20 6V18C20 19.1046 19.1046 20 18 20H6C4.89543 20 4 19.1046 4 18V6Z"
        fill="currentColor"
        opacity="0.9"
      />
      <path
        d="M8 8H16M8 12H16M8 16H12"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      {/* Brain/spark */}
      <path
        d="M19 9C19 7.34315 17.6569 6 16 6C14.3431 6 13 7.34315 13 9C13 10.6569 14.3431 12 16 12"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="none"
      />
      <circle cx="16" cy="9" r="1" fill="currentColor" />
      <path
        d="M16 12V14M14 13H18"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}