import { useState, useEffect, useRef } from 'react';
import { push, ref, onValue, set, update, remove } from 'firebase/database';
import { db } from '../../lib/firebase';

// ── Types ──────────────────────────────────────────

export interface Book {
  bookID: string;
  rfidTag: string;
  bookName: string;
  subject: string;
  status: 'in_bag' | 'not_in_bag';
}

export interface Subject {
  subjectID: string;
  subjectName: string;
  books: string[];
  color: string;
}

export interface TimetableEntry {
  entryID: string;
  day: string;
  subjectID: string;
  subjectName: string;
}

export interface Item {
  itemID: string;
  itemName: string;
  status: 'present' | 'missing';
  bagID: string;
  pocketID?: string;
}

export interface IoTData {
  bagID: string;
  battery: number;
  isOpen: boolean;
  isMoving: boolean;
  temperature: number;
  humidity: number;
  weight: number;       // load cell — kg
  tilt: {
    x: number;
    y: number;
    z: number;
    isTilted: boolean;
  };
  buzzerMuted: boolean;
  location: {
    lat: number;
    lng: number;
    address: string;
  };
  lastUpdate: Date;
}

export interface Alert {
  id: string;
  type: 'warning' | 'info' | 'danger';
  message: string;
  timestamp: Date;
  alertType: string;
}

export interface HistoricalData {
  timestamp: Date;
  motion: number;
  temperature: number;
  humidity: number;
  tiltAngle: number;
  weight: number;
}

export interface User {
  userID: string;
  name: string;
  email: string;
  role: 'parent' | 'student';
}

export interface ParentContact {
  id: string;
  name: string;
  phone: string;
  smsEnabled?: boolean;
}

export interface UnknownRfidTag {
  id: string;
  uid: string;
  timestamp?: number;
}

// ── Hook ──────────────────────────────────────────

// Raw sensor shape from Firebase — covers multiple hardware naming conventions
interface RawSensors {
  // battery
  battery?: number;
  battery_percent?: number;
  battery_voltage?: number;
  // environment
  temperature?: number;
  temp?: number;
  humidity?: number;
  // door / motion
  isOpen?: boolean;
  door?: boolean;
  isMoving?: boolean;
  motion?: boolean;
  // tilt — nested object OR single number (raw angle from some firmware)
  tilt?: { x?: number; y?: number; z?: number; isTilted?: boolean } | number;
  mpu?:  { x?: number; y?: number; z?: number; isTilted?: boolean };
  imu?:  { x?: number; y?: number; z?: number; isTilted?: boolean };
  // tilt — flat field variants
  tilt_x?: number; tilt_y?: number; tilt_z?: number;
  accel_x?: number; accel_y?: number; accel_z?: number;
  roll?: number; pitch?: number; yaw?: number;
  isTilted?: boolean; tilt_detected?: boolean;
  // weight / load cell
  weight?: number;
  weight_kg?: number;
  weight_g?: number;
  load?: number;
  load_kg?: number;
  // misc
  buzzerMuted?: boolean;
  location?: { lat?: number; lng?: number; address?: string; source?: string };
}

interface FirebaseBagData extends RawSensors {
  telemetry?: RawSensors;
  sensors?:   RawSensors;
  controls?:  { buzzerMuted?: boolean };
  settings?:  {
    parent_contacts?: ParentContact[] | Record<string, ParentContact>;
    sms_enabled?: boolean;
  };
  rfid_scans?: Record<string, Book['status']>;
  unknown_rfid?: UnknownRfidTag | Record<string, UnknownRfidTag>;
}

// Pick whichever sub-key the hardware actually uses, or fall back to root-level fields
function resolveSensors(fb: FirebaseBagData): RawSensors | null {
  if (fb.telemetry) return fb.telemetry;
  if (fb.sensors)   return fb.sensors;
  if (fb.battery != null || fb.battery_percent != null ||
      fb.temperature != null || fb.humidity != null) return fb as RawSensors;
  return null;
}

const normalizeParentContacts = (
  contacts: ParentContact[] | Record<string, ParentContact>
): ParentContact[] => {
  const values = Array.isArray(contacts) ? contacts : Object.values(contacts);
  return values.map(contact => ({
    ...contact,
    smsEnabled: contact.smsEnabled ?? true,
  }));
};

// Default seed data (used only when Firebase has no data)
const DEFAULT_BOOKS: Book[] = [
  { bookID: 'B001', rfidTag: 'RFID-A1B2', bookName: 'Mathematics Textbook',   subject: 'Mathematics',      status: 'in_bag'     },
  { bookID: 'B002', rfidTag: 'RFID-C3D4', bookName: 'Mathematics Workbook',   subject: 'Mathematics',      status: 'in_bag'     },
  { bookID: 'B003', rfidTag: 'RFID-E5F6', bookName: 'Science Textbook',       subject: 'Science',          status: 'in_bag'     },
  { bookID: 'B004', rfidTag: 'RFID-G7H8', bookName: 'Science Lab Manual',     subject: 'Science',          status: 'not_in_bag' },
  { bookID: 'B005', rfidTag: 'RFID-I9J0', bookName: 'English Textbook',       subject: 'English',          status: 'in_bag'     },
  { bookID: 'B006', rfidTag: 'RFID-K1L2', bookName: 'English Grammar Book',   subject: 'English',          status: 'in_bag'     },
  { bookID: 'B007', rfidTag: 'RFID-M3N4', bookName: 'Art Sketchbook',         subject: 'Art',              status: 'not_in_bag' },
  { bookID: 'B008', rfidTag: 'RFID-O5P6', bookName: 'History Textbook',       subject: 'History',          status: 'in_bag'     },
  { bookID: 'B009', rfidTag: 'RFID-Q7R8', bookName: 'Geography Atlas',        subject: 'Geography',        status: 'in_bag'     },
  { bookID: 'B010', rfidTag: 'RFID-S9T0', bookName: 'Computer Science Notes', subject: 'Computer Science', status: 'in_bag'     },
  { bookID: 'B011', rfidTag: 'RFID-U1V2', bookName: 'Music Theory Book',      subject: 'Music',            status: 'not_in_bag' },
  { bookID: 'B012', rfidTag: 'RFID-W3X4', bookName: 'Drama Script',           subject: 'Drama',            status: 'in_bag'     },
  { bookID: 'B013', rfidTag: 'RFID-WB01', bookName: 'Water Bottle',            subject: 'Daily Essentials', status: 'in_bag'     },
  { bookID: 'B014', rfidTag: 'RFID-LB01', bookName: 'Lunch Box',               subject: 'Daily Essentials', status: 'in_bag'     },
  { bookID: 'B015', rfidTag: 'RFID-LT01', bookName: 'Laptop',                  subject: 'Daily Essentials', status: 'not_in_bag' },
];

const isDefaultSeedBook = (book: Book) =>
  DEFAULT_BOOKS.some(defaultBook =>
    defaultBook.bookID === book.bookID &&
    defaultBook.rfidTag === book.rfidTag &&
    defaultBook.bookName === book.bookName
  );

const DEFAULT_SUBJECTS: Subject[] = [
  { subjectID: 'S001', subjectName: 'Mathematics',      books: ['B001', 'B002'], color: 'blue'   },
  { subjectID: 'S002', subjectName: 'Science',          books: ['B003', 'B004'], color: 'green'  },
  { subjectID: 'S003', subjectName: 'English',          books: ['B005', 'B006'], color: 'yellow' },
  { subjectID: 'S004', subjectName: 'Art',              books: ['B007'],         color: 'pink'   },
  { subjectID: 'S005', subjectName: 'History',          books: ['B008'],         color: 'orange' },
  { subjectID: 'S006', subjectName: 'Geography',        books: ['B009'],         color: 'teal'   },
  { subjectID: 'S007', subjectName: 'Computer Science', books: ['B010'],         color: 'cyan'   },
  { subjectID: 'S008', subjectName: 'Music',            books: ['B011'],         color: 'purple' },
  { subjectID: 'S009', subjectName: 'Drama',            books: ['B012'],         color: 'indigo' },
  { subjectID: 'S010', subjectName: 'Daily Essentials', books: ['B013', 'B014', 'B015'], color: 'teal' },
];

const DEFAULT_TIMETABLE: TimetableEntry[] = [
  { entryID: 'TT001', day: 'Monday',    subjectID: 'S001', subjectName: 'Mathematics'      },
  { entryID: 'TT002', day: 'Monday',    subjectID: 'S002', subjectName: 'Science'          },
  { entryID: 'TT003', day: 'Tuesday',   subjectID: 'S003', subjectName: 'English'          },
  { entryID: 'TT004', day: 'Tuesday',   subjectID: 'S004', subjectName: 'Art'              },
  { entryID: 'TT005', day: 'Wednesday', subjectID: 'S001', subjectName: 'Mathematics'      },
  { entryID: 'TT006', day: 'Wednesday', subjectID: 'S006', subjectName: 'Geography'        },
  { entryID: 'TT007', day: 'Thursday',  subjectID: 'S002', subjectName: 'Science'          },
  { entryID: 'TT008', day: 'Thursday',  subjectID: 'S009', subjectName: 'Drama'            },
  { entryID: 'TT009', day: 'Friday',    subjectID: 'S007', subjectName: 'Computer Science' },
  { entryID: 'TT010', day: 'Friday',    subjectID: 'S008', subjectName: 'Music'            },
];

const isDefaultSeedSubject = (subject: Subject) =>
  DEFAULT_SUBJECTS.some(defaultSubject =>
    defaultSubject.subjectID === subject.subjectID &&
    defaultSubject.subjectName === subject.subjectName
  );

const isDefaultSeedTimetableEntry = (entry: TimetableEntry) =>
  DEFAULT_TIMETABLE.some(defaultEntry =>
    defaultEntry.entryID === entry.entryID &&
    defaultEntry.day === entry.day &&
    defaultEntry.subjectID === entry.subjectID &&
    defaultEntry.subjectName === entry.subjectName
  );

const getSubjectBookIds = (subject?: Subject) =>
  Array.isArray(subject?.books) ? subject.books : [];

const normalizeUnknownRfidTags = (value: UnknownRfidTag | Record<string, UnknownRfidTag> | null | undefined): UnknownRfidTag[] => {
  if (!value || typeof value !== 'object') return [];

  if ('uid' in value && typeof value.uid === 'string') {
    return [{ id: 'latest', uid: value.uid, timestamp: value.timestamp }];
  }

  return Object.entries(value)
    .map(([id, tag]) => ({ id, ...tag }))
    .filter(tag => typeof tag.uid === 'string' && tag.uid.trim())
    .sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0));
};

export function useIoTData() {
  // SMS alerts enabled state (default true)
  const [smsEnabled, setSmsEnabled] = useState<boolean>(true);
  const [user, setUser] = useState<User>({
    userID: 'U001',
    name: 'Sarah Johnson',
    email: 'sarah.johnson@email.com',
    role: 'parent',
  });

  const [data, setData] = useState<IoTData>({
    bagID: 'BAG001',
    battery: 87,
    isOpen: false,
    isMoving: false,
    temperature: 29.4,
    humidity: 68,
    weight: 0,
    tilt: { x: 2, y: 5, z: 88, isTilted: false },
    buzzerMuted: false,
    location: { lat: 40.7128, lng: -74.006, address: 'Lincoln High School, Main Building' },
    lastUpdate: new Date(),
  });

  const [parentContacts, setParentContacts] = useState<ParentContact[]>([
    { id: 'PARENT001', name: 'Parent 1', phone: '', smsEnabled: true },
    { id: 'PARENT002', name: 'Parent 2', phone: '', smsEnabled: true },
  ]);

  const [books, setBooks]                   = useState<Book[]>([]);
  const [subjects, setSubjects]             = useState<Subject[]>([]);
  const [timetableEntries, setTimetableEntries] = useState<TimetableEntry[]>([]);
  const [unknownRfidTags, setUnknownRfidTags] = useState<UnknownRfidTag[]>([]);

  // 'connecting' → 'live' when telemetry received, 'no_telemetry' if connected but no sensor data
  const [firebaseStatus, setFirebaseStatus] = useState<'connecting' | 'live' | 'no_telemetry'>('connecting');

  // Tracks when bag first became imbalanced — used for the 2-min warning
  const imbalanceStartRef = useRef<number | null>(null);
  // Tracks if a 2-min warning has already been fired for this imbalance event
  const imbalanceWarnedRef = useRef(false);

  const items: Item[] = books.map(book => ({
    itemID: book.bookID,
    itemName: book.bookName,
    status: book.status === 'in_bag' ? 'present' : 'missing',
    bagID: data.bagID,
  }));

  const [alerts, setAlerts] = useState<Alert[]>([]);

  const [historicalData, setHistoricalData] = useState<HistoricalData[]>(() => {
    const result: HistoricalData[] = [];
    const now = Date.now();
    for (let i = 20; i >= 0; i--) {
      result.push({
        timestamp:   new Date(now - i * 30 * 60 * 1000),
        motion:      Math.random() > 0.5 ? Math.random() * 100 : 0,
        temperature: 27 + Math.random() * 5,
        humidity:    55 + Math.random() * 25,
        tiltAngle:   Math.random() * 18,
        weight:      0,
      });
    }
    return result;
  });

  // ── Firebase: books, subjects, timetable ──
  useEffect(() => {
    const bagID = data.bagID;

    const booksUnsub = onValue(ref(db, `bags/${bagID}/books`), (snap) => {
      const val = snap.val();
      if (val) {
        const firebaseBooks = (Object.values(val) as Book[]).filter(book => !isDefaultSeedBook(book));
        setBooks(firebaseBooks);
      } else {
        setBooks([]);
      }
    });

    const subjectsUnsub = onValue(ref(db, `bags/${bagID}/subjects`), (snap) => {
      const val = snap.val();
      if (val) {
        const firebaseSubjects = (Object.values(val) as Subject[]).filter(subject => !isDefaultSeedSubject(subject));
        setSubjects(firebaseSubjects);
      } else {
        setSubjects([]);
      }
    });

    const timetableUnsub = onValue(ref(db, `bags/${bagID}/timetable`), (snap) => {
      const val = snap.val();
      if (val) {
        setTimetableEntries(
          (Object.values(val) as TimetableEntry[]).filter(entry => !isDefaultSeedTimetableEntry(entry))
        );
      } else {
        setTimetableEntries([]);
      }
    });

    return () => {
      booksUnsub();
      subjectsUnsub();
      timetableUnsub();
    };
  }, [data.bagID]);

  // ── Book CRUD ──
  const addBook = (book: Omit<Book, 'bookID'>) => {
    const newBook: Book = { ...book, bookID: 'B' + Date.now() };
    set(ref(db, `bags/${data.bagID}/books/${newBook.bookID}`), newBook);

    const matchedUnknownTag = unknownRfidTags.find(tag => tag.uid === book.rfidTag);
    if (matchedUnknownTag) {
      const unknownPath = matchedUnknownTag.id === 'latest'
        ? `bags/${data.bagID}/unknown_rfid`
        : `bags/${data.bagID}/unknown_rfid/${matchedUnknownTag.id}`;
      remove(ref(db, unknownPath)).catch(err => console.error('Firebase unknown RFID remove error:', err));
    }

    const subject = subjects.find(s => s.subjectName === book.subject);
    if (subject) {
      const subjectBookIds = getSubjectBookIds(subject);
      update(ref(db, `bags/${data.bagID}/subjects/${subject.subjectID}`), {
        books: [...subjectBookIds, newBook.bookID],
      });
    }
  };

  const deleteBook = (bookID: string) => {
    remove(ref(db, `bags/${data.bagID}/books/${bookID}`));

    subjects
      .filter(s => getSubjectBookIds(s).includes(bookID))
      .forEach(s =>
        update(ref(db, `bags/${data.bagID}/subjects/${s.subjectID}`), {
          books: getSubjectBookIds(s).filter(id => id !== bookID),
        })
      );
  };

  const updateBookStatus = (bookID: string, status: 'in_bag' | 'not_in_bag') => {
    const book = books.find(b => b.bookID === bookID);
    if (!book) return;

    update(ref(db, `bags/${data.bagID}/books/${bookID}`), { status });
    update(ref(db, `bags/${data.bagID}/rfid_scans`), { [book.rfidTag]: status })
      .catch(err => console.error('Firebase update error:', err));
  };

  // ── Subject CRUD ──
  const addSubject = (subjectName: string, color: string) => {
    const newSubject: Subject = {
      subjectID: 'S' + Date.now(),
      subjectName,
      books: [],
      color,
    };
    set(ref(db, `bags/${data.bagID}/subjects/${newSubject.subjectID}`), newSubject);
    return newSubject;
  };

  const deleteSubject = (subjectID: string) => {
    remove(ref(db, `bags/${data.bagID}/subjects/${subjectID}`));
    timetableEntries
      .filter(t => t.subjectID === subjectID)
      .forEach(t => remove(ref(db, `bags/${data.bagID}/timetable/${t.entryID}`)));
  };

  const addBookToSubject = (subjectID: string, bookID: string) => {
    const subject = subjects.find(s => s.subjectID === subjectID);
    const subjectBookIds = getSubjectBookIds(subject);
    if (!subject || subjectBookIds.includes(bookID)) return;
    update(ref(db, `bags/${data.bagID}/subjects/${subjectID}`), {
      books: [...subjectBookIds, bookID],
    });
  };

  const removeBookFromSubject = (subjectID: string, bookID: string) => {
    const subject = subjects.find(s => s.subjectID === subjectID);
    if (!subject) return;
    update(ref(db, `bags/${data.bagID}/subjects/${subjectID}`), {
      books: getSubjectBookIds(subject).filter(id => id !== bookID),
    });
  };

  // ── Timetable CRUD ──
  const addTimetableEntry = (day: string, subjectID: string) => {
    const subject = subjects.find(s => s.subjectID === subjectID);
    if (!subject) return;

    const exists = timetableEntries.some(t => t.day === day && t.subjectID === subjectID);
    if (exists) return;

    const newEntry: TimetableEntry = {
      entryID: 'TT' + Date.now(),
      day,
      subjectID,
      subjectName: subject.subjectName,
    };
    set(ref(db, `bags/${data.bagID}/timetable/${newEntry.entryID}`), newEntry);
  };

  const deleteTimetableEntry = (entryID: string) => {
    remove(ref(db, `bags/${data.bagID}/timetable/${entryID}`));
  };

  // ── Check books in bag for a day ──
  const getBooksStatusForDay = (day: string) => {
    return timetableEntries
      .filter(t => t.day === day)
      .map(entry => {
        const subject = subjects.find(s => s.subjectID === entry.subjectID);
        const subjectBooks = subject
          ? getSubjectBookIds(subject).map(id => books.find(b => b.bookID === id)).filter(Boolean) as Book[]
          : [];
        const inBag    = subjectBooks.filter(b => b.status === 'in_bag');
        const notInBag = subjectBooks.filter(b => b.status === 'not_in_bag');
        return {
          ...entry,
          books: subjectBooks,
          inBag,
          notInBag,
          isReady: notInBag.length === 0 && subjectBooks.length > 0,
        };
      });
  };

  const updateParentContacts = (contacts: ParentContact[]) => {
    const normalizedContacts = normalizeParentContacts(contacts);
    setParentContacts(normalizedContacts);
    // Save as keyed object so Firebase doesn't convert to numeric-keyed array on read-back
    const asObject = Object.fromEntries(normalizedContacts.map(c => [c.id, c]));
    set(ref(db, `bags/${data.bagID}/settings/parent_contacts`), asObject)
      .catch(err => console.error('Firebase parent contacts update error:', err));
  };

  const setSmsAlertsEnabled = (enabled: boolean) => {
    setSmsEnabled(enabled);
    update(ref(db, `bags/${data.bagID}/settings`), {
      sms_enabled: enabled,
    }).catch(err => console.error('Firebase SMS setting update error:', err));
  };

  const setBuzzerMuted = (muted: boolean) => {
    setData(prev => ({ ...prev, buzzerMuted: muted }));
    update(ref(db, `bags/${data.bagID}/controls`), {
      buzzerMuted: muted,
      buzzerCommand: muted ? 'mute' : 'unmute',
      updatedAt: new Date().toISOString(),
    }).catch(err => console.error('Firebase buzzer update error:', err));
  };

  const triggerSOS = async () => {
    if (!smsEnabled) {
      throw new Error('SMS alerts are disabled. Enable them in Settings to send SMS.');
    }
    const validContacts = parentContacts.filter(c => c.phone.trim() && c.smsEnabled !== false);

    if (validContacts.length === 0) {
      throw new Error('No SMS-enabled parent contacts configured. Add numbers or enable a parent in Settings first.');
    }

    const createdAt = new Date().toISOString();
    const message   = `SOS Alert! ${user.name}'s smart school bag sent an emergency alert. Location: ${data.location.address}. Time: ${new Date().toLocaleTimeString()}`;

    const sosPayload = {
      bagID:       data.bagID,
      studentName: user.name,
      contacts:    validContacts.map(c => c.phone),
      contactNames: validContacts.map(c => c.name),
      message,
      location:    data.location,
      status:      'pending_sms',
      createdAt,
    };

    // Write SOS alert — Cloud Function picks this up and sends SMS automatically
    await push(ref(db, `bags/${data.bagID}/sos_alerts`), sosPayload);

    // Also write to commands node so ESP32/GSM hardware can send SMS as backup
    await update(ref(db, `bags/${data.bagID}/commands`), {
      sos:         true,
      sosMessage:  message,
      sosContacts: sosPayload.contacts,
      sosCreatedAt: createdAt,
    });

    setAlerts(a => [
      {
        id: Date.now().toString(),
        type: 'danger',
        message: `SOS activated — SMS sending to ${validContacts.length} contact(s): ${validContacts.map(c => c.name).join(', ')}`,
        timestamp: new Date(),
        alertType: 'sos',
      },
      ...a.slice(0, 9),
    ]);
  };

  // ── Firebase Realtime: telemetry ──
  useEffect(() => {
    const bagRef = ref(db, `bags/${data.bagID}`);

    const unsubscribe = onValue(bagRef, (snapshot) => {
      const fbData = snapshot.val() as FirebaseBagData | null;

      if (!fbData) {
        setFirebaseStatus('no_telemetry');
        return;
      }

      const telemetryResolved = resolveSensors(fbData);
      if (telemetryResolved) {
        const t = telemetryResolved;

        // ── Tilt normalisation (outside callbacks so both setData + setHistoricalData can use) ──
        const tiltRaw = t.tilt;
        const tiltObj = (typeof tiltRaw === 'object' && tiltRaw !== null) ? tiltRaw : null;
        const tiltNum = typeof tiltRaw === 'number' ? tiltRaw : null;
        const tiltX   = tiltObj?.x ?? t.mpu?.x ?? t.imu?.x ?? t.tilt_x ?? t.accel_x ?? t.roll  ?? 0;
        const tiltY   = tiltObj?.y ?? t.mpu?.y ?? t.imu?.y ?? t.tilt_y ?? t.accel_y ?? t.pitch ?? 0;
        const tiltZ   = tiltObj?.z ?? t.mpu?.z ?? t.imu?.z ?? t.tilt_z ?? t.accel_z ?? tiltNum ?? 0;
        const isTilted = tiltObj?.isTilted ?? t.mpu?.isTilted ?? t.imu?.isTilted
                         ?? t.isTilted ?? t.tilt_detected
                         ?? (tiltNum !== null ? tiltNum < 150 : false);

        // ── Weight normalisation ──
        const weightKg = t.weight ?? t.weight_kg
                         ?? (t.weight_g != null ? t.weight_g / 1000 : undefined)
                         ?? t.load ?? t.load_kg;

        setFirebaseStatus('live');

        setData(prev => {
          const wasOpen       = prev.isOpen;
          const wasBatteryLow = prev.battery < 20;
          const loc           = t.location;

          const updated = {
            ...prev,
            battery:     t.battery     ?? t.battery_percent ?? prev.battery,
            isOpen:      t.isOpen      ?? t.door            ?? prev.isOpen,
            isMoving:    t.isMoving    ?? t.motion          ?? prev.isMoving,
            temperature: t.temperature ?? t.temp            ?? prev.temperature,
            humidity:    t.humidity                         ?? prev.humidity,
            weight:      weightKg                           ?? prev.weight,
            tilt:        { x: tiltX, y: tiltY, z: tiltZ, isTilted },
            buzzerMuted: fbData.controls?.buzzerMuted ?? t.buzzerMuted ?? prev.buzzerMuted,
            location: loc
              ? {
                  lat:     loc.lat ?? prev.location.lat,
                  lng:     loc.lng ?? prev.location.lng,
                  address: loc.address
                    ?? (loc.source && loc.source !== 'none' ? loc.source : prev.location.address),
                }
              : prev.location,
            lastUpdate: new Date(),
          };

          if (updated.isOpen && !wasOpen)
            setAlerts(a => [{ id: Date.now().toString(), type: 'warning', message: 'School bag opened', timestamp: new Date(), alertType: 'bag_opened' }, ...a.slice(0, 9)]);
          if (updated.battery < 20 && !wasBatteryLow)
            setAlerts(a => [{ id: Date.now().toString(), type: 'danger', message: 'Low battery warning!', timestamp: new Date(), alertType: 'low_battery' }, ...a.slice(0, 9)]);

          return updated;
        });

        // ── 2-minute imbalance warning ──────────────────────────────────────────
        // Auto-detect which axis carries the meaningful tilt signal
        const balanceVal = Math.abs(tiltX) > 1 ? tiltX : Math.abs(tiltY) > 1 ? tiltY : tiltZ;
        const BALANCE_THRESHOLD = 10;
        const isImbalanced = Math.abs(balanceVal) > BALANCE_THRESHOLD;

        if (isImbalanced) {
          if (imbalanceStartRef.current === null) {
            imbalanceStartRef.current = Date.now();
            imbalanceWarnedRef.current = false;
          } else if (!imbalanceWarnedRef.current &&
                     Date.now() - imbalanceStartRef.current >= 2 * 60 * 1000) {
            const side = balanceVal > 0 ? 'left' : 'right';
            setAlerts(a => [{
              id: Date.now().toString(),
              type: 'warning',
              message: `Bag unbalanced for 2+ minutes — ${side} side is heavier. Adjust the strap.`,
              timestamp: new Date(),
              alertType: 'imbalance',
            }, ...a.slice(0, 9)]);
            imbalanceWarnedRef.current = true;
          }
        } else {
          imbalanceStartRef.current = null;
          imbalanceWarnedRef.current = false;
        }

        setHistoricalData(prev => ([...prev.slice(-19), {
          timestamp:   new Date(),
          motion:      (t.isMoving ?? t.motion) ? 80 : 0,
          temperature: t.temperature ?? t.temp  ?? 0,
          humidity:    t.humidity               ?? 0,
          tiltAngle:   Math.max(Math.abs(tiltX), Math.abs(tiltY), Math.abs(tiltZ)),
          weight:      weightKg                 ?? 0,
        }]));
      }

      if (fbData.controls?.buzzerMuted !== undefined) {
        const muted = fbData.controls.buzzerMuted as boolean;
        setData(prev => ({ ...prev, buzzerMuted: muted }));
      }

      if (fbData.settings?.parent_contacts) {
        setParentContacts(normalizeParentContacts(fbData.settings.parent_contacts));
      }

      if (typeof fbData.settings?.sms_enabled === 'boolean') {
        setSmsEnabled(fbData.settings.sms_enabled);
      }

      if (!telemetryResolved) {
        setFirebaseStatus(prev => prev === 'live' ? 'live' : 'no_telemetry');
      }

      if (fbData.rfid_scans) {
        const rfidScans = fbData.rfid_scans;
        setBooks(prev =>
          prev.map(b => {
            const status = rfidScans[b.rfidTag];
            return status ? { ...b, status: status as 'in_bag' | 'not_in_bag' } : b;
          })
        );
      }

      setUnknownRfidTags(normalizeUnknownRfidTags(fbData.unknown_rfid));
    });

    return () => unsubscribe();
  }, [data.bagID]);

  return {
    user,
    updateUser: (newUser: Partial<User>) => setUser(prev => ({ ...prev, ...newUser })),
    smsEnabled,
    setSmsEnabled: setSmsAlertsEnabled,
    data,
    alerts,
    historicalData,
    items,
    books,
    unknownRfidTags,
    subjects,
    timetableEntries,
    addBook,
    deleteBook,
    updateBookStatus,
    addSubject,
    deleteSubject,
    addBookToSubject,
    removeBookFromSubject,
    addTimetableEntry,
    deleteTimetableEntry,
    getBooksStatusForDay,
    parentContacts,
    updateParentContacts,
    setBuzzerMuted,
    triggerSOS,
    firebaseStatus,
    timetables: timetableEntries.map(t => {
      const subject = subjects.find(s => s.subjectID === t.subjectID);
      return {
        timetableID:   t.entryID,
        day:           t.day,
        subject:       t.subjectName,
        requiredItems: getSubjectBookIds(subject)
          .map(id => books.find(b => b.bookID === id)?.bookName || '')
          .filter(Boolean),
      };
    }),
  };
}
