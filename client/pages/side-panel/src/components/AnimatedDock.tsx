'use client';

/* eslint-disable import/named -- motion/react subpath exports are not statically analyzable by eslint-plugin-import; verified present at runtime */
import React from 'react';
import { useRef } from 'react';
import { type MotionValue, motion, useMotionValue, useSpring, useTransform } from 'motion/react';

import clsx from 'clsx';
import { twMerge } from 'tailwind-merge';

const cn = (...args: Parameters<typeof clsx>) => twMerge(clsx(args));

export interface DockItemData {
  label: string;
  onClick: () => void;
  Icon: React.ReactNode;
}

export interface AnimatedDockProps {
  className?: string;
  items: DockItemData[];
}

/**
 * AnimatedDock — magnifying macOS-style quick action dock (React Bits, motion).
 * Springs animate width/transform only; mounted only in the empty state so it
 * costs nothing while a task runs.
 */
export const AnimatedDock = ({ className, items }: AnimatedDockProps) => {
  const mouseX = useMotionValue(Infinity);

  return (
    <motion.div
      onMouseMove={(e) => mouseX.set(e.pageX)}
      onMouseLeave={() => mouseX.set(Infinity)}
      className={cn('flex h-14 items-end gap-2 rounded-xl border border-subtle bg-surface px-3 pb-2', className)}
      role="toolbar"
      aria-label="Quick actions"
    >
      {items.map((item) => (
        <DockItem key={item.label} mouseX={mouseX}>
          <button
            type="button"
            onClick={item.onClick}
            title={item.label}
            aria-label={item.label}
            className="flex h-full w-full grow cursor-pointer items-center justify-center text-secondary hover:text-primary"
          >
            {item.Icon}
          </button>
        </DockItem>
      ))}
    </motion.div>
  );
};

interface DockItemProps {
  mouseX: MotionValue<number>;
  children: React.ReactNode;
}

export const DockItem = ({ mouseX, children }: DockItemProps) => {
  const ref = useRef<HTMLDivElement>(null);

  const distance = useTransform(mouseX, (val) => {
    const bounds = ref.current?.getBoundingClientRect() ?? { x: 0, width: 0 };
    return val - bounds.x - bounds.width / 2;
  });

  const widthSync = useTransform(distance, [-120, 0, 120], [36, 64, 36]);
  const width = useSpring(widthSync, {
    mass: 0.1,
    stiffness: 150,
    damping: 12,
  });

  const iconScale = useTransform(width, [36, 64], [1, 1.4]);
  const iconSpring = useSpring(iconScale, {
    mass: 0.1,
    stiffness: 150,
    damping: 12,
  });

  return (
    <motion.div
      ref={ref}
      style={{ width }}
      className="flex aspect-square items-center justify-center rounded-lg border border-subtle bg-elevated"
    >
      <motion.div style={{ scale: iconSpring }} className="flex h-full w-full grow items-center justify-center">
        {children}
      </motion.div>
    </motion.div>
  );
};

export default AnimatedDock;
