import { motion } from 'framer-motion';
import React from 'react';

interface DemoShellProps {
  badge: string;
  title: string;
  subtitle: string;
  children: React.ReactNode;
  featureKey: string;
}

const DemoShell: React.FC<DemoShellProps> = ({
  badge,
  title,
  subtitle,
  children,
  featureKey,
}) => {
  return (
    <motion.div
      key={featureKey}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2 }}
      className="flex flex-col items-center w-full max-w-3xl mx-auto px-6 pb-28"
    >
      <div className="mb-6 text-center">
        <span className="inline-block bg-primary/10 text-primary text-xs font-medium px-3 py-1 rounded-full mb-3">
          {badge}
        </span>
        <h1 className="text-2xl font-bold dark:text-white text-gray-900 mb-1">
          {title}
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">{subtitle}</p>
      </div>
      <div className="w-full">{children}</div>
    </motion.div>
  );
};

export default DemoShell;
