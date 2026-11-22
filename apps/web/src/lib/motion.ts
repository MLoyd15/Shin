import type { Transition, Variants } from "motion/react";

export const DURATION = {
  fast: 0.12,
  normal: 0.2,
  slow: 0.32,
} as const;

export const EASING = {
  standard: [0.2, 0, 0, 1] as const,
  emphasized: [0.05, 0.7, 0.1, 1] as const,
} as const;

export const transitionStandard: Transition = {
  duration: DURATION.normal,
  ease: EASING.standard,
};

export const transitionEmphasized: Transition = {
  duration: DURATION.normal,
  ease: EASING.emphasized,
};

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: transitionStandard },
  exit: { opacity: 0, transition: { duration: DURATION.fast, ease: EASING.standard } },
};

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.96 },
  visible: { opacity: 1, scale: 1, transition: transitionEmphasized },
  exit: { opacity: 0, scale: 0.96, transition: { duration: DURATION.fast, ease: EASING.standard } },
};

export const slideInRight: Variants = {
  hidden: { opacity: 0, x: 24 },
  visible: { opacity: 1, x: 0, transition: transitionEmphasized },
  exit: { opacity: 0, x: 24, transition: { duration: DURATION.fast, ease: EASING.standard } },
};
