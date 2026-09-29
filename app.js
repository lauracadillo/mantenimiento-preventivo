const SUPABASE_URL = 'https://ugayglaqrwccynrikxvp.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_OjWWKzcoEuR9rwhCQyiRcA_3gsKbRpA'

const TablaPlan2026 = 'Plan2026'
const TablaSIOM = "SIOM"
const TablaBaseSitios = "Base de Sitios"

const COLUMNA_MES = 'mes a ejecutar' 
const COLUMNA_SITE_ID = 'Site Id' 
const ColsVerificacionMensual = ['Site Id', 'Site Name', 'TipoN', "mes a ejecutar","swap",  "Frecuencia", 'ultimo_mp', 'ultimo_mc', 'cantidad_mc',  'revision'] 
const ColumnasBaseSitios = {
    siteId: 'Codigo Unico',
    siteName: 'Nombre Local',
    tipo: 'Tipo Local', 
    zona: 'Zona'
    // AGREGAR EN LA BASE DE SUPABASE LA FRECUENCIA DE CADA SITIO !!!
};

// Sitio validado, en espera de confirmación del usuario, para el módulo de Reprogramación.
let sitioPendienteReprogramacion = null;


let DatosPlan2026 = []
let DatosSIOM =[]
let DatosBaseSitios =[]
let DatosMostrados =[]

let datosArchivos = { correctivo: [], preventivo: [], swap:[], blacklist:[]};

let estadoArchivos = {
    correctivo: {estado: 'pendiente', nombre: '', filas: 0},
    preventivo: {estado: 'pendiente', nombre: '', filas: 0},
    swap: {estado: 'pendiente', nombre: '', filas: 0}, 
    blacklist: {estado: 'pendiente', nombre: '', filas: 0} 
};

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

async function cargarTablaSupabase(nombreTabla) {
    console.log('Conectando a tabla:', nombreTabla);

    const limite = 1000;
    let todosLosRegistros = [];
    let desde = 0;

    while (true) {
        const { data, error } = await supabaseClient
            .from(nombreTabla)
            .select('*')
            .range(desde, desde + limite - 1);

        if (error) {
            throw new Error(`Error Supabase en "${nombreTabla}": ${error.message}`);
        }

        if (!data || data.length === 0) {
            break;
        }

        todosLosRegistros = todosLosRegistros.concat(data);

        // Si llegaron menos de 1000, ya no hay más registros
        if (data.length < limite) {
            break;
        }

        desde += limite;
    }

    return todosLosRegistros;
}

async function cargarDatos() {
    try {
        console.log('URL:', SUPABASE_URL);

        const [plan2026,  SIOM, BaseSitios] = await Promise.all([
            cargarTablaSupabase(TablaPlan2026),
            cargarTablaSupabase(TablaSIOM),
            cargarTablaSupabase(TablaBaseSitios)
        ]);

        DatosPlan2026 = plan2026;
        DatosSIOM = SIOM;
        DatosBaseSitios = BaseSitios;

        if (DatosPlan2026.length === 0) {
            document.getElementById('error').innerHTML =
                `<div class="error">
                    No hay datos en la tabla "${TablaPlan2026}"<br>
                    Verifica:<br>
                    1. El nombre de la tabla es correcto<br>
                    2. La tabla tiene datos<br>
                    3. Row Level Security permite lectura
                </div>`;

            document.getElementById('loading').style.display = 'none';
            return;
        }

        asignarColumnasEjecucion();
        
        mostrarTabla(DatosPlan2026);

        const contador = document.getElementById('contadorFilas');
        if (contador) {
            contador.textContent = `Mostrando ${DatosPlan2026.length} filas`;
        }

        // console.log(`Plan2026: ${DatosPlan2026.length} filas`);
        // console.log(`SIOM: ${DatosSIOM.length} filas`);
        // console.log(`SIOM: ${DatosSIOM.length} filas`);

    } catch (err) {
        console.error('Error completo:', err);

        document.getElementById('error').innerHTML =
            `<div class="error">
                Error: ${err.message}<br>
                Abre F12 para más detalles
            </div>`;

        document.getElementById('loading').style.display = 'none';
    }
}

function mostrarTabla(datos) {
    document.getElementById('loading').style.display = 'none'
    document.getElementById('tabla').style.display = 'table'

    // Limpiar tabla anterior
    document.getElementById('encabezados').innerHTML = ''
    document.getElementById('datos').innerHTML = ''

    if (!datos || datos.length === 0) {
        document.getElementById('tabla').style.display = 'none'
        document.getElementById('error').innerHTML = 
            `<div class="error"> No hay registros para mostrar</div>`
            DatosMostrados = [];
            return
    }
    DatosMostrados = datos
    // Encabezados
    const columnas = ColsVerificacionMensual
    const encabezados = document.getElementById('encabezados')
    columnas.forEach(col => {
        const th = document.createElement('th')
        th.textContent = col
        encabezados.appendChild(th)
    })

    // Filas
    const tbody = document.getElementById('datos')
    datos.forEach(fila => {
        const tr = document.createElement('tr')
        columnas.forEach(col => {
            const td = document.createElement('td')
            
            // Aplicar estilos especiales para columnas
            if (col === 'Excluir') {
                const valor = fila[col] || '-';
                td.textContent = valor;
                
                // Aplicar estilos si está excluido
                if (valor !== '-') {
                    td.style.backgroundColor = '#ffebee';
                    td.style.color = '#c62828';
                    td.style.fontWeight = 'bold';
                }
            } else if (col === 'revision') {
                const valor = fila[col] || '';
                td.textContent = valor;
                
                // Aplicar estilos si hay revisión
                if (valor.includes("Excluir")) {
                    td.style.backgroundColor = '#fff3e0';
                    td.style.color = '#e65100';
                    td.style.fontWeight = 'bold';
                }
            } else {
                td.textContent = fila[col] || '-'
            }
            
            tr.appendChild(td)
        })
        tbody.appendChild(tr)
    })

    document.getElementById('error').innerHTML = ''
}

function aplicarFiltro() {
    const mesFiltro = document.getElementById('filtroMes').value;
    const siteIdFiltroRaw = document.getElementById('filtroSiteId').value.trim();

    // Parsear múltiples Site IDs separados por comas
    const siteIdsFiltro = siteIdFiltroRaw
        .split(',')
        .map(id => id.trim().toLowerCase())
        .filter(id => id !== ''); // Eliminar strings vacíos

    console.log("Total datos recibidos:", DatosPlan2026.length);
    console.log("Filtro mes:", mesFiltro, "| Filtros Site ID:", siteIdsFiltro);

    if (!mesFiltro && siteIdsFiltro.length === 0) {
        console.log("Mostrando todos:", DatosPlan2026.length);
        asignarColumnasEjecucion();
        mostrarTabla(DatosPlan2026);
        document.getElementById('error').innerHTML = '';
        document.getElementById('contadorFilas').textContent =
            `Mostrando ${DatosPlan2026.length} filas`;
        return;
    }

    let datosFiltrados = DatosPlan2026;

    if (mesFiltro) {
        datosFiltrados = datosFiltrados.filter(fila => {
            const mes = fila[COLUMNA_MES];
            return mes !== null &&
                   mes !== undefined &&
                   Number(mes) === Number(mesFiltro);
        });
    }

    if (siteIdsFiltro.length > 0) {
        datosFiltrados = datosFiltrados.filter(fila => {
            const siteId = fila[COLUMNA_SITE_ID];
            return siteId !== null &&
                   siteId !== undefined &&
                   siteIdsFiltro.some(filtroId => 
                       String(siteId).toLowerCase().includes(filtroId)
                   );
        });
    }

    console.log("Filas encontradas:", datosFiltrados.length);
    console.log("Datos filtrados:", datosFiltrados);

    if (datosFiltrados.length === 0) {
        document.getElementById('tabla').style.display = 'none';
        document.getElementById('error').innerHTML =
            `<div class="error"> No hay mantenimientos que coincidan con los filtros aplicados</div>`;
    } else {
        document.getElementById('error').innerHTML = '';
        asignarColumnasEjecucion();
        mostrarTabla(datosFiltrados);
    }

    document.getElementById('contadorFilas').textContent =
        `Mostrando ${datosFiltrados.length} filas`;
}

// Limpiar filtro
function limpiarFiltro() {
    document.getElementById('filtroMes').value = '';
    document.getElementById('filtroSiteId').value = '';
    document.getElementById('error').innerHTML = '';
    asignarColumnasEjecucion();
    mostrarTabla(DatosPlan2026);
    document.getElementById('contadorFilas').textContent =
        `Mostrando ${DatosPlan2026.length} filas`;
}



function descargarDatosMostrados() {
    if (!DatosMostrados || DatosMostrados.length === 0) {
        alert('No hay datos para descargar.');
        return;
    }

    // Reconstruir filas exactamente con las columnas visibles en la tabla
    const filasExportar = DatosMostrados.map(fila => {
        const filaExportar = {};
        ColsVerificacionMensual.forEach(col => {
            filaExportar[col] = fila[col] ?? '-';
        });
        return filaExportar;
    });

    const hoja = XLSX.utils.json_to_sheet(filasExportar);
    const libro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(libro, hoja, 'Verificación mensual');

    const fecha = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(libro, `verificacion_mensual_${fecha}.xlsx`);
}



// Funcion para cargar archivos externos 
function cargarArchivo(event, nombreArchivo, nombreHoja) {

    const archivo = event.target.files[0];

    if (!archivo) { return; }

    // ==========================================
    // ESTADO: CARGANDO
    // ==========================================

    estadoArchivos[nombreArchivo].estado = 'cargando';
    estadoArchivos[nombreArchivo].nombre = archivo.name;
    estadoArchivos[nombreArchivo].filas = 0;

    actualizarEstadoArchivos();
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            let datos = [];
            if (
                archivo.name.toLowerCase().endsWith('.csv')
            ) {

                const texto = e.target.result;
                const primeraLinea =
                    texto.split(/\r?\n/)[0];
                let separador = ';';
                if (
                    primeraLinea.includes(',') &&
                    !primeraLinea.includes(';')
                ) {
                    separador = ',';
                }
                const workbook = XLSX.read(
                    texto,
                    {
                        type: 'string',
                        FS: separador
                    }
                );

                const nombrePrimeraHoja =
                    workbook.SheetNames[0];

                const hoja =
                    workbook.Sheets[nombrePrimeraHoja];
                datos = XLSX.utils.sheet_to_json(
                    hoja,
                    {
                        defval: null
                    }
                );

            }

            else {

                const datosBinarios =
                    new Uint8Array(e.target.result);

                const workbook =
                    XLSX.read(
                        datosBinarios,
                        {
                            type: 'array'
                        }
                    );

                if (
                    !workbook.SheetNames.includes(nombreHoja)
                ) {

                    throw new Error(
                        `La hoja "${nombreHoja}" no existe. ` +
                        `Hojas disponibles: ` +
                        `${workbook.SheetNames.join(', ')}`
                    );
                }
                const hoja = workbook.Sheets[nombreHoja];

                datos =
                    XLSX.utils.sheet_to_json(
                        hoja,
                        {
                            defval: null
                        }
                    );
            }

            datosArchivos[nombreArchivo] = datos;

            estadoArchivos[nombreArchivo].estado = 'cargado';
            estadoArchivos[nombreArchivo].nombre = archivo.name;
            estadoArchivos[nombreArchivo].filas = datos.length;

            actualizarEstadoArchivos();

            // RE-RENDERIZAR LA TABLA SI HAY FILTRO APLICADO
            const mesFiltro = document.getElementById('filtroMes').value;
            if (mesFiltro) {
                aplicarFiltro();
            }


            console.log(
                `Archivo ${nombreArchivo} cargado:`,
                datos.length,
                'filas'
            );

        } catch (error) {

            console.error(
                `Error cargando ${archivo.name}:`,
                error
            );

            estadoArchivos[nombreArchivo].estado = 'error';
            estadoArchivos[nombreArchivo].nombre = archivo.name;
            estadoArchivos[nombreArchivo].filas = 0;

            actualizarEstadoArchivos();
        }
    };

    reader.onerror = function() {
        estadoArchivos[nombreArchivo].estado = 'error';
        actualizarEstadoArchivos();
    };

    if (
        archivo.name.toLowerCase().endsWith('.csv')
    ) {
        reader.readAsText(
            archivo,
            'UTF-8'
        );

    } else {
        reader.readAsArrayBuffer( archivo );
    }
}

function actualizarEstadoArchivos() {
    console.log("Actualizando estado de archivos:", estadoArchivos);
    
    Object.entries(estadoArchivos).forEach(([nombre, info]) => {
        const estado = document.getElementById(`estado-${nombre}`);
        const card = document.getElementById(`card-${nombre}`);
        
        // Limpiar clases previas
        card.classList.remove('pendiente', 'cargando', 'cargado', 'error');
        
        // ==========================================
        // PENDIENTE
        // ==========================================
        if (info.estado === 'pendiente') {
            card.classList.add('pendiente');
            estado.innerHTML = `⚪ Pendiente`;
        }
        // ==========================================
        // CARGANDO
        // ==========================================
        else if (info.estado === 'cargando') {
            card.classList.add('cargando');
            estado.innerHTML = `<span class="estado-cargando">🔄 Cargando...</span>`;
        }
        // ==========================================
        // CARGADO
        // ==========================================
        else if (info.estado === 'cargado') {
            card.classList.add('cargado');
            estado.innerHTML = `
                <span class="estado-cargado">✅ Cargado</span>
                <div class="nombre-archivo">
                    ${info.nombre}<br>
                    ${info.filas.toLocaleString()} filas
                </div>`;
        }
        // ==========================================
        // ERROR
        // ==========================================
        else if (info.estado === 'error') {
            card.classList.add('error');
            estado.innerHTML = `
                <span class="estado-error">❌ Error al cargar</span>
                <div class="nombre-archivo">${info.nombre}</div>`;
        }
        
        console.log(`Actualizado ${nombre}: ${info.estado}`);
    });
}

// ============================================================
// FUNCIÓN AUXILIAR: Hallar el ultimo mtto correctivo y preventivo 
// ============================================================

function parsearFecha(valor) {
    if (valor === null || valor === undefined || valor === "") return null;

    if (valor instanceof Date) {
        return isNaN(valor.getTime()) ? null : valor;
    }

    // Serial de Excel
    if (typeof valor === "number") {
        const p = XLSX.SSF.parse_date_code(valor);
        return p ? new Date(p.y, p.m - 1, p.d, p.H || 0, p.M || 0, Math.floor(p.S || 0)) : null;
    }

    const str = String(valor).trim();
    if (!str) return null;

    // Fecha ISO sin hora: interpretarla en hora local (evita el desfase UTC)
    const iso = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (iso) return new Date(+iso[1], +iso[2] - 1, +iso[3]);

    const fecha = new Date(str);
    return isNaN(fecha.getTime()) ? null : fecha;
}

// ============================================================
// ÚLTIMO MP SEGÚN PORCENTAJE DE EJECUCIÓN POR MES (igual que Python)
// ============================================================

const COLUMNA_MES_PROGRA_PM = "2_MES_PROGRA";

const MESES_ABREV = {
    ene: 1, feb: 2, mar: 3, abr: 4, may: 5, jun: 6,
    jul: 7, ago: 8, set: 9, sep: 9, oct: 10, nov: 11, dic: 12
};

function convertirMesAno(valor) {
    /**
     * Convierte 'ene-25' -> 202501 (número comparable).
     * Devuelve null si no se puede interpretar (equivale al dropna de Python).
     */
    if (valor === null || valor === undefined || valor === "") return null;

    if (valor instanceof Date && !isNaN(valor.getTime())) {
        return valor.getFullYear() * 100 + (valor.getMonth() + 1);
    }

    // Si Excel lo guardó como fecha (serial)
    if (typeof valor === "number") {
        const p = XLSX.SSF.parse_date_code(valor);
        return p ? p.y * 100 + p.m : null;
    }

    const str = String(valor).trim();
    if (!str.includes("-")) return null;

    const idx = str.indexOf("-");
    const mesAbrev = str.slice(0, idx).trim().toLowerCase();
    const anioStr = str.slice(idx + 1).trim();

    const mes = MESES_ABREV[mesAbrev];
    if (!mes || !/^\d+$/.test(anioStr)) return null;

    const anio = anioStr.length === 2 ? 2000 + parseInt(anioStr) : parseInt(anioStr);
    return anio * 100 + mes;
}

function obtenerFechaCompletacion(fila) {
    /** First Complete Time si existe, si no Complete Time */
    return parsearFecha(fila["First Complete Time"]) || parsearFecha(fila["Complete Time"]);
}

function crearMapaUltimoMP(datosPreventivo) {
    /**
     * Por cada Site Id:
     *  - agrupa por mes de programación
     *  - recorre los meses del más reciente al más antiguo
     *  - si completados / programados > 50% -> devuelve la fecha efectiva máxima de los completados
     */
    const grupos = {}; // { siteId: { mesProg: { total, fechas: [] } } }

    datosPreventivo.forEach(fila => {
        const siteId = fila["Site Id"]?.toString().trim();
        if (!siteId) return;

        const mesProg = convertirMesAno(fila[COLUMNA_MES_PROGRA_PM]);
        if (mesProg === null) return;

        if (!grupos[siteId]) grupos[siteId] = {};
        if (!grupos[siteId][mesProg]) grupos[siteId][mesProg] = { total: 0, fechas: [], completados: 0 };

        const grupoMes = grupos[siteId][mesProg];
        grupoMes.total++;

        const status = fila["Task Status"]?.toString().trim().toLowerCase();
        if (status === "completed" || status === "closed") {
            grupoMes.completados++;
            const fecha = obtenerFechaCompletacion(fila);
            if (fecha) grupoMes.fechas.push(fecha);
        }
    });

    const resultado = {};

    Object.entries(grupos).forEach(([siteId, meses]) => {
        const mesesOrdenados = Object.keys(meses).map(Number).sort((a, b) => b - a);

        for (const mes of mesesOrdenados) {
            const { total, completados, fechas } = meses[mes];
            if (total === 0) continue;

            if (completados / total > 0.5 && fechas.length > 0) {
                const ultima = new Date(Math.max(...fechas.map(f => f.getTime())));
                resultado[siteId] = formatearFecha(ultima);
                break;
            }
        }
    });

    return resultado;
}

function formatearFecha(fecha) {
    /**
     * Formatea Date como dd/mm/yyyy
     */
    if (!fecha) return null;
    const day = String(fecha.getDate()).padStart(2, '0');
    const month = String(fecha.getMonth() + 1).padStart(2, '0');
    const year = fecha.getFullYear();
    return `${day}/${month}/${year}`;
}

function crearMapaUltimo(datos, campoFecha, campoSiteId) {
    /**
     * Agrupa por Site Id y obtiene el último valor por fecha
     * Equivalente a: .sort_values().groupby().last()
     */
    const mapa = {};
    
    datos.forEach(fila => {
        const siteId = fila[campoSiteId]?.toString();
        const fecha = parsearFecha(fila[campoFecha]);
        
        if (siteId && fecha) {
            // Si no existe o la fecha es más reciente, actualizar
            if (!mapa[siteId] || fecha > mapa[siteId].fecha) {
                mapa[siteId] = {
                    fecha: fecha,
                    fechaFormato: formatearFecha(fecha)
                };
            }
        }
    });
    
    // Retornar solo los strings formateados
    const resultado = {};
    Object.keys(mapa).forEach(siteId => {
        resultado[siteId] = mapa[siteId].fechaFormato;
    });
    
    return resultado;
}

function contarPorSiteId(datos, campoSiteId) {

    const mapa = {};
    
    datos.forEach(fila => {
        const siteId = fila[campoSiteId]?.toString();
        if (siteId) {
            mapa[siteId] = (mapa[siteId] || 0) + 1;
        }
    });
    
    return mapa;
}

function filtrarPorTaskStatus(datos) {

    return datos.filter(fila => {
        const status = fila["Task Status"]?.toString().toLowerCase();
        return status === "completed" || status === "closed";
    });
}

function asignarColumnasEjecucion() {
    /**
     * Asigna las columnas: ultimo_mp, ultimo_mc, cantidad_mc, swap, Excluir, revision
     */
    
    // ==========================================
    // FILTRAR Y PROCESAR PREVENTIVOS
    // ==========================================
    const correctivosEjecutados = filtrarPorTaskStatus(datosArchivos.correctivo || []);

    // Último MP con la lógica de porcentaje de ejecución por mes
    const ultimo_mp = crearMapaUltimoMP(datosArchivos.preventivo || []);
    const ultimo_mp_siom = crearMapaUltimo( DatosSIOM, "Fecha ejecución MNT", "CodUnico" );
    const ultimo_mc = crearMapaUltimo( correctivosEjecutados, "Complete Time", "Site Id" );
    
    const cantidad_mc = contarPorSiteId( correctivosEjecutados, "Site Id" );
    
    // ==========================================
    // ASIGNAR VALORES A CADA FILA
    // ==========================================
    DatosPlan2026.forEach(fila => {
        const siteId = fila["Site Id"]?.toString();
        const tipo = fila["TipoN"];
        
        // Último MP (con fallback a SIOM)
        if (ultimo_mp[siteId]) {
            fila["ultimo_mp"] = ultimo_mp[siteId];
        } else if (ultimo_mp_siom[siteId]) {
            fila["ultimo_mp"] = `${ultimo_mp_siom[siteId]} (siom)`;
        } else {
            fila["ultimo_mp"] = "Sin registro";
        }
        
        // Último MC
        fila["ultimo_mc"] = ultimo_mc[siteId] || "Sin registro";
        
        // Cantidad de MC
        fila["cantidad_mc"] = cantidad_mc[siteId] || 0;
        
        const estadoExclusion = verificarExclusión(siteId, tipo);
        fila["Excluir"] = estadoExclusion.motivo;
        
        // Si tiene SWAP, mostrar "Sí (fecha)", sino "No"
        if (estadoExclusion.excluir && estadoExclusion.motivo.includes("SWAP")) {
            fila["swap"] = estadoExclusion.motivo;
        } else {
            fila["swap"] = "No";
        }
        
        fila["revision"] = get_revision(fila);
    });
    
    console.log("Mapeo de ejecuciones completado");
    console.log("Último MP:", Object.keys(ultimo_mp).length, "sitios");
    console.log("Último MC:", Object.keys(ultimo_mc).length, "sitios");
    console.log("Cantidad MC:", Object.keys(cantidad_mc).length, "sitios");
}
// ============================================================
// FUNCIÓN AUXILIAR: Verificar revisión y exclusiones
// ============================================================

function get_revision(fila) {

    // ==========================================
    // 1. VERIFICAR BLACKLIST
    // ==========================================

    const excluir = fila["Excluir"];

    if (excluir === "Blacklist") {
        return "Excluir - Blacklist";
    }

    // ==========================================
    // 2. VERIFICAR SWAP
    // ==========================================

    const swap_val = fila["swap"] || "";
    const swap_str = swap_val.toString().trim();

    if (swap_str !== "" && swap_str !== "No") {

        // Extraer el año de la fecha del SWAP
        const match_year = swap_str.match(/(\d{4})/);

        if (match_year) {

            const swap_year = parseInt(match_year[1]);

            // ==========================================
            // SWAP 2025
            // ==========================================

            if (swap_year === 2025) {

                const cantidad_mc = Number(fila["cantidad_mc"]) || 0;

                if (cantidad_mc < 2) {
                    return "Excluir - SWAP2025";
                }
            }

            // ==========================================
            // SWAP 2026
            // ==========================================

            if (swap_year === 2026) {
                return "Excluir - SWAP2026";
            }
        }
    }


    // ==========================================
    // 3. VERIFICAR FRECUENCIA VS ÚLTIMO MP
    // ==========================================

    const ultimo_mp_str = fila["ultimo_mp"];
    const frecuencia = fila["Frecuencia"];
    const mes_plan = fila["MES_PROGRA"] ?? fila["mes a ejecutar"];


    if (
        ultimo_mp_str &&
        ultimo_mp_str !== "Sin registro" &&
        frecuencia &&
        mes_plan !== null &&
        mes_plan !== undefined &&
        mes_plan !== ""
    ) {

        try {

            // ==========================================
            // Parsear último_mp (formato dd/mm/yyyy)
            // ==========================================

            const partes_ultimo_mp = ultimo_mp_str.toString().split("/");

            if (partes_ultimo_mp.length === 3) {

                const ultimo_mp_dt = new Date(
                    parseInt(partes_ultimo_mp[2]),
                    parseInt(partes_ultimo_mp[1]) - 1,
                    parseInt(partes_ultimo_mp[0])
                );


                // ==========================================
                // Parsear mes_plan
                // ==========================================

                let mes_plan_dt;

                // Convertir a string para poder usar includes()
                const mes_plan_str = mes_plan.toString();


                if (mes_plan_str.includes("-")) {

                    // Formato ISO: YYYY-MM-DD
                    mes_plan_dt = new Date(mes_plan_str);

                } else if (mes_plan_str.includes("/")) {

                    // Formato: dd/mm/yyyy
                    const partes_mes = mes_plan_str.split("/");

                    mes_plan_dt = new Date(
                        parseInt(partes_mes[2]),
                        parseInt(partes_mes[1]) - 1,
                        parseInt(partes_mes[0])
                    );

                } else {

                    // ==========================================
                    // Número de mes: 1 = enero, 12 = diciembre
                    // Planificación 2026
                    // ==========================================

                    const mes_num = parseInt(mes_plan);

                    mes_plan_dt = new Date(
                        2026,
                        mes_num - 1,
                        1
                    );
                }

                // ==========================================
                // Calcular meses transcurridos
                // ==========================================

                const meses_transcurridos =
                    (mes_plan_dt.getFullYear() - ultimo_mp_dt.getFullYear()) * 12 +
                    (mes_plan_dt.getMonth() - ultimo_mp_dt.getMonth());


                // ==========================================
                // Calcular intervalo según frecuencia
                // ==========================================

                const frecuencia_num = parseInt(frecuencia);

                const intervalo_meses = 12 / frecuencia_num;


                // ==========================================
                // Verificar frecuencia
                // ==========================================

                if (meses_transcurridos < intervalo_meses) {
                    return "Excluir - Frecuencia";
                }
            }

        } catch (error) {

            console.error(
                "Error en cálculo de frecuencia:",
                error,
                "mes_plan:",
                mes_plan,
                "ultimo_mp:",
                ultimo_mp_str
            );
        }
    }


    return "";
}
// ============================================================
// FUNCIÓN AUXILIAR: Verificar estado de exclusión por SWAP y BLACKLIST
// ============================================================

function verificarExclusión(siteId, tipo) {
    
    // Tipos que aplican para exclusión por swap
    const TIPOS_SWAP = ["B_1", "B_2", "B_3"];
    const siteIdStr = siteId?.toString();
    
    // ==========================================
    // VERIFICAR BLACKLIST PRIMERO
    // ==========================================
    if (datosArchivos.blacklist && Array.isArray(datosArchivos.blacklist)) {
        const enBlacklist = datosArchivos.blacklist.some(fila => {
            return fila['CU']?.toString() === siteIdStr;
        });
        
        if (enBlacklist) {
            return {
                excluir: true,
                motivo: 'Blacklist'
            };
        }
    }
    
    // ==========================================
    // VERIFICAR SWAP
    // ==========================================
    
    // Crear mapa de swap indexado por "Site Id"
    const swap_map = {};
    
    if (datosArchivos.swap && Array.isArray(datosArchivos.swap)) {
        datosArchivos.swap.forEach(fila => {
            const siteIdKey = fila["CODIGO UNICO"]?.toString();
            if (siteIdKey) {
                swap_map[siteIdKey] = {
                    "SWAP RAN REAL": fila["SWAP RAN REAL"],
                    "Despliegue": fila["Despliegue"]
                };
            }
        });
    }
    
    // Verificar si el Site Id está en el mapa Y el tipo está en TIPOS_SWAP
    if (!swap_map[siteIdStr] || !TIPOS_SWAP.includes(tipo?.toString())) {
        return {
            excluir: false,
            motivo: "-"
        };
    }
    
    // Obtener valores de swap
    const swap_real = swap_map[siteIdStr]["SWAP RAN REAL"];
    const despliegue = swap_map[siteIdStr]["Despliegue"];
    
    // Validar y parsear fecha de SWAP RAN REAL
    let fecha = despliegue; // Por defecto usar Despliegue

    if (swap_real !== null && swap_real !== undefined && swap_real !== "") {
        try {
            let fecha_ts;

            if (swap_real instanceof Date) {
                // Ya es un objeto Date
                fecha_ts = swap_real;

            } else if (typeof swap_real === "number") {
                // Número serial de Excel (ej: 45660)
                const parsed = XLSX.SSF.parse_date_code(swap_real);
                if (parsed) {
                    fecha_ts = new Date(parsed.y, parsed.m - 1, parsed.d);
                }

            } else {
                // String de texto
                const swap_real_str = String(swap_real).trim();

                if (swap_real_str !== "" && swap_real_str !== "00:00:00") {
                    // Si el string es puramente numérico, también es un serial de Excel
                    if (/^\d+(\.\d+)?$/.test(swap_real_str)) {
                        const parsed = XLSX.SSF.parse_date_code(parseFloat(swap_real_str));
                        if (parsed) {
                            fecha_ts = new Date(parsed.y, parsed.m - 1, parsed.d);
                        }
                    } else {
                        fecha_ts = new Date(swap_real_str);
                    }
                }
            }

            // Verificar si es una fecha válida
            if (fecha_ts && !isNaN(fecha_ts.getTime())) {
                const day = String(fecha_ts.getDate()).padStart(2, '0');
                const month = String(fecha_ts.getMonth() + 1).padStart(2, '0');
                const year = fecha_ts.getFullYear();
                fecha = `${day}/${month}/${year}`;
            }
        } catch (e) {
            console.warn("Error al parsear SWAP RAN REAL:", swap_real, e);
            fecha = despliegue;
        }
    }

    return {
        excluir: true,
        motivo: `SWAP (${fecha})`
    };


}



// ============================================================
// REPROGRAMACIÓN
// ============================================================

function buscarSitioEnBaseSitios(siteId) {
    /**
     * Busca un Site Id dentro de la tabla "Base de Sitios" (ya cargada en DatosBaseSitios).
     * Comparación case-insensitive y sin espacios extra.
     */
    const siteIdStr = siteId?.toString().trim().toLowerCase();

    if (!siteIdStr) return null;

    return DatosBaseSitios.find(fila => {
        const id = fila[ColumnasBaseSitios.siteId]?.toString().trim().toLowerCase();
        return id === siteIdStr;
    }) || null;
}

function verificarReprogramacion() {
    /**
     * Paso 1 del flujo de reprogramación:
     * - Busca el sitio en la Base de Sitios (obtiene TipoN y Frecuencia)
     * - Corre el mismo chequeo de Blacklist / SWAP que usa Verificación mensual
     * - Si es excluible -> alerta y no se puede continuar
     * - Si es reprogramable -> muestra resumen y pide confirmación al usuario
     */

    const resultadoDiv = document.getElementById('reprogResultado');
    const confirmacionDiv = document.getElementById('reprogConfirmacion');

    resultadoDiv.innerHTML = '';
    confirmacionDiv.classList.add('hidden');
    sitioPendienteReprogramacion = null;

    const siteIdInput = document.getElementById('reprogSiteId').value.trim();
    const mesInput = document.getElementById('reprogMes').value;

    if (!siteIdInput) {
        resultadoDiv.innerHTML = `<div class="error">Ingresa un Site ID.</div>`;
        return;
    }

    if (!mesInput) {
        resultadoDiv.innerHTML = `<div class="error">Selecciona el mes a reprogramar.</div>`;
        return;
    }

    // Los filtros de Blacklist y SWAP dependen de los archivos cargados
    // en el módulo de Verificación mensual (misma sesión / misma página).
    if (!datosArchivos.blacklist || datosArchivos.blacklist.length === 0 ||
        !datosArchivos.swap || datosArchivos.swap.length === 0) {
        resultadoDiv.innerHTML =
            `<div class="error">
                Primero carga los archivos de Blacklist y SWAP en el módulo
                "Verificación mensual" para poder validar la reprogramación.
            </div>`;
        return;
    }

    const sitio = buscarSitioEnBaseSitios(siteIdInput);

    if (!sitio) {
        resultadoDiv.innerHTML =
            `<div class="error">El Site ID "${siteIdInput}" no se encontró en la Base de Sitios.</div>`;
        return;
    }

    const tipo = sitio[ColumnasBaseSitios.tipo];
    const frecuencia = sitio[ColumnasBaseSitios.frecuencia];
    const siteName = sitio[ColumnasBaseSitios.siteName] || '-';
    const siteIdReal = sitio[ColumnasBaseSitios.siteId];

    const verificacion = verificarExclusión(siteIdReal, tipo);

    if (verificacion.excluir) {
        alert(`No es posible reprogramar este sitio.\nMotivo: ${verificacion.motivo}`);
        resultadoDiv.innerHTML =
            `<div class="error">Sitio excluido — Motivo: ${verificacion.motivo}</div>`;
        return;
    }

    // Sitio válido: se guarda como pendiente hasta que el usuario confirme
    sitioPendienteReprogramacion = {
        "Site Id": siteIdReal,
        "Site Name": siteName,
        "TipoN": tipo,
        "Frecuencia": frecuencia,
        "mes a ejecutar": Number(mesInput),
        "swap": "No"
    };

    const nombresMes = ["", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
        "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

    resultadoDiv.innerHTML = `
        <div class="reprog-info">
            <p><strong>Site ID:</strong> ${siteIdReal}</p>
            <p><strong>Site Name:</strong> ${siteName}</p>
            <p><strong>Tipo:</strong> ${tipo || '-'}</p>
            <p><strong>Frecuencia:</strong> ${frecuencia || '-'}</p>
            <p><strong>Mes a reprogramar:</strong> ${nombresMes[Number(mesInput)] || mesInput}</p>
        </div>`;

    confirmacionDiv.classList.remove('hidden');
}

async function confirmarReprogramacion() {
    /**
     * Paso 2 del flujo: el usuario aceptó el resumen mostrado.
     * Inserta la nueva fila en la tabla Plan2026 en Supabase.
     */

    if (!sitioPendienteReprogramacion) return;

    const resultadoDiv = document.getElementById('reprogResultado');
    const confirmacionDiv = document.getElementById('reprogConfirmacion');

    try {
        const { error } = await supabaseClient
            .from(TablaPlan2026)
            .insert([sitioPendienteReprogramacion]);

        if (error) {
            throw new Error(error.message);
        }

        resultadoDiv.innerHTML =
            `<div class="estado-cargado">✅ Sitio agregado correctamente a Plan2026.</div>`;
        confirmacionDiv.classList.add('hidden');
        sitioPendienteReprogramacion = null;

        // Refrescar el plan en memoria para que quede reflejado en Verificación mensual
        DatosPlan2026 = await cargarTablaSupabase(TablaPlan2026);
        asignarColumnasEjecucion();

    } catch (err) {
        console.error('Error al reprogramar:', err);
        resultadoDiv.innerHTML = `<div class="error">Error al agregar el sitio: ${err.message}</div>`;
    }
}

function cancelarReprogramacion() {
    sitioPendienteReprogramacion = null;
    document.getElementById('reprogConfirmacion').classList.add('hidden');
    document.getElementById('reprogResultado').innerHTML = '';
}


// ============================================================
// LOGIN
// ============================================================

function iniciarSesion() {

    const usuario = document.getElementById("usuario").value.trim();
    const password = document.getElementById("password").value.trim();
    const error = document.getElementById("loginError");

    // LOGIN TEMPORAL

    const usuarioCorrecto = "admin";
    const passwordCorrecto = "1234";

    if (
        usuario === usuarioCorrecto &&
        password === passwordCorrecto
    ) {

        error.textContent = "";
        document.getElementById("usuarioLogueado")
            .textContent = usuario;
        mostrarPagina("mainPage");

    } else {
        error.textContent = "Usuario o contraseña incorrectos.";
    }
}

// ============================================================
// CERRAR SESIÓN
// ============================================================

function cerrarSesion() {
    document.getElementById("usuario").value = "";
    document.getElementById("password").value = "";
    document.getElementById("loginError").textContent = "";
    mostrarPagina("loginPage");
}

// ============================================================
// ABRIR MÓDULO
// ============================================================

function abrirModulo(modulo) {
    switch (modulo) {
        case "certificacion":
            mostrarPagina("certificacionPage");
            break;

        case "verificacion":
            mostrarPagina("verificacionPage");
            break;

        case "reprogramacion":
            mostrarPagina("reprogramacionPage");
            break;
    }

}


// ============================================================
// COMPARACIÓN MES vs HISTÓRICO (port del script de Python)
// Depende de: datosArchivos.preventivo, DatosBaseSitios,
//             convertirMesAno(), parsearFecha(), XLSX
// El tipo de sitio se toma únicamente de la Base de Sitios (Tipo Local).
// ============================================================

const ESPECIALIDADES = ["AA", "GE-TTA-TK", "IE", "INV-AVR", "LT", "RADIO",
    "REC-BB", "SE-LT", "SOL-EOL", "TX-BH", "TX", "UPS"];

const TIPOS_ORDEN = ["P1", "P2", "P3", "D1", "D2", "D3", "B1", "B2", "B3", "B3 B2B"];
const MESES_TXT = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Set", "Oct", "Nov", "Dic"];

// pandas .round(0) redondea .5 al par más cercano; Math.round no
function redondearPar(x) {
    const f = Math.floor(x);
    const d = x - f;
    if (d < 0.5) return f;
    if (d > 0.5) return f + 1;
    return f % 2 === 0 ? f : f + 1;
}

// ------------------------------------------------------------
// Preparación de datos
// ------------------------------------------------------------

function prepararPreventivosComparacion() {
    // Solo completed / closed (igual que df_autin en Python)
    return (datosArchivos.preventivo || [])
        .filter(f => {
            const st = String(f["Task Status"] ?? "").trim().toLowerCase();
            return st === "completed" || st === "closed";
        })
        .map(f => {
            const prog = convertirMesAno(f["2_MES_PROGRA"]); // yyyymm o null
            return {
                taskId: f["Task Id"],
                siteId: String(f["Site Id"] ?? "").trim(),
                esp: f["SUB_ESPECIALIDAD"],
                mesPrograRaw: f["2_MES_PROGRA"],
                fecha: parsearFecha(f["Complete Time"]),
                anioProg: prog ? Math.floor(prog / 100) : null,
                mesProg: prog ? prog % 100 : null
            };
        });
}

function obtenerSitiosBase() {
    return DatosBaseSitios.map(f => ({
        siteId: String(f[ColumnasBaseSitios.siteId] ?? "").trim(),
        nombre: f[ColumnasBaseSitios.siteName],
        tipo: f[ColumnasBaseSitios.tipo],
        zona: f[ColumnasBaseSitios.zona]
    }));
}

// ------------------------------------------------------------
// procesar_datos: promedio de mttos por especialidad y sitio
// ------------------------------------------------------------

function procesarDatosComparacion(rows, sitios) {
    const porSitio = {};

    rows.forEach(r => {
        if (!r.siteId) return;
        if (!porSitio[r.siteId]) porSitio[r.siteId] = { meses: new Set(), conteo: {}, ultima: null };
        const d = porSitio[r.siteId];

        if (r.mesPrograRaw !== null && r.mesPrograRaw !== undefined && r.mesPrograRaw !== "") {
            d.meses.add(String(r.mesPrograRaw));
        }
        if (r.esp) d.conteo[r.esp] = (d.conteo[r.esp] || 0) + 1;
        if (r.fecha && (!d.ultima || r.fecha > d.ultima)) d.ultima = r.fecha;
    });

    // LEFT JOIN desde la base de sitios: se mantienen TODOS los sitios
    const resultado = new Map();
    sitios.forEach(s => {
        const d = porSitio[s.siteId];
        const fila = { ...s, esp: {}, total: 0, ultimo: "sin registro" };

        ESPECIALIDADES.forEach(e => {
            let v = 0;
            if (d && d.meses.size > 0 && d.conteo[e]) {
                v = Math.ceil(d.conteo[e] / d.meses.size);
            }
            fila.esp[e] = v;
            fila.total += v;
        });

        if (d && d.ultima) {
            fila.ultimo = `${MESES_TXT[d.ultima.getMonth()]}-${String(d.ultima.getFullYear()).slice(-2)}`;
        }

        resultado.set(s.siteId, fila);
    });

    return resultado;
}

// ------------------------------------------------------------
// Función principal
// ------------------------------------------------------------

function generarComparacion(anio, mes) {
    const todos = prepararPreventivosComparacion();
    const sitios = obtenerSitiosBase();

    const enMes = r => r.anioProg === anio && r.mesProg === mes;

    // Fecha de corte: ayer a las 00:00
    const fechaCorte = new Date();
    fechaCorte.setDate(fechaCorte.getDate() - 1);
    fechaCorte.setHours(0, 0, 0, 0);

    // ---------- Mes actual e histórico ----------
    const mesActual = todos.filter(enMes);

    const historico = todos.filter(r =>
        r.fecha && r.fecha < fechaCorte &&
        !(enMes(r) && r.fecha <= fechaCorte)
    );

    // ---------- Levantamiento de observaciones ----------
    const desfasados = mesActual.filter(r => !enMes(r));
    const sitiosConProgMes = new Set(mesActual.filter(enMes).map(r => r.siteId));
    const sitiosLevantamiento = new Set(
        desfasados.filter(r => !sitiosConProgMes.has(r.siteId)).map(r => r.siteId)
    );

    const setMesActual = new Set(mesActual);
    const adicionalesSet = new Set();

    sitiosLevantamiento.forEach(siteId => {
        const pares = new Set(
            desfasados
                .filter(r => r.siteId === siteId && r.anioProg !== null && r.mesProg !== null)
                .map(r => `${r.anioProg}-${r.mesProg}`)
        );
        pares.forEach(par => {
            const [a, m] = par.split("-").map(Number);
            todos.forEach(r => {
                if (r.siteId === siteId && r.fecha &&
                    r.fecha.getFullYear() === a && r.fecha.getMonth() + 1 === m &&
                    !setMesActual.has(r)) {
                    adicionalesSet.add(r);
                }
            });
        });
    });
    const adicionales = [...adicionalesSet];

    // Conteo por origen
    const conteoParam = {};
    const conteoProg = {};
    mesActual.forEach(r => { conteoParam[r.siteId] = (conteoParam[r.siteId] || 0) + 1; });
    adicionales.forEach(r => { conteoProg[r.siteId] = (conteoProg[r.siteId] || 0) + 1; });

    const mesActualCompleto = [...mesActual, ...adicionales];

    // ---------- Tablas por sitio ----------
    const tablaHist = procesarDatosComparacion(historico, sitios);
    const tablaAct = procesarDatosComparacion(mesActualCompleto, sitios);

    // ---------- Task Ids históricos por sitio + especialidad ----------
    const tasksHistoricos = {};
    historico.forEach(r => {
        if (r.taskId === null || r.taskId === undefined || r.taskId === "" || !r.esp) return;
        const key = `${r.siteId}||${r.esp}`;
        if (!tasksHistoricos[key]) tasksHistoricos[key] = new Set();
        tasksHistoricos[key].add(String(r.taskId));
    });

    // ---------- Promedio por tipo de sitio (sobre tabla histórica) ----------
    const grupos = {};
    tablaHist.forEach(f => {
        if (!f.tipo) return;
        if (!grupos[f.tipo]) grupos[f.tipo] = [];
        grupos[f.tipo].push(f);
    });

    const promedioPorTipo = {}; // { tipo: { esp: promedio, Total } }
    Object.entries(grupos).forEach(([tipo, filas]) => {
        const p = {};
        let total = 0;
        ESPECIALIDADES.forEach(e => {
            const media = filas.reduce((acc, f) => acc + f.esp[e], 0) / filas.length;
            p[e] = redondearPar(media);
            total += p[e];
        });
        p.Total = Math.round(total * 100) / 100;
        promedioPorTipo[tipo] = p;
    });

    // ---------- Tabla de comparación ----------
    const sitiosProgramados = new Set(todos.filter(enMes).map(r => r.siteId));

    const comparacion = sitios
        .filter(s => sitiosProgramados.has(s.siteId))
        .map(s => {
            const h = tablaHist.get(s.siteId);
            const a = tablaAct.get(s.siteId);

            const diferencias = [];
            const tasksFaltantes = [];

            ESPECIALIDADES.forEach(esp => {
                const diff = a.esp[esp] - h.esp[esp];
                if (diff === 0) return;

                const signo = diff > 0 ? "+" : "";
                diferencias.push(`${signo}${diff} ${esp} (${a.esp[esp]} / ${h.esp[esp]})`);

                if (diff < 0) {
                    const ids = tasksHistoricos[`${s.siteId}||${esp}`];
                    if (ids && ids.size > 0) tasksFaltantes.push(`${esp}: ${[...ids].join(", ")}`);
                }
            });

            const promTipo = promedioPorTipo[s.tipo];

            return {
                "Site Id": s.siteId,
                "Nombre Local": s.nombre,
                "Tipo Local": s.tipo,
                "Promedio_Esperado": promTipo ? promTipo.Total : "",
                "Zona": s.zona,
                "Hist_Total": h.total,
                "mes_actual_Total": a.total,
                "Resumen_Diferencias": diferencias.length ? diferencias.join(", ") : "Sin diferencias",
                "Diff_Total": a.total - h.total,
                "levantamiento de observaciones": sitiosLevantamiento.has(s.siteId) ? "Sí" : "No",
                "Mttos_Mes_Actual_Parametro": conteoParam[s.siteId] || 0,
                "Mttos_Mes_Programado": conteoProg[s.siteId] || 0,
                "Task Ids Anteriores": tasksFaltantes.join(" | ")
            };
        });

    // Tabla de promedios ordenada como en Python
    const tablaPromedios = Object.entries(promedioPorTipo)
        .map(([tipo, p]) => ({ "Tipo de Sitio": tipo, ...p }))
        .sort((x, y) => {
            const ix = TIPOS_ORDEN.includes(x["Tipo de Sitio"]) ? TIPOS_ORDEN.indexOf(x["Tipo de Sitio"]) : TIPOS_ORDEN.length;
            const iy = TIPOS_ORDEN.includes(y["Tipo de Sitio"]) ? TIPOS_ORDEN.indexOf(y["Tipo de Sitio"]) : TIPOS_ORDEN.length;
            return ix - iy;
        });

    return { comparacion, tablaPromedios };
}

// ------------------------------------------------------------
// UI (certificacionPage): ejecutar, filtrar, mostrar y descargar
// ------------------------------------------------------------

let ResultadoComparacion = { comparacion: [], tablaPromedios: [] };
let ComparacionMostrada = [];

function mostrarLoadingComp(visible) {
    document.getElementById("loadingComp").style.display = visible ? "block" : "none";
}

function mostrarErrorComp(msg) {
    const el = document.getElementById("errorComp");
    el.textContent = msg || "";
    el.style.display = msg ? "block" : "none";
}

function ejecutarComparacion() {
    const anio = Number(document.getElementById("compAnio").value);
    const mes = Number(document.getElementById("compMes").value);

    mostrarErrorComp("");

    if (!anio || !mes) {
        mostrarErrorComp("Indica año y mes.");
        return;
    }
    if (!datosArchivos.preventivo || datosArchivos.preventivo.length === 0) {
        mostrarErrorComp("Carga primero el archivo de preventivos.");
        return;
    }
    if (!DatosBaseSitios || DatosBaseSitios.length === 0) {
        mostrarErrorComp("La Base de Sitios no está cargada.");
        return;
    }

    mostrarLoadingComp(true);
    // setTimeout permite que el loading se pinte antes del cálculo
    setTimeout(() => {
        try {
            ResultadoComparacion = generarComparacion(anio, mes);
            aplicarFiltroComparacion();
        } catch (e) {
            console.error(e);
            mostrarErrorComp("Error al generar la comparación: " + e.message);
        } finally {
            mostrarLoadingComp(false);
        }
    }, 30);
}

function aplicarFiltroComparacion() {
    const texto = document.getElementById("filtroSiteIdComp").value;
    const ids = texto.split(/[\s,;]+/).map(x => x.trim().toUpperCase()).filter(Boolean);

    const todas = ResultadoComparacion.comparacion;
    ComparacionMostrada = ids.length
        ? todas.filter(f => ids.includes(String(f["Site Id"]).toUpperCase()))
        : todas;

    renderTablaComparacion(ComparacionMostrada);

    document.getElementById("contadorComp").textContent = todas.length
        ? `Mostrando ${ComparacionMostrada.length} de ${todas.length} sitios`
        : "";
}

function limpiarFiltroComparacion() {
    document.getElementById("filtroSiteIdComp").value = "";
    aplicarFiltroComparacion();
}

function renderTablaComparacion(filas) {
    const tabla = document.getElementById("tablaComp");
    const encabezados = document.getElementById("encabezadosComp");
    const cuerpo = document.getElementById("datosComp");

    encabezados.innerHTML = "";
    cuerpo.innerHTML = "";

    if (!filas.length) {
        tabla.style.display = "none";
        return;
    }

    Object.keys(filas[0]).forEach(c => {
        const th = document.createElement("th");
        th.textContent = c;
        encabezados.appendChild(th);
    });

    const cols = Object.keys(filas[0]);
    const frag = document.createDocumentFragment();
    filas.forEach(f => {
        const tr = document.createElement("tr");
        cols.forEach(c => {
            const td = document.createElement("td");
            td.textContent = f[c] ?? "-";
            tr.appendChild(td);
        });
        frag.appendChild(tr);
    });
    cuerpo.appendChild(frag);
    tabla.style.display = "table";
}

function descargarComparacion() {
    if (!ComparacionMostrada.length) {
        alert("No hay datos para descargar.");
        return;
    }
    const libro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(libro, XLSX.utils.json_to_sheet(ComparacionMostrada), "Comparación");
    XLSX.utils.book_append_sheet(libro, XLSX.utils.json_to_sheet(ResultadoComparacion.tablaPromedios), "Promedio por tipo");
    XLSX.writeFile(libro, `comparacion_${new Date().toISOString().slice(0, 10)}.xlsx`);
}





// ============================================================
// VOLVER AL MENÚ
// ============================================================

function volverMenu() {mostrarPagina("mainPage");}

// ============================================================
// MOSTRAR PÁGINA
// ============================================================

function mostrarPagina(idPagina) {
    const paginas =
        document.querySelectorAll(".page");

    paginas.forEach(pagina => {pagina.classList.add("hidden");});

    const pagina =
        document.getElementById(idPagina);
    if (pagina) {pagina.classList.remove("hidden");}
}

document.addEventListener(
    "DOMContentLoaded",
    function () {
        // Mostrar login al iniciar
        mostrarPagina("loginPage");
        cargarDatos();
    }
);