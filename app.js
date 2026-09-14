const SUPABASE_URL = 'https://ugayglaqrwccynrikxvp.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_OjWWKzcoEuR9rwhCQyiRcA_3gsKbRpA'
const TablaPlan2026 = 'Plan2026' // Cambia al nombre de tu tabla
const COLUMNA_MES = 'mes a ejecutar' 
const COLUMNAS_MOSTRAR = ['Site Id', 'Site Name', 'TipoN', "mes a ejecutar"] 

// Variable global para guardar todos los datos
let todosLosDatos = []

// Inicializar Supabase
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// Traer datos

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
                    ⚠️ No hay datos en la tabla "${TablaPlan2026}"<br>
                    Verifica:<br>
                    1. El nombre de la tabla es correcto<br>
                    2. La tabla tiene datos<br>
                    3. Row Level Security permite lectura
                </div>`;

            document.getElementById('loading').style.display = 'none';
            return;
        }

        // Guardar TODOS los datos
        todosLosDatos = todosLosRegistros;

        // Mostrar todos los datos
        mostrarTabla(todosLosDatos);

        // Actualizar contador
        const contador = document.getElementById('contadorFilas');
        if (contador) {
            contador.textContent = `Mostrando ${todosLosDatos.length} filas`;
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
            `<div class="error">⚠️ No hay registros para mostrar</div>`
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

    console.log("Total datos recibidos:", todosLosDatos.length);
    console.log("Filtro seleccionado:", mesFiltro);

    if (!mesFiltro) {
        console.log("Mostrando todos:", todosLosDatos.length);
        mostrarTabla(todosLosDatos);
        return;
    }

    const datosFiltrados = todosLosDatos.filter(fila => {
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
            `<div class="error">⚠️ No hay mantenimientos programados para el mes ${mesFiltro}</div>`;
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
    mostrarTabla(todosLosDatos)
}

// Ejecutar al cargar
cargarDatos()