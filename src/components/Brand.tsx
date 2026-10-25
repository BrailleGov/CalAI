import { BrandMark } from './icons';

type BrandProps = {
  as?: 'link' | 'static';
  size?: 'sm' | 'md';
};

export function Brand({ as = 'static', size = 'md' }: BrandProps) {
  const content = (
    <>
      <BrandMark size={size === 'sm' ? 20 : 24} />
      <span className="brand-word">
        Cal<span className="brand-accent">AI</span>
      </span>
    </>
  );

  if (as === 'link') {
    return (
      <a className={`brand brand-${size}`} href="#/today" aria-label="CalAI — today">
        {content}
      </a>
    );
  }

  return <span className={`brand brand-${size}`}>{content}</span>;
}
