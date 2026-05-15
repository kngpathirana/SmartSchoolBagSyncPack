import { Calendar, CheckCircle, XCircle, AlertTriangle, Clock, Plus, Trash2, Package, Tag, Edit3 } from 'lucide-react';
import { useIoTData } from '../hooks/useIoTData';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { motion, AnimatePresence } from 'motion/react';
import { useState } from 'react';

type TabType = 'timetable' | 'subjects' | 'books';

export function Timetable() {
  const {
    books, subjects, timetableEntries, unknownRfidTags,
    addBook, deleteBook, updateBookStatus,
    addSubject, deleteSubject,
    addBookToSubject, removeBookFromSubject,
    addTimetableEntry, deleteTimetableEntry,
    getBooksStatusForDay,
  } = useIoTData();

  const [activeTab, setActiveTab]       = useState<TabType>('timetable');
  const [selectedDay, setSelectedDay]   = useState('Monday');

  // Book form
  const [showBookForm, setShowBookForm] = useState(false);
  const [newBookName, setNewBookName]   = useState('');
  const [newRfidTag, setNewRfidTag]     = useState('');
  const [newBookSubject, setNewBookSubject] = useState('');
  const [newCustomBookSubject, setNewCustomBookSubject] = useState('');

  // Subject form
  const [showSubjectForm, setShowSubjectForm] = useState(false);
  const [newSubjectName, setNewSubjectName]   = useState('');
  const [newSubjectColor, setNewSubjectColor] = useState('blue');

  // Timetable form
  const [selectedSubjectID, setSelectedSubjectID] = useState('');
  const [newSubjectNameTT, setNewSubjectNameTT] = useState('');

  const weekDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  const getDayOfWeek = () => {
    const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    return days[new Date().getDay()];
  };
  const currentDay = getDayOfWeek();

  const colorMap: Record<string, string> = {
    blue:   'bg-blue-100 text-blue-800 border-blue-300',
    green:  'bg-green-100 text-green-800 border-green-300',
    yellow: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    pink:   'bg-pink-100 text-pink-800 border-pink-300',
    orange: 'bg-orange-100 text-orange-800 border-orange-300',
    teal:   'bg-teal-100 text-teal-800 border-teal-300',
    cyan:   'bg-cyan-100 text-cyan-800 border-cyan-300',
    purple: 'bg-purple-100 text-purple-800 border-purple-300',
    indigo: 'bg-indigo-100 text-indigo-800 border-indigo-300',
    red:    'bg-red-100 text-red-800 border-red-300',
  };

  const getSubjectColor = (subjectID: string) => {
    const subject = subjects.find(s => s.subjectID === subjectID);
    return subject ? colorMap[subject.color] || colorMap.blue : colorMap.blue;
  };

  const getSubjectBookIds = (subject?: { books?: string[] }) =>
    Array.isArray(subject?.books) ? subject.books : [];

  const handleAddBook = () => {
    const finalSubjectName = newBookSubject === 'other' ? newCustomBookSubject.trim() : newBookSubject.trim();
    if (!newBookName.trim() || !newRfidTag.trim() || !finalSubjectName) return;

    if (newBookSubject === 'other') {
      const existing = subjects.find(s => s.subjectName.toLowerCase() === finalSubjectName.toLowerCase());
      if (!existing) {
        addSubject(finalSubjectName, 'blue');
      }
    }

    addBook({
      rfidTag:  newRfidTag.trim(),
      bookName: newBookName.trim(),
      subject:  finalSubjectName,
      status:   'not_in_bag',
    });
    setNewBookName('');
    setNewRfidTag('');
    setNewBookSubject('');
    setNewCustomBookSubject('');
    setShowBookForm(false);
  };

  const openItemForm = () => {
    if (!showBookForm && !newRfidTag.trim() && unknownRfidTags[0]?.uid) {
      setNewRfidTag(unknownRfidTags[0].uid);
    }
    setShowBookForm(!showBookForm);
  };

  const useUnknownRfidTag = (uid: string) => {
    setNewRfidTag(uid);
    setShowBookForm(true);
  };

  const handleAddSubject = () => {
    if (!newSubjectName.trim()) return;
    addSubject(newSubjectName.trim(), newSubjectColor);
    setNewSubjectName('');
    setNewSubjectColor('blue');
    setShowSubjectForm(false);
  };

  const handleAddToTimetable = () => {
    if (selectedSubjectID === 'other') {
      if (!newSubjectNameTT.trim()) return;
      const existing = subjects.find(s => s.subjectName.toLowerCase() === newSubjectNameTT.trim().toLowerCase());
      let finalSubjectID = existing?.subjectID;
      
      if (!existing) {
        const newSub = addSubject(newSubjectNameTT.trim(), 'blue');
        finalSubjectID = newSub.subjectID;
      }
      
      if (finalSubjectID) {
        addTimetableEntry(selectedDay, finalSubjectID);
      }
      setSelectedSubjectID('');
      setNewSubjectNameTT('');
    } else {
      if (!selectedSubjectID) return;
      addTimetableEntry(selectedDay, selectedSubjectID);
      setSelectedSubjectID('');
    }
  };

  const todayStatus = getBooksStatusForDay(currentDay);

  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-3xl font-bold mb-2">Timetable & Items</h1>
        <p className="text-gray-600">Manage items, subjects and weekly timetable</p>
      </motion.div>

      {/* ── Today Banner ── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg p-6 text-white"
      >
        <div className="flex items-center gap-3 mb-2">
          <Calendar className="size-8" />
          <div>
            <h2 className="text-2xl font-bold">{currentDay}</h2>
            <p className="text-blue-100">
              {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            </p>
          </div>
        </div>

        {/* Today's item status */}
        <div className="mt-3 flex flex-wrap gap-2">
          {todayStatus.length === 0 ? (
            <p className="text-blue-100 text-sm">No subjects today</p>
          ) : (
            todayStatus.map(entry => (
              <div
                key={entry.entryID}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${
                  entry.isReady ? 'bg-green-500' : 'bg-orange-500'
                }`}
              >
                {entry.isReady
                  ? <CheckCircle className="size-4" />
                  : <AlertTriangle className="size-4" />
                }
                {entry.subjectName}
                {!entry.isReady && ` (${entry.notInBag.length} missing)`}
              </div>
            ))
          )}
        </div>
      </motion.div>

      {/* ── Tabs ── */}
      <div className="flex gap-2 border-b border-gray-200">
        {[
          { key: 'timetable', label: 'Timetable' },
          { key: 'subjects',  label: 'Subjects' },
          { key: 'books',     label: 'Items' },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as TabType)}
            className={`px-5 py-3 font-medium text-sm border-b-2 transition-colors ${
              activeTab === tab.key
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════
          TAB 1 — TIMETABLE
      ══════════════════════════════════════ */}
      <AnimatePresence mode="wait">
        {activeTab === 'timetable' && (
          <motion.div
            key="timetable"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            {/* Add to Timetable */}
            <Card className="p-5 bg-blue-50 border-blue-200">
              <h3 className="font-semibold text-blue-900 mb-4">➕ Add Subject to Timetable</h3>
              <div className="flex flex-wrap gap-2 mb-3">
                {weekDays.map(day => (
                  <button
                    key={day}
                    onClick={() => setSelectedDay(day)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                      selectedDay === day
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-blue-50'
                    }`}
                  >
                    {day === currentDay ? `${day} (Today)` : day}
                  </button>
                ))}
              </div>

              <div className="flex gap-2">
                {selectedSubjectID === 'other' ? (
                  <div className="flex-1 flex gap-2">
                    <input
                      type="text"
                      placeholder="Type custom subject..."
                      value={newSubjectNameTT}
                      onChange={e => setNewSubjectNameTT(e.target.value)}
                      className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      autoFocus
                    />
                    <button
                      onClick={() => { setSelectedSubjectID(''); setNewSubjectNameTT(''); }}
                      className="text-gray-500 hover:text-gray-700 px-2"
                    >
                      <XCircle className="size-5" />
                    </button>
                  </div>
                ) : (
                  <select
                    value={selectedSubjectID}
                    onChange={e => setSelectedSubjectID(e.target.value)}
                    className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="">-- Select Subject --</option>
                    {subjects.map(s => (
                      <option key={s.subjectID} value={s.subjectID}>{s.subjectName}</option>
                    ))}
                    <option value="other">+ Type Other</option>
                  </select>
                )}
                <button
                  onClick={handleAddToTimetable}
                  disabled={selectedSubjectID === 'other' ? !newSubjectNameTT.trim() : !selectedSubjectID}
                  className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white px-5 py-2 rounded-lg font-medium transition-colors"
                >
                  Add
                </button>
              </div>
            </Card>

            {/* Weekly Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {weekDays.map(day => {
                const dayEntries   = timetableEntries.filter(t => t.day === day);
                const dayStatus    = getBooksStatusForDay(day);
                const isToday      = day === currentDay;

                return (
                  <Card key={day} className={`p-4 ${isToday ? 'border-2 border-blue-400 bg-blue-50' : ''}`}>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className={`font-bold text-lg ${isToday ? 'text-blue-900' : 'text-gray-800'}`}>
                        {day}
                      </h3>
                      {isToday && <Badge className="bg-blue-600 text-xs">Today</Badge>}
                    </div>

                    <div className="space-y-2">
                      {dayEntries.length === 0 ? (
                        <p className="text-sm text-gray-400 italic">No subjects</p>
                      ) : (
                        dayEntries.map(entry => {
                          const status = dayStatus.find(s => s.entryID === entry.entryID);
                          return (
                            <div
                              key={entry.entryID}
                              className={`flex items-center justify-between px-3 py-2 rounded-lg border text-sm font-medium ${getSubjectColor(entry.subjectID)}`}
                            >
                              <span>{entry.subjectName}</span>
                              <div className="flex items-center gap-1">
                                {status && (
                                  status.isReady
                                    ? <CheckCircle className="size-4 text-green-600" />
                                    : <AlertTriangle className="size-4 text-orange-500" />
                                )}
                                <button
                                  onClick={() => deleteTimetableEntry(entry.entryID)}
                                  className="text-red-400 hover:text-red-600 ml-1"
                                >
                                  <Trash2 className="size-3.5" />
                                </button>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>

                    {dayEntries.length > 0 && (
                      <p className="text-xs text-gray-400 mt-2">
                        {dayEntries.length} subject{dayEntries.length > 1 ? 's' : ''}
                      </p>
                    )}
                  </Card>
                );
              })}
            </div>

            {/* Today Detail */}
            {todayStatus.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-xl font-semibold flex items-center gap-2">
                  <Clock className="size-5 text-blue-600" />
                  Today's Item Check
                </h2>
                {todayStatus.map((entry, i) => (
                  <motion.div
                    key={entry.entryID}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.1 }}
                  >
                    <Card className={`p-5 border-l-4 ${entry.isReady ? 'border-l-green-500 bg-green-50' : 'border-l-orange-500 bg-orange-50'}`}>
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-lg font-semibold">{entry.subjectName}</h3>
                        {entry.isReady ? (
                          <Badge className="bg-green-600 text-white">✅ All Items Ready</Badge>
                        ) : (
                          <Badge className="bg-orange-600 text-white">⚠️ {entry.notInBag.length} Item(s) Missing</Badge>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {entry.books.map(book => (
                          <div
                            key={book.bookID}
                            className={`flex items-center gap-3 p-3 rounded-lg border bg-white ${
                              book.status === 'in_bag' ? 'border-green-200' : 'border-orange-300'
                            }`}
                          >
                            {book.status === 'in_bag'
                              ? <CheckCircle className="size-5 text-green-600 flex-shrink-0" />
                              : <XCircle className="size-5 text-orange-500 flex-shrink-0" />
                            }
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{book.bookName}</p>
                              <p className="text-xs text-gray-400 font-mono">{book.rfidTag}</p>
                            </div>
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                              book.status === 'in_bag'
                                ? 'bg-green-100 text-green-700'
                                : 'bg-red-100 text-red-700'
                            }`}>
                              {book.status === 'in_bag' ? 'In Bag' : 'Missing'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </Card>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {/* ══════════════════════════════════════
            TAB 2 — SUBJECTS
        ══════════════════════════════════════ */}
        {activeTab === 'subjects' && (
          <motion.div
            key="subjects"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4"
          >
            {/* Add Subject */}
            <Card className="p-5 bg-purple-50 border-purple-200">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-purple-900">➕ Add New Subject</h3>
                <button
                  onClick={() => setShowSubjectForm(!showSubjectForm)}
                  className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
                >
                  {showSubjectForm ? 'Cancel' : 'Add Subject'}
                </button>
              </div>

              {showSubjectForm && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
                  <input
                    type="text"
                    value={newSubjectName}
                    onChange={e => setNewSubjectName(e.target.value)}
                    placeholder="Subject name (e.g. Mathematics)"
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                  <div>
                    <p className="text-sm text-gray-600 mb-2">Pick a color:</p>
                    <div className="flex gap-2 flex-wrap">
                      {Object.keys(colorMap).map(color => (
                        <button
                          key={color}
                          onClick={() => setNewSubjectColor(color)}
                          className={`w-8 h-8 rounded-full border-2 transition-all ${colorMap[color].split(' ')[0]} ${
                            newSubjectColor === color ? 'border-gray-800 scale-110' : 'border-transparent'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                  <button
                    onClick={handleAddSubject}
                    disabled={!newSubjectName.trim()}
                    className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-300 text-white py-2.5 rounded-lg font-medium"
                  >
                    Save Subject
                  </button>
                </motion.div>
              )}
            </Card>

            {/* Subject List */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {subjects.map(subject => {
                const subjectBookIds = getSubjectBookIds(subject);
                const subjectBooks = subjectBookIds
                  .map(id => books.find(b => b.bookID === id))
                  .filter(Boolean) as typeof books;
                const availableBooks = books.filter(b => !subjectBookIds.includes(b.bookID));

                return (
                  <Card key={subject.subjectID} className="p-5">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <div className={`px-3 py-1 rounded-full text-sm font-semibold border ${colorMap[subject.color] || colorMap.blue}`}>
                          {subject.subjectName}
                        </div>
                      </div>
                      <button
                        onClick={() => deleteSubject(subject.subjectID)}
                        className="text-red-400 hover:text-red-600 p-1"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>

                    {/* Items in this subject */}
                    <div className="space-y-2 mb-3">
                      {subjectBooks.length === 0 ? (
                        <p className="text-sm text-gray-400 italic">No items assigned</p>
                      ) : (
                        subjectBooks.map(book => (
                          <div key={book.bookID} className="flex items-center justify-between bg-gray-50 px-3 py-2 rounded-lg">
                            <div className="flex items-center gap-2">
                              <Package className="size-4 text-gray-500" />
                              <div>
                                <p className="text-sm font-medium">{book.bookName}</p>
                                <p className="text-xs text-gray-400 font-mono">{book.rfidTag}</p>
                              </div>
                            </div>
                            <button
                              onClick={() => removeBookFromSubject(subject.subjectID, book.bookID)}
                              className="text-red-400 hover:text-red-600"
                            >
                              <XCircle className="size-4" />
                            </button>
                          </div>
                        ))
                      )}
                    </div>

                    {/* Add item to subject */}
                    {availableBooks.length > 0 && (
                      <select
                        onChange={e => {
                          if (e.target.value) addBookToSubject(subject.subjectID, e.target.value);
                          e.target.value = '';
                        }}
                        defaultValue=""
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-400"
                      >
                        <option value="">+ Add item to this subject</option>
                        {availableBooks.map(b => (
                          <option key={b.bookID} value={b.bookID}>{b.bookName}</option>
                        ))}
                      </select>
                    )}
                  </Card>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* ══════════════════════════════════════
            TAB 3 — ITEMS
        ══════════════════════════════════════ */}
        {activeTab === 'books' && (
          <motion.div
            key="books"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4"
          >
            {/* Stats */}
            <div className="grid grid-cols-3 gap-4">
              <Card className="p-4 text-center bg-blue-50 border-blue-200">
                <p className="text-3xl font-bold text-blue-700">{books.length}</p>
                <p className="text-sm text-blue-600 mt-1">Total Items</p>
              </Card>
              <Card className="p-4 text-center bg-green-50 border-green-200">
                <p className="text-3xl font-bold text-green-700">{books.filter(b => b.status === 'in_bag').length}</p>
                <p className="text-sm text-green-600 mt-1">In Bag</p>
              </Card>
              <Card className="p-4 text-center bg-red-50 border-red-200">
                <p className="text-3xl font-bold text-red-700">{books.filter(b => b.status === 'not_in_bag').length}</p>
                <p className="text-sm text-red-600 mt-1">Not in Bag</p>
              </Card>
            </div>

            {/* Add Item */}
            <Card className="p-5 bg-green-50 border-green-200">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-green-900">➕ Register New Item (RFID)</h3>
                <button
                  onClick={openItemForm}
                  className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
                >
                  {showBookForm ? 'Cancel' : 'Add Item'}
                </button>
              </div>

              {unknownRfidTags.length > 0 && (
                <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-amber-900">Unsaved RFID Tags</p>
                      <p className="text-xs text-amber-700">Tap a scanned tag to fill the RFID box.</p>
                    </div>
                    <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">
                      {unknownRfidTags.length}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {unknownRfidTags.map(tag => (
                      <button
                        key={`${tag.id}-${tag.uid}`}
                        onClick={() => useUnknownRfidTag(tag.uid)}
                        className={`rounded-md border px-3 py-2 text-left font-mono text-xs transition-colors ${
                          newRfidTag === tag.uid
                            ? 'border-green-500 bg-green-100 text-green-800'
                            : 'border-amber-300 bg-white text-amber-900 hover:bg-amber-100'
                        }`}
                      >
                        {tag.uid}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {showBookForm && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
                  <div className="flex items-center gap-2 p-3 bg-white border border-green-200 rounded-lg">
                    <Tag className="size-5 text-green-600" />
                    <input
                      type="text"
                      value={newRfidTag}
                      onChange={e => setNewRfidTag(e.target.value)}
                      placeholder="RFID Tag (e.g. RFID-A1B2C3)"
                      className="flex-1 text-sm focus:outline-none font-mono"
                    />
                  </div>
                  <div className="flex items-center gap-2 p-3 bg-white border border-green-200 rounded-lg">
                    <Package className="size-5 text-green-600" />
                    <input
                      type="text"
                      value={newBookName}
                      onChange={e => setNewBookName(e.target.value)}
                      placeholder="Item name (e.g. Water Bottle)"
                      className="flex-1 text-sm focus:outline-none"
                    />
                  </div>
                  {newBookSubject === 'other' ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="Type new subject..."
                        value={newCustomBookSubject}
                        onChange={e => setNewCustomBookSubject(e.target.value)}
                        className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
                        autoFocus
                      />
                      <button
                        onClick={() => { setNewBookSubject(''); setNewCustomBookSubject(''); }}
                        className="text-gray-500 hover:text-gray-700 px-2"
                      >
                        <XCircle className="size-5" />
                      </button>
                    </div>
                  ) : (
                    <select
                      value={newBookSubject}
                      onChange={e => setNewBookSubject(e.target.value)}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
                    >
                      <option value="">-- Select Subject --</option>
                      {subjects.map(s => (
                        <option key={s.subjectID} value={s.subjectName}>{s.subjectName}</option>
                      ))}
                      <option value="other">+ Type Other</option>
                    </select>
                  )}
                  <button
                    onClick={handleAddBook}
                    disabled={!newBookName.trim() || !newRfidTag.trim() || !newBookSubject.trim()}
                    className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white py-2.5 rounded-lg font-semibold"
                  >
                    Register Item with RFID
                  </button>
                </motion.div>
              )}
            </Card>

            {/* Items List */}
            <div className="space-y-3">
              {books.map((book, i) => (
                <motion.div
                  key={book.bookID}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04 }}
                >
                  <Card className={`p-4 border-l-4 ${
                    book.status === 'in_bag' ? 'border-l-green-500' : 'border-l-red-400'
                  }`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${
                          book.status === 'in_bag' ? 'bg-green-100' : 'bg-red-100'
                        }`}>
                          <Package className={`size-5 ${
                            book.status === 'in_bag' ? 'text-green-600' : 'text-red-500'
                          }`} />
                        </div>
                        <div>
                          <p className="font-medium text-sm">{book.bookName}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <Tag className="size-3 text-gray-400" />
                            <p className="text-xs text-gray-400 font-mono">{book.rfidTag}</p>
                            <span className="text-xs text-gray-400">•</span>
                            <p className="text-xs text-gray-500">{book.subject}</p>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {/* Toggle status */}
                        <button
                          onClick={() => updateBookStatus(
                            book.bookID,
                            book.status === 'in_bag' ? 'not_in_bag' : 'in_bag'
                          )}
                          className={`text-xs px-3 py-1.5 rounded-full font-semibold transition-colors ${
                            book.status === 'in_bag'
                              ? 'bg-green-100 text-green-700 hover:bg-green-200'
                              : 'bg-red-100 text-red-700 hover:bg-red-200'
                          }`}
                        >
                          {book.status === 'in_bag' ? '✅ In Bag' : '❌ Missing'}
                        </button>
                        <button
                          onClick={() => deleteBook(book.bookID)}
                          className="text-red-400 hover:text-red-600 p-1"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
