import React, { useState, useEffect } from 'react';

const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

const scramble = (text: string) =>
    text.split('').map(ch => ch === ' ' ? ' ' : CHARS[Math.floor(Math.random() * CHARS.length)]).join('');

export const ScrambleText: React.FC<{ text: string }> = ({ text }) => {
    const [display, setDisplay] = useState(() => scramble(text));
    const [scrambling, setScrambling] = useState(true);

    useEffect(() => {
        let tick = 0;

        const timeout = setTimeout(() => {
            const interval = setInterval(() => {
                setDisplay(
                    text
                        .split('')
                        .map((ch, i) => {
                            if (i < tick) return text[i];
                            if (ch === ' ') return ' ';
                            return CHARS[Math.floor(Math.random() * CHARS.length)];
                        })
                        .join('')
                );

                if (tick >= text.length) {
                    clearInterval(interval);
                    setScrambling(false);
                }

                tick += 1;
            }, 40);

            return () => clearInterval(interval);
        }, 200);

        return () => clearTimeout(timeout);
    }, [text]);

    return (
        <span
            style={{
                filter: scrambling ? 'blur(1px)' : 'blur(0px)',
                transition: 'filter 0.3s ease-out',
            }}
        >
            {display}
        </span>
    );
};
