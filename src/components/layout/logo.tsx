import { Search } from 'lucide-react'

interface LogoProps {
  size?: 'sm' | 'md' | 'lg'
  showText?: boolean
  theme?: 'light' | 'dark'
}

export function Logo({ size = 'md', showText = true, theme = 'light' }: LogoProps) {
  const sizeMap = {
    sm: { icon: 16, text: 'text-lg', pad: 'p-1.5', gap: 'gap-2', proText: 'text-xs' },
    md: { icon: 20, text: 'text-xl', pad: 'p-2', gap: 'gap-2.5', proText: 'text-sm' },
    lg: { icon: 28, text: 'text-3xl', pad: 'p-2.5', gap: 'gap-3', proText: 'text-base' },
  }

  const { icon, text, pad, gap, proText } = sizeMap[size]

  return (
    <div className={`flex items-center ${gap}`}>
      <div className={`flex items-center justify-center rounded-xl bg-primary ${pad} shadow-md shadow-primary/25`}>
        <Search className="text-primary-foreground" size={icon} />
      </div>
      {showText && (
        <span className={`font-bold tracking-tight ${text}`}>
          <span className="text-primary">Naver</span>
          <span className={theme === 'dark' ? 'text-white' : 'text-foreground'}>SEO</span>
          <span className={theme === 'dark'
            ? `text-slate-400 ml-1 ${proText} font-normal`
            : `text-muted-foreground ml-1 ${proText} font-normal`
          }>Pro</span>
        </span>
      )}
    </div>
  )
}
