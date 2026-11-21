import AsyncStorage from '@react-native-async-storage/async-storage';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Crypto from 'expo-crypto';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';

type Student = {
  id: string;
  name: string;
  dob: string;
  guardian: string;
  phone: string;
  address: string;
  className: string;
};
type Attendance = {
  studentId: string;
  date: string;
  checkIn: string;
  checkOut?: string;
};
type Tab = 'Home' | 'Scan' | 'Students';

const STUDENTS_KEY = 'academy.students.v1';
const ATTENDANCE_KEY = 'academy.attendance.v1';
const GREEN = '#0b5b46';
const todayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const timeNow = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
const isLate = () => {
  const d = new Date();
  return d.getHours() > 16 || (d.getHours() === 16 && d.getMinutes() > 30);
};

export default function App() {
  const [students, setStudents] = useState<Student[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [tab, setTab] = useState<Tab>('Home');
  const [formOpen, setFormOpen] = useState(false);
  const [selected, setSelected] = useState<Student | null>(null);
  const [scanEnabled, setScanEnabled] = useState(true);
  const [permission, requestPermission] = useCameraPermissions();

  useEffect(() => {
    (async () => {
      try {
        const [savedStudents, savedAttendance] = await Promise.all([
          AsyncStorage.getItem(STUDENTS_KEY), AsyncStorage.getItem(ATTENDANCE_KEY),
        ]);
        if (savedStudents) setStudents(JSON.parse(savedStudents));
        if (savedAttendance) setAttendance(JSON.parse(savedAttendance));
      } catch {
        Alert.alert('Storage error', 'Could not load saved records from this device.');
      }
    })();
  }, []);

  const todays = useMemo(() => attendance.filter((a) => a.date === todayKey()), [attendance]);
  const saveStudents = async (next: Student[]) => {
    setStudents(next);
    await AsyncStorage.setItem(STUDENTS_KEY, JSON.stringify(next));
  };
  const saveAttendance = async (next: Attendance[]) => {
    setAttendance(next);
    await AsyncStorage.setItem(ATTENDANCE_KEY, JSON.stringify(next));
  };

  const recordScan = async (studentId: string) => {
    setScanEnabled(false);
    const student = students.find((s) => s.id === studentId);
    if (!student) {
      Alert.alert('ID not found', 'This QR code does not match a student on this device.');
      setTimeout(() => setScanEnabled(true), 1300);
      return;
    }
    const existing = todays.find((a) => a.studentId === studentId);
    if (!existing) {
      const entry: Attendance = { studentId, date: todayKey(), checkIn: timeNow() };
      await saveAttendance([...attendance, entry]);
      Alert.alert(isLate() ? 'Checked in — Late' : 'Checked in', `${student.name}\nArrival: ${entry.checkIn}${isLate() ? '\nLate arrival (after 4:30 PM)' : ''}`);
    } else if (!existing.checkOut) {
      const updated = attendance.map((a) => a === existing ? { ...a, checkOut: timeNow() } : a);
      await saveAttendance(updated);
      Alert.alert('Checked out', `${student.name}\nDeparture: ${timeNow()}`);
    } else {
      Alert.alert('Already checked out', `${student.name} has both arrival and departure recorded today.`);
    }
    setTimeout(() => setScanEnabled(true), 1500);
  };

  const checkInStudent = async (student: Student) => {
    const existing = todays.find((a) => a.studentId === student.id);
    if (existing) { Alert.alert('Already checked in', `${student.name} checked in at ${existing.checkIn}.`); return; }
    const entry = { studentId: student.id, date: todayKey(), checkIn: timeNow() };
    await saveAttendance([...attendance, entry]);
    Alert.alert(isLate() ? 'Checked in — Late' : 'Checked in', `${student.name} · ${entry.checkIn}`);
  };

  const renderHome = () => (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <Text style={styles.mosque}>☾</Text>
        <Text style={styles.heroTitle}>Assalamu Alaikum</Text>
        <Text style={styles.heroSub}>Islamic & Arabic Class Attendance</Text>
        <Text style={styles.heroDate}>{new Date().toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}</Text>
      </View>
      <View style={styles.statsRow}>
        <Stat value={String(students.length)} label="Students" />
        <Stat value={String(todays.length)} label="Checked in" />
        <Stat value={String(todays.filter((a) => a.checkOut).length)} label="Checked out" />
      </View>
      <View style={styles.scheduleCard}>
        <Text style={styles.sectionTitle}>Today's schedule</Text>
        <View style={styles.scheduleRow}><Text style={styles.scheduleTime}>11:00 AM</Text><Text style={styles.muted}>Check-in opens</Text></View>
        <View style={styles.scheduleRow}><Text style={styles.scheduleTime}>4:30 PM</Text><Text style={styles.muted}>Arrivals after this are late</Text></View>
        <View style={styles.scheduleRow}><Text style={styles.scheduleTime}>6:00 PM</Text><Text style={styles.muted}>Dismissal / check-out</Text></View>
      </View>
      <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Today's attendance</Text><Text style={styles.muted}>{todays.length}/{students.length}</Text></View>
      {students.length === 0 ? <Empty text="Register your first student to get started." /> : students.map((s) => {
        const entry = todays.find((a) => a.studentId === s.id);
        return <StudentRow key={s.id} student={s} entry={entry} onPress={() => setSelected(s)} onCheckIn={() => checkInStudent(s)} />;
      })}
    </ScrollView>
  );

  const renderStudents = () => (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.sectionHeader}><View><Text style={styles.pageTitle}>Students</Text><Text style={styles.muted}>{students.length} registered</Text></View><ActionButton label="＋ Add student" onPress={() => setFormOpen(true)} /></View>
      {students.length === 0 ? <Empty text="Student profiles and QR ID cards will appear here." /> : students.map((s) => {
        const entry = todays.find((a) => a.studentId === s.id);
        return <StudentRow key={s.id} student={s} entry={entry} onPress={() => setSelected(s)} onCheckIn={() => checkInStudent(s)} />;
      })}
    </ScrollView>
  );

  const renderScan = () => (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.pageTitle}>Scan student ID</Text>
      <Text style={[styles.muted, { marginBottom: 18 }]}>Scan once for arrival; scan again at dismissal to record departure.</Text>
      {!permission?.granted ? <View style={styles.permissionCard}>
        <Text style={styles.sectionTitle}>Camera permission needed</Text>
        <Text style={[styles.muted, { marginVertical: 10 }]}>Allow camera access to scan student QR ID cards.</Text>
        <ActionButton label="Enable camera" onPress={requestPermission} />
      </View> : <View style={styles.cameraFrame}>
        <CameraView style={styles.camera} facing="back" barcodeScannerSettings={{ barcodeTypes: ['qr'] }} onBarcodeScanned={scanEnabled ? ({ data }) => recordScan(data) : undefined} />
        <View pointerEvents="none" style={styles.scanTarget}><View style={styles.scanCorner} /></View>
      </View>}
      <View style={styles.tipCard}><Text style={styles.sectionTitle}>How scanning works</Text><Text style={styles.muted}>First scan records check-in. The next scan records check-out. After 4:30 PM, check-ins are marked late. Dismissal is at 6:00 PM.</Text></View>
      <Text style={[styles.sectionTitle, { marginTop: 22 }]}>Today</Text>
      {todays.map((entry) => {
        const student = students.find((s) => s.id === entry.studentId);
        return student ? <StudentRow key={entry.studentId} student={student} entry={entry} onPress={() => setSelected(student)} onCheckIn={() => checkInStudent(student)} /> : null;
      })}
    </ScrollView>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />
      {tab === 'Home' ? renderHome() : tab === 'Scan' ? renderScan() : renderStudents()}
      <View style={styles.tabBar}>
        {(['Home', 'Scan', 'Students'] as Tab[]).map((name) => <TouchableOpacity key={name} onPress={() => setTab(name)} style={styles.tabItem}>
          <Text style={[styles.tabIcon, tab === name && styles.activeTab]}>{name === 'Home' ? '⌂' : name === 'Scan' ? '▦' : '♙'}</Text>
          <Text style={[styles.tabLabel, tab === name && styles.activeTab]}>{name}</Text>
        </TouchableOpacity>)}
      </View>
      <StudentForm visible={formOpen} onClose={() => setFormOpen(false)} onSave={async (input) => {
        const student: Student = { ...input, id: Crypto.randomUUID() };
        await saveStudents([...students, student]);
        setFormOpen(false);
        Alert.alert('Student added', `${student.name}'s QR ID card is ready.`);
        setSelected(student);
      }} />
      <Modal visible={!!selected} animationType="slide" transparent onRequestClose={() => setSelected(null)}>
        <View style={styles.modalShade}><View style={styles.detailSheet}>
          <View style={styles.sectionHeader}><Text style={styles.pageTitle}>Student ID</Text><TouchableOpacity onPress={() => setSelected(null)}><Text style={styles.close}>✕</Text></TouchableOpacity></View>
          {selected && <ScrollView contentContainerStyle={{ alignItems: 'center', paddingBottom: 18 }}>
            <View style={styles.idCard}>
              <View style={styles.idHeader}><Text style={styles.idCrescent}>☾</Text><Text style={styles.idOrg}>ISLAMIC ACADEMY</Text><Text style={styles.idSub}>STUDENT ID</Text></View>
              <View style={styles.qrBox}><QRCode value={selected.id} size={150} color="#102b22" backgroundColor="#ffffff" /></View>
              <Text style={styles.idName}>{selected.name}</Text>
              <Text style={styles.idClass}>{selected.className || 'Islamic & Arabic Classes'}</Text>
              <Text style={styles.idNumber}>ID · {selected.id.slice(0, 8).toUpperCase()}</Text>
            </View>
            <View style={styles.details}>
              <Detail label="Date of birth" value={selected.dob} />
              <Detail label="Parent / guardian" value={selected.guardian} />
              <Detail label="Contact number" value={selected.phone} />
              <Detail label="Address / location" value={selected.address} />
              <Detail label="Today's check-in" value={todays.find((a) => a.studentId === selected.id)?.checkIn || 'Not checked in'} />
              <Detail label="Today's check-out" value={todays.find((a) => a.studentId === selected.id)?.checkOut || 'Not checked out'} />
            </View>
          </ScrollView>}
        </View></View>
      </Modal>
    </SafeAreaView>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return <View style={styles.stat}><Text style={styles.statValue}>{value}</Text><Text style={styles.statLabel}>{label}</Text></View>;
}
function ActionButton({ label, onPress }: { label: string; onPress: () => void }) {
  return <TouchableOpacity onPress={onPress} style={styles.button}><Text style={styles.buttonText}>{label}</Text></TouchableOpacity>;
}
function Empty({ text }: { text: string }) {
  return <View style={styles.empty}><Text style={styles.emptyIcon}>✦</Text><Text style={styles.muted}>{text}</Text></View>;
}
function StudentRow({ student, entry, onPress, onCheckIn }: { student: Student; entry?: Attendance; onPress: () => void; onCheckIn: () => void }) {
  const late = !!entry && (() => {
    const [time, meridiem] = entry.checkIn.split(' ');
    const [h, m] = time.split(':').map(Number);
    const hour = meridiem?.toLowerCase() === 'pm' && h !== 12 ? h + 12 : h;
    return hour > 16 || (hour === 16 && m > 30);
  })();
  return <View style={styles.studentRow}>
    <TouchableOpacity style={styles.studentMain} onPress={onPress}><View style={styles.avatar}><Text style={styles.avatarText}>{student.name.charAt(0).toUpperCase()}</Text></View><View style={{ flex: 1 }}><Text style={styles.studentName}>{student.name}</Text><Text style={styles.studentMeta}>{entry ? `In ${entry.checkIn}${entry.checkOut ? ` · Out ${entry.checkOut}` : ''}` : student.className || 'Not checked in'}</Text></View></TouchableOpacity>
    {entry ? <View style={[styles.badge, late && styles.lateBadge]}><Text style={[styles.badgeText, late && styles.lateText]}>{entry.checkOut ? 'Done' : late ? 'Late' : 'Present'}</Text></View> : <TouchableOpacity style={styles.smallButton} onPress={onCheckIn}><Text style={styles.smallButtonText}>Check in</Text></TouchableOpacity>}
  </View>;
}
function Detail({ label, value }: { label: string; value: string }) {
  return <View style={styles.detailRow}><Text style={styles.detailLabel}>{label}</Text><Text style={styles.detailValue}>{value || '—'}</Text></View>;
}

type StudentInput = Omit<Student, 'id'>;
function StudentForm({ visible, onClose, onSave }: { visible: boolean; onClose: () => void; onSave: (input: StudentInput) => void }) {
  const [name, setName] = useState('');
  const [dob, setDob] = useState('');
  const [guardian, setGuardian] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [className, setClassName] = useState('');
  const reset = () => { setName(''); setDob(''); setGuardian(''); setPhone(''); setAddress(''); setClassName(''); };
  const submit = () => {
    if (!name.trim() || !guardian.trim() || !phone.trim()) {
      Alert.alert('Required information', 'Please enter the student name, parent/guardian name, and contact number.');
      return;
    }
    onSave({ name: name.trim(), dob: dob.trim(), guardian: guardian.trim(), phone: phone.trim(), address: address.trim(), className: className.trim() });
    reset();
  };
  return <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
    <SafeAreaView style={styles.formSafe}><KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.formHeader}><TouchableOpacity onPress={onClose}><Text style={styles.cancel}>Cancel</Text></TouchableOpacity><Text style={styles.formTitle}>New student</Text><View style={{ width: 52 }} /></View>
      <ScrollView contentContainerStyle={styles.formContent} keyboardShouldPersistTaps="handled">
        <Text style={styles.formIntro}>Create a student profile and a private QR ID card.</Text>
        <Field label="Student's full name *" value={name} onChangeText={setName} placeholder="Full name" />
        <Field label="Date of birth" value={dob} onChangeText={setDob} placeholder="DD / MM / YYYY" />
        <Field label="Parent / guardian name *" value={guardian} onChangeText={setGuardian} placeholder="Full name" />
        <Field label="Contact number *" value={phone} onChangeText={setPhone} placeholder="Phone number" keyboardType="phone-pad" />
        <Field label="Address / location" value={address} onChangeText={setAddress} placeholder="Home address or area" />
        <Field label="Class" value={className} onChangeText={setClassName} placeholder="e.g. Arabic Beginner" />
        <Text style={styles.privacyNote}>🔒 The QR code contains only a random student ID—not their date of birth, address, or guardian details.</Text>
        <ActionButton label="Save student & create ID" onPress={submit} />
      </ScrollView>
    </KeyboardAvoidingView></SafeAreaView>
  </Modal>;
}
function Field(props: { label: string; value: string; onChangeText: (value: string) => void; placeholder: string; keyboardType?: 'default' | 'phone-pad' }) {
  return <View style={styles.field}><Text style={styles.fieldLabel}>{props.label}</Text><TextInput value={props.value} onChangeText={props.onChangeText} placeholder={props.placeholder} placeholderTextColor="#9aa49f" keyboardType={props.keyboardType || 'default'} style={styles.input} /></View>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f6f7f2' }, content: { padding: 18, paddingBottom: 28 }, hero: { backgroundColor: GREEN, borderRadius: 24, padding: 24, marginBottom: 16, overflow: 'hidden' }, mosque: { color: '#d9c58d', fontSize: 30, marginBottom: 6 }, heroTitle: { color: 'white', fontSize: 25, fontWeight: '700' }, heroSub: { color: '#d8e8df', fontSize: 14, marginTop: 5 }, heroDate: { color: '#d8e8df', fontSize: 12, marginTop: 18 }, statsRow: { flexDirection: 'row', gap: 10, marginBottom: 18 }, stat: { flex: 1, backgroundColor: 'white', borderRadius: 16, padding: 14, alignItems: 'center', elevation: 1 }, statValue: { color: GREEN, fontSize: 23, fontWeight: '700' }, statLabel: { color: '#77817c', fontSize: 11, marginTop: 3 }, scheduleCard: { backgroundColor: 'white', borderRadius: 18, padding: 17, marginBottom: 22 }, sectionTitle: { fontSize: 16, fontWeight: '700', color: '#20352d' }, scheduleRow: { flexDirection: 'row', marginTop: 14, alignItems: 'center' }, scheduleTime: { width: 92, color: GREEN, fontWeight: '700' }, muted: { color: '#7b8580', fontSize: 13, lineHeight: 19 }, sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 13 }, pageTitle: { color: '#20352d', fontSize: 24, fontWeight: '700' }, studentRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'white', borderRadius: 16, padding: 12, marginBottom: 9 }, studentMain: { flex: 1, flexDirection: 'row', alignItems: 'center' }, avatar: { width: 42, height: 42, borderRadius: 14, backgroundColor: '#e7f1eb', alignItems: 'center', justifyContent: 'center', marginRight: 11 }, avatarText: { color: GREEN, fontWeight: '700', fontSize: 17 }, studentName: { color: '#24352e', fontWeight: '700', fontSize: 14 }, studentMeta: { color: '#858e89', fontSize: 11, marginTop: 4 }, badge: { backgroundColor: '#e8f4ec', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 6 }, badgeText: { color: GREEN, fontSize: 10, fontWeight: '700' }, lateBadge: { backgroundColor: '#fff0d9' }, lateText: { color: '#a65b00' }, smallButton: { backgroundColor: '#e8f4ec', paddingHorizontal: 11, paddingVertical: 8, borderRadius: 12 }, smallButtonText: { color: GREEN, fontSize: 11, fontWeight: '700' }, button: { backgroundColor: GREEN, borderRadius: 13, paddingHorizontal: 16, paddingVertical: 12, alignItems: 'center' }, buttonText: { color: 'white', fontWeight: '700', fontSize: 13 }, empty: { backgroundColor: 'white', padding: 25, borderRadius: 18, alignItems: 'center' }, emptyIcon: { fontSize: 25, color: '#c2aa6b', marginBottom: 8 }, tabBar: { flexDirection: 'row', backgroundColor: 'white', borderTopWidth: 1, borderTopColor: '#edf0eb', paddingTop: 9, paddingBottom: Platform.OS === 'ios' ? 16 : 9 }, tabItem: { flex: 1, alignItems: 'center', gap: 2 }, tabIcon: { fontSize: 20, color: '#96a099' }, tabLabel: { color: '#96a099', fontSize: 10, fontWeight: '600' }, activeTab: { color: GREEN }, permissionCard: { backgroundColor: 'white', padding: 18, borderRadius: 18 }, cameraFrame: { height: 370, borderRadius: 22, overflow: 'hidden', backgroundColor: '#102b22' }, camera: { flex: 1 }, scanTarget: { position: 'absolute', top: '25%', left: '15%', width: '70%', height: '50%', borderWidth: 2, borderColor: '#fff', borderRadius: 20, opacity: 0.9 }, scanCorner: { flex: 1 }, tipCard: { backgroundColor: '#e8f1eb', borderRadius: 16, padding: 16, marginTop: 15, gap: 7 }, tabBar: { flexDirection: 'row', backgroundColor: 'white', borderTopWidth: 1, borderTopColor: '#edf0eb', paddingTop: 9, paddingBottom: Platform.OS === 'ios' ? 16 : 9 }, modalShade: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.35)' }, detailSheet: { backgroundColor: '#f6f7f2', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '94%' }, close: { fontSize: 20, color: '#75817b', padding: 4 }, idCard: { width: 285, backgroundColor: 'white', borderRadius: 20, alignItems: 'center', paddingBottom: 20, overflow: 'hidden', elevation: 3 }, idHeader: { backgroundColor: GREEN, width: '100%', alignItems: 'center', padding: 15 }, idCrescent: { color: '#d9c58d', fontSize: 24 }, idOrg: { color: 'white', fontWeight: '700', letterSpacing: 1.2, marginTop: 4 }, idSub: { color: '#d8e8df', fontSize: 10, marginTop: 3, letterSpacing: 2 }, qrBox: { padding: 12, backgroundColor: 'white', marginTop: 13 }, idName: { color: '#20352d', fontWeight: '700', fontSize: 18, marginTop: 5 }, idClass: { color: '#78837d', fontSize: 12, marginTop: 4 }, idNumber: { color: GREEN, fontSize: 10, letterSpacing: 1.5, marginTop: 11, fontWeight: '700' }, details: { alignSelf: 'stretch', backgroundColor: 'white', borderRadius: 16, paddingHorizontal: 15, marginTop: 16 }, detailRow: { borderBottomWidth: 1, borderBottomColor: '#eff1ed', paddingVertical: 11 }, detailLabel: { color: '#8a938e', fontSize: 10, marginBottom: 3 }, detailValue: { color: '#26372f', fontSize: 13, fontWeight: '600' }, formSafe: { flex: 1, backgroundColor: '#f6f7f2' }, formHeader: { height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, borderBottomWidth: 1, borderBottomColor: '#e8ebe6', backgroundColor: 'white' }, cancel: { color: GREEN, fontSize: 14 }, formTitle: { color: '#20352d', fontWeight: '700', fontSize: 16 }, formContent: { padding: 20, paddingBottom: 35 }, formIntro: { color: '#6f7b74', marginBottom: 20, fontSize: 13 }, field: { marginBottom: 15 }, fieldLabel: { color: '#405148', fontSize: 12, fontWeight: '700', marginBottom: 7 }, input: { backgroundColor: 'white', borderWidth: 1, borderColor: '#e2e7e1', borderRadius: 12, paddingHorizontal: 13, paddingVertical: 12, color: '#24352e', fontSize: 14 }, privacyNote: { backgroundColor: '#e8f1eb', borderRadius: 12, padding: 12, color: '#527064', fontSize: 12, lineHeight: 18, marginBottom: 20 },
});
