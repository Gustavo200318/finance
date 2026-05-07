import React from 'react';

interface Props extends React.HTMLAttributes<HTMLElement> {
  name: string;
  size?: number | string;
}

export default function Ti({ name, size, className = '', style, ...rest }: Props) {
  const finalStyle: React.CSSProperties = { ...(style || {}) };
  if (size != null) finalStyle.fontSize = typeof size === 'number' ? `${size}px` : size;
  return <i className={`ti ti-${name} ${className}`} style={finalStyle} {...rest} />;
}
