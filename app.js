const SUPABASE_URL = 'https://ugayglaqrwccynrikxvp.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_OjWWKzcoEuR9rwhCQyiRcA_3gsKbRpA'

const TablaPlan2026 = 'Plan2026'
 
const TablaBlacklist = "Blacklist"
const TablaSIOM = "SIOM"

const COLUMNA_MES = 'mes a ejecutar' 
const COLUMNA_SITE_ID = 'Site Id' 
const ColsVerificacionMensual = ['Site Id', 'Site Name', 'TipoN', "mes a ejecutar","swap",  "Frecuencia", 'ultimo_mp', 'ultimo_mc', 'cantidad_mc', "Exclusion", 'revision'] 

let DatosPlan2026 = []
let DatosSIOM =[]

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

        const [plan2026,  SIOM] = await Promise.all([
            cargarTablaSupabase(TablaPlan2026),
            cargarTablaSupabase(TablaSIOM)
        ]);

        DatosPlan2026 = plan2026;
        DatosSIOM = SIOM;

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

        console.log(`Plan2026: ${DatosPlan2026.length} filas`);
        console.log(`SIOM: ${DatosSIOM.length} filas`);

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
        return
    }
    
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
    const siteIdFiltro = document.getElementById('filtroSiteId').value.trim().toLowerCase();

    console.log("Total datos recibidos:", DatosPlan2026.length);
    console.log("Filtro mes:", mesFiltro, "| Filtro Site ID:", siteIdFiltro);

    if (!mesFiltro && !siteIdFiltro) {
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

    if (siteIdFiltro) {
        datosFiltrados = datosFiltrados.filter(fila => {
            const siteId = fila[COLUMNA_SITE_ID];
            return siteId !== null &&
                   siteId !== undefined &&
                   String(siteId).toLowerCase().includes(siteIdFiltro);
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
    console.log("📋 Actualizando estado de archivos:", estadoArchivos);
    
    Object.entries(estadoArchivos).forEach(([nombre, info]) => {
        const estado = document.getElementById(`estado-${nombre}`);
        const card = document.getElementById(`card-${nombre}`);
        
        // ⚠️ DEBUG: Mostrar si los elementos existen
        if (!estado) {
            console.warn(`⚠️ No encontrado: #estado-${nombre}`);
            return;
        }
        if (!card) {
            console.warn(`⚠️ No encontrado: #card-${nombre}`);
            return;
        }
        
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
        
        console.log(`✅ Actualizado ${nombre}: ${info.estado}`);
    });
}

// ============================================================
// FUNCIÓN AUXILIAR: Hallar el ultimo mtto correctivo y preventivo 
// ============================================================

function parsearFecha(fechaStr) {
    /**
     * Convierte string a Date
     */
    if (!fechaStr || fechaStr.trim() === "") {
        return null;
    }
    const fecha = new Date(fechaStr);
    return isNaN(fecha.getTime()) ? null : fecha;
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
    /**
     * Cuenta ocurrencias por Site Id
     * Equivalente a: .groupby().count()
     */
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
    /**
     * Filtra por Task Status = "completed" o "closed"
     * Equivalente a: .str.lower().isin(["completed", "closed"])
     */
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
    const preventivosEjecutados = filtrarPorTaskStatus(datosArchivos.preventivo || []);
    const correctivosEjecutados = filtrarPorTaskStatus(datosArchivos.correctivo || []);
    
    const ultimo_mp = crearMapaUltimo( preventivosEjecutados, "Complete Time", "Site Id");
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


