interface LoadingOverlayProps {
  visible: boolean;
  message: string;
  progress?: number;
}

export function LoadingOverlay({ visible, message, progress }: LoadingOverlayProps) {
  if (!visible) return null;
  return (
    <div className="fixed inset-0 z-[100] bg-black/70 flex items-center justify-center p-6">
      <div className="ios-card p-6 w-full max-w-sm text-center">
        <div className="w-10 h-10 border-2 border-[#0a84ff] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <div className="text-sm font-medium mb-2">{message}</div>
        {typeof progress === 'number' && (
          <>
            <div className="h-1.5 bg-[#2c2c2e] rounded-full overflow-hidden mb-1">
              <div className="h-full bg-[#0a84ff] transition-all duration-300" style={{ width: `${progress}%` }} />
            </div>
            <div className="text-xs text-[#8e8e93]">{progress}%</div>
          </>
        )}
      </div>
    </div>
  );
}