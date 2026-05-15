import { Package, CheckCircle, XCircle, Radio } from 'lucide-react';
import { useIoTData } from '../hooks/useIoTData';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { motion } from 'motion/react';

export function Items() {
  const { items, data } = useIoTData();

  const presentItems = items.filter(item => item.status === 'present');
  const missingItems = items.filter(item => item.status === 'missing');

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="text-3xl font-bold mb-2">Item Detection (RFID)</h1>
        <p className="text-gray-600">Real-time tracking of items using RFID tags</p>
      </motion.div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total Items</p>
                <p className="text-3xl font-bold mt-1">{items.length}</p>
              </div>
              <Package className="size-10 text-blue-500" />
            </div>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="p-6 bg-green-50 border-green-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-green-700">Present</p>
                <p className="text-3xl font-bold mt-1 text-green-700">{presentItems.length}</p>
              </div>
              <CheckCircle className="size-10 text-green-500" />
            </div>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="p-6 bg-red-50 border-red-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-red-700">Missing</p>
                <p className="text-3xl font-bold mt-1 text-red-700">{missingItems.length}</p>
              </div>
              <XCircle className="size-10 text-red-500" />
            </div>
          </Card>
        </motion.div>
      </div>

      {/* RFID Scanner Status */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <Card className="p-6 bg-gradient-to-r from-purple-50 to-blue-50 border-purple-200">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-white rounded-lg shadow-sm">
              <Radio className="size-6 text-purple-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-purple-900">RFID Scanner Active</h3>
              <p className="text-sm text-purple-700 mt-1">
                Scanning for tagged items • Bag ID: {data.bagID}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <motion.div
                className="size-3 bg-green-500 rounded-full"
                animate={{ opacity: [1, 0.5, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
              <span className="text-sm font-medium text-purple-900">Connected</span>
            </div>
          </div>
        </Card>
      </motion.div>

      {/* Items List */}
      {items.length === 0 ? (
        <Card className="p-8 text-center border-dashed">
          <Package className="size-12 text-gray-300 mx-auto mb-3" />
          <h3 className="font-semibold mb-1">No RFID items registered yet</h3>
          <p className="text-sm text-gray-500">
            Add an item with its RFID tag or wait for Firebase RFID data to arrive.
          </p>
        </Card>
      ) : (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Present Items */}
        <div>
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <CheckCircle className="size-5 text-green-600" />
            Present Items
          </h2>
          <div className="space-y-3">
            {presentItems.map((item, index) => {
              return (
                <motion.div
                  key={item.itemID}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Card className="p-4 hover:shadow-md transition-shadow border-l-4 border-l-green-500">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-green-100 rounded-lg">
                          <Package className="size-5 text-green-600" />
                        </div>
                        <div>
                          <p className="font-medium">{item.itemName}</p>
                          <p className="text-xs text-gray-500">ID: {item.itemID}</p>
                        </div>
                      </div>
                      <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
                        Detected
                      </Badge>
                    </div>
                    
                    {item.pocketID && (
                      <div className="mt-3 pt-3 border-t flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Package className="size-4 text-gray-400" />
                          <span className="text-xs text-gray-600">Pocket ID: {item.pocketID}</span>
                        </div>
                      </div>
                    )}
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Missing Items */}
        <div>
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <XCircle className="size-5 text-red-600" />
            Missing Items
          </h2>
          {missingItems.length === 0 ? (
            <Card className="p-8 text-center border-dashed">
              <CheckCircle className="size-12 text-green-300 mx-auto mb-3" />
              <p className="text-gray-500">All items are present!</p>
            </Card>
          ) : (
            <div className="space-y-3">
              {missingItems.map((item, index) => (
                <motion.div
                  key={item.itemID}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Card className="p-4 hover:shadow-md transition-shadow border-l-4 border-l-red-500 bg-red-50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-red-100 rounded-lg">
                          <Package className="size-5 text-red-600" />
                        </div>
                        <div>
                          <p className="font-medium text-red-900">{item.itemName}</p>
                          <p className="text-xs text-red-600">ID: {item.itemID}</p>
                        </div>
                      </div>
                      <Badge variant="destructive">
                        Not Detected
                      </Badge>
                    </div>
                  </Card>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>
      )}
    </div>
  );
}
