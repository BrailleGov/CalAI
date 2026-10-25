import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import type {
  ChangeEvent,
  KeyboardEvent as ReactKeyboardEvent,
  RefObject
} from 'react';
import { IconBook, IconCamera, IconChevronDown, IconUpload } from './icons';

type PhotoSourcePickerProps = {
  onSelect: (file: File) => void;
  disabled?: boolean;
  variant?: 'dropzone' | 'button' | 'small';
  label?: string;
};

export function PhotoSourcePicker({
  onSelect,
  disabled = false,
  variant = 'dropzone',
  label = 'Photo'
}: PhotoSourcePickerProps) {
  const [open, setOpen] = useState(false);
  const [placement, setPlacement] = useState<'bottom' | 'top'>('bottom');
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const firstItemRef = useRef<HTMLButtonElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const libraryRef = useRef<HTMLInputElement>(null);
  const filesRef = useRef<HTMLInputElement>(null);
  const menuId = useId();

  useLayoutEffect(() => {
    if (!open) return;
    const trigger = triggerRef.current;
    const menu = menuRef.current;
    if (!trigger || !menu) return;

    const triggerRect = trigger.getBoundingClientRect();
    const menuHeight = menu.getBoundingClientRect().height;
    const spaceBelow = window.innerHeight - triggerRect.bottom;
    const spaceAbove = triggerRect.top;
    setPlacement(
      spaceBelow < menuHeight + 12 && spaceAbove > spaceBelow ? 'top' : 'bottom'
    );
  }, [open]);

  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);

  useEffect(() => {
    if (!open) return;

    firstItemRef.current?.focus();

    const handlePointer = (event: PointerEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
      triggerRef.current?.focus();
    };

    document.addEventListener('pointerdown', handlePointer);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('pointerdown', handlePointer);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file) onSelect(file);
  }

  function choose(ref: RefObject<HTMLInputElement>) {
    setOpen(false);
    ref.current?.click();
  }

  function handleMenuKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;

    const items = Array.from(
      event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')
    );
    if (items.length === 0) return;

    const current = items.indexOf(document.activeElement as HTMLButtonElement);
    let next = current;
    if (event.key === 'Home') {
      next = 0;
    } else if (event.key === 'End') {
      next = items.length - 1;
    } else if (event.key === 'ArrowDown') {
      next = current < 0 ? 0 : (current + 1) % items.length;
    } else {
      next = current < 0 ? items.length - 1 : (current - 1 + items.length) % items.length;
    }

    event.preventDefault();
    items[next]?.focus();
  }

  const triggerClass =
    variant === 'dropzone'
      ? 'ai-dropzone'
      : variant === 'small'
        ? 'btn btn-ghost btn-small'
        : 'btn btn-ghost';

  return (
    <div
      className={
        variant === 'dropzone' ? 'photo-source photo-source-dropzone' : 'photo-source'
      }
      ref={wrapRef}
    >
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="visually-hidden"
        aria-label="Take a meal photo"
        onChange={handleChange}
      />
      <input
        ref={libraryRef}
        type="file"
        accept="image/*"
        className="visually-hidden"
        aria-label="Choose a meal photo"
        onChange={handleChange}
      />
      <input
        ref={filesRef}
        type="file"
        accept="image/*"
        className="visually-hidden"
        aria-label="Choose an image file"
        onChange={handleChange}
      />

      <button
        ref={triggerRef}
        type="button"
        className={triggerClass}
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((value) => !value)}
      >
        {variant === 'dropzone' ? (
          <>
            <IconCamera size={26} />
            <strong>Take or choose a photo</strong>
            <span>Camera, gallery, or files. Downscaled on this device; location is stripped.</span>
          </>
        ) : (
          <>
            <IconCamera size={15} /> {label} <IconChevronDown size={12} />
          </>
        )}
      </button>

      {open ? (
        <div
          id={menuId}
          ref={menuRef}
          className={
            placement === 'top' ? 'photo-source-menu photo-source-menu-top' : 'photo-source-menu'
          }
          role="menu"
          aria-label="Choose photo source"
          aria-orientation="vertical"
          onKeyDown={handleMenuKeyDown}
        >
          <button
            ref={firstItemRef}
            type="button"
            role="menuitem"
            onClick={() => choose(cameraRef)}
          >
            <IconCamera size={16} />
            <span>
              <strong>Camera</strong>
              <small>Take a new photo</small>
            </span>
          </button>
          <button type="button" role="menuitem" onClick={() => choose(libraryRef)}>
            <IconUpload size={16} />
            <span>
              <strong>Photo library</strong>
              <small>Choose from your gallery</small>
            </span>
          </button>
          <button type="button" role="menuitem" onClick={() => choose(filesRef)}>
            <IconBook size={16} />
            <span>
              <strong>Files</strong>
              <small>Browse image files</small>
            </span>
          </button>
        </div>
      ) : null}
    </div>
  );
}
