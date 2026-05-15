import { Battery, Droplets, Thermometer, Wifi, WifiOff, Weight, Scale } from 'lucide-react';
import { SensorCard } from './SensorCard';
import { LocationMap } from './LocationMap';
import { useIoTData } from '../hooks/useIoTData';
import { Progress } from './ui/progress';
import { Badge } from './ui/badge';
import { Card } from './ui/card';
import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { BrandLogo } from './BrandLogo';

const BALANCE_THRESHOLD = 10;
const MAX_VISUAL_TILT   = 30;

function BalanceCard({ tiltX, tiltY, tiltZ }: { tiltX: number; tiltY: number; tiltZ: number }) {
  // Use whichever axis carries the meaningful tilt signal
  const balanceVal = Math.abs(tiltX) > 1 ? tiltX : Math.abs(tiltY) > 1 ? tiltY : tiltZ;

  const status =
    balanceVal >  BALANCE_THRESHOLD ? 'left'     :
    balanceVal < -BALANCE_THRESHOLD ? 'right'    : 'balanced';

  // Dot slides from 0% (full-left) to 100% (full-right)
  // positive balanceVal → left heavy → dot goes left (lower %)
  const dotPct = Math.max(0, Math.min(100,
    50 - (balanceVal / MAX_VISUAL_TILT) * 50
  ));

  const statusColor =
    status === 'balanced' ? 'text-green-600'  :
    status === 'left'     ? 'text-orange-500' : 'text-orange-500';

  const trackColor =
    status === 'balanced' ? 'bg-green-100'  : 'bg-orange-50';

  const dotColor =
    status === 'balanced' ? 'bg-green-500'  : 'bg-orange-500';

  const label =
    status === 'balanced' ? 'Balanced'   :
    status === 'left'     ? 'Left Heavy' : 'Right Heavy';

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      <Card className="p-6 hover:shadow-lg transition-shadow">
        <div className="flex items-start justify-between mb-3">
          <div>
            <p className="text-sm text-gray-500 mb-1">Balance Status</p>
            <p className={`text-2xl font-semibold ${statusColor}`}>{label}</p>
          </div>
          <div className={`p-3 rounded-lg ${status === 'balanced' ? 'bg-green-50' : 'bg-orange-50'}`}>
            <Scale className={`size-6 ${statusColor}`} />
          </div>
        </div>

        {/* ── Visual balance bar ── */}
        <div className="mt-4 mb-3">
          <div className="flex justify-between text-xs text-gray-400 mb-1">
            <span>LEFT</span>
            <span>RIGHT</span>
          </div>
          <div className={`relative h-4 rounded-full ${trackColor}`}>
            {/* centre mark */}
            <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-gray-300 -translate-x-1/2" />
            {/* sliding dot */}
            <motion.div
              className={`absolute top-1/2 -translate-y-1/2 size-4 rounded-full shadow ${dotColor}`}
              style={{ left: `${dotPct}%`, translateX: '-50%' }}
              animate={{ left: `${dotPct}%` }}
              transition={{ type: 'spring', stiffness: 120, damping: 18 }}
            />
          </div>
        </div>

        <p className="text-xs text-gray-400">
          X <span className={`font-mono font-semibold ${tiltX >= 0 ? 'text-blue-500' : 'text-red-500'}`}>
            {tiltX >= 0 ? '+' : ''}{tiltX.toFixed(1)}
          </span>
          {' · '}
          Y <span className="font-mono">{tiltY >= 0 ? '+' : ''}{tiltY.toFixed(1)}</span>
          {' · '}
          Z <span className="font-mono">{tiltZ.toFixed(1)}</span>
        </p>
      </Card>
    </motion.div>
  );
}

export function Dashboard() {
  const { data, user, items, firebaseStatus } = useIoTData();

  const getBatteryStatus = (battery: number) => {
    if (battery < 20) return 'danger';
    if (battery < 50) return 'warning';
    return 'normal';
  };

  const presentItems = items.filter(item => item.status === 'present');
  const missingItems = items.filter(item => item.status === 'missing');

  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg p-6 text-white"
      >
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl">
            <BrandLogo variant="dark" className="mb-4 h-32 w-auto max-w-md bg-black shadow-xl" />
            <p className="text-blue-100">Monitor your child's school bag in real-time with IoT sensors</p>
            <div className="mt-4 flex items-center gap-2">
              {firebaseStatus === 'live' ? (
                <>
                  <div className="size-2 bg-green-400 rounded-full animate-pulse" />
                  <span className="text-sm">Firebase Live · {data.lastUpdate.toLocaleTimeString()}</span>
                </>
              ) : firebaseStatus === 'no_telemetry' ? (
                <>
                  <WifiOff className="size-4 text-yellow-300" />
                  <span className="text-sm text-yellow-200">Hardware not sending data</span>
                </>
              ) : (
                <>
                  <Wifi className="size-4 text-blue-200 animate-pulse" />
                  <span className="text-sm text-blue-200">Connecting to Firebase…</span>
                </>
              )}
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm text-blue-100">Bag ID</p>
            <p className="text-xl font-bold font-mono">{data.bagID}</p>
          </div>
        </div>
      </motion.div>

      {/* ── Sensor Cards + Map ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <SensorCard
            title="Battery Level"
            value={data.battery.toFixed(0)}
            unit="%"
            icon={Battery}
            status={getBatteryStatus(data.battery)}
            subtitle={data.battery < 20 ? 'Charge soon' : 'Good condition'}
          />
          <SensorCard
            title="Temperature"
            value={data.temperature.toFixed(1)}
            unit="C"
            icon={Thermometer}
            status={data.temperature > 35 ? 'warning' : 'normal'}
            subtitle="DHT sensor reading"
          />
          <SensorCard
            title="Humidity"
            value={data.humidity.toFixed(0)}
            unit="%"
            icon={Droplets}
            status={data.humidity > 80 ? 'warning' : 'normal'}
            subtitle="Bag environment humidity"
          />
          <BalanceCard tiltX={data.tilt.x} tiltY={data.tilt.y} tiltZ={data.tilt.z} />
          <SensorCard
            title="Bag Weight"
            value={data.weight.toFixed(2)}
            unit="kg"
            icon={Weight}
            status={data.weight > 5 ? 'warning' : 'normal'}
            subtitle={data.weight > 5 ? 'Bag is heavy!' : 'Normal weight'}
          />
        </div>

        <div className="lg:col-span-1">
          <LocationMap location={data.location} isMoving={data.isMoving} />
        </div>
      </div>

      {/* ── Item Summary ── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.2 }}
        className="bg-white rounded-lg border p-6"
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold">RFID Item Detection</h3>
            <p className="text-sm text-gray-500">Quick overview of bag contents</p>
          </div>
          <Link to="/items">
            <Badge className="cursor-pointer hover:bg-blue-600">View All Items</Badge>
          </Link>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="p-4 bg-blue-50 rounded-lg text-center">
            <p className="text-3xl font-bold text-blue-700">{items.length}</p>
            <p className="text-sm text-blue-600 mt-1">Total Items</p>
          </div>
          <div className="p-4 bg-green-50 rounded-lg text-center">
            <p className="text-3xl font-bold text-green-700">{presentItems.length}</p>
            <p className="text-sm text-green-600 mt-1">Present</p>
          </div>
          <div className="p-4 bg-red-50 rounded-lg text-center">
            <p className="text-3xl font-bold text-red-700">{missingItems.length}</p>
            <p className="text-sm text-red-600 mt-1">Missing</p>
          </div>
        </div>

        {missingItems.length > 0 && (
          <div className="mt-4 p-3 bg-orange-50 border border-orange-200 rounded-lg">
            <p className="text-sm text-orange-800">
              ⚠️ {missingItems.length} item(s) missing: {missingItems.map(i => i.itemName).join(', ')}
            </p>
          </div>
        )}
      </motion.div>

      {/* ── Battery ── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.3 }}
        className="bg-white rounded-lg border p-6"
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold">Battery Status</h3>
            <p className="text-sm text-gray-500">
              Estimated time remaining: {Math.floor(data.battery / 2)} hours
            </p>
          </div>
          <Battery className={`size-8 ${
            data.battery < 20 ? 'text-red-600' :
            data.battery < 50 ? 'text-yellow-600' : 'text-green-600'
          }`} />
        </div>
        <Progress value={data.battery} className="h-3" />
      </motion.div>

    </div>
  );
}
