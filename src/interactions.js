export const PlanningInteractions={
  _installInteractions(){
    const root=this.shadowRoot;
    root.addEventListener('cancel',e=>{e.preventDefault();if(!this._busy)this._closeOverlay();},true);
    root.addEventListener('pointerdown',e=>this._pointerDown(e));
    root.addEventListener('pointermove',e=>this._pointerMove(e));
    root.addEventListener('pointerup',e=>this._pointerEnd(e));
    root.addEventListener('pointercancel',()=>this._clearPointer());
    root.addEventListener('lostpointercapture',e=>{const p=this._pointer;if(p?.active && e.target===p.source && !p.source.hasPointerCapture(p.id))this._clearPointer();});
    root.addEventListener('dragstart',e=>{
      if(this._pointer?.active){e.preventDefault();e.stopPropagation();return;}
      const el=e.target.closest('[data-event]'),item=this._events.find(x=>x.key===el?.dataset.event);
      if(!item?.uid || this._busy){e.preventDefault();return;}
      e.stopPropagation();this._dragKey=item.key;e.dataTransfer.setData('text/plain',item.key);e.dataTransfer.effectAllowed='move';
    });
    root.addEventListener('dragover',e=>{if(!this._dragKey)return;const drop=this._dropAt(e.clientX,e.clientY);if(drop){e.preventDefault();e.stopPropagation();e.dataTransfer.dropEffect='move';this._highlightDrop(drop);}});
    root.addEventListener('dragend',()=>{this._dragKey=null;this._highlightDrop(null);});
    root.addEventListener('drop',e=>{if(!this._dragKey)return;e.preventDefault();e.stopPropagation();const item=this._events.find(x=>x.key===this._dragKey),drop=this._dropAt(e.clientX,e.clientY);this._dragKey=null;this._highlightDrop(null);if(item && drop)this._move(item,drop.day,drop.minute);});
  },
  _dropAt(x,y){
    if(this._draft || this._settings || this._deviceDraft)return null;
    const target=this.shadowRoot.elementFromPoint(x,y)?.closest('[data-drop]');if(!target)return null;
    // elementFromPoint can find an element behind its scroll container in some browsers.
    const clip=target.closest('.week-scroll') || this.shadowRoot.querySelector('ha-card'),bounds=clip.getBoundingClientRect();
    if(x<bounds.left || x>bounds.right || y<bounds.top || y>bounds.bottom)return null;
    let minute;if(target.classList.contains('week-day'))minute=Math.max(0,Math.min(1430,Math.round((y-target.getBoundingClientRect().top)/this._weekHourHeight*6)*10));
    return {element:target,day:target.dataset.drop,minute};
  },
  _highlightDrop(drop){this.shadowRoot.querySelectorAll('.drop-over').forEach(x=>x.classList.remove('drop-over'));drop?.element.classList.add('drop-over');},
  _pointerDown(e){
    this._suppressEventClickUntil=0;
    const el=e.target.closest('[data-event]');if(!el || this._busy || e.button!==0 || !e.isPrimary)return;
    const handle=!!e.target.closest('[data-move-handle]');if(e.pointerType!=='mouse' && !handle)return;
    const item=this._events.find(x=>x.key===el.dataset.event);if(!item?.uid)return;
    e.stopPropagation();if(handle)e.preventDefault();
    this._pointer={id:e.pointerId,key:item.key,item,source:el,x:e.clientX,y:e.clientY,lastX:e.clientX,lastY:e.clientY,active:false};
  },
  _pointerMove(e){
    const p=this._pointer;if(!p || p.id!==e.pointerId)return;p.lastX=e.clientX;p.lastY=e.clientY;
    if(!p.active && Math.hypot(e.clientX-p.x,e.clientY-p.y)<7)return;
    e.preventDefault();e.stopPropagation();
    if(!p.active){
      p.active=true;p.source.setPointerCapture(e.pointerId);p.source.classList.add('drag-source');
      const ghost=document.createElement('div');ghost.className='planning-drag-preview';ghost.textContent=p.item.summary;
      Object.assign(ghost.style,{position:'fixed',zIndex:'2147483647',pointerEvents:'none',padding:'10px 14px',borderRadius:'8px',background:'#172b3d',color:'#fff',boxShadow:'0 6px 30px #0008',font:'14px Arial,sans-serif',maxWidth:'280px'});document.body.append(ghost);p.ghost=ghost;
      p.abort=new AbortController();document.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();this._clearPointer();}},{capture:true,signal:p.abort.signal});
      const tick=()=>{if(this._pointer!==p || !p.active)return;this._dragScroll(p);this._updatePointerDrop(p);p.frame=requestAnimationFrame(tick);};p.frame=requestAnimationFrame(tick);
    }
    this._updatePointerDrop(p);
  },
  _updatePointerDrop(p){
    p.drop=this._dropAt(p.lastX,p.lastY);this._highlightDrop(p.drop);
    if(p.ghost){p.ghost.style.left=`${Math.max(4,Math.min(innerWidth-285,p.lastX+14))}px`;p.ghost.style.top=`${Math.max(4,Math.min(innerHeight-70,p.lastY+14))}px`;p.ghost.textContent=`${p.item.summary} · ${p.drop?this._label(p.drop.day)+(p.drop.minute===undefined?'':` ${String(Math.floor(p.drop.minute/60)).padStart(2,'0')}:${String(p.drop.minute%60).padStart(2,'0')}`):this._t('Choisir une date')}`;}
  },
  _dragScroll(p){
    const near=this.shadowRoot.elementFromPoint(p.lastX,p.lastY),box=near?.closest('.week-scroll') || this.shadowRoot.querySelector('ha-card');
    if(!box)return;const r=box.getBoundingClientRect(),edge=38;
    if(p.lastX>=r.left && p.lastX<=r.right){if(p.lastY<Math.max(0,r.top)+edge)box.scrollTop-=9;else if(p.lastY>Math.min(innerHeight,r.bottom)-edge)box.scrollTop+=9;}
    if(box.classList.contains('week-scroll')){if(p.lastX<r.left+edge)box.scrollLeft-=9;else if(p.lastX>r.right-edge)box.scrollLeft+=9;}
  },
  _pointerEnd(e){
    const p=this._pointer;if(!p || e.pointerId!==p.id)return;
    if(!p.active){this._clearPointer();return;}
    e.preventDefault();e.stopPropagation();this._updatePointerDrop(p);const {item,drop}=p;this._suppressEventClickUntil=performance.now()+400;this._clearPointer();
    if(drop)this._move(item,drop.day,drop.minute);
  },
  _clearPointer(){
    const p=this._pointer;this._pointer=null;if(!p)return;cancelAnimationFrame(p.frame);p.abort?.abort();p.ghost?.remove();p.source.classList.remove('drag-source');
    if(p.source.hasPointerCapture?.(p.id))p.source.releasePointerCapture(p.id);this._highlightDrop(null);
  },
  _rememberDialog(){
    const dialog=this.shadowRoot.querySelector('dialog[open]'),active=this.shadowRoot.activeElement;
    if(!dialog)return null;let selector='';
    if(active?.name)selector=`[name="${CSS.escape(active.name)}"]`;
    else if(active?.dataset.deviceField)selector=`[data-device-field="${CSS.escape(active.dataset.deviceField)}"]`;
    else if(active?.closest('.action-row')){const row=active.closest('.action-row');selector=`[data-phase="${row.dataset.phase}"][data-index="${row.dataset.index}"] [${active.hasAttribute('data-target')?'data-target':'data-operation'}]`;}
    else if(active?.dataset.action)selector=`[data-action="${CSS.escape(active.dataset.action)}"]`;
    return {scroll:dialog.scrollTop,selector,start:active?.selectionStart,end:active?.selectionEnd};
  },
  _restoreDialog(state){
    const dialog=this.shadowRoot.querySelector('dialog');
    if(dialog && this.isConnected){
      dialog.showModal();dialog.addEventListener('click',e=>{if(e.target!==dialog || this._busy)return;const r=dialog.getBoundingClientRect();if(e.clientX<r.left || e.clientX>r.right || e.clientY<r.top || e.clientY>r.bottom)this._closeOverlay();});
      const focus=state?.selector?dialog.querySelector(state.selector):null;
      (focus || dialog.querySelector('h2'))?.focus({preventScroll:true});
      if(focus && typeof state.start==='number' && ['INPUT','TEXTAREA'].includes(focus.tagName)){try{focus.setSelectionRange(state.start,state.end);}catch{/* Select/date/color inputs have no text selection. */}}
      dialog.scrollTop=state?.scroll || 0;
    }
    if(!dialog && state)this.shadowRoot.querySelector('[data-action=new]')?.focus({preventScroll:true});
    this._showToast();
  },
  _closeOverlay(){if(this._busy)return;this._draft=null;this._settings=false;this._deviceDraft=null;this._error='';this._render();},
  _showToast(){
    const toast=this.shadowRoot.querySelector('.planning-toast');if(!toast)return;
    if(toast.showPopover)toast.showPopover();clearTimeout(this._toastTimer);
    this._toastTimer=setTimeout(()=>{if(this._error)return;toast.remove();},6000);
  },
};
export const INTERACTION_STYLE=`
dialog.planning-dialog{position:fixed;inset:0;margin:auto;width:min(760px,calc(100vw - 32px));max-width:none;max-height:calc(100dvh - 32px);overflow:auto;padding:0;background:var(--ha-card-background,var(--card-background-color,#202226));color:var(--primary-text-color,#e7eaef);border:1px solid var(--divider-color,#41474e);border-radius:16px;box-shadow:0 24px 90px #0008;overscroll-behavior:contain;--accent:var(--primary-color,#31b8de)}dialog.planning-dialog::backdrop{background:#0009}dialog .dialog-body{padding:20px}dialog form,dialog .panel{margin:0;border:0;padding:0}dialog h2{outline:none}dialog .toolbar:first-child{position:sticky;top:-20px;background:var(--card-background-color,#202226);padding:12px 0;z-index:2}dialog .error{white-space:normal}.event{position:relative;padding-right:23px}.event-handle{position:absolute;right:1px;top:0;bottom:0;width:22px;min-height:0;padding:0;display:flex;align-items:center;justify-content:center;border:0;border-radius:4px;background:transparent;color:inherit;touch-action:none;cursor:grab;user-select:none}.event-handle:hover{background:#ffffff35}.drag-source{opacity:.4}.planning-toast{position:fixed;inset:16px auto auto 50%;transform:translateX(-50%);margin:0;width:max-content;max-width:calc(100vw - 32px);padding:12px 40px 12px 15px;z-index:2147483647;border:1px solid var(--divider-color,#526271);border-radius:10px;background:var(--card-background-color,#202b36);color:var(--primary-text-color,#fff);box-shadow:0 5px 30px #0006;font-size:14px}.planning-toast.error{border-color:#e48a8a}.planning-toast button{position:absolute;right:5px;top:4px;border:0;padding:4px 7px}.planning-toast::backdrop{background:transparent}.event-main{display:block;width:100%;padding:0;border:0;text-align:left;background:transparent!important;color:inherit;font:inherit;cursor:pointer;overflow:hidden}.event[draggable=true]{user-select:none}@media(max-width:600px){dialog.planning-dialog{width:calc(100vw - 16px);max-height:calc(100dvh - 16px);border-radius:12px}dialog .dialog-body{padding:14px}.event-handle{width:21px}.event{padding-right:21px}dialog .toolbar:first-child{top:-14px}}`;
