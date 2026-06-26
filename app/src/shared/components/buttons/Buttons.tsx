import cn from "classnames";
import type { ButtonHTMLAttributes } from "react";
import "./buttons.css";

export type IconActionButtonProps = ButtonHTMLAttributes<HTMLButtonElement>;

function AddButton({ className, children = "+", type = "button", ...rest }: IconActionButtonProps) {
  return (
    <button type={type} className={cn("icon-action-add", className)} {...rest}>
      {children}
    </button>
  );
}

export type DeleteButtonProps = IconActionButtonProps & {
  variant?: "playlist" | "scene";
};

function DeleteButton({ className, variant = "playlist", type = "button", children = "×", ...rest }: DeleteButtonProps) {
  return (
    <button
      type={type}
      className={cn("icon-action-delete", className)}
      {...rest}
    >
      {children}
    </button>
  );
}

export type CloseButtonProps = IconActionButtonProps & {
  variant?: "floating" | "inline" | "markdownLightbox";
};

function TextButton({ className, type = "button", ...rest }: IconActionButtonProps) {
  return (
    <button type={type} className={cn("ui-text-button", className)} {...rest} />
  );
}

function CloseButton({ className, variant = "inline", type = "button", children = "×", ...rest }: CloseButtonProps) {
  const variantClass =
    variant === "floating"
      ? "icon-action-close--floating"
      : variant === "markdownLightbox"
        ? "icon-action-close--markdown-lightbox"
        : undefined;
  return (
    <button type={type} className={cn("icon-action-close", variantClass, className)} {...rest}>
      {children}
    </button>
  );
}

export const Buttons = {
  AddButton,
  CloseButton,
  DeleteButton,
  TextButton,
};
