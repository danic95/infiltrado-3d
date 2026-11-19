# INFILTRADO 3D

Juego 3D de deducción social para navegador. Una IA hostil se esconde dentro de uno de los robots de la estación orbital Kepler-7: haz tus tareas, no te quedes a solas y descúbrela en la reunión de emergencia.

## Cómo jugar

- Abre `index.html` en un navegador moderno (o actívalo con GitHub Pages).
- Móvil: arrastra el dedo para moverte. Escritorio: WASD o flechas · E usar · R reportar · M mapa · Esc pausa.
- Ganas si expulsan a la IA o si la tripulación completa todas las tareas.

## Qué hace la IA

- **Infiltrado:** caza a robots aislados, evita testigos, finge tareas (sin la ✓ verde), sabotea las luces y a veces se autodenuncia.
- **Reuniones:** cada NPC declara dónde estaba, qué vio y de quién sospecha; la IA miente con una coartada planificada y culpa a otro; los testigos la contradicen. Puedes preguntar, acusar, defender, dar tu coartada o escribir libremente, y luego votar.
- **Voces con Claude (opcional):** dentro de claude.ai el diálogo puede generarse con Claude; fuera de ahí se usa un motor de diálogo local.

## Desarrollo

El código está en `src/` (`src/js/*.js` + `src/template.html`). Para regenerar `index.html`:

```bash
npm install three@0.170.0   # solo para la versión de pruebas local
npm run build
```

Three.js se carga desde jsDelivr (versión fijada 0.170.0). Personajes, mapa y sonidos son originales y generados por código.
