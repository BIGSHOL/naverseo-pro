import { Search } from 'lucide-react'

interface LogoProps {
  size?: 'sm' | 'md' | 'lg'
  showText?: boolean
  theme?: 'light' | 'dark'
}

export function Logo({ size = 'md', showText = true, theme = 'light' }: LogoProps) {
  const sizeMap = {
    sm: { icon: 16, text: 'text-lg' },
    md: { icon: 20, text: 'text-xl' },
    lg: { icon: 28, text: 'text-3xl' },
  }

  const { icon, text } = sizeMap[size]

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center justify-center rounded-lg bg-primary p-1.5">
        <Search className="text-primary-foreground" size={icon} />
      </div>
      {showText && (
        <span className={`font-bold ${text}`}>
          <span className="text-primary">Naver</span>
          <span className={theme === 'dark' ? 'text-white' : 'text-foreground'}>SEO</span>
          <span className={theme === 'dark' ? 'text-slate-300 ml-1 text-sm font-normal' : 'text-muted-foreground ml-1 text-sm font-normal'}>Pro</span>
        </span>
      )}
    </div>
  )
}
