import cn from 'classnames';
import React from 'react';
import './style.css';

interface ButtonProps {
    children: React.ReactNode;
    onClick: () => void;
    type?: 'button' | 'submit' | 'reset';
    className?: string;
    disabled?: boolean;
    onKeyDown?: (event: React.KeyboardEvent<HTMLButtonElement>) => void;
    title?: string;
    variant?: 'primary' | 'secondary' | 'danger' | 'outline' | 'ghost';
}

export const Button: React.FC<ButtonProps> = ({ children, onClick, type = 'button', className, disabled, onKeyDown, title, variant = 'primary', }) => {
    return (
        <button
            className={cn('button', className, variant)}
            onClick={onClick}
            type={type}
            disabled={disabled}
            onKeyDown={onKeyDown}
            title={title}
        >
            {children}
        </button>
    );
};
