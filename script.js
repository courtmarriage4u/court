(function(){
 var root=document.documentElement,lang=root.lang==='hi'?'hi':'en';
 /* menu button */
 var t=document.querySelector('.nav-toggle'),n=document.getElementById('nav');
 if(t&&n){t.addEventListener('click',function(){var o=n.classList.toggle('open');t.setAttribute('aria-expanded',o);});}
 /* language: remember the visitor's choice */
 var KEY='cmfu_lang',saved=null;
 document.querySelectorAll('.langsw a').forEach(function(a){a.addEventListener('click',function(){try{localStorage.setItem(KEY,a.getAttribute('data-lang'));}catch(e){}});});
 try{saved=localStorage.getItem(KEY);}catch(e){}
 var alt=document.body.getAttribute('data-alt');
 if(alt&&saved&&saved!==lang){location.replace(alt+location.search+location.hash);return;}
 /* disclaimer pop-up (first visit, remembered for 180 days) */
 var m=document.getElementById('disc-modal');
 if(m){
  var yes=document.getElementById('disc-yes'),no=document.getElementById('disc-no'),box=m.querySelector('.disc-text');
  var trap=function(e){
   if(e.key!=='Tab')return;
   var f=[box,yes,no],i=f.indexOf(document.activeElement);
   if(e.shiftKey&&i<=0){e.preventDefault();f[2].focus();}
   else if(!e.shiftKey&&i===2){e.preventDefault();f[0].focus();}
  };
  if(root.classList.contains('disc')){document.addEventListener('keydown',trap);setTimeout(function(){yes.focus();},60);}
  yes.addEventListener('click',function(){
   try{localStorage.setItem('cmfu_disclaimer',String(Date.now()));}catch(e){}
   root.classList.remove('disc');document.removeEventListener('keydown',trap);
  });
  no.addEventListener('click',function(){location.href='https://www.google.com/';});
 }
 /* multi-step form */
 document.querySelectorAll('form[data-steps]').forEach(function(f){
  var steps=[].slice.call(f.querySelectorAll('[data-step]')),i=0;
  function show(n){steps.forEach(function(s,k){s.hidden=k!==n;});i=n;f.scrollIntoView({behavior:'smooth',block:'start'});}
  f.addEventListener('click',function(e){
   var b=e.target.closest('[data-next],[data-prev]');if(!b)return;
   if(b.hasAttribute('data-prev')){show(i-1);return;}
   var ok=true;[].slice.call(steps[i].querySelectorAll('input,select,textarea')).forEach(function(x){if(ok&&!x.checkValidity()){x.reportValidity();ok=false;}});
   if(ok)show(i+1);
  });
 });
 /* forms */
 document.querySelectorAll('form[data-netlify]').forEach(function(f){
  var box=f.parentElement,ok=box.querySelector('[data-ok]'),bad=box.querySelector('[data-bad]');
  f.addEventListener('submit',function(e){
   e.preventDefault();
   fetch('/',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams(new FormData(f)).toString()})
   .then(function(r){if(!r.ok)throw new Error();f.hidden=true;bad.hidden=true;ok.hidden=false;})
   .catch(function(){bad.hidden=false;});
  });
 });
})();
