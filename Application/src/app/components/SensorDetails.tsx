import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { useIoTData } from '../hooks/useIoTData';
import { Card } from './ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Rotate3D, Thermometer, Weight } from 'lucide-react';
import { motion } from 'motion/react';

export function SensorDetails() {
  const { historicalData } = useIoTData();

  const chartData = historicalData.map(d => ({
    time:        d.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    temperature: Number(d.temperature.toFixed(1)),
    humidity:    Number(d.humidity.toFixed(0)),
    tilt:        Number(d.tiltAngle.toFixed(0)),
    weight:      Number(d.weight.toFixed(2)),
  }));

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="text-3xl font-bold mb-2">Sensor Analytics</h1>
        <p className="text-gray-600">Detailed historical data from your smart school bag sensors</p>
      </motion.div>

      <Tabs defaultValue="bag-interior" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 lg:w-[390px]">
          <TabsTrigger value="bag-interior">Interior</TabsTrigger>
          <TabsTrigger value="weight">Weight</TabsTrigger>
          <TabsTrigger value="tilt">Tilt</TabsTrigger>
        </TabsList>

        <TabsContent value="bag-interior">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card className="p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 bg-cyan-100 rounded-lg">
                  <Thermometer className="size-6 text-cyan-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold">Bag Interior Temperature & Humidity</h3>
                  <p className="text-sm text-gray-500">DHT sensor readings from inside the bag</p>
                </div>
              </div>
              
              <ResponsiveContainer width="100%" height={350}>
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorTemperature" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0891b2" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#0891b2" stopOpacity={0.1}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis 
                    dataKey="time" 
                    tick={{ fontSize: 12 }}
                    stroke="#9ca3af"
                  />
                  <YAxis 
                    tick={{ fontSize: 12 }}
                    stroke="#9ca3af"
                    label={{ value: 'Value', angle: -90, position: 'insideLeft' }}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'white', 
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px'
                    }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="temperature" 
                    stroke="#0891b2" 
                    fillOpacity={1}
                    fill="url(#colorTemperature)"
                    strokeWidth={2}
                  />
                  <Line type="monotone" dataKey="humidity" stroke="#2563eb" strokeWidth={2} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
              
              <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t">
                <div>
                  <p className="text-sm text-gray-500">Avg Temp</p>
                  <p className="text-2xl font-semibold">
                    {(chartData.reduce((acc, d) => acc + d.temperature, 0) / chartData.length).toFixed(1)} C
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Avg Humidity</p>
                  <p className="text-2xl font-semibold">
                    {(chartData.reduce((acc, d) => acc + d.humidity, 0) / chartData.length).toFixed(0)}%
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Max Temp</p>
                  <p className="text-2xl font-semibold">
                    {Math.max(...chartData.map(d => d.temperature)).toFixed(1)} C
                  </p>
                </div>
              </div>
            </Card>
          </motion.div>
        </TabsContent>

        <TabsContent value="weight">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 bg-orange-100 rounded-lg">
                  <Weight className="size-6 text-orange-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold">Bag Weight</h3>
                  <p className="text-sm text-gray-500">Load cell readings over time (kg)</p>
                </div>
              </div>

              <ResponsiveContainer width="100%" height={350}>
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorWeight" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#ea580c" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#ea580c" stopOpacity={0.1}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="time" tick={{ fontSize: 12 }} stroke="#9ca3af" />
                  <YAxis tick={{ fontSize: 12 }} stroke="#9ca3af"
                    label={{ value: 'kg', angle: -90, position: 'insideLeft' }} />
                  <Tooltip
                    formatter={(v: number) => [`${v} kg`, 'Weight']}
                    contentStyle={{ backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                  />
                  <Area type="monotone" dataKey="weight" stroke="#ea580c"
                    fillOpacity={1} fill="url(#colorWeight)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>

              <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t">
                <div>
                  <p className="text-sm text-gray-500">Current</p>
                  <p className="text-2xl font-semibold">
                    {chartData.length ? chartData[chartData.length - 1].weight.toFixed(2) : '0.00'} kg
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Max</p>
                  <p className="text-2xl font-semibold">
                    {chartData.length ? Math.max(...chartData.map(d => d.weight)).toFixed(2) : '0.00'} kg
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Avg</p>
                  <p className="text-2xl font-semibold">
                    {chartData.length
                      ? (chartData.reduce((s, d) => s + d.weight, 0) / chartData.length).toFixed(2)
                      : '0.00'} kg
                  </p>
                </div>
              </div>
            </Card>
          </motion.div>
        </TabsContent>

        <TabsContent value="tilt">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card className="p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 bg-indigo-100 rounded-lg">
                  <Rotate3D className="size-6 text-indigo-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold">MPU Tilt Tracking</h3>
                  <p className="text-sm text-gray-500">Monitor tilt angle from the MPU sensor</p>
                </div>
              </div>
              
              <ResponsiveContainer width="100%" height={350}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis 
                    dataKey="time" 
                    tick={{ fontSize: 12 }}
                    stroke="#9ca3af"
                  />
                  <YAxis 
                    tick={{ fontSize: 12 }}
                    stroke="#9ca3af"
                    label={{ value: 'Degrees', angle: -90, position: 'insideLeft' }}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'white', 
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px'
                    }}
                  />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="tilt" 
                    stroke="#4f46e5" 
                    strokeWidth={3}
                    dot={{ fill: '#4f46e5', r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
              
              <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t">
                <div>
                  <p className="text-sm text-gray-500">Average</p>
                  <p className="text-2xl font-semibold">
                    {(chartData.reduce((acc, d) => acc + d.tilt, 0) / chartData.length).toFixed(0)} deg
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Min</p>
                  <p className="text-2xl font-semibold">
                    {Math.min(...chartData.map(d => d.tilt)).toFixed(0)} deg
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Max</p>
                  <p className="text-2xl font-semibold">
                    {Math.max(...chartData.map(d => d.tilt)).toFixed(0)} deg
                  </p>
                </div>
              </div>
            </Card>
          </motion.div>
        </TabsContent>

      </Tabs>
    </div>
  );
}
