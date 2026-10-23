'use client';

import { motion } from 'framer-motion';
import { blurIn } from '@/lib/motion';

/** Re-mounts on every navigation: content materialises (blur → sharp) like the reference video. */
export default function Template({ children }: { children: React.ReactNode }) {
  return <motion.div {...blurIn}>{children}</motion.div>;
}
