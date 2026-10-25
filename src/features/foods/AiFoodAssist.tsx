import { useRef, useState } from 'react';
import type { Nutrients } from '../../types';
import { useAppStore } from '../../store/useAppStore';
import { formatNumber } from '../../lib/format';
import {
  AI_CONFIGURED,
  AiError,
  analyzeMealPhoto,
  parseMealText
} from '../../lib/ai';
import type { AiFoodItem, AiWebSource } from '../../lib/ai';
import { AiConsentInline } from '../../components/AiConsentInline';
import { PhotoSourcePicker } from '../../components/PhotoSourcePicker';
import { IconSparkles } from '../../components/icons';

export type AiFoodDraft = {
  name: string;
  servingLabel: string;
  nutrients: Nutrients;
};

type AiFoodAssistProps = {
  onApply: (draft: AiFoodDraft) => void;
};

function labelFor(item: AiFoodItem): string {
  if (item.grams && item.grams > 0) return `${formatNumber(item.grams)} g`;
  return item.quantityLabel || '1 serving';
}

export function AiFoodAssist({ onApply }: AiFoodAssistProps) {
  const aiConsent = useAppStore((state) => state.preferences.aiConsentAt !== null);
  const abortRef = useRef<AbortController | null>(null);
  const [mode, setMode] = useState<'idle' | 'describe'>('idle');
  const [text, setText] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [error, setError] = useState('');
  const [items, setItems] = useState<AiFoodItem[]>([]);
  const [webSources, setWebSources] = useState<AiWebSource[]>([]);

  if (!AI_CONFIGURED) return null;

  function resetResults() {
    abortRef.current?.abort();
    setStatus('idle');
    setError('');
    setItems([]);
    setWebSources([]);
  }

  function apply(item: AiFoodItem) {
    onApply({
      name: item.name,
      servingLabel: labelFor(item),
      nutrients: {
        kcal: item.kcal,
        protein: item.protein,
        carbs: item.carbs,
        fat: item.fat
      }
    });
    resetResults();
  }

  async function run(
    task: (signal: AbortSignal) => Promise<{
      items: AiFoodItem[];
      webSources?: AiWebSource[];
    }>
  ) {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setStatus('loading');
    setError('');
    setItems([]);
    setWebSources([]);
    try {
      const result = await task(controller.signal);
      if (controller.signal.aborted) return;
      setItems(result.items);
      setWebSources(result.webSources ?? []);
      setStatus('done');
    } catch (errorValue) {
      if (controller.signal.aborted) return;
      setStatus('error');
      setError(
        errorValue instanceof AiError
          ? errorValue.message
          : 'AI could not estimate this food. Enter the values manually.'
      );
    }
  }

  async function handlePhoto(file: File | null) {
    if (!file) return;
    await run((signal) => analyzeMealPhoto(file, { signal }));
  }

  async function handleDescribe() {
    if (text.trim().length < 2) {
      setError('Describe the food in a few words.');
      return;
    }
    await run((signal) => parseMealText(text, { signal }));
  }

  return (
    <section className="ai-assist" aria-label="Fill with AI">
      <div className="ai-assist-head">
        <span>
          <IconSparkles size={15} /> Fill with AI
        </span>
        <small>Optional · review before saving</small>
      </div>

      {!aiConsent ? (
        <AiConsentInline
          action="Enable AI estimates"
          message="AI can estimate the food name and nutrition from a photo or a short description."
        />
      ) : (
        <>
          <div className="ai-assist-actions">
            <PhotoSourcePicker
              variant="small"
              label="Photo"
              disabled={status === 'loading'}
              onSelect={(file) => void handlePhoto(file)}
            />
            <button
              type="button"
              className="btn btn-ghost btn-small"
              disabled={status === 'loading'}
              onClick={() => {
                setMode(mode === 'describe' ? 'idle' : 'describe');
                resetResults();
              }}
            >
              <IconSparkles size={15} /> Describe
            </button>
          </div>

          {mode === 'describe' ? (
            <div className="ai-assist-describe">
              <label className="field">
                <span className="field-label">What is it?</span>
                <input
                  value={text}
                  onChange={(event) => setText(event.target.value)}
                  placeholder="Grilled chicken breast, 150 g"
                  autoComplete="off"
                />
              </label>
              <button
                type="button"
                className="btn btn-primary btn-small"
                disabled={status === 'loading'}
                onClick={handleDescribe}
              >
                {status === 'loading' ? 'Estimating…' : 'Estimate'}
              </button>
            </div>
          ) : null}

          {status === 'loading' ? (
            <p className="finding-status" role="status">
              <span className="finding-dot" aria-hidden="true" />
              Estimating the food…
            </p>
          ) : null}

          {error ? (
            <p className="field-error" role="alert">
              {error}
            </p>
          ) : null}

          {items.length > 0 ? (
            <>
              <p className="settings-copy">Pick the closest match to fill the form.</p>
              <ul className="ai-assist-results">
                {items.map((item, index) => (
                  <li key={`${item.name}-${index}`}>
                    <button type="button" onClick={() => apply(item)}>
                      <span>
                        <strong>{item.name}</strong>
                        <small>
                          {labelFor(item)} · {formatNumber(item.kcal)} kcal ·{' '}
                          {formatNumber(item.protein)} g protein
                        </small>
                      </span>
                      <span className="confidence">
                        {Math.round(item.confidence * 100)}%
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              {webSources.length > 0 ? (
                <p className="fine-print ai-web-sources">
                  Web-checked:{' '}
                  {webSources.map((source, index) => (
                    <span key={source.url}>
                      {index > 0 ? ' · ' : ''}
                      <a
                        className="text-link"
                        href={source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={source.title}
                      >
                        {source.domain}
                      </a>
                    </span>
                  ))}
                </p>
              ) : null}
              <p className="fine-print">
                Estimates only. Check and edit every value before saving.
              </p>
            </>
          ) : null}
        </>
      )}
    </section>
  );
}
