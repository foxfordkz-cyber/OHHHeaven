import { Icon } from './icons';
import { toggleTheme, useTheme } from './theme';

/** Round button that switches between the light and the dark theme. `floating` pins it to the top right corner. */
export function ThemeToggle({ floating = false }: { floating?: boolean }) {
  const theme = useTheme();
  const next = theme === 'dark' ? 'light' : 'dark';
  return (
    <button
      type="button"
      className={`theme-toggle${floating ? ' theme-toggle--floating' : ''}`}
      onClick={toggleTheme}
      aria-label={`Switch to the ${next} theme`}
      title={`Switch to the ${next} theme`}
    >
      <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={18} />
    </button>
  );
}
