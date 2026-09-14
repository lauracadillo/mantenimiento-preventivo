# Certificación de Especialidades — versión web

## Qué hace

Esta versión convierte el notebook `certificacionEspecialidades_v4_FIXED(1).ipynb`
en una aplicación HTML + CSS + JavaScript.

El procesamiento se realiza localmente en el navegador.

## Archivos

- `index.html`: interfaz.
- `styles.css`: estilos.
- `app.js`: lógica de procesamiento.
- `README.md`: instrucciones.

## Archivos de entrada

1. Autin
   - Hoja: `Data Preventivo`
2. Base de sitios
   - Hoja: `Base de Sitios`
3. Cambio de tipos
   - Hoja: `Sitios`
4. Seguimiento de apagados
   - Hoja: `apagados`
   - Opcional.

## Uso

1. Abre `index.html` en Chrome o Edge.
2. Selecciona los tres archivos obligatorios.
3. Selecciona `seguimientoApagados.xlsx` si quieres aplicar los apagados.
4. Selecciona año y mes.
5. Pulsa `Procesar y generar Excel`.
6. Revisa la vista previa.
7. Pulsa `Descargar Excel final`.

## Importante

La aplicación usa SheetJS desde jsDelivr:

https://cdn.jsdelivr.net/npm/xlsx/dist/xlsx.full.min.js

Por eso, al abrirla necesita conexión a Internet para cargar la librería.

Si necesitas que funcione completamente offline, se puede incluir
`xlsx.full.min.js` dentro de la carpeta y eliminar esa dependencia externa.
