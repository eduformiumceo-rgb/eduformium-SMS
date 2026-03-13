// ══════════════════════════════════════════
//  EDUFORMIUM SMS — Messages — loadMessages · renderMessages · compose · send
// ══════════════════════════════════════════

Object.assign(SMS, {
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
        <div class="msg-item-subj">${sanitize(m.subject)}</div>
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
        <div class="msg-full-subject">${sanitize(m.subject)}</div>
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
});
