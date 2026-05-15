import { AlertTriangle, Info, AlertCircle, Bell, BellOff, Rotate3D } from 'lucide-react';
import { useIoTData } from '../hooks/useIoTData';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { motion } from 'motion/react';
import { useState } from 'react';
import { Dialog, DialogContent, DialogTrigger } from './ui/dialog';
import { Settings } from './Settings';

export function Alerts() {
  const { alerts, data } = useIoTData();
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'danger':
        return <AlertCircle className="size-5" />;
      case 'warning':
        return <AlertTriangle className="size-5" />;
      default:
        return <Info className="size-5" />;
    }
  };

  const getAlertColor = (type: string) => {
    switch (type) {
      case 'danger':
        return 'text-red-600 bg-red-50 border-red-200';
      case 'warning':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      default:
        return 'text-blue-600 bg-blue-50 border-blue-200';
    }
  };

  const getBadgeVariant = (type: string): "default" | "destructive" | "outline" | "secondary" => {
    switch (type) {
      case 'danger':
        return 'destructive';
      case 'warning':
        return 'default';
      default:
        return 'secondary';
    }
  };

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-3xl font-bold mb-2">Alerts & Notifications</h1>
          <p className="text-gray-600">Real-time alerts from your smart school bag</p>
        </div>

        <Button
          variant={notificationsEnabled ? "default" : "outline"}
          onClick={() => setNotificationsEnabled(!notificationsEnabled)}
          className="gap-2"
        >
          {notificationsEnabled ? (
            <>
              <Bell className="size-4" />
              Enabled
            </>
          ) : (
            <>
              <BellOff className="size-4" />
              Disabled
            </>
          )}
        </Button>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
        >
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Tilt Status</p>
                <p className={`text-2xl font-bold mt-1 ${data.tilt.isTilted ? 'text-yellow-600' : 'text-green-600'}`}>
                  {data.tilt.isTilted ? 'Tilted' : 'Normal'}
                </p>
                <p className="text-xs text-gray-400">MPU X {data.tilt.x.toFixed(0)} / Y {data.tilt.y.toFixed(0)}</p>
              </div>
              <Rotate3D className={`size-8 ${data.tilt.isTilted ? 'text-yellow-500' : 'text-green-500'}`} />
            </div>
          </Card>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total Alerts</p>
                <p className="text-2xl font-bold mt-1">{alerts.length}</p>
              </div>
              <Bell className="size-8 text-blue-500" />
            </div>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Warnings</p>
                <p className="text-2xl font-bold mt-1 text-yellow-600">
                  {alerts.filter(a => a.type === 'warning').length}
                </p>
              </div>
              <AlertTriangle className="size-8 text-yellow-500" />
            </div>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Critical</p>
                <p className="text-2xl font-bold mt-1 text-red-600">
                  {alerts.filter(a => a.type === 'danger').length}
                </p>
              </div>
              <AlertCircle className="size-8 text-red-500" />
            </div>
          </Card>
        </motion.div>
      </div>

      <div className="space-y-3">
        <h2 className="text-xl font-semibold">Recent Alerts</h2>

        {alerts.length === 0 ? (
          <Card className="p-8 text-center">
            <Bell className="size-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No alerts at the moment</p>
            <p className="text-sm text-gray-400 mt-1">You'll see notifications here when something needs your attention</p>
          </Card>
        ) : (
          <div className="space-y-3">
            {alerts.map((alert, index) => (
              <motion.div
                key={alert.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <Card className={`p-4 border-l-4 ${getAlertColor(alert.type)}`}>
                  <div className="flex items-start gap-4">
                    <div className={getAlertColor(alert.type).split(' ')[0]}>
                      {getAlertIcon(alert.type)}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="font-medium">{alert.message}</p>
                          <p className="text-sm text-gray-500 mt-1">
                            {alert.timestamp.toLocaleString()}
                          </p>
                        </div>
                        <Badge variant={getBadgeVariant(alert.type)} className="shrink-0">
                          {alert.type}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      <Dialog>
        <Card className="p-6 bg-gradient-to-r from-purple-50 to-blue-50">
          <div className="flex items-start gap-4">
            <Info className="size-6 text-purple-600 mt-1" />
            <div>
              <h3 className="font-semibold text-purple-900 mb-2">Alert Settings</h3>
              <p className="text-sm text-purple-700 mb-4">
                Configure what types of alerts you want to receive and how you'd like to be notified.
              </p>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  Configure Settings
                </Button>
              </DialogTrigger>
            </div>
          </div>
        </Card>
        <DialogContent>
          <Settings />
        </DialogContent>
      </Dialog>
    </div>
  );
}
