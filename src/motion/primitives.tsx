import React, { useEffect, useState } from 'react';
import {
  motion,
  animate,
  AnimatePresence,
  type HTMLMotionProps,
  type Variants,
} from 'motion/react';
import { MOTION } from './tokens';
import { usePrefersReducedMotion } from './reduced-motion';

type DivProps = Omit<HTMLMotionProps<'div'>, 'children'> & {
  children?: React.ReactNode;
};

const viewOpts = { once: true, amount: 0.15, margin: '0px 0px -80px 0px' as const };

function StaticDiv({
  children,
  className,
  id,
}: {
  children?: React.ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <div className={className} id={id}>
      {children}
    </div>
  );
}

export function FadeIn({
  children,
  className,
  delay = 0,
  duration = MOTION.duration.base,
  ...rest
}: DivProps & { delay?: number; duration?: number }) {
  const reduced = usePrefersReducedMotion();
  if (reduced) {
    return <StaticDiv className={className}>{children}</StaticDiv>;
  }
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={viewOpts}
      transition={{ duration, delay, ease: MOTION.ease.out }}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

export function FadeUp({
  children,
  className,
  delay = 0,
  distance = MOTION.distance.sm,
  duration = MOTION.duration.base,
  /** When false, animate on mount instead of in-view */
  inView = true,
  /** When false, only translate (keeps LCP text paintable) */
  fade = true,
  id,
  ...rest
}: DivProps & {
  delay?: number;
  distance?: number;
  duration?: number;
  inView?: boolean;
  fade?: boolean;
}) {
  const reduced = usePrefersReducedMotion();
  if (reduced) {
    return (
      <StaticDiv className={className} id={id}>
        {children}
      </StaticDiv>
    );
  }

  const anim = {
    initial: fade ? { opacity: 0, y: distance } : { y: distance },
    animate: fade ? { opacity: 1, y: 0 } : { y: 0 },
    transition: { duration, delay, ease: MOTION.ease.out },
  };

  if (!inView) {
    return (
      <motion.div
        className={className}
        id={id}
        initial={anim.initial}
        animate={anim.animate}
        transition={anim.transition}
        {...rest}
      >
        {children}
      </motion.div>
    );
  }

  return (
    <motion.div
      className={className}
      id={id}
      initial={anim.initial}
      whileInView={anim.animate}
      viewport={viewOpts}
      transition={anim.transition}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

const staggerContainer = (stagger: number = MOTION.stagger.base): Variants => ({
  hidden: {},
  show: {
    transition: { staggerChildren: stagger },
  },
});

const staggerItem = (distance: number = MOTION.distance.sm): Variants => ({
  hidden: { opacity: 0, y: distance, scale: 0.97 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: MOTION.duration.slow, ease: MOTION.ease.out },
  },
});

export function Stagger({
  children,
  className,
  stagger = MOTION.stagger.base,
  inView = true,
  ...rest
}: DivProps & { stagger?: number; inView?: boolean }) {
  const reduced = usePrefersReducedMotion();
  if (reduced) {
    return <StaticDiv className={className}>{children}</StaticDiv>;
  }

  const variants = staggerContainer(stagger);

  if (!inView) {
    return (
      <motion.div
        className={className}
        variants={variants}
        initial="hidden"
        animate="show"
        {...rest}
      >
        {children}
      </motion.div>
    );
  }

  return (
    <motion.div
      className={className}
      variants={variants}
      initial="hidden"
      whileInView="show"
      viewport={viewOpts}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({
  children,
  className,
  distance = MOTION.distance.sm,
  /** Soft lift on hover — for interactive/marketing cards */
  hoverLift = false,
  ...rest
}: DivProps & { distance?: number; hoverLift?: boolean }) {
  const reduced = usePrefersReducedMotion();
  if (reduced) {
    return <StaticDiv className={className}>{children}</StaticDiv>;
  }
  return (
    <motion.div
      className={className}
      variants={staggerItem(distance)}
      whileHover={
        hoverLift
          ? { y: -6, transition: { duration: MOTION.duration.fast, ease: MOTION.ease.out } }
          : undefined
      }
      {...rest}
    >
      {children}
    </motion.div>
  );
}

export function PageSection({
  children,
  className,
  id,
  ...rest
}: DivProps & { id?: string }) {
  return (
    <FadeUp className={className} id={id} distance={MOTION.distance.md} {...rest}>
      {children}
    </FadeUp>
  );
}

type ModalShellProps = {
  open: boolean;
  onClose?: () => void;
  children: React.ReactNode;
  /** Panel wrapper class (white card) */
  panelClassName?: string;
  overlayClassName?: string;
  labelledBy?: string;
  zIndexClass?: string;
};

/**
 * Backdrop + panel enter/exit. Wrap modal content; parent controls `open`.
 */
export function ModalMotion({
  open,
  onClose,
  children,
  panelClassName = 'relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-[#DCE5E3] overflow-hidden my-8',
  overlayClassName = 'fixed inset-0 flex items-center justify-center p-4 bg-[#0E1B1F]/60 backdrop-blur-xs overflow-y-auto',
  labelledBy,
  zIndexClass = 'z-50',
}: ModalShellProps) {
  const reduced = usePrefersReducedMotion();

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="modal-root"
          role="dialog"
          aria-modal="true"
          aria-labelledby={labelledBy}
          className={`${overlayClassName} ${zIndexClass}`}
          initial={reduced ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={reduced ? undefined : { opacity: 0 }}
          transition={{ duration: MOTION.duration.fast, ease: MOTION.ease.out }}
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose?.();
          }}
        >
          <motion.div
            className={panelClassName}
            initial={reduced ? false : { opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={reduced ? undefined : { opacity: 0, scale: 0.98, y: 8 }}
            transition={{ duration: MOTION.duration.base, ease: MOTION.ease.out }}
            onClick={(e) => e.stopPropagation()}
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Drawer from the right (mobile nav) */
export function DrawerMotion({
  open,
  onClose,
  children,
  labelledBy,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  labelledBy?: string;
}) {
  const reduced = usePrefersReducedMotion();

  return (
    <AnimatePresence>
      {open && (
        <div className="md:hidden fixed inset-0 z-50" role="presentation">
          <motion.button
            type="button"
            aria-label="Close menu"
            className="absolute inset-0 bg-[#0E1B1F]/55 backdrop-blur-[2px] cursor-default"
            initial={reduced ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={reduced ? undefined : { opacity: 0 }}
            transition={{ duration: MOTION.duration.fast }}
            onClick={onClose}
          />
          <motion.div
            id="mobile-nav-drawer"
            role="dialog"
            aria-modal="true"
            aria-labelledby={labelledBy}
            aria-label="Navigation menu"
            className="absolute inset-y-0 right-0 w-[min(100%,20.5rem)] bg-[#0E1B1F] border-l border-white/10 shadow-2xl flex flex-col"
            initial={reduced ? false : { x: '100%' }}
            animate={{ x: 0 }}
            exit={reduced ? undefined : { x: '100%' }}
            transition={{ duration: MOTION.duration.slow, ease: MOTION.ease.out }}
          >
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

export function TapScale({
  children,
  className,
  ...rest
}: DivProps) {
  const reduced = usePrefersReducedMotion();
  if (reduced) {
    return <StaticDiv className={className}>{children}</StaticDiv>;
  }
  return (
    <motion.div
      className={className}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: MOTION.duration.instant }}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

export function PanelSwap({
  panelKey,
  children,
  className,
}: {
  panelKey: string;
  children: React.ReactNode;
  className?: string;
}) {
  const reduced = usePrefersReducedMotion();
  if (reduced) {
    return <div className={className}>{children}</div>;
  }
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={panelKey}
        className={className}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={{ duration: MOTION.duration.fast, ease: MOTION.ease.out }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

type CountUpProps = {
  value: number;
  prefix?: string;
  suffix?: string;
  className?: string;
  /** Seconds; calm bank-grade default */
  duration?: number;
  /** Delay before counting starts */
  delay?: number;
  decimals?: number;
  locale?: string;
};

/** Currency/number count-up; snaps instantly when reduced-motion is preferred. */
export function CountUp({
  value,
  prefix = '',
  suffix = '',
  className,
  duration = 0.85,
  delay = 0,
  decimals = 2,
  locale = 'en-US',
}: CountUpProps) {
  const reduced = usePrefersReducedMotion();
  const [display, setDisplay] = useState(reduced ? value : 0);

  useEffect(() => {
    if (reduced) {
      setDisplay(value);
      return;
    }

    setDisplay(0);
    const controls = animate(0, value, {
      duration,
      delay,
      ease: MOTION.ease.out,
      onUpdate: (latest) => setDisplay(latest),
    });

    return () => controls.stop();
  }, [value, duration, delay, reduced]);

  const formatted = display.toLocaleString(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  return (
    <span className={className}>
      {prefix}
      {formatted}
      {suffix}
    </span>
  );
}

export { AnimatePresence, motion, MOTION };
