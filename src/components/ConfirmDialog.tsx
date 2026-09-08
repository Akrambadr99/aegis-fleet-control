import { useEffect, useRef } from 'react';
export function ConfirmDialog({
  title,
  children,
  onCancel,
  onConfirm,
  confirmLabel = 'Discard changes',
}: {
  title: string;
  children: React.ReactNode;
  onCancel: () => void;
  onConfirm: () => void;
  confirmLabel?: string;
}) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const previous = document.activeElement;
    ref.current?.querySelector('button')?.focus();
    return () => {
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus();
    };
  }, []);
  return (
    <div className="modal-backdrop">
      <section
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="discard-dialog"
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.stopPropagation();
            onCancel();
          }
          if (e.key === 'Tab') {
            const buttons = ref.current?.querySelectorAll('button');
            if (!buttons?.length) return;
            if (e.shiftKey && document.activeElement === buttons[0]) {
              e.preventDefault();
              buttons[buttons.length - 1].focus();
            } else if (!e.shiftKey && document.activeElement === buttons[buttons.length - 1]) {
              e.preventDefault();
              buttons[0].focus();
            }
          }
        }}
      >
        <h2>{title}</h2>
        {children}
        <button onClick={onCancel}>Keep editing</button>
        <button onClick={onConfirm}>{confirmLabel}</button>
      </section>
    </div>
  );
}
