/*
 * C4pital — lógica del banco (sin interfaz).
 *
 * Todo el dinero se guarda en CENTAVOS (números enteros) para evitar errores
 * de redondeo. Las tasas de interés se expresan en % mensual.
 *
 * Este archivo funciona en el navegador (window.Banco) y en Node (para pruebas).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Banco = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const VERSION = 1;

  const CONFIG_INICIAL = {
    nombreBanco: 'C4pital',
    simbolo: '₵',
    saldoInicial: 100000, // centavos (₵1,000.00)
    tasaAhorroMensual: 1, // % mensual, interés compuesto
    tasaPrestamoMensual: 2, // % mensual, cuota fija
    montoMaximoPrestamo: 200000, // centavos (₵2,000.00)
    plazosPrestamo: [3, 6, 12], // meses
    pinDocente: '1234',
  };

  class ErrorBanco extends Error {}

  function falla(mensaje) {
    throw new ErrorBanco(mensaje);
  }

  // ---------- Utilidades de dinero ----------

  /** Convierte un monto escrito por la persona (p. ej. "150.50") a centavos. */
  function aCentavos(valor) {
    if (typeof valor === 'string') valor = valor.trim().replace(',', '.');
    const n = Number(valor);
    if (valor === '' || !Number.isFinite(n)) falla('Escribe un monto válido.');
    return Math.round(n * 100);
  }

  function aUnidades(centavos) {
    return centavos / 100;
  }

  function formatear(centavos, simbolo) {
    const signo = centavos < 0 ? '-' : '';
    const texto = (Math.abs(centavos) / 100).toLocaleString('es-DO', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return signo + (simbolo == null ? CONFIG_INICIAL.simbolo : simbolo) + texto;
  }

  function montoPositivo(centavos) {
    if (!Number.isInteger(centavos) || centavos <= 0) falla('El monto debe ser mayor que cero.');
    return centavos;
  }

  // ---------- Estado ----------

  function estadoInicial() {
    return {
      version: VERSION,
      config: JSON.parse(JSON.stringify(CONFIG_INICIAL)),
      mes: 1,
      siguienteNumero: 1,
      siguienteId: 1,
      clientes: [],
      solicitudes: [],
      historialMeses: [],
    };
  }

  function nuevoId(estado, prefijo) {
    return prefijo + estado.siguienteId++;
  }

  function validarPin(pin) {
    pin = String(pin == null ? '' : pin).trim();
    if (!/^\d{4}$/.test(pin)) falla('El PIN debe tener exactamente 4 números.');
    return pin;
  }

  function buscarCliente(estado, numero) {
    const cliente = estado.clientes.find((c) => c.numero === numero);
    if (!cliente) falla('No existe la cuenta ' + numero + '.');
    return cliente;
  }

  function registrar(estado, cliente, cuenta, monto, tipo, descripcion) {
    cliente.saldos[cuenta] += monto;
    cliente.movimientos.unshift({
      id: nuevoId(estado, 'm'),
      mes: estado.mes,
      fecha: new Date().toISOString(),
      cuenta,
      tipo,
      monto,
      saldo: cliente.saldos[cuenta],
      descripcion,
    });
  }

  // ---------- Apertura de cuentas ----------

  function crearCliente(estado, datos) {
    const nombre = String((datos && datos.nombre) || '').trim();
    if (nombre.length < 2) falla('Escribe el nombre del estudiante.');
    if (estado.clientes.some((c) => c.nombre.toLowerCase() === nombre.toLowerCase())) {
      falla('Ya existe una cuenta a nombre de ' + nombre + '.');
    }
    const pin = validarPin(datos.pin);
    const numero = '4A-' + String(estado.siguienteNumero++).padStart(3, '0');
    const cliente = {
      numero,
      nombre,
      pin,
      creadoMes: estado.mes,
      saldos: { corriente: 0, ahorro: 0 },
      prestamos: [],
      movimientos: [],
    };
    estado.clientes.push(cliente);
    if (estado.config.saldoInicial > 0) {
      registrar(estado, cliente, 'corriente', estado.config.saldoInicial, 'apertura', 'Depósito de apertura de cuenta');
    }
    return cliente;
  }

  function autenticar(estado, numero, pin) {
    const cliente = estado.clientes.find((c) => c.numero === numero);
    if (!cliente || cliente.pin !== String(pin).trim()) falla('Cuenta o PIN incorrectos.');
    return cliente;
  }

  function cambiarPin(estado, numero, pin) {
    buscarCliente(estado, numero).pin = validarPin(pin);
  }

  function eliminarCliente(estado, numero) {
    buscarCliente(estado, numero);
    estado.clientes = estado.clientes.filter((c) => c.numero !== numero);
    estado.solicitudes = estado.solicitudes.filter((s) => s.numero !== numero);
  }

  // ---------- Operaciones básicas ----------

  function depositar(estado, numero, centavos, descripcion) {
    const cliente = buscarCliente(estado, numero);
    montoPositivo(centavos);
    registrar(estado, cliente, 'corriente', centavos, 'deposito', descripcion || 'Depósito en efectivo');
    return cliente.saldos.corriente;
  }

  function retirar(estado, numero, centavos, descripcion) {
    const cliente = buscarCliente(estado, numero);
    montoPositivo(centavos);
    if (centavos > cliente.saldos.corriente) falla('Saldo insuficiente para retirar ese monto.');
    registrar(estado, cliente, 'corriente', -centavos, 'retiro', descripcion || 'Retiro en efectivo');
    return cliente.saldos.corriente;
  }

  function transferir(estado, origen, destino, centavos, concepto) {
    const de = buscarCliente(estado, origen);
    const para = buscarCliente(estado, destino);
    if (de === para) falla('No puedes transferirte a tu propia cuenta.');
    montoPositivo(centavos);
    if (centavos > de.saldos.corriente) falla('Saldo insuficiente para transferir ese monto.');
    const nota = concepto ? ' · ' + String(concepto).trim() : '';
    registrar(estado, de, 'corriente', -centavos, 'transferencia', 'Transferencia a ' + para.nombre + ' (' + para.numero + ')' + nota);
    registrar(estado, para, 'corriente', centavos, 'transferencia', 'Transferencia de ' + de.nombre + ' (' + de.numero + ')' + nota);
  }

  // ---------- Ahorro ----------

  function guardarEnAhorro(estado, numero, centavos) {
    const cliente = buscarCliente(estado, numero);
    montoPositivo(centavos);
    if (centavos > cliente.saldos.corriente) falla('No tienes suficiente dinero en tu cuenta corriente.');
    registrar(estado, cliente, 'corriente', -centavos, 'ahorro', 'Enviado a mi cuenta de ahorro');
    registrar(estado, cliente, 'ahorro', centavos, 'ahorro', 'Recibido desde mi cuenta corriente');
  }

  function sacarDeAhorro(estado, numero, centavos) {
    const cliente = buscarCliente(estado, numero);
    montoPositivo(centavos);
    if (centavos > cliente.saldos.ahorro) falla('No tienes suficiente dinero en tu cuenta de ahorro.');
    registrar(estado, cliente, 'ahorro', -centavos, 'ahorro', 'Enviado a mi cuenta corriente');
    registrar(estado, cliente, 'corriente', centavos, 'ahorro', 'Recibido desde mi cuenta de ahorro');
  }

  /** Proyección de interés compuesto: M = C · (1 + i)^n, mes a mes. */
  function proyeccionAhorro(capital, tasaMensual, meses) {
    const filas = [];
    let saldo = capital;
    for (let mes = 1; mes <= meses; mes++) {
      const interes = Math.round((saldo * tasaMensual) / 100);
      saldo += interes;
      filas.push({ mes, interes, saldo });
    }
    return filas;
  }

  // ---------- Préstamos (cuota fija / sistema francés) ----------

  /** Cuota = P · i / (1 − (1 + i)^−n). Con i = 0, cuota = P / n. */
  function cuotaFija(principal, tasaMensual, plazo) {
    const i = tasaMensual / 100;
    if (i === 0) return Math.round(principal / plazo);
    return Math.round((principal * i) / (1 - Math.pow(1 + i, -plazo)));
  }

  function tablaAmortizacion(principal, tasaMensual, plazo) {
    const cuota = cuotaFija(principal, tasaMensual, plazo);
    const filas = [];
    let saldo = principal;
    for (let n = 1; n <= plazo; n++) {
      const interes = Math.round((saldo * tasaMensual) / 100);
      let capital = cuota - interes;
      // La última cuota se ajusta para que el saldo termine exactamente en cero.
      if (n === plazo) capital = saldo;
      saldo -= capital;
      filas.push({ numero: n, cuota: capital + interes, interes, capital, saldo });
    }
    return filas;
  }

  function resumenPrestamo(prestamo) {
    const tabla = prestamo.tabla;
    const totalPagar = tabla.reduce((s, f) => s + f.cuota, 0);
    const pagadas = prestamo.cuotasPagadas;
    return {
      cuota: tabla[0].cuota,
      totalPagar,
      totalIntereses: totalPagar - prestamo.monto,
      saldoPendiente: pagadas === 0 ? prestamo.monto : tabla[pagadas - 1].saldo,
      cuotasAtrasadas: Math.max(0, prestamo.cuotasVencidas - pagadas),
      proximaCuota: pagadas < tabla.length ? tabla[pagadas].cuota : 0,
      terminado: pagadas >= tabla.length,
    };
  }

  function prestamosActivos(cliente) {
    return cliente.prestamos.filter((p) => !resumenPrestamo(p).terminado);
  }

  function solicitarPrestamo(estado, numero, centavos, plazo, motivo) {
    const cliente = buscarCliente(estado, numero);
    montoPositivo(centavos);
    plazo = Number(plazo);
    if (!estado.config.plazosPrestamo.includes(plazo)) falla('Elige un plazo válido.');
    if (centavos > estado.config.montoMaximoPrestamo) {
      falla('El monto máximo de un préstamo es ' + formatear(estado.config.montoMaximoPrestamo, estado.config.simbolo) + '.');
    }
    if (prestamosActivos(cliente).length > 0) falla('Primero debes terminar de pagar tu préstamo actual.');
    if (estado.solicitudes.some((s) => s.numero === numero)) falla('Ya tienes una solicitud esperando respuesta.');
    const solicitud = {
      id: nuevoId(estado, 's'),
      numero,
      monto: centavos,
      plazo,
      tasa: estado.config.tasaPrestamoMensual,
      motivo: String(motivo || '').trim(),
      mes: estado.mes,
    };
    estado.solicitudes.push(solicitud);
    return solicitud;
  }

  function aprobarPrestamo(estado, idSolicitud) {
    const solicitud = estado.solicitudes.find((s) => s.id === idSolicitud);
    if (!solicitud) falla('La solicitud ya no existe.');
    const cliente = buscarCliente(estado, solicitud.numero);
    const prestamo = {
      id: nuevoId(estado, 'p'),
      monto: solicitud.monto,
      plazo: solicitud.plazo,
      tasa: solicitud.tasa,
      motivo: solicitud.motivo,
      mesInicio: estado.mes,
      cuotasVencidas: 0,
      cuotasPagadas: 0,
      tabla: tablaAmortizacion(solicitud.monto, solicitud.tasa, solicitud.plazo),
    };
    cliente.prestamos.push(prestamo);
    estado.solicitudes = estado.solicitudes.filter((s) => s !== solicitud);
    registrar(estado, cliente, 'corriente', solicitud.monto, 'prestamo', 'Préstamo aprobado (' + solicitud.plazo + ' meses al ' + solicitud.tasa + '% mensual)');
    return prestamo;
  }

  function rechazarPrestamo(estado, idSolicitud) {
    const antes = estado.solicitudes.length;
    estado.solicitudes = estado.solicitudes.filter((s) => s.id !== idSolicitud);
    if (estado.solicitudes.length === antes) falla('La solicitud ya no existe.');
  }

  function cobrarCuota(estado, cliente, prestamo) {
    const fila = prestamo.tabla[prestamo.cuotasPagadas];
    registrar(
      estado,
      cliente,
      'corriente',
      -fila.cuota,
      'cuota',
      'Pago de cuota ' + fila.numero + ' de ' + prestamo.plazo + ' (capital ' + formatear(fila.capital, estado.config.simbolo) + ' + interés ' + formatear(fila.interes, estado.config.simbolo) + ')'
    );
    prestamo.cuotasPagadas++;
  }

  /** Pago manual de una cuota atrasada (o adelantada, si no hay atrasadas). */
  function pagarCuota(estado, numero, idPrestamo) {
    const cliente = buscarCliente(estado, numero);
    const prestamo = cliente.prestamos.find((p) => p.id === idPrestamo);
    if (!prestamo) falla('No se encontró el préstamo.');
    const r = resumenPrestamo(prestamo);
    if (r.terminado) falla('Este préstamo ya está pagado por completo.');
    if (r.proximaCuota > cliente.saldos.corriente) falla('No tienes saldo suficiente para pagar la cuota.');
    cobrarCuota(estado, cliente, prestamo);
  }

  // ---------- Cierre de mes ----------

  /**
   * Avanza el calendario un mes:
   * 1. Paga intereses sobre el saldo de ahorro (interés compuesto).
   * 2. Vence una cuota de cada préstamo y la cobra automáticamente si hay saldo.
   */
  function avanzarMes(estado) {
    const cfg = estado.config;
    const resumen = { mes: estado.mes, interesesPagados: 0, cuotasCobradas: 0, cuotasSinPagar: [] };
    estado.clientes.forEach((cliente) => {
      const interes = Math.round((cliente.saldos.ahorro * cfg.tasaAhorroMensual) / 100);
      if (interes > 0) {
        registrar(estado, cliente, 'ahorro', interes, 'interes', 'Interés ganado del mes ' + estado.mes + ' (' + cfg.tasaAhorroMensual + '%)');
        resumen.interesesPagados += interes;
      }
      cliente.prestamos.forEach((prestamo) => {
        if (prestamo.cuotasPagadas >= prestamo.plazo) return;
        if (prestamo.cuotasVencidas < prestamo.plazo) prestamo.cuotasVencidas++;
        while (prestamo.cuotasPagadas < prestamo.cuotasVencidas) {
          const fila = prestamo.tabla[prestamo.cuotasPagadas];
          if (fila.cuota > cliente.saldos.corriente) break;
          cobrarCuota(estado, cliente, prestamo);
          resumen.cuotasCobradas++;
        }
        const atrasadas = resumenPrestamo(prestamo).cuotasAtrasadas;
        if (atrasadas > 0) resumen.cuotasSinPagar.push({ numero: cliente.numero, nombre: cliente.nombre, atrasadas });
      });
    });
    estado.historialMeses.unshift(resumen);
    estado.mes++;
    return resumen;
  }

  // ---------- Docente ----------

  function actualizarConfig(estado, cambios) {
    const cfg = Object.assign({}, estado.config, cambios);
    if (!String(cfg.nombreBanco).trim()) falla('El banco necesita un nombre.');
    if (!String(cfg.simbolo).trim()) falla('Escribe un símbolo para la moneda.');
    ['saldoInicial', 'montoMaximoPrestamo'].forEach((k) => {
      if (!Number.isInteger(cfg[k]) || cfg[k] < 0) falla('Revisa los montos: no pueden ser negativos.');
    });
    ['tasaAhorroMensual', 'tasaPrestamoMensual'].forEach((k) => {
      if (!Number.isFinite(cfg[k]) || cfg[k] < 0 || cfg[k] > 100) falla('Las tasas deben estar entre 0% y 100%.');
    });
    if (!Array.isArray(cfg.plazosPrestamo) || cfg.plazosPrestamo.length === 0 || cfg.plazosPrestamo.some((p) => !Number.isInteger(p) || p < 1 || p > 60)) {
      falla('Los plazos deben ser meses enteros entre 1 y 60.');
    }
    cfg.pinDocente = validarPin(cfg.pinDocente);
    estado.config = cfg;
  }

  function totales(estado) {
    let corriente = 0;
    let ahorro = 0;
    let deuda = 0;
    estado.clientes.forEach((c) => {
      corriente += c.saldos.corriente;
      ahorro += c.saldos.ahorro;
      c.prestamos.forEach((p) => (deuda += resumenPrestamo(p).saldoPendiente));
    });
    return { corriente, ahorro, deuda, clientes: estado.clientes.length };
  }

  function exportar(estado) {
    return JSON.stringify(estado, null, 2);
  }

  function importar(texto) {
    let datos;
    try {
      datos = JSON.parse(texto);
    } catch (e) {
      falla('El archivo no es una copia de seguridad válida.');
    }
    if (!datos || datos.version !== VERSION || !Array.isArray(datos.clientes) || !datos.config) {
      falla('El archivo no es una copia de seguridad de C4pital.');
    }
    const base = estadoInicial();
    datos.config = Object.assign(base.config, datos.config);
    return Object.assign(base, datos);
  }

  return {
    VERSION,
    CONFIG_INICIAL,
    ErrorBanco,
    aCentavos,
    aUnidades,
    formatear,
    estadoInicial,
    crearCliente,
    autenticar,
    cambiarPin,
    eliminarCliente,
    buscarCliente,
    depositar,
    retirar,
    transferir,
    guardarEnAhorro,
    sacarDeAhorro,
    proyeccionAhorro,
    cuotaFija,
    tablaAmortizacion,
    resumenPrestamo,
    prestamosActivos,
    solicitarPrestamo,
    aprobarPrestamo,
    rechazarPrestamo,
    pagarCuota,
    avanzarMes,
    actualizarConfig,
    totales,
    exportar,
    importar,
  };
});
