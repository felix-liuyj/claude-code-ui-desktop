import * as React from "react"
import { cn } from "../../lib/utils"

const ScrollArea = React.forwardRef(({ 
  className, 
  children, 
  scrollbarStyle = 'auto-hide', // 'thin', 'modern', 'hidden', 'auto-hide'
  ...props 
}, ref) => {
  const scrollbarClass = React.useMemo(() => {
    switch (scrollbarStyle) {
      case 'thin':
        return 'scrollbar-thin'
      case 'modern':
        return 'scrollbar-modern'
      case 'hidden':
        return 'scrollbar-hidden'
      case 'auto-hide':
        return 'scrollbar-auto-hide'
      default:
        return 'scrollbar-auto-hide'
    }
  }, [scrollbarStyle])

  return (
    <div
      ref={ref}
      className={cn("relative overflow-hidden", className)}
      {...props}
    >
      <div 
        className={cn(
          "h-full w-full rounded-[inherit] overflow-auto",
          scrollbarClass
        )}
        style={{
          WebkitOverflowScrolling: 'touch',
          touchAction: 'pan-y'
        }}
      >
        {children}
      </div>
    </div>
  )
})
ScrollArea.displayName = "ScrollArea"

export { ScrollArea }