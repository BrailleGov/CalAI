import { useEffect, useId, useRef } from 'react';
import type { ReactNode } from 'react';
import { IconX } from './icons';

type SheetProps = {
  open: boolean;
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
};

export function Sheet({ open, title, subtitle, children, footer, onClose }: SheetProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      dialog.showModal();
      document.body.classList.add('sheet-open');
    } else if (!open && dialog.open) {
      dialog.close();
    }

    return () => {
      document.body.classList.remove('sheet-open');
    };
  }, [open]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleClose = () => {
      document.body.classList.remove('sheet-open');
      onClose();
    };

    const handleBackdropClick = (event: MouseEvent) => {
      if (event.target === dialog) onClose();
    };

    dialog.addEventListener('close', handleClose);
    dialog.addEventListener('click', handleBackdropClick);

    return () => {
      dialog.removeEventListener('close', handleClose);
      dialog.removeEventListener('click', handleBackdropClick);
    };
  }, [onClose]);

  return (
    <dialog ref={dialogRef} className="sheet" aria-labelledby={titleId}>
      <div className="sheet-inner">
        <header className="sheet-head">
          <div className="sheet-title">
            <h2 id={titleId}>{title}</h2>
            {subtitle ? <p>{subtitle}</p> : null}
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close">
            <IconX size={18} />
          </button>
        </header>
        <div className="sheet-body">{children}</div>
        {footer ? <footer className="sheet-foot">{footer}</footer> : null}
      </div>
    </dialog>
  );
}
