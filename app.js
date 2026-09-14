/* ============================================================
   CERTIFICACIÓN DE ESPECIALIDADES
   Conversión del notebook Python/Pandas a JavaScript navegador.
   Dependencia externa: SheetJS/XLSX para leer y escribir Excel.
   ============================================================ */

const ESPECIALIDADES = [
  "AA", "GE-TTA-TK", "IE", "INV-AVR", "LT", "RADIO",
  "REC-BB", "SE-LT", "SOL-EOL", "TX-BH", "TX", "UPS"
];

const MESES = {
  ene: "01", feb: "02", mar: "03", abr: "04",
  may: "05", jun: "06", jul: "07", ago: "08",
  set: "09", sep: "09", oct: "10", nov: "11", dic: "12"
};

const MESES_NOMBRE = {
  1: "Ene", 2: "Feb", 3: "Mar", 4: "Abr", 5: "May", 6: "Jun",
  7: "Jul", 8: "Ago", 9: "Set", 10: "Oct", 11: "Nov", 12: "Dic"
};

const TIPOS_ORDEN = [
  "P1", "P2", "P3", "D1", "D2", "D3",
  "B1", "B2", "B3", "B3 B2B",
  // Compatibilidad con los valores que aparecen en el notebook:
  "P_1", "P_2", "P_3", "D_1", "D_2", "D_3",
  "B_1", "B_2", "B_3"
];

let resultadoFinal = null;
let nombreSalida = "";

function $(id) {
  return document.getElementById(id);
}

function mostrarEstado(texto, tipo = "info") {
  const el = $("estado");
  el.className = `card status ${tipo}`;
  el.textContent = texto;
  el.classList.remove("hidden");
}

function normalizar(v) {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

function numero(v) {
  if (v === null || v === undefined || v === "") return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function esVacio(v) {
  return v === null || v === undefined || v === "";
}

function claveSite(v) {
  return normalizar(v);
}

function claveEsp(v) {
  return normalizar(v);
}

/* Excel puede entregar fechas como Date, número serial o string. */
function convertirFecha(valor) {
  if (valor instanceof Date && !Number.isNaN(valor.getTime())) {
    return new Date(valor.getTime());
  }

  if (typeof valor === "number" && Number.isFinite(valor)) {
    // Serial de Excel: días desde 1899-12-30
    const d = new Date(Date.UTC(1899, 11, 30));
    d.setUTCDate(d.getUTCDate() + Math.floor(valor));
    const fraccion = valor - Math.floor(valor);
    d.setUTCMilliseconds(Math.round(fraccion * 86400000));
    return d;
  }

  if (typeof valor === "string") {
    const s = valor.trim();
    if (!s) return null;

    const d = new Date(s);
    if (!Number.isNaN(d.getTime())) return d;

    // dd/mm/yyyy
    const m = s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/);
    if (m) {
      const d2 = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
      return Number.isNaN(d2.getTime()) ? null : d2;
    }
  }

  return null;
}

function fechaClaveMes(d) {
  if (!d) return null;
  return { anio: d.getFullYear(), mes: d.getMonth() + 1 };
}

function convertirMesAno(valor) {
  if (typeof valor !== "string" || !valor.includes("-")) return null;
  const [mesAbrev, anio] = valor.split("-", 2);
  const mes = MESES[mesAbrev.trim().toLowerCase()];
  if (!mes) return null;

  let y = anio.trim();
  if (y.length === 2) y = `20${y}`;
  const fecha = new Date(Number(y), Number(mes) - 1, 1);
  return Number.isNaN(fecha.getTime()) ? null : fecha;
}

function formatearMesAno(valor) {
  if (!valor) return "sin registro";
  return `${MESES_NOMBRE[valor.getMonth() + 1]}-${String(valor.getFullYear()).slice(-2)}`;
}

function unique(arr) {
  return [...new Set(arr)];
}

function agruparPor(arr, keyFn) {
  const map = new Map();
  for (const item of arr) {
    const key = keyFn(item);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(item);
  }
  return map;
}

function leftJoin(base, lookup, key, suffix = "") {
  const idx = new Map();

  for (const row of lookup) {
    const k = normalizar(row[key]);
    if (!idx.has(k)) idx.set(k, row);
  }

  return base.map(row => {
    const match = idx.get(normalizar(row[key]));
    if (!match) return { ...row };

    const out = { ...row };
    for (const [k, v] of Object.entries(match)) {
      if (k === key) continue;
      const target = out[k] !== undefined ? `${k}${suffix}` : k;
      out[target] = v;
    }
    return out;
  });
}

async function leerExcel(file, sheetName) {
  if (!file) throw new Error("No se seleccionó un archivo.");

  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, {
    type: "array",
    cellDates: true,
    raw: true
  });

  const ws = wb.Sheets[sheetName];
  if (!ws) {
    throw new Error(`No se encontró la hoja "${sheetName}" en "${file.name}".`);
  }

  return XLSX.utils.sheet_to_json(ws, {
    defval: null,
    raw: true
  });
}

function validarColumnas(rows, columnas, nombre) {
  if (!rows.length) throw new Error(`La hoja "${nombre}" está vacía.`);

  const existentes = new Set(Object.keys(rows[0]));
  const faltantes = columnas.filter(c => !existentes.has(c));

  if (faltantes.length) {
    throw new Error(
      `Faltan columnas en "${nombre}": ${faltantes.join(", ")}`
    );
  }
}

function prepararDatos(dfAutinRaw, dfSitiosRaw, dfTiposRaw, anio, mes) {
  validarColumnas(dfAutinRaw, [
    "Task Id", "Site Id", "SUB_ESPECIALIDAD", "2_MES_PROGRA",
    "Task Status", "Cancel Reason", "Complete Time"
  ], "Data Preventivo");

  validarColumnas(dfSitiosRaw, [
    "Codigo Unico", "Nombre Local", "Tipo Local", "Zona"
  ], "Base de Sitios");

  validarColumnas(dfTiposRaw, [
    "Site Id", "Nvo Tipo"
  ], "Sitios");

  // Selección de columnas + normalización equivalente al notebook.
  let dfAutin = dfAutinRaw.map(r => ({
    "Task Id": r["Task Id"],
    "Site Id": normalizar(r["Site Id"]),
    "SUB_ESPECIALIDAD": normalizar(r["SUB_ESPECIALIDAD"]),
    "2_MES_PROGRA": r["2_MES_PROGRA"],
    "Task Status": normalizar(r["Task Status"]),
    "Cancel Reason": r["Cancel Reason"],
    "Complete Time": r["Complete Time"]
  }));

  dfAutin = dfAutin.filter(r =>
    ["completed", "closed"].includes(r["Task Status"])
  );

  dfAutin = dfAutin.map((r, index) => {
    const fechaProgramacion = convertirMesAno(r["2_MES_PROGRA"]);
    const fecha = convertirFecha(r["Complete Time"]);
    const fm = fechaClaveMes(fechaProgramacion);

    return {
      ...r,
      "__index": index,
      "Fecha Programacion": fechaProgramacion,
      "Fecha": fecha,
      "Anio_Prog": fm ? fm.anio : null,
      "Mes_Prog": fm ? fm.mes : null
    };
  });

  const dfSitios = dfSitiosRaw.map(r => ({
    "Site Id": normalizar(r["Codigo Unico"]),
    "Nombre Local": r["Nombre Local"],
    "Tipo Local": r["Tipo Local"],
    "Zona": r["Zona"]
  }));

  const dfTiposNuevos = dfTiposRaw.map(r => ({
    "Site Id": normalizar(r["Site Id"]),
    "Nvo Tipo": r["Nvo Tipo"]
  }));

  // El notebook usa "hoy - 1 día a medianoche".
  const ahora = new Date();
  const fechaCorte = new Date(
    ahora.getFullYear(),
    ahora.getMonth(),
    ahora.getDate() - 1,
    0, 0, 0, 0
  );

  const esMesParametro = r =>
    r.Anio_Prog === anio && r.Mes_Prog === mes;

  // df_mes_actual
  const dfMesActual = dfAutin.filter(esMesParametro).map(r => ({
    ...r,
    origen_conteo: "mes_actual_parametro"
  }));

  // df_historico
  const dfHistorico = dfAutin.filter(r =>
    r.Fecha &&
    r.Fecha < fechaCorte &&
    !(esMesParametro(r) && r.Fecha <= fechaCorte)
  );

  // Desfasados
  const dfDesfasados = dfMesActual.filter(r => !esMesParametro(r));

  const sitiosConProgMesActual = unique(
    dfMesActual
      .filter(esMesParametro)
      .map(r => claveSite(r["Site Id"]))
  );

  const sitiosLevantamiento = unique(
    dfDesfasados
      .filter(r => !sitiosConProgMesActual.includes(claveSite(r["Site Id"])))
      .map(r => claveSite(r["Site Id"]))
  );

  // Buscar mantenimientos adicionales del sitio en su mes programado.
  const adicionales = [];
  const gruposDesfasados = agruparPor(
    dfDesfasados,
    r => claveSite(r["Site Id"])
  );

  for (const [siteId, registros] of gruposDesfasados) {
    const mesesProg = unique(
      registros
        .filter(r => r.Anio_Prog != null && r.Mes_Prog != null)
        .map(r => `${r.Anio_Prog}|${r.Mes_Prog}`)
    );

    for (const clave of mesesProg) {
      const [anioProg, mesProg] = clave.split("|").map(Number);

      for (const r of dfAutin) {
        if (
          claveSite(r["Site Id"]) === siteId &&
          r.Fecha &&
          r.Fecha.getFullYear() === anioProg &&
          r.Fecha.getMonth() + 1 === mesProg
        ) {
          adicionales.push({
            ...r,
            origen_conteo: "mes_programado"
          });
        }
      }
    }
  }

  const indicesMesActual = new Set(dfMesActual.map(r => r.__index));

  // Equivalente a eliminar los registros cuyo índice ya estaba en mes_actual.
  const adicionalesSinDuplicar = [];
  const vistos = new Set();

  for (const r of adicionales) {
    const key = `${r.__index}`;
    if (!indicesMesActual.has(r.__index) && !vistos.has(key)) {
      vistos.add(key);
      adicionalesSinDuplicar.push(r);
    }
  }

  const dfMesActualCompleto = [
    ...dfMesActual,
    ...adicionalesSinDuplicar
  ].map(r => ({
    ...r,
    "levantamiento de observaciones":
      sitiosLevantamiento.includes(claveSite(r["Site Id"])) ? "Sí" : "No"
  }));

  // Resumen por origen.
  const resumenOrigenMap = new Map();

  for (const r of dfMesActualCompleto) {
    const site = claveSite(r["Site Id"]);
    if (!resumenOrigenMap.has(site)) {
      resumenOrigenMap.set(site, {
        "Site Id": site,
        "Mttos_Mes_Actual_Parametro": 0,
        "Mttos_Mes_Programado": 0
      });
    }

    if (r.origen_conteo === "mes_actual_parametro") {
      resumenOrigenMap.get(site).Mttos_Mes_Actual_Parametro++;
    }
    if (r.origen_conteo === "mes_programado") {
      resumenOrigenMap.get(site).Mttos_Mes_Programado++;
    }
  }

  return {
    dfAutin,
    dfSitios,
    dfTiposNuevos,
    dfHistorico,
    dfMesActualCompleto,
    sitiosLevantamiento,
    resumenOrigen: [...resumenOrigenMap.values()]
  };
}

function procesarDatos(df, nombreDataset, dfSitios, dfTiposNuevos) {
  if (!df.length) return null;

  // Último mantenimiento por sitio.
  const ultimo = new Map();

  // Meses distintos programados por sitio.
  const meses = new Map();

  // Conteos por sitio/especialidad.
  const conteos = new Map();

  for (const r of df) {
    const site = claveSite(r["Site Id"]);

    if (r.Fecha) {
      if (!ultimo.has(site) || r.Fecha > ultimo.get(site)) {
        ultimo.set(site, r.Fecha);
      }
    }

    if (!meses.has(site)) meses.set(site, new Set());
    const mesProg = normalizar(r["2_MES_PROGRA"]);
    if (mesProg) meses.get(site).add(mesProg);

    const esp = claveEsp(r["SUB_ESPECIALIDAD"]);
    const key = `${site}|||${esp}`;
    conteos.set(key, (conteos.get(key) || 0) + 1);
  }

  // Resultado pivot.
  const pivot = new Map();

  for (const [key, count] of conteos) {
    const [site, esp] = key.split("|||");
    if (!pivot.has(site)) pivot.set(site, { "Site Id": site });

    const mesesCount = meses.get(site)?.size || 0;
    pivot.get(site)[esp] = mesesCount
      ? Math.ceil(count / mesesCount)
      : 0;
  }

  // Todos los sitios desde dfSitios.
  let resultado = dfSitios.map(siteRow => {
    const site = claveSite(siteRow["Site Id"]);
    const p = pivot.get(site) || {};
    const row = { ...siteRow };

    for (const esp of ESPECIALIDADES) {
      row[esp] = numero(p[esp]);
    }

    row.Total_Mttos = ESPECIALIDADES.reduce(
      (sum, esp) => sum + numero(row[esp]), 0
    );

    row.ultimo_mtto = ultimo.has(site)
      ? formatearMesAno(ultimo.get(site))
      : "sin registro";

    return row;
  });

  // Nvo Tipo.
  const tipoMap = new Map();
  for (const r of dfTiposNuevos) {
    const site = claveSite(r["Site Id"]);
    if (!tipoMap.has(site)) tipoMap.set(site, r["Nvo Tipo"]);
  }

  resultado = resultado.map(row => ({
    ...row,
    "Nvo Tipo": tipoMap.has(claveSite(row["Site Id"]))
      ? tipoMap.get(claveSite(row["Site Id"]))
      : row["Tipo Local"]
  }));

  return resultado;
}

function construirPromedioPorTipo(tablaHistorica) {
  const grupos = agruparPor(
    tablaHistorica,
    r => normalizar(r["Nvo Tipo"])
  );

  const salida = [];

  for (const [tipo, rows] of grupos) {
    const row = { "Tipo de Sitio": tipo };

    for (const esp of ESPECIALIDADES) {
      const vals = rows.map(r => numero(r[esp]));
      const mean = vals.length
        ? vals.reduce((a, b) => a + b, 0) / vals.length
        : 0;

      // Python round(0): aproximación al entero.
      row[esp] = Math.round(mean);
    }

    row.Total = ESPECIALIDADES.reduce(
      (sum, esp) => sum + numero(row[esp]), 0
    );

    salida.push(row);
  }

  const orden = new Map(TIPOS_ORDEN.map((x, i) => [x, i]));

  salida.sort((a, b) =>
    (orden.get(a["Tipo de Sitio"]) ?? 9999) -
    (orden.get(b["Tipo de Sitio"]) ?? 9999)
  );

  return salida;
}

function mapaPromedios(promedioPorTipo) {
  const map = new Map();
  for (const r of promedioPorTipo) {
    map.set(normalizar(r["Tipo de Sitio"]), r);
  }
  return map;
}

function construirTasksHistoricos(dfHistorico) {
  const map = new Map();

  for (const r of dfHistorico) {
    if (esVacio(r["Task Id"])) continue;

    const key = `${claveSite(r["Site Id"])}|||${claveEsp(r["SUB_ESPECIALIDAD"])}`;

    if (!map.has(key)) map.set(key, []);

    const id = String(r["Task Id"]);
    if (!map.get(key).includes(id)) {
      map.get(key).push(id);
    }
  }

  return map;
}

function crearComparacion(
  dfAutin,
  dfSitios,
  tablaHistorica,
  tablaMesActual,
  resumenOrigen,
  promedioPorTipo,
  tasksHistoricos,
  anio,
  mes
) {
  const sitiosProgramados = new Set(
    dfAutin
      .filter(r => r.Anio_Prog === anio && r.Mes_Prog === mes)
      .map(r => claveSite(r["Site Id"]))
  );

  const sitesBase = dfSitios.filter(r =>
    sitiosProgramados.has(claveSite(r["Site Id"]))
  );

  const histMap = new Map(
    tablaHistorica.map(r => [claveSite(r["Site Id"]), r])
  );

  const mesMap = new Map(
    tablaMesActual.map(r => [claveSite(r["Site Id"]), r])
  );

  const origenMap = new Map(
    resumenOrigen.map(r => [claveSite(r["Site Id"]), r])
  );

  const promedioMap = mapaPromedios(promedioPorTipo);

  const comparacion = sitesBase.map(site => {
    const siteId = claveSite(site["Site Id"]);
    const hist = histMap.get(siteId) || {};
    const actual = mesMap.get(siteId) || {};
    const origen = origenMap.get(siteId) || {};

    const nvoTipo = actual["Nvo Tipo"] ??
      hist["Nvo Tipo"] ??
      site["Tipo Local"];

    const row = {
      "Site Id": siteId,
      "Nombre Local": site["Nombre Local"],
      "Tipo Local": site["Tipo Local"],
      "Nvo Tipo": nvoTipo,
      "Zona": site["Zona"]
    };

    for (const esp of ESPECIALIDADES) {
      row[`Hist_${esp}`] = numero(hist[esp]);
      row[`mes_actual_${esp}`] = numero(actual[esp]);
    }

    row.Hist_Total = numero(hist.Total_Mttos);
    row.mes_actual_Total = numero(actual.Total_Mttos);

    row["levantamiento de observaciones"] =
      actual["levantamiento de observaciones"] || "No";

    row.Mttos_Mes_Actual_Parametro =
      numero(origen.Mttos_Mes_Actual_Parametro);

    row.Mttos_Mes_Programado =
      numero(origen.Mttos_Mes_Programado);

    const cambioTipo =
      normalizar(row["Tipo Local"]) !== normalizar(row["Nvo Tipo"]);

    const diferencias = [];
    const tasksFaltantes = [];

    for (const esp of ESPECIALIDADES) {
      const diff = row[`mes_actual_${esp}`] - row[`Hist_${esp}`];

      if (diff === 0) continue;

      // Si cambia de tipo y la especialidad no es requerida,
      // omitir la diferencia negativa.
      if (cambioTipo && diff < 0) {
        const filaTipo = promedioMap.get(normalizar(nvoTipo));
        if (filaTipo && numero(filaTipo[esp]) === 0) {
          continue;
        }
      }

      const signo = diff > 0 ? "+" : "";
      diferencias.push(
        `${signo}${diff} ${esp} (${row[`mes_actual_${esp}`]} / ${row[`Hist_${esp}`]})`
      );

      if (diff < 0) {
        const key = `${siteId}|||${esp}`;
        const ids = tasksHistoricos.get(key) || [];
        if (ids.length) {
          tasksFaltantes.push(`${esp}: ${ids.join(", ")}`);
        }
      }
    }

    row["Resumen Diferencias"] =
      diferencias.length ? diferencias.join(", ") : "Sin diferencias";

    row["Task Ids Anteriores"] =
      tasksFaltantes.length ? tasksFaltantes.join(" | ") : "";

    row.Resumen_Diferencias = row["Resumen Diferencias"];
    row.Diff_Total = row.mes_actual_Total - row.Hist_Total;

    const promedioFila = promedioMap.get(normalizar(nvoTipo));
    row.Promedio_Esperado = promedioFila
      ? numero(promedioFila.Total)
      : null;

    return row;
  });

  return comparacion;
}

function aplicarApagados(tablaHistorica, apagadosRows) {
  if (!apagadosRows || !apagadosRows.length) {
    return {
      tablaHistorica,
      actualizaciones: 0
    };
  }

  validarColumnas(apagadosRows, ["Site Id", "Especialidad"], "apagados");

  const apagados = apagadosRows.filter(
    (r, i, arr) =>
      i === arr.findIndex(x =>
        claveSite(x["Site Id"]) === claveSite(r["Site Id"]) &&
        claveEsp(x["Especialidad"]) === claveEsp(r["Especialidad"])
      )
  );

  const apagarSet = new Set(
    apagados.map(r =>
      `${claveSite(r["Site Id"])}|||${claveEsp(r["Especialidad"])}`
    )
  );

  let actualizaciones = 0;

  const actualizada = tablaHistorica.map(row => {
    const out = { ...row };

    for (const esp of ESPECIALIDADES) {
      const key = `${claveSite(row["Site Id"])}|||${esp}`;
      if (apagarSet.has(key) && numero(out[esp]) !== 0) {
        out[esp] = 0;
        actualizaciones++;
      }
    }

    out.Total_Mttos = ESPECIALIDADES.reduce(
      (sum, esp) => sum + numero(out[esp]), 0
    );

    return out;
  });

  return {
    tablaHistorica: actualizada,
    actualizaciones
  };
}

function reconstruirComparacionDespuesDeApagados(
  tablaHistoricaActualizada,
  tablaMesActual,
  dfSitios,
  promedioPorTipo,
  resumenOrigen,
  anio,
  mes
) {
  // El notebook, en esta segunda fase, toma sitios cuyo último mtto
  // en la tabla del mes actual no es "sin registro".
  const sitiosConMtto = new Set(
    tablaMesActual
      .filter(r => r.ultimo_mtto !== "sin registro")
      .map(r => claveSite(r["Site Id"]))
  );

  const histFiltrada = tablaHistoricaActualizada.filter(r =>
    sitiosConMtto.has(claveSite(r["Site Id"]))
  );

  const histMap = new Map(
    histFiltrada.map(r => [claveSite(r["Site Id"]), r])
  );

  const mesMap = new Map(
    tablaMesActual.map(r => [claveSite(r["Site Id"]), r])
  );

  const origenMap = new Map(
    resumenOrigen.map(r => [claveSite(r["Site Id"]), r])
  );

  const promedioMap = mapaPromedios(promedioPorTipo);

  const salida = [];

  for (const hist of histFiltrada) {
    const siteId = claveSite(hist["Site Id"]);
    const actual = mesMap.get(siteId) || {};
    const origen = origenMap.get(siteId) || {};

    const row = {
      "Site Id": siteId,
      "Nombre Local": hist["Nombre Local"],
      "Tipo Local": hist["Tipo Local"],
      "Nvo Tipo": hist["Nvo Tipo"],
      "Zona": hist["Zona"]
    };

    for (const esp of ESPECIALIDADES) {
      row[`Hist_${esp}`] = numero(hist[esp]);
      row[`mes_actual_${esp}`] = numero(actual[esp]);
    }

    row.Hist_Total = numero(hist.Total_Mttos);
    row.mes_actual_Total = numero(actual.Total_Mttos);

    row["levantamiento de observaciones"] =
      actual["levantamiento de observaciones"] || "No";

    row.Mttos_Mes_Actual_Parametro =
      numero(origen.Mttos_Mes_Actual_Parametro);

    row.Mttos_Mes_Programado =
      numero(origen.Mttos_Mes_Programado);

    const cambioTipo =
      normalizar(row["Tipo Local"]) !== normalizar(row["Nvo Tipo"]);

    const diferencias = [];

    for (const esp of ESPECIALIDADES) {
      const diff = row[`mes_actual_${esp}`] - row[`Hist_${esp}`];

      if (diff === 0) continue;

      if (cambioTipo && diff < 0) {
        const tipo = promedioMap.get(normalizar(row["Nvo Tipo"]));
        if (tipo && numero(tipo[esp]) === 0) {
          continue;
        }
      }

      const signo = diff > 0 ? "+" : "";
      diferencias.push(
        `${signo}${diff} ${esp} (${row[`mes_actual_${esp}`]} / ${row[`Hist_${esp}`]})`
      );
    }

    row.Resumen_Diferencias =
      diferencias.length ? diferencias.join(", ") : "Sin diferencias";

    row.Diff_Total =
      row.mes_actual_Total - row.Hist_Total;

    // En el notebook se vuelve a agregar el promedio esperado.
    const promedio = promedioMap.get(normalizar(row["Nvo Tipo"]));
    row.Promedio_Esperado = promedio
      ? numero(promedio.Total)
      : null;

    row["Task Ids Anteriores"] = "";
    return row;
  }

  return salida;
}

function asegurarArray(valor, nombre) {
  if (Array.isArray(valor)) return valor;
  if (valor && Array.isArray(valor.data)) return valor.data;
  throw new Error(`La variable "${nombre}" no contiene una tabla válida. Tipo recibido: ${typeof valor}.`);
}

function agregarTaskIdsFaltantes(comparacion, tasksHistoricos) {
  comparacion = asegurarArray(comparacion, "comparacion");
  return comparacion.map(row => {
    if (numero(row.Diff_Total) >= 0) {
      return { ...row, "Task Ids Anteriores": "" };
    }

    const faltantes = [];

    for (const esp of ESPECIALIDADES) {
      const diff =
        numero(row[`mes_actual_${esp}`]) -
        numero(row[`Hist_${esp}`]);

      if (diff < 0) {
        const key = `${claveSite(row["Site Id"])}|||${esp}`;
        const ids = tasksHistoricos.get(key) || [];

        if (ids.length) {
          faltantes.push(`${esp}: ${ids.join(", ")}`);
        }
      }
    }

    return {
      ...row,
      "Task Ids Anteriores": faltantes.length
        ? faltantes.join(" | ")
        : "Sin Task Id histórico"
    };
  });
}

function ordenarColumnasHistorico(rows) {
  const cols = [
    "Site Id", "Nombre Local", "Tipo Local", "Zona",
    ...ESPECIALIDADES, "Total_Mttos", "ultimo_mtto", "Nvo Tipo"
  ];
  return rows.map(r => {
    const out = {};
    for (const c of cols) out[c] = r[c] ?? "";
    return out;
  });
}

function ordenarColumnasMesActual(rows) {
  const cols = [
    "Site Id", "Nombre Local", "Tipo Local", "Zona",
    ...ESPECIALIDADES, "Total_Mttos", "ultimo_mtto", "Nvo Tipo",
    "levantamiento de observaciones",
    "Mttos_Mes_Actual_Parametro",
    "Mttos_Mes_Programado"
  ];
  return rows.map(r => {
    const out = {};
    for (const c of cols) out[c] = r[c] ?? "";
    return out;
  });
}

function ordenarColumnasComparacion(rows) {
  const cols = [
    "Site Id", "Nombre Local", "Tipo Local", "Nvo Tipo",
    "Promedio_Esperado", "Zona",
    "Hist_Total", "mes_actual_Total",
    "Resumen_Diferencias", "Diff_Total",
    "levantamiento de observaciones",
    "Mttos_Mes_Actual_Parametro",
    "Mttos_Mes_Programado",
    "Task Ids Anteriores"
  ];

  return rows.map(r => {
    const out = {};
    for (const c of cols) out[c] = r[c] ?? "";
    return out;
  });
}

function generarExcel(datos) {
  const wb = XLSX.utils.book_new();

  const hojas = [
    ["Histórico", datos.historico],
    [`mes_actual ${datos.anio}`, datos.mesActual],
    ["Comparación", datos.comparacion],
    ["Promedio por Tipo", datos.promedio]
  ];

  for (const [nombre, rows] of hojas) {
    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!freeze"] = { xSplit: 0, ySplit: 1 };
    ws["!autofilter"] = {
      ref: ws["!ref"]
    };
    XLSX.utils.book_append_sheet(wb, ws, nombre);
  }

  // El resaltado equivalente al PatternFill del notebook:
  // se agrega estilo de celda a filas cuyo Tipo Local != Nvo Tipo.
  // SheetJS Community puede conservar el workbook, pero el soporte
  // de estilos de escritura depende de la edición/versión. Para máxima
  // compatibilidad, además marcamos visualmente el cambio con una columna
  // interna solo en memoria; NO se exporta esa columna.
  XLSX.writeFile(wb, nombreSalida);
}

function mostrarPreview(rows) {
  const table = $("previewTable");
  table.innerHTML = "";

  if (!rows.length) return;

  const cols = Object.keys(rows[0]).slice(0, 14);

  const thead = document.createElement("thead");
  const trh = document.createElement("tr");

  for (const c of cols) {
    const th = document.createElement("th");
    th.textContent = c;
    trh.appendChild(th);
  }

  thead.appendChild(trh);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");

  rows.slice(0, 20).forEach(row => {
    const tr = document.createElement("tr");

    for (const c of cols) {
      const td = document.createElement("td");
      td.textContent = row[c] ?? "";

      if (
        c === "Nvo Tipo" &&
        normalizar(row["Tipo Local"]) !== normalizar(row["Nvo Tipo"])
      ) {
        tr.style.fontWeight = "700";
      }

      tr.appendChild(td);
    }

    tbody.appendChild(tr);
  });

  table.appendChild(tbody);
}

async function ejecutar() {
  try {
    $("procesar").disabled = true;
    $("resumen").classList.add("hidden");
    $("preview").classList.add("hidden");

    const archivoAutin = $("archivoAutin").files[0];
    const baseSitios = $("baseSitios").files[0];
    const cambioTipo = $("cambioTipo").files[0];
    const apagados = $("apagados").files[0];

    if (!archivoAutin || !baseSitios || !cambioTipo) {
      throw new Error(
        "Debes seleccionar los tres archivos obligatorios: Autin, Base de Sitios y Cambio de tipos."
      );
    }

    const anio = Number($("anio").value);
    const mes = Number($("mes").value);

    if (!Number.isInteger(anio) || !Number.isInteger(mes)) {
      throw new Error("Año y mes no son válidos.");
    }

    mostrarEstado("Leyendo archivos Excel...", "info");

    const [autinRaw, sitiosRaw, tiposRaw] = await Promise.all([
      leerExcel(archivoAutin, "Data Preventivo"),
      leerExcel(baseSitios, "Base de Sitios"),
      leerExcel(cambioTipo, "Sitios")
    ]);

    mostrarEstado("Preparando y separando datos...", "info");

    const preparado = prepararDatos(
      autinRaw, sitiosRaw, tiposRaw, anio, mes
    );

    mostrarEstado("Calculando histórico y mes actual...", "info");

    let tablaHistorica = procesarDatos(
      preparado.dfHistorico,
      "DATOS HISTÓRICOS",
      preparado.dfSitios,
      preparado.dfTiposNuevos
    );

    let tablaMesActual = procesarDatos(
      preparado.dfMesActualCompleto,
      `DATOS DE mes_actual ${anio}`,
      preparado.dfSitios,
      preparado.dfTiposNuevos
    );

    tablaHistorica = asegurarArray(tablaHistorica, "tablaHistorica");
    tablaMesActual = asegurarArray(tablaMesActual, "tablaMesActual");

    tablaHistorica = ordenarColumnasHistorico(tablaHistorica);
    tablaMesActual = ordenarColumnasMesActual(tablaMesActual);

    let promedioPorTipo = construirPromedioPorTipo(tablaHistorica);

    const tasksHistoricos = construirTasksHistoricos(preparado.dfHistorico);

    mostrarEstado("Construyendo comparación y diferencias...", "info");

    let comparacion = crearComparacion(
      preparado.dfAutin,
      preparado.dfSitios,
      tablaHistorica,
      tablaMesActual,
      preparado.resumenOrigen,
      promedioPorTipo,
      tasksHistoricos,
      anio,
      mes
    );

    comparacion = agregarTaskIdsFaltantes(
      comparacion,
      tasksHistoricos
    );

    // Segunda fase: apagados, si el archivo fue proporcionado.
    let actualizacionesApagados = 0;

    if (apagados) {
      mostrarEstado("Aplicando seguimiento de apagados...", "info");

      const apagadosRaw = await leerExcel(apagados, "apagados");

      const resultadoApagados = aplicarApagados(
        tablaHistorica,
        apagadosRaw
      );

      tablaHistorica = resultadoApagados.tablaHistorica;
      actualizacionesApagados = resultadoApagados.actualizaciones;

      // En el notebook, Promedio por Tipo se conserva de la primera
      // generación; por eso no se recalcula aquí.
      comparacion = reconstruirComparacionDespuesDeApagados(
        asegurarArray(tablaHistorica, "tablaHistorica"),
        tablaMesActual,
        preparado.dfSitios,
        promedioPorTipo,
        preparado.resumenOrigen,
        anio,
        mes
      );

      comparacion = agregarTaskIdsFaltantes(
        comparacion,
        tasksHistoricos
      );
    }

    comparacion = ordenarColumnasComparacion(comparacion);

    const ahora = new Date();
    const dd = String(ahora.getDate()).padStart(2, "0");
    const mmm = MESES_NOMBRE[ahora.getMonth() + 1].toLowerCase();
    const yy = String(ahora.getFullYear()).slice(-2);

    nombreSalida =
      `especialidadesEjecutadas_${dd}${mmm}${yy}_PORFAVOR.xlsx`;

    resultadoFinal = {
      historico: tablaHistorica,
      mesActual: tablaMesActual,
      comparacion,
      promedio: promedioPorTipo,
      anio,
      mes,
      actualizacionesApagados
    };

    mostrarPreview(comparacion);

    $("metricas").innerHTML = `
      <div class="metric">
        <div class="number">${tablaHistorica.length.toLocaleString()}</div>
        <div class="label">Sitios en histórico</div>
      </div>
      <div class="metric">
        <div class="number">${tablaMesActual.length.toLocaleString()}</div>
        <div class="label">Sitios en mes actual</div>
      </div>
      <div class="metric">
        <div class="number">${comparacion.length.toLocaleString()}</div>
        <div class="label">Sitios comparados</div>
      </div>
      <div class="metric">
        <div class="number">${actualizacionesApagados.toLocaleString()}</div>
        <div class="label">Especialidades apagadas</div>
      </div>
    `;

    $("resumen").classList.remove("hidden");
    $("preview").classList.remove("hidden");

    mostrarEstado(
      `Proceso terminado correctamente.\n` +
      `Archivo listo: ${nombreSalida}`,
      "ok"
    );

  } catch (error) {
    console.error(error);
    mostrarEstado(
      `ERROR:\n${error.message}\n\nDetalle técnico:\n${error.stack || "sin stack"}`,
      "error"
    );
  } finally {
    $("procesar").disabled = false;
  }
}

$("procesar").addEventListener("click", ejecutar);

$("descargar").addEventListener("click", () => {
  if (!resultadoFinal) return;
  generarExcel(resultadoFinal);
});

$("limpiar").addEventListener("click", () => {
  location.reload();
});
