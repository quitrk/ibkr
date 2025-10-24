import type { Tracker } from '../types/trackers';
import { useAppContext } from '../contexts/AppContext';
import './ComparisonSelector.css';

export type ComparisonType = 'projection' | 'instrument';

interface ComparisonSelectorProps {
  tracker: Tracker;
  selectedType: ComparisonType;
  selectedId: string | null;
  onSelectionChange: (type: ComparisonType, id: string) => void;
}

export function ComparisonSelector({
  tracker,
  selectedType,
  selectedId,
  onSelectionChange
}: ComparisonSelectorProps) {
  const { instrumentPerformance } = useAppContext();

  // Get visible projections and instruments
  const visibleProjections = tracker.config.projections?.filter(p => p.visible) || [];
  const visibleInstruments = tracker.config.instruments?.filter(inst => inst.visible) || [];

  const hasProjections = visibleProjections.length > 0;
  const hasInstruments = visibleInstruments.length > 0;
  const hasMultipleOptions = (hasProjections && hasInstruments) ||
    (hasProjections && visibleProjections.length > 1) ||
    (hasInstruments && visibleInstruments.length > 1);

  // Don't render if no options or only one option
  if (!hasMultipleOptions) {
    return null;
  }

  return (
    <div className="comparison-selector-group">
      <label htmlFor="comparison-select">Compare to</label>
      <select
        id="comparison-select"
        value={`${selectedType}:${selectedId}`}
        onChange={(e) => {
          const [type, id] = e.target.value.split(':');
          onSelectionChange(type as ComparisonType, id);
        }}
        className="comparison-selector"
      >
        {hasProjections && (
          <optgroup label="Projections">
            {visibleProjections.map((projection, index) => (
              <option key={projection.id} value={`projection:${projection.id}`}>
                {projection.name || `Projection ${index + 1}`}
              </option>
            ))}
          </optgroup>
        )}
        {hasInstruments && (
          <optgroup label="Instruments">
            {visibleInstruments.map((instrument) => {
              const perfData = instrumentPerformance.get(instrument.id);
              return (
                <option key={instrument.id} value={`instrument:${instrument.id}`}>
                  {perfData?.symbol || instrument.symbol}
                </option>
              );
            })}
          </optgroup>
        )}
      </select>
    </div>
  );
}
