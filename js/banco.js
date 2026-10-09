/*
 * C4pital — lógica del banco (sin interfaz).
 *
 * Todo el dinero se guarda en CENTAVOS (números enteros) para evitar errores
 * de redondeo. Las tasas de interés y las comisiones porcentuales se expresan
 * en % (mensual cuando se trata de intereses).
 *
 * Departamentos: cuentas (corriente, ahorro y dólares), tarjeta de crédito,
 * préstamos, certificados de depósito y divisas.
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
    saldoInicial: 100000, // ₵1,000.00
    pinDocente: '1234',

    // Cuentas
    tasaAhorroMensual: 1, // % mensual, interés compuesto
    saldoMinimo: 50000, // ₵500.00: por debajo se cobra mantenimiento
    cargoMantenimiento: 2500, // ₵25.00 al cerrar el mes
    comisionRetiro: 1000, // ₵10.00 por retiro
    comisionTransferencia: 500, // ₵5.00 por transferencia a terceros
    impuestoTransaccion: 0.15, // % sobre retiros y transferencias

    // Préstamos
    tasaPrestamoMensual: 2, // % mensual, préstamo personal
    tasaPrestamoEducativo: 1.5,
    tasaPrestamoEmprendimiento: 1.8,
    montoMaximoPrestamo: 200000, // ₵2,000.00
    plazosPrestamo: [3, 6, 12],
    comisionApertura: 2, // % del monto, se descuenta al desembolsar
    cargoMoraPrestamo: 5000, // ₵50.00 por cada cierre con cuotas atrasadas

    // Tarjeta de crédito
    limiteTarjeta: 150000, // ₵1,500.00
    tasaTarjetaMensual: 4, // % mensual sobre lo que no se paga del corte
    pagoMinimoPorcentaje: 5, // % del saldo al corte
    pagoMinimoFijo: 5000, // ₵50.00 como mínimo
    cargoMoraTarjeta: 10000, // ₵100.00 si no se cubre el pago mínimo
    comisionAvance: 5, // % del avance de efectivo
    cuotaEmisionTarjeta: 10000, // ₵100.00 al activar la tarjeta

    // Certificados de depósito
    tasaCertificadoMensual: 1.5,
    plazosCertificado: [3, 6, 12],
    montoMinimoCertificado: 50000, // ₵500.00
    penalidadCertificado: 2, // % del capital si se cancela antes de tiempo

    // Divisas (₵ por cada US$1)
    tasaCompraUSD: 58.5, // el banco compra dólares a este precio
    tasaVentaUSD: 60.5, // el banco vende dólares a este precio
  };

  const TIPOS_PRESTAMO = {
    personal: { nombre: 'Personal', tasa: 'tasaPrestamoMensual' },
    educativo: { nombre: 'Educativo', tasa: 'tasaPrestamoEducativo' },
    emprendimiento: { nombre: 'Emprendimiento', tasa: 'tasaPrestamoEmprendimiento' },
  };

  const SISTEMAS = {
    frances: 'Francés (cuota fija)',
    aleman: 'Alemán (capital fijo)',
  };

  /** Movimientos que son ingresos para el banco. */
  const TIPOS_INGRESO = ['comision', 'impuesto', 'mora', 'interes-cobrado'];

  const SIMBOLO_USD = 'US$';

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

  function porcentaje(centavos, pct) {
    return Math.round((centavos * pct) / 100);
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

  /** Completa datos que no existían en versiones anteriores de la app. */
  function normalizar(estado) {
    estado.clientes.forEach((c) => {
      c.saldos = Object.assign({ corriente: 0, ahorro: 0, dolares: 0, tarjeta: 0 }, c.saldos);
      if (c.tarjeta === undefined) c.tarjeta = null;
      if (!Array.isArray(c.certificados)) c.certificados = [];
      c.prestamos.forEach((p) => {
        if (!p.tipo) p.tipo = 'personal';
        if (!p.sistema) p.sistema = 'frances';
        if (!p.moraPendiente) p.moraPendiente = 0;
      });
    });
    estado.solicitudes.forEach((s) => {
      if (!s.tipo) s.tipo = 'personal';
      if (!s.sistema) s.sistema = 'frances';
    });
    return estado;
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

  // ---------- Cargos y comisiones ----------

  /** Cargos que el banco cobra por una operación. Devuelve [{ concepto, monto, tipo }]. */
  function cargosDe(estado, operacion, monto) {
    const cfg = estado.config;
    const cargos = [];
    const agregar = (concepto, valor, tipo) => valor > 0 && cargos.push({ concepto, monto: valor, tipo });
    if (operacion === 'retiro' || operacion === 'transferencia') {
      agregar(operacion === 'retiro' ? 'Comisión por retiro' : 'Comisión por transferencia', operacion === 'retiro' ? cfg.comisionRetiro : cfg.comisionTransferencia, 'comision');
      agregar('Impuesto a la transacción (' + cfg.impuestoTransaccion + '%)', porcentaje(monto, cfg.impuestoTransaccion), 'impuesto');
    } else if (operacion === 'avance') {
      agregar('Comisión por avance (' + cfg.comisionAvance + '%)', porcentaje(monto, cfg.comisionAvance), 'comision');
    } else if (operacion === 'apertura-prestamo') {
      agregar('Comisión de apertura (' + cfg.comisionApertura + '%)', porcentaje(monto, cfg.comisionApertura), 'comision');
    }
    return cargos;
  }

  function sumaCargos(cargos) {
    return cargos.reduce((s, c) => s + c.monto, 0);
  }

  function cobrarCargos(estado, cliente, cuenta, cargos) {
    cargos.forEach((c) => registrar(estado, cliente, cuenta, -c.monto, c.tipo, c.concepto));
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
      saldos: { corriente: 0, ahorro: 0, dolares: 0, tarjeta: 0 },
      prestamos: [],
      certificados: [],
      tarjeta: null,
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

  /** Retiro de la cuenta corriente. Con `conCargos` se cobran comisión e impuesto (retiro en cajero). */
  function retirar(estado, numero, centavos, descripcion, conCargos) {
    const cliente = buscarCliente(estado, numero);
    montoPositivo(centavos);
    const cargos = conCargos ? cargosDe(estado, 'retiro', centavos) : [];
    if (centavos + sumaCargos(cargos) > cliente.saldos.corriente) falla('Saldo insuficiente para retirar ese monto y pagar sus cargos.');
    registrar(estado, cliente, 'corriente', -centavos, 'retiro', descripcion || 'Retiro en efectivo');
    cobrarCargos(estado, cliente, 'corriente', cargos);
    return cliente.saldos.corriente;
  }

  /** Pago de un servicio simulado (luz, agua, cantina…): sale de la cuenta corriente. */
  function pagarServicio(estado, numero, centavos, servicio, referencia) {
    const cliente = buscarCliente(estado, numero);
    montoPositivo(centavos);
    servicio = String(servicio || '').trim();
    if (!servicio) falla('Elige el servicio que vas a pagar.');
    if (centavos > cliente.saldos.corriente) falla('Saldo insuficiente para pagar ese servicio.');
    const ref = String(referencia || '').trim();
    registrar(estado, cliente, 'corriente', -centavos, 'pago', 'Pago de ' + servicio + (ref ? ' · Contrato ' + ref : ''));
    return cliente.saldos.corriente;
  }

  /** Transferencia a otro cliente. Quien envía paga la comisión y el impuesto. */
  function transferir(estado, origen, destino, centavos, concepto) {
    const de = buscarCliente(estado, origen);
    const para = buscarCliente(estado, destino);
    if (de === para) falla('No puedes transferirte a tu propia cuenta.');
    montoPositivo(centavos);
    const cargos = cargosDe(estado, 'transferencia', centavos);
    if (centavos + sumaCargos(cargos) > de.saldos.corriente) falla('Saldo insuficiente para transferir ese monto y pagar sus cargos.');
    const nota = concepto ? ' · ' + String(concepto).trim() : '';
    registrar(estado, de, 'corriente', -centavos, 'transferencia', 'Transferencia a ' + para.nombre + ' (' + para.numero + ')' + nota);
    cobrarCargos(estado, de, 'corriente', cargos);
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
      const interes = porcentaje(saldo, tasaMensual);
      saldo += interes;
      filas.push({ mes, interes, saldo });
    }
    return filas;
  }

  // ---------- Fórmulas de matemática financiera ----------

  const formulas = {
    /** I = C · i · n */
    interesSimple(capital, tasa, n) {
      const interes = Math.round(capital * (tasa / 100) * n);
      return { interes, monto: capital + interes };
    },
    /** M = C · (1 + i)^n */
    interesCompuesto(capital, tasa, n) {
      const monto = Math.round(capital * Math.pow(1 + tasa / 100, n));
      return { interes: monto - capital, monto };
    },
    /** VF = A · ((1 + i)^n − 1) / i  (ahorro programado: depósitos iguales al final de cada mes) */
    anualidad(cuota, tasa, n) {
      const i = tasa / 100;
      const monto = Math.round(i === 0 ? cuota * n : (cuota * (Math.pow(1 + i, n) - 1)) / i);
      return { aportado: cuota * n, interes: monto - cuota * n, monto };
    },
    /** Tasa anual equivalente a una mensual: (1 + i)^12 − 1 */
    tasaAnualEquivalente(tasaMensual) {
      return (Math.pow(1 + tasaMensual / 100, 12) - 1) * 100;
    },
    /** Tasa mensual equivalente a una anual: (1 + i)^(1/12) − 1 */
    tasaMensualEquivalente(tasaAnual) {
      return (Math.pow(1 + tasaAnual / 100, 1 / 12) - 1) * 100;
    },
  };

  // ---------- Préstamos ----------

  /** Cuota = P · i / (1 − (1 + i)^−n). Con i = 0, cuota = P / n. */
  function cuotaFija(principal, tasaMensual, plazo) {
    const i = tasaMensual / 100;
    if (i === 0) return Math.round(principal / plazo);
    return Math.round((principal * i) / (1 - Math.pow(1 + i, -plazo)));
  }

  /**
   * Tabla de amortización.
   * - Francés: cuota fija; el abono a capital crece cada mes.
   * - Alemán: abono a capital fijo (P / n); la cuota baja cada mes.
   */
  function tablaAmortizacion(principal, tasaMensual, plazo, sistema) {
    const aleman = sistema === 'aleman';
    const cuota = cuotaFija(principal, tasaMensual, plazo);
    const capitalFijo = Math.round(principal / plazo);
    const filas = [];
    let saldo = principal;
    for (let n = 1; n <= plazo; n++) {
      const interes = porcentaje(saldo, tasaMensual);
      let capital = aleman ? capitalFijo : cuota - interes;
      // La última cuota se ajusta para que el saldo termine exactamente en cero.
      if (n === plazo) capital = saldo;
      saldo -= capital;
      filas.push({ numero: n, cuota: capital + interes, interes, capital, saldo });
    }
    return filas;
  }

  function tasaDeTipo(estado, tipo) {
    const t = TIPOS_PRESTAMO[tipo];
    if (!t) falla('Elige un tipo de préstamo válido.');
    return estado.config[t.tasa];
  }

  function resumenPrestamo(prestamo) {
    const tabla = prestamo.tabla;
    const totalPagar = tabla.reduce((s, f) => s + f.cuota, 0);
    const pagadas = prestamo.cuotasPagadas;
    const proximaCuota = pagadas < tabla.length ? tabla[pagadas].cuota : 0;
    const mora = prestamo.moraPendiente || 0;
    return {
      cuota: tabla[0].cuota,
      totalPagar,
      totalIntereses: totalPagar - prestamo.monto,
      interesesPagados: tabla.slice(0, pagadas).reduce((s, f) => s + f.interes, 0),
      saldoPendiente: pagadas === 0 ? prestamo.monto : tabla[pagadas - 1].saldo,
      cuotasAtrasadas: Math.max(0, prestamo.cuotasVencidas - pagadas),
      proximaCuota,
      mora,
      proximoPago: proximaCuota + mora,
      terminado: pagadas >= tabla.length,
    };
  }

  function prestamosActivos(cliente) {
    return cliente.prestamos.filter((p) => !resumenPrestamo(p).terminado);
  }

  function solicitarPrestamo(estado, numero, centavos, plazo, motivo, tipo, sistema) {
    const cliente = buscarCliente(estado, numero);
    montoPositivo(centavos);
    plazo = Number(plazo);
    tipo = tipo || 'personal';
    sistema = sistema || 'frances';
    if (!SISTEMAS[sistema]) falla('Elige un sistema de amortización válido.');
    const tasa = tasaDeTipo(estado, tipo);
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
      tasa,
      tipo,
      sistema,
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
      tipo: solicitud.tipo || 'personal',
      sistema: solicitud.sistema || 'frances',
      motivo: solicitud.motivo,
      mesInicio: estado.mes,
      cuotasVencidas: 0,
      cuotasPagadas: 0,
      moraPendiente: 0,
      tabla: tablaAmortizacion(solicitud.monto, solicitud.tasa, solicitud.plazo, solicitud.sistema),
    };
    cliente.prestamos.push(prestamo);
    estado.solicitudes = estado.solicitudes.filter((s) => s !== solicitud);
    const nombre = TIPOS_PRESTAMO[prestamo.tipo].nombre.toLowerCase();
    registrar(estado, cliente, 'corriente', solicitud.monto, 'prestamo', 'Préstamo ' + nombre + ' aprobado (' + solicitud.plazo + ' meses al ' + solicitud.tasa + '% mensual)');
    cobrarCargos(estado, cliente, 'corriente', cargosDe(estado, 'apertura-prestamo', solicitud.monto));
    return prestamo;
  }

  function rechazarPrestamo(estado, idSolicitud) {
    const antes = estado.solicitudes.length;
    estado.solicitudes = estado.solicitudes.filter((s) => s.id !== idSolicitud);
    if (estado.solicitudes.length === antes) falla('La solicitud ya no existe.');
  }

  function cobrarCuota(estado, cliente, prestamo) {
    const simbolo = estado.config.simbolo;
    if (prestamo.moraPendiente > 0) {
      registrar(estado, cliente, 'corriente', -prestamo.moraPendiente, 'mora', 'Cargo por mora del préstamo');
      prestamo.moraPendiente = 0;
    }
    const fila = prestamo.tabla[prestamo.cuotasPagadas];
    registrar(
      estado,
      cliente,
      'corriente',
      -fila.cuota,
      'cuota',
      'Pago de cuota ' + fila.numero + ' de ' + prestamo.plazo + ' (capital ' + formatear(fila.capital, simbolo) + ' + interés ' + formatear(fila.interes, simbolo) + ')'
    );
    prestamo.cuotasPagadas++;
  }

  /** Pago manual de una cuota atrasada (o adelantada, si no hay atrasadas). Incluye la mora pendiente. */
  function pagarCuota(estado, numero, idPrestamo) {
    const cliente = buscarCliente(estado, numero);
    const prestamo = cliente.prestamos.find((p) => p.id === idPrestamo);
    if (!prestamo) falla('No se encontró el préstamo.');
    const r = resumenPrestamo(prestamo);
    if (r.terminado) falla('Este préstamo ya está pagado por completo.');
    if (r.proximoPago > cliente.saldos.corriente) falla('No tienes saldo suficiente para pagar la cuota.');
    cobrarCuota(estado, cliente, prestamo);
  }

  // ---------- Tarjeta de crédito ----------

  function activarTarjeta(estado, numero) {
    const cliente = buscarCliente(estado, numero);
    if (cliente.tarjeta) falla('Ya tienes una tarjeta de crédito activa.');
    const cfg = estado.config;
    if (cfg.limiteTarjeta <= 0) falla('El banco no está emitiendo tarjetas en este momento.');
    const digitos = String(4500 + estado.siguienteNumero * 7).padStart(4, '0');
    cliente.tarjeta = {
      numero: '5412 ' + digitos + ' ' + String(1000 + Math.floor(Math.random() * 9000)) + ' ' + cliente.numero.slice(-3).padStart(4, '0'),
      limite: cfg.limiteTarjeta,
      tasa: cfg.tasaTarjetaMensual,
      activadaMes: estado.mes,
      saldoCorte: 0,
      pagoMinimo: 0,
      pagosDesdeCorte: 0,
      mesCorte: null,
    };
    cliente.saldos.tarjeta = 0;
    if (cfg.cuotaEmisionTarjeta > 0) registrar(estado, cliente, 'tarjeta', -cfg.cuotaEmisionTarjeta, 'comision', 'Cuota de emisión de la tarjeta');
    return cliente.tarjeta;
  }

  function resumenTarjeta(cliente) {
    const t = cliente.tarjeta;
    if (!t) return null;
    const deuda = Math.max(0, -cliente.saldos.tarjeta);
    return {
      limite: t.limite,
      deuda,
      disponible: Math.max(0, t.limite - deuda),
      saldoCorte: t.saldoCorte,
      pagoMinimo: t.pagoMinimo,
      pagosDesdeCorte: t.pagosDesdeCorte,
      minimoPendiente: Math.max(0, t.pagoMinimo - t.pagosDesdeCorte),
      cortePendiente: Math.max(0, t.saldoCorte - t.pagosDesdeCorte),
      uso: t.limite ? Math.min(100, Math.round((deuda / t.limite) * 100)) : 0,
    };
  }

  function exigirTarjeta(cliente) {
    if (!cliente.tarjeta) falla('Primero debes activar tu tarjeta de crédito.');
    return resumenTarjeta(cliente);
  }

  function comprarConTarjeta(estado, numero, centavos, comercio) {
    const cliente = buscarCliente(estado, numero);
    const r = exigirTarjeta(cliente);
    montoPositivo(centavos);
    comercio = String(comercio || '').trim() || 'Comercio';
    if (centavos > r.disponible) falla('La compra supera tu crédito disponible (' + formatear(r.disponible, estado.config.simbolo) + ').');
    registrar(estado, cliente, 'tarjeta', -centavos, 'compra', 'Compra en ' + comercio);
  }

  /** Avance de efectivo: el dinero llega a la cuenta corriente y la comisión se carga a la tarjeta. */
  function avanceEfectivo(estado, numero, centavos) {
    const cliente = buscarCliente(estado, numero);
    const r = exigirTarjeta(cliente);
    montoPositivo(centavos);
    const cargos = cargosDe(estado, 'avance', centavos);
    if (centavos + sumaCargos(cargos) > r.disponible) falla('El avance y su comisión superan tu crédito disponible (' + formatear(r.disponible, estado.config.simbolo) + ').');
    registrar(estado, cliente, 'tarjeta', -centavos, 'avance', 'Avance de efectivo');
    cobrarCargos(estado, cliente, 'tarjeta', cargos);
    registrar(estado, cliente, 'corriente', centavos, 'avance', 'Avance de efectivo desde la tarjeta');
  }

  function pagarTarjeta(estado, numero, centavos) {
    const cliente = buscarCliente(estado, numero);
    const r = exigirTarjeta(cliente);
    montoPositivo(centavos);
    if (r.deuda === 0) falla('Tu tarjeta no tiene deuda.');
    if (centavos > r.deuda) falla('Estás pagando más de lo que debes (' + formatear(r.deuda, estado.config.simbolo) + ').');
    if (centavos > cliente.saldos.corriente) falla('No tienes saldo suficiente en tu cuenta corriente.');
    registrar(estado, cliente, 'corriente', -centavos, 'pago-tarjeta', 'Pago a tarjeta de crédito');
    registrar(estado, cliente, 'tarjeta', centavos, 'pago-tarjeta', 'Pago recibido. ¡Gracias!');
    cliente.tarjeta.pagosDesdeCorte += centavos;
  }

  function calcularPagoMinimo(cfg, saldo) {
    if (saldo <= 0) return 0;
    return Math.min(saldo, Math.max(porcentaje(saldo, cfg.pagoMinimoPorcentaje), cfg.pagoMinimoFijo));
  }

  /**
   * Corte mensual de la tarjeta:
   * 1. Si no se cubrió el pago mínimo del corte anterior, se cobra mora.
   * 2. Lo que quedó sin pagar del corte anterior genera intereses.
   * 3. Se emite el nuevo estado de cuenta (saldo al corte y pago mínimo).
   */
  function corteTarjeta(estado, cliente, resumen) {
    const t = cliente.tarjeta;
    const cfg = estado.config;
    if (t.saldoCorte > 0) {
      const pagado = t.pagosDesdeCorte;
      if (pagado < t.pagoMinimo && cfg.cargoMoraTarjeta > 0) {
        registrar(estado, cliente, 'tarjeta', -cfg.cargoMoraTarjeta, 'mora', 'Cargo por mora: no se cubrió el pago mínimo');
        resumen.tarjetasEnMora.push({ numero: cliente.numero, nombre: cliente.nombre });
      }
      const sinPagar = Math.max(0, t.saldoCorte - pagado);
      const interes = porcentaje(sinPagar, t.tasa);
      if (interes > 0) registrar(estado, cliente, 'tarjeta', -interes, 'interes-cobrado', 'Intereses de la tarjeta (' + t.tasa + '% sobre ' + formatear(sinPagar, cfg.simbolo) + ')');
    }
    t.saldoCorte = Math.max(0, -cliente.saldos.tarjeta);
    t.pagoMinimo = calcularPagoMinimo(cfg, t.saldoCorte);
    t.pagosDesdeCorte = 0;
    t.mesCorte = estado.mes;
  }

  // ---------- Certificados de depósito (plazo fijo) ----------

  /** Interés que gana un certificado mes a mes. Simple: siempre sobre el capital. Compuesto: sobre capital + intereses. */
  function proyeccionCertificado(capital, tasa, plazo, tipo) {
    const filas = [];
    let acumulado = 0;
    for (let mes = 1; mes <= plazo; mes++) {
      const interes = porcentaje(tipo === 'compuesto' ? capital + acumulado : capital, tasa);
      acumulado += interes;
      filas.push({ mes, interes, acumulado, saldo: capital + acumulado });
    }
    return { filas, interes: acumulado, final: capital + acumulado };
  }

  function abrirCertificado(estado, numero, centavos, plazo, tipo) {
    const cliente = buscarCliente(estado, numero);
    const cfg = estado.config;
    montoPositivo(centavos);
    plazo = Number(plazo);
    if (tipo !== 'simple' && tipo !== 'compuesto') falla('Elige interés simple o compuesto.');
    if (!cfg.plazosCertificado.includes(plazo)) falla('Elige un plazo válido.');
    if (centavos < cfg.montoMinimoCertificado) falla('El monto mínimo de un certificado es ' + formatear(cfg.montoMinimoCertificado, cfg.simbolo) + '.');
    if (centavos > cliente.saldos.corriente) falla('No tienes suficiente dinero en tu cuenta corriente.');
    const certificado = {
      id: nuevoId(estado, 'c'),
      capital: centavos,
      tasa: cfg.tasaCertificadoMensual,
      plazo,
      tipo,
      mesInicio: estado.mes,
      meses: 0,
      interes: 0,
      estado: 'activo',
    };
    cliente.certificados.push(certificado);
    registrar(estado, cliente, 'corriente', -centavos, 'certificado', 'Apertura de certificado a ' + plazo + ' meses (interés ' + tipo + ')');
    return certificado;
  }

  function cancelarCertificado(estado, numero, id) {
    const cliente = buscarCliente(estado, numero);
    const cert = cliente.certificados.find((c) => c.id === id);
    if (!cert || cert.estado !== 'activo') falla('El certificado no está activo.');
    const penalidad = porcentaje(cert.capital, estado.config.penalidadCertificado);
    registrar(estado, cliente, 'corriente', cert.capital, 'certificado', 'Cancelación anticipada de certificado (se pierden ' + formatear(cert.interes, estado.config.simbolo) + ' de intereses)');
    if (penalidad > 0) registrar(estado, cliente, 'corriente', -penalidad, 'comision', 'Penalidad por cancelación anticipada (' + estado.config.penalidadCertificado + '%)');
    cert.estado = 'cancelado';
    cert.interes = 0;
    return penalidad;
  }

  function certificadosActivos(cliente) {
    return cliente.certificados.filter((c) => c.estado === 'activo');
  }

  // ---------- Divisas ----------

  function cotizarDivisa(estado, operacion, usd) {
    const tasa = operacion === 'comprar' ? estado.config.tasaVentaUSD : estado.config.tasaCompraUSD;
    return { tasa, pesos: Math.round(usd * tasa) };
  }

  function comprarDolares(estado, numero, usd) {
    const cliente = buscarCliente(estado, numero);
    montoPositivo(usd);
    const c = cotizarDivisa(estado, 'comprar', usd);
    if (c.pesos > cliente.saldos.corriente) falla('Necesitas ' + formatear(c.pesos, estado.config.simbolo) + ' en tu cuenta corriente.');
    registrar(estado, cliente, 'corriente', -c.pesos, 'divisas', 'Compra de ' + formatear(usd, SIMBOLO_USD) + ' a ' + c.tasa);
    registrar(estado, cliente, 'dolares', usd, 'divisas', 'Compra de dólares a ' + c.tasa);
    return c;
  }

  function venderDolares(estado, numero, usd) {
    const cliente = buscarCliente(estado, numero);
    montoPositivo(usd);
    if (usd > cliente.saldos.dolares) falla('No tienes suficientes dólares.');
    const c = cotizarDivisa(estado, 'vender', usd);
    registrar(estado, cliente, 'dolares', -usd, 'divisas', 'Venta de dólares a ' + c.tasa);
    registrar(estado, cliente, 'corriente', c.pesos, 'divisas', 'Venta de ' + formatear(usd, SIMBOLO_USD) + ' a ' + c.tasa);
    return c;
  }

  // ---------- Cierre de mes ----------

  /**
   * Avanza el calendario un mes:
   * 1. Paga intereses del ahorro (compuesto) y de los certificados; entrega los que vencen.
   * 2. Hace el corte de las tarjetas de crédito.
   * 3. Vence una cuota de cada préstamo y la cobra si hay saldo; si no, cobra mora.
   * 4. Cobra el mantenimiento de las cuentas con saldo menor al mínimo.
   */
  function avanzarMes(estado) {
    const cfg = estado.config;
    const ingresosAntes = ingresosBanco(estado).total;
    const resumen = { mes: estado.mes, interesesPagados: 0, cuotasCobradas: 0, cuotasSinPagar: [], tarjetasEnMora: [], certificadosVencidos: 0, cargosCobrados: 0 };
    estado.clientes.forEach((cliente) => {
      const interes = porcentaje(cliente.saldos.ahorro, cfg.tasaAhorroMensual);
      if (interes > 0) {
        registrar(estado, cliente, 'ahorro', interes, 'interes', 'Interés ganado del mes ' + estado.mes + ' (' + cfg.tasaAhorroMensual + '%)');
        resumen.interesesPagados += interes;
      }

      certificadosActivos(cliente).forEach((cert) => {
        cert.meses++;
        cert.interes += porcentaje(cert.tipo === 'compuesto' ? cert.capital + cert.interes : cert.capital, cert.tasa);
        if (cert.meses >= cert.plazo) {
          registrar(estado, cliente, 'corriente', cert.capital, 'certificado', 'Vencimiento de certificado: devolución del capital');
          if (cert.interes > 0) registrar(estado, cliente, 'corriente', cert.interes, 'interes', 'Intereses del certificado (' + cert.tasa + '% mensual, ' + cert.tipo + ')');
          resumen.interesesPagados += cert.interes;
          resumen.certificadosVencidos++;
          cert.estado = 'vencido';
        }
      });

      if (cliente.tarjeta) corteTarjeta(estado, cliente, resumen);

      cliente.prestamos.forEach((prestamo) => {
        if (prestamo.cuotasPagadas >= prestamo.plazo) return;
        if (prestamo.cuotasVencidas < prestamo.plazo) prestamo.cuotasVencidas++;
        while (prestamo.cuotasPagadas < prestamo.cuotasVencidas) {
          if (resumenPrestamo(prestamo).proximoPago > cliente.saldos.corriente) break;
          cobrarCuota(estado, cliente, prestamo);
          resumen.cuotasCobradas++;
        }
        const atrasadas = resumenPrestamo(prestamo).cuotasAtrasadas;
        if (atrasadas > 0) {
          prestamo.moraPendiente = (prestamo.moraPendiente || 0) + cfg.cargoMoraPrestamo;
          resumen.cuotasSinPagar.push({ numero: cliente.numero, nombre: cliente.nombre, atrasadas });
        }
      });

      if (cfg.cargoMantenimiento > 0 && cliente.saldos.corriente < cfg.saldoMinimo) {
        const cargo = Math.min(cfg.cargoMantenimiento, Math.max(0, cliente.saldos.corriente));
        if (cargo > 0) registrar(estado, cliente, 'corriente', -cargo, 'comision', 'Cargo por mantenimiento (saldo menor a ' + formatear(cfg.saldoMinimo, cfg.simbolo) + ')');
      }
    });
    resumen.cargosCobrados = ingresosBanco(estado).total - ingresosAntes;
    estado.historialMeses.unshift(resumen);
    estado.mes++;
    return resumen;
  }

  // ---------- Docente ----------

  const CLAVES_MONTO = ['saldoInicial', 'saldoMinimo', 'cargoMantenimiento', 'comisionRetiro', 'comisionTransferencia', 'montoMaximoPrestamo', 'cargoMoraPrestamo', 'limiteTarjeta', 'pagoMinimoFijo', 'cargoMoraTarjeta', 'cuotaEmisionTarjeta', 'montoMinimoCertificado'];
  const CLAVES_PORCENTAJE = ['tasaAhorroMensual', 'impuestoTransaccion', 'tasaPrestamoMensual', 'tasaPrestamoEducativo', 'tasaPrestamoEmprendimiento', 'comisionApertura', 'tasaTarjetaMensual', 'pagoMinimoPorcentaje', 'comisionAvance', 'tasaCertificadoMensual', 'penalidadCertificado'];

  function actualizarConfig(estado, cambios) {
    const cfg = Object.assign({}, estado.config, cambios);
    if (!String(cfg.nombreBanco).trim()) falla('El banco necesita un nombre.');
    if (!String(cfg.simbolo).trim()) falla('Escribe un símbolo para la moneda.');
    CLAVES_MONTO.forEach((k) => {
      if (!Number.isInteger(cfg[k]) || cfg[k] < 0) falla('Revisa los montos: no pueden ser negativos.');
    });
    CLAVES_PORCENTAJE.forEach((k) => {
      if (!Number.isFinite(cfg[k]) || cfg[k] < 0 || cfg[k] > 100) falla('Las tasas deben estar entre 0% y 100%.');
    });
    ['plazosPrestamo', 'plazosCertificado'].forEach((k) => {
      if (!Array.isArray(cfg[k]) || cfg[k].length === 0 || cfg[k].some((p) => !Number.isInteger(p) || p < 1 || p > 60)) {
        falla('Los plazos deben ser meses enteros entre 1 y 60.');
      }
    });
    ['tasaCompraUSD', 'tasaVentaUSD'].forEach((k) => {
      if (!Number.isFinite(cfg[k]) || cfg[k] <= 0) falla('Las tasas del dólar deben ser mayores que cero.');
    });
    if (cfg.tasaCompraUSD > cfg.tasaVentaUSD) falla('La tasa de compra del dólar no puede ser mayor que la de venta.');
    cfg.pinDocente = validarPin(cfg.pinDocente);
    estado.config = cfg;
  }

  /** Lo que el banco ha ganado: comisiones, impuestos, moras e intereses cobrados. */
  function ingresosBanco(estado) {
    const r = { comisiones: 0, impuestos: 0, moras: 0, interesesTarjeta: 0, interesesPrestamos: 0, total: 0 };
    estado.clientes.forEach((c) => {
      c.movimientos.forEach((m) => {
        if (!TIPOS_INGRESO.includes(m.tipo)) return;
        const valor = -m.monto;
        if (m.tipo === 'comision') r.comisiones += valor;
        else if (m.tipo === 'impuesto') r.impuestos += valor;
        else if (m.tipo === 'mora') r.moras += valor;
        else r.interesesTarjeta += valor;
      });
      c.prestamos.forEach((p) => (r.interesesPrestamos += resumenPrestamo(p).interesesPagados));
    });
    r.total = r.comisiones + r.impuestos + r.moras + r.interesesTarjeta + r.interesesPrestamos;
    return r;
  }

  function totales(estado) {
    const t = { corriente: 0, ahorro: 0, dolares: 0, deuda: 0, tarjetas: 0, certificados: 0, clientes: estado.clientes.length };
    estado.clientes.forEach((c) => {
      t.corriente += c.saldos.corriente;
      t.ahorro += c.saldos.ahorro;
      t.dolares += c.saldos.dolares;
      t.tarjetas += Math.max(0, -c.saldos.tarjeta);
      c.prestamos.forEach((p) => (t.deuda += resumenPrestamo(p).saldoPendiente));
      certificadosActivos(c).forEach((cert) => (t.certificados += cert.capital));
    });
    return t;
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
    return normalizar(Object.assign(base, datos));
  }

  return {
    VERSION,
    CONFIG_INICIAL,
    TIPOS_PRESTAMO,
    SISTEMAS,
    SIMBOLO_USD,
    ErrorBanco,
    aCentavos,
    aUnidades,
    formatear,
    formulas,
    estadoInicial,
    normalizar,
    crearCliente,
    autenticar,
    cambiarPin,
    eliminarCliente,
    buscarCliente,
    cargosDe,
    sumaCargos,
    depositar,
    retirar,
    transferir,
    pagarServicio,
    guardarEnAhorro,
    sacarDeAhorro,
    proyeccionAhorro,
    cuotaFija,
    tablaAmortizacion,
    tasaDeTipo,
    resumenPrestamo,
    prestamosActivos,
    solicitarPrestamo,
    aprobarPrestamo,
    rechazarPrestamo,
    pagarCuota,
    activarTarjeta,
    resumenTarjeta,
    comprarConTarjeta,
    avanceEfectivo,
    pagarTarjeta,
    calcularPagoMinimo,
    proyeccionCertificado,
    abrirCertificado,
    cancelarCertificado,
    certificadosActivos,
    cotizarDivisa,
    comprarDolares,
    venderDolares,
    avanzarMes,
    actualizarConfig,
    ingresosBanco,
    totales,
    exportar,
    importar,
  };
});
