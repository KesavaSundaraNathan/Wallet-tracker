import type { Transition } from 'framer-motion';

/* Apple-style springs expressed as Motion's bounce/duration (≈ damping/response). */
export const spring: Transition = { type: 'spring', bounce: 0, duration: 0.4 };          // default, critically damped
export const springSnappy: Transition = { type: 'spring', bounce: 0, duration: 0.28 };
export const springPop: Transition = { type: 'spring', bounce: 0.22, duration: 0.5 };    // only after momentum / selection
export const springSheet: Transition = { type: 'spring', bounce: 0.12, duration: 0.36 };

/* Custom curves (built-in CSS easings are too weak). */
export const easeOut = [0.23, 1, 0.32, 1] as const;
export const easeInOut = [0.77, 0, 0.175, 1] as const;
export const easeDrawer = [0.32, 0.72, 0, 1] as const;

/** Apple's momentum projection (Designing Fluid Interfaces). */
export function project(velocity: number, decelerationRate = 0.998) {
  return ((velocity / 1000) * decelerationRate) / (1 - decelerationRate);
}

/** Blur-in used for page and panel entrances. */
export const blurIn = {
  initial: { opacity: 0, y: 8, filter: 'blur(6px)' },
  animate: { opacity: 1, y: 0, filter: 'blur(0px)', transitionEnd: { filter: 'none', transform: 'none' } },
  transition: { duration: 0.34, ease: easeOut },
};

export const listItem = (i: number) => ({
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: 4, transition: { duration: 0.12 } },
  transition: { duration: 0.3, ease: easeOut, delay: Math.min(i, 10) * 0.04 },
});
