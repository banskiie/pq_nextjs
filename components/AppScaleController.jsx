'use client';

import { useEffect } from 'react';

export default function AppScaleController() {
  useEffect(() => {
    const getAppScale = (width) => {
      if (width >= 1366) return 1.1;
      if (width >= 1024) return 1.05;
      return 1;
    };

    const applyScale = () => {
      const scale = getAppScale(window.innerWidth);
      document.documentElement.style.setProperty('--app-scale', String(scale));
    };

    applyScale();
    window.addEventListener('resize', applyScale);

    return () => {
      window.removeEventListener('resize', applyScale);
      document.documentElement.style.removeProperty('--app-scale');
    };
  }, []);

  return null;
}
