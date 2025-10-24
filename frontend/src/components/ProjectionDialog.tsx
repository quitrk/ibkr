import { useState, useEffect } from 'react';
import type { ProjectionConfig } from '../types/trackers';
import { Dialog } from './Dialog';
import { useToast } from '../contexts/ToastContext';
import { ToastDuration } from './Toast';

interface ProjectionDialogProps {
  isOpen: boolean;
  projection?: ProjectionConfig; // If provided, edit mode
  onSave: (projection: Omit<ProjectionConfig, 'id'> & { id?: string }) => void;
  onCancel: () => void;
}

export function ProjectionDialog({
  isOpen,
  projection,
  onSave,
  onCancel,
}: ProjectionDialogProps) {
  const [name, setName] = useState('');
  const [increasePercent, setIncreasePercent] = useState('');
  const [intervalDays, setIntervalDays] = useState('');
  const [visible, setVisible] = useState(true);
  const { showError } = useToast();

  // Reset form when dialog opens or projection changes
  useEffect(() => {
    if (isOpen) {
      setName(projection?.name || '');
      setIncreasePercent(projection?.increasePercent.toString() || '');
      setIntervalDays(projection?.intervalDays.toString() || '');
      setVisible(projection?.visible ?? true);
    }
  }, [isOpen, projection]);

  const handleSave = () => {
    const increase = parseFloat(increasePercent);
    const days = parseInt(intervalDays, 10);

    if (isNaN(increase) || isNaN(days) || days < 1) {
      showError('Please enter valid values', ToastDuration.Short);
      return;
    }

    onSave({
      id: projection?.id,
      name: name.trim() || undefined,
      increasePercent: increase,
      intervalDays: days,
      visible,
    });
  };

  return (
    <Dialog
      isOpen={isOpen}
      title={projection ? 'Edit Projection' : 'Add Projection'}
      onCancel={onCancel}
      maxWidth="small"
      actions={
        <button
          type="button"
          onClick={handleSave}
          className="btn-primary"
        >
          {projection ? 'Save' : 'Add'}
        </button>
      }
    >
      <div className="form-group">
        <label htmlFor="projectionName">Name (optional)</label>
        <input
          type="text"
          id="projectionName"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Conservative, Optimistic, etc."
        />
      </div>

      <div className="form-group">
        <label htmlFor="increasePercent">Projected Increase (%) *</label>
        <input
          type="number"
          id="increasePercent"
          value={increasePercent}
          onChange={(e) => setIncreasePercent(e.target.value)}
          placeholder="1"
          step="0.01"
          required
        />
      </div>

      <div className="form-group">
        <label htmlFor="intervalDays">Interval (days) *</label>
        <input
          type="number"
          id="intervalDays"
          value={intervalDays}
          onChange={(e) => setIntervalDays(e.target.value)}
          placeholder="30"
          min="1"
          required
        />
      </div>

      <div className="form-group">
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={visible}
            onChange={(e) => setVisible(e.target.checked)}
          />
          <span>Visible on chart</span>
        </label>
      </div>
    </Dialog>
  );
}
