import cn from "classnames";
import { forwardRef, type InputHTMLAttributes } from "react";
import "./style.css";

export type InlineTextFieldProps = InputHTMLAttributes<HTMLInputElement>;

export const InlineTextField = forwardRef<HTMLInputElement, InlineTextFieldProps>(
  function InlineTextField({ className, type = "text", ...rest }, ref) {
    return (
      <input
        ref={ref}
        type={type}
        className={cn("inline-text-field", className)}
        {...rest}
      />
    );
  },
);
