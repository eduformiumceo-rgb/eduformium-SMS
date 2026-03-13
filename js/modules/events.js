// ══════════════════════════════════════════
//  EDUFORMIUM SMS — Events & Calendar
//  loadEvents · renderCalendar · renderEventsList · saveEvent · deleteEvent
// ══════════════════════════════════════════

Object.assign(SMS, {
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
    const isDark=document.documentElement.dataset.theme==='dark';
    const colors=isDark
      ?{exam:'#93c5fd',academic:'#2dd4bf',sports:'#4ade80',holiday:'#fbbf24',meeting:'#c4b5fd',cultural:'#f87171'}
      :{exam:'#1a3a6b',academic:'#0d9488',sports:'#16a34a',holiday:'#d97706',meeting:'#7c3aed',cultural:'#dc2626'};
    document.getElementById('events-list').innerHTML=events.map(e=>`
      <div class="event-item">
        <div class="event-dot" style="background:${colors[e.type]||'#999'}"></div>
        <div>
          <div class="event-title">${sanitize(e.title)}</div>
          <div class="event-meta">${fmtDate(e.start)}${e.end?` — ${fmtDate(e.end)}`:''}${e.venue?' · '+sanitize(e.venue):''}</div>
          ${e.desc?`<div style="font-size:.75rem;color:var(--t3);margin-top:.25rem">${sanitize(e.desc)}</div>`:''}
        </div>
        <button class="btn btn-ghost btn-sm admin-only" onclick="SMS.confirmDelete('Delete event ${sanitize(e.title)}?',()=>SMS.deleteEvent('${e.id}'))" style="color:var(--danger);padding:.3rem .5rem;margin-left:auto"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg></button>
      </div>`).join('')||'<div style="padding:2rem;text-align:center;font-size:.82rem;color:var(--t4)">No events scheduled</div>';
  },

  openEventModal(){ ['ev-title','ev-start','ev-end','ev-time','ev-venue','ev-desc'].forEach(id=>{ const e=document.getElementById(id); if(e) e.value=''; }); document.getElementById('ev-type').value='academic'; this.openModal('m-event'); },

  saveEvent(){
    if(!this.hasRole('admin')){ this.toast('You do not have permission to perform this action','error'); return; }
    const title=document.getElementById('ev-title').value.trim(); const start=document.getElementById('ev-start').value;
    if(!title||!start){ this.toast('Title and start date required','error'); return; }
    const events=DB.get('events',[]); events.push({id:uid('ev'),title,type:document.getElementById('ev-type').value,start,end:document.getElementById('ev-end').value,time:document.getElementById('ev-time').value,venue:document.getElementById('ev-venue').value,desc:document.getElementById('ev-desc').value});
    DB.set('events',events); this.audit('Add Event','create',`New event: ${title}`); this.toast('Event added','success'); this.closeModal('m-event'); this.renderCalendar(); this.renderEventsList();
  },

  deleteEvent(id){
    if(!this.hasRole('admin')){ this.toast('You do not have permission to perform this action','error'); return; } DB.set('events',DB.get('events',[]).filter(x=>x.id!==id)); const _sid=window.SMS&&window.SMS.schoolId; if(_sid&&window.FDB) FDB.delete(_sid,'events',id).catch(()=>{}); this.toast('Event deleted','warn'); this.renderCalendar(); this.renderEventsList(); },

  // ══ REPORTS ══

});
