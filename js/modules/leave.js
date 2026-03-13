// ══════════════════════════════════════════
//  EDUFORMIUM SMS — Leave — loadLeave · renderLeave
// ══════════════════════════════════════════

Object.assign(SMS, {
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
});
