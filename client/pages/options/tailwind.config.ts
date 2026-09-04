import baseConfig from '@extension/tailwindcss-config';
import { withUI } from '@extension/ui';

export default withUI({
  ...baseConfig,
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Semantic tokens driven by CSS custom properties defined in Options.css.
        // Same values as the side-panel system so both surfaces match.
        ink: 'var(--c-bg-base)',
        surface: 'var(--c-bg-surface)',
        elevated: 'var(--c-bg-elevated)',
        subtle: 'var(--c-bg-subtle)',
        'border-subtle': 'var(--c-border-subtle)',
        'border-strong': 'var(--c-border-strong)',
        primary: 'var(--c-text-primary)',
        secondary: 'var(--c-text-secondary)',
        tertiary: 'var(--c-text-tertiary)',
        accent: 'var(--c-accent)',
        'accent-soft': 'var(--c-accent-soft)',
        ok: 'var(--c-ok)',
        warn: 'var(--c-warn)',
        danger: 'var(--c-danger)',
        'ok-soft': 'var(--c-ok-soft)',
        'warn-soft': 'var(--c-warn-soft)',
        'danger-soft': 'var(--c-danger-soft)',
        kw: 'var(--c-kw)',
        str: 'var(--c-str)',
        fn: 'var(--c-fn)',
        num: 'var(--c-num)',
        const: 'var(--c-const)',
        err: 'var(--c-err)',
      },
    },
  },
});
