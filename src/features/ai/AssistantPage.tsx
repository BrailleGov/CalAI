import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChatMessage, Meal } from '../../types';
import { MEALS, MEAL_LABELS } from '../../types';
import { useAppStore } from '../../store/useAppStore';
import { useToast } from '../../components/Toast';
import { createId } from '../../lib/id';
import { todayKey } from '../../lib/dates';
import { formatNumber } from '../../lib/format';
import { buildAssistantContext } from '../../lib/context';
import {
  AI_CONFIGURED,
  AiError,
  askAssistant
} from '../../lib/ai';
import type { AiChatReply, AiFoodItem } from '../../lib/ai';
import { IconSparkles, IconTrash } from '../../components/icons';
const SUGGESTIONS = [
  'How did the last 7 days compare to my target?',
  'What is a high-protein lunch I could make quickly?',
  'Which days did I log least this month?',
  'Suggest a recipe using chicken and rice.'
];

export function AssistantPage() {
  const chatMessages = useAppStore((state) => state.chatMessages);
  const addChatMessage = useAppStore((state) => state.addChatMessage);
  const clearChat = useAppStore((state) => state.clearChat);
  const preferences = useAppStore((state) => state.preferences);
  const updatePreferences = useAppStore((state) => state.updatePreferences);
  const quickAdd = useAppStore((state) => state.quickAdd);
  const entries = useAppStore((state) => state.entries);
  const weights = useAppStore((state) => state.weights);
  const water = useAppStore((state) => state.water);
  const targets = useAppStore((state) => state.targets);
  const profile = useAppStore((state) => state.profile);
  const reminders = useAppStore((state) => state.reminders);
  const toast = useToast();

  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [proposal, setProposal] = useState<AiChatReply['proposal'] | null>(null);
  const [proposalMeal, setProposalMeal] = useState<Meal>('lunch');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [confirmClear, setConfirmClear] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const context = useMemo(() => {
    const state = useAppStore.getState();
    return buildAssistantContext({
      ...state,
      entries,
      weights,
      water,
      targets,
      profile,
      reminders,
      preferences
    });
  }, [entries, preferences, profile, reminders, targets, water, weights]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [chatMessages, busy, proposal]);

  useEffect(() => () => abortRef.current?.abort(), []);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    if (!preferences.aiChat) {
      setError('The AI coach is turned off in your preferences.');
      return;
    }
    if (!AI_CONFIGURED) {
      setError('The AI coach needs the CalAI service. Deploy the Worker and set VITE_API_BASE.');
      return;
    }
    if (preferences.aiConsentAt === null) {
      setError('Enable AI consent before asking the coach.');
      return;
    }

    const userMessage: ChatMessage = {
      id: createId(),
      role: 'user',
      content: trimmed.slice(0, 2000),
      createdAt: Date.now()
    };
    addChatMessage(userMessage);
    setInput('');
    setBusy(true);
    setError('');
    setProposal(null);
    setSuggestions([]);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const reply = await askAssistant(
        [...chatMessages, userMessage]
          .filter((message) => !message.error)
          .slice(-10)
          .map((message) => ({ role: message.role, content: message.content })),
        context,
        { signal: controller.signal }
      );
      if (controller.signal.aborted) return;
      addChatMessage({
        id: createId(),
        role: 'assistant',
        content: reply.reply,
        createdAt: Date.now(),
        ...(reply.window ? { window: reply.window } : {})
      });
      setSuggestions(reply.suggestions);
      if (reply.proposal) {
        setProposal(reply.proposal);
        setProposalMeal(reply.proposal.meal ?? 'lunch');
      }
    } catch (errorValue) {
      if (controller.signal.aborted) return;
      const message =
        errorValue instanceof AiError
          ? errorValue.message
          : 'The coach is unavailable right now. Try again.';
      setError(message);
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void send(input);
  }

  function handleLogProposal() {
    if (!proposal) return;
    const items = proposal.items.filter((item) => item.name && item.kcal >= 0);
    if (items.length === 0) return;

    for (const item of items) {
      quickAdd({
        name: item.name,
        meal: proposalMeal,
        date: todayKey(),
        nutrients: {
          kcal: item.kcal,
          protein: item.protein,
          carbs: item.carbs,
          fat: item.fat
        },
        servingLabel: item.grams ? `${formatNumber(item.grams)} g (estimate)` : 'estimated portion'
      });
    }

    addChatMessage({
      id: createId(),
      role: 'assistant',
      content: `Logged ${items.length} ${items.length === 1 ? 'item' : 'items'} to ${MEAL_LABELS[
        proposalMeal
      ].toLowerCase()}. You can edit or delete them from Today.`,
      createdAt: Date.now()
    });
    setProposal(null);
    toast('Added to your diary');
  }

  function removeProposalItem(index: number) {
    setProposal((current) => {
      if (!current) return null;
      const items = current.items.filter((_, itemIndex) => itemIndex !== index);
      return items.length > 0 ? { ...current, items } : null;
    });
  }

  function handleClear() {    abortRef.current?.abort();
    clearChat();
    setProposal(null);
    setSuggestions([]);
    setError('');
    setConfirmClear(false);
    toast('Chat cleared');
  }

  return (
    <div className="page assistant-page">
      <header className="page-head">
        <p className="eyebrow">AI coach</p>
        <div className="page-head-row">
          <h1>Ask CalAI</h1>
          {chatMessages.length > 0 ? (
            <button
              type="button"
              className="btn btn-ghost btn-small"
              onClick={() => setConfirmClear(true)}
            >
              <IconTrash size={15} /> Clear
            </button>
          ) : null}
        </div>
        <p className="page-lede">
          Questions are answered from totals computed on this device. The coach cannot change your
          diary without a confirmation.
        </p>
      </header>

      <section className="context-card" aria-label="What the coach can see">
        <div className="context-head">
          <IconSparkles size={16} />
          <span>Grounded in your data</span>
        </div>
        <dl className="context-stats">
          <div>
            <dt>7-day average</dt>
            <dd>{formatNumber(context.windows[0]?.kcalPerDay ?? 0)} kcal</dd>
          </div>
          <div>
            <dt>Logged days</dt>
            <dd>{context.windows[0]?.loggedDays ?? 0} of 7</dd>
          </div>
          <div>
            <dt>Target</dt>
            <dd>{formatNumber(context.targets.kcal)} kcal</dd>
          </div>
        </dl>
        <p className="fine-print">
          Sends totals and preferences only, never your raw diary or phone number. Answers can be
          wrong; they are not medical advice.
        </p>
      </section>

      {!AI_CONFIGURED ? (
        <div className="card empty-card">
          <IconSparkles size={22} />
          <h2>The coach is not configured</h2>
          <p>
            Deploy the CalAI Worker with a DeepSeek key and rebuild the app with{' '}
            <code>VITE_API_BASE</code>. Nothing is sent from this build.
          </p>
        </div>
      ) : null}

      {AI_CONFIGURED && !preferences.aiChat ? (
        <div className="card empty-card">
          <h2>AI coach is off</h2>
          <p>Turn it on to ask questions about your totals and get food ideas.</p>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => updatePreferences({ aiChat: true })}
          >
            Turn on AI coach
          </button>
        </div>
      ) : null}

      {AI_CONFIGURED && preferences.aiChat && preferences.aiConsentAt === null ? (
        <div className="consent-box">
          <p>
            The coach sends the question you type plus a summary of your targets, totals, and food
            preferences. It never sends your raw diary.
          </p>
          <button
            type="button"
            className="btn btn-primary btn-small"
            onClick={() => {
              updatePreferences({ aiConsentAt: Date.now() });
              toast('AI enabled');
            }}
          >
            Enable AI
          </button>
        </div>
      ) : null}

      <section className="chat" aria-label="Conversation">
        {chatMessages.length === 0 ? (
          <div className="chat-empty">
            <p className="eyebrow">Try asking</p>
            <div className="chat-suggestions">
              {SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  className="chip"
                  onClick={() => void send(suggestion)}
                  disabled={!AI_CONFIGURED || busy || !preferences.aiChat}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <ul className="chat-list">
            {chatMessages.map((message) => (
              <li
                key={message.id}
                className={`chat-message chat-${message.role}${
                  message.error ? ' chat-error' : ''
                }`}
              >
                <div className="chat-bubble">
                  {message.content.split('\n').map((line, index) => (
                    <p key={`${message.id}-${index}`}>{line || '\u00a0'}</p>
                  ))}
                  {message.window ? (
                    <span className="chat-window">Data window: {message.window}</span>
                  ) : null}
                </div>
              </li>
            ))}
            {busy ? (
              <li className="chat-message chat-assistant">
                <div className="chat-bubble chat-typing" role="status">
                  Thinking…
                </div>
              </li>
            ) : null}
          </ul>
        )}
        <div ref={endRef} />
      </section>

      {suggestions.length > 0 ? (
        <div className="chat-suggestions chat-followups">
          {suggestions.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              className="chip"
              onClick={() => void send(suggestion)}
              disabled={busy}
            >
              {suggestion}
            </button>
          ))}
        </div>
      ) : null}

      {error ? (
        <p className="field-error" role="alert">
          {error}
        </p>
      ) : null}

      {proposal ? (
        <section className="proposal-card" aria-label="Proposed diary entries">
          <div className="card-head card-head-flush">
            <h2>Proposed entries</h2>
            <span className="card-note">Review before logging</span>
          </div>
          {proposal.rationale ? <p className="online-note">{proposal.rationale}</p> : null}
          <ul className="proposal-list">
            {proposal.items.map((item: AiFoodItem, index) => (
              <li key={`${item.name}-${index}`}>
                <span className="proposal-main">
                  <strong>{item.name}</strong>
                  <small>
                    {item.grams ? `${formatNumber(item.grams)} g · ` : ''}
                    {formatNumber(item.kcal)} kcal · P {formatNumber(item.protein)} / C{' '}
                    {formatNumber(item.carbs)} / F {formatNumber(item.fat)}
                  </small>
                </span>
                <span
                  className={`confidence confidence-${item.confidence >= 0.7 ? 'high' : item.confidence >= 0.5 ? 'medium' : 'low'}`}
                >
                  {item.confidence >= 0.7 ? 'High' : item.confidence >= 0.5 ? 'Medium' : 'Low'}
                </span>
                <button
                  type="button"
                  className="icon-button"
                  aria-label={`Remove ${item.name} from proposal`}
                  onClick={() => removeProposalItem(index)}
                >
                  <IconTrash size={14} />
                </button>
              </li>
            ))}
          </ul>

          <fieldset className="field-group">
            <legend className="field-label">Meal</legend>
            <div className="segmented segmented-small">
              {MEALS.map((value) => (
                <button
                  key={value}
                  type="button"
                  className={proposalMeal === value ? 'segmented-item is-active' : 'segmented-item'}
                  aria-pressed={proposalMeal === value}
                  onClick={() => setProposalMeal(value)}
                >
                  {MEAL_LABELS[value]}
                </button>
              ))}
            </div>
          </fieldset>

          <div className="proposal-actions">
            <button type="button" className="btn btn-ghost" onClick={() => setProposal(null)}>
              Not now
            </button>
            <button type="button" className="btn btn-primary" onClick={handleLogProposal}>
              Log these entries
            </button>
          </div>
          <p className="fine-print">
            AI estimates can be wrong. Nothing is added until you press Log these entries, and you
            can edit or delete each entry afterwards.
          </p>
        </section>
      ) : null}

      {confirmClear ? (
        <div className="delete-confirm" role="alert">
          <p>Clear this conversation from this device?</p>
          <div className="delete-actions">
            <button type="button" className="btn btn-ghost" onClick={() => setConfirmClear(false)}>
              Keep
            </button>
            <button type="button" className="btn btn-danger" onClick={handleClear}>
              Clear chat
            </button>
          </div>
        </div>
      ) : (
        <form className="chat-composer" onSubmit={handleSubmit}>
          <label className="field">
            <span className="visually-hidden">Message the coach</span>
            <textarea
              className="textarea"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  void send(input);
                }
              }}
              placeholder="Ask about your week, a meal idea, or a food…"
              rows={2}
              disabled={busy || !preferences.aiChat}
            />
          </label>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={busy || !input.trim() || !preferences.aiChat}
          >
            Send
          </button>
        </form>
      )}
    </div>
  );
}
