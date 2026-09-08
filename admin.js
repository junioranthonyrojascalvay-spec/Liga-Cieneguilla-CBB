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

  let error;

const editingId = e.target.dataset.editingId;

if (editingId) {
  const result = await db
    .from("games")
    .update(payload)
    .eq("id", editingId);

  error = result.error;
} else {
  const result = await db
    .from("games")
    .insert(payload);

  error = result.error;
}
  $("#gameMsg").textContent =
    error
      ? error.message
      : "Partido guardado correctamente.";

  if (!error) {
    e.target.reset();
    delete e.target.dataset.editingId;
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
    .order("game_date", { ascending: false })
    .limit(30);

  const el = $("#adminGames");

  if (error) {
    el.innerHTML =
      '<div class="empty">Error cargando partidos.</div>';
    console.error(error);
    return;
  }

  // Cargar equipos para obtener sus logos
  const { data: teams } = await db
    .from("teams")
    .select("name, logo_url");

  const teamMap = {};

  (teams || []).forEach((team) => {
    teamMap[team.name] = team.logo_url || "";
  });

  el.innerHTML =
    (data || []).map((g) => {

      const homeLogo = teamMap[g.home_team] || "";
      const awayLogo = teamMap[g.away_team] || "";

      let statusText = "PROGRAMADO";

      if (g.status === "live") {
        statusText = "EN VIVO";
      }

      if (g.status === "finished") {
        statusText = "FINALIZADO";
      }

      return `
        <div class="admin-game">

          <div>

            <span class="tag">
              ${esc(g.category)}
            </span>

            <div style="
              display:flex;
              align-items:center;
              justify-content:center;
              gap:18px;
              margin:15px 0;
              text-align:center;
            ">

              <div>
                ${
                  homeLogo
                    ? `<img src="${esc(homeLogo)}"
                        alt=""
                        style="width:55px;height:55px;object-fit:contain;display:block;margin:auto;">`
                    : ""
                }

                <b>${esc(g.home_team)}</b>

                <div style="
                  font-size:28px;
                  font-weight:800;
                  margin-top:5px;
                ">
                  ${g.home_score ?? 0}
                </div>
              </div>

              <strong style="font-size:18px;">
                VS
              </strong>

              <div>
                ${
                  awayLogo
                    ? `<img src="${esc(awayLogo)}"
                        alt=""
                        style="width:55px;height:55px;object-fit:contain;display:block;margin:auto;">`
                    : ""
                }

                <b>${esc(g.away_team)}</b>

                <div style="
                  font-size:28px;
                  font-weight:800;
                  margin-top:5px;
                ">
                  ${g.away_score ?? 0}
                </div>
              </div>

            </div>

            <div style="
              text-align:center;
              margin:8px 0;
              font-weight:800;
            ">
              ${statusText}
            </div>

            <small>
              ${new Date(g.game_date).toLocaleString("es-PE")}
            </small>

            <br>

            <small>
              📍 ${esc(g.venue || "Cancha Cieneguilla")}
            </small>

          </div>

          <div class="admin-actions">

            <button
              class="small-btn"
              data-edit-game="${esc(g.id)}">
              ✏️ Editar
            </button>

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

            <button
              class="small-btn"
              data-delete-game="${esc(g.id)}">
              🗑️ Eliminar
            </button>

          </div>

        </div>
      `;
    }).join("") ||
    '<div class="empty">No hay partidos.</div>';


  // BOTÓN EDITAR
  el.querySelectorAll("[data-edit-game]").forEach((b) => {

    b.addEventListener("click", () => {

      const game = (data || []).find(
        (item) => item.id === b.dataset.editGame
      );

      if (!game) return;

      $("#gameCategory").value = game.category;

      $("#gameDate").value = new Date(game.game_date)
        .toISOString()
        .slice(0, 16);

      $("#venue").value = game.venue || "";

      $("#gameStatus").value = game.status;

      $("#gameForm").dataset.editingId = game.id;

      $("#gameMsg").textContent =
        "Editando partido: " +
        game.home_team +
        " vs " +
        game.away_team;

      loadGameTeamOptions().then(() => {
        $("#homeTeam").value = game.home_team;
        $("#awayTeam").value = game.away_team;
      });

      window.scrollTo({
        top: 0,
        behavior: "smooth"
      });

    });

  });


  // BOTÓN EN VIVO
  el.querySelectorAll("[data-live]").forEach((b) => {

    b.addEventListener("click", () =>
      setStatus(
        b.dataset.live,
        "live"
      )
    );

  });


  // BOTÓN FINALIZAR
  el.querySelectorAll("[data-finish]").forEach((b) => {

    b.addEventListener("click", () =>
      setStatus(
        b.dataset.finish,
        "finished"
      )
    );

  });


  // BOTÓN ELIMINAR
  el.querySelectorAll("[data-delete-game]").forEach((b) => {

    b.addEventListener("click", async () => {

      const game = (data || []).find(
        (item) => item.id === b.dataset.deleteGame
      );

      if (!game) return;

      const confirmar = confirm(
        `¿Eliminar el partido ${game.home_team} vs ${game.away_team}?`
      );

      if (!confirmar) return;

      const { error } = await db
        .from("games")
        .delete()
        .eq("id", game.id);

      if (error) {
        alert("Error al eliminar: " + error.message);
        return;
      }

      loadAdminGames();

    });

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

async function loadGameTeamOptions() {
  const category = $("#gameCategory").value;
  const home = $("#homeTeam");
  const away = $("#awayTeam");

  home.innerHTML = '<option value="">Selecciona equipo local</option>';
  away.innerHTML = '<option value="">Selecciona equipo visitante</option>';

  if (!category) return;

  try {
    const { data, error } = await db
      .from("teams")
      .select("name")
      .eq("category", category)
      .order("name");

    if (error) {
      $("#gameMsg").textContent =
        "ERROR SUPABASE: " + error.message;
      return;
    }

    if (!data || data.length === 0) {
      $("#gameMsg").textContent =
        "No se encontraron equipos para " + category;
      return;
    }

    data.forEach((team) => {
      const homeOption = document.createElement("option");
      homeOption.value = team.name;
      homeOption.textContent = team.name;

      const awayOption = document.createElement("option");
      awayOption.value = team.name;
      awayOption.textContent = team.name;

      home.appendChild(homeOption);
      away.appendChild(awayOption);
    });

    $("#gameMsg").textContent =
      "Equipos cargados correctamente: " + data.length;

  } catch (error) {
    $("#gameMsg").textContent =
      "ERROR JAVASCRIPT: " + error.message;
  }
}
$("#gameCategory").addEventListener("change", loadGameTeamOptions);
loadGameTeamOptions();
