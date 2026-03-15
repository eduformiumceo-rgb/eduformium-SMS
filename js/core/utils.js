// ══════════════════════════════════════════
//  EDUFORMIUM SMS — Core Utilities
//  DB layer · helpers · formatters · migrations · seed
// ══════════════════════════════════════════

const DB = {
  _pending: 0,
  _errored: false,
  _skipKeys: new Set(['session','seeded','darkMode','themeColors','fontSize','smsSettings','sms_dismissed','readNotifIds']),

  get: (k, def=null)=>{ try{ const v=localStorage.getItem('sms_'+k); return v?JSON.parse(v):def; }catch{ return def; } },

  set: (k,v)=>{
    try{ localStorage.setItem('sms_'+k,JSON.stringify(v)); }catch{}
    const sid=window.SMS&&window.SMS.schoolId;
    const isDemo=window.SMS&&window.SMS._demoMode;
    if(sid && !isDemo && !DB._skipKeys.has(k) && window.FDB){
      DB._pending++;
      DB._updateSync();
      let writePromise;
      if(k==='school') writePromise=FDB.saveSchoolProfile(sid,v);
      else if(Array.isArray(v)) writePromise=FDB.batchWrite(sid,k,v);
      else writePromise=Promise.resolve(true);
      writePromise
        .then(()=>{ DB._pending=Math.max(0,DB._pending-1); if(!DB._pending) DB._errored=false; DB._updateSync(); })
        .catch(()=>{ DB._pending=Math.max(0,DB._pending-1); DB._errored=true; DB._updateSync(); });
    }
  },

  del:(k)=>{ try{ localStorage.removeItem('sms_'+k); }catch{} },

  _updateSync:()=>{
    const el=document.getElementById('sync-status');
    if(!el) return;
    if(DB._errored){
      el.textContent='⚠ Sync error'; el.className='sync-badge sync-error';
      el.title='Some changes failed to save to cloud. Check your connection.';
    } else if(DB._pending>0){
      el.textContent='↑ Saving...'; el.className='sync-badge sync-saving';
      el.title='Saving changes to cloud...';
    } else {
      el.textContent='✓ Saved'; el.className='sync-badge sync-ok';
      el.title='All changes saved to cloud';
    }
  },

  loadFromFirestore: async (sid)=>{
    if(!window.FDB) return;
    const cols=['students','staff','classes','subjects','feePayments','feeStructure',
      'exams','grades','attendance','events','messages','leaves','homework','books','expenses','payroll','auditLog','users'];
    const results=await Promise.all(cols.map(c=>FDB.getAll(sid,c).then(d=>({c,d}))));
    results.forEach(({c,d})=>{ if(d.length>0) try{ localStorage.setItem('sms_'+c,JSON.stringify(d)); }catch(e){} });
    const school=await FDB.getSchoolProfile(sid);
    if(school) try{ localStorage.setItem('sms_school',JSON.stringify(school)); }catch(e){}
  },
};

const uid=(p='')=>p+Date.now().toString(36)+Math.random().toString(36).slice(2,6);

// ── PASSWORD HASHING (PBKDF2 via Web Crypto — no plain-text passwords stored) ──
// Format stored: "pbkdf2:<hex-salt>:<hex-hash>"
// Legacy SHA-256 hashes (no prefix) are detected and migrated on next login.
const _pbkdf2 = async (pwd, saltBytes) => {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pwd), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name:'PBKDF2', hash:'SHA-256', salt:saltBytes, iterations:200000 }, key, 256);
  return Array.from(new Uint8Array(bits)).map(b=>b.toString(16).padStart(2,'0')).join('');
};
const hashPassword = async (pwd) => {
  const saltBytes = crypto.getRandomValues(new Uint8Array(16));
  const saltHex   = Array.from(saltBytes).map(b=>b.toString(16).padStart(2,'0')).join('');
  const hash      = await _pbkdf2(pwd, saltBytes);
  return `pbkdf2:${saltHex}:${hash}`;
};
const verifyPassword = async (pwd, stored) => {
  if (!stored) return false;
  if (!stored.startsWith('pbkdf2:')) {
    // Legacy unsalted SHA-256 — verify and caller should re-hash on success
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(pwd));
    const hex = Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('');
    return hex === stored;
  }
  const [, saltHex, expectedHash] = stored.split(':');
  const saltBytes = new Uint8Array(saltHex.match(/.{2}/g).map(h=>parseInt(h,16)));
  const actualHash = await _pbkdf2(pwd, saltBytes);
  return actualHash === expectedHash;
};

// ── XSS SANITIZATION — escape user-supplied strings before innerHTML injection ──
const sanitize = (str) => {
  if(str == null) return '';
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#x27;').replace(/\//g,'&#x2F;');
};

// ── GLOBAL STATE (currency / term / year / grading) ──
let _currency='GHS';
let _currentTerm='2';
let _academicYear='2025/2026';
let _passMark=50;
let _gradeSystem='percentage';

const SYMS={GHS:'₵',NGN:'₦',KES:'KSh ',USD:'$',GBP:'£',ZAR:'R ',EUR:'€'};
const fmt=(n)=>(SYMS[_currency]||'₵')+(+n||0).toLocaleString('en',{minimumFractionDigits:2,maximumFractionDigits:2});
const fmtDate=(s)=>{ if(!s) return '—'; const d=new Date(s); return d.toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}); };

// Always returns "YYYY-MM-DD" in the device's LOCAL timezone — never UTC midnight drift
const localDateStr=(d=new Date())=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;

const gradeFromScore=(s,max=100)=>{
  const p=s/max*100; const pm=_passMark||50;
  if(_gradeSystem==='gpa'){ if(p>=90)return'4.0';if(p>=80)return'3.0';if(p>=70)return'2.0';if(p>=pm)return'1.0';return'0.0'; }
  if(p>=80)return'A';if(p>=70)return'B';if(p>=60)return'C';if(p>=pm)return'D';return'F';
};

const statusBadge=(s)=>{
  const map={active:'badge-success',inactive:'badge-neutral',graduated:'badge-brand',suspended:'badge-danger',
    pending:'badge-warn',approved:'badge-success',rejected:'badge-danger',completed:'badge-brand',
    upcoming:'badge-info',available:'badge-success',borrowed:'badge-warn'};
  return`<span class="badge ${map[s]||'badge-neutral'}">${s}</span>`;
};

// ── YEAR-AWARE FEE HELPERS ──
const getYearFees=(s,year)=>{
  if(!s?.feesPaid) return {term1:0,term2:0,term3:0};
  if(typeof s.feesPaid.term1==='number') return s.feesPaid;
  return s.feesPaid[year]||{term1:0,term2:0,term3:0};
};

// Derive enrollTerm from admitDate vs a year's exact term date ranges
const getEnrollTermFromDate=(admitDate,yearStr)=>{
  if(!admitDate) return String(_currentTerm);
  const school=DB.get('school',{});
  const yEntry=(school.academicYears||[]).find(y=>y.year===yearStr)||{};
  const admit=new Date(admitDate+'T00:00:00');
  for(let t=1;t<=3;t++){
    const key=`t${t}`;
    const ts=yEntry[`${key}Start`]?new Date(yEntry[`${key}Start`]+'T00:00:00'):null;
    const te=yEntry[`${key}End`]?new Date(yEntry[`${key}End`]+'T23:59:59'):null;
    if(ts&&te&&admit>=ts&&admit<=te) return String(t);
  }
  for(let t=1;t<=3;t++){
    const ts=yEntry[`t${t}Start`]?new Date(yEntry[`t${t}Start`]+'T00:00:00'):null;
    if(ts&&admit<=ts) return String(t);
  }
  if(yEntry.t1Start) return '1';
  return String(_currentTerm);
};

const getYearStructure=(classId,year)=>{
  const all=DB.get('feeStructure',[]);
  return all.find(f=>f.classId===classId&&f.year===year)
    ||all.find(f=>f.classId===classId&&!f.year)
    ||null;
};

const getAllAcademicYears=()=>{
  const school=DB.get('school',{});
  const years=school.academicYears||[];
  if(!years.length) return [{year:school.academicYear||'2025/2026',isCurrent:true}];
  return [...years].sort((a,b)=>b.year.localeCompare(a.year));
};

// ── MIGRATIONS (run once, idempotent) ──
function migrateToYearFees(){
  const school=DB.get('school',{});
  const year=school.academicYear||'2025/2026';
  const students=DB.get('students',[]);
  let sc=false;
  students.forEach(s=>{
    if(s.feesPaid&&typeof s.feesPaid.term1==='number'){
      s.feesPaid={[year]:{term1:+(s.feesPaid.term1||0),term2:+(s.feesPaid.term2||0),term3:+(s.feesPaid.term3||0)}};
      sc=true;
    }
  });
  if(sc) DB.set('students',students);
  const fs=DB.get('feeStructure',[]);
  let fsc=false;
  fs.forEach(f=>{if(!f.year){f.year=year;fsc=true;}});
  if(fsc) DB.set('feeStructure',fs);
  const payments=DB.get('feePayments',[]);
  let fpc=false;
  payments.forEach(p=>{if(!p.academicYear){p.academicYear=year;fpc=true;}});
  if(fpc) DB.set('feePayments',payments);
  if(!school.academicYears||!school.academicYears.length){
    school.academicYears=[{year,isCurrent:true,label:year}];
    DB.set('school',school);
  }
}

function migrateEnrollTerm(){
  const students = DB.get('students', []);
  let changed = false;
  students.forEach(s => {
    if(!s.enrollTerm){ s.enrollTerm = '1'; changed = true; }
  });
  if(changed) DB.set('students', students);
}

// ── DEMO SEED DATA ──
function seedData(){
  if(DB.get('seeded')) return;

  // ── Dynamic date helpers — all dates relative to today so demo never goes stale ──
  const _now = new Date();
  // Return "YYYY-MM-DD" for today + N days (negative = past)
  const _d = (n=0) => {
    const dt = new Date(_now.getFullYear(), _now.getMonth(), _now.getDate() + n);
    return localDateStr(dt);
  };
  // Return "YYYY-MM-DD" for month offset M (0=current, -1=last, +1=next), on given day
  const _mo = (m, day=15) => {
    const dt = new Date(_now.getFullYear(), _now.getMonth() + m, day);
    return localDateStr(dt);
  };
  const _today = _d(0);

  // ── School-week dates (Mon–Fri of the current or most-recent school week) ──
  const _dow = _now.getDay(); // 0=Sun,1=Mon,...,6=Sat
  const _daysToMon = _dow === 0 ? 6 : _dow === 6 ? 5 : _dow - 1;
  const _mon  = _d(-_daysToMon);
  const _tue  = _d(-_daysToMon + 1);
  const _wed  = _d(-_daysToMon + 2);
  const _thu  = _d(-_daysToMon + 3);
  const _fri  = _d(-_daysToMon + 4);
  // Previous school week
  const _pmon = _d(-_daysToMon - 7);
  const _ptue = _d(-_daysToMon - 6);
  const _pwed = _d(-_daysToMon - 5);
  const _pthu = _d(-_daysToMon - 4);
  const _pfri = _d(-_daysToMon - 3);
  // Week before that
  const _p2mon = _d(-_daysToMon - 14);
  const _p2wed = _d(-_daysToMon - 12);
  const _p2fri = _d(-_daysToMon - 10);

  DB.set('school',{name:'Bright Future Academy',motto:'Excellence in All Things',phone:'+233 24 123 4567',email:'info@bfa.edu.gh',website:'www.bfa.edu.gh',country:'GH',address:'45 Education Ave, Accra, Ghana',currency:'GHS',academicYear:'2025/2026',currentTerm:'2',gradeSystem:'percentage',passMark:50,type:'k12',
    academicYears:[
      {year:'2023/2024',isCurrent:false,label:'2023/2024',startDate:'2023-09-01',endDate:'2024-07-31'},
      {year:'2024/2025',isCurrent:false,label:'2024/2025',startDate:'2024-09-01',endDate:'2025-07-31'},
      {year:'2025/2026',isCurrent:true, label:'2025/2026',startDate:'2025-09-01',endDate:'2026-07-31',
        t1Start:'2025-09-01',t1End:'2025-11-30',t2Start:'2026-01-05',t2End:'2026-04-04',t3Start:'2026-04-20',t3End:'2026-07-25'},
    ]});

  DB.set('users',[{id:'admin',email:'demo@brightfutureacademy.edu.gh',name:'Dr. Emmanuel Owusu',role:'admin',phone:'+233 24 000 1111',createdAt:new Date().toISOString(),lastLogin:null}]);

  DB.set('classes',[
    {id:'cls1',name:'Class 1',level:'Primary 1',teacherId:'stf1',capacity:35,room:'Room 1'},
    {id:'cls2',name:'Class 2',level:'Primary 2',teacherId:'stf2',capacity:35,room:'Room 2'},
    {id:'cls3',name:'Class 3',level:'Primary 3',teacherId:'stf3',capacity:35,room:'Room 3'},
    {id:'cls4',name:'Class 4',level:'Primary 4',teacherId:'stf4',capacity:35,room:'Room 4'},
    {id:'cls5',name:'Class 5',level:'Primary 5',teacherId:'stf5',capacity:35,room:'Room 5'},
    {id:'cls6',name:'Class 6',level:'Primary 6',teacherId:'stf6',capacity:35,room:'Room 6'},
    {id:'cls7',name:'JHS 1',level:'Junior High 1',teacherId:'stf7',capacity:40,room:'Room 7'},
    {id:'cls8',name:'JHS 2',level:'Junior High 2',teacherId:'stf8',capacity:40,room:'Room 8'},
    {id:'cls9',name:'JHS 3',level:'Junior High 3',teacherId:'stf9',capacity:40,room:'Room 9'},
  ]);

  DB.set('staff',[
    {id:'stf1',fname:'Abena',lname:'Asante',role:'teacher',dept:'Primary',subjects:'English, Reading',phone:'+233 24 111 2222',email:'abena@bfa.edu.gh',gender:'Female',salary:2850,status:'active',joinDate:'2020-01-15',qualification:'B.Ed'},
    {id:'stf2',fname:'Kwame',lname:'Boateng',role:'teacher',dept:'Primary',subjects:'Mathematics',phone:'+233 24 222 3333',email:'kwame@bfa.edu.gh',gender:'Male',salary:2780,status:'active',joinDate:'2019-09-01',qualification:'B.Ed'},
    {id:'stf3',fname:'Ama',lname:'Nyarko',role:'teacher',dept:'Primary',subjects:'Science, RME',phone:'+233 24 333 4444',email:'ama@bfa.edu.gh',gender:'Female',salary:2950,status:'active',joinDate:'2021-01-10',qualification:'B.Sc.Ed'},
    {id:'stf4',fname:'Kofi',lname:'Mensah',role:'teacher',dept:'Primary',subjects:'Social Studies',phone:'+233 24 444 5555',email:'kofi@bfa.edu.gh',gender:'Male',salary:2650,status:'active',joinDate:'2022-01-05',qualification:'Cert. A'},
    {id:'stf5',fname:'Akosua',lname:'Darko',role:'teacher',dept:'Primary',subjects:'ICT, Creative Arts',phone:'+233 24 555 6666',email:'akosua@bfa.edu.gh',gender:'Female',salary:3050,status:'active',joinDate:'2020-09-01',qualification:'B.Sc CS'},
    {id:'stf6',fname:'Yaw',lname:'Amoah',role:'teacher',dept:'Primary',subjects:'Mathematics, Science',phone:'+233 24 666 7777',email:'yaw@bfa.edu.gh',gender:'Male',salary:2920,status:'active',joinDate:'2021-09-01',qualification:'B.Ed'},
    {id:'stf7',fname:'Efua',lname:'Owusu',role:'teacher',dept:'JHS',subjects:'English Language',phone:'+233 24 777 8888',email:'efua@bfa.edu.gh',gender:'Female',salary:3250,status:'active',joinDate:'2018-01-15',qualification:'M.Ed'},
    {id:'stf8',fname:'Nana',lname:'Acheampong',role:'teacher',dept:'JHS',subjects:'Mathematics, Physics',phone:'+233 24 888 9999',email:'nana@bfa.edu.gh',gender:'Male',salary:3480,status:'active',joinDate:'2017-09-01',qualification:'M.Sc'},
    {id:'stf9',fname:'Adjoa',lname:'Frimpong',role:'teacher',dept:'JHS',subjects:'Social Studies, History',phone:'+233 24 999 0000',email:'adjoa@bfa.edu.gh',gender:'Female',salary:3120,status:'active',joinDate:'2019-01-10',qualification:'B.A'},
    {id:'stf10',fname:'Osei',lname:'Bonsu',role:'admin',dept:'Administration',subjects:'',phone:'+233 24 010 1010',email:'osei@bfa.edu.gh',gender:'Male',salary:3650,status:'active',joinDate:'2016-01-01',qualification:'MBA'},
  ]);

  // ── Fee amounts by class for 2025/2026 ──
  // cls1-2: 650 | cls3-4: 700 | cls5-6: 750 | cls7-8: 900 | cls9: 950
  // _t1 = term 1 paid (all paid fully) | _t2 = term 2 paid (some partial / unpaid = defaulters)
  const _t1=[900,900,900,900,950,950,750,750,750,750,700,700,700,700,650,650,650,650];
  const _t2=[900,900,700,  0,950,250,750,750,750,750,700,700,700,700,650,  0,650,400];

  const sdata=[
    ['Kwadwo','Osei','cls7','Male','2012-03-15','Patrick Osei','+233 24 101 2020'],
    ['Ama','Kusi','cls7','Female','2012-07-22','Bernard Kusi','+233 24 202 3030'],
    ['Yaw','Agyemang','cls8','Male','2011-11-08','Samuel Agyemang','+233 24 303 4040'],
    ['Akua','Mensah','cls8','Female','2011-05-30','Joseph Mensah','+233 24 404 5050'],
    ['Kofi','Asante','cls9','Male','2010-09-18','Francis Asante','+233 24 505 6060'],
    ['Abena','Boateng','cls9','Female','2010-01-25','Richard Boateng','+233 24 606 7070'],
    ['Kwesi','Darko','cls6','Male','2013-06-12','Thomas Darko','+233 24 707 8080'],
    ['Efua','Owusu','cls6','Female','2013-04-03','Emmanuel Owusu','+233 24 808 9090'],
    ['Kojo','Frimpong','cls5','Male','2014-08-20','Alex Frimpong','+233 24 909 0101'],
    ['Adjoa','Nyarko','cls5','Female','2014-12-15','George Nyarko','+233 24 121 3131'],
    ['Kwame','Amoah','cls4','Male','2015-02-28','Daniel Amoah','+233 24 141 5151'],
    ['Ama','Acheampong','cls4','Female','2015-07-10','Peter Acheampong','+233 24 161 7171'],
    ['Yaw','Tetteh','cls3','Male','2016-05-14','Samuel Tetteh','+233 24 181 9191'],
    ['Akosua','Boateng','cls3','Female','2016-09-20','James Boateng','+233 24 202 1212'],
    ['Kweku','Asare','cls2','Male','2017-03-08','Frank Asare','+233 24 222 3232'],
    ['Abena','Quaye','cls2','Female','2017-11-25','Paul Quaye','+233 24 242 5252'],
    ['Nana','Opoku','cls1','Male','2018-07-15','Charles Opoku','+233 24 262 7272'],
    ['Adwoa','Mensah','cls1','Female','2018-01-30','Ben Mensah','+233 24 282 9292'],
  ];
  DB.set('students',sdata.map((s,i)=>({
    id:'stu'+(i+1),studentId:'BFA-2025-'+String(i+101).padStart(4,'0'),
    fname:s[0],lname:s[1],classId:s[2],gender:s[3],dob:s[4],
    dadName:s[5],dadPhone:s[6],status:'active',
    admitDate: i>=16 ? _mo(0,5) : i>=14 ? _mo(-1,10) : '2025-09-05',
    address:'Accra, Ghana',
    feesPaid:{'2025/2026':{term1:_t1[i],term2:_t2[i],term3:0},'2024/2025':{term1:_t1[i],term2:_t1[i],term3:_t1[i]}},
  })));

  DB.set('subjects',[
    {id:'subj1',name:'English Language',code:'ENG',classId:'cls7',teacherId:'stf7',periods:6},
    {id:'subj2',name:'Mathematics',code:'MATH',classId:'cls7',teacherId:'stf8',periods:6},
    {id:'subj3',name:'Social Studies',code:'SOC',classId:'cls7',teacherId:'stf9',periods:4},
    {id:'subj4',name:'Integrated Science',code:'SCI',classId:'cls8',teacherId:'stf3',periods:5},
    {id:'subj5',name:'ICT',code:'ICT',classId:'cls8',teacherId:'stf5',periods:3},
    {id:'subj6',name:'RME',code:'RME',classId:'cls9',teacherId:'stf3',periods:3},
    {id:'subj7',name:'Mathematics',code:'MATH',classId:'cls8',teacherId:'stf8',periods:6},
    {id:'subj8',name:'English Language',code:'ENG',classId:'cls9',teacherId:'stf7',periods:6},
  ]);

  DB.set('feeStructure',[
    {id:'fs1',classId:'cls1',year:'2025/2026',term1:650,term2:650,term3:650},{id:'fs2',classId:'cls2',year:'2025/2026',term1:650,term2:650,term3:650},
    {id:'fs3',classId:'cls3',year:'2025/2026',term1:700,term2:700,term3:700},{id:'fs4',classId:'cls4',year:'2025/2026',term1:700,term2:700,term3:700},
    {id:'fs5',classId:'cls5',year:'2025/2026',term1:750,term2:750,term3:750},{id:'fs6',classId:'cls6',year:'2025/2026',term1:750,term2:750,term3:750},
    {id:'fs7',classId:'cls7',year:'2025/2026',term1:900,term2:900,term3:900},{id:'fs8',classId:'cls8',year:'2025/2026',term1:900,term2:900,term3:900},
    {id:'fs9',classId:'cls9',year:'2025/2026',term1:950,term2:950,term3:950},
    {id:'fs1p',classId:'cls1',year:'2024/2025',term1:600,term2:600,term3:600},{id:'fs2p',classId:'cls2',year:'2024/2025',term1:600,term2:600,term3:600},
    {id:'fs7p',classId:'cls7',year:'2024/2025',term1:850,term2:850,term3:850},{id:'fs8p',classId:'cls8',year:'2024/2025',term1:850,term2:850,term3:850},
  ]);

  // ── Fee Payments — 6 months of history ending today (drives chart + KPI + today strip) ──
  // Receipt numbers are static for display consistency; amounts produce an upward trend.
  DB.set('feePayments',[
    // ── 5 months ago ─────────────────────────────────────────────────────────────────
    {id:uid('fp'),studentId:'stu5', term:'1',amount:950, method:'bank',  date:_mo(-5,8), by:'Admin',receiptNo:'REC-001',academicYear:'2025/2026'},
    {id:uid('fp'),studentId:'stu7', term:'1',amount:750, method:'cash',  date:_mo(-5,12),by:'Admin',receiptNo:'REC-002',academicYear:'2025/2026'},
    {id:uid('fp'),studentId:'stu9', term:'1',amount:750, method:'mobile',date:_mo(-5,15),by:'Admin',receiptNo:'REC-003',academicYear:'2025/2026'},
    {id:uid('fp'),studentId:'stu11',term:'1',amount:700, method:'cash',  date:_mo(-5,20),by:'Admin',receiptNo:'REC-004',academicYear:'2025/2026'},
    // ── 4 months ago ─────────────────────────────────────────────────────────────────
    {id:uid('fp'),studentId:'stu1', term:'1',amount:900, method:'bank',  date:_mo(-4,5), by:'Admin',receiptNo:'REC-005',academicYear:'2025/2026'},
    {id:uid('fp'),studentId:'stu2', term:'1',amount:900, method:'mobile',date:_mo(-4,8), by:'Admin',receiptNo:'REC-006',academicYear:'2025/2026'},
    {id:uid('fp'),studentId:'stu3', term:'1',amount:900, method:'cash',  date:_mo(-4,12),by:'Admin',receiptNo:'REC-007',academicYear:'2025/2026'},
    {id:uid('fp'),studentId:'stu13',term:'1',amount:700, method:'bank',  date:_mo(-4,18),by:'Admin',receiptNo:'REC-008',academicYear:'2025/2026'},
    {id:uid('fp'),studentId:'stu15',term:'1',amount:650, method:'cash',  date:_mo(-4,22),by:'Admin',receiptNo:'REC-009',academicYear:'2025/2026'},
    // ── 3 months ago ─────────────────────────────────────────────────────────────────
    {id:uid('fp'),studentId:'stu4', term:'1',amount:900, method:'bank',  date:_mo(-3,6), by:'Admin',receiptNo:'REC-010',academicYear:'2025/2026'},
    {id:uid('fp'),studentId:'stu6', term:'1',amount:950, method:'mobile',date:_mo(-3,9), by:'Admin',receiptNo:'REC-011',academicYear:'2025/2026'},
    {id:uid('fp'),studentId:'stu8', term:'1',amount:750, method:'cash',  date:_mo(-3,11),by:'Admin',receiptNo:'REC-012',academicYear:'2025/2026'},
    {id:uid('fp'),studentId:'stu10',term:'1',amount:750, method:'bank',  date:_mo(-3,15),by:'Admin',receiptNo:'REC-013',academicYear:'2025/2026'},
    {id:uid('fp'),studentId:'stu12',term:'1',amount:700, method:'cash',  date:_mo(-3,20),by:'Admin',receiptNo:'REC-014',academicYear:'2025/2026'},
    {id:uid('fp'),studentId:'stu14',term:'1',amount:700, method:'mobile',date:_mo(-3,24),by:'Admin',receiptNo:'REC-015',academicYear:'2025/2026'},
    // ── 2 months ago ─────────────────────────────────────────────────────────────────
    {id:uid('fp'),studentId:'stu16',term:'1',amount:650, method:'cash',  date:_mo(-2,5), by:'Admin',receiptNo:'REC-016',academicYear:'2025/2026'},
    {id:uid('fp'),studentId:'stu17',term:'1',amount:650, method:'bank',  date:_mo(-2,8), by:'Admin',receiptNo:'REC-017',academicYear:'2025/2026'},
    {id:uid('fp'),studentId:'stu18',term:'1',amount:650, method:'mobile',date:_mo(-2,10),by:'Admin',receiptNo:'REC-018',academicYear:'2025/2026'},
    {id:uid('fp'),studentId:'stu2', term:'2',amount:900, method:'bank',  date:_mo(-2,18),by:'Admin',receiptNo:'REC-019',academicYear:'2025/2026'},
    {id:uid('fp'),studentId:'stu5', term:'2',amount:950, method:'mobile',date:_mo(-2,22),by:'Admin',receiptNo:'REC-020',academicYear:'2025/2026'},
    // ── 1 month ago ──────────────────────────────────────────────────────────────────
    {id:uid('fp'),studentId:'stu7', term:'2',amount:750, method:'cash',  date:_mo(-1,4), by:'Admin',receiptNo:'REC-021',academicYear:'2025/2026'},
    {id:uid('fp'),studentId:'stu8', term:'2',amount:750, method:'bank',  date:_mo(-1,6), by:'Admin',receiptNo:'REC-022',academicYear:'2025/2026'},
    {id:uid('fp'),studentId:'stu9', term:'2',amount:750, method:'mobile',date:_mo(-1,10),by:'Admin',receiptNo:'REC-023',academicYear:'2025/2026'},
    {id:uid('fp'),studentId:'stu10',term:'2',amount:750, method:'cash',  date:_mo(-1,12),by:'Admin',receiptNo:'REC-024',academicYear:'2025/2026'},
    {id:uid('fp'),studentId:'stu11',term:'2',amount:700, method:'bank',  date:_mo(-1,15),by:'Admin',receiptNo:'REC-025',academicYear:'2025/2026'},
    {id:uid('fp'),studentId:'stu12',term:'2',amount:700, method:'mobile',date:_mo(-1,18),by:'Admin',receiptNo:'REC-026',academicYear:'2025/2026'},
    {id:uid('fp'),studentId:'stu13',term:'2',amount:700, method:'cash',  date:_mo(-1,22),by:'Admin',receiptNo:'REC-027',academicYear:'2025/2026'},
    // ── This month ───────────────────────────────────────────────────────────────────
    {id:uid('fp'),studentId:'stu14',term:'2',amount:700, method:'bank',  date:_mo(0,3),  by:'Admin',receiptNo:'REC-028',academicYear:'2025/2026'},
    {id:uid('fp'),studentId:'stu15',term:'2',amount:650, method:'cash',  date:_mo(0,5),  by:'Admin',receiptNo:'REC-029',academicYear:'2025/2026'},
    {id:uid('fp'),studentId:'stu17',term:'2',amount:650, method:'mobile',date:_mo(0,8),  by:'Admin',receiptNo:'REC-030',academicYear:'2025/2026'},
    {id:uid('fp'),studentId:'stu18',term:'2',amount:400, method:'cash',  date:_mo(0,10), by:'Admin',receiptNo:'REC-031',academicYear:'2025/2026'},
    // ── TODAY — drives "Collected Today" strip ────────────────────────────────────────
    {id:uid('fp'),studentId:'stu1', term:'2',amount:900, method:'cash',  date:_today,    by:'Admin',receiptNo:'REC-032',academicYear:'2025/2026'},
    {id:uid('fp'),studentId:'stu3', term:'2',amount:700, method:'mobile',date:_today,    by:'Admin',receiptNo:'REC-033',academicYear:'2025/2026'},
    {id:uid('fp'),studentId:'stu6', term:'2',amount:250, method:'cash',  date:_today,    by:'Admin',receiptNo:'REC-034',academicYear:'2025/2026'},
  ]);

  // ── Attendance — current & prior school weeks with academicYear/term for term calc ──
  DB.set('attendance',[
    // Week before last
    {id:uid('a'),date:_p2mon,classId:'cls7',present:7,absent:1,late:0,total:8,academicYear:'2025/2026',term:'2'},
    {id:uid('a'),date:_p2wed,classId:'cls8',present:6,absent:2,late:0,total:8,academicYear:'2025/2026',term:'2'},
    {id:uid('a'),date:_p2fri,classId:'cls9',present:6,absent:1,late:0,total:7,academicYear:'2025/2026',term:'2'},
    // Last school week (Mon–Fri)
    {id:uid('a'),date:_pmon,classId:'cls7',present:8,absent:0,late:0,total:8,academicYear:'2025/2026',term:'2'},
    {id:uid('a'),date:_pmon,classId:'cls8',present:6,absent:2,late:0,total:8,academicYear:'2025/2026',term:'2'},
    {id:uid('a'),date:_ptue,classId:'cls7',present:7,absent:1,late:0,total:8,academicYear:'2025/2026',term:'2'},
    {id:uid('a'),date:_ptue,classId:'cls9',present:7,absent:0,late:0,total:7,academicYear:'2025/2026',term:'2'},
    {id:uid('a'),date:_pwed,classId:'cls7',present:6,absent:1,late:1,total:8,academicYear:'2025/2026',term:'2'},
    {id:uid('a'),date:_pwed,classId:'cls8',present:7,absent:1,late:0,total:8,academicYear:'2025/2026',term:'2'},
    {id:uid('a'),date:_pthu,classId:'cls7',present:8,absent:0,late:0,total:8,academicYear:'2025/2026',term:'2'},
    {id:uid('a'),date:_pthu,classId:'cls8',present:5,absent:2,late:1,total:8,academicYear:'2025/2026',term:'2'},
    {id:uid('a'),date:_pthu,classId:'cls9',present:7,absent:0,late:0,total:7,academicYear:'2025/2026',term:'2'},
    {id:uid('a'),date:_pfri,classId:'cls7',present:8,absent:0,late:0,total:8,academicYear:'2025/2026',term:'2'},
    {id:uid('a'),date:_pfri,classId:'cls8',present:8,absent:0,late:0,total:8,academicYear:'2025/2026',term:'2'},
    // Current school week (Mon–Fri if weekday, else fills last school week)
    {id:uid('a'),date:_mon,classId:'cls7',present:7,absent:1,late:0,total:8,academicYear:'2025/2026',term:'2'},
    {id:uid('a'),date:_mon,classId:'cls8',present:6,absent:2,late:0,total:8,academicYear:'2025/2026',term:'2'},
    {id:uid('a'),date:_tue,classId:'cls7',present:8,absent:0,late:0,total:8,academicYear:'2025/2026',term:'2'},
    {id:uid('a'),date:_tue,classId:'cls8',present:7,absent:1,late:0,total:8,academicYear:'2025/2026',term:'2'},
    {id:uid('a'),date:_tue,classId:'cls9',present:6,absent:1,late:0,total:7,academicYear:'2025/2026',term:'2'},
    {id:uid('a'),date:_wed,classId:'cls7',present:6,absent:1,late:1,total:8,academicYear:'2025/2026',term:'2'},
    {id:uid('a'),date:_wed,classId:'cls9',present:7,absent:0,late:0,total:7,academicYear:'2025/2026',term:'2'},
    {id:uid('a'),date:_thu,classId:'cls7',present:7,absent:1,late:0,total:8,academicYear:'2025/2026',term:'2'},
    {id:uid('a'),date:_thu,classId:'cls8',present:8,absent:0,late:0,total:8,academicYear:'2025/2026',term:'2'},
    {id:uid('a'),date:_fri,classId:'cls7',present:8,absent:0,late:0,total:8,academicYear:'2025/2026',term:'2'},
    {id:uid('a'),date:_fri,classId:'cls8',present:6,absent:2,late:0,total:8,academicYear:'2025/2026',term:'2'},
    {id:uid('a'),date:_fri,classId:'cls9',present:5,absent:2,late:0,total:7,academicYear:'2025/2026',term:'2'},
    // Today — drives "Absent Today" quick-view panel
    {id:uid('a'),date:_today,classId:'cls7',present:6,absent:2,late:0,total:8,academicYear:'2025/2026',term:'2'},
    {id:uid('a'),date:_today,classId:'cls8',present:7,absent:1,late:0,total:8,academicYear:'2025/2026',term:'2'},
    {id:uid('a'),date:_today,classId:'cls9',present:5,absent:2,late:0,total:7,academicYear:'2025/2026',term:'2'},
  ]);

  // ── Exams — all upcoming relative to today ──
  DB.set('exams',[
    {id:'ex1',name:'Mathematics Class Quiz',type:'quiz',      classId:'cls7',subjectId:'subj2',date:_d(4), maxScore:50, term:'2',duration:45, status:'upcoming'},
    {id:'ex2',name:'English Language Assignment',type:'assignment',classId:'cls9',subjectId:'subj8',date:_d(8), maxScore:30, term:'2',duration:0,  status:'upcoming'},
    {id:'ex3',name:'Term 2 Mid-Term — English', type:'midterm',  classId:'cls7',subjectId:'subj1',date:_d(16),maxScore:100,term:'2',duration:90, status:'upcoming'},
    {id:'ex4',name:'Term 2 Mid-Term — Mathematics',type:'midterm',classId:'cls7',subjectId:'subj2',date:_d(17),maxScore:100,term:'2',duration:90, status:'upcoming'},
    {id:'ex5',name:'Integrated Science Test',  type:'quiz',      classId:'cls8',subjectId:'subj4',date:_d(22),maxScore:50, term:'2',duration:60, status:'upcoming'},
    {id:'ex6',name:'End of Term 2 Examination',type:'endterm',   classId:'cls9',subjectId:'subj8',date:_d(45),maxScore:100,term:'2',duration:120,status:'upcoming'},
  ]);

  DB.set('grades',[
    {id:uid('g'),examId:'ex1',studentId:'stu1',score:44},{id:uid('g'),examId:'ex1',studentId:'stu2',score:38},
    {id:uid('g'),examId:'ex2',studentId:'stu1',score:88},{id:uid('g'),examId:'ex2',studentId:'stu2',score:72},
    {id:uid('g'),examId:'ex3',studentId:'stu3',score:36},{id:uid('g'),examId:'ex3',studentId:'stu4',score:41},
    {id:uid('g'),examId:'ex4',studentId:'stu5',score:26},{id:uid('g'),examId:'ex4',studentId:'stu6',score:24},
  ]);

  // ── Events — all future dates relative to today ──
  DB.set('events',[
    {id:'ev1',title:'All-Staff Monthly Meeting',     type:'meeting', start:_d(5),  venue:'Conference Room',  desc:'Monthly all-staff meeting with departmental reviews and performance updates.'},
    {id:'ev2',title:'Science & Technology Fair',     type:'academic',start:_d(12), venue:'School Field',     desc:'Annual science and technology exhibition showcasing student projects from all JHS classes.'},
    {id:'ev3',title:'Inter-School Sports Day',       type:'sports',  start:_d(20), venue:'Sports Complex',   desc:'Annual sports competition with neighboring schools. All students are invited to participate.'},
    {id:'ev4',title:'Easter Holiday',               type:'holiday', start:_d(28), end:_d(31), venue:'',     desc:'School closed for Easter holiday. Classes resume the following Tuesday.'},
    {id:'ev5',title:'End of Term 2 Examinations',   type:'exam',    start:_d(44), end:_d(55), venue:'All Classrooms', desc:'End of Term 2 examinations for all classes. Timetable to be distributed by class teachers.'},
    {id:'ev6',title:"Parents' Day & Prize-Giving",  type:'academic',start:_d(65), venue:'School Auditorium', desc:'Annual parents day and prize-giving ceremony. All parents and guardians are warmly invited.'},
  ]);

  DB.set('messages',[
    {id:'msg1',from:'Dr. Emmanuel Owusu',fromId:'admin',to:'all-staff',subject:'Staff Meeting — This Friday',body:'This is a reminder that our monthly staff meeting will be held this Friday at 2:00 PM in the conference room.\n\nAll staff are required to attend. Please come prepared with your departmental reports.',date:new Date().toISOString(),read:false,tab:'inbox'},
    {id:'msg2',from:'Nana Acheampong',fromId:'stf8',to:'admin',subject:'Mathematics Mid-Term Schedule',body:'Dear Administrator,\n\nI have prepared the mid-term examination schedule for JHS 1 and JHS 2. Mathematics will be on Day 2.\n\nAll papers are ready for printing.',date:new Date(Date.now()-86400000).toISOString(),read:true,tab:'inbox'},
    {id:'msg3',from:'Dr. Emmanuel Owusu',fromId:'admin',to:'all-parents',subject:'Term 2 Fee Payment Reminder',body:"Dear Parent/Guardian,\n\nThis is a friendly reminder that Term 2 school fees are due by end of this month.\n\nKindly ensure payment is made promptly to avoid any disruption to your ward's academic activities.\n\nBank: GCB Bank · Account: 1234567890 · Name: Bright Future Academy\n\nThank you.",date:new Date(Date.now()-172800000).toISOString(),read:true,tab:'sent'},
  ]);

  // ── Leaves — stf2 currently on sick leave (active today), stf5 on maternity ──
  DB.set('leaves',[
    {id:uid('l'),staffId:'stf2',type:'Sick',     from:_d(-3),       to:_d(3),         days:6, reason:'Medical treatment and recovery',   status:'approved', appliedDate:new Date(Date.now()-4*86400000).toISOString()},
    {id:uid('l'),staffId:'stf5',type:'Maternity',from:_mo(-1,1),   to:_mo(2,30),     days:90,reason:'Maternity leave',                   status:'approved', appliedDate:new Date(Date.now()-40*86400000).toISOString()},
    {id:uid('l'),staffId:'stf1',type:'Annual',   from:_d(14),       to:_d(16),        days:3, reason:'Family commitment — Easter break',  status:'pending',  appliedDate:new Date().toISOString()},
  ]);

  DB.set('homework',[
    {id:uid('hw'),title:'Essay — My Dream School',classId:'cls7',subjectId:'subj1',dueDate:_d(5),  desc:'Write a 400-word essay on "My Dream School". Focus on clear paragraph structure and vocabulary.',status:'pending',  assignedBy:'stf7',assignedDate:new Date().toISOString()},
    {id:uid('hw'),title:'Algebra Problem Set — Chapter 7',classId:'cls7',subjectId:'subj2',dueDate:_d(3),  desc:'Complete exercises 1–20 on page 87. Show all workings clearly.',status:'submitted',assignedBy:'stf8',assignedDate:new Date(Date.now()-86400000).toISOString()},
    {id:uid('hw'),title:'Science Lab Report — Photosynthesis',classId:'cls8',subjectId:'subj4',dueDate:_d(7),  desc:'Write a complete lab report for the photosynthesis experiment. Include hypothesis, method, results and conclusion.',status:'graded',   assignedBy:'stf3',assignedDate:new Date(Date.now()-172800000).toISOString()},
  ]);

  DB.set('books',[
    {id:uid('b'),isbn:'978-0-06-112008-4',title:'To Kill a Mockingbird',     author:'Harper Lee',     category:'Literature', copies:5, available:3},
    {id:uid('b'),isbn:'978-0-7432-7356-5',title:'The Alchemist',             author:'Paulo Coelho',   category:'Fiction',    copies:8, available:6},
    {id:uid('b'),isbn:'978-0-19-853453-4',title:'New Oxford Mathematics JHS',author:'Various',        category:'Textbook',   copies:40,available:32},
    {id:uid('b'),isbn:'978-9988-0-1820-1',title:'Ghana Science for JHS',     author:'CRDD',           category:'Textbook',   copies:35,available:35},
    {id:uid('b'),isbn:'978-0-521-01234-5',title:'Cambridge English Grammar', author:'Cambridge Press', category:'Reference',  copies:20,available:18},
    {id:uid('b'),isbn:'978-1-4444-5555-6',title:'Social Studies for West Africa',author:'Macmillan',  category:'Textbook',   copies:30,available:28},
    {id:uid('b'),isbn:'978-9988-1-2222-3',title:'ICT for Senior High',       author:'GES',            category:'Textbook',   copies:12,available:9},
    {id:uid('b'),isbn:'978-0-333-12345-6',title:'RME for JHS',               author:'Adinkra Press',  category:'Textbook',   copies:22,available:19},
  ]);

  DB.set('expenses',[
    {id:uid('e'),date:_mo(-3,15),category:'Utilities',   desc:'Electricity bill — monthly',           amount:1200,paidTo:'ECG Ghana',         approvedBy:'Admin'},
    {id:uid('e'),date:_mo(-2,1), category:'Supplies',    desc:'Textbooks and stationery — Term 2',    amount:8500,paidTo:'Ghana Book Trust',   approvedBy:'Admin'},
    {id:uid('e'),date:_mo(-2,15),category:'Maintenance', desc:'Roof repairs — Block A classroom',     amount:3200,paidTo:'Mensah Contractors', approvedBy:'Admin'},
    {id:uid('e'),date:_mo(-1,1), category:'Sports',      desc:'Sports equipment purchase',            amount:2100,paidTo:'Sports Depot Ghana', approvedBy:'Admin'},
    {id:uid('e'),date:_mo(-1,10),category:'Utilities',   desc:'Water bill — monthly',                 amount:450, paidTo:'GWCL',              approvedBy:'Admin'},
    {id:uid('e'),date:_mo(0,1),  category:'Salaries',    desc:'Staff salaries — current month',       amount:32000,paidTo:'All Staff',        approvedBy:'Admin'},
    {id:uid('e'),date:_d(-5),    category:'Supplies',    desc:'Exam stationery — answer booklets',    amount:780, paidTo:'Office Supplies Ltd',approvedBy:'Admin'},
  ]);

  DB.set('auditLog',[]);
  DB.set('payroll',[]);
  DB.set('timetable',{
    cls7:{
      Monday:   {'7:30-8:30':{subject:'English',teacher:'E. Owusu'},'8:30-9:30':{subject:'Mathematics',teacher:'N. Acheampong'},'9:30-10:30':{subject:'Social Studies',teacher:'A. Frimpong'},'10:30-11:00':{subject:'BREAK',teacher:''},'11:00-12:00':{subject:'Science',teacher:'A. Nyarko'},'12:00-1:00':{subject:'ICT',teacher:'A. Darko'}},
      Tuesday:  {'7:30-8:30':{subject:'Mathematics',teacher:'N. Acheampong'},'8:30-9:30':{subject:'English',teacher:'E. Owusu'},'9:30-10:30':{subject:'RME',teacher:'A. Nyarko'},'10:30-11:00':{subject:'BREAK',teacher:''},'11:00-12:00':{subject:'Social Studies',teacher:'A. Frimpong'},'12:00-1:00':{subject:'PE',teacher:'Y. Amoah'}},
      Wednesday:{'7:30-8:30':{subject:'Science',teacher:'A. Nyarko'},'8:30-9:30':{subject:'Mathematics',teacher:'N. Acheampong'},'9:30-10:30':{subject:'English',teacher:'E. Owusu'},'10:30-11:00':{subject:'BREAK',teacher:''},'11:00-12:00':{subject:'History',teacher:'A. Frimpong'},'12:00-1:00':{subject:'Creative Arts',teacher:'A. Darko'}},
      Thursday: {'7:30-8:30':{subject:'Mathematics',teacher:'N. Acheampong'},'8:30-9:30':{subject:'Social Studies',teacher:'A. Frimpong'},'9:30-10:30':{subject:'Science',teacher:'A. Nyarko'},'10:30-11:00':{subject:'BREAK',teacher:''},'11:00-12:00':{subject:'English',teacher:'E. Owusu'},'12:00-1:00':{subject:'ICT',teacher:'A. Darko'}},
      Friday:   {'7:30-8:30':{subject:'RME',teacher:'A. Nyarko'},'8:30-9:30':{subject:'English',teacher:'E. Owusu'},'9:30-10:30':{subject:'Mathematics',teacher:'N. Acheampong'},'10:30-11:00':{subject:'BREAK',teacher:''},'11:00-12:00':{subject:'PE',teacher:'Y. Amoah'},'12:00-1:00':{subject:'Assembly',teacher:'All'}},
    },
    cls8:{
      Monday:   {'7:30-8:30':{subject:'Mathematics',teacher:'N. Acheampong'},'8:30-9:30':{subject:'Integrated Science',teacher:'A. Nyarko'},'9:30-10:30':{subject:'English',teacher:'E. Owusu'},'10:30-11:00':{subject:'BREAK',teacher:''},'11:00-12:00':{subject:'ICT',teacher:'A. Darko'},'12:00-1:00':{subject:'Social Studies',teacher:'A. Frimpong'}},
      Tuesday:  {'7:30-8:30':{subject:'English',teacher:'E. Owusu'},'8:30-9:30':{subject:'Mathematics',teacher:'N. Acheampong'},'9:30-10:30':{subject:'Creative Arts',teacher:'A. Darko'},'10:30-11:00':{subject:'BREAK',teacher:''},'11:00-12:00':{subject:'Science',teacher:'A. Nyarko'},'12:00-1:00':{subject:'RME',teacher:'A. Nyarko'}},
      Wednesday:{'7:30-8:30':{subject:'Social Studies',teacher:'A. Frimpong'},'8:30-9:30':{subject:'English',teacher:'E. Owusu'},'9:30-10:30':{subject:'Mathematics',teacher:'N. Acheampong'},'10:30-11:00':{subject:'BREAK',teacher:''},'11:00-12:00':{subject:'PE',teacher:'Y. Amoah'},'12:00-1:00':{subject:'ICT',teacher:'A. Darko'}},
      Thursday: {'7:30-8:30':{subject:'Science',teacher:'A. Nyarko'},'8:30-9:30':{subject:'Social Studies',teacher:'A. Frimpong'},'9:30-10:30':{subject:'English',teacher:'E. Owusu'},'10:30-11:00':{subject:'BREAK',teacher:''},'11:00-12:00':{subject:'Mathematics',teacher:'N. Acheampong'},'12:00-1:00':{subject:'History',teacher:'A. Frimpong'}},
      Friday:   {'7:30-8:30':{subject:'PE',teacher:'Y. Amoah'},'8:30-9:30':{subject:'Mathematics',teacher:'N. Acheampong'},'9:30-10:30':{subject:'Science',teacher:'A. Nyarko'},'10:30-11:00':{subject:'BREAK',teacher:''},'11:00-12:00':{subject:'English',teacher:'E. Owusu'},'12:00-1:00':{subject:'Assembly',teacher:'All'}},
    },
    cls9:{
      Monday:   {'7:30-8:30':{subject:'English Language',teacher:'E. Owusu'},'8:30-9:30':{subject:'Mathematics',teacher:'N. Acheampong'},'9:30-10:30':{subject:'History',teacher:'A. Frimpong'},'10:30-11:00':{subject:'BREAK',teacher:''},'11:00-12:00':{subject:'RME',teacher:'A. Nyarko'},'12:00-1:00':{subject:'ICT',teacher:'A. Darko'}},
      Tuesday:  {'7:30-8:30':{subject:'Mathematics',teacher:'N. Acheampong'},'8:30-9:30':{subject:'Science',teacher:'A. Nyarko'},'9:30-10:30':{subject:'English Language',teacher:'E. Owusu'},'10:30-11:00':{subject:'BREAK',teacher:''},'11:00-12:00':{subject:'Social Studies',teacher:'A. Frimpong'},'12:00-1:00':{subject:'Creative Arts',teacher:'A. Darko'}},
      Wednesday:{'7:30-8:30':{subject:'Science',teacher:'A. Nyarko'},'8:30-9:30':{subject:'English Language',teacher:'E. Owusu'},'9:30-10:30':{subject:'Mathematics',teacher:'N. Acheampong'},'10:30-11:00':{subject:'BREAK',teacher:''},'11:00-12:00':{subject:'ICT',teacher:'A. Darko'},'12:00-1:00':{subject:'PE',teacher:'Y. Amoah'}},
      Thursday: {'7:30-8:30':{subject:'Social Studies',teacher:'A. Frimpong'},'8:30-9:30':{subject:'Mathematics',teacher:'N. Acheampong'},'9:30-10:30':{subject:'RME',teacher:'A. Nyarko'},'10:30-11:00':{subject:'BREAK',teacher:''},'11:00-12:00':{subject:'English Language',teacher:'E. Owusu'},'12:00-1:00':{subject:'Science',teacher:'A. Nyarko'}},
      Friday:   {'7:30-8:30':{subject:'History',teacher:'A. Frimpong'},'8:30-9:30':{subject:'English Language',teacher:'E. Owusu'},'9:30-10:30':{subject:'Mathematics',teacher:'N. Acheampong'},'10:30-11:00':{subject:'BREAK',teacher:''},'11:00-12:00':{subject:'PE',teacher:'Y. Amoah'},'12:00-1:00':{subject:'Assembly',teacher:'All'}},
    },
  });

  DB.set('seeded',true);
}