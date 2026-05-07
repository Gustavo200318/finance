import React from 'react';
import Modal from './Modal';
import Ti from './Ti';

interface Props {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  description?: string;
  confirmLabel?: string;
  loading?: boolean;
  destructive?: boolean;
}

export default function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Confirmar',
  loading,
  destructive = true,
}: Props) {
  return (
    <Modal open={open} onClose={onClose} title={title} eyebrow={destructive ? 'Atenção' : 'Confirmação'} width={420}>
      {description && <p className="text-[13px] text-text-2 leading-relaxed mb-6">{description}</p>}
      <div
        className="flex items-center justify-end gap-2 pt-3"
        style={{ borderTop: '0.5px solid var(--border-lt)' }}
      >
        <button
          type="button"
          onClick={onClose}
          className="text-[12px] text-text-3 hover:text-text-1 px-3 py-2 rounded-pill"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={loading}
          className="tb-btn"
          style={destructive ? { background: 'var(--red)' } : undefined}
        >
          <Ti name={destructive ? 'trash' : 'check'} />
          {loading ? 'Aguarde...' : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
