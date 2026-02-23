import React from 'react';
import './style.css';

interface ButtonProps {
    children: React.ReactNode;
    onClick: () => void;
    type: 'button' | 'submit' | 'reset';
    className?: string;
    disabled?: boolean;
    onKeyDown?: (event: React.KeyboardEvent<HTMLButtonElement>) => void;
}

export const Button: React.FC<ButtonProps> = ({ children, onClick, type, className, disabled, onKeyDown }) => {
    return (
        <button className={`button ${className}`} onClick={onClick} type={type} disabled={disabled} onKeyDown={onKeyDown}>
            {children}
        </button>
    );
};
