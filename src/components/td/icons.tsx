// Линейные иконки интерфейса: обводка 2–2.5, без заливки и без эмодзи. Размер по умолчанию 20 px.

import type { SVGProps } from 'react'

type IconProps = Omit<SVGProps<SVGSVGElement>, 'children'> & { size?: number }

function Svg({ size = 20, strokeWidth = 2, children, ...rest }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {children}
    </svg>
  )
}

export const HeartIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 20s-7-4.4-8.8-8.6C1.9 8.2 4 5 7.2 5c1.9 0 3.4 1 4.8 2.8C13.4 6 14.9 5 16.8 5 20 5 22.1 8.2 20.8 11.4 19 15.6 12 20 12 20z" />
  </Svg>
)
export const CoinIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8" />
    <circle cx="12" cy="12" r="3.5" />
  </Svg>
)
export const SwordsIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5 5l10 10M19 5L9 15M7 17l2-2M17 17l-2-2M5 19l2-2M19 19l-2-2" />
  </Svg>
)
export const BoltIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M13 2L4 14h7l-1 8 9-12h-7z" />
  </Svg>
)
export const PlayIcon = (p: IconProps) => (
  <Svg strokeWidth={2.5} {...p}>
    <path d="M7 5l12 7-12 7z" />
  </Svg>
)
export const PauseIcon = (p: IconProps) => (
  <Svg strokeWidth={2.5} {...p}>
    <path d="M9 6v12M15 6v12" />
  </Svg>
)
export const MenuIcon = (p: IconProps) => (
  <Svg strokeWidth={2.5} {...p}>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </Svg>
)
export const CloseIcon = (p: IconProps) => (
  <Svg strokeWidth={2.5} {...p}>
    <path d="M6 6l12 12M18 6L6 18" />
  </Svg>
)
export const CheckIcon = (p: IconProps) => (
  <Svg strokeWidth={2.5} {...p}>
    <path d="M5 12l5 5 9-10" />
  </Svg>
)
export const DiceIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="4" y="4" width="16" height="16" rx="3" />
    <circle cx="9" cy="9" r="1" />
    <circle cx="15" cy="15" r="1" />
    <circle cx="15" cy="9" r="1" />
    <circle cx="9" cy="15" r="1" />
  </Svg>
)
export const SoundIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 9v6h4l5 4V5L8 9H4zM16.5 8.5a5 5 0 010 7M19 6a8.5 8.5 0 010 12" />
  </Svg>
)
export const SoundOffIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 9v6h4l5 4V5L8 9H4zM17 9l5 6M22 9l-5 6" />
  </Svg>
)
export const SunIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6L7 7M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4" />
  </Svg>
)
export const InfinityIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M7.5 8.5C4 8.5 4 15.5 7.5 15.5c3 0 6-7 9-7 3.5 0 3.5 7 0 7-3 0-6-7-9-7z" />
  </Svg>
)
export const HelpIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M9.5 9.5a2.5 2.5 0 114 2c-.9.6-1.5 1.1-1.5 2.2M12 17h.01" />
  </Svg>
)
export const RestartIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 12a8 8 0 108-8H8M8 1l-3 3 3 3" />
  </Svg>
)
export const FullscreenIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
  </Svg>
)
export const ExitFullscreenIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" />
  </Svg>
)
export const UsersIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="9" cy="8" r="3.5" />
    <path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6M16 4.8a3.5 3.5 0 010 6.4M18 14.4c2.2.7 3.5 2.6 3.5 5.6" />
  </Svg>
)
export const MaskIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 3c-4.5 0-8 2-8 5.5S6 17 12 21c6-4 8-9 8-12.5S16.500 3 12 3zM9 10h.01M15 10h.01M9 15c1.500 1 4.500 1 6 0" />
  </Svg>
)
export const MoveIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 3v18M3 12h18M12 3l-3 3M12 3l3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3" />
  </Svg>
)
export const TrashIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6" />
  </Svg>
)
