LIGA CIENEGUILLA BASKETBALL — V2

Contenido:
- index.html: página pública responsive.
- admin.html: panel privado para cargar partidos.
- styles.css: diseño adaptable a celular/tablet/PC.
- config.js: conecta el sitio con Supabase.
- app.js / admin.js: lógica pública y administrativa.
- supabase.sql: estructura de base de datos + seguridad + Realtime.
- assets/logo.jpg: logo original proporcionado.

IMPORTANTE:
1. Crea un proyecto en Supabase.
2. Ejecuta supabase.sql en SQL Editor.
3. Crea un usuario administrador en Authentication > Users.
4. Copia Project URL y anon/publishable key a config.js.
5. Sube TODOS estos archivos al repositorio, manteniendo la carpeta assets.
6. GitHub Pages publicará index.html.
7. En admin.html inicia sesión y registra partidos.
8. Los cambios de games/standings/top_scorers pueden reflejarse en la página pública en tiempo real.

Para un torneo real, las tablas de posiciones y estadísticas deben alimentarse desde los datos oficiales que registres.
