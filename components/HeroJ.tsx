import React from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { ArrowRight } from 'lucide-react';

// Variant J — Cursor-reactive editorial.
// Magnetic CTAs (pull toward cursor), portrait tilts on mouse-position parallax,
// canvas-rendered flow-field background pulses sage on cursor. Typography is
// editorial-restrained but the page feels alive — every element responds to the
// reader. "Editorial premium with a heartbeat."

// Animated noise canvas — flow field sage particles
const FlowFieldCanvas: React.FC<{ mouseX: number; mouseY: number }> = ({ mouseX, mouseY }) => {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const rafRef = React.useRef<number>(0);
  const particlesRef = React.useRef<{ x: number; y: number; vx: number; vy: number; life: number }[]>([]);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const resize = () => {
      canvas.width = canvas.offsetWidth * dpr;
      canvas.height = canvas.offsetHeight * dpr;
      ctx.scale(dpr, dpr);
    };
    resize();
    window.addEventListener('resize', resize);

    // Seed 80 particles
    if (particlesRef.current.length === 0) {
      for (let i = 0; i < 80; i++) {
        particlesRef.current.push({
          x: Math.random() * canvas.offsetWidth,
          y: Math.random() * canvas.offsetHeight,
          vx: 0,
          vy: 0,
          life: Math.random() * 100,
        });
      }
    }

    const draw = () => {
      ctx.fillStyle = 'rgba(247,244,239,0.06)';
      ctx.fillRect(0, 0, canvas.offsetWidth, canvas.offsetHeight);

      const mx = mouseX * canvas.offsetWidth;
      const my = mouseY * canvas.offsetHeight;

      particlesRef.current.forEach((p) => {
        // Flow field via sin/cos noise
        const n = Math.sin(p.x * 0.005 + p.life * 0.02) + Math.cos(p.y * 0.005);
        p.vx += Math.cos(n) * 0.15;
        p.vy += Math.sin(n) * 0.15;

        // Mouse attraction
        const dx = mx - p.x;
        const dy = my - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 200 && dist > 0) {
          p.vx += (dx / dist) * 0.4;
          p.vy += (dy / dist) * 0.4;
        }

        // Friction
        p.vx *= 0.92;
        p.vy *= 0.92;

        p.x += p.vx;
        p.y += p.vy;
        p.life += 0.5;

        // Wrap
        if (p.x < 0) p.x = canvas.offsetWidth;
        if (p.x > canvas.offsetWidth) p.x = 0;
        if (p.y < 0) p.y = canvas.offsetHeight;
        if (p.y > canvas.offsetHeight) p.y = 0;

        const alpha = Math.min(0.5, dist < 200 ? 0.6 - dist / 400 : 0.15);
        ctx.fillStyle = `rgba(42,143,101,${alpha})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 1.2, 0, Math.PI * 2);
        ctx.fill();
      });

      rafRef.current = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', resize);
    };
  }, [mouseX, mouseY]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        opacity: 0.5,
        pointerEvents: 'none',
      }}
    />
  );
};

// Magnetic button wrapper
const Magnetic: React.FC<{ children: React.ReactNode; className?: string; href: string; style?: React.CSSProperties }> = ({
  children,
  className,
  href,
  style,
}) => {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 200, damping: 18 });
  const sy = useSpring(y, { stiffness: 200, damping: 18 });
  const ref = React.useRef<HTMLAnchorElement>(null);

  return (
    <motion.a
      ref={ref}
      href={href}
      className={className}
      style={{ ...style, x: sx, y: sy }}
      onMouseMove={(e) => {
        const rect = ref.current?.getBoundingClientRect();
        if (!rect) return;
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        x.set((e.clientX - cx) * 0.25);
        y.set((e.clientY - cy) * 0.25);
      }}
      onMouseLeave={() => {
        x.set(0);
        y.set(0);
      }}
    >
      {children}
    </motion.a>
  );
};

const HeroJ: React.FC = () => {
  const mouseX = useMotionValue(0.5);
  const mouseY = useMotionValue(0.5);
  const [mx, setMx] = React.useState(0.5);
  const [my, setMy] = React.useState(0.5);

  const portraitTiltX = useTransform(mouseY, [0, 1], [6, -6]);
  const portraitTiltY = useTransform(mouseX, [0, 1], [-6, 6]);
  const sx = useSpring(portraitTiltX, { stiffness: 60, damping: 18 });
  const sy = useSpring(portraitTiltY, { stiffness: 60, damping: 18 });

  return (
    <section
      className="relative min-h-screen pt-28 pb-12 flex flex-col justify-center bg-paper overflow-hidden"
      onMouseMove={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width;
        const y = (e.clientY - rect.top) / rect.height;
        mouseX.set(x);
        mouseY.set(y);
        setMx(x);
        setMy(y);
      }}
    >
      <FlowFieldCanvas mouseX={mx} mouseY={my} />

      <div className="container mx-auto px-6 relative z-10">
        <div className="flex flex-col lg:flex-row items-start gap-12 max-w-5xl mx-auto">
          <div className="flex-1 min-w-0">
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.6 }}
              className="mb-10 flex items-center gap-3"
              style={{
                fontFamily: '"IBM Plex Mono", monospace',
                fontSize: '11px',
                letterSpacing: '0.22em',
                textTransform: 'uppercase',
                color: 'rgba(26,26,26,0.55)',
              }}
            >
              <motion.span
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{ duration: 2, repeat: Infinity }}
                style={{ color: '#2A8F65' }}
              >
                ●
              </motion.span>
              Iván Manfredi · Move your cursor
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 1.0, ease: [0.22, 0.84, 0.36, 1] }}
              className="mb-10"
              style={{
                fontFamily: '"Instrument Serif", serif',
                fontWeight: 400,
                fontSize: 'clamp(3.5rem, 9vw, 7.5rem)',
                lineHeight: 0.94,
                letterSpacing: '-0.015em',
                color: '#1A1A1A',
              }}
            >
              Systems scale.
              <br />
              <span style={{ fontStyle: 'italic' }}>Headcount doesn't.</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.9, duration: 0.9 }}
              className="max-w-xl mb-10"
              style={{
                fontFamily: '"Source Serif 4", Georgia, serif',
                fontWeight: 400,
                fontSize: '19px',
                lineHeight: 1.6,
                color: '#3D3D3B',
              }}
            >
              I diagnose where AI actually moves the needle in your business — then implement
              alongside the team you already trust.{' '}
              <span style={{ fontStyle: 'italic', color: '#2A8F65' }}>
                Ninety-day payback, or I don't build it.
              </span>
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.2, duration: 0.7 }}
              className="flex flex-col sm:flex-row items-start gap-3"
            >
              <Magnetic
                href="/assessment"
                className="inline-flex items-center gap-2.5 px-7 py-3.5 bg-accent text-white"
                style={{ fontFamily: '"Source Serif 4", serif', fontWeight: 600, fontSize: '16px' }}
              >
                Build your Blueprint <ArrowRight size={18} />
              </Magnetic>
              <Magnetic
                href="/scorecard"
                className="inline-flex items-center gap-2 px-7 py-3.5 text-ink-mute hover:text-black"
                style={{
                  fontFamily: '"Source Serif 4", serif',
                  fontWeight: 600,
                  fontSize: '16px',
                  fontStyle: 'italic',
                }}
              >
                Are you Agent-Ready? <ArrowRight size={16} />
              </Magnetic>
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.6, duration: 1.2 }}
            style={{ rotateX: sx, rotateY: sy, transformStyle: 'preserve-3d', perspective: 1000 }}
            className="hidden lg:block shrink-0 pt-2"
          >
            <picture>
              <source
                type="image/webp"
                srcSet="/ivan-hero-800.webp 800w, /ivan-hero-1200.webp 1200w"
                sizes="320px"
              />
              <img
                src="/ivan-hero.jpeg"
                alt="Iván Manfredi"
                width="1200"
                height="1600"
                className="w-72 xl:w-80 aspect-[3/4] object-cover object-top"
                style={{
                  borderRadius: '0',
                  boxShadow: '0 30px 60px -20px rgba(0,0,0,0.25)',
                }}
              />
            </picture>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default HeroJ;
