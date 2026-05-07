import React from 'react';

interface Props {
  height?: number | string;
  width?: number | string;
  className?: string;
}

export function Skeleton({ height = 16, width = '100%', className = '' }: Props) {
  return (
    <span
      className={`block rounded ${className}`}
      style={{
        height,
        width,
        background:
          'linear-gradient(90deg, var(--bg) 0%, var(--surface) 50%, var(--bg) 100%)',
        backgroundSize: '200% 100%',
        animation: 'shimmer 1.4s infinite',
      }}
    />
  );
}

const css = `
@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
`;

if (typeof document !== 'undefined' && !document.getElementById('skeleton-keyframes')) {
  const s = document.createElement('style');
  s.id = 'skeleton-keyframes';
  s.textContent = css;
  document.head.appendChild(s);
}

export function SkeletonCard({ height = 140 }: { height?: number }) {
  return (
    <div className="g" style={{ minHeight: height }}>
      <Skeleton height={10} width={80} />
      <div className="mt-3"><Skeleton height={32} width="60%" /></div>
      <div className="mt-2"><Skeleton height={10} width="80%" /></div>
    </div>
  );
}
