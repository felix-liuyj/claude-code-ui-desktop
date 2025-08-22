/**
 * Scrollbar utility functions for applying consistent scrollbar styles
 */

/**
 * Get scrollbar class name based on style type
 * @param {string} style - The scrollbar style ('thin', 'modern', 'hidden', 'auto-hide')
 * @returns {string} The corresponding CSS class name
 */
export const getScrollbarClass = (style = 'auto-hide') => {
  const scrollbarStyles = {
    thin: 'scrollbar-thin',
    modern: 'scrollbar-modern', 
    hidden: 'scrollbar-hidden',
    'auto-hide': 'scrollbar-auto-hide'
  }
  
  return scrollbarStyles[style] || scrollbarStyles['auto-hide']
}

/**
 * Apply scrollbar style to an element via className
 * @param {string} baseClassName - The base class names
 * @param {string} scrollbarStyle - The scrollbar style type
 * @returns {string} Combined class names
 */
export const withScrollbarStyle = (baseClassName = '', scrollbarStyle = 'auto-hide') => {
  const scrollbarClass = getScrollbarClass(scrollbarStyle)
  return `${baseClassName} ${scrollbarClass}`.trim()
}

/**
 * Scrollbar style presets for common use cases
 */
export const scrollbarPresets = {
  // Sidebar and navigation areas
  sidebar: 'auto-hide',
  
  // Content areas and main panels  
  content: 'auto-hide',
  
  // Code blocks and technical content
  code: 'thin',
  
  // Tables and data displays
  table: 'thin',
  
  // Modal and popup content
  modal: 'modern',
  
  // Performance dashboards
  dashboard: 'thin',
  
  // Areas where scrollbar should be completely hidden
  invisible: 'hidden'
}

/**
 * Get scrollbar class for a specific preset
 * @param {string} preset - The preset name
 * @returns {string} The scrollbar class name
 */
export const getScrollbarPreset = (preset) => {
  const style = scrollbarPresets[preset] || scrollbarPresets.content
  return getScrollbarClass(style)
}