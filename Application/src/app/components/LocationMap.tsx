import { ExternalLink, MapPin, Navigation } from 'lucide-react';
import { Card } from './ui/card';
import { motion } from 'motion/react';

interface LocationMapProps {
  location: {
    lat: number;
    lng: number;
    address: string;
  };
  isMoving: boolean;
}

export function LocationMap({ location, isMoving }: LocationMapProps) {
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${location.lat},${location.lng}`;

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Real-time Location</h3>
        <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm ${
          isMoving ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'
        }`}>
          <Navigation className="size-4" />
          {isMoving ? 'Moving' : 'Stationary'}
        </div>
      </div>

      <a
        href={mapsUrl}
        target="_blank"
        rel="noreferrer"
        title="Open in Google Maps"
        className="group relative block h-64 bg-gradient-to-br from-blue-50 to-green-50 rounded-lg overflow-hidden mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <div className="absolute inset-0 opacity-10">
          <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
            <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
              <path d="M 20 0 L 0 0 0 20" fill="none" stroke="gray" strokeWidth="0.5" />
            </pattern>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>
        </div>

        <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg">
          <line x1="0" y1="40%" x2="100%" y2="40%" stroke="#cbd5e1" strokeWidth="3" />
          <line x1="30%" y1="0" x2="30%" y2="100%" stroke="#cbd5e1" strokeWidth="3" />
          <line x1="70%" y1="0" x2="70%" y2="100%" stroke="#cbd5e1" strokeWidth="3" />
          <line x1="0" y1="70%" x2="100%" y2="70%" stroke="#cbd5e1" strokeWidth="3" />
        </svg>

        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2">
          <div className="bg-purple-200 rounded-lg p-3 shadow-md">
            <div className="text-xs font-semibold text-purple-900">School</div>
          </div>
        </div>

        <motion.div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
          animate={isMoving ? {
            x: [0, 10, -10, 5, -5, 0],
            y: [0, -5, 5, -10, 10, 0],
          } : {}}
          transition={{ duration: 10, repeat: Infinity, ease: 'linear' }}
        >
          <motion.div
            className="relative"
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <MapPin className="size-10 text-red-500 drop-shadow-lg" fill="currentColor" />
            <motion.div
              className="absolute inset-0 bg-red-400 rounded-full"
              animate={{ scale: [1, 2, 2], opacity: [0.6, 0, 0] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
          </motion.div>
        </motion.div>

        <div className="absolute bottom-2 left-2 bg-white/90 backdrop-blur-sm px-3 py-1 rounded-md shadow-sm text-xs">
          <span className="font-mono">{location.lat.toFixed(6)}, {location.lng.toFixed(6)}</span>
        </div>
        <div className="absolute bottom-2 right-2 flex items-center gap-1 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm transition-colors group-hover:bg-blue-700">
          <ExternalLink className="size-3.5" />
          Google Maps
        </div>
      </a>

      <a
        href={mapsUrl}
        target="_blank"
        rel="noreferrer"
        className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg transition-colors hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <MapPin className="size-5 text-gray-600 mt-0.5 flex-shrink-0" />
        <div className="flex-1">
          <p className="font-medium text-sm">{location.address}</p>
          <p className="text-xs text-gray-500 mt-0.5">Last updated: just now - Open in Google Maps</p>
        </div>
        <ExternalLink className="size-4 text-gray-500" />
      </a>
    </Card>
  );
}
