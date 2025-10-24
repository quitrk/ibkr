import { useState } from 'react';
import type { ProjectionConfig } from '../types/trackers';
import { ProjectionDialog } from './ProjectionDialog';
import './ProjectionsList.css';

interface ProjectionsListProps {
  projections: ProjectionConfig[];
  onChange: (projections: ProjectionConfig[]) => void;
}

export function ProjectionsList({ projections, onChange }: ProjectionsListProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProjection, setEditingProjection] = useState<ProjectionConfig | undefined>(undefined);

  const handleAddClick = () => {
    setEditingProjection(undefined);
    setDialogOpen(true);
  };

  const handleEditClick = (projection: ProjectionConfig) => {
    setEditingProjection(projection);
    setDialogOpen(true);
  };

  const handleDialogSave = (projectionData: Omit<ProjectionConfig, 'id'> & { id?: string }) => {
    if (projectionData.id) {
      // Edit existing
      onChange(
        projections.map(p =>
          p.id === projectionData.id
            ? { ...projectionData, id: projectionData.id }
            : p
        )
      );
    } else {
      // Add new
      onChange([
        ...projections,
        {
          ...projectionData,
          id: crypto.randomUUID(),
        }
      ]);
    }
    setDialogOpen(false);
  };

  const handleRemove = (id: string) => {
    onChange(projections.filter(p => p.id !== id));
  };

  const handleToggleVisibility = (id: string) => {
    onChange(projections.map(p =>
      p.id === id ? { ...p, visible: !p.visible } : p
    ));
  };

  return (
    <div className="projections-container">
      <div className="projections-header">
        <div className="form-section-title">
          Projections
          <small className="form-hint">Add one or more projection scenarios to visualize different outcomes</small>
        </div>
        <button
          type="button"
          onClick={handleAddClick}
          className="btn-add-projection-icon"
          title="Add projection"
        >
          +
        </button>
      </div>

      {projections.length > 0 && (
        <div className="projections-list">
          {projections.map((projection, index) => (
          <div key={projection.id} className="projection-item">
            <div className="projection-info">
              <span className="projection-name">
                {projection.name || `Projection ${index + 1}`}
              </span>
              <span className="projection-details">
                {projection.increasePercent}% every {projection.intervalDays} days
                {!projection.visible && ' (hidden)'}
              </span>
            </div>
            <div className="projection-actions">
              <button
                type="button"
                onClick={() => handleToggleVisibility(projection.id)}
                className="btn-icon"
                title={projection.visible ? 'Hide projection' : 'Show projection'}
              >
                {projection.visible ? '✓' : '✕'}
              </button>
              <button
                type="button"
                onClick={() => handleEditClick(projection)}
                className="btn-icon"
                title="Edit projection"
              >
                ✏️
              </button>
              <button
                type="button"
                onClick={() => handleRemove(projection.id)}
                className="btn-icon"
                title="Remove projection"
              >
                🗑
              </button>
            </div>
          </div>
          ))}
        </div>
      )}

      <ProjectionDialog
        isOpen={dialogOpen}
        projection={editingProjection}
        onSave={handleDialogSave}
        onCancel={() => setDialogOpen(false)}
      />
    </div>
  );
}
