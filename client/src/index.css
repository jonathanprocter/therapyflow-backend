/* client/src/index.css */
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    /* Brand Colors - RGB format for Tailwind */
    --color-ivory: 242 243 241;
    --color-sage: 142 165 140;
    --color-moss: 115 138 110;
    --color-evergreen: 52 76 61;
    --color-french-blue: 136 165 188;

    /* System colors using brand palette */
    --background: 242 243 241; /* ivory */
    --foreground: 52 76 61; /* evergreen */

    --card: 255 255 255;
    --card-foreground: 52 76 61;

    --popover: 255 255 255;
    --popover-foreground: 52 76 61;

    --primary: 142 165 140; /* sage */
    --primary-foreground: 255 255 255;

    --secondary: 115 138 110; /* moss */
    --secondary-foreground: 255 255 255;

    --muted: 242 243 241; /* ivory */
    --muted-foreground: 115 138 110; /* moss */

    --accent: 136 165 188; /* french-blue */
    --accent-foreground: 52 76 61;

    --destructive: 239 68 68;
    --destructive-foreground: 255 255 255;

    --border: 142 165 140 / 0.2; /* sage with opacity */
    --input: 142 165 140 / 0.2;
    --ring: 142 165 140;

    --radius: 0.5rem;

    /* Sage color palette */
    --color-sage-50: 246 247 246;
    --color-sage-100: 227 231 227;
    --color-sage-200: 199 210 199;
    --color-sage-300: 163 181 163;
    --color-sage-400: 127 146 127;
    --color-sage-500: 99 117 99;
    --color-sage-600: 78 93 78;
    --color-sage-700: 64 75 64;
    --color-sage-800: 54 63 54;
    --color-sage-900: 47 53 47;
  }
}

@layer base {
  * {
    @apply border-border;
  }

  body {
    @apply bg-ivory text-evergreen antialiased;
    font-family: 'Inter', system-ui, -apple-system, sans-serif;
  }
}

@layer components {
  /* Calendar specific styles */
  .calendar-day {
    @apply relative w-full aspect-square flex items-center justify-center text-sm;
    @apply hover:bg-sage/10 rounded transition-colors cursor-pointer;
  }

  .calendar-day-today {
    @apply bg-sage text-white font-semibold hover:bg-moss;
  }

  .calendar-day-selected {
    @apply ring-2 ring-sage ring-offset-2 ring-offset-ivory;
  }

  .calendar-day-disabled {
    @apply text-gray-400 cursor-not-allowed hover:bg-transparent;
  }

  /* Avatar styles */
  .avatar-initials {
    @apply bg-sage text-white font-semibold;
  }

  /* Session card styles */
  .session-card {
    @apply bg-white border border-sage/20 rounded-lg p-4;
    @apply hover:shadow-lg hover:border-sage/40 transition-all;
  }

  .session-badge {
    @apply inline-flex items-center px-2 py-1 rounded-full text-xs font-medium;
  }

  .session-badge-scheduled {
    @apply bg-sage/20 text-evergreen;
  }

  .session-badge-completed {
    @apply bg-moss/20 text-evergreen;
  }

  .session-badge-cancelled {
    @apply bg-gray-100 text-gray-600;
  }
}