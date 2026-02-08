import React from 'react';
import { InboxIcon, Plus } from 'lucide-react';

interface EmptyStateProps {
  title?: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: React.ReactNode;
}

/**
 * Reusable EmptyState component shown when tables have no data
 * Provides visual feedback and optional action button
 */
const EmptyState: React.FC<EmptyStateProps> = ({
  title = 'No data available',
  description = 'Start by creating your first record to see it appear here.',
  actionLabel,
  onAction,
  icon = <InboxIcon size={48} className="text-slate-300" />
}) => {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 bg-slate-50 rounded-lg border border-dashed border-slate-300 w-full">
      <div className="mb-4">
        {icon}
      </div>
      <h3 className="text-lg font-semibold text-slate-700 mb-2">{title}</h3>
      <p className="text-sm text-slate-500 text-center max-w-xs mb-6">{description}</p>
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
        >
          <Plus size={16} />
          {actionLabel}
        </button>
      )}
    </div>
  );
};

export default EmptyState;
