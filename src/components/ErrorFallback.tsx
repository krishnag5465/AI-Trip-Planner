import React from "react";
import { AlertOctagon, RotateCcw } from "lucide-react";

interface ErrorFallbackProps {
  message: string;
  onRetry: () => void;
}

export default function ErrorFallback({ message, onRetry }: ErrorFallbackProps) {
  return (
    <div className="error-fallback">
      <div className="error-icon-wrapper">
        <AlertOctagon size={48} className="error-icon" />
      </div>
      <h3 className="error-title">Trip Planning Failed</h3>
      <p className="error-message">{message}</p>
      
      <div className="error-troubleshoot">
        <p className="troubleshoot-header">Common ways to resolve this:</p>
        <ul className="troubleshoot-list">
          <li>Ensure your internet connection is active.</li>
          <li>Check that your <code>.env.local</code> file contains a valid <code>GEMINI_API_KEY</code> if using live AI.</li>
          <li>Try refining your search to be more general or shorter.</li>
        </ul>
      </div>

      <button className="btn btn-primary btn-retry" onClick={onRetry}>
        <RotateCcw size={16} />
        <span>Retry Generation</span>
      </button>
    </div>
  );
}
