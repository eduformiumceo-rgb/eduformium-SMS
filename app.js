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
let _currency='GHS';
const SYMS={GHS:'₵',NGN:'₦',KES:'KSh ',USD:'$',GBP:'£',ZAR:'R ',EUR:'€'};
const fmt=(n)=>(SYMS[_currency]||'₵')+(+n||0).toLocaleString('en',{minimumFractionDigits:2,maximumFractionDigits:2});
const fmtDate=(s)=>{ if(!s) return '—'; const d=new Date(s); return d.toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}); };
const gradeFromScore=(s,max=100)=>{const p=s/max*100; if(p>=80)return'A';if(p>=70)return'B';if(p>=60)return'C';if(p>=50)return'D';return'F';};
const statusBadge=(s)=>{const map={active:'badge-success',inactive:'badge-neutral',graduated:'badge-brand',suspended:'badge-danger',pending:'badge-warn',approved:'badge-success',rejected:'badge-danger',completed:'badge-brand',upcoming:'badge-info',available:'badge-success',borrowed:'badge-warn'};return`<span class="badge ${map[s]||'badge-neutral'}">${s}</span>`;};

// ── SEED DEMO DATA ──
function seedData(){
  if(DB.get('seeded')) return;
  DB.set('school',{name:'Bright Future Academy',motto:'Excellence in All Things',phone:'+233 24 123 4567',email:'info@bfa.edu.gh',website:'www.bfa.edu.gh',country:'GH',address:'45 Education Ave, Accra, Ghana',currency:'GHS',academicYear:'2025/2026',currentTerm:'2',gradeSystem:'percentage',passMark:50,type:'k12'});
  DB.set('users',[{id:'admin',email:'admin@school.edu',password:'admin123',name:'Dr. Emmanuel Owusu',role:'admin',phone:'+233 24 000 1111',createdAt:new Date().toISOString(),lastLogin:null}]);
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
    {id:'stf1',fname:'Abena',lname:'Asante',role:'teacher',dept:'Primary',subjects:'English, Reading',phone:'+233 24 111 2222',email:'abena@bfa.edu.gh',gender:'Female',salary:2800,status:'active',joinDate:'2020-01-15',qualification:'B.Ed'},
    {id:'stf2',fname:'Kwame',lname:'Boateng',role:'teacher',dept:'Primary',subjects:'Mathematics',phone:'+233 24 222 3333',email:'kwame@bfa.edu.gh',gender:'Male',salary:2800,status:'active',joinDate:'2019-09-01',qualification:'B.Ed'},
    {id:'stf3',fname:'Ama',lname:'Nyarko',role:'teacher',dept:'Primary',subjects:'Science, RME',phone:'+233 24 333 4444',email:'ama@bfa.edu.gh',gender:'Female',salary:2900,status:'active',joinDate:'2021-01-10',qualification:'B.Sc.Ed'},
    {id:'stf4',fname:'Kofi',lname:'Mensah',role:'teacher',dept:'Primary',subjects:'Social Studies',phone:'+233 24 444 5555',email:'kofi@bfa.edu.gh',gender:'Male',salary:2700,status:'active',joinDate:'2022-01-05',qualification:'Cert. A'},
    {id:'stf5',fname:'Akosua',lname:'Darko',role:'teacher',dept:'Primary',subjects:'ICT, Creative Arts',phone:'+233 24 555 6666',email:'akosua@bfa.edu.gh',gender:'Female',salary:3000,status:'active',joinDate:'2020-09-01',qualification:'B.Sc CS'},
    {id:'stf6',fname:'Yaw',lname:'Amoah',role:'teacher',dept:'Primary',subjects:'Mathematics, Science',phone:'+233 24 666 7777',email:'yaw@bfa.edu.gh',gender:'Male',salary:2900,status:'active',joinDate:'2021-09-01',qualification:'B.Ed'},
    {id:'stf7',fname:'Efua',lname:'Owusu',role:'teacher',dept:'JHS',subjects:'English Language',phone:'+233 24 777 8888',email:'efua@bfa.edu.gh',gender:'Female',salary:3200,status:'active',joinDate:'2018-01-15',qualification:'M.Ed'},
    {id:'stf8',fname:'Nana',lname:'Acheampong',role:'teacher',dept:'JHS',subjects:'Mathematics, Physics',phone:'+233 24 888 9999',email:'nana@bfa.edu.gh',gender:'Male',salary:3400,status:'active',joinDate:'2017-09-01',qualification:'M.Sc'},
    {id:'stf9',fname:'Adjoa',lname:'Frimpong',role:'teacher',dept:'JHS',subjects:'Social Studies, History',phone:'+233 24 999 0000',email:'adjoa@bfa.edu.gh',gender:'Female',salary:3100,status:'active',joinDate:'2019-01-10',qualification:'B.A'},
    {id:'stf10',fname:'Osei',lname:'Bonsu',role:'admin',dept:'Administration',subjects:'',phone:'+233 24 010 1010',email:'osei@bfa.edu.gh',gender:'Male',salary:3500,status:'active',joinDate:'2016-01-01',qualification:'MBA'},
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
    feesPaid:{term1:i%3===0?0:850,term2:i%4===0?0:i%5===0?400:850,term3:0},
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
    {id:'fs1',classId:'cls1',term1:650,term2:650,term3:650},{id:'fs2',classId:'cls2',term1:650,term2:650,term3:650},
    {id:'fs3',classId:'cls3',term1:700,term2:700,term3:700},{id:'fs4',classId:'cls4',term1:700,term2:700,term3:700},
    {id:'fs5',classId:'cls5',term1:750,term2:750,term3:750},{id:'fs6',classId:'cls6',term1:750,term2:750,term3:750},
    {id:'fs7',classId:'cls7',term1:900,term2:900,term3:900},{id:'fs8',classId:'cls8',term1:900,term2:900,term3:900},
    {id:'fs9',classId:'cls9',term1:950,term2:950,term3:950},
  ]);
  DB.set('feePayments',[
    {id:uid('fp'),studentId:'stu1',term:'1',amount:850,method:'cash',date:'2025-01-10',by:'Admin',receiptNo:'REC-001'},
    {id:uid('fp'),studentId:'stu2',term:'1',amount:850,method:'mobile',date:'2025-01-12',by:'Admin',receiptNo:'REC-002'},
    {id:uid('fp'),studentId:'stu3',term:'1',amount:850,method:'bank',date:'2025-01-15',by:'Admin',receiptNo:'REC-003'},
    {id:uid('fp'),studentId:'stu5',term:'1',amount:900,method:'cash',date:'2025-01-11',by:'Admin',receiptNo:'REC-004'},
    {id:uid('fp'),studentId:'stu2',term:'2',amount:850,method:'mobile',date:'2025-02-05',by:'Admin',receiptNo:'REC-005'},
    {id:uid('fp'),studentId:'stu7',term:'1',amount:750,method:'cash',date:'2025-01-20',by:'Admin',receiptNo:'REC-006'},
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
  DB.set('auditLog',[{id:uid('al'),action:'System Initialized',type:'create',user:'System',details:'Eduformium SMS database seeded with demo data',time:new Date().toISOString()}]);
  DB.set('payroll',[]);
  DB.set('timetable',{cls7:{
    Monday:{'7:30-8:30':{subject:'English',teacher:'E. Owusu'},'8:30-9:30':{subject:'Mathematics',teacher:'N. Acheampong'},'9:30-10:30':{subject:'Social Studies',teacher:'A. Frimpong'},'10:30-11:00':{subject:'BREAK',teacher:''},'11:00-12:00':{subject:'Science',teacher:'A. Nyarko'},'12:00-1:00':{subject:'ICT',teacher:'A. Darko'}},
    Tuesday:{'7:30-8:30':{subject:'Mathematics',teacher:'N. Acheampong'},'8:30-9:30':{subject:'English',teacher:'E. Owusu'},'9:30-10:30':{subject:'RME',teacher:'A. Nyarko'},'10:30-11:00':{subject:'BREAK',teacher:''},'11:00-12:00':{subject:'Social Studies',teacher:'A. Frimpong'},'12:00-1:00':{subject:'PE',teacher:'Y. Amoah'}},
    Wednesday:{'7:30-8:30':{subject:'Science',teacher:'A. Nyarko'},'8:30-9:30':{subject:'Mathematics',teacher:'N. Acheampong'},'9:30-10:30':{subject:'English',teacher:'E. Owusu'},'10:30-11:00':{subject:'BREAK',teacher:''},'11:00-12:00':{subject:'History',teacher:'A. Frimpong'},'12:00-1:00':{subject:'Creative Arts',teacher:'A. Darko'}},
    Thursday:{'7:30-8:30':{subject:'Mathematics',teacher:'N. Acheampong'},'8:30-9:30':{subject:'Social Studies',teacher:'A. Frimpong'},'9:30-10:30':{subject:'Science',teacher:'A. Nyarko'},'10:30-11:00':{subject:'BREAK',teacher:''},'11:00-12:00':{subject:'English',teacher:'E. Owusu'},'12:00-1:00':{subject:'ICT',teacher:'A. Darko'}},
    Friday:{'7:30-8:30':{subject:'RME',teacher:'A. Nyarko'},'8:30-9:30':{subject:'English',teacher:'E. Owusu'},'9:30-10:30':{subject:'Mathematics',teacher:'N. Acheampong'},'10:30-11:00':{subject:'BREAK',teacher:''},'11:00-12:00':{subject:'PE',teacher:'Y. Amoah'},'12:00-1:00':{subject:'Assembly',teacher:'All'}},
  }});
  DB.set('seeded',true);
}

// ══════════════════════════════════════════
//  MAIN APP
// ══════════════════════════════════════════
const SMS = {
  currentUser: null,
  schoolId: null,
  currentPage: 'dashboard',
  deleteCallback: null,

  _kpiSvg(type){
    const S='width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"';
    const icons={
      students:`<svg ${S}><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3.53 1.76 9.47 1.76 12 0v-5"/></svg>`,
      staff:`<svg ${S}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
      classes:`<svg ${S}><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>`,
      fees:`<svg ${S}><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>`,
      check:`<svg ${S}><polyline points="20 6 9 17 4 12"/></svg>`,
      library:`<svg ${S}><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>`,
      transactions:`<svg ${S}><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>`,
      warning:`<svg ${S}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
      outstanding:`<svg ${S}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
      trending:`<svg ${S}><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>`,
      chart:`<svg ${S}><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>`,
      pending:`<svg ${S}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
      expenses:`<svg ${S}><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>`,
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

  init() {
    if(!window.FAuth){ // fallback if Firebase didn't load
      seedData();
      const school=DB.get('school',{});
      _currency=school.currency||'GHS';
      const session=DB.get('session');
      if(session){ const user=DB.get('users',[]).find(u=>u.id===session.userId); if(user){ this.currentUser=user; this.boot(); return; } }
      this.showLogin(); return;
    }
    FAuth.onAuthChange(async (firebaseUser)=>{
      if(firebaseUser){
        this.schoolId=firebaseUser.uid;
        try{ await DB.loadFromFirestore(this.schoolId); }catch(e){ console.warn('Load error:',e); }
        try{ await Migration.run(this.schoolId); }catch(e){}
        const school=DB.get('school',{});
        _currency=school.currency||'GHS';
        const users=DB.get('users',[]);
        this.currentUser=users.find(u=>u.id===this.schoolId)||{id:this.schoolId,name:school.adminName||firebaseUser.email,email:firebaseUser.email,role:'admin'};
        this.boot();
      } else {
        this.schoolId=null; this.currentUser=null;
        seedData();
        this.showLogin();
      }
    });
  },

  showLogin(){
    document.getElementById('loading-overlay').style.display='none';
    document.getElementById('login-screen').style.display='flex';
    this.bindForms(); // bind login/register buttons
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
    this.currentPage=page;
    document.getElementById('sidebar').classList.remove('open');
    const ov=document.getElementById('sidebar-overlay'); if(ov) ov.classList.remove('show');
    const loaders={dashboard:()=>this.loadDashboard(),students:()=>this.loadStudents(),classes:()=>this.loadClasses(),attendance:()=>this.loadAttendance(),exams:()=>this.loadExams(),timetable:()=>this.loadTimetable(),homework:()=>this.loadHomework(),staff:()=>this.loadStaff(),payroll:()=>this.loadPayroll(),leave:()=>this.loadLeave(),fees:()=>this.loadFees(),expenses:()=>this.loadExpenses(),messages:()=>this.loadMessages(),library:()=>this.loadLibrary(),events:()=>this.loadEvents(),reports:()=>{},audit:()=>this.renderAudit(),settings:()=>this.loadSettings()};
    if(loaders[page]) loaders[page]();
  },

  bindNav(){
    document.querySelectorAll('.nav-item[data-page]').forEach(item=>item.addEventListener('click',()=>{
      this.nav(item.dataset.page);
      if(window.innerWidth < 769){
        document.getElementById('sidebar')?.classList.remove('open');
        document.getElementById('sidebar-overlay')?.classList.remove('show');
      }
    }));
    document.getElementById('menu-btn').addEventListener('click',()=>{
      const sb=document.getElementById('sidebar'); sb.classList.toggle('open');
      let ov=document.getElementById('sidebar-overlay');
      if(!ov){ ov=document.createElement('div'); ov.id='sidebar-overlay'; ov.className='sidebar-overlay'; ov.addEventListener('click',()=>{ sb.classList.remove('open'); ov.classList.remove('show'); }); document.body.appendChild(ov); }
      ov.classList.toggle('show');
    });
    document.getElementById('sb-close')?.addEventListener('click',()=>{ document.getElementById('sidebar').classList.remove('open'); document.getElementById('sidebar-overlay')?.classList.remove('show'); });
    document.getElementById('user-chip')?.addEventListener('click',()=>this.nav('settings'));
    document.getElementById('sb-user-card')?.addEventListener('click',()=>this.nav('settings'));
    document.getElementById('logout-btn')?.addEventListener('click',()=>this.logout());
    document.getElementById('sb-logout')?.addEventListener('click',()=>this.logout());
    document.getElementById('theme-btn')?.addEventListener('click',()=>this.toggleTheme());
    document.getElementById('search-btn')?.addEventListener('click',()=>{ const so=document.getElementById('search-overlay'); so.style.display='flex'; document.getElementById('global-search-input').focus(); });
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
    document.getElementById('app').style.display='none';
    document.getElementById('login-screen').style.display='flex';
    const lu=document.getElementById('l-user'); if(lu) lu.value='';
    const lp=document.getElementById('l-pass'); if(lp) lp.value='';
  },

  // ── AUTH ──
  bindForms(){
    document.getElementById('login-btn')?.addEventListener('click',()=>this.login());
    document.getElementById('l-pass')?.addEventListener('keydown',e=>{ if(e.key==='Enter') this.login(); });
    document.getElementById('l-pass-toggle')?.addEventListener('click',function(){ const i=document.getElementById('l-pass'); const on=this.querySelector('.eye-on'),off=this.querySelector('.eye-off'); if(i.type==='password'){ i.type='text'; on.style.display='none'; off.style.display=''; }else{ i.type='password'; on.style.display=''; off.style.display='none'; } });
    document.getElementById('go-register')?.addEventListener('click',()=>{ document.getElementById('auth-signin').style.display='none'; document.getElementById('auth-register').style.display='block'; });
    document.getElementById('go-signin')?.addEventListener('click',()=>{ document.getElementById('auth-register').style.display='none'; document.getElementById('auth-signin').style.display='block'; });
    document.getElementById('register-btn')?.addEventListener('click',()=>this.register());
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
    ['fee-class-f','fee-term-f'].forEach(id=>document.getElementById(id)?.addEventListener('change',()=>this.renderFees()));
    document.getElementById('exp-fees-btn')?.addEventListener('click',()=>this.exportFees());
    document.getElementById('send-reminder-btn')?.addEventListener('click',()=>this.toast('Fee reminders sent via SMS!','success'));
    document.getElementById('add-fee-struct-btn')?.addEventListener('click',()=>this.toast('Fee structure editor — coming soon','warn'));
    document.getElementById('add-expense-btn')?.addEventListener('click',()=>this.toast('Expense form — update coming soon','warn'));
    document.getElementById('add-event-btn')?.addEventListener('click',()=>this.openEventModal());
    document.getElementById('save-event-btn')?.addEventListener('click',()=>this.saveEvent());
    document.getElementById('compose-btn')?.addEventListener('click',()=>this.openComposeModal());
    document.getElementById('send-msg-btn')?.addEventListener('click',()=>this.sendMessage());
    document.getElementById('msg-to')?.addEventListener('change',e=>{ document.getElementById('msg-class-field').style.display=e.target.value==='specific-class'?'block':'none'; });
    document.getElementById('add-book-btn')?.addEventListener('click',()=>this.toast('Book management — coming soon','warn'));
    document.getElementById('borrow-btn')?.addEventListener('click',()=>this.toast('Book issuing — coming soon','warn'));
    document.getElementById('lib-search')?.addEventListener('input',()=>this.renderLibrary());
    ['lib-cat-f','lib-status-f'].forEach(id=>document.getElementById(id)?.addEventListener('change',()=>this.renderLibrary()));
    document.getElementById('add-hw-btn')?.addEventListener('click',()=>this.toast('Homework form — coming soon','warn'));
    document.getElementById('add-leave-btn')?.addEventListener('click',()=>this.toast('Leave form — coming soon','warn'));
    document.getElementById('process-payroll-btn')?.addEventListener('click',()=>this.processPayroll());
    document.getElementById('exp-audit-btn')?.addEventListener('click',()=>this.exportAudit());
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
    document.getElementById('save-sms-btn')?.addEventListener('click',()=>this.toast('SMS settings saved','success'));
    document.getElementById('test-sms-btn')?.addEventListener('click',()=>this.toast('Test SMS sent (mock)','success'));
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
    btn.disabled=true; btn.textContent='Signing in…'; errEl.style.display='none';

    // Always check localStorage first (covers demo account + offline use)
    const users=DB.get('users',[]);
    const localUser=users.find(u=>u.email===email&&u.password===pass);
    if(localUser){
      localUser.lastLogin=new Date().toISOString(); DB.set('users',users);
      DB.set('session',{userId:localUser.id});
      this.currentUser=localUser; this.audit('Login','login',`${localUser.name} signed in`);
      this.boot(); errEl.style.display='none'; return;
    }

    // Try Firebase if available
    if(!window.FAuth){ errEl.style.display='flex'; errEl.textContent='Incorrect email or password.'; btn.disabled=false; btn.textContent='Sign In →'; return; }
    const result=await FAuth.login(email,pass);
    if(!result.success){ errEl.style.display='flex'; errEl.textContent=result.error; btn.disabled=false; btn.textContent='Sign In →'; }
  },

  async register(){
    const school=document.getElementById('r-school').value.trim();
    const name=document.getElementById('r-name').value.trim();
    const email=document.getElementById('r-email').value.trim();
    const pwd=document.getElementById('r-pwd').value;
    const cpwd=document.getElementById('r-cpwd').value;
    const errEl=document.getElementById('r-err');
    const btn=document.getElementById('register-btn');
    if(!school||!name||!email||!pwd){ errEl.textContent='Please fill in all required fields.'; errEl.style.display='flex'; return; }
    if(pwd!==cpwd){ errEl.textContent='Passwords do not match.'; errEl.style.display='flex'; return; }
    if(pwd.length<6){ errEl.textContent='Password must be at least 6 characters.'; errEl.style.display='flex'; return; }
    btn.disabled=true; btn.textContent='Creating account…'; errEl.style.display='none';
    if(!window.FAuth){
      const users=DB.get('users',[]); if(users.find(u=>u.email===email)){ errEl.textContent='Email already registered.'; errEl.style.display='flex'; btn.disabled=false; btn.textContent='Create School Account'; return; }
      const sc=DB.get('school',{}); sc.name=school; DB.set('school',sc);
      const newUser={id:uid('u'),email,password:pwd,name,role:'admin',phone:'',createdAt:new Date().toISOString(),lastLogin:null};
      users.push(newUser); DB.set('users',users); DB.set('session',{userId:newUser.id}); this.currentUser=newUser;
      this.toast(`Welcome, ${name.split(' ')[0]}!`,'success'); this.boot(); return;
    }
    const result=await FAuth.register(school,name,email,pwd);
    if(result.success){ this.toast(`Welcome, ${name.split(' ')[0]}!`,'success'); }
    else{ errEl.textContent=result.error; errEl.style.display='flex'; btn.disabled=false; btn.textContent='Create School Account'; }
  },

  // ══ DASHBOARD ══
  loadDashboard(){
    const students=DB.get('students',[]);
    const staff=DB.get('staff',[]);
    const classes=DB.get('classes',[]);
    const payments=DB.get('feePayments',[]);
    const totalRevenue=payments.reduce((s,p)=>s+(+p.amount||0),0);
    const active=students.filter(s=>s.status==='active').length;
    const attRecords=DB.get('attendance',[]);
    const todayAtt=attRecords.filter(a=>a.date===new Date().toISOString().split('T')[0]);
    const attRate=todayAtt.length>0?Math.round(todayAtt.reduce((s,a)=>s+(a.present/(a.total||1)),0)/todayAtt.length*100):94;
    const kpis=[
      {icon:'students',label:'Total Students',val:students.length,sub:`${active} active`,color:'blue'},
      {icon:'staff',label:'Total Staff',val:staff.length,sub:`${staff.filter(s=>s.role==='teacher').length} teachers`,color:'teal'},
      {icon:'classes',label:'Classes',val:classes.length,sub:`${DB.get('subjects',[]).length} subjects`,color:'green'},
      {icon:'fees',label:'Fee Revenue',val:fmt(totalRevenue),sub:'All time collected',color:'amber'},
      {icon:'check',label:'Attendance Rate',val:attRate+'%',sub:"Today's average",color:'teal'},
      {icon:'library',label:'Library Books',val:DB.get('books',[]).reduce((s,b)=>s+(+b.copies||0),0),sub:`${DB.get('books',[]).reduce((s,b)=>s+(+b.available||0),0)} available`,color:'blue'},
    ];
    document.getElementById('dash-kpis').innerHTML=kpis.map(k=>`
      <div class="kpi-card">
        <div class="kpi-icon ${k.color}">${SMS._kpiSvg(k.icon)}</div>
        <div class="kpi-val">${k.val}</div>
        <div class="kpi-label">${k.label}</div>
        <div style="font-size:.72rem;color:var(--t4);margin-top:.2rem">${k.sub}</div>
      </div>`).join('');
    this.renderDashCharts(students,classes,payments);
    // Recent students
    const recent=[...students].sort((a,b)=>new Date(b.admitDate)-new Date(a.admitDate)).slice(0,5);
    document.getElementById('dash-recent-students').innerHTML=recent.map(s=>`
      <div class="mini-item">
        <div class="mini-av">${s.fname[0]}${s.lname[0]}</div>
        <div><div class="mini-name">${s.fname} ${s.lname}</div><div class="mini-sub">${this.className(s.classId)} · ${s.studentId}</div></div>
        <div class="mini-right">${statusBadge(s.status)}</div>
      </div>`).join('') || '<div class="mini-item" style="color:var(--t4);font-size:.82rem;padding:1.5rem">No students yet</div>';
    // Events
    const events=DB.get('events',[]);
    const upcomingEv=[...events].filter(e=>new Date(e.start)>=new Date()).sort((a,b)=>new Date(a.start)-new Date(b.start)).slice(0,4);
    const evColors={exam:'#1a3a6b',academic:'#0d9488',sports:'#16a34a',holiday:'#d97706',meeting:'#7c3aed',cultural:'#dc2626'};
    document.getElementById('dash-events').innerHTML=upcomingEv.map(e=>`
      <div class="mini-item">
        <div class="mini-av" style="background:${evColors[e.type]||'var(--brand-lt)'};color:white"></div>
        <div><div class="mini-name">${e.title}</div><div class="mini-sub">${fmtDate(e.start)}</div></div>
        <div class="mini-right"><span class="badge badge-info" style="font-size:.65rem">${e.type}</span></div>
      </div>`).join('') || '<div class="mini-item" style="color:var(--t4);font-size:.82rem;padding:1.5rem">No upcoming events</div>';
    // Defaulters
    const defaulters=students.filter(s=>{ const p1=+(s.feesPaid?.term1||0); return p1<850; }).slice(0,4);
    document.getElementById('dash-defaulters').innerHTML=defaulters.map(s=>`
      <div class="mini-item">
        <div class="mini-av" style="background:var(--danger-bg);color:var(--danger)">${s.fname[0]}${s.lname[0]}</div>
        <div><div class="mini-name">${s.fname} ${s.lname}</div><div class="mini-sub">${this.className(s.classId)}</div></div>
        <div class="mini-right" style="font-size:.78rem;font-weight:700;color:var(--danger)">Owes fees</div>
      </div>`).join('') || '<div class="mini-item" style="color:var(--success);font-size:.82rem;padding:1.5rem">No defaulters — all fees paid</div>';
  },

  renderDashCharts(students,classes,payments){
    // Enrollment by class
    const ctx1=document.getElementById('chart-enrollment');
    if(ctx1){ if(this._charts.enrollment) this._charts.enrollment.destroy();
      const labels=classes.map(c=>c.name);
      const data=classes.map(c=>students.filter(s=>s.classId===c.id).length);
      this._charts.enrollment=new Chart(ctx1,{type:'bar',data:{labels,datasets:[{data,backgroundColor:'rgba(26,58,107,0.8)',borderRadius:6}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{y:{beginAtZero:true,grid:{color:'rgba(0,0,0,0.05)'}},x:{grid:{display:false}}}}});
    }
    // Fee collection
    const ctx2=document.getElementById('chart-fees');
    if(ctx2){ if(this._charts.fees) this._charts.fees.destroy();
      const months=['Sep','Oct','Nov','Dec','Jan','Feb','Mar'];
      const feeData=[18200,22400,19800,14200,28600,24100,18900];
      this._charts.fees=new Chart(ctx2,{type:'line',data:{labels:months,datasets:[{data:feeData,borderColor:'#0d9488',backgroundColor:'rgba(13,148,136,0.1)',borderWidth:2.5,tension:0.4,fill:true,pointBackgroundColor:'#0d9488',pointRadius:4}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{y:{beginAtZero:true,grid:{color:'rgba(0,0,0,0.05)'},ticks:{callback:v=>'₵'+v.toLocaleString()}},x:{grid:{display:false}}}}});
    }
    // Attendance chart
    const ctx3=document.getElementById('chart-attendance');
    if(ctx3){ if(this._charts.att) this._charts.att.destroy();
      const days=['Mon','Tue','Wed','Thu','Fri'];
      const attData=[94,91,96,89,95];
      this._charts.att=new Chart(ctx3,{type:'bar',data:{labels:days,datasets:[{data:attData,backgroundColor:attData.map(v=>v>=90?'rgba(13,148,136,0.8)':'rgba(217,119,6,0.8)'),borderRadius:4}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{y:{min:70,max:100,grid:{color:'rgba(0,0,0,0.05)'},ticks:{callback:v=>v+'%'}},x:{grid:{display:false}}}}});
    }
  },

  // ══ STUDENTS ══
  loadStudents(){
    const classes=DB.get('classes',[]);
    const sel=document.getElementById('s-class-f'); if(sel){ sel.innerHTML='<option value="">All Classes</option>'+classes.map(c=>`<option value="${c.id}">${c.name}</option>`).join(''); }
    this.renderStudentStats();
    this.renderStudents();
    // Populate student dropdown in fee modal
    const fstu=document.getElementById('fee-student'); if(fstu){ const students=DB.get('students',[]); fstu.innerHTML='<option value="">— Select Student —</option>'+students.map(s=>`<option value="${s.id}">${s.fname} ${s.lname} (${this.className(s.classId)})</option>`).join(''); }
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
      if(q&&!`${s.fname} ${s.lname} ${s.studentId} ${s.dadPhone||''}`.toLowerCase().includes(q)) return false;
      return true;
    });
    const perPage=15, total=filtered.length, pages=Math.ceil(total/perPage);
    this._studPage=Math.min(this._studPage,pages||1);
    const slice=filtered.slice((this._studPage-1)*perPage,this._studPage*perPage);
    const tbody=document.getElementById('students-tbody');
    if(!tbody) return;
    tbody.innerHTML=slice.map(s=>{
      const p1=+(s.feesPaid?.term1||0), p2=+(s.feesPaid?.term2||0);
      const owed=(850-p1)+(850-p2);
      const feeStatus=owed>0?`<span style="color:var(--danger);font-size:.76rem;font-weight:600">Owes ${fmt(owed)}</span>`:`<span style="color:var(--success);font-size:.76rem;font-weight:600">Paid</span>`;
      return `<tr>
        <td style="font-family:monospace;font-size:.75rem;color:var(--t3)">${s.studentId}</td>
        <td><div style="display:flex;align-items:center;gap:.6rem"><div class="mini-av">${s.fname[0]}${s.lname[0]}</div><div><div style="font-weight:600;color:var(--t1)">${s.fname} ${s.lname}</div><div style="font-size:.73rem;color:var(--t4)">${fmtDate(s.dob)}</div></div></div></td>
        <td>${this.className(s.classId)}</td>
        <td>${s.gender}</td>
        <td><div style="font-size:.8rem">${s.dadName||'—'}</div><div style="font-size:.73rem;color:var(--t4)">${s.dadPhone||''}</div></td>
        <td style="font-size:.8rem">${s.dadPhone||'—'}</td>
        <td>${feeStatus}</td>
        <td>${statusBadge(s.status)}</td>
        <td>
          <div style="display:flex;gap:.3rem">
            <button class="btn btn-ghost btn-sm" onclick="SMS.viewStudent('${s.id}')" style="padding:.3rem .5rem" title="View Profile"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></button>
            <button class="btn btn-ghost btn-sm" onclick="SMS.openStudentModal('${s.id}')" style="padding:.3rem .5rem" title="Edit"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
            <button class="btn btn-ghost btn-sm" onclick="SMS.confirmDelete('Delete student ${s.fname} ${s.lname}?',()=>SMS.deleteStudent('${s.id}'))" style="padding:.3rem .5rem;color:var(--danger)" title="Delete"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg></button>
          </div>
        </td>
      </tr>`;
    }).join('') || '<tr><td colspan="9" class="tbl-empty">No students found</td></tr>';
    // Pager
    let pager=`<span class="pager-info">Showing ${Math.min(filtered.length,perPage*(this._studPage-1)+1)}–${Math.min(filtered.length,perPage*this._studPage)} of ${total}</span>`;
    for(let i=1;i<=pages;i++) pager+=`<button class="pager-btn ${i===this._studPage?'active':''}" onclick="SMS._studPage=${i};SMS.renderStudents()">${i}</button>`;
    document.getElementById('students-pager').innerHTML=pager;
  },

  viewStudent(id){
    const s=DB.get('students',[]).find(x=>x.id===id); if(!s) return;
    document.getElementById('sp-modal-title').textContent=`${s.fname} ${s.lname}`;
    const payments=DB.get('feePayments',[]).filter(p=>p.studentId===id);
    const grades=DB.get('grades',[]).filter(g=>g.studentId===id);
    const exams=DB.get('exams',[]);
    document.getElementById('student-profile-body').innerHTML=`
      <div style="display:flex;align-items:flex-start;gap:1.25rem;flex-wrap:wrap;margin-bottom:1.25rem">
        <div class="profile-av-lg">${s.fname[0]}${s.lname[0]}</div>
        <div style="flex:1">
          <div style="font-family:'Playfair Display',serif;font-size:1.4rem;font-weight:700;color:var(--t1);margin-bottom:.2rem">${s.fname} ${s.lname}</div>
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
        <div class="pinfo-item"><div class="pinfo-label">Blood Group</div><div class="pinfo-val">${s.blood||'—'}</div></div>
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
      <div class="profile-section-title">Fee Payments (${payments.length} records)</div>
      ${payments.length>0?`<table class="tbl"><thead><tr><th>Receipt</th><th>Term</th><th>Amount</th><th>Method</th><th>Date</th></tr></thead><tbody>${payments.map(p=>`<tr><td style="font-family:monospace;font-size:.75rem">${p.receiptNo||'—'}</td><td>Term ${p.term}</td><td style="font-weight:700;color:var(--success)">${fmt(p.amount)}</td><td>${p.method}</td><td>${fmtDate(p.date)}</td></tr>`).join('')}</tbody></table>`:'<div style="color:var(--t4);font-size:.82rem;padding:.5rem 0">No payments recorded</div>'}
      <div class="profile-section-title">Academic Results (${grades.length} entries)</div>
      ${grades.length>0?`<table class="tbl"><thead><tr><th>Exam</th><th>Score</th><th>Max</th><th>Grade</th></tr></thead><tbody>${grades.map(g=>{ const ex=exams.find(e=>e.id===g.examId); return `<tr><td>${ex?.name||'—'}</td><td style="font-weight:700">${g.score}</td><td>${ex?.maxScore||100}</td><td><span class="badge ${gradeFromScore(g.score,ex?.maxScore||100)==='F'?'badge-danger':gradeFromScore(g.score,ex?.maxScore||100)<='C'?'badge-warn':'badge-success'}">${gradeFromScore(g.score,ex?.maxScore||100)}</span></td></tr>`; }).join('')}</tbody></table>`:'<div style="color:var(--t4);font-size:.82rem;padding:.5rem 0">No grades recorded</div>'}
    `;
    this.openModal('m-student-profile');
  },

  openStudentModal(id=null){
    const classes=DB.get('classes',[]);
    const sel=document.getElementById('sf-class'); if(sel) sel.innerHTML='<option value="">— Select —</option>'+classes.map(c=>`<option value="${c.id}">${c.name}</option>`).join('');
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
      document.getElementById('sf-dad').value=s.dadName||'';
      document.getElementById('sf-dad-phone').value=s.dadPhone||'';
      document.getElementById('sf-dad-email').value=s.dadEmail||'';
      document.getElementById('sf-dad-job').value=s.dadJob||'';
      document.getElementById('sf-mom').value=s.momName||'';
      document.getElementById('sf-mom-phone').value=s.momPhone||'';
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
    if(!fname||!lname||!classId||!gender||!admitDate){ errEl.style.display='block'; errEl.textContent='Please fill in all required fields (First Name, Last Name, Class, Gender, Admission Date).'; return; }
    errEl.style.display='none';
    const students=DB.get('students',[]);
    const existingId=document.getElementById('sf-id').value;
    const sid=document.getElementById('sf-sid').value.trim()||`BFA-${new Date().getFullYear()}-`+String(students.length+101).padStart(4,'0');
    const data={fname,mname:document.getElementById('sf-mname').value.trim(),lname,classId,gender,dob,admitDate,blood:document.getElementById('sf-blood').value,address:document.getElementById('sf-address').value,studentId:sid,roll:document.getElementById('sf-roll').value,status:document.getElementById('sf-status').value,transport:document.getElementById('sf-transport').value,notes:document.getElementById('sf-notes').value,dadName:document.getElementById('sf-dad').value,dadPhone:document.getElementById('sf-dad-phone').value,dadEmail:document.getElementById('sf-dad-email').value,dadJob:document.getElementById('sf-dad-job').value,momName:document.getElementById('sf-mom').value,momPhone:document.getElementById('sf-mom-phone').value,momJob:document.getElementById('sf-mom-job').value,emerName:document.getElementById('sf-emer').value,emerPhone:document.getElementById('sf-emer-phone').value,emerRel:document.getElementById('sf-emer-rel').value,allergies:document.getElementById('sf-allergies').value,medical:document.getElementById('sf-medical').value,doctorName:document.getElementById('sf-doctor').value,docPhone:document.getElementById('sf-doc-phone').value,feesPaid:{term1:0,term2:0,term3:0}};
    if(existingId){
      const i=students.findIndex(s=>s.id===existingId);
      if(i>-1){ const old=students[i]; students[i]={...old,...data,id:existingId,studentId:old.studentId,feesPaid:old.feesPaid}; DB.set('students',students); this.audit('Edit Student','edit',`Updated student: ${fname} ${lname}`); this.toast('Student updated','success'); }
    } else {
      const newS={id:uid('stu'),...data,studentId:sid}; students.push(newS); DB.set('students',students);
      this.audit('Enroll Student','create',`New student enrolled: ${fname} ${lname} (${this.className(classId)})`);
      this.toast(`${fname} ${lname} enrolled successfully!`,'success');
    }
    this.closeModal('m-student'); this.renderStudents(); this.renderStudentStats();
  },

  deleteStudent(id){
    const students=DB.get('students',[]);
    const s=students.find(x=>x.id===id);
    DB.set('students',students.filter(x=>x.id!==id));
    this.audit('Delete Student','delete',`Removed student: ${s?.fname} ${s?.lname}`);
    this.toast('Student removed','warn'); this.renderStudents(); this.renderStudentStats();
  },

  exportStudents(){
    if(typeof XLSX==='undefined'){ this.toast('Export library not loaded','error'); return; }
    const students=DB.get('students',[]);
    const data=students.map(s=>({'Student ID':s.studentId,'First Name':s.fname,'Last Name':s.lname,'Class':this.className(s.classId),'Gender':s.gender,'DOB':s.dob,'Father/Guardian':s.dadName,'Phone':s.dadPhone,'Status':s.status,'Admission Date':s.admitDate}));
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
    let filtered=staff.filter(s=>{ if(df&&s.dept!==df) return false; if(rf&&s.role!==rf) return false; if(q&&!`${s.fname} ${s.lname} ${s.subjects||''}`.toLowerCase().includes(q)) return false; return true; });
    document.getElementById('staff-tbody').innerHTML=filtered.map(s=>`<tr>
      <td style="font-family:monospace;font-size:.75rem;color:var(--t3)">${s.id.toUpperCase()}</td>
      <td><div style="display:flex;align-items:center;gap:.6rem"><div class="mini-av" style="background:var(--brand-lt);color:var(--brand)">${s.fname[0]}${s.lname[0]}</div><div><div style="font-weight:600">${s.fname} ${s.lname}</div><div style="font-size:.73rem;color:var(--t4)">${s.qualification||''}</div></div></div></td>
      <td><span class="badge badge-info">${s.role}</span></td>
      <td>${s.dept||'—'}</td>
      <td style="font-size:.78rem;color:var(--t3)">${s.subjects||'—'}</td>
      <td>${s.phone}</td>
      <td style="font-weight:600;color:var(--brand)">${fmt(s.salary)}</td>
      <td>${statusBadge(s.status||'active')}</td>
      <td><div style="display:flex;gap:.3rem"><button class="btn btn-ghost btn-sm" onclick="SMS.openStaffModal('${s.id}')" style="padding:.3rem .5rem" title="Edit"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button><button class="btn btn-ghost btn-sm" onclick="SMS.confirmDelete('Remove staff member ${s.fname} ${s.lname}?',()=>SMS.deleteStaff('${s.id}'))" style="padding:.3rem .5rem;color:var(--danger)" title="Delete"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg></button></div></td>
    </tr>`).join('')||'<tr><td colspan="9" class="tbl-empty">No staff found</td></tr>';
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

  deleteStaff(id){ const staff=DB.get('staff',[]); const s=staff.find(x=>x.id===id); DB.set('staff',staff.filter(x=>x.id!==id)); this.audit('Delete Staff','delete',`Removed: ${s?.fname} ${s?.lname}`); this.toast('Staff removed','warn'); this.renderStaff(); },

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
      if(id==='clf-teacher') el.innerHTML='<option value="">— Select —</option>'+staff.map(s=>`<option value="${s.id}">${s.fname} ${s.lname}</option>`).join('');
      else if(id==='subj-class'||id==='att-class'||id==='tt-class-sel'||id==='hw-class-f'||id==='grade-class-sel'||id==='res-class-sel'||id==='fee-class-f'||id==='msg-class'||id==='ex-class')
        el.innerHTML=(id==='att-class'?'<option value="">Select Class</option>':'<option value="">All Classes</option>')+classes.map(c=>`<option value="${c.id}">${c.name}</option>`).join('');
      else el.innerHTML='<option value="">— Select —</option>'+classes.map(c=>`<option value="${c.id}">${c.name}</option>`).join('');
    });
    ['subj-teacher'].forEach(id=>{ const el=document.getElementById(id); if(el) el.innerHTML='<option value="">— Select —</option>'+staff.map(s=>`<option value="${s.id}">${s.fname} ${s.lname}</option>`).join(''); });
  },

  renderClasses(){
    const classes=DB.get('classes',[]);
    const students=DB.get('students',[]);
    const staff=DB.get('staff',[]);
    document.getElementById('classes-grid').innerHTML=classes.map(c=>{
      const count=students.filter(s=>s.classId===c.id).length;
      const teacher=staff.find(s=>s.id===c.teacherId);
      return `<div class="class-card" onclick="SMS.openClassModal('${c.id}')">
        <div class="class-card-name">${c.name}</div>
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
        <td style="font-weight:600">${s.name}</td>
        <td style="font-family:monospace;font-size:.75rem;color:var(--t3)">${s.code||'—'}</td>
        <td>${cls?.name||'—'}</td>
        <td>${teacher?teacher.fname+' '+teacher.lname:'—'}</td>
        <td>${s.periods||'—'}/week</td>
        <td><button class="btn btn-ghost btn-sm" onclick="SMS.confirmDelete('Delete subject ${s.name}?',()=>SMS.deleteSubject('${s.id}'))" style="color:var(--danger);padding:.3rem .5rem"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg></button></td>
      </tr>`;
    }).join('')||'<tr><td colspan="6" class="tbl-empty">No subjects added yet</td></tr>';
  },

  openClassModal(id=null){
    const staff=DB.get('staff',[]).filter(s=>s.role==='teacher');
    document.getElementById('clf-teacher').innerHTML='<option value="">— Select —</option>'+staff.map(s=>`<option value="${s.id}">${s.fname} ${s.lname}</option>`).join('');
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

  deleteSubject(id){ const s=DB.get('subjects',[]); DB.set('subjects',s.filter(x=>x.id!==id)); this.toast('Subject removed','warn'); this.renderSubjectsTable(); },

  // ══ ATTENDANCE ══
  loadAttendance(){
    this.renderAttSummary(); this.renderAttendanceRecords();
    const classes=DB.get('classes',[]);
    const sel=document.getElementById('att-class'); if(sel) sel.innerHTML='<option value="">Select Class</option>'+classes.map(c=>`<option value="${c.id}">${c.name}</option>`).join('');
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
        <div><div style="font-weight:600;font-size:.85rem">${s.fname} ${s.lname}</div><div style="font-size:.73rem;color:var(--t4)">${s.studentId}</div></div>
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
    </tr>`).join('')||'<tr><td colspan="7" class="tbl-empty">No attendance records found</td></tr>';
  },

  deleteAtt(id){ const a=DB.get('attendance',[]); DB.set('attendance',a.filter(x=>x.id!==id)); this.renderAttSummary(); this.renderAttendanceRecords(); this.toast('Record deleted','warn'); },

  // ══ EXAMS ══
  loadExams(){
    const classes=DB.get('classes',[]); const subjects=DB.get('subjects',[]);
    ['ex-class','grade-class-sel','res-class-sel'].forEach(id=>{ const el=document.getElementById(id); if(el) el.innerHTML='<option value="">All Classes</option>'+classes.map(c=>`<option value="${c.id}">${c.name}</option>`).join(''); });
    ['ex-subject','grade-exam-sel'].forEach(id=>{ const el=document.getElementById(id); if(el) el.innerHTML='<option value="">All Subjects</option>'+subjects.map(s=>`<option value="${s.id}">${s.name}</option>`).join(''); });
    this.renderExams();
  },

  renderExams(){
    const exams=DB.get('exams',[]); const classes=DB.get('classes',[]); const subjects=DB.get('subjects',[]);
    document.getElementById('exams-tbody').innerHTML=exams.map(e=>{
      const cls=classes.find(c=>c.id===e.classId); const subj=subjects.find(s=>s.id===e.subjectId);
      return `<tr>
        <td style="font-weight:600">${e.name}</td>
        <td><span class="badge badge-info">${e.type}</span></td>
        <td>${cls?.name||'—'}</td>
        <td>${subj?.name||'—'}</td>
        <td>${fmtDate(e.date)}</td>
        <td style="font-weight:700">${e.maxScore}</td>
        <td>${statusBadge(e.status)}</td>
        <td><div style="display:flex;gap:.3rem"><button class="btn btn-ghost btn-sm" onclick="SMS.openExamModal('${e.id}')" style="padding:.3rem .5rem"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button><button class="btn btn-ghost btn-sm" onclick="SMS.confirmDelete('Delete exam ${e.name}?',()=>SMS.deleteExam('${e.id}'))" style="color:var(--danger);padding:.3rem .5rem"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg></button></div></td>
      </tr>`;
    }).join('')||'<tr><td colspan="8" class="tbl-empty">No exams created yet</td></tr>';
    // Populate grade exam selector
    const gex=document.getElementById('grade-exam-sel'); if(gex) gex.innerHTML='<option value="">— Select Exam —</option>'+exams.map(e=>`<option value="${e.id}">${e.name}</option>`).join('');
  },

  openExamModal(id=null){
    const classes=DB.get('classes',[]); const subjects=DB.get('subjects',[]);
    document.getElementById('ex-class').innerHTML='<option value="">— Select —</option>'+classes.map(c=>`<option value="${c.id}">${c.name}</option>`).join('');
    document.getElementById('ex-subject').innerHTML='<option value="">— Select —</option>'+subjects.map(s=>`<option value="${s.id}">${s.name}</option>`).join('');
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

  deleteExam(id){ DB.set('exams',DB.get('exams',[]).filter(x=>x.id!==id)); this.toast('Exam deleted','warn'); this.renderExams(); },

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
        <div class="grade-name">${s.fname} ${s.lname} <span style="font-size:.73rem;color:var(--t4)">${s.studentId}</span></div>
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
      <td style="font-weight:600">${r.student.fname} ${r.student.lname}</td>
      <td>${this.className(r.student.classId)}</td>
      <td>${r.count}</td>
      <td style="font-weight:700">${r.avg*r.count}</td>
      <td style="font-weight:700;color:var(--brand-teal)">${r.avg}%</td>
      <td><span class="badge ${r.grade==='F'?'badge-danger':r.grade<='C'?'badge-warn':'badge-success'}">${r.grade}</span></td>
      <td style="font-weight:700;color:${i<3?'var(--warn)':'var(--t3)'}">${i===0?'1st':i===1?'2nd':i===2?'3rd':(i+1)+'th'}</td>
      <td><button class="btn btn-ghost btn-sm" onclick="SMS.viewStudent('${r.student.id}')" style="padding:.3rem .5rem">View →</button></td>
    </tr>`).join('')||'<tr><td colspan="8" class="tbl-empty">No results found. Enter grades first.</td></tr>';
  },

  showReportCards(){
    const classes=DB.get('classes',[]);
    const html=`<div style="margin-bottom:1rem;font-size:.85rem;color:var(--t3)">Select a class to generate report cards:</div><div style="display:flex;gap:.75rem;flex-wrap:wrap">${classes.map(c=>`<button class="btn btn-secondary btn-sm" onclick="SMS.generateReportCard('${c.id}')">${c.name}</button>`).join('')}</div>`;
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
    const html=`<div style="font-size:.82rem">${students.map(s=>{
      const sGrades=grades.filter(g=>g.studentId===s.id&&exams.some(e=>e.id===g.examId));
      const avg=sGrades.length>0?Math.round(sGrades.reduce((sum,g)=>{ const ex=exams.find(e=>e.id===g.examId); return sum+(g.score/(ex?.maxScore||100)*100); },0)/sGrades.length):0;
      return `<div style="border:1px solid var(--border);border-radius:var(--radius);padding:1rem;margin-bottom:1rem;page-break-inside:avoid">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:.75rem">
          <div><div style="font-weight:800;font-size:.95rem">${school.name||'School'}</div><div style="font-size:.72rem;color:var(--t3)">${school.address||''}</div></div>
          <div style="text-align:right;font-size:.72rem;color:var(--t3)">STUDENT REPORT CARD<br>${school.academicYear||'2025/2026'} · Term ${school.currentTerm||'2'}</div>
        </div>
        <div style="background:var(--brand-lt);padding:.5rem .75rem;border-radius:6px;margin-bottom:.75rem;display:flex;gap:2rem;flex-wrap:wrap">
          <div><span style="font-size:.7rem;color:var(--t3)">NAME</span><div style="font-weight:700;font-size:.88rem">${s.fname} ${s.lname}</div></div>
          <div><span style="font-size:.7rem;color:var(--t3)">ID</span><div style="font-weight:700;font-size:.88rem">${s.studentId}</div></div>
          <div><span style="font-size:.7rem;color:var(--t3)">CLASS</span><div style="font-weight:700;font-size:.88rem">${cls?.name||'—'}</div></div>
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:.78rem;margin-bottom:.75rem">
          <thead><tr style="background:var(--brand);color:white"><th style="padding:.4rem .6rem;text-align:left">Subject</th><th style="padding:.4rem .6rem">Score</th><th style="padding:.4rem .6rem">Max</th><th style="padding:.4rem .6rem">%</th><th style="padding:.4rem .6rem">Grade</th><th style="padding:.4rem .6rem">Remark</th></tr></thead>
          <tbody>${sGrades.map(g=>{ const ex=exams.find(e=>e.id===g.examId); const pct=Math.round(g.score/(ex?.maxScore||100)*100); const grade=gradeFromScore(g.score,ex?.maxScore||100); const remark=pct>=80?'Excellent':pct>=70?'Very Good':pct>=60?'Good':pct>=50?'Pass':'Needs Improvement'; return `<tr style="border-bottom:1px solid var(--border)"><td style="padding:.35rem .6rem">${ex?.name||'—'}</td><td style="padding:.35rem .6rem;text-align:center;font-weight:700">${g.score}</td><td style="padding:.35rem .6rem;text-align:center">${ex?.maxScore||100}</td><td style="padding:.35rem .6rem;text-align:center">${pct}%</td><td style="padding:.35rem .6rem;text-align:center;font-weight:700">${grade}</td><td style="padding:.35rem .6rem">${remark}</td></tr>`; }).join('')}
          <tr style="background:var(--surface-2);font-weight:700"><td style="padding:.4rem .6rem">OVERALL AVERAGE</td><td colspan="2"></td><td style="padding:.4rem .6rem;text-align:center;color:var(--brand)">${avg}%</td><td style="padding:.4rem .6rem;text-align:center">${gradeFromScore(avg)}</td><td style="padding:.4rem .6rem">${avg>=80?'Excellent':avg>=70?'Very Good':avg>=60?'Good':avg>=50?'Pass':'Needs Improvement'}</td></tr>
          </tbody>
        </table>
        <div style="font-size:.72rem;color:var(--t4);text-align:center;padding-top:.5rem;border-top:1px solid var(--border)">Generated by Eduformium School Management System · ${new Date().toLocaleDateString()}</div>
      </div>`;
    }).join('')}</div>`;
    document.getElementById('receipt-body').innerHTML=html;
    document.getElementById('receipt-title').textContent=`Report Cards — ${cls?.name}`;
    this.openModal('m-receipt');
  },

  // ══ TIMETABLE ══
  loadTimetable(){ this.renderTimetable(); },

  renderTimetable(){
    const classId=document.getElementById('tt-class-sel').value;
    const timetable=DB.get('timetable',{}); const classData=timetable[classId];
    const grid=document.getElementById('timetable-grid');
    if(!classId){ grid.innerHTML='<div style="padding:2rem;text-align:center;color:var(--t4)">Select a class to view timetable</div>'; return; }
    const days=['Monday','Tuesday','Wednesday','Thursday','Friday'];
    const periods=['7:30-8:30','8:30-9:30','9:30-10:30','10:30-11:00','11:00-12:00','12:00-1:00'];
    if(!classData){ grid.innerHTML='<div style="padding:2rem;text-align:center;color:var(--t4)">No timetable set for this class.<br><button class="btn btn-primary btn-sm" style="margin-top:.75rem">Set Timetable</button></div>'; return; }
    let html=`<table class="tt-table"><thead><tr><th>Period</th>${days.map(d=>`<th>${d}</th>`).join('')}</tr></thead><tbody>`;
    periods.forEach(period=>{
      html+=`<tr><td class="time-col">${period}</td>`;
      days.forEach(day=>{
        const slot=classData[day]?.[period];
        if(slot?.subject==='BREAK') html+=`<td style="background:var(--surface-2);color:var(--t4);font-size:.72rem;font-weight:600;text-align:center">Break</td>`;
        else if(slot) html+=`<td><div class="tt-cell">${slot.subject}<div style="font-size:.65rem;font-weight:400;color:var(--t3);margin-top:.15rem">${slot.teacher}</div></div></td>`;
        else html+=`<td></td>`;
      });
      html+=`</tr>`;
    });
    html+=`</tbody></table>`;
    grid.innerHTML=html;
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
          <div class="hw-card-title">${h.title}</div>
          ${statusBadge(h.status)}
        </div>
        <div class="hw-card-meta">${this.className(h.classId)} · ${this.subjectName(h.subjectId)}</div>
        <div class="hw-card-desc">${h.desc}</div>
        <div class="hw-card-footer">
          <span>Due: <strong>${fmtDate(h.dueDate)}</strong></span>
          <span>Assigned: ${fmtDate(h.assignedDate)}</span>
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
        <td style="font-weight:600">${s.fname} ${s.lname}</td>
        <td><span class="badge badge-info">${s.role}</span></td>
        <td>${fmt(basic)}</td>
        <td>${fmt(allow)}</td>
        <td style="color:var(--danger)">${fmt(deduct)}</td>
        <td style="font-weight:800;color:var(--brand)">${fmt(net)}</td>
        <td>${p?statusBadge('active'):`<span class="badge badge-warn">Pending</span>`}</td>
        <td><button class="btn btn-ghost btn-sm" onclick="SMS.payStaff('${s.id}',${net},'${month}','${year}')" style="padding:.3rem .6rem">${p?'Paidid':'Pay'}</button></td>
      </tr>`;
    }).join('')||'<tr><td colspan="8" class="tbl-empty">No staff</td></tr>';
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
    DB.set('payroll',payroll); this.audit('Payroll','create',`Paid ${s.fname} ${s.lname}: ${fmt(net)}`); this.toast(`${s.fname} paid ${fmt(net)}`,'success'); this.renderPayroll();
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
    }).join('')||'<tr><td colspan="8" class="tbl-empty">No leave requests</td></tr>';
  },

  updateLeave(id,status){ const leaves=DB.get('leaves',[]); const i=leaves.findIndex(l=>l.id===id); if(i>-1){ leaves[i].status=status; DB.set('leaves',leaves); } this.audit('Leave','edit',`Leave ${status}: ${id}`); this.toast(`Leave ${status}`,'success'); this.renderLeave(); },

  // ══ FEES ══
  loadFees(){
    const classes=DB.get('classes',[]);
    const sel=document.getElementById('fee-class-f'); if(sel) sel.innerHTML='<option value="">All Classes</option>'+classes.map(c=>`<option value="${c.id}">${c.name}</option>`).join('');
    const fstu=document.getElementById('fee-student'); if(fstu){ const students=DB.get('students',[]); fstu.innerHTML='<option value="">— Select Student —</option>'+students.map(s=>`<option value="${s.id}">${s.fname} ${s.lname} (${this.className(s.classId)})</option>`).join(''); }
    this.renderFeesKpis(); this.renderFees(); this.renderFeeStructure(); this.renderDefaulters();
  },

  renderFeesKpis(){
    const payments=DB.get('feePayments',[]);
    const students=DB.get('students',[]);
    const totalCollected=payments.reduce((s,p)=>s+(+p.amount||0),0);
    const defaulters=students.filter(s=>{ const p1=+(s.feesPaid?.term1||0), p2=+(s.feesPaid?.term2||0); return p1<850||p2<850; });
    const outstanding=defaulters.reduce((s,st)=>s+(850-(+(st.feesPaid?.term1||0)))+(850-(+(st.feesPaid?.term2||0))),0);
    document.getElementById('fees-kpis').innerHTML=[
      {icon:'fees',val:fmt(totalCollected),lbl:'Total Collected',color:'teal'},
      {icon:'transactions',val:payments.length,lbl:'Transactions',color:'blue'},
      {icon:'warning',val:defaulters.length,lbl:'Defaulters',color:'amber'},
      {icon:'outstanding',val:fmt(Math.max(0,outstanding)),lbl:'Outstanding Balance',color:'red'},
    ].map(k=>`<div class="kpi-card"><div class="kpi-icon ${k.color}">${SMS._kpiSvg(k.icon)}</div><div class="kpi-val">${k.val}</div><div class="kpi-label">${k.lbl}</div></div>`).join('');
  },

  renderFees(){
    const payments=DB.get('feePayments',[]); const students=DB.get('students',[]);
    const q=(document.getElementById('fee-search')?.value||'').toLowerCase();
    const cf=document.getElementById('fee-class-f')?.value||'';
    const tf=document.getElementById('fee-term-f')?.value||'';
    let filtered=payments.filter(p=>{
      const s=students.find(x=>x.id===p.studentId);
      if(!s) return false; if(cf&&s.classId!==cf) return false; if(tf&&p.term!==tf) return false;
      if(q&&!`${s.fname} ${s.lname}`.toLowerCase().includes(q)) return false; return true;
    }).sort((a,b)=>b.date.localeCompare(a.date));
    document.getElementById('fees-tbody').innerHTML=filtered.map(p=>{
      const s=students.find(x=>x.id===p.studentId);
      return `<tr>
        <td style="font-family:monospace;font-size:.75rem;color:var(--t3)">${p.receiptNo||'—'}</td>
        <td style="font-weight:600">${s?s.fname+' '+s.lname:'Unknown'}</td>
        <td>${this.className(s?.classId)}</td>
        <td>Term ${p.term}</td>
        <td style="font-weight:800;color:var(--success)">${fmt(p.amount)}</td>
        <td><span class="badge badge-neutral">${p.method}</span></td>
        <td>${fmtDate(p.date)}</td>
        <td>${p.by||'—'}</td>
        <td><button class="btn btn-ghost btn-sm" onclick="SMS.showReceipt('${p.id}')" style="padding:.3rem .5rem" title="Receipt"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg></button></td>
      </tr>`;
    }).join('')||'<tr><td colspan="9" class="tbl-empty">No fee payments found</td></tr>';
  },

  renderFeeStructure(){
    const fs=DB.get('feeStructure',[]); const classes=DB.get('classes',[]);
    document.getElementById('fee-struct-tbody').innerHTML=fs.map(f=>{
      const cls=classes.find(c=>c.id===f.classId);
      const total=(+f.term1||0)+(+f.term2||0)+(+f.term3||0);
      return `<tr>
        <td style="font-weight:600">${cls?.name||'—'}</td>
        <td>${fmt(f.term1)}</td><td>${fmt(f.term2)}</td><td>${fmt(f.term3)}</td>
        <td class="fee-struct-total">${fmt(total)}</td>
        <td style="font-size:.75rem;color:var(--t3)">Tuition, Books, Activities</td>
        <td><button class="btn btn-ghost btn-sm" style="padding:.3rem .5rem;color:var(--brand)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button></td>
      </tr>`;
    }).join('')||'<tr><td colspan="7" class="tbl-empty">No fee structure defined</td></tr>';
  },

  renderDefaulters(){
    const students=DB.get('students',[]); const classes=DB.get('classes',[]);
    const defaulters=students.filter(s=>{ const p1=+(s.feesPaid?.term1||0),p2=+(s.feesPaid?.term2||0); return p1<850||p2<850; });
    document.getElementById('defaulters-tbody').innerHTML=defaulters.map(s=>{
      const owed1=Math.max(0,850-(+(s.feesPaid?.term1||0))), owed2=Math.max(0,850-(+(s.feesPaid?.term2||0)));
      return `<tr>
        <td style="font-weight:600">${s.fname} ${s.lname}</td>
        <td>${this.className(s.classId)}</td>
        <td>${s.dadPhone||'—'}</td>
        <td style="color:${owed1>0?'var(--danger)':'var(--success)'};font-weight:600">${owed1>0?fmt(owed1):'Paid'}</td>
        <td style="color:${owed2>0?'var(--danger)':'var(--success)'};font-weight:600">${owed2>0?fmt(owed2):'Paid'}</td>
        <td>—</td>
        <td style="font-weight:800;color:var(--danger)">${fmt(owed1+owed2)}</td>
        <td><button class="btn btn-primary btn-sm" onclick="SMS.openFeeModal('${s.id}')" style="font-size:.73rem;padding:.3rem .6rem">Pay Now</button></td>
      </tr>`;
    }).join('')||'<tr><td colspan="8" class="tbl-empty"> No defaulters — all fees paid!</td></tr>';
  },

  openFeeModal(preStudentId=null){
    ['fee-id','fee-amount','fee-ref','fee-notes'].forEach(id=>{ const e=document.getElementById(id); if(e) e.value=''; });
    document.getElementById('fee-date').value=new Date().toISOString().split('T')[0];
    document.getElementById('fee-term').value=DB.get('school',{}).currentTerm||'2';
    document.getElementById('fee-method').value='cash';
    document.getElementById('fee-err').style.display='none';
    if(preStudentId) document.getElementById('fee-student').value=preStudentId;
    this.openModal('m-fee');
  },

  saveFee(){
    const studentId=document.getElementById('fee-student').value;
    const term=document.getElementById('fee-term').value;
    const amount=+document.getElementById('fee-amount').value;
    const date=document.getElementById('fee-date').value;
    const errEl=document.getElementById('fee-err');
    if(!studentId||!amount||!date){ errEl.style.display='block'; errEl.textContent='Please fill in all required fields.'; return; }
    errEl.style.display='none';
    const payments=DB.get('feePayments',[]);
    const receiptNo='REC-'+String(payments.length+1).padStart(4,'0');
    const payment={id:uid('fp'),studentId,term,amount,method:document.getElementById('fee-method').value,date,by:this.currentUser.name,receiptNo,ref:document.getElementById('fee-ref').value,notes:document.getElementById('fee-notes').value};
    payments.push(payment); DB.set('feePayments',payments);
    // Update student feesPaid
    const students=DB.get('students',[]); const si=students.findIndex(s=>s.id===studentId);
    if(si>-1){ if(!students[si].feesPaid) students[si].feesPaid={}; students[si].feesPaid['term'+term]=(+(students[si].feesPaid['term'+term]||0))+amount; DB.set('students',students); }
    const s=DB.get('students',[]).find(x=>x.id===studentId);
    this.audit('Fee Payment','create',`Payment recorded: ${s?.fname} ${s?.lname} — ${fmt(amount)} Term ${term} (${receiptNo})`);
    this.toast(`Payment of ${fmt(amount)} recorded! Receipt: ${receiptNo}`,'success');
    this.closeModal('m-fee'); this.renderFees(); this.renderFeesKpis(); this.renderDefaulters();
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
      </div>
      <div style="background:var(--brand);color:white;padding:1rem;border-radius:var(--radius);text-align:center;margin-bottom:1rem">
        <div style="font-size:.75rem;text-transform:uppercase;letter-spacing:.08em;opacity:.7">Amount Paid</div>
        <div style="font-size:1.8rem;font-weight:800;letter-spacing:-.04em">${fmt(p.amount)}</div>
      </div>
      <div style="text-align:center;font-size:.7rem;color:var(--t4)">This receipt was generated by Eduformium School Management System.<br>Thank you for your payment.</div>
    `;
    this.openModal('m-receipt');
  },

  exportFees(){
    if(typeof XLSX==='undefined'){ this.toast('Export library not loaded','error'); return; }
    const payments=DB.get('feePayments',[]); const students=DB.get('students',[]);
    const data=payments.map(p=>{ const s=students.find(x=>x.id===p.studentId); return {'Receipt No':p.receiptNo,'Student':s?s.fname+' '+s.lname:'Unknown','Class':this.className(s?.classId),'Term':'Term '+p.term,'Amount':p.amount,'Method':p.method,'Date':p.date,'Received By':p.by}; });
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
      <td><button class="btn btn-ghost btn-sm" onclick="SMS.confirmDelete('Delete this expense?',()=>SMS.deleteExpense('${e.id}'))" style="color:var(--danger);padding:.3rem .5rem"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg></button></td>
    </tr>`).join('')||'<tr><td colspan="7" class="tbl-empty">No expenses recorded</td></tr>';
    this.renderExpenseCharts(bycat,expenses);
  },

  deleteExpense(id){ DB.set('expenses',DB.get('expenses',[]).filter(x=>x.id!==id)); this.toast('Expense deleted','warn'); this.renderExpenses(); },

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
    const cnt=document.getElementById('inbox-count'); if(cnt) cnt.textContent=unread; cnt.style.display=unread>0?'inline':'none';
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
    const classes=DB.get('classes',[]); const sel=document.getElementById('msg-class'); if(sel) sel.innerHTML='<option value="">— Select Class —</option>'+classes.map(c=>`<option value="${c.id}">${c.name}</option>`).join('');
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
    let filtered=books.filter(b=>{ if(cf&&b.category!==cf) return false; if(sf==='available'&&b.available<1) return false; if(sf==='borrowed'&&b.available>0) return false; if(q&&!`${b.title} ${b.author} ${b.isbn}`.toLowerCase().includes(q)) return false; return true; });
    document.getElementById('lib-tbody').innerHTML=filtered.map(b=>`<tr>
      <td style="font-family:monospace;font-size:.73rem;color:var(--t3)">${b.isbn||'—'}</td>
      <td style="font-weight:600">${b.title}</td>
      <td>${b.author}</td>
      <td><span class="badge badge-neutral">${b.category}</span></td>
      <td style="text-align:center">${b.copies}</td>
      <td style="text-align:center;font-weight:700;color:${b.available>0?'var(--success)':'var(--danger)'}">${b.available}</td>
      <td>${b.available>0?statusBadge('available'):statusBadge('borrowed')}</td>
      <td><button class="btn btn-ghost btn-sm" style="color:var(--brand);padding:.3rem .5rem">Issue</button></td>
    </tr>`).join('')||'<tr><td colspan="8" class="tbl-empty">No books found</td></tr>';
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
          <div class="event-title">${e.title}</div>
          <div class="event-meta">${fmtDate(e.start)}${e.end?` — ${fmtDate(e.end)}`:''}${e.venue?' · '+e.venue:''}</div>
          ${e.desc?`<div style="font-size:.75rem;color:var(--t3);margin-top:.25rem">${e.desc}</div>`:''}
        </div>
        <button class="btn btn-ghost btn-sm admin-only" onclick="SMS.confirmDelete('Delete event ${e.title}?',()=>SMS.deleteEvent('${e.id}'))" style="color:var(--danger);padding:.3rem .5rem;margin-left:auto"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg></button>
      </div>`).join('')||'<div style="padding:2rem;text-align:center;font-size:.82rem;color:var(--t4)">No events scheduled</div>';
  },

  openEventModal(){ ['ev-title','ev-start','ev-end','ev-time','ev-venue','ev-desc'].forEach(id=>{ const e=document.getElementById(id); if(e) e.value=''; }); document.getElementById('ev-type').value='academic'; this.openModal('m-event'); },

  saveEvent(){
    const title=document.getElementById('ev-title').value.trim(); const start=document.getElementById('ev-start').value;
    if(!title||!start){ this.toast('Title and start date required','error'); return; }
    const events=DB.get('events',[]); events.push({id:uid('ev'),title,type:document.getElementById('ev-type').value,start,end:document.getElementById('ev-end').value,time:document.getElementById('ev-time').value,venue:document.getElementById('ev-venue').value,desc:document.getElementById('ev-desc').value});
    DB.set('events',events); this.audit('Add Event','create',`New event: ${title}`); this.toast('Event added','success'); this.closeModal('m-event'); this.renderCalendar(); this.renderEventsList();
  },

  deleteEvent(id){ DB.set('events',DB.get('events',[]).filter(x=>x.id!==id)); this.toast('Event deleted','warn'); this.renderCalendar(); this.renderEventsList(); },

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
      content.innerHTML=`<table class="tbl"><thead><tr><th>Rank</th><th>Student</th><th>Class</th><th>Average</th><th>Grade</th></tr></thead><tbody>${byStudent.map((s,i)=>`<tr><td style="font-weight:800;color:${i<3?'var(--warn)':'var(--t3)'}">${i+1}</td><td style="font-weight:600">${s.fname} ${s.lname}</td><td>${this.className(s.classId)}</td><td style="font-weight:700;color:var(--brand-teal)">${s.avg}%</td><td><span class="badge ${gradeFromScore(s.avg)==='F'?'badge-danger':'badge-success'}">${gradeFromScore(s.avg)}</span></td></tr>`).join('')}</tbody></table>`;
    } else if(type==='finance'){
      title.textContent='Financial Report';
      const totalFees=payments.reduce((s,p)=>s+(+p.amount||0),0); const totalExp=expenses.reduce((s,e)=>s+(+e.amount||0),0);
      content.innerHTML=`<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:1rem;margin-bottom:1.25rem">
        <div class="kpi-card"><div class="kpi-icon teal"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:22px;height:22px"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg></div><div class="kpi-val">${fmt(totalFees)}</div><div class="kpi-label">Total Fee Revenue</div></div>
        <div class="kpi-card"><div class="kpi-icon red">${SMS._kpiSvg('expenses')}</div><div class="kpi-val">${fmt(totalExp)}</div><div class="kpi-label">Total Expenses</div></div>
        <div class="kpi-card"><div class="kpi-icon ${totalFees-totalExp>0?'green':'amber'}">${SMS._kpiSvg('trending')}</div><div class="kpi-val" style="color:${totalFees-totalExp>0?'var(--success)':'var(--danger)'}">${fmt(totalFees-totalExp)}</div><div class="kpi-label">Net Balance</div></div>
      </div>`;
    } else if(type==='enrollment'){
      title.textContent='Enrollment Report';
      const classes=DB.get('classes',[]);
      content.innerHTML=`<table class="tbl"><thead><tr><th>Class</th><th>Level</th><th>Enrolled</th><th>Male</th><th>Female</th><th>Capacity</th><th>Fill Rate</th></tr></thead><tbody>${classes.map(c=>{ const cl=students.filter(s=>s.classId===c.id); const m=cl.filter(s=>s.gender==='Male').length, f=cl.filter(s=>s.gender==='Female').length, rate=Math.round(cl.length/c.capacity*100); return `<tr><td style="font-weight:600">${c.name}</td><td>${c.level||'—'}</td><td style="font-weight:700;color:var(--brand)">${cl.length}</td><td>${m}</td><td>${f}</td><td>${c.capacity}</td><td><span class="badge ${rate>90?'badge-danger':rate>70?'badge-warn':'badge-success'}">${rate}%</span></td></tr>`; }).join('')}</tbody></table>`;
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
          <div class="audit-action">${l.action} <span style="font-weight:400;color:var(--t3)">by</span> ${l.user}</div>
          <div style="font-size:.78rem;color:var(--t2);margin:.15rem 0">${l.details}</div>
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

  changePassword(){
    const oldPw=document.getElementById('pw-old').value;
    const newPw=document.getElementById('pw-new').value;
    const confirmPw=document.getElementById('pw-confirm').value;
    const errEl=document.getElementById('pw-err');
    if(this.currentUser.password!==oldPw){ errEl.style.display='block'; errEl.textContent='Current password is incorrect.'; return; }
    if(newPw.length<6){ errEl.style.display='block'; errEl.textContent='New password must be at least 6 characters.'; return; }
    if(newPw!==confirmPw){ errEl.style.display='block'; errEl.textContent='Passwords do not match.'; return; }
    errEl.style.display='none';
    const users=DB.get('users',[]); const i=users.findIndex(u=>u.id===this.currentUser.id);
    if(i>-1){ users[i].password=newPw; DB.set('users',users); this.currentUser=users[i]; }
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
    DB.set('school',school); this.audit('Settings','settings','Academic settings updated');
    this.toast('Academic settings saved!','success');
  },

  loadAppearanceSettings(){
    const dark=DB.get('darkMode',false); document.getElementById('dark-mode-toggle').checked=dark;
    const savedColors=DB.get('themeColors'); if(savedColors){ document.getElementById('custom-primary').value=savedColors.primary; document.getElementById('custom-primary-hex').value=savedColors.primary; document.getElementById('custom-teal').value=savedColors.teal; document.getElementById('custom-teal-hex').value=savedColors.teal; }
    const savedFont=DB.get('fontSize'); if(savedFont) document.querySelectorAll('.fsz-btn').forEach(b=>b.classList.toggle('active',b.dataset.size===savedFont));
  },

  renderUsers(){
    const users=DB.get('users',[]);
    document.getElementById('users-tbody').innerHTML=users.map(u=>`<tr>
      <td><div style="display:flex;align-items:center;gap:.6rem"><div class="mini-av" style="background:var(--brand-lt);color:var(--brand)">${u.name.split(' ').map(n=>n[0]).join('').slice(0,2)}</div><div style="font-weight:600">${u.name}</div></div></td>
      <td style="font-size:.8rem">${u.email}</td>
      <td><span class="badge ${u.role==='admin'?'badge-brand':'badge-info'}">${u.role}</span></td>
      <td style="font-size:.78rem;color:var(--t4)">${u.lastLogin?fmtDate(u.lastLogin):'Never'}</td>
      <td>${statusBadge('active')}</td>
      <td>${u.id!==this.currentUser.id?`<button class="btn btn-ghost btn-sm" onclick="SMS.confirmDelete('Remove user ${u.name}?',()=>SMS.deleteUser('${u.id}'))" style="color:var(--danger);padding:.3rem .5rem"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg></button>`:''}</td>
    </tr>`).join('');
  },

  openUserModal(){
    ['uf-id','uf-name','uf-email','uf-pwd'].forEach(id=>{ const e=document.getElementById(id); if(e) e.value=''; });
    document.getElementById('uf-role').value='staff'; document.getElementById('uf-err').style.display='none';
    document.getElementById('user-modal-title').textContent='Add User';
    this.openModal('m-user');
  },

  saveUser(){
    const name=document.getElementById('uf-name').value.trim(); const email=document.getElementById('uf-email').value.trim(); const pwd=document.getElementById('uf-pwd').value; const role=document.getElementById('uf-role').value;
    const errEl=document.getElementById('uf-err');
    if(!name||!email||!pwd){ errEl.style.display='block'; errEl.textContent='All fields required.'; return; }
    const users=DB.get('users',[]); if(users.find(u=>u.email===email)){ errEl.style.display='block'; errEl.textContent='Email already exists.'; return; }
    users.push({id:uid('u'),email,password:pwd,name,role,phone:'',createdAt:new Date().toISOString(),lastLogin:null});
    DB.set('users',users); this.audit('Add User','create',`New user: ${name} (${role})`); this.toast('User created!','success'); this.closeModal('m-user'); this.renderUsers();
  },

  deleteUser(id){ const users=DB.get('users',[]); const u=users.find(x=>x.id===id); DB.set('users',users.filter(x=>x.id!==id)); this.audit('Delete User','delete',`Removed user: ${u?.name}`); this.toast('User removed','warn'); this.renderUsers(); },

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
    DB.get('students',[]).filter(s=>`${s.fname} ${s.lname} ${s.studentId}`.toLowerCase().includes(ql)).slice(0,4).forEach(s=>hits.push({icon:'students',title:`${s.fname} ${s.lname}`,sub:`${s.studentId} · ${this.className(s.classId)}`,action:()=>{ SMS.viewStudent(s.id); document.getElementById('search-overlay').style.display='none'; }}));
    DB.get('staff',[]).filter(s=>`${s.fname} ${s.lname}`.toLowerCase().includes(ql)).slice(0,3).forEach(s=>hits.push({icon:'staff',title:`${s.fname} ${s.lname}`,sub:`${s.role} · ${s.dept||''}`,action:()=>{ SMS.nav('staff'); document.getElementById('search-overlay').style.display='none'; }}));
    if(hits.length===0){ results.innerHTML='<div style="padding:1.5rem;text-align:center;font-size:.85rem;color:var(--t4)">No results found</div>'; return; }
    results.innerHTML=hits.map((h,i)=>`<div style="display:flex;align-items:center;gap:.85rem;padding:.75rem 1.25rem;cursor:pointer;border-bottom:1px solid var(--border);font-size:.85rem" onmouseover="this.style.background='var(--surface-2)'" onmouseout="this.style.background=''" id="sr_${i}"><div style="font-size:1.2rem">${h.icon}</div><div><div style="font-weight:600;color:var(--t1)">${h.title}</div><div style="font-size:.75rem;color:var(--t3)">${h.sub}</div></div></div>`).join('');
    hits.forEach((h,i)=>document.getElementById('sr_'+i)?.addEventListener('click',h.action));
  },

  // ══ NOTIFICATIONS ══
  loadNotifications(){
    const students=DB.get('students',[]); const events=DB.get('events',[]); const leaves=DB.get('leaves',[]);
    const notifs=[];
    const defaults=students.filter(s=>+(s.feesPaid?.term1||0)<850||+(s.feesPaid?.term2||0)<850);
    if(defaults.length>0) notifs.push(`${defaults.length} students have outstanding fee balances`);
    const soon=events.filter(e=>{ const d=new Date(e.start); const n=new Date(); return d>=n&&(d-n)<7*86400000; });
    if(soon.length>0) notifs.push(`${soon.length} event(s) coming up in the next 7 days`);
    const pending=leaves.filter(l=>l.status==='pending');
    if(pending.length>0) notifs.push(`${pending.length} leave request(s) awaiting your approval`);
    if(notifs.length>0){
      const list=document.getElementById('notif-list'); const badge=document.getElementById('notif-badge');
      list.innerHTML=notifs.map(n=>`<div class="notif-item"><div style="font-size:.8rem;color:var(--t2)">${n}</div></div>`).join('');
      badge.style.display='flex'; badge.textContent=notifs.length;
    }
  },

  // ══ HELPERS ══
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

  openModal(id){ document.getElementById(id).style.display='flex'; document.body.style.overflow='hidden'; },
  closeModal(id){ document.getElementById(id).style.display='none'; document.body.style.overflow=''; },

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
};

// ── BOOT ──
document.addEventListener('DOMContentLoaded',()=>SMS.init());
window.SMS=SMS;
