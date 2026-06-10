import React, { useRef, useState, useEffect } from 'react';

interface ScrollingTextProps {
  text: React.ReactNode;
  style?: React.CSSProperties;
  className?: string;
}

export const ScrollingText = ({ text, style, className }: ScrollingTextProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const [isOverflowing, setIsOverflowing] = useState(false);
  const [overflowAmount, setOverflowAmount] = useState(0);

  useEffect(() => {
    const checkOverflow = () => {
      if (containerRef.current && textRef.current) {
        const overflow = textRef.current.scrollWidth - containerRef.current.clientWidth;
        if (overflow > 0) {
          setIsOverflowing(true);
          // Add 16px extra so we can scroll past the text slightly for readability
          setOverflowAmount(overflow + 16);
        } else {
          setIsOverflowing(false);
          setOverflowAmount(0);
        }
      }
    };
    checkOverflow();
    // small delay on initial mount to ensure layout is done
    setTimeout(checkOverflow, 100);
    window.addEventListener('resize', checkOverflow);
    return () => window.removeEventListener('resize', checkOverflow);
  }, [text]);

  return (
    <div ref={containerRef} className={`scroll-text-container ${className || ''}`} style={{ ...style, '--overflow-amount': `-${overflowAmount}px` } as React.CSSProperties}>
      <div 
        ref={textRef} 
        className={`scroll-text-content ${isOverflowing ? 'overflowing' : ''}`}
      >
        {text}
      </div>
    </div>
  );
};
