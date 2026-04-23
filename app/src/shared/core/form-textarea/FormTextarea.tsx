import cn from "classnames";
import {
  forwardRef,
  useId,
  type ReactNode,
  type TextareaHTMLAttributes,
} from "react";
import "./style.css";

export type FormTextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: ReactNode;
  /** className корневого блока (отступы, сетка) */
  rootClassName?: string;
};

export const FormTextarea = forwardRef<HTMLTextAreaElement, FormTextareaProps>(
  function FormTextarea(
    { className, label, id, rootClassName, ...rest },
    ref,
  ) {
    const autoId = useId();
    const inputId = id ?? autoId;
    const hasLabel = label != null && label !== "";

    return (
      <div
        className={cn(
          "form-textarea",
          hasLabel && "form-textarea--with-label",
          rootClassName,
        )}
      >
        {hasLabel ? (
          <label className="form-textarea__label" htmlFor={inputId}>
            {label}
          </label>
        ) : null}
        <textarea
          ref={ref}
          id={inputId}
          className={cn("native-text-input", "form-textarea__control", className)}
          {...rest}
        />
      </div>
    );
  },
);
