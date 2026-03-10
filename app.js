// ══════════════════════════════════════════
//  EDUFORMIUM SCHOOL MANAGEMENT SYSTEM
//  © 2026 Eduformium · Shape Knowledge, Build Mastery
// ══════════════════════════════════════════

const DB = {
  get: (k, def=null)=>{ try{ const v=localStorage.getItem('sms_'+k); return v?JSON.parse(v):def; }catch{ return def; } },
  set: (k,v)=>{
    try{ localStorage.setItem('sms_'+k,JSON.stringify(v)); }catch{}
    const sid=window.SMS&&window.SMS.schoolId;
    if(sid&&k!=='session'&&k!=='seeded'&&k!=='darkMode'&&k!=='themeColors'&&k!=='fontSize'){
      if(k==='school') window.FDB&&FDB.saveSchoolProfile(sid,v).catch(()=>{});
      else if(Array.isArray(v)) window.FDB&&FDB.batchWrite(sid,k,v).catch(()=>{});
    }
  },
  del:(k)=>{ try{ localStorage.removeItem('sms_'+k); }catch{} },
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
let _currency='GHS';
let _currentTerm='2';
let _academicYear='2025/2026';
let _passMark=50;
let _gradeSystem='percentage';
const SYMS={GHS:'₵',NGN:'₦',KES:'KSh ',USD:'$',GBP:'£',ZAR:'R ',EUR:'€'};
const fmt=(n)=>(SYMS[_currency]||'₵')+(+n||0).toLocaleString('en',{minimumFractionDigits:2,maximumFractionDigits:2});
const fmtDate=(s)=>{ if(!s) return '—'; const d=new Date(s); return d.toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}); };
const gradeFromScore=(s,max=100)=>{
  const p=s/max*100; const pm=_passMark||50;
  if(_gradeSystem==='gpa'){ if(p>=90)return'4.0';if(p>=80)return'3.0';if(p>=70)return'2.0';if(p>=pm)return'1.0';return'0.0'; }
  if(p>=80)return'A';if(p>=70)return'B';if(p>=60)return'C';if(p>=pm)return'D';return'F';
};
const statusBadge=(s)=>{const map={active:'badge-success',inactive:'badge-neutral',graduated:'badge-brand',suspended:'badge-danger',pending:'badge-warn',approved:'badge-success',rejected:'badge-danger',completed:'badge-brand',upcoming:'badge-info',available:'badge-success',borrowed:'badge-warn'};return`<span class="badge ${map[s]||'badge-neutral'}">${s}</span>`;};

// ── YEAR-AWARE FEE HELPERS ──
// Get a student's paid amounts for a specific year (backward-compatible)
const getYearFees=(s,year)=>{
  if(!s?.feesPaid) return {term1:0,term2:0,term3:0};
  // Old flat format: feesPaid = {term1:N, term2:N, term3:N}
  if(typeof s.feesPaid.term1==='number') return s.feesPaid;
  return s.feesPaid[year]||{term1:0,term2:0,term3:0};
};
// Get fee structure for a class+year combo (backward-compatible)
const getYearStructure=(classId,year)=>{
  const all=DB.get('feeStructure',[]);
  return all.find(f=>f.classId===classId&&f.year===year)
    ||all.find(f=>f.classId===classId&&!f.year)
    ||null;
};
// Get all academic years sorted newest first
const getAllAcademicYears=()=>{
  const school=DB.get('school',{});
  const years=school.academicYears||[];
  if(!years.length) return [{year:school.academicYear||'2025/2026',isCurrent:true}];
  return [...years].sort((a,b)=>b.year.localeCompare(a.year));
};
// Migrate old flat feesPaid → year-keyed (runs once, idempotent)
function migrateToYearFees(){
  const school=DB.get('school',{});
  const year=school.academicYear||'2025/2026';
  // Students
  const students=DB.get('students',[]);
  let sc=false;
  students.forEach(s=>{
    if(s.feesPaid&&typeof s.feesPaid.term1==='number'){
      s.feesPaid={[year]:{term1:+(s.feesPaid.term1||0),term2:+(s.feesPaid.term2||0),term3:+(s.feesPaid.term3||0)}};
      sc=true;
    }
  });
  if(sc) DB.set('students',students);
  // feeStructure — add year field
  const fs=DB.get('feeStructure',[]);
  let fsc=false;
  fs.forEach(f=>{if(!f.year){f.year=year;fsc=true;}});
  if(fsc) DB.set('feeStructure',fs);
  // feePayments — add academicYear field
  const payments=DB.get('feePayments',[]);
  let fpc=false;
  payments.forEach(p=>{if(!p.academicYear){p.academicYear=year;fpc=true;}});
  if(fpc) DB.set('feePayments',payments);
  // Ensure academicYears list exists on school object
  if(!school.academicYears||!school.academicYears.length){
    school.academicYears=[{year,isCurrent:true,label:year}];
    DB.set('school',school);
  }
}
function seedData(){
  if(DB.get('seeded')) return;
  DB.set('school',{name:'Bright Future Academy',motto:'Excellence in All Things',phone:'+233 24 123 4567',email:'info@bfa.edu.gh',website:'www.bfa.edu.gh',country:'GH',address:'45 Education Ave, Accra, Ghana',currency:'GHS',academicYear:'2025/2026',currentTerm:'2',gradeSystem:'percentage',passMark:50,type:'k12',
    academicYears:[
      {year:'2023/2024',isCurrent:false,label:'2023/2024',startDate:'2023-09-01',endDate:'2024-07-31'},
      {year:'2024/2025',isCurrent:false,label:'2024/2025',startDate:'2024-09-01',endDate:'2025-07-31'},
      {year:'2025/2026',isCurrent:true, label:'2025/2026',startDate:'2025-09-01',endDate:'2026-07-31'},
    ]});
  // Store hashed password (SHA-256 of 'BFA@demo2026') — never plain text
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
    {id:'msg3',from:'Dr. Emmanuel Owusu',fromId:'admin',to:'all-parents',subject:'Term 2 Fee Payment Reminder',body:'Dear Parent/Guardian,\n\nThis is a friendly reminder that Term 2 school fees are due by 28th February 2025.\n\nKindly ensure payment is made promptly to avoid any disruption to your ward\'s academic activities.\n\nBank: GCB Bank · Account: 1234567890 · Name: Bright Future Academy\n\nThank you.',date:new Date(Date.now()-172800000).toISOString(),read:true,tab:'sent'},
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
    cls6:{
      Monday:{'7:30-8:30':{subject:'Mathematics',teacher:'Y. Amoah'},'8:30-9:30':{subject:'English',teacher:'A. Asante'},'9:30-10:30':{subject:'Science',teacher:'Y. Amoah'},'10:30-11:00':{subject:'BREAK',teacher:''},'11:00-12:00':{subject:'Social Studies',teacher:'K. Mensah'},'12:00-1:00':{subject:'Creative Arts',teacher:'A. Darko'}},
      Tuesday:{'7:30-8:30':{subject:'English',teacher:'A. Asante'},'8:30-9:30':{subject:'Mathematics',teacher:'Y. Amoah'},'9:30-10:30':{subject:'RME',teacher:'A. Nyarko'},'10:30-11:00':{subject:'BREAK',teacher:''},'11:00-12:00':{subject:'Science',teacher:'Y. Amoah'},'12:00-1:00':{subject:'PE',teacher:'Y. Amoah'}},
      Wednesday:{'7:30-8:30':{subject:'Science',teacher:'Y. Amoah'},'8:30-9:30':{subject:'English',teacher:'A. Asante'},'9:30-10:30':{subject:'Mathematics',teacher:'Y. Amoah'},'10:30-11:00':{subject:'BREAK',teacher:''},'11:00-12:00':{subject:'ICT',teacher:'A. Darko'},'12:00-1:00':{subject:'Social Studies',teacher:'K. Mensah'}},
      Thursday:{'7:30-8:30':{subject:'Social Studies',teacher:'K. Mensah'},'8:30-9:30':{subject:'Mathematics',teacher:'Y. Amoah'},'9:30-10:30':{subject:'English',teacher:'A. Asante'},'10:30-11:00':{subject:'BREAK',teacher:''},'11:00-12:00':{subject:'RME',teacher:'A. Nyarko'},'12:00-1:00':{subject:'Creative Arts',teacher:'A. Darko'}},
      Friday:{'7:30-8:30':{subject:'PE',teacher:'Y. Amoah'},'8:30-9:30':{subject:'English',teacher:'A. Asante'},'9:30-10:30':{subject:'Mathematics',teacher:'Y. Amoah'},'10:30-11:00':{subject:'BREAK',teacher:''},'11:00-12:00':{subject:'Science',teacher:'Y. Amoah'},'12:00-1:00':{subject:'Assembly',teacher:'All'}},
    },
    cls5:{
      Monday:{'7:30-8:30':{subject:'English',teacher:'A. Darko'},'8:30-9:30':{subject:'Mathematics',teacher:'A. Darko'},'9:30-10:30':{subject:'Science',teacher:'A. Nyarko'},'10:30-11:00':{subject:'BREAK',teacher:''},'11:00-12:00':{subject:'Social Studies',teacher:'K. Mensah'},'12:00-1:00':{subject:'Creative Arts',teacher:'A. Darko'}},
      Tuesday:{'7:30-8:30':{subject:'Mathematics',teacher:'A. Darko'},'8:30-9:30':{subject:'English',teacher:'A. Darko'},'9:30-10:30':{subject:'RME',teacher:'A. Nyarko'},'10:30-11:00':{subject:'BREAK',teacher:''},'11:00-12:00':{subject:'PE',teacher:'Y. Amoah'},'12:00-1:00':{subject:'Social Studies',teacher:'K. Mensah'}},
      Wednesday:{'7:30-8:30':{subject:'Science',teacher:'A. Nyarko'},'8:30-9:30':{subject:'Mathematics',teacher:'A. Darko'},'9:30-10:30':{subject:'English',teacher:'A. Darko'},'10:30-11:00':{subject:'BREAK',teacher:''},'11:00-12:00':{subject:'Creative Arts',teacher:'A. Darko'},'12:00-1:00':{subject:'RME',teacher:'A. Nyarko'}},
      Thursday:{'7:30-8:30':{subject:'Social Studies',teacher:'K. Mensah'},'8:30-9:30':{subject:'English',teacher:'A. Darko'},'9:30-10:30':{subject:'Mathematics',teacher:'A. Darko'},'10:30-11:00':{subject:'BREAK',teacher:''},'11:00-12:00':{subject:'Science',teacher:'A. Nyarko'},'12:00-1:00':{subject:'PE',teacher:'Y. Amoah'}},
      Friday:{'7:30-8:30':{subject:'RME',teacher:'A. Nyarko'},'8:30-9:30':{subject:'Mathematics',teacher:'A. Darko'},'9:30-10:30':{subject:'English',teacher:'A. Darko'},'10:30-11:00':{subject:'BREAK',teacher:''},'11:00-12:00':{subject:'Science',teacher:'A. Nyarko'},'12:00-1:00':{subject:'Assembly',teacher:'All'}},
    },
    cls4:{
      Monday:{'7:30-8:30':{subject:'English',teacher:'K. Mensah'},'8:30-9:30':{subject:'Mathematics',teacher:'K. Boateng'},'9:30-10:30':{subject:'Science',teacher:'A. Nyarko'},'10:30-11:00':{subject:'BREAK',teacher:''},'11:00-12:00':{subject:'Social Studies',teacher:'K. Mensah'},'12:00-1:00':{subject:'Creative Arts',teacher:'A. Darko'}},
      Tuesday:{'7:30-8:30':{subject:'Mathematics',teacher:'K. Boateng'},'8:30-9:30':{subject:'English',teacher:'K. Mensah'},'9:30-10:30':{subject:'RME',teacher:'A. Nyarko'},'10:30-11:00':{subject:'BREAK',teacher:''},'11:00-12:00':{subject:'PE',teacher:'Y. Amoah'},'12:00-1:00':{subject:'Science',teacher:'A. Nyarko'}},
      Wednesday:{'7:30-8:30':{subject:'Science',teacher:'A. Nyarko'},'8:30-9:30':{subject:'English',teacher:'K. Mensah'},'9:30-10:30':{subject:'Mathematics',teacher:'K. Boateng'},'10:30-11:00':{subject:'BREAK',teacher:''},'11:00-12:00':{subject:'Creative Arts',teacher:'A. Darko'},'12:00-1:00':{subject:'Social Studies',teacher:'K. Mensah'}},
      Thursday:{'7:30-8:30':{subject:'Social Studies',teacher:'K. Mensah'},'8:30-9:30':{subject:'Mathematics',teacher:'K. Boateng'},'9:30-10:30':{subject:'English',teacher:'K. Mensah'},'10:30-11:00':{subject:'BREAK',teacher:''},'11:00-12:00':{subject:'Science',teacher:'A. Nyarko'},'12:00-1:00':{subject:'RME',teacher:'A. Nyarko'}},
      Friday:{'7:30-8:30':{subject:'PE',teacher:'Y. Amoah'},'8:30-9:30':{subject:'English',teacher:'K. Mensah'},'9:30-10:30':{subject:'Mathematics',teacher:'K. Boateng'},'10:30-11:00':{subject:'BREAK',teacher:''},'11:00-12:00':{subject:'Creative Arts',teacher:'A. Darko'},'12:00-1:00':{subject:'Assembly',teacher:'All'}},
    },
    cls3:{
      Monday:{'7:30-8:30':{subject:'English',teacher:'A. Nyarko'},'8:30-9:30':{subject:'Mathematics',teacher:'K. Boateng'},'9:30-10:30':{subject:'Numeracy',teacher:'K. Boateng'},'10:30-11:00':{subject:'BREAK',teacher:''},'11:00-12:00':{subject:'Science',teacher:'A. Nyarko'},'12:00-1:00':{subject:'Handwriting',teacher:'A. Nyarko'}},
      Tuesday:{'7:30-8:30':{subject:'Mathematics',teacher:'K. Boateng'},'8:30-9:30':{subject:'English',teacher:'A. Nyarko'},'9:30-10:30':{subject:'RME',teacher:'A. Nyarko'},'10:30-11:00':{subject:'BREAK',teacher:''},'11:00-12:00':{subject:'Creative Arts',teacher:'A. Darko'},'12:00-1:00':{subject:'PE',teacher:'Y. Amoah'}},
      Wednesday:{'7:30-8:30':{subject:'Science',teacher:'A. Nyarko'},'8:30-9:30':{subject:'English',teacher:'A. Nyarko'},'9:30-10:30':{subject:'Mathematics',teacher:'K. Boateng'},'10:30-11:00':{subject:'BREAK',teacher:''},'11:00-12:00':{subject:'Social Studies',teacher:'K. Mensah'},'12:00-1:00':{subject:'Creative Arts',teacher:'A. Darko'}},
      Thursday:{'7:30-8:30':{subject:'Social Studies',teacher:'K. Mensah'},'8:30-9:30':{subject:'Mathematics',teacher:'K. Boateng'},'9:30-10:30':{subject:'English',teacher:'A. Nyarko'},'10:30-11:00':{subject:'BREAK',teacher:''},'11:00-12:00':{subject:'RME',teacher:'A. Nyarko'},'12:00-1:00':{subject:'Handwriting',teacher:'A. Nyarko'}},
      Friday:{'7:30-8:30':{subject:'PE',teacher:'Y. Amoah'},'8:30-9:30':{subject:'English',teacher:'A. Nyarko'},'9:30-10:30':{subject:'Mathematics',teacher:'K. Boateng'},'10:30-11:00':{subject:'BREAK',teacher:''},'11:00-12:00':{subject:'Science',teacher:'A. Nyarko'},'12:00-1:00':{subject:'Assembly',teacher:'All'}},
    },
    cls2:{
      Monday:{'7:30-8:30':{subject:'Literacy',teacher:'A. Asante'},'8:30-9:30':{subject:'Numeracy',teacher:'K. Boateng'},'9:30-10:30':{subject:'My World',teacher:'A. Asante'},'10:30-11:00':{subject:'BREAK',teacher:''},'11:00-12:00':{subject:'Creative Arts',teacher:'A. Darko'},'12:00-1:00':{subject:'PE',teacher:'Y. Amoah'}},
      Tuesday:{'7:30-8:30':{subject:'Numeracy',teacher:'K. Boateng'},'8:30-9:30':{subject:'Literacy',teacher:'A. Asante'},'9:30-10:30':{subject:'RME',teacher:'A. Nyarko'},'10:30-11:00':{subject:'BREAK',teacher:''},'11:00-12:00':{subject:'My World',teacher:'A. Asante'},'12:00-1:00':{subject:'Handwriting',teacher:'A. Asante'}},
      Wednesday:{'7:30-8:30':{subject:'My World',teacher:'A. Asante'},'8:30-9:30':{subject:'Numeracy',teacher:'K. Boateng'},'9:30-10:30':{subject:'Literacy',teacher:'A. Asante'},'10:30-11:00':{subject:'BREAK',teacher:''},'11:00-12:00':{subject:'Creative Arts',teacher:'A. Darko'},'12:00-1:00':{subject:'RME',teacher:'A. Nyarko'}},
      Thursday:{'7:30-8:30':{subject:'Literacy',teacher:'A. Asante'},'8:30-9:30':{subject:'My World',teacher:'A. Asante'},'9:30-10:30':{subject:'Numeracy',teacher:'K. Boateng'},'10:30-11:00':{subject:'BREAK',teacher:''},'11:00-12:00':{subject:'Handwriting',teacher:'A. Asante'},'12:00-1:00':{subject:'PE',teacher:'Y. Amoah'}},
      Friday:{'7:30-8:30':{subject:'PE',teacher:'Y. Amoah'},'8:30-9:30':{subject:'Literacy',teacher:'A. Asante'},'9:30-10:30':{subject:'Numeracy',teacher:'K. Boateng'},'10:30-11:00':{subject:'BREAK',teacher:''},'11:00-12:00':{subject:'Creative Arts',teacher:'A. Darko'},'12:00-1:00':{subject:'Assembly',teacher:'All'}},
    },
    cls1:{
      Monday:{'7:30-8:30':{subject:'Literacy',teacher:'A. Asante'},'8:30-9:30':{subject:'Numeracy',teacher:'K. Boateng'},'9:30-10:30':{subject:'My World',teacher:'A. Asante'},'10:30-11:00':{subject:'BREAK',teacher:''},'11:00-12:00':{subject:'Creative Arts',teacher:'A. Darko'},'12:00-1:00':{subject:'PE',teacher:'Y. Amoah'}},
      Tuesday:{'7:30-8:30':{subject:'Numeracy',teacher:'K. Boateng'},'8:30-9:30':{subject:'Literacy',teacher:'A. Asante'},'9:30-10:30':{subject:'RME',teacher:'A. Nyarko'},'10:30-11:00':{subject:'BREAK',teacher:''},'11:00-12:00':{subject:'My World',teacher:'A. Asante'},'12:00-1:00':{subject:'Drawing',teacher:'A. Darko'}},
      Wednesday:{'7:30-8:30':{subject:'My World',teacher:'A. Asante'},'8:30-9:30':{subject:'Literacy',teacher:'A. Asante'},'9:30-10:30':{subject:'Numeracy',teacher:'K. Boateng'},'10:30-11:00':{subject:'BREAK',teacher:''},'11:00-12:00':{subject:'Singing',teacher:'A. Darko'},'12:00-1:00':{subject:'Creative Arts',teacher:'A. Darko'}},
      Thursday:{'7:30-8:30':{subject:'Literacy',teacher:'A. Asante'},'8:30-9:30':{subject:'Numeracy',teacher:'K. Boateng'},'9:30-10:30':{subject:'RME',teacher:'A. Nyarko'},'10:30-11:00':{subject:'BREAK',teacher:''},'11:00-12:00':{subject:'Drawing',teacher:'A. Darko'},'12:00-1:00':{subject:'PE',teacher:'Y. Amoah'}},
      Friday:{'7:30-8:30':{subject:'PE',teacher:'Y. Amoah'},'8:30-9:30':{subject:'Literacy',teacher:'A. Asante'},'9:30-10:30':{subject:'Numeracy',teacher:'K. Boateng'},'10:30-11:00':{subject:'BREAK',teacher:''},'11:00-12:00':{subject:'Singing',teacher:'A. Darko'},'12:00-1:00':{subject:'Assembly',teacher:'All'}},
    },
  });
  DB.set('seeded',true);
}

// ══════════════════════════════════════════
//  MAIN APP
// ══════════════════════════════════════════
const SMS = {
  currentUser: null,
  schoolId: null,
  currentPage: 'dashboard',
  _demoMode: false,
  _formsBound: false,
  deleteCallback: null,

  _kpiSvg(type){
    const S='width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"';
    const currSym=_currency==='NGN'?'₦':_currency==='KES'?'KSh':_currency==='USD'?'$':_currency==='GBP'?'£':_currency==='ZAR'?'R':_currency==='EUR'?'€':'₵';
    const icons={
      students:`<svg ${S}><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3.53 1.76 9.47 1.76 12 0v-5"/></svg>`,
      staff:`<svg ${S}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
      classes:`<svg ${S}><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>`,
      fees:`<svg ${S}><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>`,
      check:`<svg ${S}><polyline points="20 6 9 17 4 12"/></svg>`,
      library:`<svg ${S}><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>`,
      transactions:`<svg ${S}><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>`,
      warning:`<svg ${S}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
      outstanding:`<svg ${S}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
      trending:`<svg ${S}><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>`,
      chart:`<svg ${S}><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>`,
      pending:`<svg ${S}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
      expenses:`<svg ${S}><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>`,
      category:`<svg ${S}><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>`,
    };
    return icons[type]||icons['chart'];
  },

  _charts: {},
  _calYear: new Date().getFullYear(),
  _calMonth: new Date().getMonth(),
  _studPage: 1,
  _staffPage: 1,
  _auditPage: 1,

  // Minimum ms the loading screen stays visible — ensures it's seen on fast/cached loads
  _loadStart: 0,
  _MIN_LOAD_MS: 1800,
  _afterLoad(fn) {
    const elapsed = Date.now() - this._loadStart;
    const remaining = Math.max(0, this._MIN_LOAD_MS - elapsed);
    if (remaining > 0) setTimeout(fn, remaining); else fn();
  },

  init() {
    this._loadStart = Date.now();
    if(!window.FAuth){ // fallback if Firebase didn't load
      // Do NOT seed demo data here - only seed in demo mode
      const school=DB.get('school',{});
      _currency=school.currency||'GHS';
      _currentTerm=school.currentTerm||'2';
      _academicYear=school.academicYear||'2025/2026';
      _passMark=school.passMark||50;
      _gradeSystem=school.gradeSystem||'percentage';
      migrateToYearFees();
      const session=DB.get('session');
      if(session){ const user=DB.get('users',[]).find(u=>u.id===session.userId); if(user){ this.currentUser=user; this._afterLoad(()=>this.boot()); return; } }
      this._afterLoad(()=>this.showLogin()); return;
    }
    // Keep loading overlay visible until Firebase confirms auth state
    document.getElementById('loading-overlay').style.display='flex';
    // Set persistence to LOCAL so session survives page refresh
    _auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(()=>{});
    FAuth.onAuthChange(async (firebaseUser)=>{
      if(this._demoMode) return;
      if(this._registering) return; // suppress during account creation
      if(firebaseUser){
        this.schoolId=firebaseUser.uid;
        // Clear leftover demo data before loading real account
        const _demoCols=['students','staff','classes','subjects','feePayments','feeStructure',
          'exams','grades','attendance','events','messages','leaves','homework','books',
          'expenses','payroll','auditLog','timetable','school','users'];
        _demoCols.forEach(c=>{try{localStorage.removeItem('sms_'+c);}catch{}});
        DB.del('seeded');
        try{ await DB.loadFromFirestore(this.schoolId); }catch(e){ /* offline or network error — local data used */ }
        try{ await Migration.run(this.schoolId); }catch(e){}
        // Approval gate — block anyone who is not explicitly 'active'
        const _sp = await FDB.getSchoolProfile(this.schoolId).catch(()=>null);
        const _spStatus = _sp?.status || 'pending';
        if(_spStatus === 'suspended'){
          this._afterLoad(()=>this.showSuspendedScreen(_sp, firebaseUser.email));
          return;
        }
        if(_spStatus !== 'active'){
          this._afterLoad(()=>this.showPendingScreen(_sp || {status:'pending', name:'', adminEmail:firebaseUser.email}, firebaseUser.email));
          return;
        }
        const school=DB.get('school',{});
        _currency=school.currency||'GHS';
        _currentTerm=school.currentTerm||'2';
        _academicYear=school.academicYear||'2025/2026';
        _passMark=school.passMark||50;
        _gradeSystem=school.gradeSystem||'percentage';
        migrateToYearFees();
        const users=DB.get('users',[]);
        this.currentUser=users.find(u=>u.id===this.schoolId)||{id:this.schoolId,name:school.adminName||firebaseUser.email,email:firebaseUser.email,role:'admin'};
        this._afterLoad(()=>this.boot());
      } else {
        this.schoolId=null; this.currentUser=null;
        // Only show login if pending/suspended screen is not already visible
        const _ps = document.getElementById('pending-screen');
        const _ss = document.getElementById('suspended-screen');
        const _psVisible = _ps && _ps.style.display !== 'none' && _ps.style.display !== '';
        const _ssVisible = _ss && _ss.style.display !== 'none' && _ss.style.display !== '';
        if(!_psVisible && !_ssVisible) {
          this._afterLoad(()=>this.showLogin());
        }
      }
    });
  },

  showLogin(){
    document.getElementById('loading-overlay').style.display='none';
    document.getElementById('login-screen').style.display='flex';
    document.getElementById('pending-screen').style.display='none';
    document.getElementById('suspended-screen').style.display='none';
    this.bindForms(); // bind login/register buttons
    PWABanner.tryShow();
  },

  showPendingScreen(profile, email){
    console.log('showPendingScreen called — status:', profile?.status, '| full profile:', JSON.stringify(profile));
    if(profile?.status === 'suspended') return this.showSuspendedScreen(profile, email);

    document.getElementById('loading-overlay').style.display='none';
    document.getElementById('login-screen').style.display='none';
    document.getElementById('app').style.display='none';
    document.getElementById('suspended-screen').style.display='none';
    const ps = document.getElementById('pending-screen');
    ps.style.display='block';
    ps.className = '';

    // Populate school info
    const schoolName = profile?.name || 'Your School';
    const adminEmail = profile?.adminEmail || profile?.email || email || '';
    document.getElementById('ps-school-name-display').textContent = schoolName;
    document.getElementById('ps-school-email-display').textContent = adminEmail;
    document.getElementById('ps-school-avatar').textContent = schoolName.charAt(0).toUpperCase();

    const waBtn = document.getElementById('ps-wa-btn');
    if(waBtn) waBtn.href = 'https://wa.me/233553774541?text=' + encodeURIComponent('Hello Eduformium, I just registered my school on Eduformium SMS and I am requesting account activation. School: ' + schoolName + '. Email: ' + adminEmail);

    const emailLinks = ps.querySelectorAll('a[href^="mailto"]');
    emailLinks.forEach(a => {
      a.href = 'mailto:eduformium.ceo@gmail.com?subject=' + encodeURIComponent('Account Activation Request - ' + schoolName) + '&body=' + encodeURIComponent('Hello,\n\nI would like to request activation for my school account.\nSchool: ' + schoolName + '\nEmail: ' + adminEmail);
    });

    const soBtn = document.getElementById('ps-signout-btn');
    if(soBtn) soBtn.onclick = ()=>{ if(window.FAuth) FAuth.logout(); ps.style.display='none'; this.showLogin(); };

    // Watch for status changes while user is on pending screen
    if(this._pendingUnsub) this._pendingUnsub();
    if(this.schoolId && window._db){
      this._pendingUnsub = window._db.collection('schools').doc(this.schoolId).onSnapshot(snap => {
        if(!snap.exists) return;
        const status = snap.data()?.status;
        console.log('[pendingListener] status from Firestore:', status);
        if(status === 'suspended'){
          if(this._pendingUnsub) this._pendingUnsub();
          this.showSuspendedScreen(snap.data(), email);
        }
      }, (err)=>{ console.warn('[pendingListener] error:', err.message); });
    }
  },

  showSuspendedScreen(profile, email){
    document.getElementById('loading-overlay').style.display='none';
    document.getElementById('login-screen').style.display='none';
    document.getElementById('pending-screen').style.display='none';
    document.getElementById('app').style.display='none';
    const ss = document.getElementById('suspended-screen');
    ss.style.display='block';

    // Populate school info
    const schoolName = profile?.name || 'Your School';
    const adminEmail = profile?.adminEmail || profile?.email || email || '';
    const nameEl = document.getElementById('ss-school-name');
    const emailEl = document.getElementById('ss-school-email');
    const avatarEl = document.getElementById('ss-school-avatar');
    if(nameEl) nameEl.textContent = schoolName;
    if(emailEl) emailEl.textContent = adminEmail;
    if(avatarEl) avatarEl.textContent = schoolName.charAt(0).toUpperCase();

    // WhatsApp button
    const waBtn = document.getElementById('ss-wa-btn');
    if(waBtn){
      const msg = encodeURIComponent('Hello Eduformium, my school account has been suspended on Eduformium SMS. School: ' + schoolName + '. Email: ' + adminEmail + '. Please help me restore access.');
      waBtn.href = 'https://wa.me/233553774541?text=' + msg;
    }

    // Email button
    const emailBtn = document.getElementById('ss-email-btn');
    if(emailBtn){
      const subj = 'Account Suspension - ' + schoolName;
      const body = 'Hello,\n\nMy school account has been suspended.\nSchool: ' + schoolName + '\nEmail: ' + adminEmail + '\n\nPlease help me restore access.';
      emailBtn.href = 'mailto:eduformium.ceo@gmail.com?subject=' + encodeURIComponent(subj) + '&body=' + encodeURIComponent(body);
    }

    // Sign out button
    const soBtn = document.getElementById('ss-signout-btn');
    if(soBtn) soBtn.onclick = ()=>{ if(window.FAuth) FAuth.logout(); ss.style.display='none'; this.showLogin(); };
  },

  boot(){
    document.getElementById('loading-overlay').style.display='none';
    document.getElementById('login-screen').style.display='none';
    const app=document.getElementById('app');
    app.style.display='grid';
    this.setupTopbar();
    this.bindNav();
    this.bindForms();
    this.loadTheme();
    this.checkAdminOnly();
    this.nav('dashboard');
    this.loadNotifications();
    // ── Real-time suspension listener ──
    // Watches Firestore for status changes while app is open
    if(this.schoolId && window._db){
      this._statusUnsub = window._db.collection('schools').doc(this.schoolId).onSnapshot(snap => {
        if(!snap.exists) return;
        const status = snap.data()?.status;
        if(status && status !== 'active'){
          // Status changed — kick them out immediately
          if(this._statusUnsub) this._statusUnsub();
          if(status === 'suspended'){
            this.showSuspendedScreen(snap.data(), this.currentUser?.email || '');
          } else {
            this.showPendingScreen(snap.data(), this.currentUser?.email || '');
          }
        }
      }, ()=>{}); // silently ignore listener errors (e.g. offline)
    }
  },

  setupTopbar(){
    const school=DB.get('school',{});
    document.getElementById('topbar-school-name').textContent=school.name||'School';
    document.getElementById('sb-school-name').textContent=school.name||'School';
    const u=this.currentUser;
    const initials=u.name.split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase();
    ['user-av','sb-user-av'].forEach(id=>{ const el=document.getElementById(id); if(el){ el.textContent=initials; if(u.avatar){ el.innerHTML=`<img src="${u.avatar}" style="width:100%;height:100%;border-radius:99px;object-fit:cover">`; } }});
    const el=document.getElementById('user-chip-name'); if(el) el.textContent=u.name.split(' ')[0];
    const er=document.getElementById('user-chip-role'); if(er) er.textContent=this.roleLabel(u.role);
    const sn=document.getElementById('sb-user-name'); if(sn) sn.textContent=u.name;
    const sr=document.getElementById('sb-user-role'); if(sr) sr.textContent=this.roleLabel(u.role);
    const av=document.getElementById('av-preview'); if(av){ av.textContent=initials; if(u.avatar) av.innerHTML=`<img src="${u.avatar}" style="width:100%;height:100%;border-radius:99px;object-fit:cover">`; }
    const h=new Date().getHours();
    const g=h<12?'Good morning':h<17?'Good afternoon':'Good evening';
    const dw=document.getElementById('dash-welcome'); if(dw) dw.textContent=`${g}, ${u.name.split(' ')[0]}! Here's your school overview.`;
    const heroToday=document.getElementById('dash-hero-today'); if(heroToday){ const dn=new Date(); heroToday.textContent=dn.toLocaleDateString('default',{day:'numeric',month:'short'}); } // legacy fallback
    // New hero elements
    const _sch=DB.get('school',{});
    const _dn=new Date();
    const hsn=document.getElementById('dash-hero-school-name'); if(hsn) hsn.textContent=_sch.name||'Eduformium SMS';
    const htf=document.getElementById('dash-hero-today-full'); if(htf) htf.textContent=_dn.toLocaleDateString('default',{weekday:'short',day:'numeric',month:'long',year:'numeric'});
    const hyr=document.getElementById('dash-hero-year'); if(hyr) hyr.textContent=_sch.academicYear||'—';
    const htr=document.getElementById('dash-hero-term'); if(htr) htr.textContent=_sch.currentTerm||'—';
  },

  roleLabel(r){ return {admin:'Administrator',teacher:'Teacher',accountant:'Accountant',librarian:'Librarian',staff:'Staff'}[r]||r; },

  checkAdminOnly(){
    const isAdmin=this.currentUser.role==='admin';
    document.querySelectorAll('.admin-only').forEach(el=>{ el.style.display=isAdmin?'':'none'; });
  },

  nav(page){
    document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active'));
    const pe=document.getElementById('page-'+page); if(pe) pe.classList.add('active');
    const ne=document.querySelector(`.nav-item[data-page="${page}"]`); if(ne) ne.classList.add('active');
    const tt=document.getElementById('topbar-title'); if(tt) tt.textContent=ne?.textContent.trim()||page;
    const schoolName=DB.get('school',{}).name||'Eduformium SMS';
    const pageName=ne?.textContent.trim()||page.charAt(0).toUpperCase()+page.slice(1);
    document.title=`${pageName} — ${schoolName}`;
    this.currentPage=page;
    document.getElementById('sidebar')?.classList.remove('open');
    document.getElementById('sidebar-overlay')?.classList.remove('show');
    document.body.classList.remove('sidebar-open');
    const loaders={dashboard:()=>this.loadDashboard(),students:()=>this.loadStudents(),classes:()=>this.loadClasses(),attendance:()=>this.loadAttendance(),exams:()=>this.loadExams(),timetable:()=>this.loadTimetable(),homework:()=>this.loadHomework(),staff:()=>this.loadStaff(),payroll:()=>this.loadPayroll(),leave:()=>this.loadLeave(),fees:()=>this.loadFees(),expenses:()=>this.loadExpenses(),messages:()=>this.loadMessages(),library:()=>this.loadLibrary(),events:()=>this.loadEvents(),reports:()=>{},audit:()=>this.renderAudit(),settings:()=>this.loadSettings()};
    if(loaders[page]) loaders[page]();
  },

  bindNav(){
    // ── Sidebar: unified open/close for all screen sizes ──
    const _openSidebar = () => {
      const sb = document.getElementById('sidebar');
      sb.classList.add('open');
      document.body.classList.add('sidebar-open');
      let ov = document.getElementById('sidebar-overlay');
      if(!ov){
        ov = document.createElement('div');
        ov.id = 'sidebar-overlay';
        ov.className = 'sidebar-overlay';
        document.body.appendChild(ov);
      }
      ov.classList.add('show');
      ov.onclick = _closeSidebar;
    };
    const _closeSidebar = () => {
      document.getElementById('sidebar')?.classList.remove('open');
      document.getElementById('sidebar-overlay')?.classList.remove('show');
      document.body.classList.remove('sidebar-open');
    };

    document.querySelectorAll('.nav-item[data-page]').forEach(item => item.addEventListener('click', () => {
      this.nav(item.dataset.page);
      _closeSidebar();
    }));
    document.getElementById('menu-btn')?.addEventListener('click', () => {
      const isOpen = document.getElementById('sidebar')?.classList.contains('open');
      isOpen ? _closeSidebar() : _openSidebar();
    });
    document.getElementById('sb-close')?.addEventListener('click', _closeSidebar);
    document.getElementById('user-chip')?.addEventListener('click',()=>this.nav('settings'));
    document.getElementById('sb-user-card')?.addEventListener('click',()=>this.nav('settings'));
    document.getElementById('logout-btn')?.addEventListener('click',()=>this.logout());
    document.getElementById('sb-logout')?.addEventListener('click',()=>this.logout());
    document.getElementById('theme-btn')?.addEventListener('click',()=>this.toggleTheme());
    document.getElementById('search-btn')?.addEventListener('click',()=>{ const so=document.getElementById('search-overlay'); so.style.display='flex'; document.getElementById('global-search-input').focus(); });
    document.addEventListener('keydown', e=>{ if(e.key==='Escape'){ const so=document.getElementById('search-overlay'); if(so&&so.style.display!=='none') so.style.display='none'; } });
    document.getElementById('global-search-input')?.addEventListener('input',e=>this.globalSearch(e.target.value));
    document.getElementById('notif-btn')?.addEventListener('click',()=>{ const p=document.getElementById('notif-panel'); p.style.display=p.style.display==='none'?'block':'none'; });
    document.getElementById('notif-clear')?.addEventListener('click',()=>{ document.getElementById('notif-list').innerHTML='<div class="notif-empty">No new notifications</div>'; document.getElementById('notif-badge').style.display='none'; document.getElementById('notif-panel').style.display='none'; });
    document.addEventListener('click',e=>{ if(!document.getElementById('notif-wrap')?.contains(e.target)) document.getElementById('notif-panel').style.display='none'; });
    document.querySelectorAll('.stab').forEach(t=>t.addEventListener('click',()=>{ document.querySelectorAll('.stab').forEach(x=>x.classList.remove('active')); document.querySelectorAll('.spane').forEach(x=>x.classList.remove('active')); t.classList.add('active'); const p=document.getElementById('sp-'+t.dataset.stab); if(p) p.classList.add('active'); if(t.dataset.stab==='users') this.renderUsers(); if(t.dataset.stab==='data') this.renderBackupStats(); if(t.dataset.stab==='school') this.loadSchoolSettings(); if(t.dataset.stab==='appearance') this.loadAppearanceSettings(); }));
    document.querySelectorAll('.tab').forEach(t=>t.addEventListener('click',()=>{ const g=t.closest('.tabs'); if(!g) return; g.querySelectorAll('.tab').forEach(x=>x.classList.remove('active')); t.classList.add('active'); const panes=t.closest('.page')?.querySelectorAll('.tab-pane'); panes?.forEach(p=>{ p.classList.remove('active'); if(p.id===t.dataset.tab) p.classList.add('active'); }); }));
    document.querySelectorAll('.mtab').forEach(t=>t.addEventListener('click',()=>{ const mb=t.closest('.modal-body'); mb?.querySelectorAll('.mtab').forEach(x=>x.classList.remove('active')); t.classList.add('active'); mb?.querySelectorAll('.modal-tab-pane').forEach(p=>{ p.classList.remove('active'); if(p.id===t.dataset.mtab) p.classList.add('active'); }); }));
    document.querySelectorAll('.msg-tab').forEach(t=>t.addEventListener('click',()=>{ document.querySelectorAll('.msg-tab').forEach(x=>x.classList.remove('active')); t.classList.add('active'); this.renderMessages(t.dataset.mtab); }));
    document.getElementById('del-confirm-btn')?.addEventListener('click',()=>{ if(this.deleteCallback){ this.deleteCallback(); this.deleteCallback=null; } this.closeModal('m-delete'); });
  },

  async logout(){
    this.audit('Logout','login',`${this.currentUser.name} signed out`);
    if(window.FAuth) await FAuth.logout();
    DB.del('session'); this.currentUser=null; this.schoolId=null;
    if(this._demoMode){
      const _dc=['students','staff','classes','subjects','feePayments','feeStructure',
        'exams','grades','attendance','events','messages','leaves','homework','books',
        'expenses','payroll','auditLog','timetable','school','users'];
      _dc.forEach(c=>{try{localStorage.removeItem('sms_'+c);}catch{}});
      DB.del('seeded');
    }
    this._demoMode=false;
    document.getElementById('app').style.display='none';
    document.getElementById('login-screen').style.display='flex';
    const lu=document.getElementById('l-user'); if(lu) lu.value='';
    const lp=document.getElementById('l-pass'); if(lp) lp.value='';
  },

  // ── AUTH ──
  bindForms(){
    if(this._formsBound) return;
    this._formsBound = true;
    document.getElementById('try-demo-btn')?.addEventListener('click',()=>{
      this._demoMode = true;
      // Force reseed so demo credentials always exist regardless of prior state
      DB.set('seeded', false);
      seedData();
      const users = DB.get('users',[]);
      const demoUser = users.find(u=>u.email==='demo@brightfutureacademy.edu.gh');
      if(demoUser){
        demoUser.lastLogin = new Date().toISOString();
        DB.set('users', users);
        DB.set('session', {userId: demoUser.id});
        this.currentUser = demoUser;
        this.boot();
      }
    });
    document.getElementById('login-btn')?.addEventListener('click',()=>this.login());
    document.getElementById('l-pass')?.addEventListener('keydown',e=>{ if(e.key==='Enter') this.login(); });
    document.getElementById('l-pass-toggle')?.addEventListener('click',function(){ const i=document.getElementById('l-pass'); const on=this.querySelector('.eye-on'),off=this.querySelector('.eye-off'); if(i.type==='password'){ i.type='text'; on.style.display='none'; off.style.display=''; }else{ i.type='password'; on.style.display=''; off.style.display='none'; } });
    document.getElementById('forgot-pw-btn')?.addEventListener('click',()=>{
      const email=document.getElementById('l-user').value.trim();
      if(!email){ alert('Please enter your email address first.'); return; }
      if(typeof firebase!=='undefined'&&firebase.auth){
        firebase.auth().sendPasswordResetEmail(email)
          .then(()=>alert('Password reset email sent. Please check your inbox.'))
          .catch(()=>alert('Could not send reset email. Please contact your administrator.'));
      } else {
        alert('Please contact your school administrator to reset your password.');
      }
    });
    document.getElementById('go-register')?.addEventListener('click',()=>{ document.getElementById('auth-signin').style.display='none'; document.getElementById('auth-register').style.display='block'; });
    document.getElementById('go-signin')?.addEventListener('click',()=>{ document.getElementById('auth-register').style.display='none'; document.getElementById('auth-signin').style.display='block'; });
    document.getElementById('register-btn')?.addEventListener('click',()=>this.startOTPFlow());
    // OTP screen listeners
    document.getElementById('otp-verify-btn')?.addEventListener('click',()=>this.verifyOTP());
    document.getElementById('otp-resend-btn')?.addEventListener('click',()=>this.resendOTP());
    document.getElementById('otp-back-btn')?.addEventListener('click',()=>{ document.getElementById('auth-otp').style.display='none'; document.getElementById('auth-register').style.display='block'; this.clearOTPState(); });
    this.initOTPBoxes();
    document.getElementById('add-student-btn')?.addEventListener('click',()=>this.openStudentModal());
    document.getElementById('save-student-btn')?.addEventListener('click',()=>this.saveStudent());
    ['s-search','s-class-f','s-status-f','s-gender-f'].forEach(id=>document.getElementById(id)?.addEventListener('change',()=>this.renderStudents()));
    document.getElementById('s-search')?.addEventListener('input',()=>this.renderStudents());
    document.getElementById('s-reset')?.addEventListener('click',()=>{ ['s-search','s-class-f','s-status-f','s-gender-f'].forEach(id=>{ const e=document.getElementById(id); if(e) e.value=''; }); this.renderStudents(); });
    document.getElementById('exp-students-btn')?.addEventListener('click',()=>this.exportStudents());
    document.getElementById('add-staff-btn')?.addEventListener('click',()=>this.openStaffModal());
    document.getElementById('save-staff-btn')?.addEventListener('click',()=>this.saveStaff());
    document.getElementById('staff-search')?.addEventListener('input',()=>this.renderStaff());
    ['staff-dept-f','staff-role-f'].forEach(id=>document.getElementById(id)?.addEventListener('change',()=>this.renderStaff()));
    document.getElementById('exp-staff-btn')?.addEventListener('click',()=>this.exportStaff());
    document.getElementById('add-class-btn')?.addEventListener('click',()=>this.openClassModal());
    document.getElementById('save-class-btn')?.addEventListener('click',()=>this.saveClass());
    document.getElementById('add-subject-btn')?.addEventListener('click',()=>this.openSubjectModal());
    document.getElementById('save-subject-btn')?.addEventListener('click',()=>this.saveSubject());
    document.getElementById('take-att-btn')?.addEventListener('click',()=>this.openAttendanceForm());
    document.getElementById('att-all-present')?.addEventListener('click',()=>this.markAllAtt('present'));
    document.getElementById('att-all-absent')?.addEventListener('click',()=>this.markAllAtt('absent'));
    document.getElementById('save-attendance-btn')?.addEventListener('click',()=>this.saveAttendance());
    document.getElementById('att-filter-btn')?.addEventListener('click',()=>this.renderAttendanceRecords());
    document.getElementById('add-exam-btn')?.addEventListener('click',()=>this.openExamModal());
    document.getElementById('save-exam-btn')?.addEventListener('click',()=>this.saveExam());
    document.getElementById('load-grade-btn')?.addEventListener('click',()=>this.loadGradeEntry());
    document.getElementById('save-grades-btn')?.addEventListener('click',()=>this.saveGrades());
    document.getElementById('load-results-btn')?.addEventListener('click',()=>this.loadResults());
    document.getElementById('report-card-btn')?.addEventListener('click',()=>this.showReportCards());
    document.getElementById('tt-class-sel')?.addEventListener('change',()=>this.renderTimetable());
    document.getElementById('add-fee-btn')?.addEventListener('click',()=>this.openFeeModal());
    document.getElementById('save-fee-btn')?.addEventListener('click',()=>this.saveFee());
    document.getElementById('fee-search')?.addEventListener('input',()=>this.renderFees());
    ['fee-class-f','fee-term-f','fee-year-f'].forEach(id=>document.getElementById(id)?.addEventListener('change',()=>{ this.renderFeesKpis(); this.renderFees(); this.renderFeeStructure(); this.renderDefaulters(); }));
    document.getElementById('exp-fees-btn')?.addEventListener('click',()=>this.exportFees());
    document.getElementById('add-fee-struct-btn')?.addEventListener('click',()=>this.openFeeStructModal());
    document.getElementById('add-expense-btn')?.addEventListener('click',()=>this.openExpenseModal());
    document.getElementById('add-event-btn')?.addEventListener('click',()=>this.openEventModal());
    document.getElementById('save-event-btn')?.addEventListener('click',()=>this.saveEvent());
    document.getElementById('compose-btn')?.addEventListener('click',()=>this.openComposeModal());
    document.getElementById('send-msg-btn')?.addEventListener('click',()=>this.sendMessage());
    document.getElementById('msg-to')?.addEventListener('change',e=>{ document.getElementById('msg-class-field').style.display=e.target.value==='specific-class'?'block':'none'; });
    document.getElementById('add-book-btn')?.addEventListener('click',()=>this.openBookModal());
    document.getElementById('borrow-btn')?.addEventListener('click',()=>this.openBookIssueModal());
    document.getElementById('lib-search')?.addEventListener('input',()=>this.renderLibrary());
    ['lib-cat-f','lib-status-f'].forEach(id=>document.getElementById(id)?.addEventListener('change',()=>this.renderLibrary()));
    document.getElementById('add-hw-btn')?.addEventListener('click',()=>this.openHomeworkModal());
    document.getElementById('add-leave-btn')?.addEventListener('click',()=>this.openLeaveModal());
    document.getElementById('process-payroll-btn')?.addEventListener('click',()=>this.processPayroll());
    document.getElementById('exp-audit-btn')?.addEventListener('click',()=>this.exportAudit());
    document.getElementById('exp-payroll-btn')?.addEventListener('click',()=>this.exportPayroll());
    document.getElementById('send-reminder-btn')?.addEventListener('click',()=>this.sendBulkReminders());
    document.getElementById('promote-btn')?.addEventListener('click',()=>this.openPromoteModal());
    document.getElementById('import-students-btn')?.addEventListener('click',()=>this.openImportModal());
    document.getElementById('print-att-btn')?.addEventListener('click',()=>this.printAttendanceSheet());
    document.getElementById('dash-refresh-btn')?.addEventListener('click',()=>this.refreshDashboard());
    document.getElementById('clear-audit-btn')?.addEventListener('click',()=>{ DB.set('auditLog',[]); this.renderAudit(); this.toast('Audit log cleared','warn'); });
    document.getElementById('audit-q')?.addEventListener('input',()=>this.renderAudit());
    document.getElementById('audit-type')?.addEventListener('change',()=>this.renderAudit());
    document.getElementById('gen-report-btn')?.addEventListener('click',()=>this.toast('Select a report type from the cards below','warn'));
    document.getElementById('save-school-btn')?.addEventListener('click',()=>this.saveSchool());
    document.getElementById('save-profile-btn')?.addEventListener('click',()=>this.saveProfile());
    document.getElementById('save-pw-btn')?.addEventListener('click',()=>this.changePassword());
    document.getElementById('save-academic-btn')?.addEventListener('click',()=>this.saveAcademic());
    document.getElementById('apply-custom-theme')?.addEventListener('click',()=>this.applyCustomTheme());
    document.getElementById('dark-mode-toggle')?.addEventListener('change',e=>{ document.documentElement.dataset.theme=e.target.checked?'dark':'light'; DB.set('darkMode',e.target.checked); const sun=document.querySelector('.icon-sun'),moon=document.querySelector('.icon-moon'); if(sun) sun.style.display=e.target.checked?'none':''; if(moon) moon.style.display=e.target.checked?'':'none'; });
    document.querySelectorAll('.swatch[data-primary]').forEach(s=>s.addEventListener('click',()=>{ document.querySelectorAll('.swatch').forEach(x=>x.classList.remove('active')); s.classList.add('active'); this.applyThemeColors(s.dataset.primary,s.dataset.teal); }));
    document.getElementById('custom-primary')?.addEventListener('input',e=>{ document.getElementById('custom-primary-hex').value=e.target.value; });
    document.getElementById('custom-teal')?.addEventListener('input',e=>{ document.getElementById('custom-teal-hex').value=e.target.value; });
    document.querySelectorAll('.fsz-btn').forEach(b=>b.addEventListener('click',()=>{ document.querySelectorAll('.fsz-btn').forEach(x=>x.classList.remove('active')); b.classList.add('active'); const sizes={small:'13px',medium:'15px',large:'17px'}; document.documentElement.style.fontSize=sizes[b.dataset.size]; DB.set('fontSize',b.dataset.size); }));
    document.getElementById('add-user-btn')?.addEventListener('click',()=>this.openUserModal());
    document.getElementById('save-user-btn')?.addEventListener('click',()=>this.saveUser());
    document.getElementById('save-sms-btn')?.addEventListener('click',()=>{
      const key=document.getElementById('sms-key')?.value.trim();
      const badge=document.getElementById('sms-status-badge');
      const testBtn=document.getElementById('test-sms-btn');
      const settings=DB.get('smsSettings',{});
      settings.provider=document.getElementById('sms-provider')?.value;
      settings.key=key;
      settings.secret=document.getElementById('sms-secret')?.value;
      settings.configured=!!key;
      DB.set('smsSettings',settings);
      if(key){
        if(badge){badge.textContent='Configured';badge.style.background='var(--success)';badge.style.color='#fff';}
        if(testBtn){const sp=testBtn.querySelector('.badge');if(sp){sp.textContent='Active';sp.className='badge badge-success';}testBtn.disabled=false;}
      } else {
        if(badge){badge.textContent='Disabled';badge.style.background='var(--surface-3)';badge.style.color='var(--t3)';}
      }
      this.toast('SMS settings saved','success');
    });
    document.getElementById('test-sms-btn')?.addEventListener('click',()=>this.toast('SMS gateway not yet configured — connect your provider in Settings to enable sending.','warn'));
    document.getElementById('backup-btn')?.addEventListener('click',()=>this.exportBackup());
    document.getElementById('upload-logo-btn')?.addEventListener('click',()=>document.getElementById('logo-file').click());
    document.getElementById('logo-file')?.addEventListener('change',e=>this.uploadLogo(e));
    document.getElementById('upload-av-btn')?.addEventListener('click',()=>document.getElementById('av-file').click());
    document.getElementById('av-file')?.addEventListener('change',e=>this.uploadAvatar(e));
    document.getElementById('att-date').value=new Date().toISOString().split('T')[0];
    const now=new Date();
    const pm=document.getElementById('pay-month'); if(pm){ ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].forEach((m,i)=>{ pm.innerHTML+=`<option value="${i+1}" ${i+1===now.getMonth()+1?'selected':''}>${m}</option>`; }); }
    const py=document.getElementById('pay-year'); if(py){ for(let y=2020;y<=2030;y++) py.innerHTML+=`<option value="${y}" ${y===now.getFullYear()?'selected':''}>${y}</option>`; }
  },

  async login(){
    const email=document.getElementById('l-user').value.trim();
    const pass=document.getElementById('l-pass').value;
    const errEl=document.getElementById('l-err');
    const btn=document.getElementById('login-btn');
    if(!email||!pass){ errEl.style.display='flex'; errEl.textContent='Please enter your email and password.'; return; }
    btn.disabled=true; btn.querySelector('span').textContent='Signing in…'; errEl.style.display='none';

    // Always check localStorage first (covers demo account + offline use)
    const users=DB.get('users',[]);
    const pwHash = await hashPassword(pass);
    const localUser=users.find(u=>u.email===email&&(u.passwordHash===pwHash||u.password===pass));
    if(localUser){
      // Auto-migrate legacy plain-text password to hash on next login
      if(localUser.password&&!localUser.passwordHash){
        localUser.passwordHash=pwHash; delete localUser.password; DB.set('users',users);
      }
      this._demoMode = true;
      localUser.lastLogin=new Date().toISOString(); DB.set('users',users);
      DB.set('session',{userId:localUser.id});
      this.currentUser=localUser; this.audit('Login','login',`${localUser.name} signed in`);
      this.boot(); errEl.style.display='none'; return;
    }

    // Try Firebase if available
    if(!window.FAuth){ errEl.style.display='flex'; errEl.textContent='Incorrect email or password.'; btn.disabled=false; btn.querySelector('span').textContent='Sign In to Dashboard'; return; }
    const result=await FAuth.login(email,pass);
    if(!result.success){ errEl.style.display='flex'; errEl.textContent=result.error; btn.disabled=false; btn.querySelector('span').textContent='Sign In to Dashboard'; return; }
    // Check school approval status — block anyone who is not explicitly 'active'
    const _profile = await FDB.getSchoolProfile(result.uid).catch(()=>null);
    const _status = _profile?.status || 'pending';
    if(_status === 'suspended'){
      btn.disabled=false; btn.querySelector('span').textContent='Sign In to Dashboard';
      document.getElementById('login-screen').style.display='none';
      this.showSuspendedScreen(_profile, email);
      return;
    }
    if(_status !== 'active'){
      btn.disabled=false; btn.querySelector('span').textContent='Sign In to Dashboard';
      document.getElementById('login-screen').style.display='none';
      this.showPendingScreen(_profile || {status:'pending', name:'', adminEmail:email}, email);
      return;
    }
  },

  // ══ OTP FLOW ══
  _otpState: {},

  initOTPBoxes() {
    const boxes = document.querySelectorAll('.otp-box');
    boxes.forEach((box, i) => {
      box.addEventListener('input', (e) => {
        const val = e.target.value.replace(/\D/g, '');
        box.value = val ? val[0] : '';
        box.classList.toggle('otp-filled', !!box.value);
        if (val && i < boxes.length - 1) boxes[i + 1].focus();
        this._checkOTPComplete();
      });
      box.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace' && !box.value && i > 0) boxes[i - 1].focus();
        if (e.key === 'ArrowLeft' && i > 0) boxes[i - 1].focus();
        if (e.key === 'ArrowRight' && i < boxes.length - 1) boxes[i + 1].focus();
      });
      box.addEventListener('paste', (e) => {
        e.preventDefault();
        const paste = (e.clipboardData || window.clipboardData).getData('text').replace(/\D/g,'').slice(0,6);
        boxes.forEach((b, j) => { b.value = paste[j] || ''; b.classList.toggle('otp-filled', !!b.value); });
        if (paste.length >= 6) boxes[5].focus();
        else if (paste.length > 0) boxes[Math.min(paste.length, 5)].focus();
        this._checkOTPComplete();
      });
      box.addEventListener('focus', () => { box.select(); });
    });
  },

  _checkOTPComplete() {
    const boxes = document.querySelectorAll('.otp-box');
    const complete = [...boxes].every(b => b.value.length === 1);
    const btn = document.getElementById('otp-verify-btn');
    if (btn) btn.disabled = !complete;
  },

  _getOTPValue() {
    return [...document.querySelectorAll('.otp-box')].map(b => b.value).join('');
  },

  _clearOTPBoxes(error = false) {
    const boxes = document.querySelectorAll('.otp-box');
    boxes.forEach(b => {
      b.value = '';
      b.classList.remove('otp-filled');
      b.classList.toggle('otp-error', error);
    });
    if (error) setTimeout(() => boxes.forEach(b => b.classList.remove('otp-error')), 600);
    const btn = document.getElementById('otp-verify-btn');
    if (btn) btn.disabled = true;
  },

  clearOTPState() {
    this._otpState = {};
    this._clearOTPBoxes();
    clearInterval(this._otpCountdownTimer);
    clearInterval(this._otpResendTimer);
    const errEl = document.getElementById('otp-err');
    const successEl = document.getElementById('otp-success');
    if (errEl) errEl.style.display = 'none';
    if (successEl) successEl.style.display = 'none';
  },

  async startOTPFlow() {
    const school = document.getElementById('r-school').value.trim();
    const motto  = document.getElementById('r-motto').value.trim();
    const name   = document.getElementById('r-name').value.trim();
    const email  = document.getElementById('r-email').value.trim();
    const pwd    = document.getElementById('r-pwd').value;
    const cpwd   = document.getElementById('r-cpwd').value;
    const errEl  = document.getElementById('r-err');
    const btn    = document.getElementById('register-btn');

    if (!school || !name || !email || !pwd) { errEl.textContent = 'Please fill in all required fields.'; errEl.style.display = 'flex'; return; }
    if (pwd !== cpwd) { errEl.textContent = 'Passwords do not match.'; errEl.style.display = 'flex'; return; }
    if (pwd.length < 8) { errEl.textContent = 'Password must be at least 8 characters.'; errEl.style.display = 'flex'; return; }

    btn.disabled = true;
    btn.querySelector('span').textContent = 'Sending code…';
    errEl.style.display = 'none';

    // Generate 6-digit OTP — store only its hash, never the plain code
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes
    const otpHash = await hashPassword(otp);
    this._otpState = { otpHash, expiresAt, school, motto, name, email, pwd };

    // Send via EmailJS
    const sent = await this._sendOTPEmail(email, name, otp);
    btn.disabled = false;
    btn.querySelector('span').textContent = 'Create School Account';

    if (!sent) { errEl.textContent = 'Could not send verification email. Check your email and try again.'; errEl.style.display = 'flex'; return; }

    // Show OTP screen
    document.getElementById('auth-register').style.display = 'none';
    document.getElementById('auth-otp').style.display = 'block';
    document.getElementById('otp-email-display').textContent = email;
    this._clearOTPBoxes();
    this._startOTPCountdown();
    this._startResendCooldown();
    setTimeout(() => document.getElementById('otp-0')?.focus(), 100);
  },

  async _sendOTPEmail(email, name, otp) {
    try {
      // ── RESEND via Cloudflare Worker proxy ──────────────────────────────
      // Deploy the worker from: /cloudflare-worker/otp-worker.js
      // Then paste your worker URL below (keep trailing slash off):
      const WORKER_URL = 'https://eduformium-otp.school-management.workers.dev';
      // ────────────────────────────────────────────────────────────────────

      const res = await fetch(`${WORKER_URL}/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to_name:  name.split(' ')[0],
          to_email: email,
          otp_code: otp,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        console.error('OTP worker error:', err);
        return false;
      }
      return true;
    } catch (e) {
      console.error('OTP send error:', e);
      return false;
    }
  },

  _startOTPCountdown() {
    clearInterval(this._otpCountdownTimer);
    const el = document.getElementById('otp-countdown');
    const row = document.querySelector('.otp-timer-row');
    const tick = () => {
      const remaining = this._otpState.expiresAt - Date.now();
      if (remaining <= 0) {
        if (el) el.textContent = '0:00';
        if (row) row.classList.add('expired');
        const btn = document.getElementById('otp-verify-btn');
        if (btn) { btn.disabled = true; }
        clearInterval(this._otpCountdownTimer);
        return;
      }
      const m = Math.floor(remaining / 60000);
      const s = Math.floor((remaining % 60000) / 1000);
      if (el) el.textContent = `${m}:${s.toString().padStart(2,'0')}`;
      if (row) row.classList.remove('expired');
    };
    tick();
    this._otpCountdownTimer = setInterval(tick, 1000);
  },

  _startResendCooldown(seconds = 60) {
    const btn = document.getElementById('otp-resend-btn');
    const timerEl = document.getElementById('otp-resend-timer');
    if (!btn || !timerEl) return;
    btn.disabled = true;
    let remaining = seconds;
    timerEl.textContent = `(${remaining}s)`;
    clearInterval(this._otpResendTimer);
    this._otpResendTimer = setInterval(() => {
      remaining--;
      timerEl.textContent = `(${remaining}s)`;
      if (remaining <= 0) {
        clearInterval(this._otpResendTimer);
        btn.disabled = false;
        timerEl.textContent = '';
      }
    }, 1000);
  },

  async resendOTP() {
    const { email, name } = this._otpState;
    if (!email) return;
    const btn = document.getElementById('otp-resend-btn');
    const successEl = document.getElementById('otp-success');
    const errEl = document.getElementById('otp-err');
    btn.disabled = true;

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    this._otpState.otp = otp;
    this._otpState.expiresAt = Date.now() + 10 * 60 * 1000;

    const sent = await this._sendOTPEmail(email, name, otp);
    if (sent) {
      errEl.style.display = 'none';
      successEl.style.display = 'flex';
      setTimeout(() => { if (successEl) successEl.style.display = 'none'; }, 4000);
      this._clearOTPBoxes();
      this._startOTPCountdown();
      this._startResendCooldown();
      setTimeout(() => document.getElementById('otp-0')?.focus(), 100);
    } else {
      errEl.textContent = 'Failed to resend. Please try again.';
      errEl.style.display = 'flex';
      btn.disabled = false;
    }
  },

  async verifyOTP() {
    const entered = this._getOTPValue();
    const { otpHash, expiresAt, school, motto, name, email, pwd } = this._otpState;
    const errEl = document.getElementById('otp-err');
    const btn = document.getElementById('otp-verify-btn');

    // Check expiry
    if (Date.now() > expiresAt) {
      errEl.textContent = 'This code has expired. Please request a new one.';
      errEl.style.display = 'flex';
      this._clearOTPBoxes(true);
      return;
    }

    // Check code
    const enteredHash = await hashPassword(entered);
    if (enteredHash !== otpHash) {
      errEl.textContent = 'Incorrect code. Please try again.';
      errEl.style.display = 'flex';
      this._clearOTPBoxes(true);
      setTimeout(() => document.getElementById('otp-0')?.focus(), 100);
      return;
    }

    // Code correct — create account
    errEl.style.display = 'none';
    btn.disabled = true;
    btn.querySelector('span').textContent = 'Creating account…';

    if (!window.FAuth) {
      const users = DB.get('users', []);
      if (users.find(u => u.email === email)) { errEl.textContent = 'Email already registered.'; errEl.style.display = 'flex'; btn.disabled = false; btn.querySelector('span').textContent = 'Verify & Create Account'; return; }
      const sc = DB.get('school', {}); sc.name = school; sc.motto = motto || sc.motto; DB.set('school', sc);
      const newUser = { id: uid('u'), email, passwordHash: await hashPassword(pwd), name, role: 'admin', phone: '', createdAt: new Date().toISOString(), lastLogin: null };
      users.push(newUser); DB.set('users', users); DB.set('session', { userId: newUser.id }); this.currentUser = newUser;
      this.toast(`Welcome, ${name.split(' ')[0]}!`, 'success');
      this.clearOTPState();
      this.boot(); return;
    }

    this._registering = true;
    const result = await FAuth.register(school, name, email, pwd);
    if (result.success) {
      this.clearOTPState();
      // Show pending screen FIRST — before logout fires onAuthStateChanged
      document.getElementById('auth-otp').style.display = 'none';
      this.showPendingScreen({status:'pending', name:school, adminEmail:email}, email);
      // Logout in background — _registering stays true until complete so onAuthChange is suppressed
      if(window.FAuth) FAuth.logout().catch(()=>{}).finally(()=>{ this._registering = false; });
      else this._registering = false;
    } else {
      this._registering = false;
      errEl.textContent = result.error;
      errEl.style.display = 'flex';
      btn.disabled = false;
      btn.querySelector('span').textContent = 'Verify & Create Account';
    }
  },

  async register() {
    // Legacy — now handled by startOTPFlow
    await this.startOTPFlow();
  },

  // ══ DASHBOARD ══
  loadDashboard(){
    const students=DB.get('students',[]);
    const staff=DB.get('staff',[]);
    const classes=DB.get('classes',[]);
    const payments=DB.get('feePayments',[]);
    const school=DB.get('school',{});
    const exams=DB.get('exams',[]);
    const leaves=DB.get('leaves',[]);
    const totalRevenue=payments.reduce((s,p)=>s+(+p.amount||0),0);
    const active=students.filter(s=>s.status==='active').length;
    const attRecords=DB.get('attendance',[]);
    const todayStr=new Date().toISOString().split('T')[0];
    const todayAtt=attRecords.filter(a=>a.date===todayStr);
    const now=new Date();
    // Attendance rate
    let attRate='—', attSub='No data yet', attNum=null;
    if(todayAtt.length>0){
      attNum=Math.round(todayAtt.reduce((s,a)=>s+(a.present/(a.total||1)),0)/todayAtt.length*100);
      attRate=attNum+'%'; attSub="Today's average";
    } else {
      // Fix: require d<=n (exclude future records) AND within last 7 days
      const week=attRecords.filter(a=>{ const d=new Date(a.date),n=new Date(); return (n-d)>=0&&(n-d)<=7*864e5; });
      if(week.length>0){ attNum=Math.round(week.reduce((s,a)=>s+(a.present/(a.total||1)),0)/week.length*100); attRate=attNum+'%'; attSub='7-day average'; }
    }
    // Defaulters: only current term of current year
    const defaulters=students.filter(s=>{ if(s.status!=='active') return false; const fs=getYearStructure(s.classId,_academicYear); if(!fs) return false; const due=+(fs['term'+_currentTerm]||0); if(!due) return false; const yf=getYearFees(s,_academicYear); const paid=+(yf['term'+_currentTerm]||0); return paid<due; });
    // Attendance colour helper
    const attColor=n=>n===null?'var(--t4)':n>=90?'var(--success)':n>=75?'var(--warn)':'var(--danger)';

    // ── TODAY AT A GLANCE strip ──
    const todayPayments=payments.filter(p=>p.date===todayStr);
    const todayRevenue=todayPayments.reduce((s,p)=>s+(+p.amount||0),0);
    const attClassesToday=todayAtt.length;
    const pendingLeaves=leaves.filter(l=>l.status==='pending').length;
    const examsThisWeek=exams.filter(e=>{ if(!e.date) return false; const d=new Date(e.date.includes('T')?e.date:e.date+'T00:00:00'); return d>=now&&(d-now)<=7*864e5; }).length;
    const stripEl=document.getElementById('dash-today-strip');
    if(stripEl){
      const tiles=[
        {icon:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" width="18" height="18"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>`,
          label:'Collected Today',val:fmt(todayRevenue),sub:`${todayPayments.length} payment${todayPayments.length!==1?'s':''}`,
          color:'#0d9488',page:'fees'},
        {icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" width="18" height="18"><polyline points="20 6 9 17 4 12"/></svg>',
          label:'Attendance Today',val:attClassesToday>0?attRate:'—',sub:attClassesToday>0?`${attClassesToday} class${attClassesToday!==1?'es':''} marked`:'No sessions marked',
          color:'#0d9488',page:'attendance'},
        {icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" width="18" height="18"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',
          label:'Exams This Week',val:examsThisWeek,sub:examsThisWeek===0?'None scheduled':'Coming up',
          color:'#1a3a6b',page:'exams'},
        {icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" width="18" height="18"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>',
          label:'Pending Leave',val:pendingLeaves,sub:pendingLeaves===0?'None pending':pendingLeaves===1?'Awaiting approval':`${pendingLeaves} awaiting approval`,
          color:'#1a3a6b',page:'leave'},
      ];
      stripEl.innerHTML=tiles.map(t=>`
        <div class="dash-today-tile dash-tile-${t.color==='#0d9488'?'teal':'navy'}" onclick="SMS.nav('${t.page}')" title="Go to ${t.page}">
          <div class="dash-today-icon">${t.icon}</div>
          <div class="dash-today-body">
            <div class="dash-today-val">${t.val}</div>
            <div class="dash-today-label">${t.label}</div>
            <div class="dash-today-sub">${t.sub}</div>
          </div>
        </div>`).join('');
    }

    // KPI cards — with trend context line
    const kpis=[
      {icon:'students',label:'Total Students',val:students.length,sub:`${active} active · ${students.length-active} inactive`,color:'blue',page:'students'},
      {icon:'staff',label:'Total Staff',val:staff.length,sub:`${staff.filter(s=>s.role==='teacher').length} teachers · ${staff.filter(s=>s.role!=='teacher').length} others`,color:'blue',page:'staff'},
      {icon:'classes',label:'Classes',val:classes.length,sub:`${DB.get('subjects',[]).length} subjects total`,color:'blue',page:'classes'},
      {icon:'fees',label:'Fee Revenue',val:fmt(totalRevenue),sub:`${defaulters.length} defaulter${defaulters.length!==1?'s':''}`,color:'teal',warn:defaulters.length>0,featured:true,page:'fees'},
      {icon:'check',label:'Attendance Rate',val:attRate,sub:attSub,color:'teal',featured:true,page:'attendance'},
      {icon:'library',label:'Library Books',val:DB.get('books',[]).reduce((s,b)=>s+(+b.copies||0),0),sub:`${DB.get('books',[]).reduce((s,b)=>s+(+b.available||0),0)} available`,color:'blue',page:'library'},
    ];
    document.getElementById('dash-kpis').innerHTML=kpis.map(k=>`
      <div class="kpi-card${k.featured?' kpi-featured':''}" style="cursor:pointer" onclick="SMS.nav('${k.page}')">
        <div class="kpi-icon ${k.color}">${SMS._kpiSvg(k.icon)}</div>
        <div class="kpi-val">${k.val}</div>
        <div class="kpi-label">${k.label}</div>
        <div class="kpi-sub-line ${k.warn?'kpi-sub-warn':''}">${k.sub}</div>
      </div>`).join('');
    // Hero stats — live numbers
    const heroActive=document.getElementById('dash-hero-active'); if(heroActive) heroActive.textContent=active;
    const heroAtt=document.getElementById('dash-hero-att'); if(heroAtt){ heroAtt.textContent=attRate; heroAtt.style.color=attColor(attNum); heroAtt.className='dash-hero-stat-val'; }
    this.renderDashCharts(students,classes,payments,attRecords);
    // Recent students — two-color class pills (navy / teal), no rainbow
    const clsPalette=['#1a3a6b','#0d9488','#1a3a6b','#0d9488','#1a3a6b','#0d9488','#1a3a6b','#0d9488'];
    const recent=[...students].sort((a,b)=>new Date(b.admitDate||0)-new Date(a.admitDate||0)).slice(0,5);
    document.getElementById('dash-recent-students').innerHTML=recent.map(s=>{
      const ci=classes.findIndex(c=>c.id===s.classId);
      const clsColor=clsPalette[ci%clsPalette.length]||'#1a3a6b';
      return `<div class="mini-item" style="cursor:pointer" onclick="SMS.nav('students')">
        <div class="mini-av" style="background:${clsColor}22;color:${clsColor}">${(s.fname||'?')[0]}${(s.lname||'?')[0]}</div>
        <div style="flex:1;min-width:0">
          <div class="mini-name">${sanitize(s.fname)} ${sanitize(s.lname)}</div>
          <div class="mini-sub"><span style="background:${clsColor}18;color:${clsColor};font-weight:700;font-size:.65rem;padding:.1rem .4rem;border-radius:4px">${this.className(s.classId)}</span> · ${s.studentId}</div>
        </div>
        <div class="mini-right">${statusBadge(s.status)}</div>
      </div>`;
    }).join('') || '<div class="dash-empty-panel"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="28" height="28"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3.53 1.76 9.47 1.76 12 0v-5"/></svg><div>No students enrolled yet</div></div>';
    // Events
    const events=DB.get('events',[]);
    const upcomingEv=[...events].filter(e=>new Date(e.start)>=now).sort((a,b)=>new Date(a.start)-new Date(b.start)).slice(0,4);
    const evColors={exam:'#1a3a6b',academic:'#0d9488',sports:'#16a34a',holiday:'#d97706',meeting:'#7c3aed',cultural:'#dc2626'};
    const evIcons={exam:'📝',academic:'🎓',sports:'⚽',holiday:'🏖️',meeting:'📅',cultural:'🎭'};
    document.getElementById('dash-events').innerHTML=upcomingEv.map(e=>{
      const col=evColors[e.type]||'#1a3a6b';
      const daysLeft=Math.ceil((new Date(e.start)-now)/(1000*60*60*24));
      const daysStr=daysLeft===0?'Today':daysLeft===1?'Tomorrow':`In ${daysLeft}d`;
      return `<div class="mini-item" style="cursor:pointer" onclick="SMS.nav('events')">
        <div class="mini-av" style="background:${col}18;color:${col};font-size:.85rem">${evIcons[e.type]||'📌'}</div>
        <div style="flex:1;min-width:0">
          <div class="mini-name">${sanitize(e.title)}</div>
          <div class="mini-sub">${fmtDate(e.start)}${e.venue?' · '+e.venue:''}</div>
        </div>
        <div class="mini-right"><span style="font-size:.68rem;font-weight:700;color:${col};background:${col}18;padding:.2rem .5rem;border-radius:5px;white-space:nowrap">${daysStr}</span></div>
      </div>`;
    }).join('') || '<div class="dash-empty-panel"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="28" height="28"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg><div>No upcoming events</div></div>';
    // Defaulters — with actual amount owed
    const defBadge=document.getElementById('dash-defaulters-count');
    if(defBadge){ defBadge.textContent=defaulters.length; defBadge.style.display=defaulters.length>0?'inline-flex':'none'; }
    document.getElementById('dash-defaulters').innerHTML=defaulters.slice(0,5).map(s=>{
      const _yf=getYearFees(s,_academicYear); const _yfs=getYearStructure(s.classId,_academicYear);
      const t1=+(_yfs?.term1||0),t2=+(_yfs?.term2||0),t3=+(_yfs?.term3||0);
      const owed=Math.max(0,t1-(+(_yf.term1||0)))+Math.max(0,t2-(+(_yf.term2||0)))+Math.max(0,t3-(+(_yf.term3||0)));
      return `<div class="mini-item" style="cursor:pointer" onclick="SMS.nav('fees')">
        <div class="mini-av" style="background:var(--danger-bg);color:var(--danger)">${(s.fname||'?')[0]}${(s.lname||'?')[0]}</div>
        <div style="flex:1;min-width:0">
          <div class="mini-name">${sanitize(s.fname)} ${sanitize(s.lname)}</div>
          <div class="mini-sub">${this.className(s.classId)}</div>
        </div>
        <div class="mini-right" style="text-align:right">
          <div style="font-size:.78rem;font-weight:800;color:var(--danger)">${fmt(owed)}</div>
          <div style="font-size:.65rem;color:var(--t4);margin-top:.1rem">outstanding</div>
        </div>
      </div>`;
    }).join('') || '<div class="dash-empty-panel dash-empty-ok"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="28" height="28"><polyline points="20 6 9 17 4 12"/></svg><div>All fees up to date</div></div>';
    // Upcoming Exams panel
    const _parseExamDate=d=>new Date(d.includes('T')?d:d+'T00:00:00');
    const upcomingExams=[...exams].filter(e=>e.date&&_parseExamDate(e.date)>=now).sort((a,b)=>_parseExamDate(a.date)-_parseExamDate(b.date)).slice(0,5);
    const examEl=document.getElementById('dash-exams');
    if(examEl){ examEl.innerHTML=upcomingExams.map(e=>{
      const daysLeft=Math.ceil((_parseExamDate(e.date)-now)/(1000*60*60*24));
      const daysStr=daysLeft===0?'Today':daysLeft===1?'Tomorrow':`In ${daysLeft}d`;
      const urgColor=daysLeft<=2?'var(--danger)':daysLeft<=7?'var(--warn)':'var(--brand)';
      return `<div class="mini-item" style="cursor:pointer" onclick="SMS.nav('exams')">
        <div class="mini-av" style="background:var(--brand-lt);color:var(--brand)">📝</div>
        <div style="flex:1;min-width:0">
          <div class="mini-name">${sanitize(e.name)}</div>
          <div class="mini-sub">${this.className(e.classId)||'All Classes'} · ${fmtDate(e.date)}</div>
        </div>
        <div class="mini-right"><span style="font-size:.68rem;font-weight:700;color:${urgColor};background:${urgColor}18;padding:.2rem .5rem;border-radius:5px;white-space:nowrap">${daysStr}</span></div>
      </div>`;
    }).join('')||'<div class="dash-empty-panel"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="28" height="28"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg><div>No upcoming exams</div></div>'; }
  },

  renderDashCharts(students,classes,payments,attRecords){
    const isDark=document.documentElement.getAttribute('data-theme')==='dark';
    const gridColor=isDark?'rgba(255,255,255,0.06)':'rgba(0,0,0,0.05)';
    const tickColor=isDark?'#64748b':'#94a3b8';
    const emptyBarColor=isDark?'rgba(255,255,255,0.06)':'rgba(0,0,0,0.07)';
    const chartDefaults={ responsive:true, maintainAspectRatio:false };

    // ── Enrollment by class ──
    const ctx1=document.getElementById('chart-enrollment');
    if(ctx1){ if(this._charts.enrollment) this._charts.enrollment.destroy();
      const labels=classes.map(c=>c.name);
      const data=classes.map(c=>students.filter(s=>s.classId===c.id&&s.status==='active').length);
      this._charts.enrollment=new Chart(ctx1,{type:'bar',data:{labels,datasets:[{data,backgroundColor:isDark?'rgba(59,130,246,0.7)':'rgba(26,58,107,0.75)',borderRadius:5}]},options:{...chartDefaults,plugins:{legend:{display:false}},scales:{y:{beginAtZero:true,ticks:{stepSize:1,color:tickColor},grid:{color:gridColor}},x:{grid:{display:false},ticks:{color:tickColor}}},onClick:()=>SMS.nav('students')}});
      ctx1.style.cursor='pointer';
    }
    // ── Fee collection — real data, last 6 months ──
    const ctx2=document.getElementById('chart-fees');
    if(ctx2){ if(this._charts.fees) this._charts.fees.destroy();
      const now=new Date();
      const feeKeys=[],feeLabels=[],feeData=[];
      for(let i=5;i>=0;i--){
        const d=new Date(now.getFullYear(),now.getMonth()-i,1);
        feeKeys.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`);
        feeLabels.push(d.toLocaleString('default',{month:'short'}));
        feeData.push(0);
      }
      payments.forEach(p=>{ if(!p.date) return; const k=p.date.substring(0,7); const idx=feeKeys.indexOf(k); if(idx>-1) feeData[idx]+=(+p.amount||0); });
      const hasAnyFee=feeData.some(v=>v>0);
      const sym=_currency==='NGN'?'₦':_currency==='KES'?'KSh':_currency==='USD'?'$':_currency==='GBP'?'£':_currency==='ZAR'?'R':_currency==='EUR'?'€':'₵';
      const tealLine=isDark?'#2dd4bf':'#0d9488';
      this._charts.fees=new Chart(ctx2,{type:'line',data:{labels:feeLabels,datasets:[{data:feeData,borderColor:tealLine,backgroundColor:isDark?'rgba(45,212,191,0.08)':'rgba(13,148,136,0.09)',borderWidth:2.5,tension:0.4,fill:true,pointBackgroundColor:tealLine,pointRadius:4,pointHoverRadius:6}]},options:{...chartDefaults,plugins:{legend:{display:false},tooltip:{callbacks:{label:ctx=>`${sym}${ctx.parsed.y.toLocaleString()}`}}},scales:{y:{beginAtZero:true,grid:{color:gridColor},ticks:{callback:v=>sym+v.toLocaleString(),color:tickColor}},x:{grid:{display:false},ticks:{color:tickColor}}},onClick:()=>SMS.nav('fees')}});
      ctx2.style.cursor='pointer';
      const sub=document.getElementById('dash-fee-sub');
      if(sub) sub.textContent=hasAnyFee?'Last 6 months':'No payments recorded yet';
    }
    // ── Attendance — real data, last 7 days ──
    const ctx3=document.getElementById('chart-attendance');
    if(ctx3){ if(this._charts.att) this._charts.att.destroy();
      const recs=attRecords||DB.get('attendance',[]);
      const attKeys=[],attLabels=[],attData=[],attColors=[];
      for(let i=6;i>=0;i--){
        const d=new Date(); d.setDate(d.getDate()-i);
        const key=d.toISOString().split('T')[0];
        attKeys.push(key);
        attLabels.push(d.toLocaleString('default',{weekday:'short'}));
        const dayRecs=recs.filter(a=>a.date===key);
        if(dayRecs.length>0){
          const rate=Math.round(dayRecs.reduce((s,a)=>s+(a.present/(a.total||1)),0)/dayRecs.length*100);
          attData.push(rate);
          attColors.push(isDark
            ? (rate>=90?'rgba(45,212,191,0.8)':rate>=75?'rgba(251,191,36,0.8)':'rgba(248,113,113,0.75)')
            : (rate>=90?'rgba(13,148,136,0.8)':rate>=75?'rgba(217,119,6,0.8)':'rgba(220,38,38,0.75)'));
        } else {
          attData.push(null);
          attColors.push(emptyBarColor);
        }
      }
      const hasAttData=attData.some(v=>v!==null);
      this._charts.att=new Chart(ctx3,{type:'bar',data:{labels:attLabels,datasets:[{data:attData,backgroundColor:attColors,borderRadius:4}]},options:{...chartDefaults,plugins:{legend:{display:false},tooltip:{callbacks:{label:ctx=>ctx.parsed.y!==null?ctx.parsed.y+'%':'No data'}}},scales:{y:{min:hasAttData?60:0,max:100,grid:{color:gridColor},ticks:{callback:v=>v+'%',color:tickColor}},x:{grid:{display:false},ticks:{color:tickColor}}},onClick:()=>SMS.nav('attendance')}});
      ctx3.style.cursor='pointer';
      const sub3=document.getElementById('dash-att-sub');
      if(sub3) sub3.textContent=hasAttData?'Last 7 days':'No records yet';
    }
  },

  // ══ STUDENTS ══
  loadStudents(){
    const classes=DB.get('classes',[]);
    const sel=document.getElementById('s-class-f'); if(sel){ sel.innerHTML='<option value="">All Classes</option>'+classes.map(c=>`<option value="${c.id}">${sanitize(c.name)}</option>`).join(''); }
    this.renderStudentStats();
    this.renderStudents();
    // Populate student dropdown in fee modal
    const fstu=document.getElementById('fee-student'); if(fstu){ const students=DB.get('students',[]); fstu.innerHTML='<option value="">— Select Student —</option>'+students.map(s=>`<option value="${s.id}">${sanitize(s.fname)} ${sanitize(s.lname)} (${this.className(s.classId)})</option>`).join(''); }
  },

  renderStudentStats(){
    const students=DB.get('students',[]);
    const stats=[
      {val:students.length,lbl:'Total Enrolled'},{val:students.filter(s=>s.status==='active').length,lbl:'Active'},
      {val:students.filter(s=>s.gender==='Male').length,lbl:'Male'},{val:students.filter(s=>s.gender==='Female').length,lbl:'Female'},
      {val:students.filter(s=>s.status==='graduated').length,lbl:'Graduated'},
    ];
    document.getElementById('student-stats').innerHTML=stats.map(s=>`<div class="stat-pill"><div><div class="stat-pill-val">${s.val}</div><div class="stat-pill-lbl">${s.lbl}</div></div></div>`).join('');
  },

  renderStudents(){
    const students=DB.get('students',[]);
    const q=(document.getElementById('s-search')?.value||'').toLowerCase();
    const cf=document.getElementById('s-class-f')?.value||'';
    const sf=document.getElementById('s-status-f')?.value||'';
    const gf=document.getElementById('s-gender-f')?.value||'';
    let filtered=students.filter(s=>{
      if(cf&&s.classId!==cf) return false;
      if(sf&&s.status!==sf) return false;
      if(gf&&s.gender!==gf) return false;
      if(q&&!`${sanitize(s.fname)} ${sanitize(s.lname)} ${s.studentId} ${s.dadPhone||''} ${s.momPhone||''} ${s.momName||''} ${s.roll||''}`.toLowerCase().includes(q)) return false;
      return true;
    });
    const perPage=15, total=filtered.length, pages=Math.ceil(total/perPage);
    this._studPage=Math.min(this._studPage,pages||1);
    const slice=filtered.slice((this._studPage-1)*perPage,this._studPage*perPage);
    const tbody=document.getElementById('students-tbody');
    if(!tbody) return;
    const feeStructure=DB.get('feeStructure',[]);
    tbody.innerHTML=slice.map(s=>{
      const fs=feeStructure.find(f=>f.classId===s.classId);
      const termFee1=+(fs?.term1||0), termFee2=+(fs?.term2||0), termFee3=+(fs?.term3||0);
      const _syf=getYearFees(s,_academicYear); const p1=+(_syf.term1||0), p2=+(_syf.term2||0), p3=+(_syf.term3||0);
      const owed=Math.max(0,termFee1-p1)+Math.max(0,termFee2-p2)+Math.max(0,termFee3-p3);
      const noStructure=!fs||(termFee1===0&&termFee2===0&&termFee3===0);
      const feeStatus=noStructure?`<span style="color:var(--t4);font-size:.76rem;font-weight:600">—</span>`:owed>0?`<span style="color:var(--danger);font-size:.76rem;font-weight:600">Owes ${fmt(owed)}</span>`:`<span style="color:var(--success);font-size:.76rem;font-weight:600">Paid</span>`;
      return `<tr>
        <td style="font-family:monospace;font-size:.75rem;color:var(--t3)">${s.studentId}</td>
        <td><div style="display:flex;align-items:center;gap:.6rem"><div class="mini-av">${s.fname[0]}${s.lname[0]}</div><div><div style="font-weight:600;color:var(--t1)">${sanitize(s.fname)} ${sanitize(s.lname)}</div><div style="font-size:.73rem;color:var(--t4)">${fmtDate(s.dob)}</div></div></div></td>
        <td>${this.className(s.classId)}</td>
        <td>${s.gender}</td>
        <td><div style="font-size:.8rem;font-weight:600">${s.dadName||'—'}</div><div style="font-size:.73rem;color:var(--t4)">${s.momName||''}</div></td>
        <td style="font-size:.8rem">${s.dadPhone||s.momPhone||'—'}</td>
        <td>${feeStatus}</td>
        <td>${statusBadge(s.status)}</td>
        <td>
          <div style="display:flex;gap:.3rem">
            <button class="btn btn-ghost btn-sm" onclick="SMS.viewStudent('${s.id}')" style="padding:.3rem .5rem" title="View Profile"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></button>
            <button class="btn btn-ghost btn-sm" onclick="SMS.openStudentModal('${s.id}')" style="padding:.3rem .5rem" title="Edit"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
            <button class="btn btn-ghost btn-sm" onclick="SMS.confirmDelete('Delete student ${sanitize(s.fname)} ${sanitize(s.lname)}?',()=>SMS.deleteStudent('${s.id}'))" style="padding:.3rem .5rem;color:var(--danger)" title="Delete"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg></button>
          </div>
        </td>
      </tr>`;
    }).join('') || SMS._emptyState('students','No Students Found','Try adjusting your filters, or enroll your first student using the button above.','+ Enrol Student',"SMS.openStudentModal()");
    // Pager
    let pager=`<span class="pager-info">Showing ${Math.min(filtered.length,perPage*(this._studPage-1)+1)}–${Math.min(filtered.length,perPage*this._studPage)} of ${total}</span>`;
    for(let i=1;i<=pages;i++) pager+=`<button class="pager-btn ${i===this._studPage?'active':''}" onclick="SMS._studPage=${i};SMS.renderStudents()">${i}</button>`;
    document.getElementById('students-pager').innerHTML=pager;
  },

  viewStudent(id){
    const s=DB.get('students',[]).find(x=>x.id===id); if(!s) return;
    document.getElementById('sp-modal-title').textContent=`${sanitize(s.fname)} ${sanitize(s.lname)}`;
    const payments=DB.get('feePayments',[]).filter(p=>p.studentId===id).sort((a,b)=>b.date.localeCompare(a.date));
    const grades=DB.get('grades',[]).filter(g=>g.studentId===id);
    const exams=DB.get('exams',[]);
    const feeStructure=DB.get('feeStructure',[]);
    const fs=getYearStructure(s.classId,_academicYear);
    const ft1=+(fs?.term1||0),ft2=+(fs?.term2||0),ft3=+(fs?.term3||0);
    const _spyf=getYearFees(s,_academicYear); const fp1=+(_spyf.term1||0),fp2=+(_spyf.term2||0),fp3=+(_spyf.term3||0);
    const fb1=Math.max(0,ft1-fp1),fb2=Math.max(0,ft2-fp2),fb3=Math.max(0,ft3-fp3);
    const totalDue=ft1+ft2+ft3, totalPaid=fp1+fp2+fp3, totalOwed=fb1+fb2+fb3;
    const noFeeStruct=!fs||(ft1===0&&ft2===0&&ft3===0);
    const feeSummaryHtml=noFeeStruct
      ? `<div style="color:var(--t4);font-size:.82rem;padding:.5rem 0;font-style:italic">No fee structure set for this student's class. Go to Fees → Fee Structure to configure.</div>`
      : `
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:.6rem;margin-bottom:.75rem">
        ${[['Term 1',ft1,fp1,fb1],['Term 2',ft2,fp2,fb2],['Term 3',ft3,fp3,fb3]].map(([lbl,due,paid,bal])=>`
        <div style="background:var(--bg2);border-radius:.6rem;padding:.6rem .75rem;border:1px solid var(--border)">
          <div style="font-size:.72rem;color:var(--t4);font-weight:600;margin-bottom:.3rem">${lbl}</div>
          <div style="font-size:.78rem;color:var(--t3)">Due: <span style="color:var(--t1);font-weight:600">${fmt(due)}</span></div>
          <div style="font-size:.78rem;color:var(--t3)">Paid: <span style="color:var(--success);font-weight:600">${fmt(paid)}</span></div>
          <div style="font-size:.78rem;font-weight:700;margin-top:.2rem;color:${bal>0?'var(--danger)':'var(--success)'}">
            ${bal>0?'Owes '+fmt(bal):'Cleared'}
          </div>
        </div>`).join('')}
      </div>
      <div style="display:flex;align-items:center;justify-content:space-between;background:${totalOwed>0?'rgba(239,68,68,.07)':'rgba(34,197,94,.07)'};border:1px solid ${totalOwed>0?'rgba(239,68,68,.2)':'rgba(34,197,94,.2)'};border-radius:.6rem;padding:.6rem .85rem;margin-bottom:.75rem">
        <div style="font-size:.82rem;color:var(--t2)">Total: <strong>${fmt(totalPaid)}</strong> paid of <strong>${fmt(totalDue)}</strong></div>
        ${totalOwed>0?`<span style="font-size:.82rem;font-weight:700;color:var(--danger)">Balance: ${fmt(totalOwed)}</span><button class="btn btn-sm" style="background:#1d4ed8;color:#fff;padding:.35rem .9rem;font-size:.8rem;font-weight:700;border:2px solid #1e40af;border-radius:.45rem;cursor:pointer;box-shadow:0 1px 4px rgba(0,0,0,.18)" onclick="SMS.closeModal('m-student-profile');SMS.nav('fees');SMS.openFeeModal('${s.id}')">Pay Now</button>`:`<span style="font-size:.82rem;font-weight:700;color:var(--success)">Fully Paid</span>`}
      </div>`;
    document.getElementById('student-profile-body').innerHTML=`
      <div style="display:flex;align-items:flex-start;gap:1.25rem;flex-wrap:wrap;margin-bottom:1.25rem">
        <div class="profile-av-lg">${s.fname[0]}${s.lname[0]}</div>
        <div style="flex:1">
          <div style="font-family:'Playfair Display',serif;font-size:1.4rem;font-weight:700;color:var(--t1);margin-bottom:.2rem">${sanitize(s.fname)} ${sanitize(s.lname)}</div>
          <div style="font-size:.82rem;color:var(--t3);margin-bottom:.75rem">${s.studentId} · ${this.className(s.classId)} · ${s.gender}</div>
          <div style="display:flex;gap:.5rem;flex-wrap:wrap">${statusBadge(s.status)}<span class="badge badge-info">${this.className(s.classId)}</span></div>
        </div>
      </div>
      <div class="profile-section-title">Personal Information</div>
      <div class="profile-info-grid">
        <div class="pinfo-item"><div class="pinfo-label">Date of Birth</div><div class="pinfo-val">${fmtDate(s.dob)}</div></div>
        <div class="pinfo-item"><div class="pinfo-label">Gender</div><div class="pinfo-val">${s.gender}</div></div>
        <div class="pinfo-item"><div class="pinfo-label">Admission Date</div><div class="pinfo-val">${fmtDate(s.admitDate)}</div></div>
        <div class="pinfo-item"><div class="pinfo-label">Address</div><div class="pinfo-val">${s.address||'—'}</div></div>
        <div class="pinfo-item"><div class="pinfo-label">Nationality</div><div class="pinfo-val">${s.nationality||'Ghanaian'}</div></div>
        <div class="pinfo-item"><div class="pinfo-label">Religion</div><div class="pinfo-val">${s.religion||'—'}</div></div>
        <div class="pinfo-item"><div class="pinfo-label">Blood Group</div><div class="pinfo-val">${s.blood||'—'}</div></div>
        <div class="pinfo-item"><div class="pinfo-label">Previous School</div><div class="pinfo-val">${s.prevSchool||'—'}</div></div>
      </div>
      <div class="profile-section-title">Parent / Guardian</div>
      <div class="profile-info-grid">
        <div class="pinfo-item"><div class="pinfo-label">Father/Guardian</div><div class="pinfo-val">${s.dadName||'—'}</div></div>
        <div class="pinfo-item"><div class="pinfo-label">Phone</div><div class="pinfo-val">${s.dadPhone||'—'}</div></div>
        <div class="pinfo-item"><div class="pinfo-label">Email</div><div class="pinfo-val">${s.dadEmail||'—'}</div></div>
        <div class="pinfo-item"><div class="pinfo-label">Mother</div><div class="pinfo-val">${s.momName||'—'}</div></div>
        <div class="pinfo-item"><div class="pinfo-label">Mother Phone</div><div class="pinfo-val">${s.momPhone||'—'}</div></div>
        <div class="pinfo-item"><div class="pinfo-label">Emergency</div><div class="pinfo-val">${s.emerName||'—'} ${s.emerPhone?'· '+s.emerPhone:''}</div></div>
      </div>
      <div class="profile-section-title">Fee Summary</div>
      ${feeSummaryHtml}
      <div class="profile-section-title">Payment History (${payments.length} records)</div>
      ${payments.length>0?`<table class="tbl"><thead><tr><th>Receipt</th><th>Term</th><th>Amount</th><th>Method</th><th>Date</th><th>Ref</th></tr></thead><tbody>${payments.map(p=>`<tr><td style="font-family:monospace;font-size:.75rem">${p.receiptNo||'—'}</td><td>Term ${p.term}</td><td style="font-weight:700;color:var(--success)">${fmt(p.amount)}</td><td>${p.method}</td><td>${fmtDate(p.date)}</td><td style="font-size:.75rem;color:var(--t4)">${p.ref||'—'}</td></tr>`).join('')}</tbody></table>`:'<div style="color:var(--t4);font-size:.82rem;padding:.5rem 0">No payment records yet.</div>'}
      <div class="profile-section-title">Academic Results (${grades.length} entries)</div>
      ${grades.length>0?`<table class="tbl"><thead><tr><th>Exam</th><th>Score</th><th>Max</th><th>Grade</th></tr></thead><tbody>${grades.map(g=>{ const ex=exams.find(e=>e.id===g.examId); return `<tr><td>${ex?.name||'—'}</td><td style="font-weight:700">${g.score}</td><td>${ex?.maxScore||100}</td><td><span class="badge ${gradeFromScore(g.score,ex?.maxScore||100)==='F'?'badge-danger':gradeFromScore(g.score,ex?.maxScore||100)<='C'?'badge-warn':'badge-success'}">${gradeFromScore(g.score,ex?.maxScore||100)}</span></td></tr>`; }).join('')}</tbody></table>`:'<div style="color:var(--t4);font-size:.82rem;padding:.5rem 0">No grades recorded</div>'}
    `;
    this.openModal('m-student-profile');
  },

  openStudentModal(id=null){
    const classes=DB.get('classes',[]);
    const sel=document.getElementById('sf-class'); if(sel) sel.innerHTML='<option value="">— Select —</option>'+classes.map(c=>`<option value="${c.id}">${sanitize(c.name)}</option>`).join('');
    document.getElementById('sf-err').style.display='none';
    // Reset all fields
    ['sf-id','sf-fname','sf-mname','sf-lname','sf-dob','sf-address','sf-sid','sf-roll','sf-prev-school','sf-notes','sf-dad','sf-dad-phone','sf-dad-email','sf-dad-job','sf-mom','sf-mom-phone','sf-mom-job','sf-emer','sf-emer-phone','sf-emer-rel','sf-allergies','sf-medical','sf-doctor','sf-doc-phone'].forEach(id=>{ const e=document.getElementById(id); if(e) e.value=''; });
    document.getElementById('sf-gender').value='';
    document.getElementById('sf-blood').value='';
    document.getElementById('sf-transport').value='none';
    document.getElementById('sf-status').value='active';
    document.getElementById('sf-admit-date').value=new Date().toISOString().split('T')[0];
    document.getElementById('student-modal-title').textContent='Enroll New Student';
    document.getElementById('save-student-btn').textContent='Enroll Student';
    if(id){
      const s=DB.get('students',[]).find(x=>x.id===id); if(!s) return;
      document.getElementById('sf-id').value=s.id;
      document.getElementById('sf-fname').value=s.fname||'';
      document.getElementById('sf-mname').value=s.mname||'';
      document.getElementById('sf-lname').value=s.lname||'';
      document.getElementById('sf-dob').value=s.dob||'';
      document.getElementById('sf-gender').value=s.gender||'';
      document.getElementById('sf-blood').value=s.blood||'';
      document.getElementById('sf-admit-date').value=s.admitDate||'';
      document.getElementById('sf-address').value=s.address||'';
      document.getElementById('sf-class').value=s.classId||'';
      document.getElementById('sf-sid').value=s.studentId||'';
      document.getElementById('sf-roll').value=s.roll||'';
      document.getElementById('sf-status').value=s.status||'active';
      document.getElementById('sf-transport').value=s.transport||'none';
      document.getElementById('sf-notes').value=s.notes||'';
      document.getElementById('sf-prev-school').value=s.prevSchool||'';
      if(document.getElementById('sf-nation')) document.getElementById('sf-nation').value=s.nationality||'';
      if(document.getElementById('sf-religion')) document.getElementById('sf-religion').value=s.religion||'';
      document.getElementById('sf-dad').value=s.dadName||'';
      document.getElementById('sf-dad-phone').value=s.dadPhone||'';
      document.getElementById('sf-dad-email').value=s.dadEmail||'';
      document.getElementById('sf-dad-job').value=s.dadJob||'';
      document.getElementById('sf-mom').value=s.momName||'';
      document.getElementById('sf-mom-phone').value=s.momPhone||'';
      document.getElementById('sf-mom-job').value=s.momJob||'';
      document.getElementById('sf-emer').value=s.emerName||'';
      document.getElementById('sf-emer-phone').value=s.emerPhone||'';
      document.getElementById('sf-emer-rel').value=s.emerRel||'';
      document.getElementById('sf-allergies').value=s.allergies||'';
      document.getElementById('sf-medical').value=s.medical||'';
      document.getElementById('sf-doctor').value=s.doctorName||'';
      document.getElementById('sf-doc-phone').value=s.docPhone||'';
      document.getElementById('student-modal-title').textContent='Edit Student';
      document.getElementById('save-student-btn').textContent='Save Changes';
    }
    // Reset modal tabs
    document.querySelectorAll('.modal-tab-pane').forEach(p=>p.classList.remove('active'));
    document.querySelectorAll('.mtab').forEach(t=>t.classList.remove('active'));
    document.getElementById('basic')?.classList.add('active');
    document.querySelector('.mtab[data-mtab="basic"]')?.classList.add('active');
    this.openModal('m-student');
  },

  saveStudent(){
    const fname=document.getElementById('sf-fname').value.trim();
    const lname=document.getElementById('sf-lname').value.trim();
    const classId=document.getElementById('sf-class').value;
    const gender=document.getElementById('sf-gender').value;
    const dob=document.getElementById('sf-dob').value;
    const admitDate=document.getElementById('sf-admit-date').value;
    const errEl=document.getElementById('sf-err');
    // Inline field highlighting
    const fields=[['sf-fname',fname],['sf-lname',lname],['sf-class',classId],['sf-gender',gender],['sf-admit-date',admitDate]];
    let hasError=false;
    fields.forEach(([id,val])=>{ const el=document.getElementById(id); if(el){ el.style.borderColor=val?'':'var(--danger)'; if(!val) hasError=true; } });
    if(hasError){ errEl.style.display='block'; errEl.textContent='Please fill in all required fields (marked in red).'; return; }
    errEl.style.display='none';
    // Reset field borders
    fields.forEach(([id])=>{ const el=document.getElementById(id); if(el) el.style.borderColor=''; });
    const students=DB.get('students',[]);
    const existingId=document.getElementById('sf-id').value;
    const _maxId=students.reduce((mx,st)=>{ const n=parseInt((st.studentId||'').split('-').pop()||0); return n>mx?n:mx; },100);
    const sid=document.getElementById('sf-sid').value.trim()||`BFA-${new Date().getFullYear()}-`+String(_maxId+1).padStart(4,'0');
    const data={fname,mname:document.getElementById('sf-mname').value.trim(),lname,classId,gender,dob,admitDate,blood:document.getElementById('sf-blood').value,address:document.getElementById('sf-address').value,nationality:document.getElementById('sf-nation')?.value||'',religion:document.getElementById('sf-religion')?.value||'',studentId:sid,roll:document.getElementById('sf-roll').value,status:document.getElementById('sf-status').value,transport:document.getElementById('sf-transport').value,notes:document.getElementById('sf-notes').value,dadName:document.getElementById('sf-dad').value,dadPhone:document.getElementById('sf-dad-phone').value,dadEmail:document.getElementById('sf-dad-email').value,dadJob:document.getElementById('sf-dad-job').value,momName:document.getElementById('sf-mom').value,momPhone:document.getElementById('sf-mom-phone').value,momJob:document.getElementById('sf-mom-job').value,emerName:document.getElementById('sf-emer').value,emerPhone:document.getElementById('sf-emer-phone').value,emerRel:document.getElementById('sf-emer-rel').value,allergies:document.getElementById('sf-allergies').value,medical:document.getElementById('sf-medical').value,doctorName:document.getElementById('sf-doctor').value,docPhone:document.getElementById('sf-doc-phone').value,feesPaid:{[_academicYear]:{term1:0,term2:0,term3:0}}};
    if(existingId){
      const i=students.findIndex(s=>s.id===existingId);
      if(i>-1){ const old=students[i]; students[i]={...old,...data,id:existingId,studentId:old.studentId,feesPaid:old.feesPaid}; DB.set('students',students); this.audit('Edit Student','edit',`Updated student: ${fname} ${lname}`); this.toast('Student updated','success'); }
    } else {
      const newS={id:uid('stu'),...data,studentId:sid}; students.push(newS); DB.set('students',students);
      this.audit('Enroll Student','create',`New student enrolled: ${fname} ${lname} (${this.className(classId)})`);
      this.toast(`${fname} ${lname} enrolled successfully!`,'success');
    }
    this.closeModal('m-student'); this.renderStudents(); this.renderStudentStats();
    // Keep fee modal student dropdown in sync
    const fstu=document.getElementById('fee-student'); if(fstu){ const students=DB.get('students',[]); fstu.innerHTML='<option value="">— Select Student —</option>'+students.map(s=>`<option value="${s.id}">${sanitize(s.fname)} ${sanitize(s.lname)} (${this.className(s.classId)})</option>`).join(''); }
  },

  deleteStudent(id){
    const students=DB.get('students',[]);
    const s=students.find(x=>x.id===id);
    DB.set('students',students.filter(x=>x.id!==id));
    // Explicitly delete from Firestore so it doesn't return on refresh
    const sid=window.SMS&&window.SMS.schoolId;
    if(sid&&window.FDB) FDB.delete(sid,'students',id).catch(()=>{});
    // Also remove orphan fee payment records for this student
    const orphanPayments=DB.get('feePayments',[]).filter(p=>p.studentId===id);
    DB.set('feePayments',DB.get('feePayments',[]).filter(p=>p.studentId!==id));
    if(sid&&window.FDB) orphanPayments.forEach(p=>FDB.delete(sid,'feePayments',p.id).catch(()=>{}));
    this.audit('Delete Student','delete',`Removed student: ${s?.fname} ${s?.lname}`);
    this.toast('Student removed','warn'); this.renderStudents(); this.renderStudentStats(); this.renderFeesKpis(); this.renderDefaulters();
    const fstu=document.getElementById('fee-student'); if(fstu){ const sts=DB.get('students',[]); fstu.innerHTML='<option value="">— Select Student —</option>'+sts.map(st=>`<option value="${st.id}">${sanitize(st.fname)} ${sanitize(st.lname)} (${this.className(st.classId)})</option>`).join(''); }
  },

  exportStudents(){
    if(typeof XLSX==='undefined'){ this.toast('Export library not loaded','error'); return; }
    const students=DB.get('students',[]);
    const data=students.map(s=>({'Student ID':s.studentId,'First Name':s.fname,'Middle Name':s.mname||'','Last Name':s.lname,'Class':this.className(s.classId),'Gender':s.gender,'DOB':s.dob,'Address':s.address||'','Blood Group':s.blood||'','Nationality':s.nationality||'','Roll No':s.roll||'','Status':s.status,'Transport':s.transport||'none','Admission Date':s.admitDate,'Father/Guardian':s.dadName||'','Father Phone':s.dadPhone||'','Father Email':s.dadEmail||'','Mother':s.momName||'','Mother Phone':s.momPhone||'','Emergency Contact':s.emerName||'','Emergency Phone':s.emerPhone||'','Notes':s.notes||''}));
    const ws=XLSX.utils.json_to_sheet(data); const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,ws,'Students');
    XLSX.writeFile(wb,`Students_${new Date().toISOString().split('T')[0]}.xlsx`);
    this.toast('Students exported','success');
  },

  // ══ STAFF ══
  loadStaff(){
    const depts=[...new Set(DB.get('staff',[]).map(s=>s.dept).filter(Boolean))];
    const df=document.getElementById('staff-dept-f'); if(df) df.innerHTML='<option value="">All Departments</option>'+depts.map(d=>`<option value="${d}">${d}</option>`).join('');
    this.renderStaffStats(); this.renderStaff();
  },

  renderStaffStats(){
    const staff=DB.get('staff',[]);
    const stats=[{val:staff.length,lbl:'Total Staff'},{val:staff.filter(s=>s.role==='teacher').length,lbl:'Teachers'},{val:staff.filter(s=>s.role==='admin').length,lbl:'Admin'},{val:staff.filter(s=>s.status==='active').length,lbl:'Active'}];
    document.getElementById('staff-stats').innerHTML=stats.map(s=>`<div class="stat-pill"><div><div class="stat-pill-val">${s.val}</div><div class="stat-pill-lbl">${s.lbl}</div></div></div>`).join('');
  },

  renderStaff(){
    const staff=DB.get('staff',[]);
    const q=(document.getElementById('staff-search')?.value||'').toLowerCase();
    const df=document.getElementById('staff-dept-f')?.value||'';
    const rf=document.getElementById('staff-role-f')?.value||'';
    let filtered=staff.filter(s=>{ if(df&&s.dept!==df) return false; if(rf&&s.role!==rf) return false; if(q&&!`${sanitize(s.fname)} ${sanitize(s.lname)} ${s.subjects||''}`.toLowerCase().includes(q)) return false; return true; });
    document.getElementById('staff-tbody').innerHTML=filtered.map(s=>`<tr>
      <td style="font-family:monospace;font-size:.75rem;color:var(--t3)">${s.id.toUpperCase()}</td>
      <td><div style="display:flex;align-items:center;gap:.6rem"><div class="mini-av" style="background:var(--brand-lt);color:var(--brand)">${s.fname[0]}${s.lname[0]}</div><div><div style="font-weight:600">${sanitize(s.fname)} ${sanitize(s.lname)}</div><div style="font-size:.73rem;color:var(--t4)">${s.qualification||''}</div></div></div></td>
      <td><span class="badge badge-info">${sanitize(s.role)}</span></td>
      <td>${s.dept||'—'}</td>
      <td style="font-size:.78rem;color:var(--t3)">${s.subjects||'—'}</td>
      <td>${sanitize(s.phone)}</td>
      <td style="font-weight:600;color:var(--brand)">${fmt(s.salary)}</td>
      <td>${statusBadge(s.status||'active')}</td>
      <td><div style="display:flex;gap:.3rem"><button class="btn btn-ghost btn-sm" onclick="SMS.openStaffModal('${s.id}')" style="padding:.3rem .5rem" title="Edit"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button><button class="btn btn-ghost btn-sm" onclick="SMS.confirmDelete('Remove staff member ${sanitize(s.fname)} ${sanitize(s.lname)}?',()=>SMS.deleteStaff('${s.id}'))" style="padding:.3rem .5rem;color:var(--danger)" title="Delete"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg></button></div></td>
    </tr>`).join('')||SMS._emptyState('staff','No Staff Members Found','Add your first staff member or adjust your search filters.','+ Add Staff',"SMS.openStaffModal()");
  },

  openStaffModal(id=null){
    const classes=DB.get('classes',[]); // for class teacher dropdown in class modal
    ['stf-id','stf-fname','stf-lname','stf-id-no','stf-dept','stf-subjects','stf-phone','stf-email','stf-salary','stf-qual','stf-nid','stf-addr','stf-dob','stf-join'].forEach(f=>{ const e=document.getElementById(f); if(e) e.value=''; });
    document.getElementById('stf-role').value=''; document.getElementById('stf-gender').value='';
    document.getElementById('stf-err').style.display='none';
    document.getElementById('staff-modal-title').textContent='Add Staff Member';
    document.getElementById('save-staff-btn').textContent='Save Staff';
    document.getElementById('stf-join').value=new Date().toISOString().split('T')[0];
    if(id){
      const s=DB.get('staff',[]).find(x=>x.id===id); if(!s) return;
      document.getElementById('stf-id').value=s.id;
      ['fname','lname','dept','subjects','phone','email','qualification','nid','addr','dob'].forEach(f=>{ const e=document.getElementById('stf-'+f); if(e) e.value=s[f]||''; });
      document.getElementById('stf-id-no').value=s.id;
      document.getElementById('stf-salary').value=s.salary||'';
      document.getElementById('stf-role').value=s.role||'';
      document.getElementById('stf-gender').value=s.gender||'';
      document.getElementById('stf-join').value=s.joinDate||'';
      document.getElementById('staff-modal-title').textContent='Edit Staff';
      document.getElementById('save-staff-btn').textContent='Save Changes';
    }
    this.openModal('m-staff');
  },

  saveStaff(){
    const fname=document.getElementById('stf-fname').value.trim();
    const lname=document.getElementById('stf-lname').value.trim();
    const role=document.getElementById('stf-role').value;
    const phone=document.getElementById('stf-phone').value.trim();
    const join=document.getElementById('stf-join').value;
    const errEl=document.getElementById('stf-err');
    if(!fname||!lname||!role||!phone||!join){ errEl.style.display='block'; errEl.textContent='Please fill in all required fields.'; return; }
    errEl.style.display='none';
    const staff=DB.get('staff',[]);
    const existingId=document.getElementById('stf-id').value;
    const data={fname,lname,role,dept:document.getElementById('stf-dept').value,subjects:document.getElementById('stf-subjects').value,phone,email:document.getElementById('stf-email').value,salary:+document.getElementById('stf-salary').value||0,qualification:document.getElementById('stf-qual').value,nid:document.getElementById('stf-nid').value,addr:document.getElementById('stf-addr').value,dob:document.getElementById('stf-dob').value,joinDate:join,gender:document.getElementById('stf-gender').value,status:'active'};
    if(existingId){ const i=staff.findIndex(s=>s.id===existingId); if(i>-1){ staff[i]={...staff[i],...data}; DB.set('staff',staff); this.audit('Edit Staff','edit',`Updated: ${fname} ${lname}`); this.toast('Staff updated','success'); } }
    else { const ns={id:uid('stf'),...data}; staff.push(ns); DB.set('staff',staff); this.audit('Add Staff','create',`New staff: ${fname} ${lname} (${role})`); this.toast(`${fname} ${lname} added to staff`,'success'); }
    this.closeModal('m-staff'); this.renderStaff(); this.renderStaffStats();
  },

  deleteStaff(id){ const staff=DB.get('staff',[]); const s=staff.find(x=>x.id===id); DB.set('staff',staff.filter(x=>x.id!==id)); const _sid=window.SMS&&window.SMS.schoolId; if(_sid&&window.FDB) FDB.delete(_sid,'staff',id).catch(()=>{}); this.audit('Delete Staff','delete',`Removed: ${s?.fname} ${s?.lname}`); this.toast('Staff removed','warn'); this.renderStaff(); },

  exportStaff(){
    if(typeof XLSX==='undefined'){ this.toast('Export library not loaded','error'); return; }
    const staff=DB.get('staff',[]);
    const data=staff.map(s=>({'Staff ID':s.id,'First Name':s.fname,'Last Name':s.lname,'Role':s.role,'Department':s.dept,'Subjects':s.subjects,'Phone':s.phone,'Email':s.email,'Salary':s.salary,'Join Date':s.joinDate,'Status':s.status}));
    const ws=XLSX.utils.json_to_sheet(data); const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,ws,'Staff');
    XLSX.writeFile(wb,`Staff_${new Date().toISOString().split('T')[0]}.xlsx`);
    this.toast('Staff exported','success');
  },

  // ══ CLASSES ══
  loadClasses(){
    this.renderClasses(); this.renderSubjectsTable();
    // Populate class selects everywhere
    const classes=DB.get('classes',[]);
    const staff=DB.get('staff',[]).filter(s=>s.role==='teacher');
    ['clf-teacher','subj-class','att-class','tt-class-sel','hw-class-f','grade-class-sel','res-class-sel','fee-class-f','sf-class','msg-class','ex-class','s-class-f'].forEach(id=>{
      const el=document.getElementById(id); if(!el) return;
      if(id==='clf-teacher') el.innerHTML='<option value="">— Select —</option>'+staff.map(s=>`<option value="${s.id}">${sanitize(s.fname)} ${sanitize(s.lname)}</option>`).join('');
      else if(id==='subj-class'||id==='att-class'||id==='tt-class-sel'||id==='hw-class-f'||id==='grade-class-sel'||id==='res-class-sel'||id==='fee-class-f'||id==='msg-class'||id==='ex-class')
        el.innerHTML=(id==='att-class'||id==='tt-class-sel'?'<option value="">Select Class</option>':'<option value="">All Classes</option>')+classes.map(c=>`<option value="${c.id}">${sanitize(c.name)}</option>`).join('');
      else el.innerHTML='<option value="">— Select —</option>'+classes.map(c=>`<option value="${c.id}">${sanitize(c.name)}</option>`).join('');
    });
    ['subj-teacher'].forEach(id=>{ const el=document.getElementById(id); if(el) el.innerHTML='<option value="">— Select —</option>'+staff.map(s=>`<option value="${s.id}">${sanitize(s.fname)} ${sanitize(s.lname)}</option>`).join(''); });
  },

  renderClasses(){
    const classes=DB.get('classes',[]);
    const students=DB.get('students',[]);
    const staff=DB.get('staff',[]);
    document.getElementById('classes-grid').innerHTML=classes.map(c=>{
      const count=students.filter(s=>s.classId===c.id).length;
      const teacher=staff.find(s=>s.id===c.teacherId);
      return `<div class="class-card" onclick="SMS.openClassModal('${c.id}')">
        <div class="class-card-name">${sanitize(c.name)}</div>
        <div class="class-card-teacher"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:12px;height:12px;margin-right:4px;vertical-align:middle;opacity:.6"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>${teacher?teacher.fname+' '+teacher.lname:'No class teacher'}</div>
        <div class="class-card-stats">
          <div class="cc-stat"><strong>${count}</strong>Students</div>
          <div class="cc-stat"><strong>${c.capacity}</strong>Capacity</div>
          <div class="cc-stat"><strong>${c.room||'—'}</strong>Room</div>
        </div>
      </div>`;
    }).join('') || '<div style="color:var(--t4);padding:1rem">No classes added yet.</div>';
  },

  renderSubjectsTable(){
    const subjects=DB.get('subjects',[]);
    const classes=DB.get('classes',[]);
    const staff=DB.get('staff',[]);
    document.getElementById('subjects-tbody').innerHTML=subjects.map(s=>{
      const cls=classes.find(c=>c.id===s.classId);
      const teacher=staff.find(t=>t.id===s.teacherId);
      return `<tr>
        <td style="font-weight:600">${sanitize(s.name)}</td>
        <td style="font-family:monospace;font-size:.75rem;color:var(--t3)">${s.code||'—'}</td>
        <td>${cls?.name||'—'}</td>
        <td>${teacher?teacher.fname+' '+teacher.lname:'—'}</td>
        <td>${s.periods||'—'}/week</td>
        <td><button class="btn btn-ghost btn-sm" onclick="SMS.confirmDelete('Delete subject ${sanitize(s.name)}?',()=>SMS.deleteSubject('${s.id}'))" style="color:var(--danger);padding:.3rem .5rem"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg></button></td>
      </tr>`;
    }).join('')||SMS._emptyState('default','No Subjects Added','Add subjects to your classes so you can assign exams and track grades.','+ Add Subject',"SMS.openSubjectModal()");
  },

  openClassModal(id=null){
    const staff=DB.get('staff',[]).filter(s=>s.role==='teacher');
    document.getElementById('clf-teacher').innerHTML='<option value="">— Select —</option>'+staff.map(s=>`<option value="${s.id}">${sanitize(s.fname)} ${sanitize(s.lname)}</option>`).join('');
    ['clf-id','clf-name','clf-level','clf-room'].forEach(f=>{ const e=document.getElementById(f); if(e) e.value=''; });
    document.getElementById('clf-capacity').value='40';
    document.getElementById('class-modal-title').textContent='Add Class';
    if(id){
      const c=DB.get('classes',[]).find(x=>x.id===id); if(!c) return;
      document.getElementById('clf-id').value=c.id;
      document.getElementById('clf-name').value=c.name;
      document.getElementById('clf-level').value=c.level||'';
      document.getElementById('clf-teacher').value=c.teacherId||'';
      document.getElementById('clf-capacity').value=c.capacity||40;
      document.getElementById('clf-room').value=c.room||'';
      document.getElementById('class-modal-title').textContent='Edit Class';
    }
    this.openModal('m-class');
  },

  saveClass(){
    const name=document.getElementById('clf-name').value.trim(); if(!name){ this.toast('Class name required','error'); return; }
    const classes=DB.get('classes',[]);
    const existId=document.getElementById('clf-id').value;
    const data={name,level:document.getElementById('clf-level').value,teacherId:document.getElementById('clf-teacher').value,capacity:+document.getElementById('clf-capacity').value||40,room:document.getElementById('clf-room').value};
    if(existId){ const i=classes.findIndex(c=>c.id===existId); if(i>-1){ classes[i]={...classes[i],...data}; DB.set('classes',classes); this.toast('Class updated','success'); this.audit('Edit Class','edit',`Updated class: ${name}`); } }
    else { classes.push({id:uid('cls'),...data}); DB.set('classes',classes); this.toast('Class added','success'); this.audit('Add Class','create',`New class: ${name}`); }
    this.closeModal('m-class'); this.renderClasses();
  },

  openSubjectModal(){ ['subj-name','subj-code','subj-class','subj-teacher'].forEach(f=>{ const e=document.getElementById(f); if(e) e.value=''; }); document.getElementById('subj-periods').value='5'; this.openModal('m-subject'); },

  saveSubject(){
    const name=document.getElementById('subj-name').value.trim(); const classId=document.getElementById('subj-class').value;
    if(!name||!classId){ this.toast('Subject name and class required','error'); return; }
    const subjs=DB.get('subjects',[]);
    subjs.push({id:uid('subj'),name,code:document.getElementById('subj-code').value,classId,teacherId:document.getElementById('subj-teacher').value,periods:+document.getElementById('subj-periods').value||5});
    DB.set('subjects',subjs); this.toast('Subject added','success'); this.audit('Add Subject','create',`New subject: ${name}`);
    this.closeModal('m-subject'); this.renderSubjectsTable();
  },

  deleteSubject(id){ const s=DB.get('subjects',[]); DB.set('subjects',s.filter(x=>x.id!==id)); const _sid=window.SMS&&window.SMS.schoolId; if(_sid&&window.FDB) FDB.delete(_sid,'subjects',id).catch(()=>{}); this.toast('Subject removed','warn'); this.renderSubjectsTable(); },

  // ══ ATTENDANCE ══
  loadAttendance(){
    this.renderAttSummary(); this.renderAttendanceRecords();
    const classes=DB.get('classes',[]);
    const sel=document.getElementById('att-class'); if(sel) sel.innerHTML='<option value="">Select Class</option>'+classes.map(c=>`<option value="${c.id}">${sanitize(c.name)}</option>`).join('');
    const from=document.getElementById('att-from'), to=document.getElementById('att-to');
    if(from) from.value=new Date(Date.now()-7*86400000).toISOString().split('T')[0];
    if(to) to.value=new Date().toISOString().split('T')[0];
  },

  renderAttSummary(){
    const att=DB.get('attendance',[]);
    const today=att.filter(a=>a.date===new Date().toISOString().split('T')[0]);
    const totP=today.reduce((s,a)=>s+(a.present||0),0), totA=today.reduce((s,a)=>s+(a.absent||0),0), totL=today.reduce((s,a)=>s+(a.late||0),0), totT=today.reduce((s,a)=>s+(a.total||0),0);
    const rate=totT>0?Math.round(totP/totT*100):0;
    document.getElementById('att-summary').innerHTML=[
      {val:totT,lbl:"Today's Total",col:'var(--brand)'},
      {val:totP,lbl:'Present',col:'var(--success)'},
      {val:totA,lbl:'Absent',col:'var(--danger)'},
      {val:totL,lbl:'Late',col:'var(--warn)'},
      {val:rate+'%',lbl:'Attendance Rate',col:'var(--brand-teal)'},
    ].map(s=>`<div class="att-card"><div class="att-card-val" style="color:${s.col}">${s.val}</div><div class="att-card-lbl">${s.lbl}</div></div>`).join('');
  },

  openAttendanceForm(){
    const date=document.getElementById('att-date').value;
    const classId=document.getElementById('att-class').value;
    if(!date||!classId){ this.toast('Select a date and class','warn'); return; }
    const students=DB.get('students',[]).filter(s=>s.classId===classId&&s.status==='active');
    const cls=DB.get('classes',[]).find(c=>c.id===classId);
    const formCard=document.getElementById('att-form-card');
    document.getElementById('att-form-title').textContent=`Attendance — ${cls?.name||'Class'} · ${fmtDate(date)}`;
    document.getElementById('att-student-list').innerHTML=`<div style="padding:0 1.25rem 1rem">${students.map(s=>`
      <div class="att-student-row">
        <div class="mini-av">${s.fname[0]}${s.lname[0]}</div>
        <div><div style="font-weight:600;font-size:.85rem">${sanitize(s.fname)} ${sanitize(s.lname)}</div><div style="font-size:.73rem;color:var(--t4)">${s.studentId}</div></div>
        <div class="att-radio-group">
          <label class="att-radio"><input type="radio" name="att_${s.id}" value="present" checked> <span style="color:var(--success);font-weight:600">P</span></label>
          <label class="att-radio"><input type="radio" name="att_${s.id}" value="absent"> <span style="color:var(--danger);font-weight:600">A</span></label>
          <label class="att-radio"><input type="radio" name="att_${s.id}" value="late"> <span style="color:var(--warn);font-weight:600">L</span></label>
        </div>
      </div>`).join('')}
    </div>`;
    formCard.style.display='block'; formCard.dataset.classId=classId; formCard.dataset.date=date;
    formCard.scrollIntoView({behavior:'smooth'});
  },

  markAllAtt(status){
    const students=DB.get('students',[]).filter(s=>s.classId===document.getElementById('att-form-card').dataset.classId&&s.status==='active');
    students.forEach(s=>{ const r=document.querySelector(`input[name="att_${s.id}"][value="${status}"]`); if(r) r.checked=true; });
  },

  saveAttendance(){
    const formCard=document.getElementById('att-form-card');
    const classId=formCard.dataset.classId, date=formCard.dataset.date;
    const students=DB.get('students',[]).filter(s=>s.classId===classId&&s.status==='active');
    let present=0,absent=0,late=0;
    students.forEach(s=>{ const v=document.querySelector(`input[name="att_${s.id}"]:checked`)?.value||'present'; if(v==='present') present++; else if(v==='absent') absent++; else late++; });
    const att=DB.get('attendance',[]); const existIdx=att.findIndex(a=>a.date===date&&a.classId===classId);
    const rec={id:uid('a'),date,classId,present,absent,late,total:students.length};
    if(existIdx>-1) att[existIdx]=rec; else att.push(rec);
    DB.set('attendance',att); formCard.style.display='none';
    this.audit('Attendance','create',`Attendance saved: ${this.className(classId)} on ${date}`);
    this.toast('Attendance saved!','success'); this.renderAttSummary(); this.renderAttendanceRecords();
  },

  renderAttendanceRecords(){
    const att=DB.get('attendance',[]);
    const from=document.getElementById('att-from')?.value, to=document.getElementById('att-to')?.value;
    let filtered=att;
    if(from&&to) filtered=att.filter(a=>a.date>=from&&a.date<=to);
    filtered.sort((a,b)=>b.date.localeCompare(a.date));
    document.getElementById('att-tbody').innerHTML=filtered.map(a=>`<tr>
      <td>${fmtDate(a.date)}</td>
      <td>${this.className(a.classId)}</td>
      <td style="color:var(--success);font-weight:700">${a.present}</td>
      <td style="color:var(--danger);font-weight:700">${a.absent}</td>
      <td style="color:var(--warn);font-weight:700">${a.late}</td>
      <td><span class="badge ${a.present/a.total>=0.9?'badge-success':'badge-warn'}">${Math.round(a.present/a.total*100)||0}%</span></td>
      <td><button class="btn btn-ghost btn-sm" onclick="SMS.confirmDelete('Delete this attendance record?',()=>SMS.deleteAtt('${a.id}'))" style="color:var(--danger);padding:.3rem .5rem"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg></button></td>
    </tr>`).join('')||SMS._emptyState('attendance','No Attendance Records','No records match your date range. Take attendance for today using the form above.','');
  },

  deleteAtt(id){ const a=DB.get('attendance',[]); DB.set('attendance',a.filter(x=>x.id!==id)); const _sid=window.SMS&&window.SMS.schoolId; if(_sid&&window.FDB) FDB.delete(_sid,'attendance',id).catch(()=>{}); this.renderAttSummary(); this.renderAttendanceRecords(); this.toast('Record deleted','warn'); },

  // ══ EXAMS ══
  loadExams(){
    const classes=DB.get('classes',[]); const subjects=DB.get('subjects',[]);
    ['ex-class','grade-class-sel','res-class-sel'].forEach(id=>{ const el=document.getElementById(id); if(el) el.innerHTML='<option value="">All Classes</option>'+classes.map(c=>`<option value="${c.id}">${sanitize(c.name)}</option>`).join(''); });
    ['ex-subject','grade-exam-sel'].forEach(id=>{ const el=document.getElementById(id); if(el) el.innerHTML='<option value="">All Subjects</option>'+subjects.map(s=>`<option value="${s.id}">${sanitize(s.name)}</option>`).join(''); });
    this.renderExams();
  },

  renderExams(){
    const exams=DB.get('exams',[]); const classes=DB.get('classes',[]); const subjects=DB.get('subjects',[]);
    document.getElementById('exams-tbody').innerHTML=exams.map(e=>{
      const cls=classes.find(c=>c.id===e.classId); const subj=subjects.find(s=>s.id===e.subjectId);
      return `<tr>
        <td style="font-weight:600">${sanitize(e.name)}</td>
        <td><span class="badge badge-info">${e.type}</span></td>
        <td>${cls?.name||'—'}</td>
        <td>${subj?.name||'—'}</td>
        <td>${fmtDate(e.date)}</td>
        <td style="font-weight:700">${e.maxScore}</td>
        <td>${statusBadge(e.status)}</td>
        <td><div style="display:flex;gap:.3rem"><button class="btn btn-ghost btn-sm" onclick="SMS.openExamModal('${e.id}')" style="padding:.3rem .5rem"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button><button class="btn btn-ghost btn-sm" onclick="SMS.confirmDelete('Delete exam ${sanitize(e.name)}?',()=>SMS.deleteExam('${e.id}'))" style="color:var(--danger);padding:.3rem .5rem"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg></button></div></td>
      </tr>`;
    }).join('')||SMS._emptyState('exams','No Exams Created','Create your first exam to start tracking student performance.','+ Create Exam',"SMS.openExamModal()");
    // Populate grade exam selector
    const gex=document.getElementById('grade-exam-sel'); if(gex) gex.innerHTML='<option value="">— Select Exam —</option>'+exams.map(e=>`<option value="${e.id}">${sanitize(e.name)}</option>`).join('');
  },

  openExamModal(id=null){
    const classes=DB.get('classes',[]); const subjects=DB.get('subjects',[]);
    document.getElementById('ex-class').innerHTML='<option value="">— Select —</option>'+classes.map(c=>`<option value="${c.id}">${sanitize(c.name)}</option>`).join('');
    document.getElementById('ex-subject').innerHTML='<option value="">— Select —</option>'+subjects.map(s=>`<option value="${s.id}">${sanitize(s.name)}</option>`).join('');
    ['ex-name','ex-date'].forEach(f=>{ const e=document.getElementById(f); if(e) e.value=''; });
    document.getElementById('ex-max').value='100'; document.getElementById('ex-duration').value='90'; document.getElementById('ex-type').value='midterm'; document.getElementById('ex-term').value='2'; document.getElementById('ex-class').value=''; document.getElementById('ex-subject').value='';
    if(id){
      const ex=DB.get('exams',[]).find(x=>x.id===id); if(!ex) return;
      document.getElementById('ex-name').value=ex.name; document.getElementById('ex-type').value=ex.type; document.getElementById('ex-class').value=ex.classId; document.getElementById('ex-subject').value=ex.subjectId; document.getElementById('ex-date').value=ex.date; document.getElementById('ex-max').value=ex.maxScore; document.getElementById('ex-term').value=ex.term; document.getElementById('ex-duration').value=ex.duration||90;
    }
    this.openModal('m-exam');
  },

  saveExam(){
    const name=document.getElementById('ex-name').value.trim(); const classId=document.getElementById('ex-class').value; const date=document.getElementById('ex-date').value;
    if(!name||!classId||!date){ this.toast('Fill in required fields','error'); return; }
    const exams=DB.get('exams',[]);
    exams.push({id:uid('ex'),name,type:document.getElementById('ex-type').value,classId,subjectId:document.getElementById('ex-subject').value,date,maxScore:+document.getElementById('ex-max').value||100,term:document.getElementById('ex-term').value,duration:+document.getElementById('ex-duration').value||90,status:'upcoming'});
    DB.set('exams',exams); this.audit('Create Exam','create',`New exam: ${name}`); this.toast('Exam created','success'); this.closeModal('m-exam'); this.renderExams();
  },

  deleteExam(id){ DB.set('exams',DB.get('exams',[]).filter(x=>x.id!==id)); const _sid=window.SMS&&window.SMS.schoolId; if(_sid&&window.FDB) FDB.delete(_sid,'exams',id).catch(()=>{}); this.toast('Exam deleted','warn'); this.renderExams(); },

  loadGradeEntry(){
    const examId=document.getElementById('grade-exam-sel').value;
    const classId=document.getElementById('grade-class-sel').value;
    if(!examId){ this.toast('Select an exam first','warn'); return; }
    const exam=DB.get('exams',[]).find(e=>e.id===examId);
    const targetClass=classId||exam?.classId;
    const students=DB.get('students',[]).filter(s=>s.classId===targetClass&&s.status==='active');
    const existingGrades=DB.get('grades',[]).filter(g=>g.examId===examId);
    const list=document.getElementById('grade-entry-list');
    list.innerHTML=`<div style="margin-bottom:.75rem;font-size:.82rem;color:var(--t3)">Entering grades for: <strong>${exam?.name||'Exam'}</strong> · Max Score: <strong>${exam?.maxScore||100}</strong></div>`+students.map(s=>{
      const existing=existingGrades.find(g=>g.studentId===s.id);
      return `<div class="grade-row">
        <div class="grade-name">${sanitize(s.fname)} ${sanitize(s.lname)} <span style="font-size:.73rem;color:var(--t4)">${s.studentId}</span></div>
        <input type="number" class="form-input grade-input" data-student="${s.id}" min="0" max="${exam?.maxScore||100}" value="${existing?.score||''}" placeholder="Score" style="width:90px"/>
        <span class="grade-badge" id="gb_${s.id}">${existing?`<span class="badge ${gradeFromScore(existing.score,exam?.maxScore||100)==='F'?'badge-danger':'badge-success'}">${gradeFromScore(existing.score,exam?.maxScore||100)}</span>`:''}</span>
      </div>`;
    }).join('');
    list.querySelectorAll('input[data-student]').forEach(inp=>{
      inp.addEventListener('input',()=>{
        const v=+inp.value, max=exam?.maxScore||100;
        const gb=document.getElementById('gb_'+inp.dataset.student);
        if(gb&&v>=0) gb.innerHTML=`<span class="badge ${gradeFromScore(v,max)==='F'?'badge-danger':v/max>=0.8?'badge-success':'badge-warn'}">${gradeFromScore(v,max)}</span>`;
      });
    });
    document.getElementById('save-grades-btn').style.display='inline-flex';
    document.getElementById('save-grades-btn').dataset.examId=examId;
  },

  saveGrades(){
    const examId=document.getElementById('save-grades-btn').dataset.examId;
    const exam=DB.get('exams',[]).find(e=>e.id===examId);
    const inputs=document.querySelectorAll('#grade-entry-list input[data-student]');
    const grades=DB.get('grades',[]); let count=0;
    inputs.forEach(inp=>{
      const studentId=inp.dataset.student, score=+inp.value;
      if(inp.value==='') return;
      const i=grades.findIndex(g=>g.examId===examId&&g.studentId===studentId);
      if(i>-1) grades[i].score=score; else grades.push({id:uid('g'),examId,studentId,score}); count++;
    });
    DB.set('grades',grades);
    // Mark exam completed if grades saved
    const exams=DB.get('exams',[]); const ei=exams.findIndex(e=>e.id===examId); if(ei>-1){ exams[ei].status='completed'; DB.set('exams',exams); }
    this.audit('Grades Entry','edit',`Grades saved for ${exam?.name}: ${count} entries`);
    this.toast(`${count} grades saved!`,'success');
  },

  loadResults(){
    const classId=document.getElementById('res-class-sel').value;
    const term=document.getElementById('res-term-sel').value;
    const students=classId?DB.get('students',[]).filter(s=>s.classId===classId&&s.status==='active'):DB.get('students',[]).filter(s=>s.status==='active');
    const exams=DB.get('exams',[]).filter(e=>(!classId||e.classId===classId)&&(!term||e.term===term));
    const grades=DB.get('grades',[]);
    const results=students.map(s=>{
      const sGrades=grades.filter(g=>exams.some(e=>e.id===g.examId)&&g.studentId===s.id);
      const total=sGrades.reduce((sum,g)=>{ const ex=exams.find(e=>e.id===g.examId); return sum+(g.score/(ex?.maxScore||100)*100); },0);
      const avg=sGrades.length>0?Math.round(total/sGrades.length):0;
      return {student:s,count:sGrades.length,avg,grade:gradeFromScore(avg)};
    }).filter(r=>r.count>0).sort((a,b)=>b.avg-a.avg);
    document.getElementById('results-tbody').innerHTML=results.map((r,i)=>`<tr>
      <td style="font-weight:600">${sanitize(r.student.fname)} ${sanitize(r.student.lname)}</td>
      <td>${this.className(r.student.classId)}</td>
      <td>${r.count}</td>
      <td style="font-weight:700">${r.avg*r.count}</td>
      <td style="font-weight:700;color:var(--brand-teal)">${r.avg}%</td>
      <td><span class="badge ${r.grade==='F'?'badge-danger':r.grade==='D'||r.grade==='C'?'badge-warn':'badge-success'}">${r.grade}</span></td>
      <td style="font-weight:700;color:${i<3?'var(--warn)':'var(--t3)'}">${i===0?'1st':i===1?'2nd':i===2?'3rd':(i+1)+'th'}</td>
      <td><button class="btn btn-ghost btn-sm" onclick="SMS.viewStudent('${r.student.id}')" style="padding:.3rem .5rem">View →</button></td>
    </tr>`).join('')||SMS._emptyState('exams','No Results Available','Create exams and enter student grades first, then view results here.','');
  },

  showReportCards(){
    const classes=DB.get('classes',[]);
    const html=`<div style="margin-bottom:1rem;font-size:.85rem;color:var(--t3)">Select a class to generate report cards:</div><div style="display:flex;gap:.75rem;flex-wrap:wrap">${classes.map(c=>`<button class="btn btn-secondary btn-sm" onclick="SMS.generateReportCard('${c.id}')">${sanitize(c.name)}</button>`).join('')}</div>`;
    document.getElementById('receipt-title').textContent='Report Cards';
    document.getElementById('receipt-body').innerHTML=html;
    this.openModal('m-receipt');
  },

  generateReportCard(classId){
    const school=DB.get('school',{});
    const students=DB.get('students',[]).filter(s=>s.classId===classId&&s.status==='active');
    const grades=DB.get('grades',[]);
    const exams=DB.get('exams',[]).filter(e=>e.classId===classId);
    const cls=DB.get('classes',[]).find(c=>c.id===classId);
    const staff=DB.get('staff',[]);
    const gradeLabel=(p)=>{ if(p>=80)return{g:'A',r:'Excellent',c:'#16a34a'}; if(p>=70)return{g:'B',r:'Very Good',c:'#0d9488'}; if(p>=60)return{g:'C',r:'Good',c:'#2563eb'}; if(p>=50)return{g:'D',r:'Pass',c:'#d97706'}; return{g:'F',r:'Needs Improvement',c:'#dc2626'}; };
    const html=`<style>@media print{.no-print{display:none!important;}.report-card-page{page-break-after:always;}}</style>
    <div style="font-size:.82rem">${students.map((s,si)=>{
      const sGrades=grades.filter(g=>g.studentId===s.id&&exams.some(e=>e.id===g.examId));
      const totalPct=sGrades.length>0?sGrades.reduce((sum,g)=>{ const ex=exams.find(e=>e.id===g.examId); return sum+(g.score/(ex?.maxScore||100)*100); },0)/sGrades.length:0;
      const avg=Math.round(totalPct);
      const overall=gradeLabel(avg);
      // Rank among class
      const allAvgs=students.map(st=>{ const sg=grades.filter(g=>g.studentId===st.id&&exams.some(e=>e.id===g.examId)); return sg.length>0?Math.round(sg.reduce((sum,g)=>{ const ex=exams.find(e=>e.id===g.examId); return sum+(g.score/(ex?.maxScore||100)*100); },0)/sg.length):0; }).sort((a,b)=>b-a);
      const pos=allAvgs.indexOf(avg)+1;
      const posStr=pos===1?'1st':pos===2?'2nd':pos===3?'3rd':pos+'th';
      const classTeacher=staff.find(x=>x.id===cls?.teacherId);
      return `<div class="report-card-page" style="border:2px solid #1a3a6b;border-radius:12px;padding:1.25rem;margin-bottom:1.5rem;background:white;position:relative">
        <!-- Header -->
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:.75rem;padding-bottom:.75rem;border-bottom:3px solid #1a3a6b">
          <div style="display:flex;align-items:center;gap:.75rem">
            <div style="width:52px;height:52px;border-radius:50%;background:#1a3a6b;display:flex;align-items:center;justify-content:center;color:white;font-weight:800;font-size:1.1rem">${s.fname[0]}${s.lname[0]}</div>
            <div>
              <div style="font-family:'Playfair Display',serif;font-size:1.05rem;font-weight:800;color:#1a3a6b">${school.name||'School'}</div>
              <div style="font-size:.68rem;color:#666">${school.address||''} · ${school.phone||''}</div>
              <div style="font-size:.68rem;color:#0d9488;font-style:italic">${school.motto||'Excellence in All Things'}</div>
            </div>
          </div>
          <div style="text-align:right">
            <div style="font-size:.65rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#666;margin-bottom:.2rem">STUDENT REPORT CARD</div>
            <div style="font-size:.68rem;color:#888">${school.academicYear||'2025/2026'} · Term ${school.currentTerm||'2'}</div>
            <div style="font-size:.68rem;color:#888">Issued: ${new Date().toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})}</div>
          </div>
        </div>
        <!-- Student Info Band -->
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:.5rem;background:#f0f4f8;border-radius:8px;padding:.65rem .75rem;margin-bottom:.85rem">
          <div><div style="font-size:.6rem;color:#888;font-weight:700">STUDENT NAME</div><div style="font-weight:700;font-size:.82rem">${sanitize(s.fname)} ${sanitize(s.lname)}</div></div>
          <div><div style="font-size:.6rem;color:#888;font-weight:700">STUDENT ID</div><div style="font-weight:700;font-size:.82rem">${s.studentId}</div></div>
          <div><div style="font-size:.6rem;color:#888;font-weight:700">CLASS</div><div style="font-weight:700;font-size:.82rem">${cls?.name||'—'}</div></div>
          <div><div style="font-size:.6rem;color:#888;font-weight:700">POSITION</div><div style="font-weight:700;font-size:.82rem;color:#1a3a6b">${posStr} of ${students.length}</div></div>
        </div>
        <!-- Grades Table -->
        <table style="width:100%;border-collapse:collapse;font-size:.77rem;margin-bottom:.85rem">
          <thead>
            <tr style="background:#1a3a6b;color:white">
              <th style="padding:.45rem .6rem;text-align:left;border:1px solid #1a3a6b">Subject / Exam</th>
              <th style="padding:.45rem .6rem;text-align:center;border:1px solid #1a3a6b">Score</th>
              <th style="padding:.45rem .6rem;text-align:center;border:1px solid #1a3a6b">Max</th>
              <th style="padding:.45rem .6rem;text-align:center;border:1px solid #1a3a6b">%</th>
              <th style="padding:.45rem .6rem;text-align:center;border:1px solid #1a3a6b">Grade</th>
              <th style="padding:.45rem .6rem;text-align:left;border:1px solid #1a3a6b">Remark</th>
            </tr>
          </thead>
          <tbody>
            ${sGrades.map((g,gi)=>{ const ex=exams.find(e=>e.id===g.examId); const pct=Math.round(g.score/(ex?.maxScore||100)*100); const gl=gradeLabel(pct); return `<tr style="background:${gi%2===0?'#fafafa':'white'};border-bottom:1px solid #e5e7eb"><td style="padding:.38rem .6rem;border:1px solid #e5e7eb">${ex?.name||'—'}</td><td style="padding:.38rem .6rem;text-align:center;font-weight:700;border:1px solid #e5e7eb">${g.score}</td><td style="padding:.38rem .6rem;text-align:center;border:1px solid #e5e7eb">${ex?.maxScore||100}</td><td style="padding:.38rem .6rem;text-align:center;font-weight:700;border:1px solid #e5e7eb">${pct}%</td><td style="padding:.38rem .6rem;text-align:center;border:1px solid #e5e7eb"><span style="background:${gl.c}20;color:${gl.c};font-weight:700;padding:.15rem .4rem;border-radius:4px;font-size:.72rem">${gl.g}</span></td><td style="padding:.38rem .6rem;color:${gl.c};font-weight:600;border:1px solid #e5e7eb">${gl.r}</td></tr>`; }).join('')}
            <tr style="background:#1a3a6b20;font-weight:800">
              <td style="padding:.5rem .6rem;border:1px solid #ccc">OVERALL AVERAGE</td>
              <td colspan="2" style="border:1px solid #ccc"></td>
              <td style="padding:.5rem .6rem;text-align:center;color:#1a3a6b;font-size:.92rem;border:1px solid #ccc">${avg}%</td>
              <td style="padding:.5rem .6rem;text-align:center;border:1px solid #ccc"><span style="background:${overall.c}20;color:${overall.c};font-weight:800;padding:.2rem .5rem;border-radius:4px">${overall.g}</span></td>
              <td style="padding:.5rem .6rem;color:${overall.c};border:1px solid #ccc">${overall.r}</td>
            </tr>
          </tbody>
        </table>
        <!-- Comments & Signatures -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-bottom:.75rem">
          <div>
            <div style="font-size:.68rem;font-weight:700;text-transform:uppercase;color:#888;margin-bottom:.3rem">Class Teacher's Comment</div>
            <div style="border:1px solid #ddd;border-radius:6px;padding:.5rem;min-height:48px;font-size:.75rem;color:#555;background:#fafafa">${avg>=80?'Outstanding performance! Keep it up.':avg>=70?'Very commendable effort. Strive for more.':avg>=60?'Good work. With more effort you can do better.':avg>=50?'Satisfactory. Please put in more effort next term.':'Needs significant improvement. Let us work together.'}</div>
          </div>
          <div>
            <div style="font-size:.68rem;font-weight:700;text-transform:uppercase;color:#888;margin-bottom:.3rem">Head Teacher's Comment</div>
            <div style="border:1px solid #ddd;border-radius:6px;padding:.5rem;min-height:48px;background:#fafafa"></div>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:1rem;margin-top:.5rem">
          <div style="text-align:center"><div style="border-top:1px solid #999;padding-top:.3rem;font-size:.68rem;color:#888">Class Teacher: ${classTeacher?.fname||'—'} ${classTeacher?.lname||''}</div></div>
          <div style="text-align:center"><div style="border-top:1px solid #999;padding-top:.3rem;font-size:.68rem;color:#888">Head Teacher's Signature</div></div>
          <div style="text-align:center"><div style="border-top:1px solid #999;padding-top:.3rem;font-size:.68rem;color:#888">Parent/Guardian's Signature</div></div>
        </div>
        <!-- Footer -->
        <div style="text-align:center;font-size:.62rem;color:#aaa;padding-top:.5rem;margin-top:.5rem;border-top:1px solid #eee">Generated by Eduformium School Management System · ${new Date().toLocaleDateString()}</div>
      </div>`;
    }).join('')}</div>`;
    document.getElementById('receipt-body').innerHTML=html;
    document.getElementById('receipt-title').textContent=`Report Cards — ${cls?.name} (${students.length} students)`;
    this.openModal('m-receipt');
  },

  // ══ TIMETABLE ══
  loadTimetable(){
    const classes = DB.get('classes',[]);
    const sel = document.getElementById('tt-class-sel');
    if(sel){
      const current = sel.value;
      sel.innerHTML = '<option value="">— Select Class —</option>'+classes.map(c=>`<option value="${c.id}">${sanitize(c.name)}</option>`).join('');
      if(current) sel.value = current;
    }
    const editBtn = document.getElementById('edit-tt-btn');
    if(editBtn) editBtn.onclick = ()=>{
      const classId = document.getElementById('tt-class-sel').value;
      if(!classId){ this.toast('Please select a class first','warn'); return; }
      this.renderTimetable();
    };
    this.renderTimetable();
  },

  renderTimetable(){
    const classId = document.getElementById('tt-class-sel')?.value;
    const grid = document.getElementById('timetable-grid');
    if(!grid) return;
    if(!classId){
      const classes = DB.get('classes',[]);
      grid.innerHTML = `<div style="text-align:center;padding:3rem 1rem;color:var(--t4)">
        <div style="margin-bottom:.75rem;display:flex;justify-content:center"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" style="width:48px;height:48px;color:var(--t4)"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg></div>
        <div style="font-weight:600;margin-bottom:.4rem;color:var(--t2)">Select a class to view its timetable</div>
        <div style="font-size:.82rem">Use <strong>Design Structure</strong> to customise days, periods and times</div>
      </div>`;
      return;
    }
    grid.innerHTML = this._buildTTTable(classId, true);
  },

  openTimetableSlot(classId,day,periodId){
    periodId=decodeURIComponent(periodId);
    const struct = this.getTTStructure();
    const period = struct.periods.find(p=>p.id===periodId);
    const timetable=DB.get('timetable',{}); const classData=timetable[classId]||{};
    const slot=classData[day]?.[periodId]||{};
    const subjects=DB.get('subjects',[]).filter(s=>!s.classId||s.classId===classId);
    const staff=DB.get('staff',[]);
    const periodLabel = period ? `${period.label} (${period.from}–${period.to})` : periodId;
    document.getElementById('receipt-title').textContent=`${day} · ${periodLabel}`;
    document.getElementById('receipt-body').innerHTML=`
      <div style="display:grid;gap:.75rem;margin-top:.25rem">
        <div><label style="font-size:.8rem;font-weight:600;color:var(--t2);display:block;margin-bottom:.3rem">Subject</label>
          <input id="tt-subj-inp" list="tt-subj-list" value="${slot.subject||''}" placeholder="Type or select subject…" class="form-input" style="width:100%">
          <datalist id="tt-subj-list">${subjects.map(s=>`<option value="${sanitize(s.name)}">`).join('')}</datalist></div>
        <div><label style="font-size:.8rem;font-weight:600;color:var(--t2);display:block;margin-bottom:.3rem">Teacher</label>
          <input id="tt-teacher-inp" list="tt-teacher-list" value="${slot.teacher||''}" placeholder="Type or select teacher…" class="form-input" style="width:100%">
          <datalist id="tt-teacher-list">${staff.map(s=>`<option value="${s.fname+' '+s.lname}">`).join('')}</datalist></div>
        <div style="display:flex;gap:.5rem;justify-content:flex-end;margin-top:.25rem">
          ${slot.subject?`<button class="btn btn-secondary btn-sm" onclick="SMS.clearTimetableSlot('${classId}','${day}','${periodId}')">Clear Slot</button>`:''}
          <button class="btn btn-primary btn-sm" onclick="SMS.saveTimetableSlot('${classId}','${day}','${periodId}')">Save</button>
        </div>
      </div>`;
    this.openModal('m-receipt');
  },

  saveTimetableSlot(classId,day,periodId){
    const subj=document.getElementById('tt-subj-inp').value.trim();
    const teacher=document.getElementById('tt-teacher-inp').value.trim();
    if(!subj){ this.toast('Enter a subject','warn'); return; }
    const timetable=DB.get('timetable',{});
    if(!timetable[classId]) timetable[classId]={};
    if(!timetable[classId][day]) timetable[classId][day]={};
    timetable[classId][day][periodId]={subject:subj,teacher};
    DB.set('timetable',timetable);
    this.closeModal('m-receipt'); this.renderTimetable();
    this.toast(`${subj} saved!`,'success');
  },

  clearTimetableSlot(classId,day,periodId){
    const timetable=DB.get('timetable',{});
    if(timetable[classId]?.[day]?.[periodId]) delete timetable[classId][day][periodId];
    DB.set('timetable',timetable); this.closeModal('m-receipt'); this.renderTimetable();
  },

  clearTimetable(classId){
    this.confirmDelete('Clear entire timetable for this class?',()=>{
      const timetable=DB.get('timetable',{}); delete timetable[classId]; DB.set('timetable',timetable); this.renderTimetable(); this.toast('Timetable cleared','warn');
    });
  },

  // ══ HOMEWORK ══
  loadHomework(){ this.renderHomework(); },

  renderHomework(){
    const hw=DB.get('homework',[]); const cf=document.getElementById('hw-class-f')?.value; const sf=document.getElementById('hw-status-f')?.value;
    let filtered=hw.filter(h=>{ if(cf&&h.classId!==cf) return false; if(sf&&h.status!==sf) return false; return true; });
    const colors={pending:'var(--warn-bg)',submitted:'var(--info-bg)',graded:'var(--success-bg)'};
    const border={pending:'var(--warn)',submitted:'var(--info)',graded:'var(--success)'};
    document.getElementById('hw-cards').innerHTML=filtered.map(h=>`
      <div class="hw-card" style="border-left:4px solid ${border[h.status]||'var(--border)'}">
        <div class="hw-card-top">
          <div class="hw-card-title">${sanitize(h.title)}</div>
          ${statusBadge(h.status)}
        </div>
        <div class="hw-card-meta">${this.className(h.classId)} · ${this.subjectName(h.subjectId)}</div>
        <div class="hw-card-desc">${h.desc}</div>
        <div class="hw-card-footer">
          <span>Due: <strong>${fmtDate(h.dueDate)}</strong></span>
          <span>Assigned: ${fmtDate(h.assignedDate)}</span>
          <div style="display:flex;gap:.4rem;margin-left:auto"><button class="btn btn-ghost btn-sm" onclick="SMS.openHomeworkModal('${h.id}')" style="color:var(--brand);padding:.25rem .5rem;font-size:.72rem"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:12px;height:12px;margin-right:.25rem;vertical-align:-.1em"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>Edit</button><button class="btn btn-ghost btn-sm" onclick="SMS.confirmDelete('Delete this homework?',()=>SMS.deleteHomework('${h.id}'))" style="color:var(--danger);padding:.25rem .5rem;font-size:.72rem"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:12px;height:12px;margin-right:.25rem;vertical-align:-.1em"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>Delete</button></div>
        </div>
      </div>`).join('')||'<div style="color:var(--t4);padding:1.5rem">No homework assignments found.</div>';
  },

  // ══ PAYROLL ══
  loadPayroll(){ this.renderPayroll(); },

  renderPayroll(){
    const staff=DB.get('staff',[]); const month=document.getElementById('pay-month')?.value; const year=document.getElementById('pay-year')?.value;
    const saved=DB.get('payroll',[]).filter(p=>p.month==month&&p.year==year);
    const totalBasic=staff.reduce((s,x)=>s+(+x.salary||0),0);
    document.getElementById('payroll-kpis').innerHTML=[
      {icon:'staff',val:staff.length,lbl:'Staff Members',color:'blue'},
      {icon:'fees',val:fmt(totalBasic),lbl:'Total Basic Salary',color:'teal'},
      {icon:'check',val:saved.length,lbl:'Processed This Month',color:'green'},
      {icon:'pending',val:staff.length-saved.length,lbl:'Pending',color:'amber'},
    ].map(k=>`<div class="kpi-card"><div class="kpi-icon ${k.color}">${SMS._kpiSvg(k.icon)}</div><div class="kpi-val">${k.val}</div><div class="kpi-label">${k.lbl}</div></div>`).join('');
    document.getElementById('payroll-tbody').innerHTML=staff.map(s=>{
      const p=saved.find(x=>x.staffId===s.id);
      const basic=+s.salary||0, allow=basic*0.15, deduct=basic*0.05, net=basic+allow-deduct;
      return `<tr>
        <td style="font-weight:600">${sanitize(s.fname)} ${sanitize(s.lname)}</td>
        <td><span class="badge badge-info">${sanitize(s.role)}</span></td>
        <td>${fmt(basic)}</td>
        <td>${fmt(allow)}</td>
        <td style="color:var(--danger)">${fmt(deduct)}</td>
        <td style="font-weight:800;color:var(--brand)">${fmt(net)}</td>
        <td>${p?statusBadge('active'):`<span class="badge badge-warn">Pending</span>`}</td>
        <td><button class="btn btn-ghost btn-sm" onclick="SMS.payStaff('${s.id}',${net},'${month}','${year}')" style="padding:.3rem .6rem">${p?'Paid':'Pay'}</button></td>
      </tr>`;
    }).join('')||SMS._emptyState('staff','No Staff Found','Add staff members to run payroll.','');
  },

  processPayroll(){
    const staff=DB.get('staff',[]); const month=document.getElementById('pay-month')?.value; const year=document.getElementById('pay-year')?.value;
    const payroll=DB.get('payroll',[]); let count=0;
    staff.forEach(s=>{ if(!payroll.find(p=>p.staffId===s.id&&p.month==month&&p.year==year)){ const basic=+s.salary||0,allow=basic*0.15,deduct=basic*0.05,net=basic+allow-deduct; payroll.push({id:uid('pr'),staffId:s.id,month,year,basic,allowances:allow,deductions:deduct,net,date:new Date().toISOString(),paidBy:this.currentUser.id}); count++; } });
    DB.set('payroll',payroll); this.audit('Payroll','create',`Processed payroll for ${month}/${year}: ${count} staff`); this.toast(`Payroll processed for ${count} staff!`,'success'); this.renderPayroll();
  },

  payStaff(staffId,net,month,year){
    const payroll=DB.get('payroll',[]); if(payroll.find(p=>p.staffId===staffId&&p.month==month&&p.year==year)){ this.toast('Already processed for this month','warn'); return; }
    const s=DB.get('staff',[]).find(x=>x.id===staffId); const basic=+s.salary||0,allow=basic*0.15,deduct=basic*0.05;
    payroll.push({id:uid('pr'),staffId,month,year,basic,allowances:allow,deductions:deduct,net,date:new Date().toISOString(),paidBy:this.currentUser.id});
    DB.set('payroll',payroll); this.audit('Payroll','create',`Paid ${sanitize(s.fname)} ${sanitize(s.lname)}: ${fmt(net)}`); this.toast(`${s.fname} paid ${fmt(net)}`,'success'); this.renderPayroll();
  },

  exportPayroll(){
    if(typeof XLSX==='undefined'){ this.toast('Export library not loaded','error'); return; }
    const staff=DB.get('staff',[]); const payroll=DB.get('payroll',[]);
    const month=document.getElementById('pay-month')?.value; const year=document.getElementById('pay-year')?.value;
    const saved=payroll.filter(p=>p.month==month&&p.year==year);
    const data=saved.map(p=>{ const s=staff.find(x=>x.id===p.staffId); return {'Staff Name':s?s.fname+' '+s.lname:'Unknown','Role':s?.role||'—','Department':s?.dept||'—','Basic Salary':p.basic,'Allowances':p.allowances,'Deductions':p.deductions,'Net Pay':p.net,'Month':p.month,'Year':p.year,'Date Paid':p.date?new Date(p.date).toLocaleDateString():'—'}; });
    const ws=XLSX.utils.json_to_sheet(data); const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,ws,'Payroll');
    XLSX.writeFile(wb,`Payroll_${month}_${year}.xlsx`);
    this.audit('Payroll Export','settings',`Payroll exported for ${month}/${year}`);
    this.toast('Payroll exported!','success');
  },

  // ══ LEAVE ══
  loadLeave(){ this.renderLeave(); },

  renderLeave(){
    const leaves=DB.get('leaves',[]); const staff=DB.get('staff',[]);
    const stats=[{val:leaves.filter(l=>l.status==='pending').length,lbl:'Pending'},{val:leaves.filter(l=>l.status==='approved').length,lbl:'Approved'},{val:leaves.filter(l=>l.status==='rejected').length,lbl:'Rejected'}];
    document.getElementById('leave-stats').innerHTML=stats.map(s=>`<div class="stat-pill"><div><div class="stat-pill-val">${s.val}</div><div class="stat-pill-lbl">${s.lbl}</div></div></div>`).join('');
    document.getElementById('leave-tbody').innerHTML=leaves.map(l=>{
      const s=staff.find(x=>x.id===l.staffId);
      return `<tr>
        <td style="font-weight:600">${s?s.fname+' '+s.lname:'Unknown'}</td>
        <td><span class="badge badge-info">${l.type}</span></td>
        <td>${fmtDate(l.from)}</td>
        <td>${fmtDate(l.to)}</td>
        <td style="font-weight:700">${l.days}</td>
        <td style="max-width:200px;font-size:.8rem;color:var(--t3)">${l.reason}</td>
        <td>${statusBadge(l.status)}</td>
        <td>${l.status==='pending'?`<div style="display:flex;gap:.3rem"><button class="btn btn-success btn-sm" onclick="SMS.updateLeave('${l.id}','approved')" style="padding:.3rem .6rem;font-size:.72rem">Approve</button><button class="btn btn-danger btn-sm" onclick="SMS.updateLeave('${l.id}','rejected')" style="padding:.3rem .6rem;font-size:.72rem">Reject</button></div>`:''}</td>
      </tr>`;
    }).join('')||SMS._emptyState('default','No Leave Requests','Staff leave requests will appear here once submitted.','');
  },

  updateLeave(id,status){ const leaves=DB.get('leaves',[]); const i=leaves.findIndex(l=>l.id===id); if(i>-1){ leaves[i].status=status; DB.set('leaves',leaves); } this.audit('Leave','edit',`Leave ${status}: ${id}`); this.toast(`Leave ${status}`,'success'); this.renderLeave(); },

  // ══ FEES ══
  loadFees(){
    const classes=DB.get('classes',[]);
    const sel=document.getElementById('fee-class-f'); if(sel) sel.innerHTML='<option value="">All Classes</option>'+classes.map(c=>`<option value="${c.id}">${sanitize(c.name)}</option>`).join('');
    const fstu=document.getElementById('fee-student'); if(fstu){ const students=DB.get('students',[]); fstu.innerHTML='<option value="">— Select Student —</option>'+students.map(s=>`<option value="${s.id}">${sanitize(s.fname)} ${sanitize(s.lname)} (${this.className(s.classId)})</option>`).join(''); }
    // Populate year filter
    const yearSel=document.getElementById('fee-year-f');
    if(yearSel){
      const years=getAllAcademicYears();
      yearSel.innerHTML=years.map(y=>`<option value="${y.year}"${y.year===_academicYear?' selected':''}>${y.year}${y.isCurrent?' (Current)':''}</option>`).join('');
    }
    // Populate fee modal year dropdown
    const fmYear=document.getElementById('fee-academic-year');
    if(fmYear){
      const years=getAllAcademicYears();
      fmYear.innerHTML=years.map(y=>`<option value="${y.year}"${y.year===_academicYear?' selected':''}>${y.year}${y.isCurrent?' (Current)':''}</option>`).join('');
    }
    this.renderFeesKpis(); this.renderFees(); this.renderFeeStructure(); this.renderDefaulters();
  },

  renderFeesKpis(){
    const yearFilter=document.getElementById('fee-year-f')?.value||_academicYear;
    const payments=DB.get('feePayments',[]).filter(p=>!p.academicYear||p.academicYear===yearFilter);
    const students=DB.get('students',[]).filter(s=>s.status==='active');
    const totalCollected=payments.reduce((s,p)=>s+(+p.amount||0),0);
    // Outstanding = all 3 terms for selected year, active students only
    let outstanding=0, defaulterCount=0;
    students.forEach(s=>{
      const fs=getYearStructure(s.classId,yearFilter);
      if(!fs) return;
      const yf=getYearFees(s,yearFilter);
      const t1=+(fs.term1||0), t2=+(fs.term2||0), t3=+(fs.term3||0);
      const owed=Math.max(0,t1-(+(yf.term1||0)))+Math.max(0,t2-(+(yf.term2||0)))+Math.max(0,t3-(+(yf.term3||0)));
      if(owed>0){ outstanding+=owed; defaulterCount++; }
    });
    document.getElementById('fees-kpis').innerHTML=[
      {icon:'fees',val:fmt(totalCollected),lbl:'Total Collected',color:'teal'},
      {icon:'transactions',val:payments.length,lbl:'Transactions',color:'blue'},
      {icon:'warning',val:defaulterCount,lbl:'Defaulters',color:'amber'},
      {icon:'outstanding',val:fmt(outstanding),lbl:'Outstanding Balance',color:'red'},
    ].map(k=>`<div class="kpi-card"><div class="kpi-icon ${k.color}">${SMS._kpiSvg(k.icon)}</div><div class="kpi-val">${k.val}</div><div class="kpi-label">${k.lbl}</div></div>`).join('');
  },

  renderFees(){
    const payments=DB.get('feePayments',[]); const students=DB.get('students',[]);
    const feeStructure=DB.get('feeStructure',[]);
    const q=(document.getElementById('fee-search')?.value||'').toLowerCase();
    const cf=document.getElementById('fee-class-f')?.value||'';
    const tf=document.getElementById('fee-term-f')?.value||'';
    const yf=document.getElementById('fee-year-f')?.value||_academicYear;
    let filtered=payments.filter(p=>{
      const s=students.find(x=>x.id===p.studentId);
      if(!s) return false; if(cf&&s.classId!==cf) return false; if(tf&&p.term!==tf) return false;
      if(yf&&p.academicYear&&p.academicYear!==yf) return false;
      if(q&&!`${sanitize(s.fname)} ${sanitize(s.lname)} ${p.receiptNo||''}`.toLowerCase().includes(q)) return false; return true;
    }).sort((a,b)=>b.date.localeCompare(a.date));
    document.getElementById('fees-tbody').innerHTML=filtered.map(p=>{
      const s=students.find(x=>x.id===p.studentId);
      // Work out if this term is fully paid for the student
      const pYear=p.academicYear||_academicYear;
      const fs=s?getYearStructure(s.classId,pYear):null;
      const sfyf=s?getYearFees(s,pYear):{term1:0,term2:0,term3:0};
      const termDue=fs?+(fs['term'+p.term]||0):0;
      const termPaid=+(sfyf['term'+p.term]||0);
      const termOwed=Math.max(0,termDue-termPaid);
      const termStatus=termDue===0
        ? `<span class="badge badge-neutral">No structure</span>`
        : termOwed===0
          ? `<span class="badge badge-success">Term ${p.term} Fully Paid</span>`
          : `<span class="badge badge-warn">Balance: ${fmt(termOwed)}</span>`;
      const t1=+(fs?.term1||0),t2=+(fs?.term2||0),t3=+(fs?.term3||0);
      const totalOwed=s&&fs?Math.max(0,t1-(+(sfyf.term1||0)))+Math.max(0,t2-(+(sfyf.term2||0)))+Math.max(0,t3-(+(sfyf.term3||0))):0;
      return `<tr>
        <td style="font-family:monospace;font-size:.75rem;color:var(--t3);white-space:nowrap">${p.receiptNo||'—'}</td>
        <td><div style="font-weight:600;color:var(--t1);white-space:nowrap">${s?sanitize(s.fname)+' '+sanitize(s.lname):'Unknown'}</div><div style="font-size:.72rem;color:var(--t4)">${this.className(s?.classId)}</div></td>
        <td style="white-space:nowrap;text-align:center"><span class="badge badge-info">Term ${p.term}</span></td>
        <td style="font-weight:800;color:var(--success);white-space:nowrap;text-align:center">${fmt(p.amount)}</td>
        <td style="white-space:nowrap;text-align:center">${termStatus}</td>
        <td style="font-weight:700;white-space:nowrap;text-align:center;color:${totalOwed>0?'var(--danger)':'var(--success)'}">${totalOwed>0?fmt(totalOwed)+' owed':'All Clear'}</td>
        <td style="white-space:nowrap;text-align:center"><span class="badge badge-neutral">${p.method}</span></td>
        <td style="white-space:nowrap;font-size:.82rem;color:var(--t3)">${fmtDate(p.date)}</td>
        <td style="font-size:.82rem;color:var(--t3)">${p.by||'—'}</td>
        <td><div style="display:flex;gap:.3rem">
          <button class="btn btn-ghost btn-sm" onclick="SMS.showReceipt('${p.id}')" style="padding:.3rem .5rem" title="View Receipt"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg></button>
          ${this.currentUser?.role==='admin'?`<button class="btn btn-ghost btn-sm" onclick="SMS.openReversePaymentModal('${p.id}')" style="padding:.3rem .5rem;color:var(--danger)" title="Reverse Payment"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/></svg></button>`:''}
        </div></td>
      </tr>`;
    }).join('')||SMS._emptyState('fees','No Payments Found','Record your first fee payment or adjust the filters above.','+ Record Payment',"SMS.openFeeModal()");
  },

  renderFeeStructure(){
    const yearFilter=document.getElementById('fee-year-f')?.value||_academicYear;
    const fs=DB.get('feeStructure',[]).filter(f=>!f.year||f.year===yearFilter); const classes=DB.get('classes',[]);
    document.getElementById('fee-struct-tbody').innerHTML=fs.map(f=>{
      const cls=classes.find(c=>c.id===f.classId);
      const total=(+f.term1||0)+(+f.term2||0)+(+f.term3||0);
      return `<tr>
        <td style="font-weight:600">${cls?.name||'—'}</td>
        <td>${fmt(f.term1)}</td><td>${fmt(f.term2)}</td><td>${fmt(f.term3)}</td>
        <td class="fee-struct-total">${fmt(total)}</td>
        <td style="font-size:.75rem;color:var(--t3)">${f.includes||'Tuition, Books, Activities'}</td>
        <td><button class="btn btn-ghost btn-sm" onclick="SMS.openFeeStructModal('${f.classId}')" style="padding:.3rem .5rem;color:var(--brand)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button></td>
      </tr>`;
    }).join('')||SMS._emptyState('fees','No Fee Structure Set','Define term fees for each class so the system can track balances.','');
  },

  renderDefaulters(){
    const students=DB.get('students',[]); const classes=DB.get('classes',[]);
    const yearFilter=document.getElementById('fee-year-f')?.value||_academicYear;
    const defaulters=students.filter(s=>{
      if(s.status!=='active') return false;
      const fs=getYearStructure(s.classId,yearFilter); if(!fs) return false;
      const yf=getYearFees(s,yearFilter);
      const t1=+(fs.term1||0), t2=+(fs.term2||0), t3=+(fs.term3||0);
      return (+(yf.term1||0))<t1 || (+(yf.term2||0))<t2 || (+(yf.term3||0))<t3;
    });
    document.getElementById('defaulters-tbody').innerHTML=defaulters.map(s=>{
      const fs=getYearStructure(s.classId,yearFilter);
      const yf=getYearFees(s,yearFilter);
      const t1=+(fs?.term1||0), t2=+(fs?.term2||0), t3=+(fs?.term3||0);
      const owed1=Math.max(0,t1-(+(yf.term1||0)));
      const owed2=Math.max(0,t2-(+(yf.term2||0)));
      const owed3=Math.max(0,t3-(+(yf.term3||0)));
      return `<tr>
        <td style="font-weight:600">${sanitize(s.fname)} ${sanitize(s.lname)}</td>
        <td>${this.className(s.classId)}</td>
        <td>${s.dadPhone||'—'}</td>
        <td style="color:${owed1>0?'var(--danger)':'var(--success)'};font-weight:600">${owed1>0?fmt(owed1):'Paid'}</td>
        <td style="color:${owed2>0?'var(--danger)':'var(--success)'};font-weight:600">${owed2>0?fmt(owed2):'Paid'}</td>
        <td style="color:${owed3>0?'var(--danger)':'var(--success)'};font-weight:600">${owed3>0?fmt(owed3):'Paid'}</td>
        <td style="font-weight:800;color:var(--danger)">${fmt(owed1+owed2+owed3)}</td>
        <td>
          <div style="display:flex;gap:.3rem">
            <button class="btn btn-primary btn-sm" onclick="SMS.openFeeModal('${s.id}')" style="font-size:.73rem;padding:.3rem .6rem">Pay Now</button>
            <button class="btn btn-secondary btn-sm" onclick="SMS.sendFeeReminder('${s.id}')" style="font-size:.73rem;padding:.3rem .6rem" title="Send SMS Reminder"><svg style="width:13px;height:13px;vertical-align:middle;margin-right:0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg></button>
          </div>
        </td>
      </tr>`;
    }).join('')||'<tr><td colspan="8" class="tbl-empty">All fees paid — no defaulters</td></tr>';
  },

  // ══ FEE REMINDER (Alert/Simulate SMS) ══
  sendFeeReminder(studentId){
    const s=DB.get('students',[]).find(x=>x.id===studentId); if(!s) return;
    const feeStructure=DB.get('feeStructure',[]);
    const fs=getYearStructure(s.classId,_academicYear);
    const _ryf=getYearFees(s,_academicYear);
    const t1=+(fs?.term1||0), t2=+(fs?.term2||0), t3=+(fs?.term3||0);
    const owed1=Math.max(0,t1-(+(_ryf.term1||0)));
    const owed2=Math.max(0,t2-(+(_ryf.term2||0)));
    const owed3=Math.max(0,t3-(+(_ryf.term3||0)));
    const total=owed1+owed2+owed3;
    const school=DB.get('school',{});
    const msg=`Dear ${s.dadName||'Parent'}, your ward ${sanitize(s.fname)} ${sanitize(s.lname)} (${this.className(s.classId)}) has an outstanding fee balance of ${fmt(total)}. Please contact ${school.name||'the school'} at ${school.phone||'our office'} to make payment. Thank you.`;
    // Show simulated reminder modal
    document.getElementById('receipt-title').textContent='Fee Reminder Preview';
    document.getElementById('receipt-body').innerHTML=`
      <div style="background:var(--brand-lt);border:1px solid var(--brand-lt2);border-radius:10px;padding:1rem;margin-bottom:1rem">
        <div style="font-size:.72rem;font-weight:700;text-transform:uppercase;color:var(--t3);margin-bottom:.4rem">SMS Message to ${s.dadPhone||'No phone on record'}</div>
        <div style="font-size:.88rem;color:var(--t1);line-height:1.6">${msg}</div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:.75rem;font-size:.82rem">
        <div><div style="font-size:.7rem;color:var(--t4);font-weight:700">STUDENT</div><div style="font-weight:600">${sanitize(s.fname)} ${sanitize(s.lname)}</div></div>
        <div><div style="font-size:.7rem;color:var(--t4);font-weight:700">AMOUNT OWED</div><div style="font-weight:700;color:var(--danger)">${fmt(total)}</div></div>
        <div><div style="font-size:.7rem;color:var(--t4);font-weight:700">PARENT PHONE</div><div>${s.dadPhone||s.momPhone||'Not on record'}</div></div>
        <div><div style="font-size:.7rem;color:var(--t4);font-weight:700">CLASS</div><div>${this.className(s.classId)}</div></div>
      </div>
      <div style="margin-top:1rem;padding:.75rem;background:var(--warn-bg);border-radius:8px;font-size:.78rem;color:var(--t2)">
        <svg style="width:13px;height:13px;vertical-align:middle;margin-right:4px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>Configure your SMS gateway in Settings → SMS Notifications to send real messages. This preview shows what will be sent.
      </div>`;
    this.audit('Fee Reminder','create',`Fee reminder sent to parent of ${sanitize(s.fname)} ${sanitize(s.lname)}`);
    this.openModal('m-receipt');
  },

  sendBulkReminders(){
    const students=DB.get('students',[]); const feeStructure=DB.get('feeStructure',[]);
    const defaulters=students.filter(s=>{
      if(s.status!=='active') return false;
      const fs=getYearStructure(s.classId,_academicYear); if(!fs) return false;
      const yf=getYearFees(s,_academicYear);
      const t1=+(fs.term1||0), t2=+(fs.term2||0), t3=+(fs.term3||0);
      return (+(yf.term1||0))<t1 || (+(yf.term2||0))<t2 || (+(yf.term3||0))<t3;
    });
    if(defaulters.length===0){ this.toast('No defaulters — all fees are paid!','success'); return; }
    this.audit('Fee Reminder','create',`Bulk reminders queued for ${defaulters.length} defaulters`);
    this.toast(`${defaulters.length} reminders queued! Configure SMS gateway in Settings to send.`,'success');
  },

  // ══ STUDENT PROMOTION ══
  openPromoteModal(){
    const classes=DB.get('classes',[]).sort((a,b)=>a.name.localeCompare(b.name));
    document.getElementById('receipt-title').textContent='Year-End Student Promotion';
    document.getElementById('receipt-body').innerHTML=`
      <div style="margin-bottom:1rem;font-size:.85rem;color:var(--t3)">Promote all active students in a class to the next class level.</div>
      <div class="form-grid-2" style="margin-bottom:1rem">
        <div class="form-field">
          <label class="form-label">From Class *</label>
          <select class="form-input" id="promo-from">${classes.map(c=>`<option value="${c.id}">${sanitize(c.name)}</option>`).join('')}</select>
        </div>
        <div class="form-field">
          <label class="form-label">To Class *</label>
          <select class="form-input" id="promo-to"><option value="">— Select Target Class —</option>${classes.map(c=>`<option value="${c.id}">${sanitize(c.name)}</option>`).join('')}</select>
        </div>
      </div>
      <div style="background:var(--warn-bg);border:1px solid var(--warn);border-radius:8px;padding:.75rem;font-size:.78rem;color:var(--t2);margin-bottom:1rem">
        <svg style="width:13px;height:13px;vertical-align:middle;margin-right:4px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>This will move all <strong>active</strong> students from the selected class to the target class. This action can be undone by promoting them back.
      </div>
      <div id="promo-preview" style="font-size:.82rem;color:var(--t3)"></div>
      <div style="margin-top:1rem;display:flex;gap:.75rem">
        <button class="btn btn-secondary btn-sm" onclick="SMS.previewPromotion()">Preview</button>
        <button class="btn btn-primary" onclick="SMS.executePromotion()">Promote Students</button>
      </div>`;
    // Live preview on change
    setTimeout(()=>{
      document.getElementById('promo-from')?.addEventListener('change',()=>SMS.previewPromotion());
      document.getElementById('promo-to')?.addEventListener('change',()=>SMS.previewPromotion());
    },100);
    this.openModal('m-receipt');
  },

  previewPromotion(){
    const fromId=document.getElementById('promo-from')?.value;
    const toId=document.getElementById('promo-to')?.value;
    const prev=document.getElementById('promo-preview'); if(!prev) return;
    if(!fromId||!toId||fromId===toId){ prev.innerHTML=''; return; }
    const students=DB.get('students',[]).filter(s=>s.classId===fromId&&s.status==='active');
    prev.innerHTML=`<strong>${students.length} student(s)</strong> will be promoted: ${students.slice(0,5).map(s=>`${sanitize(s.fname)} ${sanitize(s.lname)}`).join(', ')}${students.length>5?` +${students.length-5} more`:''}`;
  },

  executePromotion(){
    const fromId=document.getElementById('promo-from')?.value;
    const toId=document.getElementById('promo-to')?.value;
    if(!fromId||!toId||fromId===toId){ this.toast('Select two different classes','warn'); return; }
    const students=DB.get('students',[]);
    const promotedIds=[]; let count=0;
    students.forEach(s=>{ if(s.classId===fromId&&s.status==='active'){ s.classId=toId; if(!s.feesPaid||typeof s.feesPaid.term1==='number') s.feesPaid={}; s.feesPaid[_academicYear]={term1:0,term2:0,term3:0}; promotedIds.push(s.id); count++; } });
    DB.set('students',students);
    // Clear old fee payment records for promoted students so feesPaid stays in sync
    const orphanPromo=DB.get('feePayments',[]).filter(p=>promotedIds.includes(p.studentId));
    DB.set('feePayments',DB.get('feePayments',[]).filter(p=>!promotedIds.includes(p.studentId)));
    // Also delete from Firestore so they don't return on refresh
    const _sid=window.SMS&&window.SMS.schoolId;
    if(_sid&&window.FDB) orphanPromo.forEach(p=>FDB.delete(_sid,'feePayments',p.id).catch(()=>{}));
    this.audit('Student Promotion','edit',`Promoted ${count} students from ${this.className(fromId)} to ${this.className(toId)}`);
    this.toast(`${count} students successfully promoted to ${this.className(toId)}!`,'success');
    this.closeModal('m-receipt'); this.renderStudents(); this.renderStudentStats();
  },

  // ══ BULK IMPORT STUDENTS via CSV/XLSX ══
  openImportModal(){
    document.getElementById('receipt-title').textContent='Import Students';
    document.getElementById('receipt-body').innerHTML=`
      <div style="margin-bottom:.75rem;font-size:.85rem;color:var(--t3)">Upload a CSV or Excel file to import multiple students at once.</div>
      <div style="background:var(--surface-2);border:2px dashed var(--border);border-radius:10px;padding:1.5rem;text-align:center;margin-bottom:1rem">
        <div style="margin-bottom:.5rem;display:flex;justify-content:center"><svg style="width:28px;height:28px;color:var(--t3)" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></div>
        <div style="font-size:.85rem;font-weight:600;margin-bottom:.25rem">Drop CSV / Excel file here</div>
        <div style="font-size:.75rem;color:var(--t4);margin-bottom:.75rem">Required columns: First Name, Last Name, Class, Gender, DOB, Parent Name, Parent Phone</div>
        <input type="file" id="import-file" accept=".csv,.xlsx,.xls" style="display:none" onchange="SMS.handleImportFile(event)"/>
        <button class="btn btn-secondary btn-sm" onclick="document.getElementById('import-file').click()">Choose File</button>
      </div>
      <div style="margin-bottom:1rem">
        <a href="#" onclick="SMS.downloadImportTemplate();return false;" style="font-size:.82rem;color:var(--brand-teal);text-decoration:underline"><svg style="width:13px;height:13px;vertical-align:middle;margin-right:4px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>Download Template CSV</a>
      </div>
      <div id="import-preview" style="font-size:.82rem"></div>`;
    this.openModal('m-receipt');
  },

  downloadImportTemplate(){
    if(typeof XLSX==='undefined'){ this.toast('Export library not loaded','error'); return; }
    const template=[{'First Name':'Kwame','Last Name':'Asante','Class':'JHS 1','Gender':'Male','Date of Birth':'2012-01-15','Parent Name':'Kofi Asante','Parent Phone':'+233 24 123 4567','Address':'Accra, Ghana','Student ID':''}];
    const ws=XLSX.utils.json_to_sheet(template); const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,ws,'Students');
    XLSX.writeFile(wb,'StudentImportTemplate.xlsx');
    this.toast('Template downloaded!','success');
  },

  handleImportFile(e){
    const file=e.target.files[0]; if(!file) return;
    if(typeof XLSX==='undefined'){ this.toast('Import library not loaded','error'); return; }
    const reader=new FileReader();
    reader.onload=ev=>{
      try{
        const data=new Uint8Array(ev.target.result);
        const wb=XLSX.read(data,{type:'array'});
        const ws=wb.Sheets[wb.SheetNames[0]];
        const rows=XLSX.utils.sheet_to_json(ws);
        if(rows.length===0){ document.getElementById('import-preview').innerHTML='<div style="color:var(--danger)">No data found in file.</div>'; return; }
        const classes=DB.get('classes',[]);
        let valid=0, errors=[];
        const toImport=rows.map((r,i)=>{
          const fname=(r['First Name']||r['fname']||'').trim();
          const lname=(r['Last Name']||r['lname']||'').trim();
          const clsName=(r['Class']||r['class']||'').trim();
          const gender=(r['Gender']||r['gender']||'').trim();
          const cls=classes.find(c=>c.name.toLowerCase()===clsName.toLowerCase()||c.id===clsName);
          if(!fname||!lname||!cls||!gender){ errors.push(`Row ${i+2}: Missing required fields`); return null; }
          valid++;
          return {id:uid('stu'),studentId:`IMP-${Date.now()}-${i}`,fname,lname,classId:cls.id,gender,dob:r['Date of Birth']||r['dob']||'',dadName:r['Parent Name']||r['dadName']||'',dadPhone:r['Parent Phone']||r['dadPhone']||'',address:r['Address']||'',status:'active',admitDate:new Date().toISOString().split('T')[0],feesPaid:{term1:0,term2:0,term3:0}};
        }).filter(Boolean);
        document.getElementById('import-preview').innerHTML=`
          <div style="background:var(--success-bg);border-radius:8px;padding:.75rem;margin-bottom:.75rem"><strong>${valid} student(s)</strong> ready to import from ${rows.length} rows.</div>
          ${errors.length>0?`<div style="background:var(--danger-bg);border-radius:8px;padding:.75rem;margin-bottom:.75rem;font-size:.75rem;color:var(--danger)">${errors.slice(0,5).join('<br>')}</div>`:''}
          <div style="overflow-x:auto;max-height:200px;overflow-y:auto;font-size:.75rem;border:1px solid var(--border);border-radius:8px">
            <table class="tbl" style="font-size:.73rem"><thead><tr><th>Name</th><th>Class</th><th>Gender</th><th>Parent</th></tr></thead><tbody>
            ${toImport.slice(0,10).map(s=>`<tr><td>${sanitize(s.fname)} ${sanitize(s.lname)}</td><td>${this.className(s.classId)}</td><td>${s.gender}</td><td>${s.dadName||'—'}</td></tr>`).join('')}
            ${toImport.length>10?`<tr><td colspan="4" style="text-align:center;color:var(--t4)">+${toImport.length-10} more...</td></tr>`:''}
            </tbody></table>
          </div>
          <button class="btn btn-primary" style="margin-top:.75rem" id="do-import-btn">Import ${valid} Students</button>`;
        // Store safely in memory — never pass via onclick attribute
        SMS._pendingImport = toImport;
        setTimeout(()=>{
          document.getElementById('do-import-btn')?.addEventListener('click',()=>SMS.confirmImport());
        },50);
      }catch(err){ document.getElementById('import-preview').innerHTML=`<div style="color:var(--danger)">Error reading file: ${err.message}</div>`; }
    };
    reader.readAsArrayBuffer(file);
  },

  confirmImport(){
    const toImport=this._pendingImport;
    if(!toImport||!toImport.length){ this.toast('No import data found','error'); return; }
    this._pendingImport=null;
    const students=DB.get('students',[]); students.push(...toImport); DB.set('students',students);
    this.audit('Bulk Import','create',`Imported ${toImport.length} students via file upload`);
    this.toast(`${toImport.length} students imported successfully!`,'success');
    // Refresh fee modal student dropdown so imported students appear
    const fstu=document.getElementById('fee-student'); if(fstu){ const sts=DB.get('students',[]); fstu.innerHTML='<option value="">— Select Student —</option>'+sts.map(s=>`<option value="${s.id}">${sanitize(s.fname)} ${sanitize(s.lname)} (${this.className(s.classId)})</option>`).join(''); }
    this.closeModal('m-receipt'); this.renderStudents(); this.renderStudentStats();
  },

  // ══ PRINTABLE ATTENDANCE SHEET ══
  printAttendanceSheet(){
    const classes=DB.get('classes',[]);
    const date=document.getElementById('att-date')?.value||new Date().toISOString().split('T')[0];
    const classId=document.getElementById('att-class')?.value;
    if(!classId){ this.toast('Select a class first to print its sheet','warn'); return; }
    const students=DB.get('students',[]).filter(s=>s.classId===classId&&s.status==='active');
    const cls=classes.find(c=>c.id===classId);
    const school=DB.get('school',{});
    const html=`
      <div style="font-size:.85rem;page-break-inside:avoid">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;padding-bottom:.75rem;border-bottom:2px solid #1a3a6b">
          <div>
            <div style="font-size:1.1rem;font-weight:800;color:#1a3a6b">${school.name||'School'}</div>
            <div style="font-size:.75rem;color:#666">Attendance Sheet — ${cls?.name||'Class'} — ${fmtDate(date)}</div>
          </div>
          <div style="text-align:right;font-size:.72rem;color:#666">
            Teacher: ${cls?.teacherId?DB.get('staff',[]).find(s=>s.id===cls.teacherId)?.fname+' '+DB.get('staff',[]).find(s=>s.id===cls.teacherId)?.lname:'—'}<br>
            Academic Year: ${school.academicYear||'2025/2026'} · Term ${school.currentTerm||'2'}
          </div>
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:.8rem">
          <thead>
            <tr style="background:#1a3a6b;color:white">
              <th style="padding:.5rem;text-align:left;border:1px solid #ccc">#</th>
              <th style="padding:.5rem;text-align:left;border:1px solid #ccc">Student Name</th>
              <th style="padding:.5rem;text-align:left;border:1px solid #ccc">Student ID</th>
              <th style="padding:.5rem;text-align:center;border:1px solid #ccc;width:60px">P</th>
              <th style="padding:.5rem;text-align:center;border:1px solid #ccc;width:60px">A</th>
              <th style="padding:.5rem;text-align:center;border:1px solid #ccc;width:60px">L</th>
              <th style="padding:.5rem;text-align:left;border:1px solid #ccc">Remarks</th>
            </tr>
          </thead>
          <tbody>
            ${students.map((s,i)=>`
              <tr style="background:${i%2===0?'#f9f9f9':'white'}">
                <td style="padding:.45rem;border:1px solid #ddd;font-weight:700">${i+1}</td>
                <td style="padding:.45rem;border:1px solid #ddd;font-weight:600">${sanitize(s.fname)} ${sanitize(s.lname)}</td>
                <td style="padding:.45rem;border:1px solid #ddd;font-family:monospace;font-size:.72rem">${s.studentId}</td>
                <td style="padding:.45rem;border:1px solid #ddd;text-align:center">☐</td>
                <td style="padding:.45rem;border:1px solid #ddd;text-align:center">☐</td>
                <td style="padding:.45rem;border:1px solid #ddd;text-align:center">☐</td>
                <td style="padding:.45rem;border:1px solid #ddd"></td>
              </tr>`).join('')}
            <tr style="background:#e8f0fe;font-weight:700">
              <td colspan="3" style="padding:.5rem;border:1px solid #ddd">TOTALS</td>
              <td style="padding:.5rem;border:1px solid #ddd;text-align:center"></td>
              <td style="padding:.5rem;border:1px solid #ddd;text-align:center"></td>
              <td style="padding:.5rem;border:1px solid #ddd;text-align:center"></td>
              <td style="padding:.5rem;border:1px solid #ddd"></td>
            </tr>
          </tbody>
        </table>
        <div style="display:flex;justify-content:space-between;margin-top:2rem;font-size:.78rem">
          <div>Teacher's Signature: ________________________</div>
          <div>Date: ${fmtDate(date)}</div>
          <div>Head Teacher's Initials: ________</div>
        </div>
        <div style="text-align:center;margin-top:1rem;font-size:.68rem;color:#999">Generated by Eduformium School Management System · ${new Date().toLocaleDateString()}</div>
      </div>`;
    document.getElementById('receipt-title').textContent='Attendance Sheet';
    document.getElementById('receipt-body').innerHTML=html;
    this.openModal('m-receipt');
    setTimeout(()=>window.print(),300);
  },

  // ══ DASHBOARD REFRESH ══
  refreshDashboard(){
    const btn=document.getElementById('dash-refresh-btn'); if(btn){ btn.style.animation='spin .6s linear'; setTimeout(()=>btn.style.animation='',700); }
    this.loadDashboard(); this.toast('Dashboard refreshed','success');
  },

  openFeeModal(preStudentId=null){
    ['fee-id','fee-amount','fee-ref','fee-notes'].forEach(id=>{ const e=document.getElementById(id); if(e) e.value=''; });
    document.getElementById('fee-date').value=new Date().toISOString().split('T')[0];
    document.getElementById('fee-term').value=_currentTerm;
    document.getElementById('fee-method').value='cash';
    // Set academic year dropdown
    const fmYearEl=document.getElementById('fee-academic-year');
    if(fmYearEl){ const years=getAllAcademicYears(); fmYearEl.innerHTML=years.map(y=>`<option value="${y.year}"${y.year===_academicYear?' selected':''}>${y.year}${y.isCurrent?' (Current)':''}</option>`).join(''); }
    document.getElementById('fee-err').style.display='none';
    const fstu=document.getElementById('fee-student'); if(fstu) fstu.value=preStudentId||'';
    // Always re-enable save button in case it was disabled by a previous "fully paid" check
    const saveBtnEl=document.getElementById('save-fee-btn'); if(saveBtnEl) saveBtnEl.disabled=false;
    this.openModal('m-fee');
    // Live term status — runs when student or term changes
    const checkTermStatus=()=>{
      const sId=document.getElementById('fee-student')?.value;
      const tm=document.getElementById('fee-term')?.value;
      const errEl=document.getElementById('fee-err');
      const amtEl=document.getElementById('fee-amount');
      const saveBtn=document.getElementById('save-fee-btn');
      if(!sId||!tm){ errEl.style.display='none'; return; }
      const st=DB.get('students',[]).find(x=>x.id===sId);
      const fmYear=document.getElementById('fee-academic-year')?.value||_academicYear;
      const fs=getYearStructure(st?.classId,fmYear);
      if(!st||!fs){ errEl.style.display='none'; return; }
      const due=+(fs['term'+tm]||0);
      const fmyf=getYearFees(st,fmYear); const paid=+(fmyf['term'+tm]||0);
      const owed=Math.max(0,due-paid);
      if(due===0){ errEl.style.display='none'; return; }
      if(owed===0){
        errEl.style.display='block';
        errEl.style.background='var(--success-bg)';
        errEl.style.color='var(--success)';
        errEl.style.borderColor='var(--success)';
        errEl.textContent=`Term ${tm} is already fully paid (${fmt(paid)} of ${fmt(due)}). No payment needed.`;
        if(amtEl) amtEl.value='';
        if(saveBtn) saveBtn.disabled=true;
      } else {
        errEl.style.display='block';
        errEl.style.background='var(--surface-2)';
        errEl.style.color='var(--t2)';
        errEl.style.borderColor='var(--border)';
        errEl.textContent=`Term ${tm}: ${fmt(paid)} paid of ${fmt(due)} — Balance remaining: ${fmt(owed)}`;
        if(saveBtn) saveBtn.disabled=false;
      }
    };
    setTimeout(()=>{
      // Replace elements with clones to remove any previously stacked listeners
      ['fee-student','fee-term','fee-academic-year'].forEach(eid=>{
        const el=document.getElementById(eid); if(!el) return;
        const clone=el.cloneNode(true); el.parentNode.replaceChild(clone,el);
        clone.addEventListener('change', checkTermStatus);
      });
      if(preStudentId) checkTermStatus();
    }, 80);
  },

  saveFee(){
    const studentId=document.getElementById('fee-student').value;
    const term=document.getElementById('fee-term').value;
    const amount=+document.getElementById('fee-amount').value;
    const date=document.getElementById('fee-date').value;
    const errEl=document.getElementById('fee-err');
    if(!studentId||!amount||!date){ errEl.style.display='block'; errEl.textContent='Please fill in all required fields.'; return; }
    if(amount<=0){ errEl.style.display='block'; errEl.textContent='Amount must be greater than zero.'; return; }
    // Hard block — prevent overpayment if term is already fully paid
    const stCheck=DB.get('students',[]).find(x=>x.id===studentId);
    const payYear=document.getElementById('fee-academic-year')?.value||_academicYear;
    const fsCheck=getYearStructure(stCheck?.classId,payYear);
    if(stCheck&&fsCheck){
      const due=+(fsCheck['term'+term]||0);
      const scyf=getYearFees(stCheck,payYear); const paid=+(scyf['term'+term]||0);
      if(due>0&&paid>=due){
        errEl.style.display='block';
        errEl.style.background='var(--danger-bg)';
        errEl.style.color='var(--danger)';
        errEl.textContent=`Term ${term} is already fully paid. No further payment can be recorded for this term.`;
        return;
      }
      // Also cap: don't allow amount that exceeds remaining balance
      const owed=Math.max(0,due-paid);
      if(due>0&&amount>owed){
        errEl.style.display='block';
        errEl.style.background='var(--danger-bg)';
        errEl.style.color='var(--danger)';
        errEl.textContent=`Amount exceeds remaining balance of ${fmt(owed)} for Term ${term}. Please enter the correct amount.`;
        return;
      }
    }
    errEl.style.display='none';
    const payments=DB.get('feePayments',[]);
    const maxRec=payments.reduce((mx,p)=>{ const n=parseInt((p.receiptNo||'').replace('REC-','')||0); return n>mx?n:mx; },0);
    const receiptNo='REC-'+String(maxRec+1).padStart(4,'0');
    const _saveYear=document.getElementById('fee-academic-year')?.value||_academicYear;
    const payment={id:uid('fp'),studentId,term,amount,method:document.getElementById('fee-method').value,date,by:this.currentUser.name,receiptNo,ref:document.getElementById('fee-ref').value,notes:document.getElementById('fee-notes').value,academicYear:_saveYear};
    payments.push(payment); DB.set('feePayments',payments);
    // Update student feesPaid (year-keyed)
    const students=DB.get('students',[]); const si=students.findIndex(s=>s.id===studentId);
    if(si>-1){
      if(!students[si].feesPaid||typeof students[si].feesPaid.term1==='number') students[si].feesPaid={};
      if(!students[si].feesPaid[_saveYear]) students[si].feesPaid[_saveYear]={term1:0,term2:0,term3:0};
      students[si].feesPaid[_saveYear]['term'+term]=(+(students[si].feesPaid[_saveYear]['term'+term]||0))+amount;
      DB.set('students',students);
    }
    const s=DB.get('students',[]).find(x=>x.id===studentId);
    this.audit('Fee Payment','create',`Payment recorded: ${s?.fname} ${s?.lname} — ${fmt(amount)} Term ${term} (${receiptNo})`);
    // Refresh student to get updated feesPaid
    const updatedSt=DB.get('students',[]).find(x=>x.id===studentId);
    const fs2=getYearStructure(updatedSt?.classId,_saveYear);
    const termDue2=fs2?+(fs2['term'+term]||0):0;
    const _ustYF=getYearFees(updatedSt,_saveYear); const termPaid2=+((_ustYF)['term'+term]||0);
    const termFullyPaid=termDue2>0&&termPaid2>=termDue2;
    const toastMsg=termFullyPaid
      ? `Term ${term} fully paid! Receipt: ${receiptNo}`
      : `Payment of ${fmt(amount)} recorded. Receipt: ${receiptNo}${termDue2>0?' · Balance: '+fmt(Math.max(0,termDue2-termPaid2)):''}`;
    this.toast(toastMsg,'success');
    this.closeModal('m-fee'); this.renderFees(); this.renderFeesKpis(); this.renderDefaulters(); this.renderStudents();
  },

  showReceipt(paymentId){
    const p=DB.get('feePayments',[]).find(x=>x.id===paymentId); if(!p) return;
    const s=DB.get('students',[]).find(x=>x.id===p.studentId);
    const school=DB.get('school',{});
    document.getElementById('receipt-title').textContent='Fee Receipt';
    document.getElementById('receipt-body').innerHTML=`
      <div style="text-align:center;margin-bottom:1rem;padding-bottom:1rem;border-bottom:2px solid var(--border)">
        <div style="font-family:'Playfair Display',serif;font-size:1.2rem;font-weight:700;color:var(--brand)">${school.name||'School'}</div>
        <div style="font-size:.72rem;color:var(--t4)">${school.address||''}</div>
        <div style="font-size:.72rem;color:var(--t4)">${school.phone||''} · ${school.email||''}</div>
      </div>
      <div style="text-align:center;margin-bottom:1.25rem">
        <div style="font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:var(--t3)">Fee Receipt</div>
        <div style="font-family:monospace;font-size:.9rem;font-weight:800;color:var(--brand)">${p.receiptNo||'—'}</div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:.75rem;font-size:.82rem;margin-bottom:1rem">
        <div><div style="font-size:.7rem;color:var(--t4);font-weight:700">STUDENT</div><div style="font-weight:600">${s?s.fname+' '+s.lname:'—'}</div></div>
        <div><div style="font-size:.7rem;color:var(--t4);font-weight:700">CLASS</div><div style="font-weight:600">${this.className(s?.classId)}</div></div>
        <div><div style="font-size:.7rem;color:var(--t4);font-weight:700">TERM</div><div style="font-weight:600">Term ${p.term}</div></div>
        <div><div style="font-size:.7rem;color:var(--t4);font-weight:700">DATE</div><div style="font-weight:600">${fmtDate(p.date)}</div></div>
        <div><div style="font-size:.7rem;color:var(--t4);font-weight:700">PAYMENT METHOD</div><div style="font-weight:600">${p.method}</div></div>
        <div><div style="font-size:.7rem;color:var(--t4);font-weight:700">RECEIVED BY</div><div style="font-weight:600">${p.by||'—'}</div></div>
        ${p.ref?`<div><div style="font-size:.7rem;color:var(--t4);font-weight:700">REFERENCE</div><div style="font-weight:600">${p.ref}</div></div>`:''}
        ${p.notes?`<div style="grid-column:1/-1"><div style="font-size:.7rem;color:var(--t4);font-weight:700">NOTES</div><div style="font-weight:600">${p.notes}</div></div>`:''}
      </div>
      <div style="background:var(--brand);color:white;padding:1rem;border-radius:var(--radius);text-align:center;margin-bottom:1rem">
        <div style="font-size:.75rem;text-transform:uppercase;letter-spacing:.08em;opacity:.7">Amount Paid</div>
        <div style="font-size:1.8rem;font-weight:800;letter-spacing:-.04em">${fmt(p.amount)}</div>
      </div>
      <div style="text-align:center;font-size:.7rem;color:var(--t4)">This receipt was generated by Eduformium School Management System.<br>Thank you for your payment.</div>
    `;
    this.openModal('m-receipt');
  },

  openReversePaymentModal(paymentId){
    if(this.currentUser?.role!=='admin'){ this.toast('Only admins can reverse payments','error'); return; }
    const p=DB.get('feePayments',[]).find(x=>x.id===paymentId); if(!p) return;
    const s=DB.get('students',[]).find(x=>x.id===p.studentId);
    document.getElementById('receipt-title').textContent='Reverse Payment';
    document.getElementById('receipt-body').innerHTML=`
      <div style="background:rgba(239,68,68,.07);border:1px solid rgba(239,68,68,.2);border-radius:.6rem;padding:.85rem 1rem;margin-bottom:1rem">
        <div style="font-size:.78rem;font-weight:700;color:var(--danger);margin-bottom:.5rem;text-transform:uppercase;letter-spacing:.05em"><svg style="width:15px;height:15px;vertical-align:middle;margin-right:5px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>This action cannot be undone</div>
        <div style="font-size:.83rem;color:var(--t2)">You are about to permanently reverse the following payment:</div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:.6rem;font-size:.82rem;margin-bottom:1rem">
        <div><div style="font-size:.7rem;color:var(--t4);font-weight:700">RECEIPT</div><div style="font-weight:700;font-family:monospace">${p.receiptNo||'—'}</div></div>
        <div><div style="font-size:.7rem;color:var(--t4);font-weight:700">STUDENT</div><div style="font-weight:600">${s?sanitize(s.fname)+' '+sanitize(s.lname):'Unknown'}</div></div>
        <div><div style="font-size:.7rem;color:var(--t4);font-weight:700">TERM</div><div style="font-weight:600">Term ${p.term}</div></div>
        <div><div style="font-size:.7rem;color:var(--t4);font-weight:700">AMOUNT</div><div style="font-weight:800;color:var(--danger)">${fmt(p.amount)}</div></div>
        <div><div style="font-size:.7rem;color:var(--t4);font-weight:700">METHOD</div><div>${p.method}</div></div>
        <div><div style="font-size:.7rem;color:var(--t4);font-weight:700">DATE</div><div>${fmtDate(p.date)}</div></div>
      </div>
      <div class="form-field" style="margin-bottom:1rem">
        <label class="form-label" style="color:var(--danger);font-weight:700">Reason for Reversal *</label>
        <textarea class="form-input" id="reversal-reason" rows="3" placeholder="e.g. Wrong student selected, duplicate payment, incorrect amount…" style="border-color:rgba(239,68,68,.4)"></textarea>
        <div id="reversal-err" style="display:none;color:var(--danger);font-size:.78rem;margin-top:.3rem">Please provide a reason for the reversal.</div>
      </div>
      <div style="display:flex;gap:.75rem;justify-content:flex-end">
        <button class="btn btn-secondary btn-sm" onclick="SMS.closeModal('m-receipt')">Cancel</button>
        <button class="btn btn-sm" style="background:#dc2626;color:#fff;font-weight:700;padding:.4rem 1rem;border:none;border-radius:.45rem;cursor:pointer" onclick="SMS.reversePayment('${paymentId}')">Confirm Reversal</button>
      </div>`;
    this.openModal('m-receipt');
  },

  reversePayment(paymentId){
    if(this.currentUser?.role!=='admin'){ this.toast('Only admins can reverse payments','error'); return; }
    const reason=document.getElementById('reversal-reason')?.value.trim();
    const errEl=document.getElementById('reversal-err');
    if(!reason){ if(errEl) errEl.style.display='block'; return; }
    const payments=DB.get('feePayments',[]);
    const p=payments.find(x=>x.id===paymentId); if(!p){ this.toast('Payment not found','error'); return; }
    const students=DB.get('students',[]);
    const si=students.findIndex(s=>s.id===p.studentId);
    // Subtract amount from student feesPaid for that term
    if(si>-1){
      const current=+(students[si].feesPaid?.['term'+p.term]||0);
      const newPaid=Math.max(0, current - p.amount);
      if(!students[si].feesPaid) students[si].feesPaid={};
      students[si].feesPaid['term'+p.term]=newPaid;
      DB.set('students',students);
    }
    // Delete payment record from local + Firestore
    DB.set('feePayments',payments.filter(x=>x.id!==paymentId));
    const sid=window.SMS&&window.SMS.schoolId;
    if(sid&&window.FDB) FDB.delete(sid,'feePayments',paymentId).catch(()=>{});
    // Sync updated student to Firestore
    if(si>-1&&sid&&window.FDB) FDB.batchWrite(sid,'students',[students[si]]).catch(()=>{});
    this.audit('Fee Reversal','delete',`Payment ${p.receiptNo} reversed for ${students[si]?.fname||'Unknown'} — ${fmt(p.amount)} Term ${p.term}. Reason: ${reason}`);
    this.closeModal('m-receipt');
    this.toast(`Payment ${p.receiptNo} reversed successfully`,'warn');
    this.renderFees(); this.renderFeesKpis(); this.renderDefaulters(); this.renderStudents();
  },

  exportFees(){
    if(typeof XLSX==='undefined'){ this.toast('Export library not loaded','error'); return; }
    const payments=DB.get('feePayments',[]); const students=DB.get('students',[]);
    const data=payments.map(p=>{ const s=students.find(x=>x.id===p.studentId); return {'Receipt No':p.receiptNo,'Student':s?s.fname+' '+s.lname:'Unknown','Class':this.className(s?.classId),'Term':'Term '+p.term,'Amount':p.amount,'Method':p.method,'Date':p.date,'Reference':p.ref||'','Notes':p.notes||'','Received By':p.by}; });
    const ws=XLSX.utils.json_to_sheet(data); const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,ws,'Fee Payments');
    XLSX.writeFile(wb,`FeePayments_${new Date().toISOString().split('T')[0]}.xlsx`);
    this.toast('Fees exported','success');
  },

  // ══ EXPENSES ══
  loadExpenses(){ this.renderExpenses(); },

  renderExpenses(){
    const expenses=DB.get('expenses',[]);
    const total=expenses.reduce((s,e)=>s+(+e.amount||0),0);
    const bycat={}; expenses.forEach(e=>{ bycat[e.category]=(bycat[e.category]||0)+(+e.amount||0); });
    document.getElementById('expense-kpis').innerHTML=[
      {icon:'expenses',val:fmt(total),lbl:'Total Expenses',color:'red'},
      {icon:'transactions',val:expenses.length,lbl:'Transactions',color:'blue'},
      {icon:'category',val:Object.keys(bycat).sort((a,b)=>bycat[b]-bycat[a])[0]||'—',lbl:'Top Category',color:'amber'},
    ].map(k=>`<div class="kpi-card"><div class="kpi-icon ${k.color}">${SMS._kpiSvg(k.icon)}</div><div class="kpi-val" style="font-size:${k.val.length>8?'1.1rem':'1.65rem'}">${k.val}</div><div class="kpi-label">${k.lbl}</div></div>`).join('');
    document.getElementById('expense-tbody').innerHTML=expenses.sort((a,b)=>b.date.localeCompare(a.date)).map(e=>`<tr>
      <td>${fmtDate(e.date)}</td>
      <td><span class="badge badge-neutral">${e.category}</span></td>
      <td>${e.desc}</td>
      <td style="font-weight:700;color:var(--danger)">${fmt(e.amount)}</td>
      <td>${e.paidTo}</td>
      <td>${e.approvedBy}</td>
      <td style="display:flex;gap:.3rem"><button class="btn btn-ghost btn-sm" onclick="SMS.openExpenseModal('${e.id}')" style="color:var(--brand);padding:.3rem .5rem"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button><button class="btn btn-ghost btn-sm" onclick="SMS.confirmDelete('Delete this expense?',()=>SMS.deleteExpense('${e.id}'))" style="color:var(--danger);padding:.3rem .5rem"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg></button></td>
    </tr>`).join('')||SMS._emptyState('expenses','No Expenses Recorded','Track school expenditure here. Add your first expense entry.','');
    this.renderExpenseCharts(bycat,expenses);
  },

  deleteExpense(id){ DB.set('expenses',DB.get('expenses',[]).filter(x=>x.id!==id)); const _sid=window.SMS&&window.SMS.schoolId; if(_sid&&window.FDB) FDB.delete(_sid,'expenses',id).catch(()=>{}); this.toast('Expense deleted','warn'); this.renderExpenses(); },

  renderExpenseCharts(bycat,expenses){
    const ctx1=document.getElementById('chart-expenses'); if(ctx1){ if(this._charts.exp) this._charts.exp.destroy(); const labels=Object.keys(bycat); const data=labels.map(k=>bycat[k]); const colors=['#1a3a6b','#0d9488','#d97706','#dc2626','#7c3aed','#16a34a']; this._charts.exp=new Chart(ctx1,{type:'doughnut',data:{labels,datasets:[{data,backgroundColor:colors.slice(0,labels.length),borderWidth:0}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom',labels:{font:{size:11},padding:12}}}}}); }
    const ctx2=document.getElementById('chart-expense-trend'); if(ctx2){ if(this._charts.expTrend) this._charts.expTrend.destroy(); const months=['Jan','Feb','Mar','Apr','May']; const mData=months.map((_,i)=>expenses.filter(e=>new Date(e.date).getMonth()===i).reduce((s,e)=>s+(+e.amount||0),0)); this._charts.expTrend=new Chart(ctx2,{type:'bar',data:{labels:months,datasets:[{data:mData,backgroundColor:'rgba(220,38,38,0.7)',borderRadius:6}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{y:{beginAtZero:true,ticks:{callback:v=>'₵'+v.toLocaleString()}},x:{grid:{display:false}}}}}); }
  },

  // ══ MESSAGES ══
  loadMessages(){ this.renderMessages('inbox'); },

  renderMessages(tab='inbox'){
    const messages=DB.get('messages',[]).filter(m=>m.tab===tab||(!m.tab&&tab==='inbox'));
    const list=document.getElementById('msg-list');
    list.innerHTML=messages.map(m=>`
      <div class="msg-item ${!m.read&&tab==='inbox'?'msg-item-unread':''}" onclick="SMS.viewMessage('${m.id}','${tab}')">
        <div style="display:flex;justify-content:space-between;align-items:flex-start">
          <div class="msg-item-from" style="${!m.read&&tab==='inbox'?'color:var(--t1)':''}">${tab==='sent'?'To: '+m.to:m.from}</div>
          <div class="msg-item-time">${new Date(m.date).toLocaleDateString()}</div>
        </div>
        <div class="msg-item-subj">${m.subject}</div>
        ${!m.read&&tab==='inbox'?'<span style="display:inline-block;width:6px;height:6px;border-radius:99px;background:var(--brand-teal);margin-top:.25rem"></span>':''}
      </div>`).join('')||'<div style="padding:2rem;text-align:center;font-size:.82rem;color:var(--t4)">No messages</div>';
    const unread=messages.filter(m=>!m.read&&tab==='inbox').length;
    const cnt=document.getElementById('inbox-count'); if(cnt){ cnt.textContent=unread; cnt.style.display=unread>0?'inline':'none'; }
  },

  viewMessage(id,tab){
    const messages=DB.get('messages',[]); const m=messages.find(x=>x.id===id); if(!m) return;
    m.read=true; DB.set('messages',messages);
    document.getElementById('msg-content').innerHTML=`
      <div class="msg-full">
        <div class="msg-full-subject">${m.subject}</div>
        <div class="msg-full-meta">
          <strong>${tab==='sent'?'To':'From'}:</strong> ${tab==='sent'?m.to:m.from} · 
          <span>${new Date(m.date).toLocaleString()}</span>
        </div>
        <div class="msg-full-body">${m.body.replace(/\n/g,'<br>')}</div>
        ${tab==='inbox'?`<div style="margin-top:1.25rem"><button class="btn btn-secondary btn-sm" onclick="SMS.openComposeModal()">↩ Reply</button></div>`:''}
      </div>`;
    this.renderMessages(tab);
  },

  openComposeModal(){
    ['msg-subject','msg-body'].forEach(id=>{ const e=document.getElementById(id); if(e) e.value=''; });
    document.getElementById('msg-to').value='';
    document.getElementById('msg-class-field').style.display='none';
    const classes=DB.get('classes',[]); const sel=document.getElementById('msg-class'); if(sel) sel.innerHTML='<option value="">— Select Class —</option>'+classes.map(c=>`<option value="${c.id}">${sanitize(c.name)}</option>`).join('');
    this.openModal('m-compose');
  },

  sendMessage(){
    const to=document.getElementById('msg-to').value; const subject=document.getElementById('msg-subject').value.trim(); const body=document.getElementById('msg-body').value.trim();
    if(!to||!subject||!body){ this.toast('Please fill in all message fields','error'); return; }
    const messages=DB.get('messages',[]); messages.push({id:uid('msg'),from:this.currentUser.name,fromId:this.currentUser.id,to,subject,body,date:new Date().toISOString(),read:true,tab:'sent'});
    DB.set('messages',messages); this.audit('Send Message','create',`Message sent: "${subject}" to ${to}`);
    this.toast('Message sent!','success'); this.closeModal('m-compose'); this.renderMessages('sent');
    document.querySelector('.msg-tab[data-mtab="sent"]')?.click();
  },

  // ══ LIBRARY ══
  loadLibrary(){
    const cats=[...new Set(DB.get('books',[]).map(b=>b.category).filter(Boolean))];
    const cf=document.getElementById('lib-cat-f'); if(cf) cf.innerHTML='<option value="">All Categories</option>'+cats.map(c=>`<option value="${c}">${c}</option>`).join('');
    this.renderLibStats(); this.renderLibrary();
  },

  renderLibStats(){
    const books=DB.get('books',[]); const total=books.reduce((s,b)=>s+(+b.copies||0),0); const avail=books.reduce((s,b)=>s+(+b.available||0),0);
    document.getElementById('lib-stats').innerHTML=[{val:books.length,lbl:'Book Titles'},{val:total,lbl:'Total Copies'},{val:avail,lbl:'Available'},{val:total-avail,lbl:'Borrowed'}].map(s=>`<div class="stat-pill"><div><div class="stat-pill-val">${s.val}</div><div class="stat-pill-lbl">${s.lbl}</div></div></div>`).join('');
  },

  renderLibrary(){
    const books=DB.get('books',[]); const q=(document.getElementById('lib-search')?.value||'').toLowerCase();
    const cf=document.getElementById('lib-cat-f')?.value||''; const sf=document.getElementById('lib-status-f')?.value||'';
    let filtered=books.filter(b=>{ if(cf&&b.category!==cf) return false; if(sf==='available'&&b.available<1) return false; if(sf==='borrowed'&&b.available>0) return false; if(q&&!`${sanitize(b.title)} ${sanitize(b.author)} ${sanitize(b.isbn)}`.toLowerCase().includes(q)) return false; return true; });
    document.getElementById('lib-tbody').innerHTML=filtered.map(b=>`<tr>
      <td style="font-family:monospace;font-size:.73rem;color:var(--t3)">${b.isbn||'—'}</td>
      <td style="font-weight:600">${sanitize(b.title)}</td>
      <td>${sanitize(b.author)}</td>
      <td><span class="badge badge-neutral">${b.category}</span></td>
      <td style="text-align:center">${b.copies}</td>
      <td style="text-align:center;font-weight:700;color:${b.available>0?'var(--success)':'var(--danger)'}">${b.available}</td>
      <td>${b.available>0?statusBadge('available'):statusBadge('borrowed')}</td>
      <td style="display:flex;gap:.3rem"><button class="btn btn-ghost btn-sm" onclick="SMS.openBookModal('${b.id}')" style="color:var(--brand);padding:.3rem .5rem" title="Edit"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>${b.available>0?`<button class="btn btn-ghost btn-sm" onclick="SMS.openBookIssueModal('${b.id}')" style="color:var(--teal);padding:.3rem .5rem;font-size:.7rem;font-weight:600">Issue</button>`:''}<button class="btn btn-ghost btn-sm" onclick="SMS.confirmDelete('Delete this book?',()=>SMS.deleteBook('${b.id}'))" style="color:var(--danger);padding:.3rem .5rem" title="Delete"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg></button></td>
    </tr>`).join('')||SMS._emptyState('books','No Books Found','Try a different search or category filter.','');
  },

  // ══ EVENTS ══
  loadEvents(){ this.renderCalendar(); this.renderEventsList(); },

  renderCalendar(){
    const panel=document.getElementById('cal-panel');
    const events=DB.get('events',[]);
    const year=this._calYear, month=this._calMonth;
    const firstDay=new Date(year,month,1).getDay(), daysInMonth=new Date(year,month+1,0).getDate();
    const monthNames=['January','February','March','April','May','June','July','August','September','October','November','December'];
    let html=`<div class="cal-header">
      <button class="cal-nav" onclick="SMS._calMonth--;if(SMS._calMonth<0){SMS._calMonth=11;SMS._calYear--;}SMS.renderCalendar()">‹</button>
      <span class="cal-month">${monthNames[month]} ${year}</span>
      <button class="cal-nav" onclick="SMS._calMonth++;if(SMS._calMonth>11){SMS._calMonth=0;SMS._calYear++;}SMS.renderCalendar()">›</button>
    </div>
    <div class="cal-grid">
      ${['Su','Mo','Tu','We','Th','Fr','Sa'].map(d=>`<div class="cal-day-label">${d}</div>`).join('')}
      ${Array(firstDay).fill('<div></div>').join('')}`;
    const today=new Date(); const todayStr=`${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
    for(let d=1;d<=daysInMonth;d++){
      const dateStr=`${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      const isToday=dateStr===todayStr;
      const hasEvent=events.some(e=>e.start<=dateStr&&(e.end||e.start)>=dateStr);
      html+=`<div class="cal-day ${isToday?'today':''} ${hasEvent?'has-event':''}">${d}</div>`;
    }
    html+=`</div>`;
    panel.innerHTML=html;
  },

  renderEventsList(){
    const events=DB.get('events',[]).sort((a,b)=>a.start.localeCompare(b.start));
    const colors={exam:'#1a3a6b',academic:'#0d9488',sports:'#16a34a',holiday:'#d97706',meeting:'#7c3aed',cultural:'#dc2626'};
    document.getElementById('events-list').innerHTML=events.map(e=>`
      <div class="event-item">
        <div class="event-dot" style="background:${colors[e.type]||'#999'}"></div>
        <div>
          <div class="event-title">${sanitize(e.title)}</div>
          <div class="event-meta">${fmtDate(e.start)}${e.end?` — ${fmtDate(e.end)}`:''}${e.venue?' · '+e.venue:''}</div>
          ${e.desc?`<div style="font-size:.75rem;color:var(--t3);margin-top:.25rem">${e.desc}</div>`:''}
        </div>
        <button class="btn btn-ghost btn-sm admin-only" onclick="SMS.confirmDelete('Delete event ${sanitize(e.title)}?',()=>SMS.deleteEvent('${e.id}'))" style="color:var(--danger);padding:.3rem .5rem;margin-left:auto"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg></button>
      </div>`).join('')||'<div style="padding:2rem;text-align:center;font-size:.82rem;color:var(--t4)">No events scheduled</div>';
  },

  openEventModal(){ ['ev-title','ev-start','ev-end','ev-time','ev-venue','ev-desc'].forEach(id=>{ const e=document.getElementById(id); if(e) e.value=''; }); document.getElementById('ev-type').value='academic'; this.openModal('m-event'); },

  saveEvent(){
    const title=document.getElementById('ev-title').value.trim(); const start=document.getElementById('ev-start').value;
    if(!title||!start){ this.toast('Title and start date required','error'); return; }
    const events=DB.get('events',[]); events.push({id:uid('ev'),title,type:document.getElementById('ev-type').value,start,end:document.getElementById('ev-end').value,time:document.getElementById('ev-time').value,venue:document.getElementById('ev-venue').value,desc:document.getElementById('ev-desc').value});
    DB.set('events',events); this.audit('Add Event','create',`New event: ${title}`); this.toast('Event added','success'); this.closeModal('m-event'); this.renderCalendar(); this.renderEventsList();
  },

  deleteEvent(id){ DB.set('events',DB.get('events',[]).filter(x=>x.id!==id)); const _sid=window.SMS&&window.SMS.schoolId; if(_sid&&window.FDB) FDB.delete(_sid,'events',id).catch(()=>{}); this.toast('Event deleted','warn'); this.renderCalendar(); this.renderEventsList(); },

  // ══ REPORTS ══
  openReport(type){
    const output=document.getElementById('report-output'); output.style.display='block';
    const title=document.getElementById('report-output-title');
    const content=document.getElementById('report-output-content');
    const students=DB.get('students',[]); const staff=DB.get('staff',[]); const payments=DB.get('feePayments',[]); const expenses=DB.get('expenses',[]);
    if(type==='academic'){
      title.textContent='Academic Performance Report';
      const grades=DB.get('grades',[]); const exams=DB.get('exams',[]);
      const byStudent=students.map(s=>{ const sg=grades.filter(g=>g.studentId===s.id); const avg=sg.length>0?Math.round(sg.reduce((sum,g)=>{ const ex=exams.find(e=>e.id===g.examId); return sum+(g.score/(ex?.maxScore||100)*100); },0)/sg.length):null; return {...s,avg,gradeCount:sg.length}; }).filter(s=>s.avg!==null).sort((a,b)=>b.avg-a.avg).slice(0,10);
      content.innerHTML=`<table class="tbl"><thead><tr><th>Rank</th><th>Student</th><th>Class</th><th>Average</th><th>Grade</th></tr></thead><tbody>${byStudent.map((s,i)=>`<tr><td style="font-weight:800;color:${i<3?'var(--warn)':'var(--t3)'}">${i+1}</td><td style="font-weight:600">${sanitize(s.fname)} ${sanitize(s.lname)}</td><td>${this.className(s.classId)}</td><td style="font-weight:700;color:var(--brand-teal)">${s.avg}%</td><td><span class="badge ${gradeFromScore(s.avg)==='F'?'badge-danger':'badge-success'}">${gradeFromScore(s.avg)}</span></td></tr>`).join('')}</tbody></table>`;
    } else if(type==='finance'){
      title.textContent='Financial Report';
      const totalFees=payments.reduce((s,p)=>s+(+p.amount||0),0); const totalExp=expenses.reduce((s,e)=>s+(+e.amount||0),0);
      const feeStructure=DB.get('feeStructure',[]);
      let totalOutstanding=0; students.filter(s=>s.status==='active').forEach(s=>{ const fs=feeStructure.find(f=>f.classId===s.classId); if(!fs) return; totalOutstanding+=Math.max(0,+(fs.term1||0)-(+(s.feesPaid?.term1||0)))+Math.max(0,+(fs.term2||0)-(+(s.feesPaid?.term2||0)))+Math.max(0,+(fs.term3||0)-(+(s.feesPaid?.term3||0))); });
      content.innerHTML=`<div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:1rem;margin-bottom:1.25rem">
        <div class="kpi-card"><div class="kpi-icon teal">${SMS._kpiSvg('fees')}</div><div class="kpi-val">${fmt(totalFees)}</div><div class="kpi-label">Total Fee Revenue</div></div>
        <div class="kpi-card"><div class="kpi-icon red">${SMS._kpiSvg('expenses')}</div><div class="kpi-val">${fmt(totalExp)}</div><div class="kpi-label">Total Expenses</div></div>
                <div class="kpi-card"><div class="kpi-icon amber">${SMS._kpiSvg('warning')}</div><div class="kpi-val" style="color:var(--danger)">${fmt(totalOutstanding)}</div><div class="kpi-label">Outstanding Balance</div></div>
<div class="kpi-card"><div class="kpi-icon ${totalFees-totalExp>0?'green':'amber'}">${SMS._kpiSvg('trending')}</div><div class="kpi-val" style="color:${totalFees-totalExp>0?'var(--success)':'var(--danger)'}">${fmt(totalFees-totalExp)}</div><div class="kpi-label">Net Balance</div></div>
      </div>`;
    } else if(type==='enrollment'){
      title.textContent='Enrollment Report';
      const classes=DB.get('classes',[]);
      content.innerHTML=`<table class="tbl"><thead><tr><th>Class</th><th>Level</th><th>Enrolled</th><th>Male</th><th>Female</th><th>Capacity</th><th>Fill Rate</th></tr></thead><tbody>${classes.map(c=>{ const cl=students.filter(s=>s.classId===c.id); const m=cl.filter(s=>s.gender==='Male').length, f=cl.filter(s=>s.gender==='Female').length, rate=Math.round(cl.length/c.capacity*100); return `<tr><td style="font-weight:600">${sanitize(c.name)}</td><td>${c.level||'—'}</td><td style="font-weight:700;color:var(--brand)">${cl.length}</td><td>${m}</td><td>${f}</td><td>${c.capacity}</td><td><span class="badge ${rate>90?'badge-danger':rate>70?'badge-warn':'badge-success'}">${rate}%</span></td></tr>`; }).join('')}</tbody></table>`;
    } else if(type==='attendance'){
      title.textContent='Attendance Report';
      const att=DB.get('attendance',[]);
      content.innerHTML=`<table class="tbl"><thead><tr><th>Date</th><th>Class</th><th>Present</th><th>Absent</th><th>Late</th><th>Rate</th></tr></thead><tbody>${att.sort((a,b)=>b.date.localeCompare(a.date)).slice(0,20).map(a=>`<tr><td>${fmtDate(a.date)}</td><td>${this.className(a.classId)}</td><td style="color:var(--success);font-weight:700">${a.present}</td><td style="color:var(--danger);font-weight:700">${a.absent}</td><td style="color:var(--warn);font-weight:700">${a.late}</td><td><span class="badge ${a.present/a.total>=0.9?'badge-success':'badge-warn'}">${Math.round(a.present/a.total*100)||0}%</span></td></tr>`).join('')}</tbody></table>`;
    } else {
      title.textContent=type.charAt(0).toUpperCase()+type.slice(1)+' Report';
      content.innerHTML=`<div style="padding:2rem;text-align:center;color:var(--t4);font-size:.85rem">Detailed ${type} report coming soon. Use Excel export for full data.</div>`;
    }
    output.scrollIntoView({behavior:'smooth'});
  },

  // ══ AUDIT ══
  renderAudit(){
    const log=DB.get('auditLog',[]); const q=(document.getElementById('audit-q')?.value||'').toLowerCase(); const tf=document.getElementById('audit-type')?.value||'';
    let filtered=log.filter(l=>{ if(tf&&l.type!==tf) return false; if(q&&!`${l.action} ${l.details} ${l.user}`.toLowerCase().includes(q)) return false; return true; }).sort((a,b)=>b.time.localeCompare(a.time));
    const perPage=20, total=filtered.length, pages=Math.ceil(total/perPage);
    this._auditPage=Math.min(this._auditPage,pages||1);
    const slice=filtered.slice((this._auditPage-1)*perPage,this._auditPage*perPage);
    const colors={login:'var(--brand)',create:'var(--success)',edit:'var(--warn)',delete:'var(--danger)',settings:'var(--info)'};
    const emojis={login:'',create:'',edit:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>',delete:'',settings:''};
    document.getElementById('audit-list').innerHTML=slice.map(l=>`
      <div class="audit-item">
        <div class="audit-icon" style="background:${colors[l.type]||'var(--surface-3)'}20;color:${colors[l.type]||'var(--t3)'}">${emojis[l.type]||''}</div>
        <div class="audit-text">
          <div class="audit-action">${sanitize(l.action)} <span style="font-weight:400;color:var(--t3)">by</span> ${sanitize(l.user)}</div>
          <div style="font-size:.78rem;color:var(--t2);margin:.15rem 0">${sanitize(l.details)}</div>
          <div class="audit-time">${new Date(l.time).toLocaleString()}</div>
        </div>
        <span class="badge badge-neutral" style="font-size:.65rem;flex-shrink:0">${l.type}</span>
      </div>`).join('')||'<div style="padding:3rem;text-align:center;color:var(--t4)">No audit entries found</div>';
    let pager=`<span class="pager-info">Showing ${Math.min(total,perPage*(this._auditPage-1)+1)}–${Math.min(total,perPage*this._auditPage)} of ${total}</span>`;
    for(let i=1;i<=pages;i++) pager+=`<button class="pager-btn ${i===this._auditPage?'active':''}" onclick="SMS._auditPage=${i};SMS.renderAudit()">${i}</button>`;
    document.getElementById('audit-pager').innerHTML=pager;
  },

  exportAudit(){
    if(typeof XLSX==='undefined'){ this.toast('Export library not loaded','error'); return; }
    const log=DB.get('auditLog',[]); const data=log.map(l=>({Action:l.action,Type:l.type,User:l.user,Details:l.details,Time:l.time}));
    const ws=XLSX.utils.json_to_sheet(data); const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,ws,'Audit Log');
    XLSX.writeFile(wb,`AuditLog_${new Date().toISOString().split('T')[0]}.xlsx`); this.toast('Audit log exported','success');
  },

  // ══ SETTINGS ══
  loadSettings(){
    this.loadSchoolSettings(); this.loadProfileSettings(); this.loadAcademicSettings();
  },

  loadSchoolSettings(){
    const school=DB.get('school',{});
    ['sc-name','sc-motto','sc-phone','sc-email','sc-web','sc-address'].forEach(id=>{ const k=id.replace('sc-','').replace('-',''); const e=document.getElementById(id); if(e) e.value=school[k]||school[id.replace('sc-','')]||''; });
    document.getElementById('sc-name').value=school.name||'';
    document.getElementById('sc-motto').value=school.motto||'';
    document.getElementById('sc-phone').value=school.phone||'';
    document.getElementById('sc-email').value=school.email||'';
    document.getElementById('sc-web').value=school.website||'';
    document.getElementById('sc-address').value=school.address||'';
    document.getElementById('sc-country').value=school.country||'GH';
  },

  saveSchool(){
    const school=DB.get('school',{});
    school.name=document.getElementById('sc-name').value;
    school.motto=document.getElementById('sc-motto').value;
    school.phone=document.getElementById('sc-phone').value;
    school.email=document.getElementById('sc-email').value;
    school.website=document.getElementById('sc-web').value;
    school.address=document.getElementById('sc-address').value;
    school.country=document.getElementById('sc-country').value;
    DB.set('school',school);
    document.getElementById('topbar-school-name').textContent=school.name;
    document.getElementById('sb-school-name').textContent=school.name;
    this.audit('Settings','settings',`School info updated: ${school.name}`);
    this.toast('School information saved!','success');
  },

  loadProfileSettings(){
    const u=this.currentUser;
    document.getElementById('p-name').value=u.name||'';
    document.getElementById('p-email').value=u.email||'';
    document.getElementById('p-phone').value=u.phone||'';
    document.getElementById('p-role').value=this.roleLabel(u.role);
  },

  saveProfile(){
    const users=DB.get('users',[]); const i=users.findIndex(u=>u.id===this.currentUser.id);
    if(i>-1){
      users[i].name=document.getElementById('p-name').value;
      users[i].phone=document.getElementById('p-phone').value;
      DB.set('users',users); this.currentUser=users[i];
      this.setupTopbar(); this.audit('Profile','edit','Profile updated');
      this.toast('Profile saved!','success');
    }
  },

  async changePassword(){
    const oldPw=document.getElementById('pw-old').value;
    const newPw=document.getElementById('pw-new').value;
    const confirmPw=document.getElementById('pw-confirm').value;
    const errEl=document.getElementById('pw-err');
    if(!oldPw){ errEl.style.display='block'; errEl.textContent='Please enter your current password.'; return; }
    if(newPw.length<8){ errEl.style.display='block'; errEl.textContent='New password must be at least 8 characters.'; return; }
    if(newPw!==confirmPw){ errEl.style.display='block'; errEl.textContent='Passwords do not match.'; return; }
    errEl.style.display='none';

    // Firebase account — re-authenticate then update via Firebase Auth
    if(window.firebase&&firebase.auth().currentUser){
      const fbUser=firebase.auth().currentUser;
      const credential=firebase.auth.EmailAuthProvider.credential(fbUser.email,oldPw);
      try{
        await fbUser.reauthenticateWithCredential(credential);
        await fbUser.updatePassword(newPw);
        this.audit('Security','settings','Password changed');
        this.toast('Password updated!','success');
        ['pw-old','pw-new','pw-confirm'].forEach(id=>document.getElementById(id).value='');
      }catch(e){
        errEl.style.display='block';
        if(e.code==='auth/wrong-password'||e.code==='auth/invalid-credential') errEl.textContent='Current password is incorrect.';
        else if(e.code==='auth/requires-recent-login') errEl.textContent='Session expired — please log out and log back in first.';
        else if(e.code==='auth/weak-password') errEl.textContent='New password too weak — use at least 8 characters.';
        else errEl.textContent=`Error: ${e.code||e.message}`;
      }
      return;
    }

    // Local/demo account — check against stored hash or legacy plain-text
    const oldHash=await hashPassword(oldPw);
    const cu=this.currentUser;
    const valid=cu.passwordHash?cu.passwordHash===oldHash:cu.password===oldPw;
    if(!valid){ errEl.style.display='block'; errEl.textContent='Current password is incorrect.'; return; }
    const newHash=await hashPassword(newPw);
    const users=DB.get('users',[]); const i=users.findIndex(u=>u.id===cu.id);
    if(i>-1){ users[i].passwordHash=newHash; delete users[i].password; DB.set('users',users); this.currentUser=users[i]; }
    this.audit('Security','settings','Password changed');
    this.toast('Password updated!','success');
    ['pw-old','pw-new','pw-confirm'].forEach(id=>document.getElementById(id).value='');
  },

  loadAcademicSettings(){
    const school=DB.get('school',{});
    document.getElementById('ac-year').value=school.academicYear||'2025/2026';
    document.getElementById('ac-term').value=school.currentTerm||'2';
    document.getElementById('ac-grade-sys').value=school.gradeSystem||'percentage';
    document.getElementById('ac-pass').value=school.passMark||50;
    document.getElementById('ac-currency').value=school.currency||'GHS';
    document.getElementById('ac-type').value=school.type||'k12';
    this.renderAcademicYearHistory();
  },

  saveAcademic(){
    const school=DB.get('school',{});
    school.academicYear=document.getElementById('ac-year').value;
    school.currentTerm=document.getElementById('ac-term').value;
    school.gradeSystem=document.getElementById('ac-grade-sys').value;
    school.passMark=+document.getElementById('ac-pass').value;
    school.currency=document.getElementById('ac-currency').value;
    school.type=document.getElementById('ac-type').value;
    _currency=school.currency;
    _currentTerm=school.currentTerm;
    _academicYear=school.academicYear;
    _passMark=school.passMark;
    _gradeSystem=school.gradeSystem;
    // Ensure this year is in academicYears list
    if(!school.academicYears) school.academicYears=[];
    if(!school.academicYears.find(y=>y.year===school.academicYear)){
      school.academicYears.push({year:school.academicYear,isCurrent:true,label:school.academicYear});
    }
    // Mark current year
    school.academicYears.forEach(y=>y.isCurrent=(y.year===school.academicYear));
    DB.set('school',school);
    // Ensure fee structure exists for new year
    const fs=DB.get('feeStructure',[]);
    const classes=DB.get('classes',[]);
    let fsChanged=false;
    classes.forEach(c=>{
      if(!fs.find(f=>f.classId===c.id&&f.year===school.academicYear)){
        // Copy from most recent year for this class
        const prev=fs.filter(f=>f.classId===c.id).sort((a,b)=>(b.year||'').localeCompare(a.year||''))[0];
        fs.push({id:uid('fs'),classId:c.id,year:school.academicYear,term1:prev?.term1||0,term2:prev?.term2||0,term3:prev?.term3||0});
        fsChanged=true;
      }
    });
    if(fsChanged) DB.set('feeStructure',fs);
    this.audit('Settings','settings','Academic settings updated — Year: '+school.academicYear+' Term: '+school.currentTerm);
    this.toast('Academic settings saved!','success');
    // Refresh hero stats and dashboard
    this.setupTopbar();
    if(document.getElementById('page-dashboard')?.classList.contains('active')) this.loadDashboard();
    this.renderAcademicYearHistory();
  },

  renderAcademicYearHistory(){
    const el=document.getElementById('ac-year-history'); if(!el) return;
    const school=DB.get('school',{});
    const years=getAllAcademicYears();
    const classes=DB.get('classes',[]);
    el.innerHTML=years.map(y=>{
      const isCurrent=y.year===school.academicYear;
      const payments=DB.get('feePayments',[]).filter(p=>p.academicYear===y.year);
      const totalCollected=payments.reduce((s,p)=>s+(+p.amount||0),0);
      const structCount=DB.get('feeStructure',[]).filter(f=>f.year===y.year).length;
      return `<div class="ay-card${isCurrent?' ay-card-current':''}">
        <div class="ay-card-left">
          <div class="ay-year-badge${isCurrent?' ay-year-badge-current':''}">${y.year}</div>
          ${isCurrent?'<span class="badge badge-success" style="font-size:.62rem">Current Year</span>':''}
        </div>
        <div class="ay-card-meta">
          <div class="ay-meta-item"><span>📅</span> ${y.startDate?fmtDate(y.startDate):'—'} → ${y.endDate?fmtDate(y.endDate):'—'}</div>
          <div class="ay-meta-item"><span>🏫</span> ${structCount}/${classes.length} class fee structures set</div>
          <div class="ay-meta-item"><span>💰</span> ${fmt(totalCollected)} collected (${payments.length} payments)</div>
        </div>
        <div class="ay-card-actions">
          ${!isCurrent?`<button class="btn btn-secondary btn-sm" onclick="SMS.setCurrentYear('${y.year}')">Set as Current</button>`:''}
          <button class="btn btn-secondary btn-sm" onclick="SMS.openFeeStructureForYear('${y.year}')">Fee Structure</button>
          <button class="btn btn-primary btn-sm" onclick="SMS.openHistoricalFeeEntry('${y.year}')">Enter Fee Data</button>
          ${!isCurrent?`<button class="btn btn-ghost btn-sm" style="color:var(--danger)" onclick="SMS.deleteAcademicYear('${y.year}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" width="13" height="13"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg></button>`:''}
        </div>
      </div>`;
    }).join('')||'<div style="color:var(--t4);font-size:.85rem;padding:1rem">No academic years configured yet.</div>';
  },

  setCurrentYear(year){
    const school=DB.get('school',{});
    school.academicYear=year;
    // Set term 1 as default when switching years
    school.currentTerm='1';
    school.academicYears=(school.academicYears||[]).map(y=>({...y,isCurrent:y.year===year}));
    _academicYear=year; _currentTerm='1';
    _passMark=school.passMark||50;
    _gradeSystem=school.gradeSystem||'percentage';
    DB.set('school',school);
    document.getElementById('ac-year').value=year;
    document.getElementById('ac-term').value='1';
    this.toast(`Switched to ${year} — Term 1`,'success');
    this.setupTopbar();
    this.renderAcademicYearHistory();
    if(document.getElementById('page-dashboard')?.classList.contains('active')) this.loadDashboard();
    this.audit('Settings','settings','Academic year switched to '+year);
  },

  openAddYearModal(){
    const school=DB.get('school',{});
    // Suggest the next logical year
    const latest=getAllAcademicYears()[0]?.year||'2025/2026';
    const parts=latest.split('/');
    const suggestStart=+parts[0]+1; const suggestEnd=+parts[1]+1;
    const suggested=`${suggestStart}/${suggestEnd}`;
    document.getElementById('new-ay-year').value=suggested;
    document.getElementById('new-ay-start').value=`${suggestStart}-09-01`;
    document.getElementById('new-ay-end').value=`${suggestEnd}-07-31`;
    document.getElementById('new-ay-err').style.display='none';
    this.openModal('m-add-year');
  },

  saveNewYear(){
    const year=document.getElementById('new-ay-year').value.trim();
    const startDate=document.getElementById('new-ay-start').value;
    const endDate=document.getElementById('new-ay-end').value;
    const errEl=document.getElementById('new-ay-err');
    if(!year||!/^\d{4}\/\d{4}$/.test(year)){
      errEl.style.display='block'; errEl.textContent='Year must be in format YYYY/YYYY (e.g. 2023/2024)'; return;
    }
    const school=DB.get('school',{});
    if(!school.academicYears) school.academicYears=[];
    if(school.academicYears.find(y=>y.year===year)){
      errEl.style.display='block'; errEl.textContent=`${year} already exists.`; return;
    }
    school.academicYears.push({year,isCurrent:false,label:year,startDate,endDate});
    DB.set('school',school);
    // Auto-create fee structure for this year based on current year's rates
    const fs=DB.get('feeStructure',[]); const classes=DB.get('classes',[]);
    const copyFrom=school.academicYear||_academicYear;
    classes.forEach(c=>{
      if(!fs.find(f=>f.classId===c.id&&f.year===year)){
        const prev=fs.find(f=>f.classId===c.id&&f.year===copyFrom)||fs.filter(f=>f.classId===c.id).sort((a,b)=>(b.year||'').localeCompare(a.year||''))[0];
        fs.push({id:uid('fs'),classId:c.id,year,term1:prev?.term1||0,term2:prev?.term2||0,term3:prev?.term3||0});
      }
    });
    DB.set('feeStructure',fs);
    this.closeModal('m-add-year');
    this.renderAcademicYearHistory();
    this.audit('Settings','settings','Academic year added: '+year);
    this.toast(`${year} added! Adjust its fee structure and enter historical payments.`,'success');
  },

  deleteAcademicYear(year){
    if(!confirm(`Delete academic year ${year}? This will also remove all fee payments recorded for this year.`)) return;
    const school=DB.get('school',{});
    school.academicYears=(school.academicYears||[]).filter(y=>y.year!==year);
    DB.set('school',school);
    // Remove fee payments for that year
    DB.set('feePayments',DB.get('feePayments',[]).filter(p=>p.academicYear!==year));
    // Remove fee structures for that year
    DB.set('feeStructure',DB.get('feeStructure',[]).filter(f=>f.year!==year));
    // Remove from students' feesPaid
    const students=DB.get('students',[]);
    students.forEach(s=>{ if(s.feesPaid&&s.feesPaid[year]){ delete s.feesPaid[year]; } });
    DB.set('students',students);
    this.renderAcademicYearHistory();
    this.toast(`${year} deleted.`,'info');
  },

  openFeeStructureForYear(year){
    // Open the fee structure modal pre-filtered to the selected year
    const school=DB.get('school',{});
    const prev=school.academicYear;
    // Temporarily switch year filter to show that year's structure
    document.getElementById('fee-year-f') && (document.getElementById('fee-year-f').value=year);
    SMS.nav('fees');
    // Switch to fee structure tab
    setTimeout(()=>{
      document.querySelectorAll('.fee-tab').forEach(t=>t.classList.remove('active'));
      document.querySelectorAll('.fee-pane').forEach(p=>p.classList.remove('active'));
      const structTab=document.querySelector('.fee-tab[data-pane="structure"]');
      const structPane=document.getElementById('fee-pane-structure');
      if(structTab) structTab.classList.add('active');
      if(structPane) structPane.classList.add('active');
      this.renderFeeStructure();
    },100);
  },

  openHistoricalFeeEntry(year){
    const students=DB.get('students',[]).filter(s=>s.status==='active');
    const classes=DB.get('classes',[]);
    const fs=DB.get('feeStructure',[]).filter(f=>f.year===year);
    document.getElementById('hist-fee-year-title').textContent=year;
    document.getElementById('hist-fee-year-input').value=year;
    const tbody=document.getElementById('hist-fee-tbody');
    if(!tbody) return;
    tbody.innerHTML=students.map(s=>{
      const fss=fs.find(f=>f.classId===s.classId);
      const yf=getYearFees(s,year);
      const t1due=+(fss?.term1||0), t2due=+(fss?.term2||0), t3due=+(fss?.term3||0);
      const p1=+(yf.term1||0), p2=+(yf.term2||0), p3=+(yf.term3||0);
      const cls=classes.find(c=>c.id===s.classId);
      const rowClass=p1+p2+p3>0?'hist-row-has-data':'';
      return `<tr class="${rowClass}" id="hist-row-${s.id}">
        <td><div style="font-weight:600;font-size:.82rem">${sanitize(s.fname)} ${sanitize(s.lname)}</div>
          <div style="font-size:.7rem;color:var(--t4)">${cls?.name||'—'} · ${s.studentId}</div></td>
        <td style="font-size:.72rem;color:var(--t3)">${fss?fmt(t1due):'—'}</td>
        <td><input type="number" class="form-input hist-amt" style="width:90px;padding:.3rem .5rem;font-size:.8rem" min="0" step="0.01" value="${p1||''}" placeholder="0.00" data-sid="${s.id}" data-term="term1" onchange="SMS._histRowUpdate('${s.id}','${year}')"></td>
        <td style="font-size:.72rem;color:var(--t3)">${fss?fmt(t2due):'—'}</td>
        <td><input type="number" class="form-input hist-amt" style="width:90px;padding:.3rem .5rem;font-size:.8rem" min="0" step="0.01" value="${p2||''}" placeholder="0.00" data-sid="${s.id}" data-term="term2" onchange="SMS._histRowUpdate('${s.id}','${year}')"></td>
        <td style="font-size:.72rem;color:var(--t3)">${fss?fmt(t3due):'—'}</td>
        <td><input type="number" class="form-input hist-amt" style="width:90px;padding:.3rem .5rem;font-size:.8rem" min="0" step="0.01" value="${p3||''}" placeholder="0.00" data-sid="${s.id}" data-term="term3" onchange="SMS._histRowUpdate('${s.id}','${year}')"></td>
        <td class="hist-balance-cell" id="hist-bal-${s.id}" style="font-weight:700;font-size:.8rem;white-space:nowrap">${this._histBalance(p1,p2,p3,t1due,t2due,t3due)}</td>
      </tr>`;
    }).join('')||'<tr><td colspan="8" class="tbl-empty">No active students found.</td></tr>';
    this.openModal('m-hist-fees');
  },

  _histBalance(p1,p2,p3,t1,t2,t3){
    const total=(+t1||0)+(+t2||0)+(+t3||0);
    const paid=(+p1||0)+(+p2||0)+(+p3||0);
    const owed=Math.max(0,total-paid);
    if(!total) return '<span style="color:var(--t4)">No structure</span>';
    if(owed===0) return `<span style="color:var(--success)">✓ ${fmt(paid)}</span>`;
    return `<span style="color:var(--danger)">${fmt(owed)} owed</span>`;
  },

  _histRowUpdate(sid,year){
    const s=DB.get('students',[]).find(x=>x.id===sid); if(!s) return;
    const fss=getYearStructure(sid?s.classId:null,year)||{term1:0,term2:0,term3:0};
    const p1=+document.querySelector(`[data-sid="${sid}"][data-term="term1"]`)?.value||0;
    const p2=+document.querySelector(`[data-sid="${sid}"][data-term="term2"]`)?.value||0;
    const p3=+document.querySelector(`[data-sid="${sid}"][data-term="term3"]`)?.value||0;
    const balEl=document.getElementById('hist-bal-'+sid);
    if(balEl) balEl.innerHTML=this._histBalance(p1,p2,p3,fss.term1,fss.term2,fss.term3);
    const row=document.getElementById('hist-row-'+sid);
    if(row) row.classList.toggle('hist-row-has-data',(p1+p2+p3)>0);
  },

  saveHistoricalFees(){
    const year=document.getElementById('hist-fee-year-input')?.value;
    if(!year){ this.toast('No year selected','danger'); return; }
    const inputs=document.querySelectorAll('.hist-amt');
    const students=DB.get('students',[]);
    const payments=DB.get('feePayments',[]);
    let savedCount=0;
    const byStudent={};
    inputs.forEach(inp=>{
      const sid=inp.dataset.sid, term=inp.dataset.term, amount=+(inp.value||0);
      if(!sid) return;
      if(!byStudent[sid]) byStudent[sid]={};
      byStudent[sid][term]=amount;
    });
    Object.entries(byStudent).forEach(([sid,terms])=>{
      const si=students.findIndex(s=>s.id===sid); if(si<0) return;
      if(!students[si].feesPaid||typeof students[si].feesPaid.term1==='number') students[si].feesPaid={};
      const prev=students[si].feesPaid[year]||{term1:0,term2:0,term3:0};
      students[si].feesPaid[year]={term1:+(terms.term1||0),term2:+(terms.term2||0),term3:+(terms.term3||0)};
      // Sync feePayments: remove old historical payments for this student/year, re-add as single records
      const filtered=payments.filter(p=>!(p.studentId===sid&&p.academicYear===year&&p.ref==='historical-entry'));
      const s=students[si];
      ['term1','term2','term3'].forEach((t,ti)=>{
        const amt=+(terms[t]||0); if(amt<=0) return;
        const maxRec=filtered.reduce((mx,p)=>{ const n=parseInt((p.receiptNo||'').replace('REC-','')||0); return n>mx?n:mx; },0);
        filtered.push({id:uid('fp'),studentId:sid,term:String(ti+1),amount:amt,method:'historical',date:year.split('/')[0]+'-09-01',by:this.currentUser.name,receiptNo:'REC-'+String(maxRec+1).padStart(4,'0'),academicYear:year,ref:'historical-entry'});
        savedCount++;
      });
      payments.length=0; filtered.forEach(p=>payments.push(p));
    });
    DB.set('students',students);
    DB.set('feePayments',[...payments]);
    this.closeModal('m-hist-fees');
    this.audit('Historical Fees','create',`Historical fee data saved for ${year} — ${savedCount} term records`);
    this.toast(`Historical fees saved for ${year}!`,'success');
    this.renderAcademicYearHistory();
  },

  loadAppearanceSettings(){
    const dark=DB.get('darkMode',false); document.getElementById('dark-mode-toggle').checked=dark;
    const savedColors=DB.get('themeColors'); if(savedColors){ document.getElementById('custom-primary').value=savedColors.primary; document.getElementById('custom-primary-hex').value=savedColors.primary; document.getElementById('custom-teal').value=savedColors.teal; document.getElementById('custom-teal-hex').value=savedColors.teal; }
    const savedFont=DB.get('fontSize'); if(savedFont) document.querySelectorAll('.fsz-btn').forEach(b=>b.classList.toggle('active',b.dataset.size===savedFont));
  },

  renderUsers(){
    const users=DB.get('users',[]);
    document.getElementById('users-tbody').innerHTML=users.map(u=>`<tr>
      <td><div style="display:flex;align-items:center;gap:.6rem"><div class="mini-av" style="background:var(--brand-lt);color:var(--brand)">${u.name.split(' ').map(n=>n[0]).join('').slice(0,2)}</div><div style="font-weight:600">${sanitize(u.name)}</div></div></td>
      <td style="font-size:.8rem">${sanitize(u.email)}</td>
      <td><span class="badge ${u.role==='admin'?'badge-brand':'badge-info'}">${u.role}</span></td>
      <td style="font-size:.78rem;color:var(--t4)">${u.lastLogin?fmtDate(u.lastLogin):'Never'}</td>
      <td>${statusBadge('active')}</td>
      <td>${u.id!==this.currentUser.id?`<button class="btn btn-ghost btn-sm" onclick="SMS.confirmDelete('Remove user ${sanitize(u.name)}?',()=>SMS.deleteUser('${u.id}'))" style="color:var(--danger);padding:.3rem .5rem"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg></button>`:''}</td>
    </tr>`).join('');
  },

  openUserModal(){
    ['uf-id','uf-name','uf-email','uf-pwd'].forEach(id=>{ const e=document.getElementById(id); if(e) e.value=''; });
    document.getElementById('uf-role').value='staff'; document.getElementById('uf-err').style.display='none';
    document.getElementById('user-modal-title').textContent='Add User';
    this.openModal('m-user');
  },

  async saveUser(){
    const name=document.getElementById('uf-name').value.trim(); const email=document.getElementById('uf-email').value.trim(); const pwd=document.getElementById('uf-pwd').value; const role=document.getElementById('uf-role').value;
    const errEl=document.getElementById('uf-err');
    if(!name||!email||!pwd){ errEl.style.display='block'; errEl.textContent='All fields required.'; return; }
    if(pwd.length<8){ errEl.style.display='block'; errEl.textContent='Password must be at least 8 characters.'; return; }
    const users=DB.get('users',[]); if(users.find(u=>u.email===email)){ errEl.style.display='block'; errEl.textContent='Email already exists.'; return; }
    const passwordHash=await hashPassword(pwd);
    users.push({id:uid('u'),email,passwordHash,name,role,phone:'',createdAt:new Date().toISOString(),lastLogin:null});
    DB.set('users',users); this.audit('Add User','create',`New user: ${name} (${role})`); this.toast('User created!','success'); this.closeModal('m-user'); this.renderUsers();
  },

  deleteUser(id){ const users=DB.get('users',[]); const u=users.find(x=>x.id===id); DB.set('users',users.filter(x=>x.id!==id)); const _sid=window.SMS&&window.SMS.schoolId; if(_sid&&window.FDB) FDB.delete(_sid,'users',id).catch(()=>{}); this.audit('Delete User','delete',`Removed user: ${u?.name}`); this.toast('User removed','warn'); this.renderUsers(); },

  renderBackupStats(){
    const s=DB.get('students',[]); const st=DB.get('staff',[]); const fp=DB.get('feePayments',[]); const al=DB.get('auditLog',[]);
    document.getElementById('backup-stats').innerHTML=[{val:s.length,lbl:'Students'},{val:st.length,lbl:'Staff'},{val:fp.length,lbl:'Payments'},{val:al.length,lbl:'Audit Entries'}].map(x=>`<div class="data-stat"><div class="data-stat-val">${x.val}</div><div class="data-stat-lbl">${x.lbl}</div></div>`).join('');
  },

  exportBackup(){
    if(typeof XLSX==='undefined'){ this.toast('Export library not loaded','error'); return; }
    const wb=XLSX.utils.book_new();
    const sheets={Students:DB.get('students',[]),Staff:DB.get('staff',[]),'Fee Payments':DB.get('feePayments',[]),Exams:DB.get('exams',[]),Events:DB.get('events',[]),Expenses:DB.get('expenses',[]),'Audit Log':DB.get('auditLog',[])};
    Object.entries(sheets).forEach(([name,data])=>{ const ws=XLSX.utils.json_to_sheet(data); XLSX.utils.book_append_sheet(wb,ws,name); });
    XLSX.writeFile(wb,`BackupFull_${new Date().toISOString().split('T')[0]}.xlsx`);
    this.audit('Backup','settings','Full database backup downloaded');
    this.toast('Full backup downloaded!','success');
  },

  uploadLogo(e){ const file=e.target.files[0]; if(!file) return; const reader=new FileReader(); reader.onload=ev=>{ const preview=document.getElementById('school-logo-preview'); if(preview) preview.innerHTML=`<img src="${ev.target.result}" style="width:100%;height:100%;object-fit:contain">`; const school=DB.get('school',{}); school.logo=ev.target.result; DB.set('school',school); this.toast('Logo uploaded!','success'); }; reader.readAsDataURL(file); },

  uploadAvatar(e){ const file=e.target.files[0]; if(!file) return; const reader=new FileReader(); reader.onload=ev=>{ const users=DB.get('users',[]); const i=users.findIndex(u=>u.id===this.currentUser.id); if(i>-1){ users[i].avatar=ev.target.result; DB.set('users',users); this.currentUser=users[i]; } ['user-av','sb-user-av'].forEach(id=>{ const el=document.getElementById(id); if(el) el.innerHTML=`<img src="${ev.target.result}" style="width:100%;height:100%;border-radius:99px;object-fit:cover">`; }); const av=document.getElementById('av-preview'); if(av) av.innerHTML=`<img src="${ev.target.result}" style="width:100%;height:100%;border-radius:99px;object-fit:cover">`; this.toast('Profile photo updated!','success'); }; reader.readAsDataURL(file); },

  // ══ GLOBAL SEARCH ══
  globalSearch(q){
    const results=document.getElementById('search-results'); if(!q.trim()){ results.innerHTML=''; return; }
    const ql=q.toLowerCase(); const hits=[];
    const iconSvg={
      students:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" width="18" height="18"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3.53 1.76 9.47 1.76 12 0v-5"/></svg>`,
      staff:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" width="18" height="18"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>`,
      fees:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" width="18" height="18"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>`,
    };
    DB.get('students',[]).filter(s=>`${sanitize(s.fname)} ${sanitize(s.lname)} ${s.studentId} ${s.dadName||''} ${s.dadPhone||''}`.toLowerCase().includes(ql)).slice(0,5).forEach(s=>hits.push({iconHtml:iconSvg.students,color:'var(--brand-lt)',iconColor:'var(--brand)',title:`${sanitize(s.fname)} ${sanitize(s.lname)}`,sub:`${s.studentId} · ${this.className(s.classId)} · ${s.status}`,action:()=>{ SMS.viewStudent(s.id); document.getElementById('search-overlay').style.display='none'; }}));
    DB.get('staff',[]).filter(s=>`${sanitize(s.fname)} ${sanitize(s.lname)} ${s.subjects||''} ${s.email||''}`.toLowerCase().includes(ql)).slice(0,3).forEach(s=>hits.push({iconHtml:iconSvg.staff,color:'var(--brand-teal-lt)',iconColor:'var(--brand-teal)',title:`${sanitize(s.fname)} ${sanitize(s.lname)}`,sub:`${sanitize(s.role)} · ${s.dept||''} · ${sanitize(s.phone)}`,action:()=>{ SMS.nav('staff'); document.getElementById('search-overlay').style.display='none'; }}));
    DB.get('feePayments',[]).filter(p=>{ const s=DB.get('students',[]).find(x=>x.id===p.studentId); return s&&`${sanitize(s.fname)} ${sanitize(s.lname)} ${p.receiptNo||''}`.toLowerCase().includes(ql); }).slice(0,2).forEach(p=>{ const s=DB.get('students',[]).find(x=>x.id===p.studentId); hits.push({iconHtml:iconSvg.fees,color:'rgba(13,148,136,.08)',iconColor:'var(--brand-teal)',title:`Receipt ${p.receiptNo||'—'}`,sub:`${s?.fname} ${s?.lname} · ${fmt(p.amount)} · Term ${p.term}`,action:()=>{ SMS.nav('fees'); document.getElementById('search-overlay').style.display='none'; }}); });
    if(hits.length===0){ results.innerHTML='<div style="padding:2rem;text-align:center;font-size:.85rem;color:var(--t4)">No results found</div>'; return; }
    results.innerHTML=hits.map((h,i)=>`<div style="display:flex;align-items:center;gap:.85rem;padding:.75rem 1.25rem;cursor:pointer;border-bottom:1px solid var(--border);font-size:.85rem" onmouseover="this.style.background='var(--surface-2)'" onmouseout="this.style.background=''" id="sr_${i}"><div style="width:32px;height:32px;border-radius:8px;background:${h.color};color:${h.iconColor};display:flex;align-items:center;justify-content:center;flex-shrink:0">${h.iconHtml}</div><div><div style="font-weight:600;color:var(--t1)">${sanitize(h.title)}</div><div style="font-size:.75rem;color:var(--t3)">${sanitize(h.sub)}</div></div></div>`).join('');
    hits.forEach((h,i)=>document.getElementById('sr_'+i)?.addEventListener('click',h.action));
  },

  // ══ NOTIFICATIONS ══
  loadNotifications(){
    const log=DB.get('auditLog',[]);
    const recent=[...log].reverse().slice(0,15);
    const list=document.getElementById('notif-list');
    const badge=document.getElementById('notif-badge');
    const icons={create:'create',edit:'edit',delete:'delete',login:'login',default:'info'};
    const colors={create:'#16a34a',edit:'#2563eb',delete:'#dc2626',login:'#0d9488',default:'#6b7280'};
    const pageMap={
      'Enroll Student':'students','Edit Student':'students','Delete Student':'students',
      'Add Staff':'staff','Edit Staff':'staff','Delete Staff':'staff',
      'Fee Payment':'fees','Payroll':'payroll',
      'Attendance':'attendance','Grades Entry':'exams','Create Exam':'exams',
      'Add Event':'events','Add Class':'classes','Add Subject':'classes',
      'Send Message':'messages','Leave':'leave','Login':'dashboard','Logout':'dashboard',
    };
    function timeAgo(t){
      const s=Math.floor((Date.now()-new Date(t))/1000);
      if(s<60) return 'just now';
      if(s<3600) return Math.floor(s/60)+'m ago';
      if(s<86400) return Math.floor(s/3600)+'h ago';
      return Math.floor(s/86400)+'d ago';
    }
    if(recent.length===0){
      list.innerHTML='<div class="notif-empty">No activity yet</div>';
      badge.style.display='none'; return;
    }
    const newCount=recent.filter(l=>Date.now()-new Date(l.time)<3*86400000).length;
    list.innerHTML=recent.map(l=>{
      const icon=icons[l.type]||icons.default;
      const color=colors[l.type]||colors.default;
      const page=pageMap[l.action]||'dashboard';
      return `<div onclick="SMS.nav('${page}');document.getElementById('notif-panel').style.display='none';"
        style="display:flex;align-items:flex-start;gap:.65rem;padding:.85rem 1rem;border-bottom:1px solid var(--border);cursor:pointer;transition:background .15s"
        onmouseover="this.style.background='var(--surface-2)'" onmouseout="this.style.background=''">
        <div style="width:32px;height:32px;border-radius:8px;background:${color}18;display:flex;align-items:center;justify-content:center;font-size:.85rem;flex-shrink:0">${icon}</div>
        <div style="flex:1;min-width:0">
          <div style="font-size:.8rem;font-weight:600;color:var(--t1);margin-bottom:.1rem">${sanitize(l.action)}</div>
          <div style="font-size:.75rem;color:var(--t3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${sanitize(l.details||'')}</div>
          <div style="font-size:.68rem;color:var(--t4);margin-top:.2rem">${timeAgo(l.time)} · ${sanitize(l.user)}</div>
        </div>
      </div>`;
    }).join('');
    badge.style.display=newCount>0?'flex':'none';
    badge.textContent=newCount>9?'9+':newCount;
  },

  // ══ HELPERS ══
  _emptyState(icon, title, subtitle, actionLabel, actionFn) {
    const svgIcons = {
      students: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" width="32" height="32"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3.53 1.76 9.47 1.76 12 0v-5"/></svg>`,
      staff: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" width="32" height="32"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
      fees: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" width="32" height="32"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>`,
      exams: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" width="32" height="32"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`,
      books: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" width="32" height="32"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>`,
      attendance: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" width="32" height="32"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>`,
      expenses: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" width="32" height="32"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>`,
      default: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" width="32" height="32"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
    };
    const svg = svgIcons[icon] || svgIcons.default;
    const btn = actionLabel ? `<button class="btn btn-primary btn-sm" style="margin-top:.85rem" onclick="${actionFn}">${actionLabel}</button>` : '';
    return `<tr><td colspan="20" style="padding:3rem 1rem;text-align:center">
      <div style="display:inline-flex;flex-direction:column;align-items:center;gap:.5rem;max-width:280px">
        <div style="width:56px;height:56px;border-radius:14px;background:var(--surface-3);color:var(--t4);display:flex;align-items:center;justify-content:center;margin-bottom:.35rem">${svg}</div>
        <div style="font-size:.9rem;font-weight:700;color:var(--t2)">${title}</div>
        <div style="font-size:.78rem;color:var(--t4);line-height:1.55">${subtitle}</div>
        ${btn}
      </div>
    </td></tr>`;
  },
  className(id){ const c=DB.get('classes',[]).find(x=>x.id===id); return c?.name||'—'; },
  subjectName(id){ const s=DB.get('subjects',[]).find(x=>x.id===id); return s?.name||'—'; },

  toast(msg,type='success'){
    const t=document.getElementById('toast'); const m=document.getElementById('toast-msg');
    t.className='toast '+type; m.textContent=msg; t.classList.add('show');
    clearTimeout(this._toastTimer); this._toastTimer=setTimeout(()=>t.classList.remove('show'),3200);
  },

  audit(action,type,details){
    const log=DB.get('auditLog',[]); log.push({id:uid('al'),action,type,user:this.currentUser?.name||'System',details,time:new Date().toISOString()});
    if(log.length>500) log.splice(0,log.length-500);
    DB.set('auditLog',log);
  },

  openModal(id){
    const modal = document.getElementById(id);
    if (!modal) return;
    modal.style.display='flex';
    modal.setAttribute('role','dialog');
    modal.setAttribute('aria-modal','true');
    document.body.style.overflow='hidden';
    // Focus first focusable element
    requestAnimationFrame(()=>{
      const focusable = modal.querySelectorAll('input:not([disabled]),select:not([disabled]),textarea:not([disabled]),button:not([disabled]),[tabindex]:not([tabindex="-1"])');
      if(focusable.length) focusable[0].focus();
    });
    // Trap focus within modal
    modal._trapFocus = (e)=>{
      if(e.key!=='Tab') return;
      const focusable = [...modal.querySelectorAll('input:not([disabled]),select:not([disabled]),textarea:not([disabled]),button:not([disabled]),[tabindex]:not([tabindex="-1"])')];
      if(!focusable.length) return;
      const first=focusable[0], last=focusable[focusable.length-1];
      if(e.shiftKey){ if(document.activeElement===first){ last.focus(); e.preventDefault(); } }
      else { if(document.activeElement===last){ first.focus(); e.preventDefault(); } }
    };
    modal._escClose = (e)=>{ if(e.key==='Escape') this.closeModal(id); };
    document.addEventListener('keydown', modal._trapFocus);
    document.addEventListener('keydown', modal._escClose);
  },
  closeModal(id){
    const modal = document.getElementById(id);
    if (!modal) return;
    modal.style.display='none';
    document.body.style.overflow='';
    if(modal._trapFocus) document.removeEventListener('keydown', modal._trapFocus);
    if(modal._escClose) document.removeEventListener('keydown', modal._escClose);
  },

  confirmDelete(msg,callback){
    document.getElementById('del-msg').textContent=msg;
    this.deleteCallback=callback;
    this.openModal('m-delete');
  },

  loadTheme(){
    const dark=DB.get('darkMode',false);
    if(dark){ document.documentElement.dataset.theme='dark'; const sun=document.querySelector('.icon-sun'), moon=document.querySelector('.icon-moon'); if(sun) sun.style.display='none'; if(moon) moon.style.display=''; }
    const saved=DB.get('themeColors'); if(saved) this.applyThemeColors(saved.primary,saved.teal,false);
    const sz=DB.get('fontSize'); if(sz){ const sizes={small:'13px',medium:'15px',large:'17px'}; document.documentElement.style.fontSize=sizes[sz]; }
  },

  applyThemeColors(primary,teal,save=true){
    document.documentElement.style.setProperty('--brand',primary);
    document.documentElement.style.setProperty('--brand-dk',this.darken(primary,0.15));
    document.documentElement.style.setProperty('--brand-teal',teal);
    document.documentElement.style.setProperty('--brand-teal-dk',this.darken(teal,0.15));
    document.documentElement.style.setProperty('--brand-lt',this.hexToRgba(primary,0.08));
    document.documentElement.style.setProperty('--brand-lt2',this.hexToRgba(primary,0.15));
    document.documentElement.style.setProperty('--brand-teal-lt',this.hexToRgba(teal,0.08));
    if(save) DB.set('themeColors',{primary,teal});
  },

  applyCustomTheme(){ const p=document.getElementById('custom-primary-hex')?.value; const t=document.getElementById('custom-teal-hex')?.value; if(p&&t){ this.applyThemeColors(p,t); this.toast('Custom theme applied!','success'); } },

  toggleTheme(){ const isDark=document.documentElement.dataset.theme==='dark'; document.documentElement.dataset.theme=isDark?'light':'dark'; DB.set('darkMode',!isDark); const sun=document.querySelector('.icon-sun'), moon=document.querySelector('.icon-moon'); if(sun) sun.style.display=isDark?'':'none'; if(moon) moon.style.display=isDark?'none':''; const tog=document.getElementById('dark-mode-toggle'); if(tog) tog.checked=!isDark; },

  darken(hex,pct){ hex=hex.replace('#',''); let r=parseInt(hex.slice(0,2),16),g=parseInt(hex.slice(2,4),16),b=parseInt(hex.slice(4,6),16); r=Math.max(0,Math.floor(r*(1-pct))); g=Math.max(0,Math.floor(g*(1-pct))); b=Math.max(0,Math.floor(b*(1-pct))); return '#'+[r,g,b].map(x=>x.toString(16).padStart(2,'0')).join(''); },



  hexToRgba(hex,a){ hex=hex.replace('#',''); const r=parseInt(hex.slice(0,2),16),g=parseInt(hex.slice(2,4),16),b=parseInt(hex.slice(4,6),16); return `rgba(${r},${g},${b},${a})`; },

  deleteBook(id){
    const issues=DB.get('bookIssues',[]).filter(i=>!i.returnedDate&&i.bookId===id);
    if(issues.length>0){ this.toast('Cannot delete: book has active borrowings','error'); return; }
    DB.set('books',DB.get('books',[]).filter(b=>b.id!==id));
    const _sid=window.SMS&&window.SMS.schoolId; if(_sid&&window.FDB) FDB.delete(_sid,'books',id).catch(()=>{});
    this.toast('Book deleted','warn'); this.loadLibrary();
  },

  // ══ STUDENT PROMOTION WIZARD ══
  openPromotionWizard(){
    const classes=DB.get('classes',[]).sort((a,b)=>a.name.localeCompare(b.name));
    const students=DB.get('students',[]).filter(s=>s.status==='active');
    document.getElementById('receipt-title').textContent='Year-End Student Promotion';
    document.getElementById('receipt-body').innerHTML=`
      <div style="font-size:.82rem;color:var(--t3);margin-bottom:.9rem">Move all active students from one class to the next at the end of the academic year.</div>
      <div style="display:grid;grid-template-columns:1fr auto 1fr;gap:.5rem;align-items:center;margin-bottom:.75rem">
        <div>
          <label style="font-size:.78rem;font-weight:600;color:var(--t2);display:block;margin-bottom:.3rem">From Class</label>
          <select id="promo-from" class="form-select" style="width:100%" onchange="SMS._updatePromotionPreview()">
            <option value="">— Select —</option>${classes.map(c=>`<option value="${c.id}">${sanitize(c.name)}</option>`).join('')}
          </select>
        </div>
        <div style="text-align:center;font-size:1.2rem;padding-top:1.2rem">→</div>
        <div>
          <label style="font-size:.78rem;font-weight:600;color:var(--t2);display:block;margin-bottom:.3rem">To Class</label>
          <select id="promo-to" class="form-select" style="width:100%" onchange="SMS._updatePromotionPreview()">
            <option value="">— Select —</option>${classes.map(c=>`<option value="${c.id}">${sanitize(c.name)}</option>`).join('')}
          </select>
        </div>
      </div>
      <div id="promo-preview" style="display:none;background:var(--surface-2);border-radius:8px;padding:.75rem;margin-bottom:.75rem;font-size:.82rem"></div>
      <div style="display:flex;gap:.5rem;justify-content:flex-end">
        <button class="btn btn-secondary btn-sm" onclick="SMS.closeModal('m-receipt')">Cancel</button>
        <button class="btn btn-primary btn-sm" id="promo-confirm-btn" onclick="SMS.runPromotion()" style="display:none">Promote Students</button>
      </div>`;
    this.openModal('m-receipt');
  },

  _updatePromotionPreview(){
    const fromId=document.getElementById('promo-from').value;
    const toId=document.getElementById('promo-to').value;
    const preview=document.getElementById('promo-preview');
    const btn=document.getElementById('promo-confirm-btn');
    if(!fromId||!toId||fromId===toId){ preview.style.display='none'; btn.style.display='none'; return; }
    const students=DB.get('students',[]).filter(s=>s.classId===fromId&&s.status==='active');
    const toName=DB.get('classes',[]).find(c=>c.id===toId)?.name||'';
    const fromName=DB.get('classes',[]).find(c=>c.id===fromId)?.name||'';
    preview.style.display='block';
    btn.style.display='block';
    if(students.length===0){ preview.innerHTML=`<span style="color:var(--warn)">⚠ No active students found in ${fromName}.</span>`; btn.style.display='none'; return; }
    preview.innerHTML=`<strong>${students.length} student(s)</strong> will be moved from <strong>${fromName}</strong> → <strong>${toName}</strong>:<br><div style="margin-top:.4rem;max-height:100px;overflow-y:auto">${students.map(s=>`<span style="display:inline-block;margin:.15rem .3rem;background:var(--surface-3,rgba(0,0,0,.06));border-radius:4px;padding:.1rem .4rem">${sanitize(s.fname)} ${sanitize(s.lname)}</span>`).join('')}</div>`;
  },

  runPromotion(){
    const fromId=document.getElementById('promo-from').value;
    const toId=document.getElementById('promo-to').value;
    if(!fromId||!toId||fromId===toId){ this.toast('Select valid from/to classes','warn'); return; }
    const students=DB.get('students',[]);
    let count=0;
    students.forEach(s=>{ if(s.classId===fromId&&s.status==='active'){ s.classId=toId; count++; } });
    DB.set('students',students);
    const fromName=DB.get('classes',[]).find(c=>c.id===fromId)?.name||fromId;
    const toName=DB.get('classes',[]).find(c=>c.id===toId)?.name||toId;
    this.audit('Student Promotion','edit',`Promoted ${count} students from ${fromName} → ${toName}`);
    this.toast(`${count} student(s) promoted to ${toName}!`,'success');
    this.closeModal('m-receipt');
  },

  openExpenseModal(id=null){
    ['exp-id','exp-desc','exp-paidto','exp-approved','exp-ref','exp-notes'].forEach(f=>{ const e=document.getElementById(f); if(e) e.value=''; });
    document.getElementById('exp-date').value=new Date().toISOString().split('T')[0];
    document.getElementById('exp-amount').value='';
    document.getElementById('exp-category').value='';
    document.getElementById('exp-err').style.display='none';
    document.getElementById('expense-modal-title').textContent='Add Expense';
    if(id){
      const ex=DB.get('expenses',[]).find(x=>x.id===id); if(!ex) return;
      document.getElementById('exp-id').value=ex.id;
      document.getElementById('exp-date').value=ex.date;
      document.getElementById('exp-category').value=ex.category;
      document.getElementById('exp-desc').value=ex.desc;
      document.getElementById('exp-amount').value=ex.amount;
      document.getElementById('exp-paidto').value=ex.paidTo;
      document.getElementById('exp-approved').value=ex.approvedBy;
      document.getElementById('exp-notes').value=ex.notes||'';
      document.getElementById('expense-modal-title').textContent='Edit Expense';
    }
    document.getElementById('save-expense-btn').onclick=()=>this.saveExpense();
    this.openModal('m-expense');
  },

  saveExpense(){
    const date=document.getElementById('exp-date').value;
    const category=document.getElementById('exp-category').value;
    const desc=document.getElementById('exp-desc').value.trim();
    const amount=+document.getElementById('exp-amount').value;
    const paidTo=document.getElementById('exp-paidto').value.trim();
    const errEl=document.getElementById('exp-err');
    if(!date||!category||!desc||!amount||!paidTo){ errEl.style.display='block'; errEl.textContent='Please fill in all required fields.'; return; }
    errEl.style.display='none';
    const expenses=DB.get('expenses',[]);
    const existId=document.getElementById('exp-id').value;
    const data={date,category,desc,amount,paidTo,approvedBy:document.getElementById('exp-approved').value.trim()||this.currentUser.name,ref:document.getElementById('exp-ref').value,notes:document.getElementById('exp-notes').value};
    if(existId){ const i=expenses.findIndex(e=>e.id===existId); if(i>-1){ expenses[i]={...expenses[i],...data}; DB.set('expenses',expenses); this.toast('Expense updated','success'); this.audit('Edit Expense','edit',`Updated: ${desc} — ${fmt(amount)}`); } }
    else { expenses.push({id:uid('e'),...data}); DB.set('expenses',expenses); this.audit('Add Expense','create',`New expense: ${desc} — ${fmt(amount)} (${category})`); this.toast(`Expense of ${fmt(amount)} recorded!`,'success'); }
    this.closeModal('m-expense'); this.renderExpenses();
  },

  // ══ HOMEWORK FORM ══
  openHomeworkModal(id=null){
    const classes=DB.get('classes',[]); const subjects=DB.get('subjects',[]);
    const sel=document.getElementById('hw-class-sel');
    if(sel) sel.innerHTML='<option value="">— Select Class —</option>'+classes.map(c=>`<option value="${c.id}">${sanitize(c.name)}</option>`).join('');
    const ssel=document.getElementById('hw-subject-sel');
    if(ssel) ssel.innerHTML='<option value="">— Select Subject —</option>'+subjects.map(s=>`<option value="${s.id}">${sanitize(s.name)}</option>`).join('');
    ['hw-id','hw-title','hw-desc'].forEach(f=>{ const e=document.getElementById(f); if(e) e.value=''; });
    document.getElementById('hw-due').value='';
    document.getElementById('hw-status-sel').value='pending';
    document.getElementById('hw-err').style.display='none';
    document.getElementById('hw-modal-title').textContent=id?'Edit Homework':'Assign Homework';
    if(id){
      const hw=DB.get('homework',[]).find(x=>x.id===id); if(!hw) return;
      document.getElementById('hw-id').value=hw.id; document.getElementById('hw-title').value=hw.title;
      document.getElementById('hw-class-sel').value=hw.classId; document.getElementById('hw-subject-sel').value=hw.subjectId||'';
      document.getElementById('hw-due').value=hw.dueDate; document.getElementById('hw-status-sel').value=hw.status;
      document.getElementById('hw-desc').value=hw.desc||'';
    }
    document.getElementById('hw-class-sel').onchange=()=>{ const cid=document.getElementById('hw-class-sel').value; const filtered=subjects.filter(s=>!cid||s.classId===cid); document.getElementById('hw-subject-sel').innerHTML='<option value="">— Select Subject —</option>'+filtered.map(s=>`<option value="${s.id}">${sanitize(s.name)}</option>`).join(''); };
    document.getElementById('save-hw-btn').onclick=()=>this.saveHomework();
    this.openModal('m-homework');
  },

  saveHomework(){
    const title=document.getElementById('hw-title').value.trim(); const classId=document.getElementById('hw-class-sel').value; const dueDate=document.getElementById('hw-due').value;
    const errEl=document.getElementById('hw-err');
    if(!title||!classId||!dueDate){ errEl.style.display='block'; errEl.textContent='Title, class, and due date are required.'; return; }
    errEl.style.display='none';
    const hw=DB.get('homework',[]); const existId=document.getElementById('hw-id').value;
    const data={title,classId,subjectId:document.getElementById('hw-subject-sel').value,dueDate,status:document.getElementById('hw-status-sel').value,desc:document.getElementById('hw-desc').value,assignedBy:this.currentUser.id};
    if(existId){ const i=hw.findIndex(h=>h.id===existId); if(i>-1){ hw[i]={...hw[i],...data}; DB.set('homework',hw); this.toast('Homework updated','success'); this.audit('Edit Homework','edit',`Updated: ${title}`); } }
    else { hw.push({id:uid('hw'),...data,assignedDate:new Date().toISOString()}); DB.set('homework',hw); this.audit('Assign Homework','create',`New homework: ${title} — Due: ${dueDate}`); this.toast('Homework assigned!','success'); }
    this.closeModal('m-homework'); this.renderHomework();
  },

  deleteHomework(id){ DB.set('homework',DB.get('homework',[]).filter(x=>x.id!==id)); const _sid=window.SMS&&window.SMS.schoolId; if(_sid&&window.FDB) FDB.delete(_sid,'homework',id).catch(()=>{}); this.toast('Homework deleted','warn'); this.renderHomework(); },

  // ══ LEAVE FORM ══
  openLeaveModal(){
    const staff=DB.get('staff',[]);
    const sel=document.getElementById('lv-staff');
    if(sel) sel.innerHTML='<option value="">— Select Staff —</option>'+staff.map(s=>`<option value="${s.id}">${sanitize(s.fname)} ${sanitize(s.lname)} (${sanitize(s.role)})</option>`).join('');
    ['lv-id','lv-reason'].forEach(f=>{ const e=document.getElementById(f); if(e) e.value=''; });
    document.getElementById('lv-from').value=''; document.getElementById('lv-to').value='';
    document.getElementById('lv-type').value='Annual'; document.getElementById('lv-err').style.display='none';
    document.getElementById('lv-days-preview').style.display='none';
    const calcDays=()=>{ const from=document.getElementById('lv-from').value, to=document.getElementById('lv-to').value; const prev=document.getElementById('lv-days-preview'); if(from&&to){ const days=Math.ceil((new Date(to)-new Date(from))/86400000)+1; if(days>0){ prev.style.display='block'; prev.textContent=`Duration: ${days} day(s) — from ${fmtDate(from)} to ${fmtDate(to)}`; } else prev.style.display='none'; } };
    document.getElementById('lv-from').onchange=calcDays; document.getElementById('lv-to').onchange=calcDays;
    document.getElementById('save-leave-btn').onclick=()=>this.saveLeave();
    this.openModal('m-leave');
  },

  saveLeave(){
    const staffId=document.getElementById('lv-staff').value; const type=document.getElementById('lv-type').value;
    const from=document.getElementById('lv-from').value; const to=document.getElementById('lv-to').value;
    const reason=document.getElementById('lv-reason').value.trim();
    const errEl=document.getElementById('lv-err');
    if(!staffId||!from||!to||!reason){ errEl.style.display='block'; errEl.textContent='Please fill in all required fields.'; return; }
    if(new Date(to)<new Date(from)){ errEl.style.display='block'; errEl.textContent='End date must be on or after start date.'; return; }
    errEl.style.display='none';
    const days=Math.ceil((new Date(to)-new Date(from))/86400000)+1;
    const leaves=DB.get('leaves',[]);
    leaves.push({id:uid('l'),staffId,type,from,to,days,reason,status:'pending',appliedDate:new Date().toISOString()});
    DB.set('leaves',leaves);
    const s=DB.get('staff',[]).find(x=>x.id===staffId);
    this.audit('Leave Application','create',`${s?.fname} ${s?.lname} applied for ${type} leave (${days} days)`);
    this.toast(`Leave application submitted for ${s?.fname} ${s?.lname}`,'success');
    this.closeModal('m-leave'); this.renderLeave();
  },

  // ══ BOOK FORM ══
  openBookModal(id=null){
    ['bk-id','bk-isbn','bk-title','bk-author','bk-publisher','bk-location'].forEach(f=>{ const e=document.getElementById(f); if(e) e.value=''; });
    document.getElementById('bk-copies').value='1'; document.getElementById('bk-cat').value=''; document.getElementById('bk-err').style.display='none';
    document.getElementById('book-modal-title').textContent=id?'Edit Book':'Add Book';
    if(id){ const b=DB.get('books',[]).find(x=>x.id===id); if(!b) return; document.getElementById('bk-id').value=b.id; document.getElementById('bk-isbn').value=b.isbn||''; document.getElementById('bk-title').value=b.title; document.getElementById('bk-author').value=b.author; document.getElementById('bk-publisher').value=b.publisher||''; document.getElementById('bk-cat').value=b.category; document.getElementById('bk-copies').value=b.copies; document.getElementById('bk-location').value=b.location||''; }
    document.getElementById('save-book-btn').onclick=()=>this.saveBook();
    this.openModal('m-book');
  },

  saveBook(){
    const title=document.getElementById('bk-title').value.trim(); const author=document.getElementById('bk-author').value.trim(); const category=document.getElementById('bk-cat').value; const copies=+document.getElementById('bk-copies').value||1;
    const errEl=document.getElementById('bk-err');
    if(!title||!author||!category){ errEl.style.display='block'; errEl.textContent='Title, author, and category are required.'; return; }
    errEl.style.display='none';
    const books=DB.get('books',[]); const existId=document.getElementById('bk-id').value;
    const data={isbn:document.getElementById('bk-isbn').value,title,author,publisher:document.getElementById('bk-publisher').value,category,copies,location:document.getElementById('bk-location').value};
    if(existId){ const i=books.findIndex(b=>b.id===existId); if(i>-1){ const old=books[i]; const diff=copies-old.copies; books[i]={...old,...data,available:Math.max(0,old.available+diff)}; DB.set('books',books); this.toast('Book updated','success'); this.audit('Edit Book','edit',`Updated: ${title}`); } }
    else { books.push({id:uid('b'),...data,available:copies}); DB.set('books',books); this.audit('Add Book','create',`New book: ${title} by ${author} (${copies} copies)`); this.toast(`"${title}" added to library!`,'success'); }
    this.closeModal('m-book'); this.loadLibrary();
  },

  openBookIssueModal(preselect=null){
    const books=DB.get('books',[]); const students=DB.get('students',[]).filter(s=>s.status==='active'); const staff=DB.get('staff',[]); const issues=DB.get('bookIssues',[]).filter(i=>!i.returnedDate);
    const avail=books.filter(b=>b.available>0);
    const bkSel=document.getElementById('issue-book'); if(bkSel) bkSel.innerHTML='<option value="">— Select Book —</option>'+avail.map(b=>`<option value="${b.id}">${sanitize(b.title)} (${b.available} avail.)</option>`).join('');
    if(preselect&&bkSel) bkSel.value=preselect;
    const stSel=document.getElementById('issue-student'); if(stSel) stSel.innerHTML='<option value="">— Select Student —</option>'+students.map(s=>`<option value="${s.id}">${sanitize(s.fname)} ${sanitize(s.lname)} — ${this.className(s.classId)}</option>`).join('');
    const sfSel=document.getElementById('issue-staff-mem'); if(sfSel) sfSel.innerHTML='<option value="">— Select Staff —</option>'+staff.map(s=>`<option value="${s.id}">${sanitize(s.fname)} ${sanitize(s.lname)}</option>`).join('');
    document.getElementById('issue-date').value=new Date().toISOString().split('T')[0];
    const due=new Date(); due.setDate(due.getDate()+14); document.getElementById('issue-due').value=due.toISOString().split('T')[0];
    document.getElementById('issue-err').style.display='none';
    const retSel=document.getElementById('return-issue-sel');
    if(retSel) retSel.innerHTML='<option value="">— Select Record —</option>'+issues.map(i=>{ const b=DB.get('books',[]).find(x=>x.id===i.bookId); const borrower=i.borrowerType==='student'?students.find(x=>x.id===i.borrowerId):staff.find(x=>x.id===i.borrowerId); return `<option value="${i.id}">${b?.title||'Book'} — ${borrower?borrower.fname+' '+borrower.lname:'Unknown'} (Due: ${fmtDate(i.dueDate)})</option>`; }).join('');
    document.getElementById('return-preview').style.display='none';
    document.getElementById('return-issue-sel').onchange=()=>this.previewReturn();
    document.getElementById('confirm-issue-btn').onclick=()=>this.issueBook();
    document.getElementById('confirm-return-btn').onclick=()=>this.returnBook();
    this.openModal('m-book-issue');
  },

  toggleBorrowerType(){ const t=document.getElementById('issue-borrower-type')?.value; document.getElementById('issue-student-wrap').style.display=t==='student'?'block':'none'; document.getElementById('issue-staff-wrap').style.display=t==='staff'?'block':'none'; },

  issueBook(){
    const bookId=document.getElementById('issue-book').value; const borrowerType=document.getElementById('issue-borrower-type').value;
    const borrowerId=borrowerType==='student'?document.getElementById('issue-student').value:document.getElementById('issue-staff-mem').value;
    const issueDate=document.getElementById('issue-date').value; const dueDate=document.getElementById('issue-due').value;
    const errEl=document.getElementById('issue-err');
    if(!bookId||!borrowerId||!issueDate||!dueDate){ errEl.style.display='block'; errEl.textContent='Please fill in all required fields.'; return; }
    errEl.style.display='none';
    const books=DB.get('books',[]); const bi=books.findIndex(b=>b.id===bookId);
    if(bi>-1&&books[bi].available>0){ books[bi].available--; DB.set('books',books); } else { errEl.style.display='block'; errEl.textContent='Book is not available.'; return; }
    const issues=DB.get('bookIssues',[]); issues.push({id:uid('bi'),bookId,borrowerType,borrowerId,issueDate,dueDate,issuedBy:this.currentUser.id,returnedDate:null}); DB.set('bookIssues',issues);
    const b=books.find(x=>x.id===bookId); this.audit('Issue Book','create',`Issued: "${b?.title}" — due ${fmtDate(dueDate)}`);
    this.toast(`Book issued! Due: ${fmtDate(dueDate)}`,'success'); this.closeModal('m-book-issue'); this.loadLibrary();
  },

  previewReturn(){ const id=document.getElementById('return-issue-sel').value; const prev=document.getElementById('return-preview'); if(!id){ prev.style.display='none'; return; } const issue=DB.get('bookIssues',[]).find(x=>x.id===id); if(!issue){ prev.style.display='none'; return; } const b=DB.get('books',[]).find(x=>x.id===issue.bookId); const borrower=issue.borrowerType==='student'?DB.get('students',[]).find(x=>x.id===issue.borrowerId):DB.get('staff',[]).find(x=>x.id===issue.borrowerId); const overdue=new Date()>new Date(issue.dueDate); prev.style.display='block'; prev.innerHTML=`<div style="font-weight:700;margin-bottom:.35rem">${b?.title||'—'}</div><div>Borrower: <strong>${borrower?borrower.fname+' '+borrower.lname:'Unknown'}</strong></div><div>Issued: ${fmtDate(issue.issueDate)} · Due: <span style="color:${overdue?'var(--danger)':'var(--success)'};font-weight:700">${fmtDate(issue.dueDate)}${overdue?' ⚠ OVERDUE':''}</span></div>`; },

  returnBook(){ const id=document.getElementById('return-issue-sel').value; if(!id){ this.toast('Select a borrowing record','warn'); return; } const issues=DB.get('bookIssues',[]); const idx=issues.findIndex(x=>x.id===id); if(idx>-1){ issues[idx].returnedDate=new Date().toISOString(); DB.set('bookIssues',issues); const books=DB.get('books',[]); const bi=books.findIndex(b=>b.id===issues[idx].bookId); if(bi>-1){ books[bi].available=Math.min(books[bi].copies,books[bi].available+1); DB.set('books',books); } const b=books.find(x=>x.id===issues[idx].bookId); this.audit('Return Book','edit',`Returned: "${b?.title}"`); this.toast('Book returned successfully!','success'); this.closeModal('m-book-issue'); this.loadLibrary(); } },

  // ══ FEE STRUCTURE EDITOR ══
  openFeeStructModal(classId=null){
    const classes=DB.get('classes',[]); const feeStr=DB.get('feeStructure',[]);
    if(!classId){ document.getElementById('receipt-title').textContent='Select Class to Edit Fees'; document.getElementById('receipt-body').innerHTML=`<div style="margin-bottom:.75rem;font-size:.85rem;color:var(--t3)">Choose a class to edit its fee structure:</div><div style="display:flex;gap:.75rem;flex-wrap:wrap">${classes.map(c=>`<button class="btn btn-secondary btn-sm" onclick="SMS.openFeeStructModal('${c.id}');SMS.closeModal('m-receipt')">${sanitize(c.name)}</button>`).join('')}</div>`; this.openModal('m-receipt'); return; }
    const cls=classes.find(c=>c.id===classId); const fs=feeStr.find(f=>f.classId===classId)||{term1:0,term2:0,term3:0};
    document.getElementById('fs-class-id').value=classId; document.getElementById('fs-class-name').value=cls?.name||'';
    document.getElementById('fs-term1').value=fs.term1||''; document.getElementById('fs-term2').value=fs.term2||''; document.getElementById('fs-term3').value=fs.term3||'';
    document.getElementById('fs-includes').value=fs.includes||'Tuition, Books, Activities'; document.getElementById('fs-err').style.display='none';
    const titleEl=document.getElementById('fs-struct-modal-title')||document.querySelector('#m-fee-struct .modal-title'); if(titleEl) titleEl.textContent=`Fee Structure — ${cls?.name}`;
    const updatePreview=()=>{ const t1=+document.getElementById('fs-term1').value||0, t2=+document.getElementById('fs-term2').value||0, t3=+document.getElementById('fs-term3').value||0; document.getElementById('fs-total-preview').textContent=`Annual Total: ${fmt(t1+t2+t3)} (${fmt(t1)} + ${fmt(t2)} + ${fmt(t3)})`; };
    ['fs-term1','fs-term2','fs-term3'].forEach(id=>document.getElementById(id).oninput=updatePreview); updatePreview();
    document.getElementById('save-fee-struct-btn').onclick=()=>this.saveFeeStruct();
    this.openModal('m-fee-struct');
  },

  saveFeeStruct(){
    const classId=document.getElementById('fs-class-id').value; const t1=+document.getElementById('fs-term1').value; const t2=+document.getElementById('fs-term2').value; const t3=+document.getElementById('fs-term3').value;
    const errEl=document.getElementById('fs-err'); if(!classId||(!t1&&!t2&&!t3)){ errEl.style.display='block'; errEl.textContent='Please enter at least one term fee.'; return; } errEl.style.display='none';
    const feeStr=DB.get('feeStructure',[]); const i=feeStr.findIndex(f=>f.classId===classId);
    const data={classId,term1:t1,term2:t2,term3:t3,includes:document.getElementById('fs-includes').value};
    if(i>-1) feeStr[i]={...feeStr[i],...data}; else feeStr.push({id:uid('fs'),...data}); DB.set('feeStructure',feeStr);
    this.audit('Fee Structure','edit',`Updated fees for ${this.className(classId)}: T1=${fmt(t1)}, T2=${fmt(t2)}, T3=${fmt(t3)}`);
    this.toast(`Fee structure saved for ${this.className(classId)}!`,'success');
    this.closeModal('m-fee-struct'); this.renderFeeStructure(); this.renderFeesKpis(); this.renderDefaulters(); this.renderStudents();
  },

  // ══════════════════════════════════════════
  //  TIMETABLE DESIGNER
  // ══════════════════════════════════════════

  // Default structure — used when no custom one is saved
  _defaultTTStructure(){
    return {
      days: ['Monday','Tuesday','Wednesday','Thursday','Friday'],
      periods: [
        {id:'p1', label:'Period 1', from:'07:30', to:'08:30', isBreak:false},
        {id:'p2', label:'Period 2', from:'08:30', to:'09:30', isBreak:false},
        {id:'p3', label:'Period 3', from:'09:30', to:'10:30', isBreak:false},
        {id:'pb', label:'Break',    from:'10:30', to:'11:00', isBreak:true},
        {id:'p4', label:'Period 4', from:'11:00', to:'12:00', isBreak:false},
        {id:'p5', label:'Period 5', from:'12:00', to:'13:00', isBreak:false},
        {id:'p6', label:'Period 6', from:'13:00', to:'14:00', isBreak:false},
      ]
    };
  },

  getTTStructure(){
    return DB.get('ttStructure', null) || this._defaultTTStructure();
  },

  openTimetableDesigner(){
    const classes = DB.get('classes',[]);
    // Populate class selects in tabs 2 & 3
    const opts = '<option value="">— Select Class —</option>' + classes.map(c=>`<option value="${c.id}">${sanitize(c.name)}</option>`).join('');
    document.getElementById('tt-fill-class').innerHTML = opts;
    document.getElementById('tt-preview-class').innerHTML = opts;

    // Reset to tab 1
    this._ttTab('structure', document.querySelector('#m-tt-designer .mtab'));

    this._renderTTDays();
    this._renderTTPeriods();
    this.openModal('m-tt-designer');
  },

  _ttTab(name, btn){
    document.querySelectorAll('#m-tt-designer .modal-tab-pane').forEach(p=>p.classList.remove('active'));
    document.querySelectorAll('#m-tt-designer .mtab').forEach(b=>b.classList.remove('active'));
    document.getElementById('tt-tab-'+name).classList.add('active');
    if(btn) btn.classList.add('active');
    // Save button only relevant on tab 1
    document.getElementById('tt-save-structure-btn').style.display = name==='structure'?'':'none';
    if(name==='slots') this.renderTTFillGrid();
    if(name==='preview') this.renderTTPreview();
  },

  _renderTTDays(){
    const struct = this.getTTStructure();
    const allDays = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
    document.getElementById('tt-days-list').innerHTML = allDays.map(d=>`
      <label style="display:flex;align-items:center;gap:.6rem;padding:.45rem .6rem;border-radius:7px;cursor:pointer;background:var(--surface-2);font-size:.85rem;font-weight:500;color:var(--t1)">
        <input type="checkbox" id="ttd-${d}" value="${d}" ${struct.days.includes(d)?'checked':''} onchange="SMS._syncTTDays()" style="width:16px;height:16px;accent-color:var(--brand)">
        ${d}
      </label>`).join('');
  },

  _syncTTDays(){
    // No-op — days read on save. Just visual feedback.
  },

  _renderTTPeriods(){
    const struct = this.getTTStructure();
    const list = document.getElementById('tt-periods-list');
    list.innerHTML = struct.periods.map((p,i)=>`
      <div id="tt-period-row-${p.id}" style="display:grid;grid-template-columns:auto 1fr 80px 80px auto auto;gap:.4rem;align-items:center;background:${p.isBreak?'rgba(245,158,11,.08)':'var(--surface-2)'};border:1px solid ${p.isBreak?'rgba(245,158,11,.35)':'var(--border)'};border-radius:8px;padding:.5rem .6rem">
        <div style="cursor:grab;color:var(--t4);padding:0 .2rem" title="Drag to reorder"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:15px;height:15px"><line x1="8" y1="6" x2="16" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="8" y1="18" x2="16" y2="18"/></svg></div>
        <input class="form-input" style="height:32px;font-size:.82rem;padding:.2rem .5rem" value="${p.label}" id="ttpl-${p.id}" placeholder="Label (e.g. Period 1)">
        <input type="time" class="form-input" style="height:32px;font-size:.79rem;padding:.2rem .4rem" value="${p.from}" id="ttpf-${p.id}">
        <input type="time" class="form-input" style="height:32px;font-size:.79rem;padding:.2rem .4rem" value="${p.to}" id="ttpt-${p.id}">
        <label style="display:flex;align-items:center;gap:.3rem;font-size:.75rem;font-weight:600;color:var(--warn);white-space:nowrap;cursor:pointer" title="Mark as break (non-editable row)">
          <input type="checkbox" id="ttpb-${p.id}" ${p.isBreak?'checked':''} onchange="SMS._renderTTPeriods()" style="accent-color:var(--warn)"> Break
        </label>
        <button onclick="SMS.ttRemovePeriod('${p.id}')" style="background:none;border:none;cursor:pointer;color:var(--danger);padding:.2rem .3rem;border-radius:4px;display:flex;align-items:center" title="Remove period"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg></button>
      </div>`).join('');

    // Enable drag-to-reorder
    this._initPeriodDrag();
  },

  _initPeriodDrag(){
    const list = document.getElementById('tt-periods-list');
    let dragging = null;
    list.querySelectorAll('[style*="cursor:grab"]').forEach(handle=>{
      const row = handle.closest('[id^="tt-period-row-"]');
      row.setAttribute('draggable','true');
      row.addEventListener('dragstart',()=>{ dragging=row; row.style.opacity='.4'; });
      row.addEventListener('dragend',()=>{ row.style.opacity='1'; dragging=null; });
      row.addEventListener('dragover',e=>{ e.preventDefault(); if(dragging&&dragging!==row){ const after=row.getBoundingClientRect().top+row.offsetHeight/2>e.clientY; list.insertBefore(dragging,after?row:row.nextSibling); } });
    });
  },

  ttAddPeriod(){
    const struct = this.getTTStructure();
    const newId = 'p'+Date.now();
    // Suggest next time from last period
    const last = struct.periods[struct.periods.length-1];
    const nextFrom = last?.to || '07:30';
    const [h,m] = nextFrom.split(':').map(Number);
    const nextTo = `${String(h+(m===30?1:0)).padStart(2,'0')}:${m===30?'00':'30'}`;
    struct.periods.push({id:newId, label:`Period ${struct.periods.filter(p=>!p.isBreak).length+1}`, from:nextFrom, to:nextTo, isBreak:false});
    DB.set('ttStructure',struct);
    this._renderTTPeriods();
    // Scroll to bottom
    setTimeout(()=>{ const el=document.getElementById('tt-periods-list'); el.scrollTop=el.scrollHeight; },50);
  },

  ttRemovePeriod(id){
    const struct = this.getTTStructure();
    struct.periods = struct.periods.filter(p=>p.id!==id);
    DB.set('ttStructure',struct);
    this._renderTTPeriods();
  },

  saveTTStructure(){
    // Read days
    const allDays = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
    const days = allDays.filter(d=>document.getElementById('ttd-'+d)?.checked);
    if(days.length===0){ this.toast('Select at least one day','warn'); return; }

    // Read periods from DOM (in current drag order)
    const rows = document.querySelectorAll('#tt-periods-list > div[id^="tt-period-row-"]');
    const periods = [];
    rows.forEach(row=>{
      const id = row.id.replace('tt-period-row-','');
      const label = document.getElementById('ttpl-'+id)?.value.trim() || 'Period';
      const from  = document.getElementById('ttpf-'+id)?.value || '00:00';
      const to    = document.getElementById('ttpt-'+id)?.value || '00:00';
      const isBreak = document.getElementById('ttpb-'+id)?.checked || false;
      periods.push({id, label, from, to, isBreak});
    });
    if(periods.length===0){ this.toast('Add at least one period','warn'); return; }

    DB.set('ttStructure',{days,periods});
    this.toast('Timetable structure saved!','success');
    this.renderTimetable(); // Refresh main view
    this._ttTab('slots', document.querySelectorAll('#m-tt-designer .mtab')[1]);
  },

  // ── Fill Subjects Grid (Tab 2) ──
  renderTTFillGrid(){
    const classId = document.getElementById('tt-fill-class').value;
    const grid = document.getElementById('tt-fill-grid');
    if(!classId){ grid.innerHTML='<div style="padding:1.5rem;text-align:center;color:var(--t4);font-size:.85rem">Select a class to fill in subjects</div>'; return; }

    const struct = this.getTTStructure();
    const timetable = DB.get('timetable',{});
    const classData = timetable[classId]||{};
    const subjects = DB.get('subjects',[]).filter(s=>!s.classId||s.classId===classId);
    const staff = DB.get('staff',[]);

    const subjOpts = subjects.map(s=>`<option value="${sanitize(s.name)}">`).join('');
    const staffOpts = staff.map(s=>`<option value="${s.fname+' '+s.lname}">`).join('');
    const datalists = `<datalist id="ttf-subj-dl">${subjOpts}</datalist><datalist id="ttf-staff-dl">${staffOpts}</datalist>`;

    let html = datalists + `<table style="width:100%;border-collapse:collapse;font-size:.8rem">
      <thead><tr style="background:var(--surface-2)">
        <th style="padding:.5rem .7rem;font-weight:700;color:var(--t2);text-align:left;white-space:nowrap;border:1px solid var(--border);min-width:120px">Period</th>
        ${struct.days.map(d=>`<th style="padding:.5rem .7rem;font-weight:700;color:var(--t2);text-align:center;border:1px solid var(--border);min-width:140px">${d}</th>`).join('')}
      </tr></thead><tbody>`;

    struct.periods.forEach(p=>{
      const label = p.label + (p.from&&p.to ? `<div style="font-size:.7rem;font-weight:400;color:var(--t3)">${p.from}–${p.to}</div>` : '');
      if(p.isBreak){
        html += `<tr><td style="padding:.4rem .7rem;background:var(--surface-2);font-weight:600;font-size:.75rem;color:var(--warn);text-align:center;border:1px solid var(--border)">${p.label}</td>
          ${struct.days.map(()=>`<td style="background:var(--surface-2);border:1px solid var(--border);text-align:center;color:var(--t4);font-size:.72rem;letter-spacing:.05em">BREAK</td>`).join('')}</tr>`;
        return;
      }
      html += `<tr><td style="padding:.4rem .7rem;border:1px solid var(--border);background:var(--surface-2)">${label}</td>`;
      struct.days.forEach(day=>{
        const slot = classData[day]?.[p.id]||{};
        html += `<td style="padding:.3rem;border:1px solid var(--border);vertical-align:top">
          <input list="ttf-subj-dl" class="form-input" style="height:28px;font-size:.75rem;padding:.15rem .4rem;margin-bottom:.25rem" placeholder="Subject…" value="${slot.subject||''}" id="ttf-subj-${classId}-${day.slice(0,3)}-${p.id}" oninput="SMS._ttAutoSaveSlot('${classId}','${day}','${p.id}')">
          <input list="ttf-staff-dl" class="form-input" style="height:26px;font-size:.72rem;padding:.12rem .4rem;color:var(--t3)" placeholder="Teacher…" value="${slot.teacher||''}" id="ttf-tchr-${classId}-${day.slice(0,3)}-${p.id}" oninput="SMS._ttAutoSaveSlot('${classId}','${day}','${p.id}')">
        </td>`;
      });
      html += `</tr>`;
    });
    html += `</tbody></table>`;
    grid.innerHTML = html;
  },

  _ttAutoSaveSlot(classId, day, periodId){
    const subjEl = document.getElementById(`ttf-subj-${classId}-${day.slice(0,3)}-${periodId}`);
    const tchrEl = document.getElementById(`ttf-tchr-${classId}-${day.slice(0,3)}-${periodId}`);
    if(!subjEl) return;
    const subj = subjEl.value.trim();
    const tchr = tchrEl?.value.trim()||'';
    const timetable = DB.get('timetable',{});
    if(!timetable[classId]) timetable[classId]={};
    if(!timetable[classId][day]) timetable[classId][day]={};
    if(subj) timetable[classId][day][periodId]={subject:subj,teacher:tchr};
    else delete timetable[classId][day][periodId];
    DB.set('timetable',timetable);
  },

  ttClearSlots(){
    const classId = document.getElementById('tt-fill-class').value;
    if(!classId){ this.toast('Select a class first','warn'); return; }
    this.confirmDelete(`Clear all timetable slots for ${this.className(classId)}?`,()=>{
      const timetable = DB.get('timetable',{});
      delete timetable[classId];
      DB.set('timetable',timetable);
      this.renderTTFillGrid();
      this.renderTimetable();
      this.toast('Slots cleared','warn');
    });
  },

  // ── Preview (Tab 3) ──
  renderTTPreview(){
    const classId = document.getElementById('tt-preview-class').value;
    const grid = document.getElementById('tt-preview-grid');
    if(!classId){ grid.innerHTML='<div style="padding:1.5rem;text-align:center;color:var(--t4);font-size:.85rem">Select a class to preview</div>'; return; }
    grid.innerHTML = this._buildTTTable(classId, false);
  },

  // ── Main timetable grid renderer ──
  _buildTTTable(classId, editable=true){
    const struct = this.getTTStructure();
    const timetable = DB.get('timetable',{});
    const classData = timetable[classId]||{};

    if(!classId) return '<div style="padding:2rem;text-align:center;color:var(--t4)">Select a class to view timetable</div>';

    const cls = DB.get('classes',[]).find(c=>c.id===classId);
    const teachingPeriods = struct.periods.filter(p=>!p.isBreak).length;

    let html = `<div style="margin-bottom:1rem;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:.5rem">
      <div>
        <div style="font-size:.95rem;font-weight:700;color:var(--t1)">${cls?.name||''} &mdash; Weekly Schedule</div>
        <div style="font-size:.75rem;color:var(--t3);margin-top:.2rem">${struct.days.length} day${struct.days.length!==1?'s':''} &middot; ${teachingPeriods} teaching period${teachingPeriods!==1?'s':''}</div>
      </div>
      ${editable?`<div style="font-size:.75rem;color:var(--t3);display:flex;align-items:center;gap:.3rem"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:12px;height:12px"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>Click any cell to assign a subject</div>`:''}
    </div>
    <div style="overflow-x:auto">
    <table class="tt-table">
      <thead><tr>
        <th style="text-align:left">Period</th>
        ${struct.days.map(d=>`<th>${d}</th>`).join('')}
      </tr></thead><tbody>`;

    struct.periods.forEach(p=>{
      const timeLabel = p.from&&p.to ? `<div style="font-size:.68rem;font-weight:400;color:var(--t3);margin-top:.15rem">${p.from}&ndash;${p.to}</div>` : '';
      if(p.isBreak){
        html += `<tr>
          <td class="tt-time-col" style="background:rgba(245,158,11,.06);color:var(--warn)">${p.label}${timeLabel}</td>
          ${struct.days.map(()=>`<td style="background:rgba(245,158,11,.05);text-align:center"><span style="font-size:.7rem;font-weight:700;color:var(--warn);letter-spacing:.09em;text-transform:uppercase">Break</span></td>`).join('')}
        </tr>`;
        return;
      }
      html += `<tr><td class="tt-time-col">${p.label}${timeLabel}</td>`;
      struct.days.forEach(day=>{
        const slot = classData[day]?.[p.id];
        const penc = encodeURIComponent(p.id);
        if(editable){
          if(slot?.subject){
            html += `<td style="padding:.35rem" onclick="SMS.openTimetableSlot('${classId}','${day}','${penc}')" style="cursor:pointer">
              <div class="tt-slot-card">
                <div class="subj">${slot.subject}</div>
                ${slot.teacher?`<div class="tchr">${slot.teacher}</div>`:''}
              </div></td>`;
          } else {
            html += `<td style="padding:.3rem;text-align:center"><button class="tt-empty-slot" onclick="SMS.openTimetableSlot('${classId}','${day}','${penc}')" title="Assign subject">+</button></td>`;
          }
        } else {
          if(slot?.subject){
            html += `<td style="padding:.45rem .6rem">
              <div style="font-weight:700;font-size:.8rem;color:var(--t1)">${slot.subject}</div>
              ${slot.teacher?`<div style="font-size:.68rem;color:var(--t3);margin-top:.1rem">${slot.teacher}</div>`:''}
            </td>`;
          } else {
            html += `<td></td>`;
          }
        }
      });
      html += `</tr>`;
    });

    html += `</tbody></table></div>`;
    return html;
  },

};

// ── BOOT ──
document.addEventListener('DOMContentLoaded',()=>SMS.init());
window.SMS=SMS;

// ── PWA INSTALL BANNER ──
const PWABanner = (() => {
  const DISMISSED_KEY = 'sms_pwa_banner_dismissed';
  let _prompt = null;
  let _ready  = false;
  let _login  = false;

  function isStandalone() {
    return window.matchMedia('(display-mode: standalone)').matches
        || window.navigator.standalone === true;
  }

  function isDismissed() {
    // If currently running as installed PWA, don't show the banner
    if (isStandalone()) return true;
    return localStorage.getItem(DISMISSED_KEY) === 'session';
  }

  function show() {
    if (isDismissed()) return;
    const el = document.getElementById('pwa-banner');
    if (!el) return;
    el.style.transition = 'none';
    el.style.transform  = 'translateY(100%)';
    el.style.display    = 'flex';
    requestAnimationFrame(() => requestAnimationFrame(() => {
      el.style.transition = 'transform .38s cubic-bezier(.34,1.4,.64,1)';
      el.style.transform  = 'translateY(0)';
    }));
  }

  function hide(permanent) {
    const el = document.getElementById('pwa-banner');
    if (el) {
      el.style.transition = 'transform .28s ease-in';
      el.style.transform  = 'translateY(100%)';
      setTimeout(() => { el.style.display = 'none'; }, 290);
    }
    // 'session' = hide for this tab only; clears on next page load
    // We never permanently block — uninstalling should restore the banner
    if (permanent) localStorage.setItem(DISMISSED_KEY, 'session');
  }

  function tryShow() {
    _login = true;
    if (_ready) show();
  }

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    // Clear any leftover session dismiss so the banner can show again
    localStorage.removeItem(DISMISSED_KEY);
    _prompt = e;
    _ready  = true;
    if (_login) show();
  });

  document.addEventListener('click', (e) => {
    if (e.target.closest('#pwa-install-btn')) {
      if (!_prompt) return;
      _prompt.prompt();
      _prompt.userChoice.then(({ outcome }) => {
        hide(outcome === 'accepted');
        _prompt = null;
      });
    }
    if (e.target.closest('#pwa-close-btn')) {
      hide(true); // session-dismiss on X
    }
  });

  // Once installed, the browser stops firing beforeinstallprompt
  // so no need to do anything special here
  window.addEventListener('appinstalled', () => {
    const el = document.getElementById('pwa-banner');
    if (el) el.style.display = 'none';
  });

  return { tryShow };
})();

// ══════════════════════════════════════════════════════
//  OFFLINE LAUNCH SCREEN CONTROLLER
//  • Shows ONLY if the page loads with no internet
//  • Does NOT show if internet drops during an active session
//  • Auto-reloads when connection is restored
// ══════════════════════════════════════════════════════
const offlineScreen = (() => {
  const SCREEN   = 'offline-screen';
  const RETRY_BTN  = 'offs-retry-btn';
  const RETRY_ICON = 'offs-retry-icon';
  const RETRY_SPIN = 'offs-spin';
  const RETRY_LBL  = 'offs-retry-label';
  const CARD       = 'offs-card';

  // Was the app launched offline? Latched at boot.
  let _launchOffline = false;
  let _retryTimer    = null;

  function _getEl(id) { return document.getElementById(id); }

  function show() {
    const el = _getEl(SCREEN);
    if (!el) return;
    el.style.display = 'flex';
    _resetBtn();
  }

  function hide() {
    const el = _getEl(SCREEN);
    if (el) el.style.display = 'none';
    clearTimeout(_retryTimer);
    _launchOffline = false; // screen cleared — no longer in launch-offline state
  }

  function _resetBtn() {
    const btn  = _getEl(RETRY_BTN);
    const icon = _getEl(RETRY_ICON);
    const spin = _getEl(RETRY_SPIN);
    const lbl  = _getEl(RETRY_LBL);
    if (btn)  { btn.disabled = false; }
    if (icon) { icon.style.display = ''; }
    if (spin) { spin.style.display = 'none'; }
    if (lbl)  { lbl.textContent = 'Try Again'; }
  }

  function _shakeFail() {
    const card = _getEl(CARD);
    if (!card) return;
    card.classList.remove('offs-shaking');
    // Force reflow then re-add
    void card.offsetWidth;
    card.classList.add('offs-shaking');
    card.addEventListener('animationend', () => card.classList.remove('offs-shaking'), { once: true });
  }

  // ── Called by onclick on the Try Again button ──
  function retry() {
    const btn  = _getEl(RETRY_BTN);
    const icon = _getEl(RETRY_ICON);
    const spin = _getEl(RETRY_SPIN);
    const lbl  = _getEl(RETRY_LBL);
    if (btn)  { btn.disabled = true; }
    if (icon) { icon.style.display = 'none'; }
    if (spin) { spin.style.display = 'block'; }
    if (lbl)  { lbl.textContent = 'Checking…'; }

    clearTimeout(_retryTimer);
    _retryTimer = setTimeout(() => {
      if (navigator.onLine) {
        window.location.reload();
      } else {
        _resetBtn();
        _shakeFail();
      }
    }, 2200);
  }

  // ── Called by onclick on the Exit App button ──
  function quit() {
    window.close();
    // Fallback: blank goodbye page if close() was blocked
    setTimeout(() => {
      document.body.innerHTML = `
        <div style="
          min-height:100dvh;display:flex;flex-direction:column;
          align-items:center;justify-content:center;
          background:#07111f;color:rgba(140,175,210,.6);
          font-family:'DM Sans',sans-serif;
          text-align:center;padding:2rem;gap:1.2rem
        ">
          <svg width="44" height="44" viewBox="0 0 64 64" fill="none">
            <circle cx="32" cy="32" r="28" stroke="rgba(13,148,136,.35)" stroke-width="2"/>
            <path d="M22 32h20M36 26l6 6-6 6" stroke="#0d9488" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <p style="font-size:1rem;font-weight:700;color:rgba(220,235,248,.7);margin:0">You've closed Eduformium SMS</p>
          <p style="font-size:.8rem;margin:0">Come back when you have an internet connection.</p>
        </div>`;
    }, 400);
  }

  // ════════════════════════════════════════
  //  BOOT — only show on LAUNCH without internet
  // ════════════════════════════════════════
  function _boot() {
    if (!navigator.onLine) {
      _launchOffline = true;
      show();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _boot);
  } else {
    setTimeout(_boot, 100); // let DOM settle
  }

  // Auto-hide & reload once connection restores — ONLY if we launched offline
  window.addEventListener('online', () => {
    if (!_launchOffline) return; // user was already logged in — do nothing
    setTimeout(() => {
      if (navigator.onLine) {
        window.location.reload();
      }
    }, 900);
  });

  // NOTE: 'offline' event is intentionally NOT wired to show()
  // Active sessions handle connectivity gracefully without a blocking screen.

  return { show, hide, retry, quit };
})();

// ── Global helpers called from HTML onclick attributes ──
function offlineScreenRetry() { offlineScreen.retry(); }
function offlineScreenExit()  { offlineScreen.quit();  }