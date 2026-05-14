import { LucideIcon } from 'lucide-react';
import { Card } from './ui/card';
import { motion } from 'motion/react';

interface SensorCardProps {
  title: string;
  value: string | number;
  unit?: string;
  icon: LucideIcon;
  status?: 'normal' | 'warning' | 'danger';
  subtitle?: string;
}

export function SensorCard({ title, value, unit, icon: Icon, status = 'normal', subtitle }: SensorCardProps) {
  const statusColors = {
    normal: 'text-green-600',
    warning: 'text-yellow-600',
    danger: 'text-red-600'
  };

  const bgColors = {
    normal: 'bg-green-50',
    warning: 'bg-yellow-50',
    danger: 'bg-red-50'
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="p-6 hover:shadow-lg transition-shadow">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-sm text-gray-500 mb-1">{title}</p>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-semibold">{value}</span>
              {unit && <span className="text-lg text-gray-500">{unit}</span>}
            </div>
            {subtitle && (
              <p className="text-xs text-gray-400 mt-1">{subtitle}</p>
            )}
          </div>
          <div className={`p-3 rounded-lg ${bgColors[status]}`}>
            <Icon className={`size-6 ${statusColors[status]}`} />
          </div>
        </div>
      </Card>
    </motion.div>
  );
}
