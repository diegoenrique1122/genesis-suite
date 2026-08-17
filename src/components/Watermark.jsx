import React from 'react';
import { useTheme } from '../contexts/ThemeContext';

export default function Watermark() {
  const { themeConfig } = useTheme();

  if (!themeConfig?.logo_url) return null;

  return (
    <div className="fixed inset-0 z-0 flex items-center justify-center pointer-events-none overflow-hidden">
      <img 
        src={themeConfig.logo_url} 
        alt="Coach Marca Blanca" 
        className="w-[80vw] sm:w-[60vw] max-w-3xl object-contain grayscale mix-blend-overlay transition-opacity duration-1000"
        style={{ opacity: themeConfig.watermark_opacity }}
      />
    </div>
  );
}