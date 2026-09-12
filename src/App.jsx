import { useEffect, useMemo, useState } from 'react';
import { Navigate, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Users, BookOpen, CalendarCheck, WalletCards, UserRound, Settings, LogOut, Menu, X, Plus, Search, ArrowUpRight, ArrowDownRight, Send, Loader2, CheckCircle2, Clock3 } from 'lucide-react';
import { httpsCallable } from 'firebase/functions';
import { auth, functions } from './lib/firebase';
import { createRecord, createSchoolForUser, deleteRecord, listenSchool, schoolCollection, updateRecord, watchCollection } from './lib/school';
import { useAuth } from './context/AuthContext';
import { onSnapshot, query, orderBy } from 'firebase/firestore';

const nav = [
  ['/', 'Dashboard', LayoutDashboard],
  ['/students', 'Students', Users],
  ['/classes', 'Classes', BookOpen],
  ['/attendance', 'Attendance', CalendarCheck],
  ['/fees', 'Fees & M-Pesa', WalletCards],
  ['/teachers', 'Teachers', UserRound],
  ['/settings', 'Settings', Settings],
];

function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <Loading />;
  return user ? children : <Navigate to="/login" replace />;
}

function App() {
  return <Routes>
    <Route path="/login" element={<AuthPage />} />
    <Route path="/" element={<Protected><Shell /></Protected>}>
      <Route index element={<Dashboard />} />
      <Route path="students" element={<Students />} />
      <Route path="classes" element={<Classes />} />
      <Route path="attendance" element={<Attendance />} />
      <Route path="fees" element={<Fees />} />
      <Route path="teachers" element={<Teachers />} />
      <Route path="settings" element={<SettingsPage />} />
    </Route>
  </Routes>;
}

function Loading() { return <div className="loading-screen"><div className="loader-orb" /><p>Loading secure workspace…</p></div>; }

function AuthPage() {
  const { user, loading, signIn, signInGoogle, register, resetPassword } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState('signin');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { if (!loading && user) navigate('/'); }, [user, loading, navigate]);

  async function submit(e) {
    e.preventDefault(); setBusy(true); setError('');
    try {
      if (mode === 'signup') await register(form);
      else await signIn(form.email, form.password);
    } catch (err) { setError(authMessage(err)); }
    finally { setBusy(false); }
  }
  async function google() { setBusy(true); setError(''); try { await signInGoogle(); } catch (err) { setError(authMessage(err)); } finally { setBusy(false); } }
  async function forgot() {
    if (!form.email) return setError('Enter your email first.');
    try { await resetPassword(form.email); setError('Password reset email sent.'); } catch (err) { setError(authMessage(err)); }
  }

  return <div className="auth-page">
    <div className="auth-background"><span /><span /><span /><span /></div>
    <div className="auth-panel glass">
      <div className="brand-mark">S</div>
      <div className="eyebrow">SCHOOL OPERATIONS</div>
      <h1>Run your school with clarity.</h1>
      <p className="muted">A secure workspace for your people, classes, attendance and fee collection.</p>
      <form onSubmit={submit} className="auth-form">
        {mode === 'signup' && <Field label="Your name"><input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Administrator name" /></Field>}
        <Field label="Email"><input required type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="admin@school.ac.ke" /></Field>
        <Field label="Password"><input required minLength={6} type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder="••••••••" /></Field>
        {mode === 'signin' && <button type="button" className="text-button" onClick={forgot}>Forgot password?</button>}
        {error && <div className="alert">{error}</div>}
        <button className="primary-button" disabled={busy}>{busy ? <Loader2 className="spin" size={18} /> : null}{mode === 'signin' ? 'Sign in' : 'Create account'}</button>
      </form>
      <div className="divider"><span>or</span></div>
      <button className="google-button" onClick={google} disabled={busy}>Continue with Google</button>
      <p className="auth-switch">{mode === 'signin' ? 'New administrator?' : 'Already have an account?'} <button onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(''); }}>{mode === 'signin' ? 'Create account' : 'Sign in'}</button></p>
    </div>
  </div>;
}

function Shell() {
  const { user, profile, logout } = useAuth();
  const [mobile, setMobile] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const [school, setSchool] = useState(null);
  useEffect(() => profile?.schoolId ? listenSchool(profile.schoolId, setSchool) : undefined, [profile?.schoolId]);
  const schoolName = school?.name || 'Your School';
  return <div className="app-shell">
    <aside className={`sidebar glass ${mobile ? 'open' : ''}`}>
      <div className="sidebar-brand"><div className="brand-mark small">S</div><div><strong>{schoolName}</strong><span>School OS</span></div><button className="mobile-close" onClick={() => setMobile(false)}><X size={18}/></button></div>
      <nav>{nav.map(([to, label, Icon]) => <NavLink key={to} to={to} end={to === '/'} onClick={() => setMobile(false)}><Icon size={18}/><span>{label}</span></NavLink>)}</nav>
      <div className="sidebar-bottom"><div className="profile-chip"><div className="avatar">{(user?.displayName || user?.email || 'A')[0].toUpperCase()}</div><div><strong>{user?.displayName || 'Administrator'}</strong><span>{user?.email}</span></div></div><button className="logout" onClick={async () => { await logout(); navigate('/login'); }}><LogOut size={17}/> Sign out</button></div>
    </aside>
    {mobile && <div className="mobile-overlay" onClick={() => setMobile(false)} />}
    <main className="main-area">
      <header className="topbar glass"><button className="menu-button" onClick={() => setMobile(true)}><Menu size={21}/></button><div><span className="topbar-label">{nav.find(x => x[0] === location.pathname)?.[1] || 'Workspace'}</span><small>Live school workspace</small></div><div className="topbar-actions"><span className="status-dot"/> Synced</div></header>
      <div className="content"><RoutesOutlet /></div>
    </main>
  </div>;
}
function RoutesOutlet() { return <Routes><Route index element={<Dashboard/>}/><Route path="students" element={<Students/>}/><Route path="classes" element={<Classes/>}/><Route path="attendance" element={<Attendance/>}/><Route path="fees" element={<Fees/>}/><Route path="teachers" element={<Teachers/>}/><Route path="settings" element={<SettingsPage/>}/></Routes>; }

function useSchoolData(name, sort = 'createdAt') {
  const { profile } = useAuth(); const [data, setData] = useState([]); const [loading, setLoading] = useState(true);
  useEffect(() => { if (!profile?.schoolId) { setData([]); setLoading(false); return; } setLoading(true); return watchCollection(profile.schoolId, name, d => { setData(d); setLoading(false); }, sort); }, [profile?.schoolId, name, sort]);
  return [data, loading, profile?.schoolId];
}

function Dashboard() {
  const [students] = useSchoolData('students'); const [classes] = useSchoolData('classes'); const [teachers] = useSchoolData('teachers'); const [payments] = useSchoolData('payments', 'paidAt');
  const collected = payments.reduce((a,p) => a + Number(p.amount || 0), 0);
  const outstanding = students.reduce((a,s) => a + Math.max(0, Number(classes.find(c => c.id === s.classId)?.fee || 0) - Number(s.paid || 0)), 0);
  const cards = [['Students', students.length, Users], ['Collected', kes(collected), ArrowUpRight], ['Outstanding', kes(outstanding), ArrowDownRight], ['Teachers', teachers.length, UserRound]];
  return <Page title="Good to see you." subtitle="Your school at a glance.">
    <div className="hero glass"><div><span className="eyebrow">OPERATIONS OVERVIEW</span><h2>Everything in one calm workspace.</h2><p>Track the numbers that matter without digging through spreadsheets.</p></div><div className="hero-orbit"><div className="orbit-core">S</div></div></div>
    <div className="stats-grid">{cards.map(([label,value,Icon],i) => <div className="stat-card glass" key={label}><div className="stat-icon"><Icon size={18}/></div><span>{label}</span><strong>{value}</strong><small>{i===1?'Across recorded payments':i===2?'Current fee exposure':'Live records'}</small></div>)}</div>
    <div className="dashboard-grid"><Card title="Recent payments" action="View fees" href="/fees"><PaymentsPreview payments={payments}/></Card><Card title="Classes" action="Manage classes" href="/classes"><ClassPreview classes={classes} students={students}/></Card></div>
  </Page>;
}

function Students() { const [students, loading, schoolId] = useSchoolData('students'); const [classes] = useSchoolData('classes'); const [q,setQ]=useState(''); const [open,setOpen]=useState(false); const [editing,setEditing]=useState(null); const filtered=students.filter(s => `${s.name} ${s.admissionNo}`.toLowerCase().includes(q.toLowerCase()));
  return <Page title="Students" subtitle="Maintain a single source of truth for enrollment." action={<button className="primary-button compact" onClick={()=>{setEditing(null);setOpen(true)}}><Plus size={16}/> Add student</button>}><div className="toolbar glass"><Search size={17}/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search students or admission number…"/></div><DataCard loading={loading}>{filtered.map(s=><div className="list-row" key={s.id}><div className="avatar">{initials(s.name)}</div><div className="row-main"><strong>{s.name}</strong><span>{s.admissionNo} · {classes.find(c=>c.id===s.classId)?.name || 'Unassigned'}</span></div><div className="row-meta">{s.guardianPhone || 'No guardian phone'}<button className="icon-button" onClick={()=>{setEditing(s);setOpen(true)}}>Edit</button><button className="icon-button danger" onClick={()=>remove(schoolId,'students',s.id)}>Delete</button></div></div>)}{!filtered.length&&!loading&&<Empty text="No students found."/>}</DataCard>{open&&<StudentForm existing={editing} classes={classes} schoolId={schoolId} onClose={()=>setOpen(false)}/>}</Page>;
}

function Classes(){ const [classes,loading,schoolId]=useSchoolData('classes'); const [students]=useSchoolData('students'); const [open,setOpen]=useState(false); const [editing,setEditing]=useState(null); return <Page title="Classes" subtitle="Organize grades, streams and term fees." action={<button className="primary-button compact" onClick={()=>{setEditing(null);setOpen(true)}}><Plus size={16}/> Add class</button>}><DataCard loading={loading} grid>{classes.map(c=><div className="class-card glass" key={c.id}><div className="class-top"><div><span className="eyebrow">CLASS</span><h3>{c.name}</h3></div><button className="icon-button" onClick={()=>{setEditing(c);setOpen(true)}}>Edit</button></div><strong>{kes(c.fee)}</strong><span>{students.filter(s=>s.classId===c.id).length} students</span></div>)}{!classes.length&&!loading&&<Empty text="Create your first class."/>}</DataCard>{open&&<ClassForm existing={editing} schoolId={schoolId} onClose={()=>setOpen(false)}/>}</Page>; }

function Teachers(){ const [teachers,loading,schoolId]=useSchoolData('teachers'); const [classes]=useSchoolData('classes'); const [open,setOpen]=useState(false); const [editing,setEditing]=useState(null); return <Page title="Teachers" subtitle="Manage teaching staff and class responsibility." action={<button className="primary-button compact" onClick={()=>{setEditing(null);setOpen(true)}}><Plus size={16}/> Add teacher</button>}><DataCard loading={loading}>{teachers.map(t=><div className="list-row" key={t.id}><div className="avatar">{initials(t.name)}</div><div className="row-main"><strong>{t.name}</strong><span>{t.subject || 'General'} · {classes.find(c=>c.id===t.classId)?.name || 'No class assigned'}</span></div><div className="row-meta">{t.phone || 'No phone'}<button className="icon-button" onClick={()=>{setEditing(t);setOpen(true)}}>Edit</button><button className="icon-button danger" onClick={()=>remove(schoolId,'teachers',t.id)}>Delete</button></div></div>)}{!teachers.length&&!loading&&<Empty text="Add your first teacher."/>}</DataCard>{open&&<TeacherForm existing={editing} classes={classes} schoolId={schoolId} onClose={()=>setOpen(false)}/>}</Page>; }

function Attendance(){ const [students]=useSchoolData('students'); const [classes]=useSchoolData('classes'); const {profile}=useAuth(); const [classId,setClassId]=useState(''); const [date,setDate]=useState(new Date().toISOString().slice(0,10)); const [records,setRecords]=useState({}); useEffect(()=>{if(!profile?.schoolId)return; const c=classId||classes[0]?.id;if(!c)return; const ref=query(schoolCollection(profile.schoolId,'attendance'),where('date','==',date),where('classId','==',c)); return onSnapshot(ref,s=>setRecords(Object.fromEntries(s.docs.map(d=>[d.data().studentId,{id:d.id,...d.data()}]))));},[profile?.schoolId,classId,date,classes]); async function mark(s,status){const current=records[s.id]; if(current) await updateRecord(profile.schoolId,'attendance',current.id,{status}); else await createRecord(profile.schoolId,'attendance',{studentId:s.id,classId:classId||classes[0]?.id,date,status});} const currentClass=classId||classes[0]?.id; const list=students.filter(s=>s.classId===currentClass); return <Page title="Attendance" subtitle="Mark daily attendance with a single tap."><div className="toolbar glass"><select value={currentClass||''} onChange={e=>setClassId(e.target.value)}>{classes.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select><input type="date" value={date} onChange={e=>setDate(e.target.value)}/><span className="toolbar-spacer"/><span className="muted">{list.filter(s=>records[s.id]?.status==='present').length} present · {list.filter(s=>records[s.id]?.status==='absent').length} absent</span></div><DataCard>{list.map(s=><div className="attendance-row" key={s.id}><div><strong>{s.name}</strong><span>{s.admissionNo}</span></div><div className="segmented"><button className={records[s.id]?.status==='present'?'selected present':''} onClick={()=>mark(s,'present')}>Present</button><button className={records[s.id]?.status==='absent'?'selected absent':''} onClick={()=>mark(s,'absent')}>Absent</button></div></div>)}{!list.length&&<Empty text="Add students to this class first."/>}</DataCard></Page>; }

function Fees(){ const [students,loading]=useSchoolData('students'); const [classes]=useSchoolData('classes'); const [payments]=useSchoolData('payments','paidAt'); const {profile}=useAuth(); const [open,setOpen]=useState(false); const [selected,setSelected]=useState(null); const [q,setQ]=useState(''); const [message,setMessage]=useState(''); const filtered=students.filter(s=>`${s.name} ${s.admissionNo}`.toLowerCase().includes(q.toLowerCase())); const collected=payments.reduce((a,p)=>a+Number(p.amount||0),0);
  async function pushPayment(data){setMessage(''); try { const initiate= httpsCallable(functions,'initiateStkPush'); const result=await initiate({schoolId:profile.schoolId,studentId:data.studentId,phone:data.phone,amount:Number(data.amount),accountReference:data.accountReference||data.studentId,transactionDesc:`School fees - ${data.studentName}`}); setMessage(result.data?.message||'STK Push initiated.'); setOpen(false); } catch(e){setMessage(e.message||'Could not initiate payment.');}}
  return <Page title="Fees & M-Pesa" subtitle="See balances and request payments securely." action={<button className="primary-button compact" onClick={()=>{setSelected(null);setOpen(true)}}><Send size={16}/> Request payment</button>}><div className="fee-banner glass"><div><span className="eyebrow">M-PESA COLLECTIONS</span><h3>STK Push</h3><p>Enter a parent's phone number and amount. The server securely requests the payment prompt.</p></div><div className="fee-total"><span>Recorded today</span><strong>{kes(collected)}</strong></div></div>{message&&<div className="success-banner"><CheckCircle2 size={18}/>{message}</div>}<div className="toolbar glass"><Search size={17}/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search students…"/></div><DataCard loading={loading}>{filtered.map(s=>{const fee=Number(classes.find(c=>c.id===s.classId)?.fee||0);const paid=Number(s.paid||0);const balance=Math.max(0,fee-paid);return <div className="list-row" key={s.id}><div className="avatar">{initials(s.name)}</div><div className="row-main"><strong>{s.name}</strong><span>{classes.find(c=>c.id===s.classId)?.name||'Unassigned'} · {s.guardianPhone||'No guardian phone'}</span></div><div className="balance"><span>Balance</span><strong>{kes(balance)}</strong></div><button className="primary-button compact" onClick={()=>{setSelected(s);setOpen(true)}}>Pay</button></div>})}</DataCard>{open&&<PaymentForm student={selected} students={students} onClose={()=>setOpen(false)} onSubmit={pushPayment}/>}</Page>; }

function SettingsPage(){const {profile}=useAuth();const [school]=useSchoolData('settings');return <Page title="Settings" subtitle="Workspace configuration and security controls."><div className="settings-grid"><div className="settings-card glass"><span className="eyebrow">WORKSPACE</span><h3>Firebase-backed school data</h3><p>Authentication, Firestore records and payment requests are separated from the browser UI. School data is scoped by school ID.</p><div className="setting-line"><span>School ID</span><code>{profile?.schoolId||'Not created'}</code></div></div><div className="settings-card glass"><span className="eyebrow">SECURITY</span><h3>Production posture</h3><p>Keep Daraja credentials server-side, use Firebase Security Rules for client access, and enable App Check before public launch.</p><a className="text-link" href="https://firebase.google.com/docs/firestore/security" target="_blank" rel="noreferrer">Review Firebase security →</a></div></div></Page>}

function Page({title,subtitle,action,children}){return <div className="page"><div className="page-heading"><div><h1>{title}</h1><p>{subtitle}</p></div>{action}</div>{children}</div>}
function Card({title,action,href,children}){const nav=useNavigate();return <section className="panel glass"><div className="panel-heading"><h3>{title}</h3>{action&&<button className="text-link" onClick={()=>nav(href)}>{action} →</button>}</div>{children}</section>}
function DataCard({children,loading,grid=false}){return <section className={`panel glass ${grid?'card-grid':''}`}>{loading?<div className="skeleton"/>:children}</section>}
function Empty({text}){return <div className="empty">{text}</div>}
function PaymentsPreview({payments}){return payments.slice(0,5).map(p=><div className="mini-row" key={p.id}><div><strong>{p.studentName||'Student'}</strong><span>{p.status||'recorded'}</span></div><strong>{kes(p.amount)}</strong></div>);}
function ClassPreview({classes,students}){return classes.slice(0,5).map(c=><div className="mini-row" key={c.id}><div><strong>{c.name}</strong><span>{students.filter(s=>s.classId===c.id).length} students</span></div><strong>{kes(c.fee)}</strong></div>);}
function Field({label,children}){return <label className="field"><span>{label}</span>{children}</label>}

function StudentForm({existing,classes,schoolId,onClose}){const [f,setF]=useState(existing||{name:'',admissionNo:'',classId:classes[0]?.id||'',guardianName:'',guardianPhone:''});const save=async()=>{if(!f.name||!f.admissionNo)return;existing?await updateRecord(schoolId,'students',existing.id,f):await createRecord(schoolId,'students',{...f,paid:0});onClose()};return <Modal title={existing?'Edit student':'Add student'} onClose={onClose} onSave={save}><Field label="Full name"><input value={f.name} onChange={e=>setF({...f,name:e.target.value})}/></Field><Field label="Admission number"><input value={f.admissionNo} onChange={e=>setF({...f,admissionNo:e.target.value})}/></Field><Field label="Class"><select value={f.classId} onChange={e=>setF({...f,classId:e.target.value})}>{classes.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></Field><Field label="Guardian phone"><input value={f.guardianPhone} onChange={e=>setF({...f,guardianPhone:e.target.value})} placeholder="2547XXXXXXXX"/></Field></Modal>}
function ClassForm({existing,schoolId,onClose}){const [f,setF]=useState(existing||{name:'',fee:''});const save=async()=>{existing?await updateRecord(schoolId,'classes',{...f,fee:Number(f.fee||0)}.id,{...f,fee:Number(f.fee||0)}):await createRecord(schoolId,'classes',{...f,fee:Number(f.fee||0)});onClose()};return <Modal title={existing?'Edit class':'Add class'} onClose={onClose} onSave={save}><Field label="Class name"><input value={f.name} onChange={e=>setF({...f,name:e.target.value})} placeholder="Grade 5 East"/></Field><Field label="Term fee (KES)"><input type="number" min="0" value={f.fee} onChange={e=>setF({...f,fee:e.target.value})}/></Field></Modal>}
function TeacherForm({existing,classes,schoolId,onClose}){const [f,setF]=useState(existing||{name:'',subject:'',classId:'',phone:''});const save=async()=>{existing?await updateRecord(schoolId,'teachers',existing.id,f):await createRecord(schoolId,'teachers',f);onClose()};return <Modal title={existing?'Edit teacher':'Add teacher'} onClose={onClose} onSave={save}><Field label="Full name"><input value={f.name} onChange={e=>setF({...f,name:e.target.value})}/></Field><Field label="Subject"><input value={f.subject} onChange={e=>setF({...f,subject:e.target.value})}/></Field><Field label="Class in charge"><select value={f.classId} onChange={e=>setF({...f,classId:e.target.value})}><option value="">None</option>{classes.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></Field><Field label="Phone"><input value={f.phone} onChange={e=>setF({...f,phone:e.target.value})}/></Field></Modal>}
function PaymentForm({student,students,onClose,onSubmit}){const s=student||students[0];const [f,setF]=useState({studentId:s?.id||'',phone:s?.guardianPhone||'',amount:'',accountReference:s?.admissionNo||'',studentName:s?.name||''});const selected=students.find(x=>x.id===f.studentId);return <Modal title="Request M-Pesa payment" onClose={onClose} onSave={()=>onSubmit(f)} saveLabel="Send STK Push"><Field label="Student"><select value={f.studentId} onChange={e=>{const n=students.find(x=>x.id===e.target.value);setF({...f,studentId:n.id,studentName:n.name,phone:n.guardianPhone||'',accountReference:n.admissionNo||''})}}>{students.map(x=><option key={x.id} value={x.id}>{x.name} — {x.admissionNo}</option>)}</select></Field><Field label="Parent / guardian M-Pesa number"><input required value={f.phone} onChange={e=>setF({...f,phone:e.target.value})} placeholder="2547XXXXXXXX"/></Field><Field label="Amount (KES)"><input required type="number" min="1" value={f.amount} onChange={e=>setF({...f,amount:e.target.value})}/></Field><Field label="Account reference"><input maxLength={12} value={f.accountReference} onChange={e=>setF({...f,accountReference:e.target.value.toUpperCase()})}/></Field><p className="form-note"><Clock3 size={15}/> The request is sent by the secure Firebase backend; Daraja credentials never enter the browser.</p></Modal>}
function Modal({title,onClose,onSave,children,saveLabel='Save'}){return <div className="modal-backdrop" onMouseDown={e=>e.target===e.currentTarget&&onClose()}><div className="modal glass"><div className="modal-head"><h3>{title}</h3><button className="icon-button" onClick={onClose}><X size={18}/></button></div><div className="modal-body">{children}</div><div className="modal-foot"><button className="secondary-button" onClick={onClose}>Cancel</button><button className="primary-button" onClick={onSave}>{saveLabel}</button></div></div></div>}
async function remove(schoolId,collection,id){if(window.confirm('Delete this record?'))await deleteRecord(schoolId,collection,id)}
function initials(name=''){return name.split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join('').toUpperCase()||'S'}
function kes(n){return `KES ${Number(n||0).toLocaleString('en-KE')}`}
function authMessage(e){const map={'auth/invalid-credential':'Email or password is incorrect.','auth/email-already-in-use':'That email is already registered.','auth/weak-password':'Use a stronger password.','auth/popup-closed-by-user':'Google sign-in was cancelled.'};return map[e?.code]||e?.message||'Something went wrong.'}

export default App;
