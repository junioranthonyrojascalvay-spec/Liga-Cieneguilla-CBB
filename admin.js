const configured =
  window.SUPABASE_URL &&
  !window.SUPABASE_URL.includes("TU-PROYECTO") &&
  window.SUPABASE_ANON_KEY &&
  !window.SUPABASE_ANON_KEY.includes("TU_CLAVE");

const db = configured
  ? window.supabase.createClient(
      window.SUPABASE_URL,
      window.SUPABASE_ANON_KEY
    )
  : null;

const $ = (s) => document.querySelector(s);

const esc = (v) =>
  String(v ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[c]));


/* =========================
   SESIÓN
========================= */

async function showSession() {
  if (!db) {
    $("#loginMsg").textContent =
      "Primero conecta Supabase en config.js.";
    return;
  }

  const { data } = await db.auth.getSession();
  const logged = !!data.session;

  $("#loginPanel").classList.toggle("hidden", logged);
  $("#dashboard").classList.toggle("hidden", !logged);

  if (logged) {
    loadAdminTeams();
    loadAdminGames();
  }
}


/* =========================
   LOGIN
========================= */

$("#loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  if (!db) {
    $("#loginMsg").textContent =
      "Supabase todavía no está configurado.";
    return;
  }

  const { error } = await db.auth.signInWithPassword({
    email: $("#email").value,
    password: $("#password").value
  });

  $("#loginMsg").textContent =
    error ? error.message : "Sesión iniciada.";

  if (!error) {
    showSession();
  }
});


/* =========================
   CERRAR SESIÓN
========================= */

$("#logoutBtn").addEventListener("click", async () => {
  if (db) {
    await db.auth.signOut();
  }

  showSession();
});


/* =========================
   EQUIPOS
========================= */

$("#teamForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  if (!db) {
    $("#teamMsg").textContent =
      "Conecta Supabase primero.";
    return;
  }

  const form = e.target;

  const category = $("#teamCategory").value;
  const name = $("#teamName").value.trim();
  const logoFile = $("#teamLogoFile").files[0];
let logo_url = "";

  if (!name) {
    $("#teamMsg").textContent =
      "Escribe el nombre del equipo.";
    return;
  }

  const editingId = form.dataset.editingId;

  let result;

if (logoFile) {
  const fileExt = logoFile.name.split(".").pop().toLowerCase();
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;

  const uploadResult = await db.storage
    .from("team-logos")
    .upload(fileName, logoFile, {
      upsert: false,
      contentType: logoFile.type
    });

  if (uploadResult.error) {
    $("#teamMsg").textContent = "Error al subir el logo: " + uploadResult.error.message;
    return;
  }

  const { data: publicUrlData } = db.storage
    .from("team-logos")
    .getPublicUrl(fileName);

  logo_url = publicUrlData.publicUrl;
}

if (editingId) {
  const updateData = {
    category,
    name
  };

  if (logoFile) {
    updateData.logo_url = logo_url;
  }

  result = await db
    .from("teams")
    .update(updateData)
    .eq("id", editingId);
} else {
  result = await db
    .from("teams")
    .insert({
      category,
      name,
      logo_url: logo_url || null
    });
}
  if (result.error) {
    $("#teamMsg").textContent =
      result.error.message;
    return;
  }

  $("#teamMsg").textContent =
    editingId
      ? "Equipo actualizado correctamente."
      : "Equipo guardado correctamente.";

  form.reset();
  delete form.dataset.editingId;

  const submitButton =
    form.querySelector('button[type="submit"]');

  if (submitButton) {
    submitButton.textContent = "Guardar equipo";
  }

  loadAdminTeams();
});


/* =========================
   CARGAR EQUIPOS
========================= */

async function loadAdminTeams() {
  if (!db) return;

  const el = $("#adminTeams");

  const { data, error } = await db
    .from("teams")
    .select("*")
    .order("category", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    el.innerHTML =
      '<div class="empty">Error cargando equipos.</div>';
    return;
  }

  if (!data || !data.length) {
    el.innerHTML =
      '<div class="empty">Aún no hay equipos registrados.</div>';
    return;
  }

  el.innerHTML = data.map((team) => {

    const logo = team.logo_url
      ? `<img src="${esc(team.logo_url)}"
           alt=""
           style="width:48px;height:48px;object-fit:contain;border-radius:8px;">`
      : "";

    return `
      <div class="admin-game">

        <div style="display:flex;align-items:center;gap:12px;">

          ${logo}

          <div>
            <span class="tag">${esc(team.category)}</span>
            <b>${esc(team.name)}</b>
          </div>

        </div>

        <div class="admin-actions">

          <button
            class="small-btn"
            data-edit-team="${esc(team.id)}">
            Editar
          </button>

          <button
            class="small-btn"
            data-delete-team="${esc(team.id)}">
            Eliminar
          </button>

        </div>

      </div>
    `;
  }).join("");


  /* EDITAR */

  el.querySelectorAll("[data-edit-team]").forEach((button) => {

    button.addEventListener("click", () => {

      const team = data.find(
        (item) => item.id === button.dataset.editTeam
      );

      if (!team) return;

      $("#teamCategory").value = team.category;
      $("#teamName").value = team.name;
      $("#teamLogoUrl").value = team.logo_url || "";

      $("#teamForm").dataset.editingId = team.id;

      const submitButton =
        $("#teamForm").querySelector('button[type="submit"]');

      if (submitButton) {
        submitButton.textContent = "Actualizar equipo";
      }

      $("#teamMsg").textContent =
        "Editando: " + team.name;

      window.scrollTo({
        top: 0,
        behavior: "smooth"
      });
    });

  });


  /* ELIMINAR */

  el.querySelectorAll("[data-delete-team]").forEach((button) => {

    button.addEventListener("click", async () => {

      const team = data.find(
        (item) => item.id === button.dataset.deleteTeam
      );

      if (!team) return;

      const confirmar = confirm(
        `¿Eliminar el equipo "${team.name}"?`
      );

      if (!confirmar) return;

      const { error } = await db
        .from("teams")
        .delete()
        .eq("id", team.id);

      if (error) {
        alert(error.message);
        return;
      }

      loadAdminTeams();
    });

  });

}


/* =========================
   PARTIDOS
========================= */

$("#gameForm").addEventListener("submit", async (e) => {

  e.preventDefault();

  if (!db) {
    $("#gameMsg").textContent =
      "Conecta Supabase primero.";
    return;
  }

  const payload = {
    category: $("#gameCategory").value,
    game_date: new Date(
      $("#gameDate").value
    ).toISOString(),

    home_team: $("#homeTeam").value.trim(),
    away_team: $("#awayTeam").value.trim(),

    venue: $("#venue").value.trim(),

    status: $("#gameStatus").value,

    home_score: 0,
    away_score: 0
  };

  const { error } = await db
    .from("games")
    .insert(payload);

  $("#gameMsg").textContent =
    error
      ? error.message
      : "Partido guardado correctamente.";

  if (!error) {
    e.target.reset();
    loadAdminGames();
  }

});


/* =========================
   CARGAR PARTIDOS
========================= */

async function loadAdminGames() {

  if (!db) return;

  const { data, error } = await db
    .from("games")
    .select("*")
    .order("game_date", {
      ascending: false
    })
    .limit(30);

  const el = $("#adminGames");

  if (error) {
    el.innerHTML =
      '<div class="empty">Error cargando partidos.</div>';
    return;
  }

  el.innerHTML =
    (data || []).map((g) => `

      <div class="admin-game">

        <div>

          <span class="tag">
            ${esc(g.category)}
          </span>

          <b>
            ${esc(g.home_team)}
            vs
            ${esc(g.away_team)}
          </b>

          <small>
            ${new Date(g.game_date).toLocaleString("es-PE")}
          </small>

        </div>

        <div class="admin-actions">

          <button
            class="small-btn"
            data-live="${esc(g.id)}">
            En vivo
          </button>

          <button
            class="small-btn"
            data-finish="${esc(g.id)}">
            Finalizar
          </button>

        </div>

      </div>

    `).join("") ||
    '<div class="empty">No hay partidos.</div>';


  el.querySelectorAll("[data-live]").forEach((b) => {

    b.addEventListener("click", () =>
      setStatus(
        b.dataset.live,
        "live"
      )
    );

  });


  el.querySelectorAll("[data-finish]").forEach((b) => {

    b.addEventListener("click", () =>
      setStatus(
        b.dataset.finish,
        "finished"
      )
    );

  });

}


/* =========================
   CAMBIAR ESTADO
========================= */

async function setStatus(id, status) {

  if (!db) return;

  const patch = {
    status
  };

  if (status === "finished") {

    const hs = Number(
      prompt(
        "Puntos equipo local:",
        "0"
      )
    );

    const as = Number(
      prompt(
        "Puntos equipo visitante:",
        "0"
      )
    );

    if (
      !Number.isFinite(hs) ||
      !Number.isFinite(as)
    ) {
      return;
    }

    patch.home_score =
      Math.max(
        0,
        Math.round(hs)
      );

    patch.away_score =
      Math.max(
        0,
        Math.round(as)
      );
  }

  const { error } = await db
    .from("games")
    .update(patch)
    .eq("id", id);

  if (error) {
    alert(error.message);
  } else {
    loadAdminGames();
  }

}


/* =========================
   AUTENTICACIÓN EN TIEMPO REAL
========================= */

if (db) {
  db.auth.onAuthStateChange(() => {
    showSession();
  });
}


/* =========================
   INICIO
========================= */

showSession();
