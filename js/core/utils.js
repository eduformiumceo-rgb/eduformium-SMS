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
    results.forEach(({c,d})=>{ if(d.length>0) localStorage.setItem('sms_'+c,JSON.stringify(d)); });
    const school=await FDB.getSchoolProfile(sid);
    if(school) localStorage.setItem('sms_school',JSON.stringify(school));
  },
};

const uid=(p='')=>p+Date.now().toString(36)+Math.random().toString(36).slice(2,6);

// ── PASSWORD HASHING (SHA-256 via Web Crypto — no plain-text passwords stored) ──
const hashPassword = async (pwd) => {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(pwd));
  return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('');
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
  DB.set('school',{name:'Bright Future Academy',motto:'Excellence in All Things',phone:'+233 24 123 4567',email:'info@bfa.edu.gh',website:'www.bfa.edu.gh',country:'GH',address:'45 Education Ave, Accra, Ghana',currency:'GHS',academicYear:'2025/2026',currentTerm:'2',gradeSystem:'percentage',passMark:50,type:'k12',
    academicYears:[
      {year:'2023/2024',isCurrent:false,label:'2023/2024',startDate:'2023-09-01',endDate:'2024-07-31'},
      {year:'2024/2025',isCurrent:false,label:'2024/2025',startDate:'2024-09-01',endDate:'2025-07-31'},
      {year:'2025/2026',isCurrent:true, label:'2025/2026',startDate:'2025-09-01',endDate:'2026-07-31'},
    ]});
  hashPassword('BFA@demo2026').then(hash=>{
    DB.set('users',[{id:'admin',email:'demo@brightfutureacademy.edu.gh',passwordHash:hash,name:'Dr. Emmanuel Owusu',role:'admin',phone:'+233 24 000 1111',createdAt:new Date().toISOString(),lastLogin:null}]);
  });
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
    dadName:s[5],dadPhone:s[6],status:'active',admitDate:'2024-09-01',
    address:'Accra, Ghana',
    feesPaid:{'2025/2026':{term1:i%3===0?0:850,term2:i%4===0?0:i%5===0?400:850,term3:0},'2024/2025':{term1:850,term2:850,term3:850}},
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
  DB.set('feePayments',[
    {id:uid('fp'),studentId:'stu1',term:'1',amount:850,method:'cash',date:'2025-01-10',by:'Admin',receiptNo:'REC-001',academicYear:'2025/2026'},
    {id:uid('fp'),studentId:'stu2',term:'1',amount:850,method:'mobile',date:'2025-01-12',by:'Admin',receiptNo:'REC-002',academicYear:'2025/2026'},
    {id:uid('fp'),studentId:'stu3',term:'1',amount:850,method:'bank',date:'2025-01-15',by:'Admin',receiptNo:'REC-003',academicYear:'2025/2026'},
    {id:uid('fp'),studentId:'stu5',term:'1',amount:900,method:'cash',date:'2025-01-11',by:'Admin',receiptNo:'REC-004',academicYear:'2025/2026'},
    {id:uid('fp'),studentId:'stu2',term:'2',amount:850,method:'mobile',date:'2025-02-05',by:'Admin',receiptNo:'REC-005',academicYear:'2025/2026'},
    {id:uid('fp'),studentId:'stu7',term:'1',amount:750,method:'cash',date:'2025-01-20',by:'Admin',receiptNo:'REC-006',academicYear:'2025/2026'},
    {id:uid('fp'),studentId:'stu1',term:'1',amount:600,method:'cash',date:'2024-09-10',by:'Admin',receiptNo:'REC-P001',academicYear:'2024/2025'},
    {id:uid('fp'),studentId:'stu2',term:'1',amount:600,method:'mobile',date:'2024-09-12',by:'Admin',receiptNo:'REC-P002',academicYear:'2024/2025'},
    {id:uid('fp'),studentId:'stu1',term:'2',amount:600,method:'cash',date:'2025-01-09',by:'Admin',receiptNo:'REC-P003',academicYear:'2024/2025'},
  ]);
  DB.set('exams',[
    {id:'ex1',name:'Term 2 Mid-Term',type:'midterm',classId:'cls7',subjectId:'subj1',date:'2025-03-15',maxScore:100,term:'2',duration:90,status:'completed'},
    {id:'ex2',name:'Term 2 Mid-Term',type:'midterm',classId:'cls7',subjectId:'subj2',date:'2025-03-16',maxScore:100,term:'2',duration:90,status:'completed'},
    {id:'ex3',name:'End of Term Exam',type:'endterm',classId:'cls7',subjectId:'subj1',date:'2025-05-20',maxScore:100,term:'2',duration:120,status:'upcoming'},
    {id:'ex4',name:'Class Quiz',type:'quiz',classId:'cls8',subjectId:'subj4',date:'2025-02-10',maxScore:50,term:'2',duration:30,status:'completed'},
    {id:'ex5',name:'Assignment 1',type:'assignment',classId:'cls9',subjectId:'subj8',date:'2025-03-01',maxScore:30,term:'2',duration:0,status:'completed'},
  ]);
  DB.set('grades',[
    {id:uid('g'),examId:'ex1',studentId:'stu1',score:82},{id:uid('g'),examId:'ex1',studentId:'stu2',score:74},
    {id:uid('g'),examId:'ex2',studentId:'stu1',score:91},{id:uid('g'),examId:'ex2',studentId:'stu2',score:68},
    {id:uid('g'),examId:'ex4',studentId:'stu3',score:38},{id:uid('g'),examId:'ex4',studentId:'stu4',score:42},
    {id:uid('g'),examId:'ex5',studentId:'stu5',score:26},{id:uid('g'),examId:'ex5',studentId:'stu6',score:24},
  ]);
  DB.set('attendance',[
    {id:uid('a'),date:new Date().toISOString().split('T')[0],classId:'cls7',present:6,absent:1,late:1,total:8},
    {id:uid('a'),date:new Date(Date.now()-86400000).toISOString().split('T')[0],classId:'cls7',present:7,absent:1,late:0,total:8},
    {id:uid('a'),date:new Date(Date.now()-172800000).toISOString().split('T')[0],classId:'cls8',present:5,absent:2,late:1,total:8},
  ]);
  DB.set('events',[
    {id:'ev1',title:"End of Term Exams",type:'exam',start:'2025-05-19',end:'2025-05-30',venue:'School Halls',desc:'End of Term 2 examinations for all classes.'},
    {id:'ev2',title:"Parents' Day & Prize-Giving",type:'academic',start:'2025-06-07',venue:'School Auditorium',desc:'Annual parents day and prize-giving ceremony.'},
    {id:'ev3',title:'Inter-School Sports Day',type:'sports',start:'2025-04-25',venue:'Sports Complex',desc:'Annual sports competition with neighboring schools.'},
    {id:'ev4',title:'Easter Holiday',type:'holiday',start:'2025-04-18',end:'2025-04-21',venue:'',desc:'School closed for Easter holiday.'},
    {id:'ev5',title:'All-Staff Monthly Meeting',type:'meeting',start:'2025-03-28',venue:'Conference Room',desc:'Monthly all-staff meeting and department reviews.'},
  ]);
  DB.set('messages',[
    {id:'msg1',from:'Dr. Emmanuel Owusu',fromId:'admin',to:'all-staff',subject:'Staff Meeting — Friday 28th March',body:'This is a reminder that our monthly staff meeting will be held on Friday 28th March at 2:00 PM in the conference room.\n\nAll staff are required to attend. Please come prepared with your departmental reports and any issues to raise.',date:new Date().toISOString(),read:false,tab:'inbox'},
    {id:'msg2',from:'Abena Asante',fromId:'stf1',to:'admin',subject:'Leave Application — April 5-7',body:'Dear Administrator,\n\nI respectfully apply for 3 days annual leave from April 5-7, 2025, due to a personal family commitment.\n\nI have arranged for Mrs. Nyarko to cover my classes during this period.\n\nThank you for your understanding.',date:new Date(Date.now()-86400000).toISOString(),read:true,tab:'inbox'},
    {id:'msg3',from:'Dr. Emmanuel Owusu',fromId:'admin',to:'all-parents',subject:'Term 2 Fee Payment Reminder',body:"Dear Parent/Guardian,\n\nThis is a friendly reminder that Term 2 school fees are due by 28th February 2025.\n\nKindly ensure payment is made promptly to avoid any disruption to your ward's academic activities.\n\nBank: GCB Bank · Account: 1234567890 · Name: Bright Future Academy\n\nThank you.",date:new Date(Date.now()-172800000).toISOString(),read:true,tab:'sent'},
  ]);
  DB.set('leaves',[
    {id:uid('l'),staffId:'stf1',type:'Annual',from:'2025-04-05',to:'2025-04-07',days:3,reason:'Family commitment',status:'pending',appliedDate:new Date().toISOString()},
    {id:uid('l'),staffId:'stf2',type:'Sick',from:'2025-03-01',to:'2025-03-02',days:2,reason:'Medical treatment',status:'approved',appliedDate:'2025-02-28T10:00:00.000Z'},
    {id:uid('l'),staffId:'stf5',type:'Maternity',from:'2025-06-01',to:'2025-08-31',days:90,reason:'Maternity leave',status:'approved',appliedDate:'2025-02-15T09:00:00.000Z'},
  ]);
  DB.set('homework',[
    {id:uid('hw'),title:'Chapter 5 Essay — My Future Career',classId:'cls7',subjectId:'subj1',dueDate:'2025-03-20',desc:'Write a 500-word essay on "My Future Career". Focus on language structure, vocabulary, and coherent paragraph formation.',status:'pending',assignedBy:'stf7',assignedDate:new Date().toISOString()},
    {id:uid('hw'),title:'Algebra Problem Set — Exercises 1-20',classId:'cls7',subjectId:'subj2',dueDate:'2025-03-19',desc:'Complete exercises 1-20 on page 87 of your Mathematics textbook. Show all workings.',status:'submitted',assignedBy:'stf8',assignedDate:new Date(Date.now()-86400000).toISOString()},
    {id:uid('hw'),title:'Science Lab Report',classId:'cls8',subjectId:'subj4',dueDate:'2025-03-22',desc:'Write a complete lab report for the photosynthesis experiment conducted in class.',status:'graded',assignedBy:'stf3',assignedDate:new Date(Date.now()-172800000).toISOString()},
  ]);
  DB.set('books',[
    {id:uid('b'),isbn:'978-0-06-112008-4',title:'To Kill a Mockingbird',author:'Harper Lee',category:'Literature',copies:5,available:3},
    {id:uid('b'),isbn:'978-0-7432-7356-5',title:'The Alchemist',author:'Paulo Coelho',category:'Fiction',copies:8,available:6},
    {id:uid('b'),isbn:'978-0-19-853453-4',title:'New Oxford Mathematics JHS',author:'Various',category:'Textbook',copies:40,available:32},
    {id:uid('b'),isbn:'978-9988-0-1820-1',title:'Ghana Science for JHS',author:'CRDD',category:'Textbook',copies:35,available:35},
    {id:uid('b'),isbn:'978-0-521-01234-5',title:'Cambridge English Grammar',author:'Cambridge Press',category:'Reference',copies:20,available:18},
    {id:uid('b'),isbn:'978-1-4444-5555-6',title:'Social Studies for West Africa',author:'Macmillan',category:'Textbook',copies:30,available:28},
  ]);
  DB.set('expenses',[
    {id:uid('e'),date:'2025-01-15',category:'Utilities',desc:'Electricity bill — January',amount:1200,paidTo:'ECG Ghana',approvedBy:'Admin'},
    {id:uid('e'),date:'2025-02-01',category:'Supplies',desc:'Textbooks and stationery Term 2',amount:8500,paidTo:'Ghana Book Trust',approvedBy:'Admin'},
    {id:uid('e'),date:'2025-02-15',category:'Maintenance',desc:'Roof repairs — Block A classroom',amount:3200,paidTo:'Mensah Contractors',approvedBy:'Admin'},
    {id:uid('e'),date:'2025-03-01',category:'Sports',desc:'Sports equipment purchase',amount:2100,paidTo:'Sports Depot Ghana',approvedBy:'Admin'},
    {id:uid('e'),date:'2025-03-10',category:'Utilities',desc:'Water bill — February',amount:450,paidTo:'GWCL',approvedBy:'Admin'},
    {id:uid('e'),date:'2025-03-15',category:'Salaries',desc:'Staff salaries — March',amount:32000,paidTo:'All Staff',approvedBy:'Admin'},
  ]);
  DB.set('auditLog',[]);
  DB.set('payroll',[]);
  DB.set('timetable',{
    cls7:{
      Monday:{'7:30-8:30':{subject:'English',teacher:'E. Owusu'},'8:30-9:30':{subject:'Mathematics',teacher:'N. Acheampong'},'9:30-10:30':{subject:'Social Studies',teacher:'A. Frimpong'},'10:30-11:00':{subject:'BREAK',teacher:''},'11:00-12:00':{subject:'Science',teacher:'A. Nyarko'},'12:00-1:00':{subject:'ICT',teacher:'A. Darko'}},
      Tuesday:{'7:30-8:30':{subject:'Mathematics',teacher:'N. Acheampong'},'8:30-9:30':{subject:'English',teacher:'E. Owusu'},'9:30-10:30':{subject:'RME',teacher:'A. Nyarko'},'10:30-11:00':{subject:'BREAK',teacher:''},'11:00-12:00':{subject:'Social Studies',teacher:'A. Frimpong'},'12:00-1:00':{subject:'PE',teacher:'Y. Amoah'}},
      Wednesday:{'7:30-8:30':{subject:'Science',teacher:'A. Nyarko'},'8:30-9:30':{subject:'Mathematics',teacher:'N. Acheampong'},'9:30-10:30':{subject:'English',teacher:'E. Owusu'},'10:30-11:00':{subject:'BREAK',teacher:''},'11:00-12:00':{subject:'History',teacher:'A. Frimpong'},'12:00-1:00':{subject:'Creative Arts',teacher:'A. Darko'}},
      Thursday:{'7:30-8:30':{subject:'Mathematics',teacher:'N. Acheampong'},'8:30-9:30':{subject:'Social Studies',teacher:'A. Frimpong'},'9:30-10:30':{subject:'Science',teacher:'A. Nyarko'},'10:30-11:00':{subject:'BREAK',teacher:''},'11:00-12:00':{subject:'English',teacher:'E. Owusu'},'12:00-1:00':{subject:'ICT',teacher:'A. Darko'}},
      Friday:{'7:30-8:30':{subject:'RME',teacher:'A. Nyarko'},'8:30-9:30':{subject:'English',teacher:'E. Owusu'},'9:30-10:30':{subject:'Mathematics',teacher:'N. Acheampong'},'10:30-11:00':{subject:'BREAK',teacher:''},'11:00-12:00':{subject:'PE',teacher:'Y. Amoah'},'12:00-1:00':{subject:'Assembly',teacher:'All'}},
    },
    cls8:{
      Monday:{'7:30-8:30':{subject:'Mathematics',teacher:'N. Acheampong'},'8:30-9:30':{subject:'Integrated Science',teacher:'A. Nyarko'},'9:30-10:30':{subject:'English',teacher:'E. Owusu'},'10:30-11:00':{subject:'BREAK',teacher:''},'11:00-12:00':{subject:'ICT',teacher:'A. Darko'},'12:00-1:00':{subject:'Social Studies',teacher:'A. Frimpong'}},
      Tuesday:{'7:30-8:30':{subject:'English',teacher:'E. Owusu'},'8:30-9:30':{subject:'Mathematics',teacher:'N. Acheampong'},'9:30-10:30':{subject:'Creative Arts',teacher:'A. Darko'},'10:30-11:00':{subject:'BREAK',teacher:''},'11:00-12:00':{subject:'Science',teacher:'A. Nyarko'},'12:00-1:00':{subject:'RME',teacher:'A. Nyarko'}},
      Wednesday:{'7:30-8:30':{subject:'Social Studies',teacher:'A. Frimpong'},'8:30-9:30':{subject:'English',teacher:'E. Owusu'},'9:30-10:30':{subject:'Mathematics',teacher:'N. Acheampong'},'10:30-11:00':{subject:'BREAK',teacher:''},'11:00-12:00':{subject:'PE',teacher:'Y. Amoah'},'12:00-1:00':{subject:'ICT',teacher:'A. Darko'}},
      Thursday:{'7:30-8:30':{subject:'Science',teacher:'A. Nyarko'},'8:30-9:30':{subject:'Social Studies',teacher:'A. Frimpong'},'9:30-10:30':{subject:'English',teacher:'E. Owusu'},'10:30-11:00':{subject:'BREAK',teacher:''},'11:00-12:00':{subject:'Mathematics',teacher:'N. Acheampong'},'12:00-1:00':{subject:'History',teacher:'A. Frimpong'}},
      Friday:{'7:30-8:30':{subject:'PE',teacher:'Y. Amoah'},'8:30-9:30':{subject:'Mathematics',teacher:'N. Acheampong'},'9:30-10:30':{subject:'Science',teacher:'A. Nyarko'},'10:30-11:00':{subject:'BREAK',teacher:''},'11:00-12:00':{subject:'English',teacher:'E. Owusu'},'12:00-1:00':{subject:'Assembly',teacher:'All'}},
    },
    cls9:{
      Monday:{'7:30-8:30':{subject:'English Language',teacher:'E. Owusu'},'8:30-9:30':{subject:'Mathematics',teacher:'N. Acheampong'},'9:30-10:30':{subject:'History',teacher:'A. Frimpong'},'10:30-11:00':{subject:'BREAK',teacher:''},'11:00-12:00':{subject:'RME',teacher:'A. Nyarko'},'12:00-1:00':{subject:'ICT',teacher:'A. Darko'}},
      Tuesday:{'7:30-8:30':{subject:'Mathematics',teacher:'N. Acheampong'},'8:30-9:30':{subject:'Science',teacher:'A. Nyarko'},'9:30-10:30':{subject:'English Language',teacher:'E. Owusu'},'10:30-11:00':{subject:'BREAK',teacher:''},'11:00-12:00':{subject:'Social Studies',teacher:'A. Frimpong'},'12:00-1:00':{subject:'Creative Arts',teacher:'A. Darko'}},
      Wednesday:{'7:30-8:30':{subject:'Science',teacher:'A. Nyarko'},'8:30-9:30':{subject:'English Language',teacher:'E. Owusu'},'9:30-10:30':{subject:'Mathematics',teacher:'N. Acheampong'},'10:30-11:00':{subject:'BREAK',teacher:''},'11:00-12:00':{subject:'ICT',teacher:'A. Darko'},'12:00-1:00':{subject:'PE',teacher:'Y. Amoah'}},
      Thursday:{'7:30-8:30':{subject:'Social Studies',teacher:'A. Frimpong'},'8:30-9:30':{subject:'Mathematics',teacher:'N. Acheampong'},'9:30-10:30':{subject:'RME',teacher:'A. Nyarko'},'10:30-11:00':{subject:'BREAK',teacher:''},'11:00-12:00':{subject:'English Language',teacher:'E. Owusu'},'12:00-1:00':{subject:'Science',teacher:'A. Nyarko'}},
      Friday:{'7:30-8:30':{subject:'History',teacher:'A. Frimpong'},'8:30-9:30':{subject:'English Language',teacher:'E. Owusu'},'9:30-10:30':{subject:'Mathematics',teacher:'N. Acheampong'},'10:30-11:00':{subject:'BREAK',teacher:''},'11:00-12:00':{subject:'PE',teacher:'Y. Amoah'},'12:00-1:00':{subject:'Assembly',teacher:'All'}},
    },
  });
  DB.set('seeded',true);
}
