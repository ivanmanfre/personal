import React, { useState, useEffect } from 'react';

const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$*!';

export const ScrambleText: React.FC<{ text: string }> = ({ text }) => {
    const [display, setDisplay] = useState(text);

    useEffect(() => {
        let iteration = 0;

        // Slight delay before scrambling starts to allow for initial page load
        const timeout = setTimeout(() => {
            const interval = setInterval(() => {
                setDisplay(() =>
                    text
                        .split('')
                        .map((letter, index) => {
                            if (index < iteration) {
                                return text[index];
                            }
                            if (text[index] === ' ') return ' ';
                            return CHARS[Math.floor(Math.random() * CHARS.length)];
                        })
                        .join('')
                );

                if (iteration >= text.length) {
                    clearInterval(interval);
                }

                iteration += 1 / 3;
            }, 30);

            return () => clearInterval(interval);
        }, 300);

        return () => clearTimeout(timeout);
    }, [text]);

    return <span className="font-mono tracking-tight">{display}</span>;
};
