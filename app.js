const hasConfig = window.SUPABASE_URL && !window.SUPABASE_URL.includes("TU-PROYECTO") &&
  window.SUPABASE_ANON_KEY && !window.SUPABASE_ANON_KEY.includes("TU_CLAVE");

const db = hasConfig ? window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY) : null;
let currentCategory = "Sub-13";

const $ = (s) => document.querySelector(s);
const esc = (v) => String(v ?? "").replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function demoData() {
  return [
    {id:1,category:"Sub-13",home_team:"Equipo Cieneguilla",away_team:"Raptors",game_date:"2026-09-20T18:00:00",venue:"Cancha Cieneguilla",status:"scheduled",home_score:0,away_score:0},
    {id:2,category:"Sub-13",home_team:"Los Andes",away_team:"Black Mamba",game_date:"2026-09-21T19:30:00",venue:"Cancha Cieneguilla",status:"scheduled",home_score:0,away_score:0}
  ];
}

async function loadGames() {
  if (!db) return demoData().filter(g=>g.category===currentCategory);
  const {data,error} = await db.from("games").select("*").eq("category",currentCategory).order("game_date",{ascending:true});
  if(error){ console.error(error); return []; }
  return data || [];
}
function renderGames(games) {
  const upcoming = $("#upcoming");
  const liveGames = $("#liveGames");
  const finishedGames = $("#finishedGames");

  const live = games.filter(g => g.status === "live");
  const finished = games.filter(g => g.status === "finished");
  const next = games.filter(g => g.status !== "live" && g.status !== "finished");

  function card(g) {
    const d = new Date(g.game_date);

    const date = d.toLocaleDateString("es-PE", {
      day: "2-digit",
      month: "short"
    });

    const time = d.toLocaleTimeString("es-PE", {
      hour: "2-digit",
      minute: "2-digit"
    });

    return `
      <article class="game-row">
        <div class="game-date">
          <b>${esc(date)}</b>
          <small>${esc(time)}</small>
        </div>

        <div class="teams">
          <b>${esc(g.home_team)}</b>
          <span>VS</span>
          <b>${esc(g.away_team)}</b>
        </div>

        <div class="game-score">
          ${g.home_score ?? 0} - ${g.away_score ?? 0}
        </div>
      </article>
    `;
  }

  liveGames.innerHTML = live.length
    ? live.map(card).join("")
    : '<div class="empty">No hay partidos en vivo.</div>';

  upcoming.innerHTML = next.length
    ? next.map(card).join("")
    : '<div class="empty">No hay próximos partidos.</div>';

  finishedGames.innerHTML = finished.length
    ? finished.map(card).join("")
    : '<div class="empty">No hay partidos finalizados.</div>';
}
async function loadStandings(){
  const body=$("#standings");
  if(!db){body.innerHTML='<tr><td>1</td><td>Datos de ejemplo</td><td>0</td><td>0</td><td>0</td><td>0</td></tr>';return;}
  const {data,error}=await db.from("standings").select("*").eq("category",currentCategory).order("points",{ascending:false}).order("diff",{ascending:false});
  if(error){body.innerHTML='<tr><td colspan="6">Configura la base de datos para ver la tabla.</td></tr>';return;}
  body.innerHTML=(data||[]).map((t,i)=>`<tr><td>${i+1}</td><td><b>${esc(t.team_name)}</b></td><td>${t.played}</td><td>${t.wins}</td><td>${t.losses}</td><td><b>${t.points}</b></td></tr>`).join("") || '<tr><td colspan="6">Aún no hay equipos.</td></tr>';
}
async function loadScorers(){
  const el=$("#topScorers");
  if(!db){el.innerHTML='<div class="player-line"><b>Estadísticas</b><span>Se mostrarán aquí</span></div>';return;}
  const {data,error}=await db.from("top_scorers").select("*").eq("category",currentCategory).limit(5);
  if(error){el.innerHTML='<div class="empty">Aún no hay estadísticas.</div>';return;}
  el.innerHTML=(data||[]).map(p=>`<div class="player-line"><div><b>${esc(p.player_name)}</b><small>${esc(p.team_name)}</small></div><strong>${p.points_per_game ?? 0} PPG</strong></div>`).join("") || '<div class="empty">Aún no hay estadísticas.</div>';
}
async function refresh(){
  $("#nextStatus").textContent=db?"Actualizado en vivo":"Modo demostración";
  renderGames(await loadGames()); await loadStandings(); await loadScorers();
}
function selectCategory(cat){
  currentCategory=cat; $("#selectedCategory").textContent=cat;
  document.querySelectorAll(".category-card").forEach(b=>b.classList.toggle("active",b.dataset.category===cat)); refresh();
}
document.querySelectorAll(".category-card").forEach(b=>b.addEventListener("click",()=>selectCategory(b.dataset.category)));
$("#refreshBtn").addEventListener("click",refresh);
$("#menuBtn").addEventListener("click",()=>$("#mainNav").classList.toggle("open"));

if(db){
  db.channel("public-games").on("postgres_changes",{event:"*",schema:"public",table:"games"},refresh).subscribe();
  db.channel("public-standings").on("postgres_changes",{event:"*",schema:"public",table:"standings"},refresh).subscribe();
}
refresh();
