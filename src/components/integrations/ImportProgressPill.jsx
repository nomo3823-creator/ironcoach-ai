import React from 'react';
import { useImport } from '@/lib/ImportContext';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle2, AlertCircle, X } from 'lucide-react';

export default function ImportProgressPill() {
  const importCtx = useImport();

  if (!importCtx || importCtx.status === 'idle' || importCtx.status === 'done') {
    return null;
  }

  const handleCancel = () => {
    if (confirm('Cancel the import? You can resume later.')) {
      importCtx.cancelImport();
    }
  };

  const isError = importCtx.status === 'error';
  const isInterrupted = importCtx.status === 'interrupted';

  return (
    <div className="fixed bottom-6 right-6 z-50 max-w-sm">
      <div className={`rounded-2xl border p-4 shadow-lg ${
        isError || isInterrupted
          ? 'bg-destructive/10 border-destructive/30'
          : 'bg-card border-border'
      }`}>
        <div className="flex items-start gap-3">
          {/* Icon */}
          <div className="pt-0.5">
            {isError || isInterrupted ? (
              <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
            ) : (
              <Loader2 className="h-5 w-5 text-primary animate-spin shrink-0" />
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground">
              {isError ? 'Import Failed' : isInterrupted ? 'Import Interrupted' : 'Importing Apple Health'}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {importCtx.message}
            </p>

            {/* Progress bar */}
            {!isError && !isInterrupted && (
              <div className="mt-2 w-full bg-secondary rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-primary h-full transition-all"
                  style={{ width: `${importCtx.percent}%` }}
                />
              </div>
            )}

            {/* Counters when saving */}
            {importCtx.status === 'saving' && importCtx.saved > 0 && (
              <p className="text-xs font-medium text-primary mt-2">
                Saved {importCtx.saved} / {importCtx.totalDays} days
              </p>
            )}
          </div>

          {/* Close button */}
          {!isError && !isInterrupted && (
            <button
              onClick={handleCancel}
              className="text-muted-foreground hover:text-foreground transition-colors shrink-0 p-1"
              title="Cancel import"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2 mt-3">
          <Button
            size="sm"
            variant="outline"
            onClick={() => window.location.href = '/integrations'}
            className="flex-1 text-xs"
          >
            View Details
          </Button>
          {isError && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleCancel}
              className="text-xs"
            >
              Dismiss
            </Button>
          )}
          {isInterrupted && (
            <Button
              size="sm"
              onClick={handleCancel}
              className="text-xs"
            >
              Retry
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}