import { ReactNode } from 'react';
import './Dialog.css';

interface DialogProps {
  isOpen: boolean;
  title: string;
  children: ReactNode;
  actions?: ReactNode;
  onCancel: () => void;
  maxWidth?: 'small' | 'medium' | 'large';
}

export function Dialog({
  isOpen,
  title,
  children,
  actions,
  onCancel,
  maxWidth = 'medium',
}: DialogProps) {
  if (!isOpen) return null;

  return (
    <>
      <div className="dialog-backdrop" onClick={onCancel} />
      <dialog open className={`dialog dialog-${maxWidth}`}>
        <div className="dialog-content">
          <div className="dialog-header">
            <h3>{title}</h3>
            <button
              type="button"
              className="dialog-close"
              onClick={onCancel}
              aria-label="Close dialog"
            >
              ✕
            </button>
          </div>
          <div className="dialog-body">
            {children}
          </div>
          <div className="dialog-footer">
            <div className="dialog-actions">
              {actions}
              <button
                type="button"
                onClick={onCancel}
                className="btn-secondary"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </dialog>
    </>
  );
}
