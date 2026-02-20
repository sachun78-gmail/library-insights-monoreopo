// Shared dark mode toggle script
// Import this in any page: <script>import '../scripts/theme';</script>
// Requires #theme-toggle and/or #mobile-theme-toggle buttons in the page HTML.

function toggleTheme() {
  const isDark = document.documentElement.classList.toggle('dark');
  localStorage.setItem('theme', isDark ? 'dark' : 'light');
}

document.getElementById('theme-toggle')?.addEventListener('click', toggleTheme);
document.getElementById('mobile-theme-toggle')?.addEventListener('click', toggleTheme);
