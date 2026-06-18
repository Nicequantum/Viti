import React, { useCallback, useEffect, useRef, useState, type TextareaHTMLAttributes, type InputHTMLAttributes } from 'react';
import { VoiceInputButton } from './VoiceInputButton';

interface StableFieldProps {
  value: string;
  onChange: (value: string) => void;
  fieldKey: string;
  showVoice?: boolean;
}

function useStableDraft(value: string, fieldKey: string) {
  const [draft, setDraft] = useState(value);
  const isFocusedRef = useRef(false);
  const lastEmittedRef = useRef(value);
  const selectionRef = useRef<{ start: number; end: number } | null>(null);

  useEffect(() => {
    lastEmittedRef.current = value;
    setDraft(value);
  }, [fieldKey]);

  useEffect(() => {
    if (isFocusedRef.current) return;
    if (value === lastEmittedRef.current) return;
    lastEmittedRef.current = value;
    setDraft(value);
  }, [value]);

  const commit = useCallback((next: string, el?: HTMLTextAreaElement | HTMLInputElement) => {
    if (el && isFocusedRef.current) {
      selectionRef.current = { start: el.selectionStart ?? next.length, end: el.selectionEnd ?? next.length };
    }
    setDraft(next);
    lastEmittedRef.current = next;
  }, []);

  const restoreSelection = useCallback((el: HTMLTextAreaElement | HTMLInputElement | null) => {
    if (!el || !selectionRef.current) return;
    const { start, end } = selectionRef.current;
    requestAnimationFrame(() => {
      try {
        el.setSelectionRange(start, end);
      } catch {
        // input type may not support selection
      }
    });
  }, []);

  return { draft, setDraft, isFocusedRef, lastEmittedRef, commit, restoreSelection };
}

export function StableInput({
  value,
  onChange,
  fieldKey,
  showVoice = false,
  className = '',
  ...props
}: StableFieldProps & Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'>) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { draft, isFocusedRef, lastEmittedRef, commit } = useStableDraft(value, fieldKey);

  const handleChange = (next: string) => {
    commit(next, inputRef.current ?? undefined);
    onChange(next);
  };

  return (
    <div className={showVoice ? 'flex gap-2 items-center' : undefined}>
      <input
        ref={inputRef}
        {...props}
        value={draft}
        autoComplete="off"
        onFocus={(e) => {
          isFocusedRef.current = true;
          props.onFocus?.(e);
        }}
        onBlur={(e) => {
          isFocusedRef.current = false;
          if (draft !== lastEmittedRef.current) {
            lastEmittedRef.current = draft;
            onChange(draft);
          }
          props.onBlur?.(e);
        }}
        onChange={(e) => handleChange(e.target.value)}
        className={showVoice ? `flex-1 touch-manipulation ${className}` : `touch-manipulation ${className}`}
      />
      {showVoice && (
        <VoiceInputButton
          targetRef={inputRef as React.RefObject<HTMLTextAreaElement | HTMLInputElement>}
          onTranscript={handleChange}
        />
      )}
    </div>
  );
}

export function StableTextarea({
  value,
  onChange,
  fieldKey,
  showVoice = true,
  className = '',
  ...props
}: StableFieldProps & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'value' | 'onChange'>) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { draft, isFocusedRef, lastEmittedRef, commit, restoreSelection } = useStableDraft(value, fieldKey);

  const handleChange = (next: string) => {
    commit(next, textareaRef.current ?? undefined);
    onChange(next);
    restoreSelection(textareaRef.current);
  };

  return (
    <div className="flex gap-2 items-start w-full">
      <textarea
        ref={textareaRef}
        {...props}
        value={draft}
        autoComplete="off"
        spellCheck
        onFocus={(e) => {
          isFocusedRef.current = true;
          props.onFocus?.(e);
        }}
        onBlur={(e) => {
          isFocusedRef.current = false;
          if (draft !== lastEmittedRef.current) {
            lastEmittedRef.current = draft;
            onChange(draft);
          }
          props.onBlur?.(e);
        }}
        onChange={(e) => handleChange(e.target.value)}
        className={`flex-1 touch-manipulation ${className}`}
      />
      {showVoice && (
        <VoiceInputButton targetRef={textareaRef} onTranscript={handleChange} className="mt-2 shrink-0" />
      )}
    </div>
  );
}