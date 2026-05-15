import { AlertOctagon, Camera, Cloud, MessageSquare, Moon, Phone, Smartphone, Sun, Volume2, VolumeX, Wifi } from 'lucide-react';
import { useIoTData } from '../hooks/useIoTData';
import { useAuth } from '../contexts/AuthContext';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Switch } from './ui/switch';
import { Badge } from './ui/badge';
import { motion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Toaster } from './ui/sonner';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { useTheme } from '../contexts/ThemeContext';

// Resize image to max 256px and convert to base64 JPEG — no Firebase Storage needed
function resizeToBase64(file: File, maxPx = 256): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
        const w = Math.round(img.width  * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width  = w;
        canvas.height = h;
        canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      img.onerror = reject;
      img.src = ev.target!.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function Settings() {
  const { theme, setTheme } = useTheme();
  const {
    user: iotUser,
    data,
    parentContacts,
    updateParentContacts,
    setBuzzerMuted,
    triggerSOS,
    smsEnabled,
    setSmsEnabled,
  } = useIoTData();
  // --- SMS Alerts Toggle ---
  const handleSmsToggle = (checked: boolean) => {
    setSmsEnabled(checked);
    toast.success(checked ? 'SMS alerts enabled' : 'SMS alerts disabled', {
      description: checked ? 'SMS alerts will be sent for emergencies.' : 'SMS alerts will NOT be sent.',
      duration: 4000,
    });
  };

  const { user, displayName, photoURL, phone, updateUserProfile } = useAuth();

  const [sosActive,     setSosActive]     = useState(false);
  const [cloudSync,     setCloudSync]     = useState(true);
  const [notifications, setNotifications] = useState(true);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [editName,      setEditName]      = useState('');
  const [editPhone,     setEditPhone]     = useState('');
  const [previewURL,    setPreviewURL]    = useState<string | null>(null);
  const [pendingFile,   setPendingFile]   = useState<File | null>(null);
  const [saving,        setSaving]        = useState(false);
  const [editContacts,  setEditContacts]  = useState(parentContacts);
  const [contactsDirty, setContactsDirty] = useState(false);

  // Sync input fields when Firebase loads saved contacts (only if user isn't mid-edit)
  useEffect(() => {
    if (!contactsDirty) setEditContacts(parentContacts);
  }, [parentContacts]); // eslint-disable-line react-hooks/exhaustive-deps
  const fileInputRef = useRef<HTMLInputElement>(null);

  const shownName  = displayName || iotUser.name || 'User';
  const shownEmail = user?.email  || iotUser.email || '';
  const shownPhoto = previewURL ?? photoURL;

  const initials = shownName
    .split(' ')
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const handleOpenDialog = () => {
    setEditName(displayName);
    setEditPhone(phone);
    setPendingFile(null);
    setPreviewURL(photoURL);
    setIsProfileOpen(true);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPendingFile(file);
    // Show instant preview via blob URL while resize runs
    setPreviewURL(URL.createObjectURL(file));
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      let base64Photo: string | undefined;

      if (pendingFile) {
        base64Photo = await resizeToBase64(pendingFile);
      }

      await updateUserProfile({
        displayName: editName.trim()  || undefined,
        photoURL:    base64Photo,
        phone:       editPhone.trim() || undefined,
      });

      // Keep showing the new photo in the card after dialog closes
      if (base64Photo) setPreviewURL(base64Photo);

      setIsProfileOpen(false);
      setPendingFile(null);
      toast.success('Profile updated successfully');
    } catch (err) {
      console.error('Profile save failed:', err);
      toast.error('Failed to save profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveContacts = () => {
    updateParentContacts(editContacts);
    setContactsDirty(false);
    toast.success('Parent phone numbers saved');
  };

  const handleContactSmsToggle = (index: number, enabled: boolean) => {
    const next = [...editContacts];
    next[index] = { ...next[index], smsEnabled: enabled };
    setEditContacts(next);
    setContactsDirty(true);
    updateParentContacts(next);
    toast.success(`${next[index].name} SMS ${enabled ? 'enabled' : 'disabled'}`);
  };

  const handleSOS = async () => {
    setSosActive(true);
    try {
      await triggerSOS();
      toast.error('SOS Alert Activated!', {
        description: 'SMS request sent for registered parent contacts',
        duration: 5000,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Check Firebase connection and try again';
      toast.error('SOS request failed', { description: msg, duration: 6000 });
    }
    setTimeout(() => setSosActive(false), 5000);
  };

  const handleCloudSync = () => {
    toast.success('Cloud sync initiated', { description: 'Syncing bag data with cloud service...' });
  };

  const handleBuzzerMute = (muted: boolean) => {
    setBuzzerMuted(muted);
    toast.success(muted ? 'Buzzer muted' : 'Buzzer enabled', {
      description: muted ? 'Mute command sent to the bag' : 'Buzzer can sound alerts again',
      duration: 5000,
    });
  };

  return (
    <>
      <Toaster />
      <div className="space-y-6">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-3xl font-bold mb-2">Settings & Controls</h1>
          <p className="text-gray-600">Manage smart bag preferences, SOS contacts, and device controls</p>
        </motion.div>

        {/* ── Profile Card ── */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="p-6">
            <div className="flex items-center gap-4">
              <div className="relative shrink-0">
                {shownPhoto ? (
                  <img src={shownPhoto} alt={shownName} className="size-16 rounded-full object-cover border-2 border-blue-100" />
                ) : (
                  <div className="size-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                    <span className="text-white text-xl font-bold">{initials}</span>
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-xl font-semibold truncate">{shownName}</h3>
                <p className="text-gray-500 text-sm truncate">{shownEmail}</p>
                <Badge className="mt-1 capitalize">{iotUser.role}</Badge>
              </div>
              <Button variant="outline" onClick={handleOpenDialog}>Edit Profile</Button>
            </div>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <Card className="p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-lg font-semibold mb-1">Theme Mode</h3>
                <p className="text-gray-600 text-sm">Choose the app display mode.</p>
              </div>
              <div className="grid grid-cols-2 gap-2 rounded-lg bg-gray-100 p-1 dark:bg-gray-800">
                <button
                  onClick={() => setTheme('light')}
                  className={`flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                    theme === 'light'
                      ? 'bg-white text-blue-700 shadow-sm dark:bg-gray-950 dark:text-blue-300'
                      : 'text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white'
                  }`}
                >
                  <Sun className="size-4" />
                  Light Mode
                </button>
                <button
                  onClick={() => setTheme('dark')}
                  className={`flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                    theme === 'dark'
                      ? 'bg-white text-blue-700 shadow-sm dark:bg-gray-950 dark:text-blue-300'
                      : 'text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white'
                  }`}
                >
                  <Moon className="size-4" />
                  Dark Mode
                </button>
              </div>
            </div>
          </Card>
        </motion.div>

        {/* ── Edit Profile Dialog ── */}
        <Dialog open={isProfileOpen} onOpenChange={setIsProfileOpen}>
          <DialogContent className="sm:max-w-[440px]">
            <DialogHeader>
              <DialogTitle>Edit Profile</DialogTitle>
              <DialogDescription>Update your name, photo, and contact details.</DialogDescription>
            </DialogHeader>

            <div className="py-4 space-y-5">
              {/* Photo picker */}
              <div className="flex flex-col items-center gap-2">
                <div
                  className="relative cursor-pointer group"
                  onClick={() => fileInputRef.current?.click()}
                >
                  {previewURL ? (
                    <img src={previewURL} alt="Profile" className="size-24 rounded-full object-cover border-2 border-gray-200" />
                  ) : (
                    <div className="size-24 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                      <span className="text-white text-2xl font-bold">{initials}</span>
                    </div>
                  )}
                  <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <Camera className="size-6 text-white" />
                  </div>
                </div>
                <p className="text-xs text-gray-400">Click photo to change</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-name">Full Name</Label>
                <Input id="edit-name" value={editName} onChange={e => setEditName(e.target.value)} placeholder="Your full name" />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-email">Email</Label>
                <Input id="edit-email" value={shownEmail} readOnly className="bg-gray-50 text-gray-500 cursor-not-allowed" />
                <p className="text-xs text-gray-400">Email cannot be changed here</p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-phone">Phone Number</Label>
                <Input id="edit-phone" value={editPhone} onChange={e => setEditPhone(e.target.value)} placeholder="+94711234567" type="tel" />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsProfileOpen(false)}>Cancel</Button>
              <Button onClick={handleSaveProfile} disabled={saving}>
                {saving ? (
                  <span className="flex items-center gap-2">
                    <span className="size-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    Saving…
                  </span>
                ) : 'Save Changes'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ── SOS ── */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card className={`p-8 border-2 transition-all ${
            sosActive ? 'bg-red-50 border-red-500 shadow-lg shadow-red-200' : 'border-red-300 bg-gradient-to-r from-red-50 to-orange-50'
          }`}>
            <div className="text-center">
              <motion.div className="inline-block mb-4"
                animate={sosActive ? { scale: [1, 1.1, 1] } : {}}
                transition={{ duration: 0.5, repeat: sosActive ? Infinity : 0 }}
              >
                <div className={`p-6 rounded-full ${sosActive ? 'bg-red-600' : 'bg-red-500'}`}>
                  <AlertOctagon className="size-12 text-white" />
                </div>
              </motion.div>
              <h2 className="text-2xl font-bold text-red-900 mb-2">{sosActive ? 'SOS ACTIVATED!' : 'Emergency SOS'}</h2>
              <p className="text-red-700 mb-6">
                {sosActive ? 'Emergency SMS request sent to parent contacts' : 'Press the button below in case of emergency'}
              </p>
              <Button
                size="lg"
                className={`text-lg px-8 py-6 ${sosActive ? 'bg-red-700 hover:bg-red-800' : 'bg-red-600 hover:bg-red-700'}`}
                onClick={handleSOS}
                disabled={sosActive}
              >
                {sosActive ? 'Alert Sent' : 'Press SOS Button'}
              </Button>
              {sosActive && (
                <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-sm text-red-600 mt-4">
                  Location shared: {data.location.address}
                </motion.p>
              )}
            </div>
          </Card>
        </motion.div>

        {/* ── SMS Alerts Toggle ── */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.22 }}>
          <Card className="p-6 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold mb-1 flex items-center gap-2">
                <MessageSquare className="size-5 text-blue-600" /> SMS Alerts
              </h3>
              <p className="text-gray-600 text-sm">Enable or disable SMS alerts for emergencies (SOS, missing items, etc).</p>
            </div>
            <Switch checked={smsEnabled} onCheckedChange={handleSmsToggle} />
          </Card>
        </motion.div>

        {/* ── Parent SMS Numbers ── */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
          <Card className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <Phone className="size-6 text-red-600" />
              <h3 className="text-lg font-semibold">Parent SMS Numbers</h3>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {editContacts.map((contact, index) => (
                <div key={contact.id} className="space-y-3 rounded-lg border border-gray-200 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <Label htmlFor={`contact-${contact.id}`}>{contact.name}</Label>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-medium ${contact.smsEnabled !== false ? 'text-green-700' : 'text-gray-500'}`}>
                        SMS {contact.smsEnabled !== false ? 'On' : 'Off'}
                      </span>
                      <Switch
                        checked={contact.smsEnabled !== false}
                        onCheckedChange={(checked) => handleContactSmsToggle(index, checked)}
                      />
                    </div>
                  </div>
                  <Input
                    id={`contact-${contact.id}`}
                    value={contact.phone}
                    placeholder="+94710000000"
                    onChange={(e) => {
                      const next = [...editContacts];
                      next[index] = { ...contact, phone: e.target.value };
                      setEditContacts(next);
                      setContactsDirty(true);
                    }}
                  />
                </div>
              ))}
            </div>
            <Button className="mt-4 gap-2" onClick={handleSaveContacts}>
              <MessageSquare className="size-4" />
              Save SMS Numbers
            </Button>
          </Card>
        </motion.div>

        {/* ── Cloud + Mobile ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <Card className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <Cloud className="size-6 text-blue-600" />
                <h3 className="text-lg font-semibold">Cloud Service</h3>
              </div>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Auto Sync</p>
                    <p className="text-sm text-gray-500">Sync data automatically</p>
                  </div>
                  <Switch checked={cloudSync} onCheckedChange={setCloudSync} />
                </div>
                <div className="pt-4 border-t">
                  <Button variant="outline" className="w-full gap-2" onClick={handleCloudSync}>
                    <Cloud className="size-4" />
                    Sync Now
                  </Button>
                </div>
                <div className="text-sm text-gray-500">Last synced: {data.lastUpdate.toLocaleTimeString()}</div>
              </div>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
            <Card className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <Smartphone className="size-6 text-purple-600" />
                <h3 className="text-lg font-semibold">Mobile App</h3>
              </div>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Push Notifications</p>
                    <p className="text-sm text-gray-500">Receive alerts on phone</p>
                  </div>
                  <Switch checked={notifications} onCheckedChange={setNotifications} />
                </div>
                <div className="pt-4 border-t space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">App Version</span>
                    <span className="font-medium">2.1.0</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Device ID</span>
                    <span className="font-mono text-xs">{data.bagID}</span>
                  </div>
                </div>
              </div>
            </Card>
          </motion.div>
        </div>

        {/* ── Buzzer ── */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}>
          <Card className="p-6">
            <div className="flex items-center gap-3 mb-4">
              {data.buzzerMuted ? <VolumeX className="size-6 text-gray-600" /> : <Volume2 className="size-6 text-green-600" />}
              <h3 className="text-lg font-semibold">Buzzer Control</h3>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Mute Buzzer</p>
                <p className="text-sm text-gray-500">Turn off the bag buzzer from the app</p>
              </div>
              <Switch checked={data.buzzerMuted} onCheckedChange={handleBuzzerMute} />
            </div>
          </Card>
        </motion.div>

        {/* ── IoT Status ── */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
          <Card className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <Wifi className="size-6 text-green-600" />
              <h3 className="text-lg font-semibold">IoT Device Status</h3>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Connection', value: 'Online',   dot: true },
                { label: 'GPS',        value: 'Active'              },
                { label: 'RFID',       value: 'Scanning'            },
                { label: 'Buzzer',     value: data.buzzerMuted ? 'Muted' : 'Enabled' },
              ].map(item => (
                <div key={item.label} className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-500 mb-1">{item.label}</p>
                  <div className="flex items-center gap-2">
                    {item.dot && <div className="size-2 bg-green-500 rounded-full animate-pulse" />}
                    <p className="font-semibold">{item.value}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </motion.div>
      </div>
    </>
  );
}
