// ══════════════════════════════════════════
//  EDUFORMIUM SMS — Dashboard — loadDashboard · KPIs · charts · panels
// ══════════════════════════════════════════

Object.assign(SMS, {
  // ── Inline SVG sparkline from array of values (W×H viewBox) ──
  _sparkline(values, W=80, H=36){
    if(!values||values.length<2) return '';
    const max=Math.max(...values), min=Math.min(...values);
    const range=max-min||1;
    const pad=3;
    const pts=values.map((v,i)=>{
      const x=pad+(i/(values.length-1))*(W-pad*2);
      const y=H-pad-(((v-min)/range)*(H-pad*2));
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    const allZero=values.every(v=>v===0);
    const trend=allZero?'flat':values[values.length-1]>values[0]?'up':values[values.length-1]<values[0]?'down':'flat';
    // Build tooltip lines showing last 6 months
    const _now=new Date();
    const tipLines=values.map((v,i)=>{
      const d=new Date(_now.getFullYear(),_now.getMonth()-5+i,1);
      const label=d.toLocaleString('default',{month:'short',year:'2-digit'});
      return `${label}: ${fmt(v)}`;
    }).join('\n');
    return `<div class="kpi-sparkline-wrap"><svg class="kpi-sparkline kpi-sparkline-${trend}" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none"><path d="M${pts.join('L')}"/></svg><div class="kpi-spark-tip">${tipLines.replace(/\n/g,'<br>')}</div></div>`;
  },

  // ── Dashboard orchestrator ──
  loadDashboard(){
    const d=this._dashComputeCore();
    this._renderDashHero(d);
    this._renderDashTodayStrip(d);
    this._renderDashKpis(d);
    this._renderDashRecentStudents(d);
    this._renderDashEvents(d);
    this._renderDashDefaulters(d);
    this._renderDashExams(d);
    this._renderDashAbsent(d);
    this._renderDashOnLeave(d);
    this._renderDashGettingStarted(d);
    // Set panel grid cols after all show/hide decisions are made
    const _panelsEl=document.querySelector('#page-dashboard .dash-panels');
    if(_panelsEl) _panelsEl.dataset.cols=d.isFinance?'3':'2';
    // ── Freshness timestamp ──
    this._dashRefreshedAt=Date.now();
    const _fEl=document.getElementById('dash-freshness');
    if(_fEl) _fEl.textContent='Updated just now';
    clearInterval(this._freshTimer);
    this._freshTimer=setInterval(()=>{
      if(!document.getElementById('page-dashboard')?.classList.contains('active')){ clearInterval(this._freshTimer); return; }
      const ago=Math.round((Date.now()-this._dashRefreshedAt)/60000);
      const fe=document.getElementById('dash-freshness');
      if(fe) fe.textContent=ago<1?'Updated just now':`Updated ${ago}m ago`;
    },30000);
    const _activeCount=d.students.filter(s=>s.status==='active').length;
    const _fp=`${d.students.length}|${_activeCount}|${d.classes.length}|${d.yearPayments.length}|${d.attRecords.length}|${_academicYear}|${_currentTerm}`;
    if(_fp!==this._dashDataFingerprint){
      this._dashDataFingerprint=_fp;
      // Defer one animation frame so the browser completes layout before Chart.js
      // queries canvas dimensions. Without this, charts render with width=0 on first
      // load (e.g. demo entry) because the app container was just made visible in the
      // same JS tick and layout hasn't been calculated yet.
      requestAnimationFrame(()=>this.renderDashCharts(d.students,d.classes,d.yearPayments,d.attRecords,d.role));
    }
    if(!this._dashRefreshTimer){
      this._dashRefreshTimer=setInterval(()=>{
        if(document.getElementById('page-dashboard')?.classList.contains('active')){ this.loadDashboard(); }
        else { clearInterval(this._dashRefreshTimer); this._dashRefreshTimer=null; }
      },60000);
    }
  },

  // ── Compute all shared dashboard data once ──
  _dashComputeCore(){
    const role=this.currentUser?.role||'staff';
    const isAdmin=role==='admin';
    const isFinance=role==='admin'||role==='accountant';
    const students=DB.get('students',[]);
    const staff=DB.get('staff',[]);
    const classes=DB.get('classes',[]);
    const payments=DB.get('feePayments',[]);
    const school=DB.get('school',{});
    const exams=DB.get('exams',[]);
    const leaves=DB.get('leaves',[]);
    const books=DB.get('books',[]);
    const subjects=DB.get('subjects',[]);
    const events=DB.get('events',[]);
    const attRecords=DB.get('attendance',[]);
    const messages=DB.get('messages',[]);
    const now=new Date();
    const todayStr=localDateStr();
    const todayAtt=attRecords.filter(a=>a.date===todayStr);
    const yearPayments=payments.filter(p=>!p.academicYear||p.academicYear===_academicYear);
    const totalRevenue=yearPayments.reduce((s,p)=>s+(+p.amount||0),0);
    const active=students.filter(s=>s.status==='active').length;

    // ── Term Attendance (field-based first, fallback to date-range, then thirds) ──
    let attRate='—', attSub=`Term ${_currentTerm} attendance`, attNum=null;
    const _ayInfo=(school.academicYears||[]).find(y=>y.year===_academicYear);
    const _ayStart=_ayInfo?.startDate?new Date(_ayInfo.startDate):null;
    const _ayEnd=_ayInfo?.endDate?new Date(_ayInfo.endDate):null;
    const _termIdx=Math.min(3,Math.max(1,+_currentTerm))-1;
    let termRecs=[];
    const fieldBased=attRecords.filter(a=>a.academicYear===_academicYear&&String(a.term)===String(_currentTerm));
    if(fieldBased.length>0){
      termRecs=fieldBased;
    } else {
      const _tKey=['t1','t2','t3'][_termIdx];
      const _exactStart=_ayInfo?.[`${_tKey}Start`]?new Date(_ayInfo[`${_tKey}Start`]):null;
      const _exactEnd=_ayInfo?.[`${_tKey}End`]?new Date(_ayInfo[`${_tKey}End`]+'T23:59:59'):null;
      if(_exactStart&&_exactEnd&&_exactEnd>_exactStart){
        termRecs=attRecords.filter(a=>{ const d=new Date(a.date); return d>=_exactStart&&d<=_exactEnd; });
      } else if(_ayStart&&_ayEnd&&_ayEnd>_ayStart){
        const span=_ayEnd-_ayStart;
        const tStart=new Date(_ayStart.getTime()+_termIdx*(span/3));
        const tEnd=new Date(_ayStart.getTime()+(_termIdx+1)*(span/3));
        termRecs=attRecords.filter(a=>{ const d=new Date(a.date); return d>=tStart&&d<=tEnd; });
      } else {
        termRecs=attRecords;
      }
    }
    if(termRecs.length>0){
      const termPresent=termRecs.reduce((s,a)=>s+(+a.present||0),0);
      const termTotal=termRecs.reduce((s,a)=>s+(+a.total||0),0);
      attNum=termTotal>0?Math.round(termPresent/termTotal*100):null;
      attRate=termTotal>0?`${termPresent}/${termTotal}`:'—';
    }

    // ── Defaulters & outstanding (current term) ──
    const defaulters=students.filter(s=>{
      if(s.status!=='active') return false;
      const fs=getYearStructure(s.classId,_academicYear); if(!fs) return false;
      const due=+(fs['term'+_currentTerm]||0); if(!due) return false;
      const yf=getYearFees(s,_academicYear);
      return (+(yf['term'+_currentTerm]||0))<due;
    });
    let totalOutstanding=0;
    students.filter(s=>s.status==='active').forEach(s=>{
      const yfs=getYearStructure(s.classId,_academicYear); if(!yfs) return;
      const yf=getYearFees(s,_academicYear);
      totalOutstanding+=Math.max(0,(+(yfs['term'+_currentTerm]||0))-(+(yf['term'+_currentTerm]||0)));
    });

    // ── Trend helper ──
    const trendBadge=(current,previous,isCurrency=false,higherIsBetter=true)=>{
      if(previous===null||previous===undefined||isNaN(previous)||isNaN(current)) return '';
      const diff=current-previous;
      if(diff===0) return '<span class="kpi-trend kpi-trend-flat">→ No change</span>';
      const pct=previous>0?Math.abs(Math.round(diff/previous*100)):'—';
      const up=diff>0;
      const isGood=(up&&higherIsBetter)||(!up&&!higherIsBetter);
      const label=isCurrency?fmt(Math.abs(diff)):(pct==='—'?Math.abs(diff):pct+'%');
      return `<span class="kpi-trend ${isGood?'kpi-trend-up':'kpi-trend-down'}">${up?'↑':'↓'} ${label} vs last month</span>`;
    };

    // ── Prior-month data for trends ──
    const prevMStart=new Date(now.getFullYear(),now.getMonth()-1,1);
    const prevMKey=`${prevMStart.getFullYear()}-${String(prevMStart.getMonth()+1).padStart(2,'0')}`;
    const currMKey=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
    const feeThisMonth=yearPayments.filter(p=>p.date?.startsWith(currMKey)).reduce((s,p)=>s+(+p.amount||0),0);
    const feePrevMonth=now.getDate()<7?null:yearPayments.filter(p=>p.date?.startsWith(prevMKey)).reduce((s,p)=>s+(+p.amount||0),0); // suppress trend in first 7 days of month
    // Enrollment trend: only show when there's meaningful monthly activity
    const studThisMonth=students.filter(s=>s.admitDate?.startsWith(currMKey)).length;
    const studPrevMonth=students.filter(s=>s.admitDate?.startsWith(prevMKey)).length;

    // ── Attendance week-over-week trend ──
    const _dow=now.getDay();
    const _thisMonday=new Date(now); _thisMonday.setDate(now.getDate()-(_dow===0?6:_dow-1)); _thisMonday.setHours(0,0,0,0);
    const _lastMonday=new Date(_thisMonday); _lastMonday.setDate(_thisMonday.getDate()-7);
    const _lastSunday=new Date(_thisMonday); _lastSunday.setDate(_thisMonday.getDate()-1);
    const thisWeekRecs=attRecords.filter(a=>{ const d=new Date(a.date); return d>=_thisMonday&&d<=now; });
    const lastWeekRecs=attRecords.filter(a=>{ const d=new Date(a.date); return d>=_lastMonday&&d<=_lastSunday; });
    const avgRateOf=recs=>recs.length?Math.round(recs.reduce((s,a)=>s+(a.present/(a.total||1)),0)/recs.length*100):null;
    const attThisWeek=avgRateOf(thisWeekRecs);
    const attLastWeek=avgRateOf(lastWeekRecs);

    // ── Today figures ──
    const todayPayments=yearPayments.filter(p=>p.date===todayStr);
    const todayRevenue=todayPayments.reduce((s,p)=>s+(+p.amount||0),0);
    const todayPresent=todayAtt.reduce((s,a)=>s+(+a.present||0),0);
    const todayTotal=todayAtt.reduce((s,a)=>s+(+a.total||0),0);
    const attClassesToday=todayAtt.length;
    const pendingLeaves=leaves.filter(l=>l.status==='pending').length;
    const _todayStart=new Date(todayStr+'T00:00:00');

    // ── Homework & messages ──
    const unreadMessages=messages.filter(m=>!m.read&&(!m.tab||m.tab==='inbox')).length;

    // ── Sparkline data (last 6 months of fee collections) ──
    const _sparkKeys=[], _sparkData=[];
    for(let i=5;i>=0;i--){ const d=new Date(now.getFullYear(),now.getMonth()-i,1); _sparkKeys.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`); _sparkData.push(0); }
    yearPayments.forEach(p=>{ if(!p.date) return; const idx=_sparkKeys.indexOf(p.date.substring(0,7)); if(idx>-1) _sparkData[idx]+=(+p.amount||0); });

    return {
      role,isAdmin,isFinance,students,staff,classes,payments,school,exams,leaves,books,subjects,events,attRecords,
      now,todayStr,todayAtt,yearPayments,totalRevenue,active,
      attRate,attNum,attSub,defaulters,totalOutstanding,trendBadge,
      prevMKey,currMKey,feeThisMonth,feePrevMonth,studThisMonth,studPrevMonth,
      attThisWeek,attLastWeek,
      todayPayments,todayRevenue,todayPresent,todayTotal,attClassesToday,pendingLeaves,
      _todayStart,_sparkData,
      unreadMessages
    };
  },

  // ── Hero stats + date dimming ──
  _renderDashHero(d){
    const {active,attRate,attNum,school,isFinance,totalOutstanding} = d;
    const heroActive=document.getElementById('dash-hero-active');
    if(heroActive) heroActive.textContent=active;
    // Keep year/term pills in sync with the currently selected academic year/term
    const hyrEl=document.getElementById('dash-hero-year'); if(hyrEl) hyrEl.textContent=_academicYear||'—';
    const htrEl=document.getElementById('dash-hero-term'); if(htrEl) htrEl.textContent=_currentTerm||'—';
    // Keep greeting in sync with current time of day (auto-refresh can run hours after login)
    const _h=new Date().getHours();
    const _g=_h<12?'Good morning':_h<17?'Good afternoon':'Good evening';
    const _dwEl=document.getElementById('dash-welcome');
    if(_dwEl) _dwEl.textContent=`${_g}, ${(this.currentUser?.name||'User').split(' ')[0]}! Here's your school overview.`;
    // Keep hero date pill in sync — stays correct if dashboard is open past midnight
    const _htfEl=document.getElementById('dash-hero-today-full');
    if(_htfEl) _htfEl.textContent=new Date().toLocaleDateString('default',{weekday:'short',day:'numeric',month:'long',year:'numeric'});
    // Hero now renders on a light surface — use semantic colors that work on both light and dark backgrounds.
    // FIX: replaced rgba(255,255,255,.38) which was invisible on the new light-surface hero.
    const heroAtt=document.getElementById('dash-hero-att');
    if(heroAtt){
      heroAtt.textContent=attRate;
      heroAtt.style.color=attNum===null?'var(--t4)':attNum>=90?'var(--success)':attNum>=75?'var(--warn)':'var(--danger)';
    }
    const heroOutEl=document.getElementById('dash-hero-outstanding');
    if(heroOutEl){
      const _heroStatWrap=heroOutEl.closest('.dash-hero-stat');
      if(isFinance){
        if(_heroStatWrap) _heroStatWrap.style.display='';
        heroOutEl.textContent=fmt(totalOutstanding);
        heroOutEl.style.color=totalOutstanding>0?'var(--danger)':'var(--success)';
      } else {
        if(_heroStatWrap) _heroStatWrap.style.display='none';
      }
    }
    // Distinguish live vs historical viewing — make it unmistakable
    if(_htfEl){
      const _todayMs=Date.now();
      const _allYrs=school.academicYears||[];
      const _liveYr=_allYrs.find(y=>y.startDate&&y.endDate&&_todayMs>=new Date(y.startDate).getTime()&&_todayMs<=new Date(y.endDate).getTime())?.year
        ||[..._allYrs].sort((a,b)=>a.year>b.year?-1:1)[0]?.year||_academicYear;
      const _viewingHistoricalYear=_academicYear!==_liveYr;
      const _curYrAyInfo=_allYrs.find(y=>y.year===_academicYear)||{};
      const _termKey=['t1','t2','t3'][Math.min(3,Math.max(1,+_currentTerm))-1];
      const _termStart=_curYrAyInfo[`${_termKey}Start`]?new Date(_curYrAyInfo[`${_termKey}Start`]):null;
      const _termEnd=_curYrAyInfo[`${_termKey}End`]?new Date(_curYrAyInfo[`${_termKey}End`]+'T23:59:59'):null;
      const _todayInTerm=_termStart&&_termEnd?(_todayMs>=_termStart.getTime()&&_todayMs<=_termEnd.getTime()):null;
      const _isLive=!_viewingHistoricalYear&&(_todayInTerm===null||_todayInTerm);

      // Date pill: normal when live, strikethrough + muted when historical
      _htfEl.style.opacity=_isLive?'1':'0.5';
      _htfEl.style.textDecoration=_isLive?'none':'line-through';
      _htfEl.title=_isLive?'':`Today's date — you are viewing historical data for ${_academicYear} Term ${_currentTerm}`;

      // Historical badge — created once, reused on every render, never duplicated
      let _histBadge=document.getElementById('dash-hero-hist-badge');
      if(!_histBadge){
        const _metaEl=_htfEl.closest('.dash-hero-meta');
        if(_metaEl){
          _histBadge=document.createElement('span');
          _histBadge.id='dash-hero-hist-badge';
          _histBadge.className='dash-hero-hist-badge';
          _metaEl.appendChild(_histBadge);
        }
      }
      if(_histBadge){
        if(_isLive){
          _histBadge.style.display='none';
        } else {
          _histBadge.style.display='inline-flex';
          _histBadge.innerHTML=`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" width="10" height="10"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.95"/></svg>\u00a0Historical \u2014 ${_academicYear} Term ${_currentTerm}`;
          _histBadge.title=`You are viewing past data. Switch to the current year/term to see live figures.`;
        }
      }
    }
  },

  // ── Today at a Glance strip ──
  _renderDashTodayStrip(d){
    const {role,todayPayments,todayRevenue,todayTotal,todayPresent,attClassesToday,pendingLeaves,unreadMessages} = d;
    const stripEl=document.getElementById('dash-today-strip');
    if(!stripEl) return;
    const todayAttVal=todayTotal>0?`${todayPresent}/${todayTotal}`:'—';
    // Safe avg — guard division even though val is already guarded, belt-and-suspenders
    const todayAvgPct=todayTotal>0?`${Math.round((todayPresent/todayTotal)*100)}% avg`:'';
    const allTiles=[
      {icon:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" width="18" height="18"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>`,
        label:'Collected Today',val:fmt(todayRevenue),sub:`${todayPayments.length} payment${todayPayments.length!==1?'s':''}`,
        cls:'teal',page:'fees',roles:['admin','accountant']},
      {icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" width="18" height="18"><polyline points="20 6 9 17 4 12"/></svg>',
        label:'Attendance Today',val:todayAttVal,
        sub:todayTotal>0?`${attClassesToday} class${attClassesToday!==1?'es':''} marked · ${todayAvgPct}`:'No sessions marked',
        cls:'teal',page:'attendance',roles:['admin','teacher','staff','accountant','librarian']},
      {icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" width="18" height="18"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>',
        label:'Pending Leave',val:pendingLeaves,sub:pendingLeaves===0?'None pending':pendingLeaves===1?'Awaiting approval':`${pendingLeaves} awaiting approval`,
        cls:'navy',page:'leave',roles:['admin','accountant']},
      {icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" width="18" height="18"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>',
        label:'Messages',val:unreadMessages||0,sub:unreadMessages===0?'All read':`${unreadMessages} unread`,
        cls:'teal',page:'messages',roles:['admin','teacher','staff','accountant','librarian']},
    ];
    const visibleTiles=allTiles.filter(t=>t.roles.includes(role));
    stripEl.dataset.cols=visibleTiles.length;
    stripEl.innerHTML=visibleTiles.map(t=>`
      <div class="dash-today-tile dash-tile-${t.cls}" onclick="SMS.nav('${t.page}')" title="Go to ${t.page}">
        <div class="dash-today-icon">${t.icon}</div>
        <div class="dash-today-body">
          <div class="dash-today-val">${t.val}</div>
          <div class="dash-today-label">${t.label}</div>
          <div class="dash-today-sub">${t.sub}</div>
        </div>
      </div>`).join('');
  },

  // ── KPI cards ──
  _renderDashKpis(d){
    const {role,students,staff,classes,books,subjects,active,totalRevenue,defaulters,attRate,attNum,attSub,trendBadge,feeThisMonth,feePrevMonth,studThisMonth,studPrevMonth,attThisWeek,attLastWeek,_sparkData} = d;
    // Show enrollment trend only when there's actual monthly activity to compare
    const enrollTrend=(studThisMonth>0||studPrevMonth>0)?trendBadge(studThisMonth,studPrevMonth,false,true):'';
    const attTrend=(attThisWeek!==null&&attLastWeek!==null)?trendBadge(attThisWeek,attLastWeek,false,true):'';
    const allKpis=[
      {icon:'students',label:'Total Students',val:students.length,sub:`${active} active · ${students.length-active} inactive`,trend:enrollTrend,color:'blue',page:'students',roles:['admin','teacher','staff','accountant','librarian']},
      {icon:'staff',label:'Total Staff',val:staff.length,sub:`${staff.filter(s=>s.role==='teacher').length} teachers · ${staff.filter(s=>s.role!=='teacher').length} others`,trend:'',color:'blue',page:'staff',roles:['admin','accountant']},
      {icon:'classes',label:'Classes',val:classes.length,sub:`${subjects.length} subjects total`,trend:'',color:'blue',page:'classes',roles:['admin','teacher','staff']},
      {icon:'fees',label:`Fee Revenue (${_academicYear})`,val:fmt(totalRevenue),sub:`${defaulters.length} defaulter${defaulters.length!==1?'s':''}`,trend:trendBadge(feeThisMonth,feePrevMonth,true,true),color:'teal',warn:defaulters.length>0,featured:true,page:'fees',roles:['admin','accountant'],sparkline:false},
      {icon:'check',label:'Term Attendance',val:attRate,sub:attNum!==null?`${attSub} · ${attNum}% avg`:attSub,trend:attTrend,color:'teal',featured:true,page:'attendance',roles:['admin','teacher','staff','accountant']},
      {icon:'library',label:'Library Books',val:books.reduce((s,b)=>s+(+b.copies||0),0),sub:`${books.reduce((s,b)=>s+(+b.available||0),0)} available`,trend:'',color:'blue',page:'library',roles:['admin','librarian','staff']},
    ];
    const visibleKpis=allKpis.filter(k=>k.roles.includes(role));
    const kpiEl=document.getElementById('dash-kpis');
    if(kpiEl) kpiEl.dataset.cols=visibleKpis.length;
    if(kpiEl) kpiEl.innerHTML=visibleKpis.map(k=>`
      <div class="kpi-card${k.featured?' kpi-featured':''}" style="cursor:pointer" onclick="SMS.nav('${k.page}')">
        <div class="kpi-icon ${k.color}">${SMS._kpiSvg(k.icon)}</div>
        <div class="kpi-val">${k.val}</div>
        <div class="kpi-label">${k.label}</div>
        <div class="kpi-sub-line ${k.warn?'kpi-sub-warn':''}">${k.sub}</div>
        ${k.trend||''}
        ${k.sparkline?SMS._sparkline(_sparkData):''}
      </div>`).join('');
  },

  // ── Recent students panel ──
  _renderDashRecentStudents(d){
    const {students,classes} = d;
    // Alternate between brand and teal using CSS variables — theme-aware
    const clsPalette=['var(--brand)','var(--brand-teal)','var(--brand)','var(--brand-teal)','var(--brand)','var(--brand-teal)','var(--brand)','var(--brand-teal)'];
    const clsAlphaPalette=['var(--brand-lt)','var(--brand-teal-lt)','var(--brand-lt)','var(--brand-teal-lt)','var(--brand-lt)','var(--brand-teal-lt)','var(--brand-lt)','var(--brand-teal-lt)'];
    const recent=[...students].sort((a,b)=>new Date(b.admitDate||0)-new Date(a.admitDate||0)).slice(0,5);
    document.getElementById('dash-recent-students').innerHTML=recent.map(s=>{
      const ci=classes.findIndex(c=>c.id===s.classId);
      const col=clsPalette[ci%clsPalette.length]||'var(--brand)';
      const colLt=clsAlphaPalette[ci%clsAlphaPalette.length]||'var(--brand-lt)';
      return `<div class="mini-item" style="cursor:pointer" onclick="SMS.viewStudent('${s.id}')">
        <div class="mini-av" style="background:${colLt};color:${col}">${(s.fname||'?')[0]}${(s.lname||'?')[0]}</div>
        <div style="flex:1;min-width:0">
          <div class="mini-name">${sanitize(s.fname)} ${sanitize(s.lname)}</div>
          <div class="mini-sub"><span style="background:${colLt};color:${col};font-weight:700;font-size:.65rem;padding:.1rem .4rem;border-radius:4px">${sanitize(this.className(s.classId))}</span> · ${s.studentId}</div>
        </div>
        <div class="mini-right">${statusBadge(s.status)}</div>
      </div>`;
    }).join('')||'<div class="dash-empty-panel"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="28" height="28"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3.53 1.76 9.47 1.76 12 0v-5"/></svg><div>No students enrolled yet</div></div>';
  },

  // ── Upcoming Events panel ──
  _renderDashEvents(d){
    const {events,now,_todayStart} = d;
    const upcomingEv=[...events].filter(e=>new Date(e.start)>=_todayStart).sort((a,b)=>new Date(a.start)-new Date(b.start)).slice(0,4);
    // Use CSS variables for event type colours — theme-aware where possible; purple has no CSS var so kept literal
    const evColors={exam:'var(--brand)',academic:'var(--brand-teal)',sports:'var(--success)',holiday:'var(--warn)',meeting:'#7c3aed',cultural:'var(--danger)'};
    const evBg={exam:'var(--brand-lt)',academic:'var(--brand-teal-lt)',sports:'var(--success-bg)',holiday:'var(--warn-bg)',meeting:'rgba(124,58,237,.1)',cultural:'var(--danger-bg)'};
    const _evSvg={
      exam:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="14" height="14"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>',
      academic:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="14" height="14"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3.53 1.76 9.47 1.76 12 0v-5"/></svg>',
      sports:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="14" height="14"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4"/></svg>',
      holiday: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="14" height="14"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/></svg>',
      meeting: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="14" height="14"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
      cultural:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="14" height="14"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
    };
    const _evFallback='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="14" height="14"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>';
    document.getElementById('dash-events').innerHTML=upcomingEv.map(e=>{
      const col=evColors[e.type]||'var(--brand)';
      const bg=evBg[e.type]||'var(--brand-lt)';
      const daysLeft=Math.ceil((new Date(e.start)-_todayStart)/(1000*60*60*24));
      const daysStr=daysLeft===0?'Today':daysLeft===1?'Tomorrow':`In ${daysLeft}d`;
      return `<div class="mini-item" style="cursor:pointer" onclick="SMS.nav('events')">
        <div class="mini-av" style="background:${bg};color:${col}">${_evSvg[e.type]||_evFallback}</div>
        <div style="flex:1;min-width:0">
          <div class="mini-name">${sanitize(e.title)}</div>
          <div class="mini-sub">${fmtDate(e.start)}${e.venue?' · '+e.venue:''}</div>
        </div>
        <div class="mini-right"><span style="font-size:.68rem;font-weight:700;color:${col};background:${bg};padding:.2rem .5rem;border-radius:5px;white-space:nowrap">${daysStr}</span></div>
      </div>`;
    }).join('')||'<div class="dash-empty-panel"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="28" height="28"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg><div>No upcoming events</div></div>';
  },

  // ── Fee Defaulters panel ──
  _renderDashDefaulters(d){
    const {isFinance,defaulters} = d;
    const defPanel=document.getElementById('dash-defaulters-panel');
    if(defPanel) defPanel.style.display=isFinance?'':'none';
    if(!isFinance) return;
    const defBadge=document.getElementById('dash-defaulters-count');
    if(defBadge){ defBadge.textContent=defaulters.length; defBadge.style.display=defaulters.length>0?'inline-flex':'none'; }
    const defList=document.getElementById('dash-defaulters');
    if(!defList) return;
    defList.innerHTML=defaulters.slice(0,5).map(s=>{
      const owed=this._studentOwed(s,_academicYear);
      return `<div class="mini-item" style="cursor:pointer" onclick="SMS.nav('fees');SMS.openFeeModal('${s.id}')">
        <div class="mini-av" style="background:var(--danger-bg);color:var(--danger)">${(s.fname||'?')[0]}${(s.lname||'?')[0]}</div>
        <div style="flex:1;min-width:0">
          <div class="mini-name">${sanitize(s.fname)} ${sanitize(s.lname)}</div>
          <div class="mini-sub">${sanitize(this.className(s.classId))}</div>
        </div>
        <div class="mini-right" style="text-align:right">
          <div style="font-size:.78rem;font-weight:800;color:var(--danger)">${fmt(owed)}</div>
          <div style="font-size:.65rem;color:var(--t4);margin-top:.1rem">Outstanding balance</div>
        </div>
      </div>`;
    }).join('')||'<div class="dash-empty-panel dash-empty-ok"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="28" height="28"><polyline points="20 6 9 17 4 12"/></svg><div>All fees up to date</div></div>';
    if(defaulters.length>5){
      const extra=defaulters.length-5;
      defList.innerHTML+=`<div class="dash-panel-more" onclick="SMS.nav('fees')" title="View all defaulters in Fees module">+${extra} more defaulter${extra!==1?'s':''} — <span>View all</span></div>`;
    }
  },

  // ── Upcoming Exams panel ──
  _renderDashExams(d){
    const {exams,now,_todayStart} = d;
    const _parseExamDate=dt=>new Date(dt.includes('T')?dt:dt+'T00:00:00');
    const upcomingExams=[...exams].filter(e=>e.date&&_parseExamDate(e.date)>=_todayStart).sort((a,b)=>_parseExamDate(a.date)-_parseExamDate(b.date)).slice(0,5);
    const examEl=document.getElementById('dash-exams');
    if(!examEl) return;
    examEl.innerHTML=upcomingExams.map(e=>{
      const daysLeft=Math.ceil((_parseExamDate(e.date)-_todayStart)/(1000*60*60*24));
      const daysStr=daysLeft===0?'Today':daysLeft===1?'Tomorrow':`In ${daysLeft}d`;
      const urgColor=daysLeft<=2?'var(--danger)':daysLeft<=7?'var(--warn)':'var(--brand)';
      const urgBg=daysLeft<=2?'var(--danger-bg)':daysLeft<=7?'var(--warn-bg)':'var(--brand-lt)';
      return `<div class="mini-item" style="cursor:pointer" onclick="SMS.nav('exams')">
        <div class="mini-av" style="background:var(--brand-lt);color:var(--brand)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="14" height="14"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg></div>
        <div style="flex:1;min-width:0">
          <div class="mini-name">${sanitize(e.name)}</div>
          <div class="mini-sub">${sanitize(this.className(e.classId)||'All Classes')} · ${fmtDate(e.date)}</div>
        </div>
        <div class="mini-right"><span style="font-size:.68rem;font-weight:700;color:${urgColor};background:${urgBg};padding:.2rem .5rem;border-radius:5px;white-space:nowrap">${daysStr}</span></div>
      </div>`;
    }).join('')||'<div class="dash-empty-panel"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="28" height="28"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg><div>No upcoming exams</div></div>';
  },

  // ── Absent Today panel ──
  _renderDashAbsent(d){
    const {todayAtt,classes} = d;
    const absentEl=document.getElementById('dash-absent-today');
    const absentBadge=document.getElementById('dash-absent-count');
    if(!absentEl) return;
    const totalAbsent=todayAtt.reduce((s,a)=>s+(+a.absent||0),0);
    if(absentBadge){ absentBadge.textContent=totalAbsent; absentBadge.style.display=totalAbsent>0?'inline-flex':'none'; }
    if(todayAtt.length===0){
      absentEl.innerHTML='<div class="dash-empty-panel"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="28" height="28"><polyline points="20 6 9 17 4 12"/></svg><div>No attendance taken yet today</div></div>';
    } else if(totalAbsent===0){
      absentEl.innerHTML='<div class="dash-empty-panel dash-empty-ok"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="28" height="28"><polyline points="20 6 9 17 4 12"/></svg><div>No absences today — full house!</div></div>';
    } else {
      absentEl.innerHTML=todayAtt.filter(a=>+a.absent>0).map(a=>{
        const cls=classes.find(c=>c.id===a.classId);
        const lateStr=+a.late>0?` · ${a.late} late`:'';
        return `<div class="mini-item" style="cursor:pointer" onclick="SMS.nav('attendance')">
          <div class="mini-av" style="background:var(--danger-bg);color:var(--danger)">${a.absent}</div>
          <div style="flex:1;min-width:0">
            <div class="mini-name">${sanitize(cls?.name||'Unknown Class')}</div>
            <div class="mini-sub">${a.present} present${lateStr} · ${a.total} total</div>
          </div>
          <div class="mini-right"><span style="font-size:.68rem;font-weight:700;color:var(--danger);background:var(--danger-bg);padding:.2rem .5rem;border-radius:5px">absent</span></div>
        </div>`;
      }).join('');
    }
  },

  // ── Staff on Leave Today panel ──
  _renderDashOnLeave(d){
    const {isFinance,leaves,staff,now} = d;
    const onLeavePanel=document.getElementById('dash-on-leave-panel');
    if(onLeavePanel) onLeavePanel.style.display=isFinance?'':'none';
    if(!isFinance) return;
    const onLeaveEl=document.getElementById('dash-on-leave');
    const onLeaveBadge=document.getElementById('dash-on-leave-count');
    const onLeaveToday=leaves.filter(l=>{
      if(l.status!=='approved') return false;
      const from=new Date(l.from+'T00:00:00'), to=new Date(l.to+'T23:59:59');
      return now>=from&&now<=to;
    });
    if(onLeaveBadge){ onLeaveBadge.textContent=onLeaveToday.length; onLeaveBadge.style.display=onLeaveToday.length>0?'inline-flex':'none'; }
    if(!onLeaveEl) return;
    if(onLeaveToday.length===0){
      onLeaveEl.innerHTML='<div class="dash-empty-panel dash-empty-ok"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="28" height="28"><polyline points="20 6 9 17 4 12"/></svg><div>All staff present today</div></div>';
      return;
    }
    // Leave type colours using CSS variables where available (purple has no var)
    const leaveColors={Annual:'var(--brand-teal)',Sick:'var(--danger)',Maternity:'#7c3aed',Paternity:'var(--brand)',Emergency:'var(--warn)',Casual:'var(--success)'};
    const leaveBg={Annual:'var(--brand-teal-lt)',Sick:'var(--danger-bg)',Maternity:'rgba(124,58,237,.1)',Paternity:'var(--brand-lt)',Emergency:'var(--warn-bg)',Casual:'var(--success-bg)'};
    onLeaveEl.innerHTML=onLeaveToday.map(l=>{
      const s=staff.find(x=>x.id===l.staffId);
      const col=leaveColors[l.type]||'var(--brand)';
      const bg=leaveBg[l.type]||'var(--brand-lt)';
      const toDate=new Date(l.to+'T00:00:00');
      const daysLeft=Math.ceil((toDate-now)/(1000*60*60*24))+1;
      const _returnDate=new Date(toDate); _returnDate.setDate(_returnDate.getDate()+1);
      const _returnStr=_returnDate.toISOString().split('T')[0];
      return `<div class="mini-item" style="cursor:pointer" onclick="SMS.nav('leave')">
        <div class="mini-av" style="background:${bg};color:${col}">${(s?.fname||'?')[0]}${(s?.lname||'?')[0]}</div>
        <div style="flex:1;min-width:0">
          <div class="mini-name">${sanitize(s?.fname||'Unknown')} ${sanitize(s?.lname||'')}</div>
          <div class="mini-sub">${sanitize(l.type)} leave · back ${daysLeft<=1?'tomorrow':fmtDate(_returnStr)}</div>
        </div>
        <div class="mini-right"><span style="font-size:.68rem;font-weight:700;color:${col};background:${bg};padding:.2rem .5rem;border-radius:5px;white-space:nowrap">${daysLeft}d left</span></div>
      </div>`;
    }).join('');
  },

  // ── Dismissible alert banners ──
  // ── Getting Started guide (shows only for fresh/empty schools) ──
  _renderDashGettingStarted(d){
    const el=document.getElementById('dash-getting-started');
    if(!el) return;
    const {students,classes,isAdmin}=d;
    const isEmpty=students.length===0&&classes.length===0;
    el.style.display=(isEmpty&&isAdmin)?'':'none';
  },




  renderDashCharts(students,classes,payments,attRecords,role='admin'){
    if(typeof Chart==='undefined') return; // Chart.js not loaded yet (offline/CDN fail) — skip silently
    const isFinance=(role==='admin'||role==='accountant');
    // Hide fee collection chart panel for non-finance roles
    const feeChartCard=document.getElementById('dash-fee-chart-card');
    if(feeChartCard) feeChartCard.style.display=isFinance?'':'none';
    const isDark=document.documentElement.getAttribute('data-theme')==='dark';
    const gridColor=isDark?'rgba(255,255,255,0.05)':'rgba(0,0,0,0.04)';
    const tickColor=isDark?'#64748b':'#94a3b8';
    const emptyBarColor=isDark?'rgba(255,255,255,0.05)':'rgba(0,0,0,0.05)';

    // Shared plugin defaults
    Chart.defaults.font.family="'Inter','DM Sans',system-ui,sans-serif";

    // ── Fee Collection — gradient area line chart ──
    const ctx2=document.getElementById('chart-fees');
    if(ctx2){ if(this._charts.fees) this._charts.fees.destroy();
      const now2=new Date();
      const feeKeys=[],feeAxisLabels=[],feeTooltipLabels=[],feeData=[];
      for(let i=5;i>=0;i--){
        const d=new Date(now2.getFullYear(),now2.getMonth()-i,1);
        feeKeys.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`);
        feeAxisLabels.push(d.toLocaleString('default',{month:'short'}));            // "Oct" "Nov" etc
        feeTooltipLabels.push(d.toLocaleString('default',{month:'long',year:'numeric'})); // "October 2025"
        feeData.push(0);
      }
      payments.forEach(p=>{ if(!p.date) return; const k=p.date.substring(0,7); const idx=feeKeys.indexOf(k); if(idx>-1) feeData[idx]+=(+p.amount||0); });
      const hasAnyFee=feeData.some(v=>v>0);
      const sym=_currency==='NGN'?'₦':_currency==='KES'?'KSh':_currency==='USD'?'$':_currency==='GBP'?'£':_currency==='ZAR'?'R':_currency==='EUR'?'€':'₵';
      const tealLine=isDark?'#2dd4bf':'#0d9488';
      const grad2=ctx2.getContext('2d').createLinearGradient(0,0,0,220);
      grad2.addColorStop(0,isDark?'rgba(45,212,191,0.22)':'rgba(13,148,136,0.18)');
      grad2.addColorStop(1,'rgba(0,0,0,0)');
      const totalCollected=feeData.reduce((a,b)=>a+b,0);
      const feeStatEl=document.getElementById('dash-fee-total-stat');
      if(feeStatEl) feeStatEl.textContent=hasAnyFee?fmt(totalCollected):'—';
      this._charts.fees=new Chart(ctx2,{
        type:'line',
        data:{labels:feeAxisLabels,datasets:[{
          data:feeData, borderColor:tealLine, backgroundColor:grad2,
          borderWidth:2.5, tension:0.42, fill:true,
          pointBackgroundColor:tealLine, pointBorderColor:isDark?'#1e293b':'#fff',
          pointBorderWidth:2, pointRadius:5, pointHoverRadius:7,
          pointHoverBackgroundColor:tealLine, pointHoverBorderWidth:2.5,
        }]},
        options:{
          responsive:true, maintainAspectRatio:false,
          animation:{duration:700,easing:'easeInOutQuart'},
          interaction:{mode:'index',intersect:false},
          plugins:{
            legend:{display:false},
            tooltip:{
              backgroundColor:isDark?'#1e293b':'#0f172a',
              titleColor:'#94a3b8', bodyColor:'#fff',
              borderColor:isDark?'#2d3f55':'#1e293b', borderWidth:1,
              padding:{top:10,bottom:10,left:14,right:14}, cornerRadius:10,
              titleFont:{size:11,weight:'500'}, bodyFont:{size:13,weight:'700'},
              callbacks:{
                label:ctx=>`  ${sym}${ctx.parsed.y.toLocaleString('en',{minimumFractionDigits:2,maximumFractionDigits:2})}`,
                title:items=>`${feeTooltipLabels[items[0].dataIndex]}  •  Fee Collection`,
              }
            }
          },
          scales:{
            y:{
              beginAtZero:true, grid:{color:gridColor,drawBorder:false},
              border:{display:false},
              ticks:{callback:v=>sym+(v>=1000?(v/1000).toFixed(v%1000?1:0)+'k':v),color:tickColor,font:{size:11},maxTicksLimit:5},
            },
            x:{grid:{display:false},border:{display:false},ticks:{color:tickColor,font:{size:11}}},
          },
        }
      });
      const sub=document.getElementById('dash-fee-sub');
      if(sub) sub.textContent=hasAnyFee?'Last 6 months':'No payments recorded yet';
    }

    // ── Enrollment by Class — horizontal bar ──
    const ctx1=document.getElementById('chart-enrollment');
    if(ctx1){ if(this._charts.enrollment) this._charts.enrollment.destroy();
      const labels=classes.map(c=>c.name);
      const data=classes.map(c=>students.filter(s=>s.classId===c.id&&s.status==='active').length);
      const total=data.reduce((a,b)=>a+b,0);
      const enrollStatEl=document.getElementById('dash-enroll-total-stat');
      if(enrollStatEl) enrollStatEl.textContent=total||'—';
      const _enrBox=ctx1.closest('.dash-chart-box-sm'); if(_enrBox){ let _enrEmp=_enrBox.querySelector('.dash-chart-empty'); if(!_enrEmp){ _enrEmp=document.createElement('div'); _enrEmp.className='dash-chart-empty'; _enrBox.style.position='relative'; _enrBox.appendChild(_enrEmp); } _enrEmp.style.display=labels.length===0?'flex':'none'; _enrEmp.innerHTML=labels.length===0?'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="26" height="26" style="opacity:.3"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3.33 1.67 6.67 1.67 10 0v-5"/></svg><span>No classes added yet</span>':''; }
      const barColor=isDark?'rgba(59,130,246,0.75)':'rgba(5,41,95,0.8)';
      const barHover=isDark?'rgba(93,158,255,0.9)':'rgba(5,41,95,1)';
      this._charts.enrollment=new Chart(ctx1,{
        type:'bar',
        data:{labels,datasets:[{data,backgroundColor:barColor,hoverBackgroundColor:barHover,borderRadius:6,borderSkipped:false}]},
        options:{
          responsive:true, maintainAspectRatio:false,
          animation:{duration:600,easing:'easeInOutQuart'},
          interaction:{mode:'index',intersect:false},
          plugins:{
            legend:{display:false},
            tooltip:{
              backgroundColor:isDark?'#1e293b':'#0f172a',
              titleColor:'#94a3b8', bodyColor:'#fff',
              borderColor:isDark?'#2d3f55':'#1e293b', borderWidth:1,
              padding:{top:9,bottom:9,left:13,right:13}, cornerRadius:10,
              titleFont:{size:11,weight:'500'}, bodyFont:{size:13,weight:'700'},
              callbacks:{
                label:ctx=>`  ${ctx.parsed.y} student${ctx.parsed.y!==1?'s':''}`,
                title:items=>`${items[0].label}`,
              }
            }
          },
          scales:{
            y:{beginAtZero:true,grid:{color:gridColor,drawBorder:false},border:{display:false},ticks:{stepSize:1,color:tickColor,font:{size:11}}},
            x:{grid:{display:false},border:{display:false},ticks:{color:tickColor,font:{size:11},maxRotation:20,minRotation:0}},
          },
        }
      });
    }

    // ── Attendance — Mon–Fri school week, future days dimmed, headcount format ──
    const ctx3=document.getElementById('chart-attendance');
    if(ctx3){ if(this._charts.att) this._charts.att.destroy();
      const recs=attRecords||DB.get('attendance',[]);
      const _today=new Date();
      const _dow=_today.getDay(); // 0=Sun,1=Mon,...,6=Sat
      // Find Monday of current week; if weekend show last completed week
      const _monday=new Date(_today);
      if(_dow===0)      _monday.setDate(_today.getDate()-6);   // Sun → last Mon
      else if(_dow===6) _monday.setDate(_today.getDate()-5);   // Sat → last Mon
      else              _monday.setDate(_today.getDate()-(_dow-1)); // Mon–Fri → this Mon
      const attAxisLabels=[],attTooltipLabels=[],attData=[],attTotals=[],attColors=[],attHover=[];
      for(let i=0;i<5;i++){
        const d=new Date(_monday); d.setDate(_monday.getDate()+i);
        const key=localDateStr(d);
        const isFuture=d>_today;
        const isToday=key===localDateStr(_today);
        attAxisLabels.push(d.toLocaleString('default',{weekday:'short'}));
        attTooltipLabels.push(d.toLocaleString('default',{weekday:'long',day:'numeric',month:'short'}));
        const dayRecs=recs.filter(a=>a.date===key);
        if(isFuture){
          attData.push(0); attTotals.push(0);
          attColors.push(isDark?'rgba(255,255,255,0.04)':'rgba(0,0,0,0.04)');
          attHover.push(isDark?'rgba(255,255,255,0.04)':'rgba(0,0,0,0.04)');
        } else if(dayRecs.length>0){
          const dayPresent=dayRecs.reduce((s,a)=>s+(+a.present||0),0);
          const dayTotal=dayRecs.reduce((s,a)=>s+(+a.total||0),0);
          const rate=dayTotal>0?Math.round(dayPresent/dayTotal*100):0;
          attData.push(dayPresent);
          attTotals.push(dayTotal);
          const alpha=isToday?1:0.82;
          if(isDark){
            attColors.push(rate>=90?`rgba(45,212,191,${alpha})`:rate>=75?`rgba(251,191,36,${alpha})`:`rgba(252,129,129,${alpha})`);
            attHover.push(rate>=90?'rgba(45,212,191,1)':rate>=75?'rgba(251,191,36,1)':'rgba(252,129,129,1)');
          } else {
            attColors.push(rate>=90?`rgba(13,148,136,${alpha})`:rate>=75?`rgba(217,119,6,${alpha})`:`rgba(224,82,82,${alpha===1?0.95:0.78})`);
            attHover.push(rate>=90?'rgba(13,148,136,1)':rate>=75?'rgba(217,119,6,1)':'rgba(224,82,82,1)');
          }
        } else {
          attData.push(0); attTotals.push(0);
          attColors.push(isDark?'rgba(255,255,255,0.06)':'rgba(0,0,0,0.06)');
          attHover.push(isDark?'rgba(255,255,255,0.1)':'rgba(0,0,0,0.1)');
        }
      }
      // Avg stat: total present / total possible this week (headcount)
      const weekTotalPresent=attData.reduce((s,v,i)=>{ const d=new Date(_monday); d.setDate(_monday.getDate()+i); return (v>0&&d<=_today)?s+v:s; },0);
      const weekTotalPossible=attTotals.reduce((s,v,i)=>{ const d=new Date(_monday); d.setDate(_monday.getDate()+i); return (v>0&&d<=_today)?s+v:s; },0);
      const avgRate=weekTotalPossible>0?Math.round(weekTotalPresent/weekTotalPossible*100):null;
      const attAvgEl=document.getElementById('dash-att-avg-stat');
      if(attAvgEl) attAvgEl.textContent=avgRate!==null?`${avgRate}%`:'—';
      const _attBox=ctx3.closest('.dash-chart-box-sm'); if(_attBox){ let _attEmp=_attBox.querySelector('.dash-chart-empty'); if(!_attEmp){ _attEmp=document.createElement('div'); _attEmp.className='dash-chart-empty'; _attBox.style.position='relative'; _attBox.appendChild(_attEmp); } const _noAtt=weekTotalPossible===0; _attEmp.style.display=_noAtt?'flex':'none'; _attEmp.innerHTML=_noAtt?'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="26" height="26" style="opacity:.3"><polyline points="20 6 9 17 4 12"/></svg><span>No attendance this week</span>':''; }
      const isLastWeek=(_dow===0||_dow===6);
      const maxTotal=Math.max(...attTotals,1);
      this._charts.att=new Chart(ctx3,{
        type:'bar',
        data:{labels:attAxisLabels,datasets:[{
          data:attData, backgroundColor:attColors, hoverBackgroundColor:attHover,
          borderRadius:6, borderSkipped:false,
        }]},
        options:{
          responsive:true, maintainAspectRatio:false,
          animation:{duration:600,easing:'easeInOutQuart'},
          interaction:{mode:'index',intersect:false},
          plugins:{
            legend:{display:false},
            tooltip:{
              backgroundColor:isDark?'#1e293b':'#0f172a',
              titleColor:'#94a3b8', bodyColor:'#fff',
              borderColor:isDark?'#2d3f55':'#1e293b', borderWidth:1,
              padding:{top:9,bottom:9,left:13,right:13}, cornerRadius:10,
              titleFont:{size:11,weight:'500'}, bodyFont:{size:13,weight:'700'},
              callbacks:{
                label:(ctx)=>{
                  const d=new Date(_monday); d.setDate(_monday.getDate()+ctx.dataIndex);
                  if(d>_today) return '  No school yet';
                  const tot=attTotals[ctx.dataIndex];
                  if(!ctx.parsed.y&&!tot) return '  Not recorded';
                  const r=tot>0?Math.round(ctx.parsed.y/tot*100):0;
                  return `  ${ctx.parsed.y}/${tot} present · ${r}%`;
                },
                title:items=>`${attTooltipLabels[items[0].dataIndex]}`,
              }
            }
          },
          scales:{
            y:{min:0,suggestedMax:maxTotal,grid:{color:gridColor,drawBorder:false},border:{display:false},ticks:{stepSize:1,color:tickColor,font:{size:11},maxTicksLimit:5}},
            x:{grid:{display:false},border:{display:false},ticks:{color:tickColor,font:{size:11,weight:'600'}}},
          },
        }
      });
      const sub3=document.getElementById('dash-att-sub');
      if(sub3) sub3.textContent=isLastWeek?'Last school week (Mon–Fri)':'This week (Mon–Fri)';
    }
  },

  // ══ STUDENTS ══
});