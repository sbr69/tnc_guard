import React from 'react';

interface ClayCardProps {
  children: React.ReactNode;
  hoverable?: boolean;
  variant?: 'default' | 'low' | 'medium' | 'high';
  className?: string;
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
  id?: string;
  style?: React.CSSProperties;
}

export const ClayCard: React.FC<ClayCardProps> = ({
  children,
  className = '',
  hoverable = false,
  variant = 'default',
  onClick,
  id,
  style
}) => {
  const getVariantClass = () => {
    switch (variant) {
      case 'low':
        return 'clay-card-low';
      case 'medium':
        return 'clay-card-medium';
      case 'high':
        return 'clay-card-high';
      default:
        return 'clay-card';
    }
  };

  return (
    <div
      id={id}
      onClick={onClick}
      style={style}
      className={`
        ${getVariantClass()}
        ${hoverable && variant === 'default' ? 'clay-card-interactive cursor-pointer' : ''}
        p-6
        ${className}
      `}
    >
      {children}
    </div>
  );
};
