import { useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { useToast } from './Toast';

type AiConsentInlineProps = {
  action?: string;
  message?: string;
  onEnabled?: () => void;
};

export function AiConsentInline({
  action = 'Enable AI',
  message = 'AI estimates are optional. Your request may be sent to CalAI’s AI and web-search providers and is not stored.',
  onEnabled
}: AiConsentInlineProps) {
  const updatePreferences = useAppStore((state) => state.updatePreferences);
  const toast = useToast();
  const [checked, setChecked] = useState(false);

  return (
    <div className="ai-consent-inline">
      <p>{message}</p>
      <label className="check-label">
        <input
          type="checkbox"
          checked={checked}
          onChange={(event) => setChecked(event.target.checked)}
        />
        <span>I agree to send this request to CalAI’s AI and web-search providers.</span>
      </label>
      <button
        type="button"
        className="btn btn-ghost btn-small"
        disabled={!checked}
        onClick={() => {
          updatePreferences({ aiConsentAt: Date.now() });
          toast('AI enabled');
          onEnabled?.();
        }}
      >
        {action}
      </button>
    </div>
  );
}
