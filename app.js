const SUPABASE_URL = 'https://ugayglaqrwccynrikxvp.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_OjWWKzcoEuR9rwhCQyiRcA_3gsKbRpA'
const TablaPlan2026 = 'Plan2026' // Cambia al nombre de tu tabla
const COLUMNA_MES = 'mes a ejecutar' 
const COLUMNAS_MOSTRAR = ['Site Id', 'Site Name', 'TipoN', "mes a ejecutar"] 
const HojaArchivoMPautin = 'Data Preventivo'
// Variable global para guardar todos los datos
let DatosPlan2026 = []
let datosAutin = []





// Inicializar Supabase
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

async function cargarDatos() {
    try {
        console.log('Conectando a tabla:', TablaPlan2026);
        console.log('URL:', SUPABASE_URL);

        const limite = 1000;
        let todosLosRegistros = [];
        let desde = 0;

        while (true) {
            console.log(`Consultando registros ${desde + 1} hasta ${desde + limite}...`);

            const { data, error } = await supabaseClient
                .from(TablaPlan2026)
                .select('*')
                .range(desde, desde + limite - 1);

            if (error) {
                throw new Error(`Error Supabase: ${error.message}`);
            }

            if (!data || data.length === 0) {
                break;
            }

            todosLosRegistros = todosLosRegistros.concat(data);

            console.log(`Registros obtenidos en esta consulta: ${data.length}`);
            console.log(`Total acumulado: ${todosLosRegistros.length}`);

            // Si llegaron menos de 1000, ya no hay más registros
            if (data.length < limite) {
                break;
            }

            desde += limite;
        }

        console.log('TOTAL DE DATOS RECIBIDOS:', todosLosRegistros.length);

        if (todosLosRegistros.length === 0) {
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

        // Guardar TODOS los datos
        DatosPlan2026 = todosLosRegistros;

        // Mostrar todos los datos
        mostrarTabla(DatosPlan2026);

        // Actualizar contador
        const contador = document.getElementById('contadorFilas');
        if (contador) {
            contador.textContent = `Mostrando ${DatosPlan2026.length} filas`;
        }

    } catch (err) {
        console.error('Error completo:', err);

        document.getElementById('error').innerHTML =
            `<div class="error">
                ❌ Error: ${err.message}<br>
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
    const columnas = COLUMNAS_MOSTRAR
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
            td.textContent = fila[col] || '-'
            tr.appendChild(td)
        })
        tbody.appendChild(tr)
    })

    document.getElementById('error').innerHTML = ''
}

// Aplicar filtro por mes


function aplicarFiltro() {
    const mesFiltro = document.getElementById('filtroMes').value;

    console.log("Total datos recibidos:", DatosPlan2026.length);
    console.log("Filtro seleccionado:", mesFiltro);

    if (!mesFiltro) {
        console.log("Mostrando todos:", DatosPlan2026.length);
        mostrarTabla(DatosPlan2026);
        return;
    }

    const datosFiltrados = DatosPlan2026.filter(fila => {
        const mes = fila[COLUMNA_MES];

        return mes !== null &&
               mes !== undefined &&
               Number(mes) === Number(mesFiltro);
    });

    console.log("Filas encontradas:", datosFiltrados.length);
    console.log("Datos filtrados:", datosFiltrados);

    if (datosFiltrados.length === 0) {
        document.getElementById('tabla').style.display = 'none';
        document.getElementById('error').innerHTML =
            `<div class="error"> No hay mantenimientos programados para el mes ${mesFiltro}</div>`;
    } else {
        mostrarTabla(datosFiltrados);
    }

    document.getElementById('contadorFilas').textContent =
        `Mostrando ${datosFiltrados.length} filas`;
}


// Limpiar filtro
function limpiarFiltro() {
    document.getElementById('filtroMes').value = ''
    document.getElementById('error').innerHTML = ''
    mostrarTabla(DatosPlan2026)
}

// document.getElementById('archivoPMautin').addEventListener('change', (event) => {cargarArchivo(event, 'Data Preventivo');});
// document.getElementById('archivoCMautin').addEventListener('change', (event) => {cargarArchivo(event, 'Data');});


let datosArchivos = {
    correctivos: [],
    alarmas: [],
    otroArchivo: []
};

let estadoArchivos = {
    correctivos: {
        estado: 'pendiente',
        nombre: '',
        filas: 0
    },
    alarmas: {
        estado: 'pendiente',
        nombre: '',
        filas: 0
    },
    otroArchivo: {
        estado: 'pendiente',
        nombre: '',
        filas: 0
    }
};


function cargarArchivo(event, nombreArchivo, nombreHoja) {

    const archivo = event.target.files[0];

    if (!archivo) {
        return;
    }

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


            // ==========================================
            // CSV
            // ==========================================

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


            // ==========================================
            // EXCEL
            // ==========================================

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


                const hoja =
                    workbook.Sheets[nombreHoja];


                datos =
                    XLSX.utils.sheet_to_json(
                        hoja,
                        {
                            defval: null
                        }
                    );
            }


            // ==========================================
            // GUARDAR DATOS
            // ==========================================

            datosArchivos[nombreArchivo] = datos;


            // ==========================================
            // ESTADO: CARGADO
            // ==========================================

            estadoArchivos[nombreArchivo].estado =
                'cargado';

            estadoArchivos[nombreArchivo].nombre =
                archivo.name;

            estadoArchivos[nombreArchivo].filas =
                datos.length;


            actualizarEstadoArchivos();


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


            // ==========================================
            // ESTADO: ERROR
            // ==========================================

            estadoArchivos[nombreArchivo].estado =
                'error';

            estadoArchivos[nombreArchivo].nombre =
                archivo.name;

            estadoArchivos[nombreArchivo].filas =
                0;


            actualizarEstadoArchivos();
        }
    };


    reader.onerror = function() {

        estadoArchivos[nombreArchivo].estado =
            'error';

        actualizarEstadoArchivos();

    };


    // ==========================================
    // INICIAR LECTURA
    // ==========================================

    if (
        archivo.name.toLowerCase().endsWith('.csv')
    ) {

        reader.readAsText(
            archivo,
            'UTF-8'
        );

    } else {

        reader.readAsArrayBuffer(
            archivo
        );
    }
}

function actualizarEstadoArchivos() {

    Object.entries(estadoArchivos).forEach(
        ([nombre, info]) => {

            const estado =
                document.getElementById(
                    `estado-${nombre}`
                );

            const card =
                document.getElementById(
                    `card-${nombre}`
                );


            if (!estado || !card) {
                return;
            }


            // Limpiar clases
            card.classList.remove(
                'cargando',
                'cargado',
                'error'
            );


            // ==========================================
            // PENDIENTE
            // ==========================================

            if (info.estado === 'pendiente') {

                estado.innerHTML =
                    `⚪ Pendiente`;
            }


            // ==========================================
            // CARGANDO
            // ==========================================

            else if (info.estado === 'cargando') {

                card.classList.add('cargando');

                estado.innerHTML =
                    `<span class="estado-cargando">
                        🔄 Cargando...
                    </span>`;
            }


            // ==========================================
            // CARGADO
            // ==========================================

            else if (info.estado === 'cargado') {

                card.classList.add('cargado');

                estado.innerHTML =
                    `<span class="estado-cargado">
                        ✅ Cargado
                    </span>
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

                estado.innerHTML =
                    `<span class="estado-error">
                        ❌ Error al cargar
                    </span>
                    <div class="nombre-archivo">
                        ${info.nombre}
                    </div>`;
            }

        }
    );
}
// ============================================================
// LOGIN
// ============================================================

function iniciarSesion() {

    const usuario =
        document.getElementById("usuario").value.trim();

    const password =
        document.getElementById("password").value.trim();

    const error =
        document.getElementById("loginError");


    // LOGIN TEMPORAL
    // --------------------------------------------------------
    // Cambia estos valores posteriormente por Supabase

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

        error.textContent =
            "Usuario o contraseña incorrectos.";

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

function volverMenu() {

    mostrarPagina("mainPage");

}


// ============================================================
// MOSTRAR PÁGINA
// ============================================================

function mostrarPagina(idPagina) {

    const paginas =
        document.querySelectorAll(".page");

    paginas.forEach(pagina => {

        pagina.classList.add("hidden");

    });


    const pagina =
        document.getElementById(idPagina);

    if (pagina) {

        pagina.classList.remove("hidden");

    }

}



document.addEventListener(
    "DOMContentLoaded",
    function () {

        // Mostrar login al iniciar

        mostrarPagina("loginPage");
        cargarDatos();

    }
);



// Ejecutar al cargar
