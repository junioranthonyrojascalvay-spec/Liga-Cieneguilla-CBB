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
    loadAdminPlayers();
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
   JUGADORES
========================= */

async function loadPlayerTeamOptions() {
  const category = $("#playerCategory").value;
  const team = $("#playerTeam");

  team.innerHTML =
    '<option value="">Selecciona equipo</option>';

  if (!category || !db) return;

  const { data, error } = await db
    .from("teams")
    .select("name")
    .eq("category", category)
    .order("name");

  if (error) {
    console.error("Error cargando equipos para jugadores:", error);
    $("#playerMsg").textContent =
      "Error cargando equipos.";
    return;
  }

  (data || []).forEach((item) => {
    const option = document.createElement("option");
    option.value = item.name;
    option.textContent = item.name;
    team.appendChild(option);
  });
}


$("#playerCategory").addEventListener(
  "change",
  loadPlayerTeamOptions
);
loadPlayerTeamOptions();

$("#playerForm").addEventListener(
  "submit",
  async (e) => {

    e.preventDefault();

    if (!db) {
      $("#playerMsg").textContent =
        "Conecta Supabase primero.";
      return;
    }

    const category =
      $("#playerCategory").value;

    const team_name =
      $("#playerTeam").value;

    const name =
      $("#playerName").value.trim();

    const number =
      $("#playerNumber").value
        ? Number($("#playerNumber").value)
        : null;

    if (!category || !team_name || !name) {
      $("#playerMsg").textContent =
        "Completa categoría, equipo y nombre.";
      return;
    }

    const editingId =
  e.target.dataset.editingId;

let error;

if (editingId) {

  const result = await db
    .from("players")
    .update({
      category,
      team_name,
      name,
      number
    })
    .eq("id", editingId);

  error = result.error;

} else {

  const result = await db
    .from("players")
    .insert({
      category,
      team_name,
      name,
      number,
      photo_url: null
    });

  error = result.error;
}

    if (error) {
      $("#playerMsg").textContent =
        "Error: " + error.message;
      return;
    }

    $("#playerMsg").textContent =
      "Jugador guardado correctamente.";

    e.target.reset();

delete e.target.dataset.editingId;

const submitButton =
  e.target.querySelector('button[type="submit"]');

if (submitButton) {
  submitButton.textContent = "Guardar jugador";
}

loadPlayerTeamOptions();
loadAdminPlayers();

  }
);


/* CARGAR JUGADORES */

async function loadAdminPlayers() {

  if (!db) return;

  const el = $("#adminPlayers");

  const { data, error } = await db
    .from("players")
    .select("*")
    .order("category")
    .order("team_name")
    .order("name");

  if (error) {
    el.innerHTML =
      '<div class="empty">Error cargando jugadores.</div>';
    console.error(error);
    return;
  }

  if (!data || !data.length) {
    el.innerHTML =
      '<div class="empty">Aún no hay jugadores registrados.</div>';
    return;
  }

  const grupos = {};

data.forEach((player) => {
  if (!grupos[player.category]) {
    grupos[player.category] = {};
  }

  if (!grupos[player.category][player.team_name]) {
    grupos[player.category][player.team_name] = [];
  }

  grupos[player.category][player.team_name].push(player);
});

el.innerHTML = Object.entries(grupos)
  .map(([category, teams]) => `
    <div class="player-category-group">

      <h3>🏀 ${esc(category)}</h3>

      ${Object.entries(teams)
        .map(([teamName, players]) => `
          <div class="player-team-group">

            <h4>🏆 ${esc(teamName)}</h4>

            ${players
              .map((player) => `
                <div class="admin-game">

                  <div>
                    <span class="tag">
                      ${esc(player.category)}
                    </span>

                    <b>${esc(player.name)}</b>

                    <small>
                      ${esc(player.team_name)}
                      ${
                        player.number !== null
                          ? " · N° " + esc(player.number)
                          : ""
                      }
                    </small>
                  </div>

                  <div class="admin-actions">

                    <button
                      class="small-btn"
                      data-edit-player="${esc(player.id)}">
                      ✏️ Editar
                    </button>

                    <button
                      class="small-btn"
                      data-delete-player="${esc(player.id)}">
                      🗑️ Eliminar
                    </button>

                  </div>

                </div>
              `)
              .join("")}

          </div>
        `)
        .join("")}

    </div>
  `)
  .join("");


  el.querySelectorAll(
    "[data-delete-player]"
  ).forEach((button) => {

    button.addEventListener(
      "click",
      async () => {

        const player = data.find(
          (item) =>
            item.id ===
            button.dataset.deletePlayer
        );

        if (!player) return;

        const confirmar = confirm(
          `¿Eliminar al jugador "${player.name}"?`
        );

        if (!confirmar) return;

        const { error } = await db
          .from("players")
          .delete()
          .eq("id", player.id);

        if (error) {
          alert(error.message);
          return;
        }

        loadAdminPlayers()
loadPlayerTeamOptions();
      }
    );
  });
// BOTÓN EDITAR JUGADOR
el.querySelectorAll("[data-edit-player]").forEach((button) => {

  button.addEventListener("click", () => {

    const player = data.find(
      (item) =>
        item.id === button.dataset.editPlayer
    );

    if (!player) return;

    $("#playerCategory").value =
      player.category;

    loadPlayerTeamOptions().then(() => {
      $("#playerTeam").value =
        player.team_name;
    });

    $("#playerName").value =
      player.name;

    $("#playerNumber").value =
      player.number ?? "";

    $("#playerForm").dataset.editingId =
      player.id;

    $("#playerMsg").textContent =
      "Editando jugador: " +
      player.name;

    const submitButton =
      $("#playerForm").querySelector(
        'button[type="submit"]'
      );

    if (submitButton) {
      submitButton.textContent =
        "Actualizar jugador";
    }



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

   home_score: Number($("#homeScore").value) || 0,
away_score: Number($("#awayScore").value) || 0
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
let selectedGameCategory = null;
async function loadAdminGames() {
  if (!db) return;

  const { data, error } = await db
    .from("games")
    .select("*")
    .order("game_date", { ascending: false })
    .limit(30);

  const el = $("#adminGames");
const categoryMenu = $("#adminGameCategories");

const gameCategories = [
  "U13 Varones",
  "U16 Varones",
  "U18 Varones",
  "U23 Varones",
  "Primera División",
  "Segunda División",
  "U13 Damas",
  "U16 Damas",
  "U18 Damas"
];

if (categoryMenu) {
  categoryMenu.innerHTML = `
    <div class="admin-category-menu">
      <h3>PARTIDOS REGISTRADOS</h3>
      ${gameCategories
        .map(
          (category) => `
            <button
              type="button"
              class="small-btn game-category-btn"
              data-game-category="${category}"
            >
              ${category} →
            </button>
          `
        )
        .join("")}
    </div>
  `;
}
if (categoryMenu) {
  categoryMenu
    .querySelectorAll(".game-category-btn")
    .forEach((button) => {
      button.addEventListener("click", () => {
        selectedGameCategory =
          button.dataset.gameCategory;

        loadAdminGames();
      });
    });
}
const visibleGames = selectedGameCategory
  ? (data || []).filter(
      (game) => game.category === selectedGameCategory
    )
  : [];
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
    visibleGames.map((g) => {

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
$("#homeScore").value = game.home_score ?? 0;
$("#awayScore").value = game.away_score ?? 0;
updateScoreBox();
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



    });

  });


  // BOTÓN EN VIVO
  el.querySelectorAll("[data-live]").forEach((b) => {
async function loadAdminGames() {
  if (!db) return;

  const { data, error } = await db
    .from("games")
    .select("*")
    .order("game_date", { ascending: false });

  const el = $("#adminGames");
  const categoryMenu = $("#adminGameCategories");

  const gameCategories = [
    "U13 Varones",
    "U16 Varones",
    "U18 Varones",
    "U23 Varones",
    "Primera División",
    "Segunda División",
    "U13 Damas",
    "U16 Damas",
    "U18 Damas"
  ];

  if (error) {
    if (categoryMenu) categoryMenu.innerHTML = "";
    el.innerHTML =
      '<div class="empty">Error cargando partidos.</div>';
    console.error(error);
    return;
  }

  /*
   * ==========================
   * MENÚ PRINCIPAL DE CATEGORÍAS
   * ==========================
   */

  if (!selectedGameCategory) {

    if (categoryMenu) {
      categoryMenu.innerHTML = `
        <div class="admin-category-menu">

          <h3>PARTIDOS REGISTRADOS</h3>

          ${gameCategories
            .map(
              (category) => `
                <button
                  type="button"
                  class="small-btn game-category-btn"
                  data-game-category="${esc(category)}"
                >
                  ${esc(category)} →
                </button>
              `
            )
            .join("")}

        </div>
      `;
    }

    el.innerHTML = "";

    if (categoryMenu) {
      categoryMenu
        .querySelectorAll(".game-category-btn")
        .forEach((button) => {
          button.addEventListener("click", () => {
            selectedGameCategory =
              button.dataset.gameCategory;

            loadAdminGames();
          });
        });
    }

    return;
  }

  /*
   * ==========================
   * VISTA DE UNA CATEGORÍA
   * ==========================
   */

  if (categoryMenu) {
    categoryMenu.innerHTML = `
      <div class="admin-category-view">

        <button
          type="button"
          class="small-btn"
          id="backGameCategories"
        >
          ← VOLVER
        </button>

        <h3>
          PARTIDOS · ${esc(selectedGameCategory)}
        </h3>

      </div>
    `;
  }

  const visibleGames = (data || []).filter(
    (game) =>
      game.category === selectedGameCategory
  );

  /*
   * ==========================
   * CARGAR LOGOS
   * ==========================
   */

  const { data: teams } = await db
    .from("teams")
    .select("name, logo_url");

  const teamMap = {};

  (teams || []).forEach((team) => {
    teamMap[team.name] =
      team.logo_url || "";
  });

  /*
   * ==========================
   * LISTA DE PARTIDOS
   * ==========================
   */

  el.innerHTML =
    visibleGames
      .map((g) => {

        const homeLogo =
          teamMap[g.home_team] || "";

        const awayLogo =
          teamMap[g.away_team] || "";

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

              <div
                style="
                  display:flex;
                  align-items:center;
                  justify-content:center;
                  gap:10px;
                  margin:4px 0 8px;
                  text-align:center;
                "
              >

                <div
                  style="
                    display:flex;
                    align-items:center;
                    gap:6px;
                    min-width:0;
                  "
                >

                  ${
                    homeLogo
                      ? `
                        <img
                          src="${esc(homeLogo)}"
                          alt=""
                          style="
                            width:34px;
                            height:34px;
                            object-fit:contain;
                          "
                        >
                      `
                      : ""
                  }

                  <b>
                    ${esc(g.home_team)}
                  </b>

                </div>

                <strong
                  style="
                    font-size:18px;
                    white-space:nowrap;
                  "
                >
                  ${g.home_score ?? 0}
                  -
                  ${g.away_score ?? 0}
                </strong>

                <div
                  style="
                    display:flex;
                    align-items:center;
                    gap:6px;
                    min-width:0;
                  "
                >

                  <b>
                    ${esc(g.away_team)}
                  </b>

                  ${
                    awayLogo
                      ? `
                        <img
                          src="${esc(awayLogo)}"
                          alt=""
                          style="
                            width:34px;
                            height:34px;
                            object-fit:contain;
                          "
                        >
                      `
                      : ""
                  }

                </div>

              </div>

              <div
                style="
                  text-align:center;
                  font-size:12px;
                  font-weight:700;
                  margin-bottom:4px;
                "
              >
                ${statusText}
              </div>

              <div
                style="
                  text-align:center;
                  font-size:12px;
                  opacity:.8;
                "
              >
                ${new Date(g.game_date).toLocaleString("es-PE")}
                ·
                📍 ${esc(g.venue || "Cancha Cieneguilla")}
              </div>

            </div>

            <div class="admin-actions">

              <button
                class="small-btn"
                data-edit-game="${esc(g.id)}"
              >
                ✏️ Editar
              </button>

              ${
                g.status !== "finished"
                  ? `
                    ${
                      g.status !== "live"
                        ? `
                          <button
                            class="small-btn"
                            data-live="${esc(g.id)}"
                          >
                            En vivo
                          </button>
                        `
                        : ""
                    }

                    <button
                      class="small-btn"
                      data-finish="${esc(g.id)}"
                    >
                      Finalizar
                    </button>
                  `
                  : ""
              }

              <button
                class="small-btn"
                data-delete-game="${esc(g.id)}"
              >
                🗑️ Eliminar
              </button>

            </div>

          </div>
        `;
      })
      .join("") ||
    '<div class="empty">No hay partidos en esta categoría.</div>';

  /*
   * ==========================
   * BOTÓN VOLVER
   * ==========================
   */

  const backButton =
    document.querySelector(
      "#backGameCategories"
    );

  if (backButton) {
    backButton.addEventListener("click", () => {
      selectedGameCategory = null;
      loadAdminGames();
    });
  }

  /*
   * ==========================
   * BOTÓN EDITAR
   * ==========================
   */

  el
    .querySelectorAll("[data-edit-game]")
    .forEach((b) => {

      b.addEventListener("click", () => {

        const game =
          (data || []).find(
            (item) =>
              item.id ===
              b.dataset.editGame
          );

        if (!game) return;

        $("#gameCategory").value =
          game.category;

        $("#gameDate").value =
          new Date(game.game_date)
            .toISOString()
            .slice(0, 16);

        $("#venue").value =
          game.venue || "";

        $("#gameStatus").value =
          game.status;

        $("#homeScore").value =
          game.home_score ?? 0;

        $("#awayScore").value =
          game.away_score ?? 0;

        updateScoreBox();

        $("#gameForm").dataset.editingId =
          game.id;

        $("#gameMsg").textContent =
          "Editando partido: " +
          game.home_team +
          " vs " +
          game.away_team;

        loadGameTeamOptions().then(() => {

          $("#homeTeam").value =
            game.home_team;

          $("#awayTeam").value =
            game.away_team;

        });

      });

    });

  /*
   * ==========================
   * BOTÓN EN VIVO
   * ==========================
   */

  el
    .querySelectorAll("[data-live]")
    .forEach((b) => {

      b.addEventListener("click", () => {

        setStatus(
          b.dataset.live,
          "live"
        );

      });

    });

  /*
   * ==========================
   * BOTÓN FINALIZAR
   * ==========================
   */

  el
    .querySelectorAll("[data-finish]")
    .forEach((b) => {

      b.addEventListener("click", () => {

        setStatus(
          b.dataset.finish,
          "finished"
        );

      });

    });

  /*
   * ==========================
   * BOTÓN ELIMINAR
   * ==========================
   */

  el
    .querySelectorAll("[data-delete-game]")
    .forEach((b) => {

      b.addEventListener(
        "click",
        async () => {

          const game =
            (data || []).find(
              (item) =>
                item.id ===
                b.dataset.deleteGame
            );

          if (!game) return;

          const confirmar =
            confirm(
              `¿Eliminar el partido ${game.home_team} vs ${game.away_team}?`
            );

          if (!confirmar) return;

          const { error } =
            await db
              .from("games")
              .delete()
              .eq("id", game.id);

          if (error) {

            alert(
              "Error al eliminar: " +
              error.message
            );

            return;
          }

          loadAdminGames();

        }
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
function updateScoreBox() {
  const scoreBox = $("#scoreBox");

  if (!scoreBox) return;

  if ($("#gameStatus").value === "finished") {
    scoreBox.classList.remove("hidden");
  } else {
    scoreBox.classList.add("hidden");
  }
}

$("#gameStatus").addEventListener("change", updateScoreBox);

updateScoreBox();
