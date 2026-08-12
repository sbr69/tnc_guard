import React, { useEffect, useState } from 'react';
import { motion, useMotionValue } from 'motion/react';

export const ClayCursor: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [hoverState, setHoverState] = useState<'default' | 'pointer' | 'text'>('default');
  const [isPressed, setIsPressed] = useState(false);
  const [isTouchDevice, setIsTouchDevice] = useState(false);

  // Exact 1:1 mouse position for responsive cursor alignment
  const mouseX = useMotionValue(-100);
  const mouseY = useMotionValue(-100);

  useEffect(() => {
    // Detect coarse (touch) vs fine (mouse/trackpad) pointer input
    const mediaQuery = window.matchMedia('(pointer: fine)');
    const updatePointerType = () => setIsTouchDevice(!mediaQuery.matches);

    updatePointerType();
    mediaQuery.addEventListener('change', updatePointerType);

    const handleMouseMove = (e: MouseEvent) => {
      mouseX.set(e.clientX);
      mouseY.set(e.clientY);
      if (!isVisible) setIsVisible(true);
    };

    const handleMouseDown = () => setIsPressed(true);
    const handleMouseUp = () => setIsPressed(false);

    const handleMouseLeave = () => setIsVisible(false);
    const handleMouseEnter = () => setIsVisible(true);

    const handlePointerOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) {
        setHoverState('default');
        return;
      }

      // Check if hovering over an interactive element (button, link, tab, clickable card)
      const isInteractive = target.closest(
        'button, a, .clay-btn, [role="button"], input[type="submit"], input[type="button"], .cursor-pointer, .clay-card-interactive'
      );
      if (isInteractive) {
        setHoverState('pointer');
        return;
      }

      // Check if hovering over a text input or text area
      const isTextInput = target.closest(
        'input[type="text"], input[type="search"], input[type="email"], textarea, [contenteditable="true"], .clay-input'
      );
      if (isTextInput) {
        setHoverState('text');
        return;
      }

      setHoverState('default');
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('mouseleave', handleMouseLeave);
    document.addEventListener('mouseenter', handleMouseEnter);
    window.addEventListener('pointerover', handlePointerOver);

    return () => {
      mediaQuery.removeEventListener('change', updatePointerType);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('mouseleave', handleMouseLeave);
      document.removeEventListener('mouseenter', handleMouseEnter);
      window.removeEventListener('pointerover', handlePointerOver);
    };
  }, [mouseX, mouseY, isVisible]);

  if (isTouchDevice) {
    return null;
  }

  return (
    <div
      className={`fixed top-0 left-0 pointer-events-none z-[999999] transition-opacity duration-200 ${
        isVisible ? 'opacity-100' : 'opacity-0'
      }`}
    >
      <motion.div
        style={{
          x: mouseX,
          y: mouseY,
          // Hotspot alignment: top-left corner for arrow, center for text/pointer
          translateX: hoverState === 'text' ? '-50%' : hoverState === 'pointer' ? '-25%' : '-15%',
          translateY: hoverState === 'text' ? '-50%' : hoverState === 'pointer' ? '-10%' : '-15%',
        }}
        animate={{
          scale: isPressed ? 0.84 : hoverState === 'pointer' ? 1.12 : 1,
          rotate: isPressed ? -4 : 0,
        }}
        transition={{ type: 'spring', stiffness: 500, damping: 28 }}
        className="w-8 h-8 flex items-center justify-center filter drop-shadow-[0_8px_16px_rgba(249,115,22,0.35)]"
      >
        {hoverState === 'text' ? (
          /* 3D Clay I-Beam Text Cursor */
          <svg width="24" height="28" viewBox="0 0 24 28" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="clay-text-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#FB923C" />
                <stop offset="50%" stopColor="#F97316" />
                <stop offset="100%" stopColor="#EA580C" />
              </linearGradient>
            </defs>
            <path
              d="M6 3H18M6 25H18M12 3V25"
              stroke="url(#clay-text-grad)"
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M7 4H17M12 4V24"
              stroke="#FFFFFF"
              strokeOpacity="0.85"
              strokeWidth="1.4"
              strokeLinecap="round"
            />
          </svg>
        ) : hoverState === 'pointer' ? (
          /* 3D Clay Pointer Hand Cursor */
          <svg width="30" height="30" viewBox="0 0 30 30" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="clay-hand-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#FB923C" />
                <stop offset="50%" stopColor="#F97316" />
                <stop offset="100%" stopColor="#EA580C" />
              </linearGradient>
              <linearGradient id="clay-hand-highlight" x1="0%" y1="0%" x2="80%" y2="80%">
                <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.9" />
                <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
              </linearGradient>
            </defs>

            {/* Base 3D Clay Pointer Hand */}
            <path
              d="M10 2C9.1 2 8.5 2.7 8.5 3.5V13.8L6.8 12.3C6.1 11.6 5 11.6 4.3 12.3C3.6 13 3.6 14.1 4.3 14.8L10.5 21C12.5 23 15.2 24.1 18.1 24.1H19.5C22.8 24.1 25.5 21.4 25.5 18.1V10.5C25.5 9.7 24.8 9 24 9C23.2 9 22.5 9.7 22.5 10.5V11.5C22.2 10.6 21.4 10 20.5 10C19.7 10 19 10.7 19 11.5V12C18.7 11.1 17.9 10.5 17 10.5C16.2 10.5 15.5 11.2 15.5 12V3.5C15.5 2.7 14.8 2 14 2C13.2 2 12.5 2.7 12.5 3.5V9.5H11.5V3.5C11.5 2.7 10.8 2 10 2Z"
              fill="url(#clay-hand-grad)"
              stroke="#FFF7ED"
              strokeWidth="1.6"
              strokeLinejoin="round"
            />
            {/* Top Gloss Highlight */}
            <path
              d="M10 3.5V12.5M14 3.5V8.5"
              stroke="url(#clay-hand-highlight)"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        ) : (
          /* Normal 3D Clay Arrow Cursor */
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="clay-arrow-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#FB923C" />
                <stop offset="45%" stopColor="#F97316" />
                <stop offset="100%" stopColor="#EA580C" />
              </linearGradient>
              <linearGradient id="clay-arrow-highlight" x1="0%" y1="0%" x2="70%" y2="70%">
                <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.95" />
                <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0.1" />
              </linearGradient>
            </defs>

            {/* Base 3D Clay Arrow Body */}
            <path
              d="M3.5 2.5L11.8 23.2C12.2 24.2 13.6 24.2 14.0 23.1L17.5 15.2L25.4 11.7C26.5 11.3 26.5 9.9 25.5 9.5L5.1 0.9C4.1 0.5 3.1 1.5 3.5 2.5Z"
              fill="url(#clay-arrow-grad)"
              stroke="#FFF7ED"
              strokeWidth="1.8"
              strokeLinejoin="round"
            />

            {/* Top-Left Inner Gloss Highlight */}
            <path
              d="M5.2 3.6L12.1 20.2L15.1 13.6L21.7 10.7L5.2 3.6Z"
              fill="none"
              stroke="url(#clay-arrow-highlight)"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Bottom-Right Inner Bevel Shade */}
            <path
              d="M15.1 13.6L21.7 10.7"
              fill="none"
              stroke="#7C2D12"
              strokeOpacity="0.4"
              strokeWidth="1.4"
              strokeLinecap="round"
            />
          </svg>
        )}
      </motion.div>
    </div>
  );
};
