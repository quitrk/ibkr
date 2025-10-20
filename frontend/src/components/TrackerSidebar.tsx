import { useState, useEffect, useCallback, useRef } from 'react';
import { TrackerEditDialog } from './TrackerEditDialog';
import type { Tracker, TrackerConfig } from '../types/trackers';
import './TrackerSidebar.css';

interface TrackerSidebarProps {
  trackers: Tracker[];
  selectedTracker: Tracker | null;
  onSelectTracker: (tracker: Tracker) => void;
  onCreateTracker: (config: TrackerConfig) => void;
  onDeleteTracker: (id: string) => void;
  onConfigUpdate: (trackerId: string, config: TrackerConfig) => void;
}

export function TrackerSidebar({
  trackers,
  selectedTracker,
  onSelectTracker,
  onCreateTracker,
  onDeleteTracker,
  onConfigUpdate,
}: TrackerSidebarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingTracker, setEditingTracker] = useState<Tracker | null>(null);
  const [sidebarWidth, setSidebarWidth] = useState(480);
  const [isResizing, setIsResizing] = useState(false);
  const [tempWidth, setTempWidth] = useState<number | null>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    const currentWidth = isOpen ? sidebarWidth : 40;
    setTempWidth(currentWidth); // Start from current displayed width
    setIsResizing(true);
    if (!isOpen) {
      setIsOpen(true); // Open sidebar if closed when starting resize
    }
    e.preventDefault();
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizing) return;
    requestAnimationFrame(() => {
      const newWidth = Math.max(40, Math.min(e.clientX, 800)); // Min 40px, max 800px
      setTempWidth(newWidth);
    });
  }, [isResizing]);

  const handleMouseUp = useCallback(() => {
    if (isResizing) {
      if (tempWidth !== null) {
        setSidebarWidth(tempWidth);
      }
      setIsResizing(false);
      setTempWidth(null);
    }
  }, [isResizing, tempWidth]);


  // Add/remove mouse event listeners
  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isResizing, handleMouseMove, handleMouseUp]);

  // Close sidebar when clicking outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (sidebarRef.current && !sidebarRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  return (
    <>
      <TrackerEditDialog
        isOpen={showCreateDialog}
        onSave={(config) => {
          onCreateTracker(config);
          setShowCreateDialog(false);
        }}
        onCancel={() => setShowCreateDialog(false)}
      />

      <TrackerEditDialog
        isOpen={editingTracker !== null}
        tracker={editingTracker}
        onSave={(config) => {
          if (editingTracker) {
            onConfigUpdate(editingTracker.config.id, config);
            setEditingTracker(null);
          }
        }}
        onCancel={() => setEditingTracker(null)}
      />

      {/* Sidebar */}
      <div
        ref={sidebarRef}
        className={`tracker-sidebar ${isOpen ? 'open' : ''} ${isResizing ? 'resizing' : ''}`}
        style={{
          width: (isResizing && tempWidth !== null) ? `${tempWidth}px` : (isOpen ? `${sidebarWidth}px` : '40px'),
          '--sidebar-width': (isResizing && tempWidth !== null) ? `${tempWidth}px` : (isOpen ? `${sidebarWidth}px` : '40px')
        } as React.CSSProperties}
      >
        {/* Toggle Button */}
        <button
          className="sidebar-toggle"
          onClick={() => setIsOpen(!isOpen)}
          title="Toggle trackers"
        >
          ☰
        </button>

        {/* Resize Handle - Always visible */}
        <div
          className="sidebar-resize-handle"
          onMouseDown={handleMouseDown}
        />

        {isOpen && (
          <>
        <div className="sidebar-header">
          <h3>Your Trackers</h3>
        </div>

        <div className="tracker-list">
          {trackers
            .sort((a, b) => {
              // Portfolio tracker always first
              if (a.config.id === 'ibkr-portfolio') return -1;
              if (b.config.id === 'ibkr-portfolio') return 1;
              // Then by creation date
              return new Date(b.config.createdAt).getTime() - new Date(a.config.createdAt).getTime();
            })
            .map((tracker) => (
              <div
                key={tracker.config.id}
                className={`tracker-item ${
                  selectedTracker?.config.id === tracker.config.id ? 'active' : ''
                } ${tracker.config.id === 'ibkr-portfolio' ? 'portfolio-tracker' : ''}`}
              >
                <div>
                  <div
                    className="tracker-info"
                    onClick={() => {
                      onSelectTracker(tracker);
                      setIsOpen(false);
                    }}
                  >
                    <div className="tracker-name">
                      {tracker.config.name}
                      {tracker.config.ibkrSynced && (
                        <span className="ibkr-badge" title="Synced with IBKR">IBKR</span>
                      )}
                    </div>
                    <div className="tracker-meta">
                      {tracker.config.projections && tracker.config.projections.length === 1 ? (
                        `${tracker.config.projections[0].increasePercent}% every ${tracker.config.projections[0].intervalDays} days`
                      ) : tracker.config.projections && tracker.config.projections.length > 1 ? (
                        `${tracker.config.projections.length} projection scenarios`
                      ) : (
                        'No projections configured'
                      )}
                    </div>
                  </div>
                  <div className="tracker-actions">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingTracker(tracker);
                      }}
                      className="btn-icon"
                      title="Configure tracker"
                    >
                      ⚙️
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteTracker(tracker.config.id);
                      }}
                      className="btn-icon"
                      title="Delete tracker"
                    >
                      🗑
                    </button>
                  </div>
                </div>
              </div>
            ))}
        </div>

        <button
          onClick={() => setShowCreateDialog(true)}
          className="add-tracker-btn"
        >
          + Add New Tracker
        </button>
          </>
        )}
      </div>
    </>
  );
}
