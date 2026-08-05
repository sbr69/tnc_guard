import React from 'react';

interface ClayButtonProps {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary';
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  className?: string;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  disabled?: boolean;
  type?: 'button' | 'submit' | 'reset';
  id?: string;
  style?: React.CSSProperties;
}

export const ClayButton: React.FC<ClayButtonProps> = ({
  children,
  variant = 'primary',
  className = '',
  icon,
  iconPosition = 'right',
  onClick,
  disabled,
  type = 'button',
  id,
  style
}) => {
  const getVariantClass = () => {
    return variant === 'primary' ? 'clay-btn-primary' : 'clay-btn-secondary';
  };

  return (
    <button
      id={id}
      type={type}
      disabled={disabled}
      onClick={onClick}
      style={style}
      className={`
        clay-btn
        ${getVariantClass()}
        px-6 py-3 text-sm tracking-wide
        ${className}
      `}
    >
      {icon && iconPosition === 'left' && (
        <span className="mr-2 flex items-center">{icon}</span>
      )}
      <span>{children}</span>
      {icon && iconPosition === 'right' && (
        <span className="ml-2 flex items-center">{icon}</span>
      )}
    </button>
  );
};
