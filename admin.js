const configured = window.SUPABASE_URL && !window.SUPABASE_URL.includes("TU-PROYECTO") &&
  window.SUPABASE_ANON_KEY && !window.SUPABASE_ANON_KEY.includes("TU_CLAVE");
const db = configured ? window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY) : null;
const $=s=>document.querySelector(s);
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

async function showSession(){
  if(!db){$("#loginMsg").textContent="Primero conecta Supabase en config.js.";return;}
  const {data}=await db.auth.getSession();
  const logged=!!data.session;
  $("#loginPanel").classList.toggle("hidden",logged);
  $("#dashboard").classList.toggle("hidden",!logged);
  if(logged) loadAdminGames();
}
$("#loginForm").addEventListener("submit",async e=>{
  e.preventDefault();
  if(!db){$("#loginMsg").textContent="Supabase todavía no está configurado.";return;}
  const {error}=await db.auth.signInWithPassword({email:$("#email").value,password:$("#password").value});
  $("#loginMsg").textContent=error?error.message:"Sesión iniciada.";
  if(!error) showSession();
});
$("#logoutBtn").addEventListener("click",async()=>{if(db) await db.auth.signOut();showSession();});

$("#gameForm").addEventListener("submit",async e=>{
  e.preventDefault();
  if(!db){$("#gameMsg").textContent="Conecta Supabase primero.";return;}
  const payload={
    category:$("#gameCategory").value, game_date:new Date($("#gameDate").value).toISOString(),
    home_team:$("#homeTeam").value.trim(), away_team:$("#awayTeam").value.trim(),
    venue:$("#venue").value.trim(), status:$("#gameStatus").value, home_score:0, away_score:0
  };
  const {error}=await db.from("games").insert(payload);
  $("#gameMsg").textContent=error?error.message:"Partido guardado correctamente.";
  if(!error){e.target.reset();loadAdminGames();}
});
async function loadAdminGames(){
  if(!db)return;
  const {data,error}=await db.from("games").select("*").order("game_date",{ascending:false}).limit(30);
  const el=$("#adminGames");
  if(error){el.innerHTML='<div class="empty">Error cargando partidos.</div>';return;}
  el.innerHTML=(data||[]).map(g=>`<div class="admin-game">
    <div><span class="tag">${esc(g.category)}</span><b>${esc(g.home_team)} vs ${esc(g.away_team)}</b><small>${new Date(g.game_date).toLocaleString("es-PE")}</small></div>
    <div class="admin-actions"><button class="small-btn" data-live="${g.id}">En vivo</button><button class="small-btn" data-finish="${g.id}">Finalizar</button></div>
  </div>`).join("") || '<div class="empty">No hay partidos.</div>';
  el.querySelectorAll("[data-live]").forEach(b=>b.addEventListener("click",()=>setStatus(b.dataset.live,"live")));
  el.querySelectorAll("[data-finish]").forEach(b=>b.addEventListener("click",()=>setStatus(b.dataset.finish,"finished")));
}
async function setStatus(id,status){
  if(!db)return;
  const patch={status};
  if(status==="finished"){
    const hs=Number(prompt("Puntos equipo local:", "0")); const as=Number(prompt("Puntos equipo visitante:", "0"));
    if(!Number.isFinite(hs)||!Number.isFinite(as))return;
    patch.home_score=Math.max(0,Math.round(hs)); patch.away_score=Math.max(0,Math.round(as));
  }
  const {error}=await db.from("games").update(patch).eq("id",id);
  if(error)alert(error.message); else loadAdminGames();
}
if(db) db.auth.onAuthStateChange(()=>showSession());
showSession();
