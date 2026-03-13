// ══════════════════════════════════════════
//  EDUFORMIUM SMS — Notifications & Global Search
// ══════════════════════════════════════════

Object.assign(SMS, {
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
  // Dismissed notification IDs are stored in localStorage so they survive page refreshes
  _getReadIds(){ try{ return new Set(JSON.parse(localStorage.getItem('sms_readNotifIds')||'[]')); }catch{ return new Set(); } },
  _saveReadIds(set){ try{ localStorage.setItem('sms_readNotifIds',JSON.stringify([...set])); }catch{} },

  loadNotifications(){
    const readIds=this._getReadIds();
    const log=DB.get('auditLog',[]);
    const list=document.getElementById('notif-list');
    const badge=document.getElementById('notif-badge');
    if(!list||!badge) return;

    // Actions that should NEVER appear in the notification bell
    const HIDDEN_ACTIONS=new Set(['Login','Logout']);

    const pageMap={
      'Enroll Student':'students','Edit Student':'students','Delete Student':'students','Student Promotion':'students','Bulk Import':'students',
      'Add Staff':'staff','Edit Staff':'staff','Delete Staff':'staff',
      'Fee Payment':'fees','Fee Reversal':'fees','Fee Reminder':'fees',
      'Payroll':'payroll','Payroll Export':'payroll',
      'Attendance':'attendance',
      'Grades Entry':'exams','Create Exam':'exams',
      'Add Event':'events',
      'Add Class':'classes','Edit Class':'classes','Add Subject':'classes',
      'Send Message':'messages',
      'Leave':'leave',
      'Add Expense':'expenses','Edit Expense':'expenses',
      'Backup':'settings','Add User':'settings','Delete User':'settings',
      'Add Book':'library','Edit Book':'library',
      'Add Homework':'homework','Edit Homework':'homework','Delete Homework':'homework',
    };

    const iconSvg={
      create:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" width="15" height="15"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`,
      edit:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" width="15" height="15"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`,
      delete:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" width="15" height="15"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>`,
      settings:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" width="15" height="15"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`,
    };
    const iconColors={create:'#16a34a',edit:'#2563eb',delete:'#dc2626',settings:'#7c3aed',default:'#0d9488'};
    const iconBg={create:'rgba(22,163,74,.1)',edit:'rgba(37,99,235,.1)',delete:'rgba(220,38,38,.1)',settings:'rgba(124,58,237,.1)',default:'rgba(13,148,136,.1)'};

    function timeAgo(t){
      const s=Math.floor((Date.now()-new Date(t))/1000);
      if(s<60) return 'just now';
      if(s<3600) return Math.floor(s/60)+'m ago';
      if(s<86400) return Math.floor(s/3600)+'h ago';
      if(s<7*86400) return Math.floor(s/86400)+'d ago';
      return new Date(t).toLocaleDateString('en-GB',{day:'numeric',month:'short'});
    }

    // Filter: exclude hidden actions + dismissed, take 20
    const eligible=[...log].reverse().filter(l=>!HIDDEN_ACTIONS.has(l.action));
    const visible=eligible.filter(l=>!readIds.has(l.id)).slice(0,20);
    const unreadCount=visible.filter(l=>Date.now()-new Date(l.time)<7*86400000).length;

    if(visible.length===0){
      list.innerHTML=`<div class="notif-empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" width="36" height="36"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
        <div class="notif-empty-title">All caught up!</div>
        <div class="notif-empty-sub">No new notifications right now.</div>
      </div>`;
      badge.style.display='none'; return;
    }

    list.innerHTML=visible.map(l=>{
      const page=pageMap[l.action]||'dashboard';
      const type=l.type||'default';
      const svg=iconSvg[type]||iconSvg.create;
      const color=iconColors[type]||iconColors.default;
      const bg=iconBg[type]||iconBg.default;
      const isNew=!readIds.has(l.id)&&Date.now()-new Date(l.time)<7*86400000;
      return `<div class="notif-item${isNew?' notif-item-unread':''}" id="ni-${l.id}" onclick="SMS.clickNotif('${l.id}','${page}')">
        ${isNew?'<span class="notif-unread-dot"></span>':''}
        <div class="notif-icon" style="background:${bg};color:${color}">${svg}</div>
        <div class="notif-body">
          <div class="notif-action">${sanitize(l.action)}</div>
          <div class="notif-detail">${sanitize(l.details||'')}</div>
          <div class="notif-meta">${timeAgo(l.time)}<span class="notif-dot">·</span>${sanitize(l.user)}</div>
        </div>
        <button class="notif-dismiss" onclick="event.stopPropagation();SMS.clickNotif('${l.id}',null)" title="Dismiss">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" width="11" height="11"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>`;
    }).join('');

    badge.style.display=unreadCount>0?'flex':'none';
    badge.textContent=unreadCount>9?'9+':unreadCount;
  },

  clickNotif(id, page){
    const readIds=this._getReadIds();
    readIds.add(id);
    this._saveReadIds(readIds);
    const el=document.getElementById('ni-'+id);
    if(el){
      el.style.transition='opacity .15s, transform .15s';
      el.style.opacity='0'; el.style.transform='translateX(16px)';
      setTimeout(()=>{ el.remove(); this._refreshNotifBadge(); },160);
    }
    if(page){ this.nav(page); document.getElementById('notif-panel').style.display='none'; }
    else { this._refreshNotifBadge(); }
  },

  clearAllNotifs(){
    const log=DB.get('auditLog',[]);
    const readIds=this._getReadIds();
    log.forEach(l=>readIds.add(l.id));
    this._saveReadIds(readIds);
    const list=document.getElementById('notif-list');
    if(list) list.innerHTML=`<div class="notif-empty-state">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" width="36" height="36"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
      <div class="notif-empty-title">All caught up!</div>
      <div class="notif-empty-sub">No new notifications right now.</div>
    </div>`;
    const badge=document.getElementById('notif-badge');
    if(badge) badge.style.display='none';
    document.getElementById('notif-panel').style.display='none';
  },

  _refreshNotifBadge(){
    const readIds=this._getReadIds();
    const log=DB.get('auditLog',[]);
    const HIDDEN_ACTIONS=new Set(['Login','Logout']);
    const unread=[...log].reverse()
      .filter(l=>!HIDDEN_ACTIONS.has(l.action)&&!readIds.has(l.id)&&Date.now()-new Date(l.time)<7*86400000).length;
    const badge=document.getElementById('notif-badge');
    if(!badge) return;
    badge.style.display=unread>0?'flex':'none';
    badge.textContent=unread>9?'9+':unread;
    const list=document.getElementById('notif-list');
    if(list&&!list.querySelector('.notif-item')){
      list.innerHTML=`<div class="notif-empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" width="36" height="36"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
        <div class="notif-empty-title">All caught up!</div>
        <div class="notif-empty-sub">No new notifications right now.</div>
      </div>`;
    }
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


});
