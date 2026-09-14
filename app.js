const SUPABASE_URL = 'https://ugayglaqrwccynrikxvp.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_OjWWKzcoEuR9rwhCQyiRcA_3gsKbRpA'
const TavlaPlan2026 = 'Plan2026' // Cambia al nombre de tu tabla
const COLUMNA_MES = 'mes a ejecutar' 
const COLUMNAS_MOSTRAR = ['Site Id', 'Site Name', 'TipoN', "mes a ejecutar"] 

// Variable global para guardar todos los datos
let todosLosDatos = []

// Inicializar Supabase
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// Traer datos
async function cargarDatos() {
    try {
        console.log('Conectando a tabla:', TavlaPlan2026)
        console.log('URL:', SUPABASE_URL)
        
        const { data, error } = await supabaseClient
            .from(TavlaPlan2026)
            .select('*')

        console.log('Error:', error)
        console.log('Datos recibidos:', data)

        if (error) {
            throw new Error(`Error Supabase: ${error.message}`)
        }

        if (!data || data.length === 0) {
            document.getElementById('error').innerHTML = 
                `<div class="error">⚠️ No hay datos en la tabla "${TavlaPlan2026}"<br>
                Verifica:<br>
                1. El nombre de la tabla es correcto<br>
                2. La tabla tiene datos<br>
                3. Row Level Security permite lectura (ve a Supabase → RLS)<br>
                Abre F12 para ver la consola del navegador</div>`
            document.getElementById('loading').style.display = 'none'
            return
        }

        // Guardar todos los datos en variable global
        todosLosDatos = data
        mostrarTabla(data)
    } catch (err) {
        console.error('Error completo:', err)
        document.getElementById('error').innerHTML = 
            `<div class="error">❌ Error: ${err.message}<br>Abre F12 para más detalles</div>`
        document.getElementById('loading').style.display = 'none'
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
    const contador = document.getElementById('contadorFilas');

    if (!mesFiltro) {
        mostrarTabla(todosLosDatos);

        contador.textContent = `Mostrando ${todosLosDatos.length} filas`;
        return;
    }

    const datosFiltrados = todosLosDatos.filter(fila => {
        const mes = fila[COLUMNA_MES];

        return mes !== null &&
               mes !== undefined &&
               Number(mes) === Number(mesFiltro);
    });

    if (datosFiltrados.length === 0) {
        document.getElementById('tabla').style.display = 'none';
        document.getElementById('error').innerHTML =
            `<div class="error">⚠️ No hay mantenimientos programados para el mes ${mesFiltro}</div>`;

        contador.textContent = 'Mostrando 0 filas';
    } else {
        mostrarTabla(datosFiltrados);

        contador.textContent = `Mostrando ${datosFiltrados.length} filas`;
    }
}





// Limpiar filtro
function limpiarFiltro() {
    document.getElementById('filtroMes').value = ''
    document.getElementById('error').innerHTML = ''
    mostrarTabla(todosLosDatos)
}

// Ejecutar al cargar
cargarDatos()