"use client";

import type { MouseEventHandler, ReactNode } from "react";

type Props = {
    children: ReactNode;
    confirmMessage: string;
    className?: string;
};

export function ConfirmSubmitButton({ children, confirmMessage, className }: Props) {
    const onClick: MouseEventHandler<HTMLButtonElement> = (e) => {
        if (!window.confirm(confirmMessage)) {
            e.preventDefault();
            e.stopPropagation();
        }
    };

    return (
        <button type="submit" className={className} onClick={onClick}>
            {children}
        </button>
    );
}
