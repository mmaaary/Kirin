/* =====================================================================
   Kirin — общий скрипт для всех страниц.
   Блоки, которых нет на странице, просто пропускаются.
   ===================================================================== */
(function(){
  const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  const toast=(t)=>{const el=$('#toast');if(!el)return;el.textContent=t;el.classList.add('show');clearTimeout(el._t);el._t=setTimeout(()=>el.classList.remove('show'),2600)};
  $$('.js-year').forEach(el=>el.textContent=new Date().getFullYear());

  /* возраст считается сам по дате рождения */
  $$('[data-age]').forEach(el=>{
    const b=new Date(el.dataset.age), n=new Date();
    let a=n.getFullYear()-b.getFullYear();
    if(n.getMonth()<b.getMonth()||(n.getMonth()===b.getMonth()&&n.getDate()<b.getDate()))a--;
    const w=(a%10===1&&a%100!==11)?'год':(a%10>=2&&a%10<=4&&(a%100<10||a%100>=20))?'года':'лет';
    el.textContent=a+' '+w;
  });

  /* ---------- ссылки из SITE.links ---------- */
  $$('[data-link]').forEach(a=>{
    const url=SITE.links[a.dataset.link];
    if(url){a.href=url;a.target='_blank';a.rel='noopener'}
    else a.addEventListener('click',e=>{e.preventDefault();toast('Скоро появится')});
  });

  /* ---------- фото: подгружаем, если файл есть; иначе остаётся заглушка ---------- */
  function setBg(el,src){
    if(!src) return;
    const img=new Image();
    img.onload=()=>{el.style.backgroundImage=`url("${src}")`;el.classList.add('loaded')};
    img.src=src;
  }
  $$('[data-photo]').forEach(el=>setBg(el,SITE.photos[el.dataset.photo]));
  $$('[data-photo-src]').forEach(el=>setBg(el,el.dataset.photoSrc));

  /* ---------- шапка: бургер и меню «Медиа» ---------- */
  const nav=$('#nav'), burger=$('#burger');
  if(burger) burger.addEventListener('click',()=>nav.classList.toggle('open'));
  $$('.dd').forEach(dd=>{
    const btn=$('.dd-btn',dd);
    btn.addEventListener('click',e=>{e.stopPropagation();const o=dd.classList.toggle('open');btn.setAttribute('aria-expanded',o)});
  });
  document.addEventListener('click',e=>{$$('.dd.open').forEach(dd=>{if(!dd.contains(e.target)){dd.classList.remove('open');$('.dd-btn',dd).setAttribute('aria-expanded',false)}})});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'){$$('.dd.open').forEach(dd=>dd.classList.remove('open'));nav&&nav.classList.remove('open')}});
  $$('#nav a').forEach(a=>a.addEventListener('click',()=>nav.classList.remove('open')));

  /* =====================================================================
     ПРОВЕРКА EMAIL
     1) поле не пустое; 2) адрес правильно оформлен;
     3) подсказка при опечатке в популярном домене (gmal.com → gmail.com);
     4) временные «одноразовые» ящики не принимаются;
     5) домен существует и принимает почту (запрос MX-записи в DNS).
     Сам ящик проверить из браузера невозможно — только домен.
     ===================================================================== */
  const POPULAR=['gmail.com','mail.ru','yandex.ru','ya.ru','yandex.com','bk.ru','inbox.ru','list.ru','internet.ru','rambler.ru','icloud.com','me.com','outlook.com','hotmail.com','live.com','yahoo.com','proton.me','protonmail.com','gmx.com'];
  const DISPOSABLE=['mailinator.com','yopmail.com','10minutemail.com','guerrillamail.com','sharklasers.com','temp-mail.org','tempmail.com','tempmail.plus','trashmail.com','getnada.com','dispostable.com','maildrop.cc','fakeinbox.com','throwawaymail.com','mohmal.com','emailondeck.com','minuteinbox.com','tempail.com','1secmail.com','mail.tm','dropmail.me','inboxkitten.com','burnermail.io','tmpmail.org','moakt.com','crazymailing.com','mailnesia.com','spambox.us'];
  const EMAIL_RE=/^[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[\p{L}\p{N}](?:[\p{L}\p{N}-]{0,61}[\p{L}\p{N}])?\.)+\p{L}{2,}$/u;

  function lev(a,b){
    const d=Array.from({length:a.length+1},(_,i)=>[i]);
    for(let j=1;j<=b.length;j++)d[0][j]=j;
    for(let i=1;i<=a.length;i++)for(let j=1;j<=b.length;j++)
      d[i][j]=Math.min(d[i-1][j]+1,d[i][j-1]+1,d[i-1][j-1]+(a[i-1]===b[j-1]?0:1));
    return d[a.length][b.length];
  }
  function suggestDomain(domain){
    if(POPULAR.includes(domain))return null;
    let best=null,bd=9;
    for(const p of POPULAR){const x=lev(domain,p);if(x<bd){bd=x;best=p}}
    return bd<=(domain.length<=6?1:2)?best:null;
  }

  const dnsCache={};
  async function dns(name,type){
    const ctrl=new AbortController(), t=setTimeout(()=>ctrl.abort(),4000);
    try{
      const r=await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=${type}`,{headers:{accept:'application/dns-json'},signal:ctrl.signal});
      return await r.json();
    }finally{clearTimeout(t)}
  }
  /* true — домен принимает почту, false — точно нет, null — проверить не удалось (не блокируем) */
  async function domainAcceptsMail(domain){
    if(domain in dnsCache)return dnsCache[domain];
    let ascii=domain;
    try{ascii=new URL('http://'+domain).hostname}catch(_){}
    try{
      const mx=await dns(ascii,'MX');
      if(mx.Status===3)return dnsCache[domain]=false;               // домена не существует
      const recs=(mx.Answer||[]).filter(a=>a.type===15);
      if(recs.length)return dnsCache[domain]=recs.some(a=>!/^0\s+\.$/.test(a.data)); // «0 .» = почту не принимает
      const a=await dns(ascii,'A');                                  // без MX почта идёт на A-запись
      return dnsCache[domain]=(a.Answer||[]).some(x=>x.type===1);
    }catch(_){return null}
  }

  /* возвращает {ok, email} или {ok:false, error, suggest} */
  async function checkEmail(raw,acceptedTypos){
    const email=raw.trim().replace(/\s+/g,'');
    if(!email)return{ok:false,error:'Введите email'};
    if(!email.includes('@'))return{ok:false,error:'В адресе не хватает символа «@»'};
    if(email.length>254||email.split('@')[0].length>64)return{ok:false,error:'Слишком длинный адрес'};
    if(!EMAIL_RE.test(email))return{ok:false,error:'Проверьте адрес — похоже, в нём ошибка. Пример: name@mail.ru'};
    const [local,dom]=email.split('@'), domain=dom.toLowerCase(), norm=local+'@'+domain;
    if(DISPOSABLE.includes(domain))return{ok:false,error:'Временные почтовые ящики не принимаются'};
    const sug=suggestDomain(domain);
    if(sug&&!acceptedTypos.has(norm))return{ok:false,error:`Возможно, вы имели в виду ${local}@${sug}?`,suggest:local+'@'+sug,typo:norm};
    const live=await domainAcceptsMail(domain);
    if(live===false)return{ok:false,error:`Почтовый домен «${domain}» не существует или не принимает письма`};
    return{ok:true,email:norm};
  }

  /* ---------- «Я не робот»: небольшая вычислительная задача в браузере ---------- */
  async function proofOfWork(){
    const ch=Math.random().toString(36).slice(2)+Date.now().toString(36);
    if(!(window.crypto&&crypto.subtle))return ch+':0';
    const enc=new TextEncoder();
    for(let n=0;n<400000;n++){
      const h=new Uint8Array(await crypto.subtle.digest('SHA-256',enc.encode(ch+n)));
      if(h[0]===0&&h[1]<16)return ch+':'+n;
    }
    return ch+':x';
  }
  function initRobot(el){
    const btn=$('.robot-row',el);
    btn.addEventListener('click',async()=>{
      if(el.classList.contains('busy')||el.classList.contains('done'))return;
      el.classList.remove('invalid');el.classList.add('busy');
      const t0=Date.now(), token=await proofOfWork();
      await sleep(Math.max(0,800-(Date.now()-t0)));
      el.classList.remove('busy');el.classList.add('done');
      el.dataset.token=token;btn.setAttribute('aria-checked','true');
      $('.robot-label',el).textContent='Проверка пройдена';
    });
  }

  /* ---------- форма подписки (главная и страница «Рассылка») ---------- */
  function initSubscribe(form){
    const input=$('input[type=email]',form), msg=$(form.dataset.msg)||$('.js-msg',form);
    const robot=$('.robot',form), submit=$('[type=submit]',form);
    const accepted=new Set(), t0=Date.now();
    const setMsg=(html,cls)=>{msg.className=msg.className.replace(/\b(err|ok|wait)\b/g,'').trim()+(cls?' '+cls:'');msg.innerHTML=html};
    const esc=s=>s.replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
    if(robot)initRobot(robot);

    input.addEventListener('input',()=>{input.classList.remove('invalid');if(msg.classList.contains('err'))setMsg('')});
    input.addEventListener('blur',async()=>{
      if(!input.value.trim())return;
      const r=await checkEmail(input.value,accepted);
      if(!r.ok)showError(r);
    });
    $$('.check input',form).forEach(c=>c.addEventListener('change',()=>c.closest('.check').classList.remove('invalid')));

    function showError(r){
      input.classList.add('invalid');
      let html=esc(r.error);
      if(r.suggest)html+=` <button type="button" data-fix>Исправить</button> <button type="button" data-keep>Нет, всё верно</button>`;
      setMsg(html,'err');
      const fix=$('[data-fix]',msg), keep=$('[data-keep]',msg);
      if(fix)fix.onclick=()=>{input.value=r.suggest;input.classList.remove('invalid');setMsg('')};
      if(keep)keep.onclick=()=>{accepted.add(r.typo);input.classList.remove('invalid');setMsg('')};
    }

    form.addEventListener('submit',async e=>{
      e.preventDefault();
      if(submit.disabled)return;
      setMsg('Проверяем адрес…','wait');
      const r=await checkEmail(input.value,accepted);
      if(!r.ok){showError(r);input.focus();return}
      input.value=r.email;
      const req=$$('.check input[required]',form).filter(c=>!c.checked);
      if(req.length){req.forEach(c=>c.closest('.check').classList.add('invalid'));setMsg('Отметьте обязательные пункты','err');return}
      if(robot&&!robot.classList.contains('done')){robot.classList.add('invalid');setMsg('Подтвердите, что вы не робот','err');return}
      if($('.hp input',form).value)return;                      // заполнил скрытое поле — бот
      if(Date.now()-t0<2500){setMsg('Слишком быстро — попробуйте ещё раз через секунду','err');return}
      if(!SITE.formspreeId){setMsg('Форма скоро заработает','err');return}

      const data=new FormData(form);
      data.set('email',r.email);
      data.set('_subject','Новая подписка на рассылку Kirin');
      data.set('page',location.pathname.split('/').pop()||'index.html');
      if(robot)data.set('robot',robot.dataset.token);
      submit.disabled=true;setMsg('Отправка…','wait');
      try{
        const res=await fetch('https://formspree.io/f/'+SITE.formspreeId,{method:'POST',body:data,headers:{Accept:'application/json'}});
        if(res.ok){
          form.reset();setMsg('Готово! Ты в списке.','ok');
          const box=form.closest('.nl');if(box)box.classList.add('sent');
        }else{
          const j=await res.json().catch(()=>({}));
          setMsg(esc((j.errors&&j.errors.map(x=>x.message).join('. '))||'Ошибка, попробуйте ещё раз'),'err');
        }
      }catch(_){setMsg('Нет связи с сервером. Проверьте интернет и попробуйте ещё раз','err')}
      submit.disabled=false;
    });
  }
  $$('form.js-subscribe').forEach(initSubscribe);

  /* форма на главной: переносим email на страницу рассылки (не через адресную строку) */
  $$('form.js-to-newsletter').forEach(f=>f.addEventListener('submit',e=>{
    e.preventDefault();
    const v=$('input',f).value.trim();
    try{v?sessionStorage.setItem('kirin-email',v):sessionStorage.removeItem('kirin-email')}catch(_){}
    location.href=f.getAttribute('action');
  }));
  const nlInput=$('.nl-form input[type=email]');
  if(nlInput){
    let saved=null;try{saved=sessionStorage.getItem('kirin-email');sessionStorage.removeItem('kirin-email')}catch(_){}
    if(saved){nlInput.value=saved;nlInput.dispatchEvent(new Event('blur'))}
  }

  /* ---------- видео ---------- */
  $$('.player').forEach(player=>{
    const video=$('video',player);
    video.src=(video.dataset.src||SITE.video)+'#t=0.5';   // первый кадр вместо обложки
    $('.play',player).addEventListener('click',()=>{
      video.play().then(()=>{player.classList.add('playing');video.controls=true}).catch(()=>toast('Видео скоро появится'));
    });
  });

  /* ---------- слайдер ---------- */
  const slides=$$('.slide'), dots=$('#dots');
  if(slides.length&&dots){
    let si=0,timer;
    slides.forEach((_,i)=>{const b=document.createElement('button');b.setAttribute('aria-label','Слайд '+(i+1));b.onclick=()=>{go(i);restart()};dots.appendChild(b)});
    function go(i){slides[si].classList.remove('active');dots.children[si].classList.remove('active');si=(i+slides.length)%slides.length;slides[si].classList.add('active');dots.children[si].classList.add('active')}
    function restart(){clearInterval(timer);timer=setInterval(()=>go(si+1),6000)}
    go(0);restart();
  }

  /* ---------- таймлайн ---------- */
  const tls=$$('.tl-slide'), track=$('#tl-track');
  if(tls.length&&track){
    let ti=0;
    tls.forEach((s,i)=>{
      const b=document.createElement('button');b.className='tl-item';
      b.innerHTML=`<span class="y">${s.dataset.year}</span><span class="pt"></span><span class="l">${s.dataset.label||''}</span>`;
      b.onclick=()=>tgo(i);track.appendChild(b);
    });
    function tgo(i){
      i=Math.max(0,Math.min(tls.length-1,i));
      tls[ti].classList.remove('active');track.children[ti].classList.remove('active');
      ti=i;tls[ti].classList.add('active');track.children[ti].classList.add('active');
      const bar=track.parentElement, it=track.children[ti];
      bar.scrollTo({left:it.offsetLeft-bar.clientWidth/2+it.offsetWidth/2,behavior:'smooth'});
      $('#tl-progress').style.width=(ti/(tls.length-1)*100)+'%';
      $('#tl-start').style.display=ti?'none':'';
    }
    $('#tl-prev').onclick=()=>tgo(ti-1);
    $('#tl-next').onclick=()=>tgo(ti+1);
    $('#tl-start').onclick=()=>tgo(1);
    let tx=0;const tl=$('#timeline');
    tl.addEventListener('touchstart',e=>tx=e.touches[0].clientX,{passive:true});
    tl.addEventListener('touchend',e=>{const d=e.changedTouches[0].clientX-tx;if(Math.abs(d)>50)tgo(ti+(d<0?1:-1))});
    tgo(0);
  }

  /* ---------- обратный отсчёт до клипа ---------- */
  if($('[data-cd]')){
    const target=new Date(SITE.clipDate).getTime(), pad=n=>String(n).padStart(2,'0');
    (function tick(){
      const s=Math.max(0,Math.floor((target-Date.now())/1000));
      const v={d:Math.floor(s/86400),h:Math.floor(s%86400/3600),m:Math.floor(s%3600/60),s:s%60};
      $$('[data-cd]').forEach(el=>el.textContent=pad(v[el.dataset.cd]));
      if(s===0){const n=$('#cd-note');if(n)n.innerHTML='<strong>Клип уже вышел — смотри на YouTube!</strong>';return}
      setTimeout(tick,1000);
    })();
  }

  /* ---------- появление при скролле ---------- */
  const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target)}}),{threshold:.15});
  $$('.reveal').forEach(el=>io.observe(el));
})();
