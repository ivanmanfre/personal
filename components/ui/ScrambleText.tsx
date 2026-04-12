import React, { useState, useEffect } from 'react';

const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export const ScrambleText: React.FC<{ text: string }> = ({ text }) => {
    const [display, setDisplay] = useState(text);
    const [resolved, setResolved] = useState(false);
    const center = Math.floor(text.length / 2);

    useEffect(() => {
        let tick = 0;

        const timeout = setTimeout(() => {
            const interval = setInterval(() => {
                setDisplay(
                    text
                        .split('')
                        .map((ch, i) => {
                            // Resolve outward from center
                            const dist = Math.abs(i - center);
                            if (dist < tick) return text[i];
                            if (ch === ' ') return ' ';
                            return CHARS[Math.floor(Math.random() * CHARS.length)];
                        })
                        .join('')
                );

                if (tick >= center + 1) {
                    clearInterval(interval);
                    setResolved(true);
                }

                tick += 1;
            }, 50);

            return () => clearInterval(interval);
        }, 500);

        return () => clearTimeout(timeout);
    }, [text, center]);

    return (
        <span
            style={{
                filter: resolved ? 'blur(0px)' : 'blur(1.5px)',
                transition: 'filter 0.3s ease-out',
            }}
        >
            {display}
        </span>
    );
};
