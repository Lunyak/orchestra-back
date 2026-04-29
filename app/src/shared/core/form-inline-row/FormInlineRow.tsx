import cn from "classnames";
import type { HTMLAttributes, ReactNode } from "react";
import "./style.css";

export type FormInlineRowProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
};

export function FormInlineRow({ children, className, ...rest }: FormInlineRowProps) {
  return (
    <div className={cn("form-inline-row", className)} {...rest}>
      {children}
    </div>
  );
}
