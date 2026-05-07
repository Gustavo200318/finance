import React from 'react';

interface Props {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  note?: React.ReactNode;
  badges?: React.ReactNode;
}

export default function Hero({ eyebrow, title, note, badges }: Props) {
  return (
    <section className="flex items-end justify-between gap-4">
      <div>
        {eyebrow && <div className="hero-eyebrow">{eyebrow}</div>}
        <h1 className="hero-h">{title}</h1>
        {note && <p className="hero-note">{note}</p>}
      </div>
      {badges && <div className="flex items-center gap-2 flex-shrink-0">{badges}</div>}
    </section>
  );
}
