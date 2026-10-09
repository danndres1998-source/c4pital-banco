/*
 * C4pital — interfaz de la aplicación.
 * Los datos se guardan en el navegador (localStorage) de esta computadora.
 */
(function () {
  'use strict';

  const B = window.Banco;
  const CLAVE = 'c4pital-banco';
  const app = document.getElementById('app');
  const aviso = document.getElementById('aviso');

  let estado = cargar();
  const ui = {
    vista: 'inicio', // inicio | estudiante | docente
    numero: null, // estudiante con sesión abierta
    pestana: null,
    seleccion: null, // estudiante elegido en el panel docente
    simulacion: null,
    proyeccion: null,
    nuevasCuentas: null,
  };

  // ---------- Guardado ----------

  function cargar() {
    try {
      const texto = localStorage.getItem(CLAVE);
      if (texto) return B.importar(texto);
    } catch (e) {
      console.warn('No se pudieron leer los datos guardados.', e);
    }
    return B.estadoInicial();
  }

  function guardar() {
    try {
      localStorage.setItem(CLAVE, B.exportar(estado));
    } catch (e) {
      mostrarAviso('No se pudo guardar en este navegador. Descarga una copia de seguridad.', true);
    }
  }

  window.addEventListener('storage', (e) => {
    if (e.key === CLAVE) {
      estado = cargar();
      pintar();
    }
  });

  // ---------- Utilidades ----------

  function esc(texto) {
    return String(texto == null ? '' : texto).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  }

  function dinero(centavos) {
    return B.formatear(centavos, estado.config.simbolo);
  }

  function dineroConSigno(centavos) {
    const clase = centavos >= 0 ? 'positivo' : 'negativo';
    return '<span class="' + clase + '">' + (centavos > 0 ? '+' : '') + esc(dinero(centavos)) + '</span>';
  }

  function unidades(centavos) {
    return (centavos / 100).toFixed(2);
  }

  let temporizador;
  function mostrarAviso(texto, esError) {
    aviso.textContent = texto;
    aviso.className = 'aviso' + (esError ? ' error' : '');
    aviso.hidden = false;
    clearTimeout(temporizador);
    temporizador = setTimeout(() => (aviso.hidden = true), esError ? 5000 : 3000);
  }

  function pinAleatorio() {
    return String(Math.floor(Math.random() * 10000)).padStart(4, '0');
  }

  function clienteActual() {
    return estado.clientes.find((c) => c.numero === ui.numero);
  }

  function campoMonto(nombre, etiqueta, ayuda, valor) {
    return (
      '<label>' + esc(etiqueta) + (ayuda ? ' <small>' + esc(ayuda) + '</small>' : '') +
      '<input name="' + nombre + '" type="number" inputmode="decimal" min="0.01" step="0.01" required placeholder="0.00"' +
      (valor != null ? ' value="' + esc(valor) + '"' : '') + ' /></label>'
    );
  }

  function pestanas(lista) {
    return (
      '<nav class="pestanas" role="tablist">' +
      lista.map(([id, texto]) => '<button type="button" role="tab" data-accion="pestana" data-valor="' + id + '" aria-selected="' + (ui.pestana === id) + '">' + texto + '</button>').join('') +
      '</nav>'
    );
  }

  function barra(titulo, detalle) {
    return (
      '<header class="barra"><div class="contenedor">' +
      '<div class="logo"><span class="logo-marca">C4</span>' + esc(estado.config.nombreBanco) + '</div>' +
      '<div class="info"><strong>' + esc(titulo) + '</strong><br>' + detalle + '</div>' +
      '<button class="btn btn-salir chico" data-accion="salir">Salir</button>' +
      '</div></header>'
    );
  }

  function pie() {
    return '<footer class="pie">' + esc(estado.config.nombreBanco) + ' · ¡Multiplica tus ideas! · Dinero didáctico, sin valor real · Mes ' + estado.mes + '</footer>';
  }

  function tablaMovimientos(movimientos, limite) {
    if (!movimientos.length) return '<p class="vacio">Todavía no hay movimientos.</p>';
    const filas = movimientos.slice(0, limite || movimientos.length).map((m) =>
      '<tr><td>' + m.mes + '</td><td>' + esc(m.descripcion) + '</td><td>' + (m.cuenta === 'ahorro' ? 'Ahorro' : 'Corriente') +
      '</td><td class="num">' + dineroConSigno(m.monto) + '</td><td class="num">' + esc(dinero(m.saldo)) + '</td></tr>'
    );
    return (
      '<div class="tabla-envoltura"><table><thead><tr><th>Mes</th><th>Descripción</th><th>Cuenta</th><th class="num">Monto</th><th class="num">Saldo</th></tr></thead><tbody>' +
      filas.join('') + '</tbody></table></div>'
    );
  }

  function tablaAmortizacion(tabla, pagadas) {
    const filas = tabla.map((f) =>
      '<tr><td>' + f.numero + (pagadas != null && f.numero <= pagadas ? ' <span class="insignia">pagada</span>' : '') + '</td>' +
      '<td class="num">' + esc(dinero(f.cuota)) + '</td><td class="num">' + esc(dinero(f.interes)) + '</td>' +
      '<td class="num">' + esc(dinero(f.capital)) + '</td><td class="num">' + esc(dinero(f.saldo)) + '</td></tr>'
    );
    return (
      '<div class="tabla-envoltura"><table><thead><tr><th>Cuota</th><th class="num">Pago</th><th class="num">Interés</th><th class="num">Abono a capital</th><th class="num">Saldo pendiente</th></tr></thead><tbody>' +
      filas.join('') + '</tbody></table></div>'
    );
  }

  // ---------- Vistas ----------

  function vistaInicio() {
    const opciones = estado.clientes
      .slice()
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
      .map((c) => '<option value="' + esc(c.numero) + '">' + esc(c.nombre) + ' · ' + esc(c.numero) + '</option>')
      .join('');
    return (
      '<main class="contenedor">' +
      '<section class="portada"><div class="logo" style="justify-content:center;color:var(--verde-oscuro)"><span class="logo-marca">C4</span></div>' +
      '<h1>' + esc(estado.config.nombreBanco) + '</h1><p class="lema">¡Multiplica tus ideas!</p>' +
      '<p>El banco escolar de 4.º A. Abre tu cuenta, deposita, retira, transfiere, ahorra y pide préstamos con dinero didáctico.</p></section>' +
      '<div class="accesos">' +
      '<section class="tarjeta"><h2>Soy estudiante</h2>' +
      (estado.clientes.length
        ? '<form data-form="entrar-estudiante"><label>Mi cuenta<select name="numero" required><option value="">Elige tu nombre…</option>' + opciones + '</select></label>' +
          '<label>Mi PIN <small>(4 números)</small><input name="pin" type="password" inputmode="numeric" maxlength="4" autocomplete="off" required /></label>' +
          '<button class="btn">Entrar a mi banco</button></form>'
        : '<p class="nota">Aún no hay cuentas abiertas. Pide a tu docente que abra tu cuenta.</p>') +
      '</section>' +
      '<section class="tarjeta"><h2>Soy docente</h2>' +
      '<form data-form="entrar-docente"><label>PIN de docente<input name="pin" type="password" inputmode="numeric" maxlength="4" autocomplete="off" required /></label>' +
      '<button class="btn secundario">Entrar al panel docente</button></form>' +
      (estado.config.pinDocente === B.CONFIG_INICIAL.pinDocente ? '<p class="nota" style="margin-top:12px">El PIN inicial es <strong>1234</strong>. Cámbialo en Ajustes.</p>' : '') +
      '</section></div></main>' + pie()
    );
  }

  // ----- Estudiante -----

  function vistaEstudiante() {
    const c = clienteActual();
    if (!c) {
      ui.vista = 'inicio';
      return vistaInicio();
    }
    const activos = B.prestamosActivos(c);
    const deuda = activos.reduce((s, p) => s + B.resumenPrestamo(p).saldoPendiente, 0);
    const atrasadas = activos.reduce((s, p) => s + B.resumenPrestamo(p).cuotasAtrasadas, 0);
    let html = barra(c.nombre, 'Cuenta ' + esc(c.numero) + ' · Mes ' + estado.mes);
    html += '<main class="contenedor">';
    html +=
      '<section class="saldos">' +
      '<div class="saldo principal"><div class="etiqueta">Cuenta corriente</div><div class="monto">' + esc(dinero(c.saldos.corriente)) + '</div><div class="detalle">Disponible para usar</div></div>' +
      '<div class="saldo"><div class="etiqueta">Cuenta de ahorro</div><div class="monto">' + esc(dinero(c.saldos.ahorro)) + '</div><div class="detalle">Gana ' + estado.config.tasaAhorroMensual + '% cada mes</div></div>' +
      '<div class="saldo"><div class="etiqueta">Debo en préstamos</div><div class="monto">' + esc(dinero(deuda)) + '</div><div class="detalle">' +
      (atrasadas ? '<span class="insignia alerta">' + atrasadas + ' cuota(s) atrasada(s)</span>' : activos.length ? 'Al día' : 'Sin préstamos') + '</div></div>' +
      '</section>';
    html += pestanas([
      ['movimientos', 'Movimientos'],
      ['depositar', 'Depositar'],
      ['retirar', 'Retirar'],
      ['transferir', 'Transferir'],
      ['ahorro', 'Ahorro'],
      ['prestamos', 'Préstamos'],
    ]);
    html += ({ movimientos: pMovimientos, depositar: pDepositar, retirar: pRetirar, transferir: pTransferir, ahorro: pAhorro, prestamos: pPrestamos }[ui.pestana] || pMovimientos)(c);
    return html + '</main>' + pie();
  }

  function pMovimientos(c) {
    return '<section class="tarjeta"><h2>Mis movimientos</h2>' + tablaMovimientos(c.movimientos) + '</section>';
  }

  function pDepositar() {
    return (
      '<section class="tarjeta"><h2>Depositar dinero</h2><p class="nota">Entrega los billetes didácticos a tu docente o cajero y registra aquí el depósito.</p>' +
      '<form data-form="depositar">' + campoMonto('monto', 'Monto a depositar') + '<button class="btn">Depositar</button></form></section>'
    );
  }

  function pRetirar(c) {
    return (
      '<section class="tarjeta"><h2>Retirar dinero</h2><p>Puedes retirar hasta <strong>' + esc(dinero(c.saldos.corriente)) + '</strong>.</p>' +
      '<form data-form="retirar">' + campoMonto('monto', 'Monto a retirar') + '<button class="btn">Retirar</button></form></section>'
    );
  }

  function pTransferir(c) {
    const otros = estado.clientes
      .filter((o) => o.numero !== c.numero)
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
      .map((o) => '<option value="' + esc(o.numero) + '">' + esc(o.nombre) + ' · ' + esc(o.numero) + '</option>')
      .join('');
    if (!otros) return '<section class="tarjeta"><h2>Transferir</h2><p class="vacio">Todavía no hay otras cuentas en el banco.</p></section>';
    return (
      '<section class="tarjeta"><h2>Transferir a un compañero</h2><p>Saldo disponible: <strong>' + esc(dinero(c.saldos.corriente)) + '</strong></p>' +
      '<form data-form="transferir"><label>Cuenta destino<select name="destino" required><option value="">Elige a quién…</option>' + otros + '</select></label>' +
      campoMonto('monto', 'Monto a transferir') +
      '<label>Concepto <small>(opcional)</small><input name="concepto" maxlength="60" placeholder="Ej.: pago de merienda" /></label>' +
      '<button class="btn">Transferir</button></form></section>'
    );
  }

  function pAhorro(c) {
    const tasa = estado.config.tasaAhorroMensual;
    const p = ui.proyeccion;
    let html =
      '<section class="tarjeta"><h2>Mi cuenta de ahorro</h2>' +
      '<p>El dinero que guardes aquí gana <strong>' + tasa + '% de interés compuesto cada mes</strong>. Los intereses se pagan cuando tu docente cierra el mes.</p>' +
      '<div class="fila">' +
      '<form data-form="guardar-ahorro">' + campoMonto('monto', 'Pasar a ahorro', 'desde corriente') + '<button class="btn">Guardar en ahorro</button></form>' +
      '<form data-form="sacar-ahorro">' + campoMonto('monto', 'Sacar del ahorro', 'hacia corriente') + '<button class="btn secundario">Sacar del ahorro</button></form>' +
      '</div></section>';
    html +=
      '<section class="tarjeta"><h2>¿Cuánto tendré si ahorro?</h2>' +
      '<p class="formula">M = C · (1 + i)<sup>n</sup> &nbsp;→&nbsp; C = capital, i = ' + tasa + '% = ' + tasa / 100 + ', n = meses</p>' +
      '<form data-form="proyectar"><div class="fila">' +
      campoMonto('capital', 'Capital inicial', '', p ? unidades(p.capital) : unidades(c.saldos.ahorro || c.saldos.corriente)) +
      '<label>Meses<input name="meses" type="number" min="1" max="60" step="1" required value="' + (p ? p.meses : 6) + '" /></label>' +
      '</div><button class="btn secundario">Calcular</button></form>';
    if (p) {
      const final = p.filas[p.filas.length - 1].saldo;
      html +=
        '<p style="margin-top:12px">Si guardas <strong>' + esc(dinero(p.capital)) + '</strong> durante <strong>' + p.meses + ' meses</strong>, tendrás <strong>' + esc(dinero(final)) +
        '</strong>. ¡Ganarás <span class="positivo">' + esc(dinero(final - p.capital)) + '</span> en intereses!</p>' +
        '<div class="tabla-envoltura"><table><thead><tr><th>Mes</th><th class="num">Interés del mes</th><th class="num">Saldo</th></tr></thead><tbody>' +
        p.filas.map((f) => '<tr><td>' + f.mes + '</td><td class="num">' + esc(dinero(f.interes)) + '</td><td class="num">' + esc(dinero(f.saldo)) + '</td></tr>').join('') +
        '</tbody></table></div>';
    }
    return html + '</section>';
  }

  function pPrestamos(c) {
    const cfg = estado.config;
    const solicitud = estado.solicitudes.find((s) => s.numero === c.numero);
    const activos = B.prestamosActivos(c);
    let html = '';

    activos.forEach((p) => {
      const r = B.resumenPrestamo(p);
      html +=
        '<section class="tarjeta"><h2>Mi préstamo</h2>' +
        (r.cuotasAtrasadas ? '<p class="nota alerta">Tienes ' + r.cuotasAtrasadas + ' cuota(s) atrasada(s). Deposita dinero y págala para ponerte al día.</p>' : '') +
        '<p>Pediste <strong>' + esc(dinero(p.monto)) + '</strong> a ' + p.plazo + ' meses al ' + p.tasa + '% mensual' + (p.motivo ? ' para «' + esc(p.motivo) + '»' : '') + '. ' +
        'Has pagado <strong>' + p.cuotasPagadas + ' de ' + p.plazo + '</strong> cuotas. Te falta pagar <strong>' + esc(dinero(r.saldoPendiente)) + '</strong> de capital.</p>' +
        '<p>La cuota se cobra sola de tu cuenta corriente cuando se cierra el mes. También puedes pagarla ahora.</p>' +
        '<div class="acciones" style="margin-bottom:12px"><button class="btn" data-accion="pagar-cuota" data-valor="' + esc(p.id) + '">Pagar cuota de ' + esc(dinero(r.proximaCuota)) + '</button></div>' +
        tablaAmortizacion(p.tabla, p.cuotasPagadas) + '</section>';
    });

    if (solicitud) {
      html += '<section class="tarjeta"><h2>Solicitud enviada</h2><p class="nota">Pediste ' + esc(dinero(solicitud.monto)) + ' a ' + solicitud.plazo + ' meses. Tu docente debe aprobarla.</p></section>';
    }

    const s = ui.simulacion;
    html +=
      '<section class="tarjeta"><h2>Simulador de préstamos</h2>' +
      '<p>Tasa: <strong>' + cfg.tasaPrestamoMensual + '% mensual</strong> · Máximo: <strong>' + esc(dinero(cfg.montoMaximoPrestamo)) + '</strong>. Se paga con cuotas fijas (sistema francés).</p>' +
      '<p class="formula">Cuota = P · i ÷ (1 − (1 + i)<sup>−n</sup>) &nbsp;→&nbsp; P = monto, i = ' + cfg.tasaPrestamoMensual / 100 + ', n = meses</p>' +
      '<form data-form="simular"><div class="fila">' +
      campoMonto('monto', 'Monto que necesito', '', s ? unidades(s.monto) : null) +
      '<label>Plazo<select name="plazo">' + cfg.plazosPrestamo.map((p) => '<option value="' + p + '"' + (s && s.plazo === p ? ' selected' : '') + '>' + p + ' meses</option>').join('') + '</select></label>' +
      '</div><button class="btn secundario">Simular</button></form>';
    if (s) {
      const total = s.tabla.reduce((t, f) => t + f.cuota, 0);
      html +=
        '<div class="saldos"><div class="saldo"><div class="etiqueta">Cuota mensual</div><div class="monto">' + esc(dinero(s.tabla[0].cuota)) + '</div></div>' +
        '<div class="saldo"><div class="etiqueta">Total a pagar</div><div class="monto">' + esc(dinero(total)) + '</div></div>' +
        '<div class="saldo"><div class="etiqueta">Intereses</div><div class="monto negativo">' + esc(dinero(total - s.monto)) + '</div></div></div>' +
        tablaAmortizacion(s.tabla);
      if (!activos.length && !solicitud) {
        html +=
          '<form data-form="solicitar" style="margin-top:16px"><input type="hidden" name="monto" value="' + unidades(s.monto) + '" /><input type="hidden" name="plazo" value="' + s.plazo + '" />' +
          '<label>¿Para qué lo necesitas?<input name="motivo" maxlength="80" placeholder="Ej.: comprar materiales para mi proyecto" /></label>' +
          '<button class="btn">Solicitar este préstamo</button></form>';
      }
    }
    return html + '</section>';
  }

  // ----- Docente -----

  function vistaDocente() {
    const t = B.totales(estado);
    let html = barra('Panel docente', 'Mes ' + estado.mes + ' · ' + t.clientes + ' cuenta(s)');
    html += '<main class="contenedor">';
    html +=
      '<section class="saldos">' +
      '<div class="saldo principal"><div class="etiqueta">Dinero en cuentas corrientes</div><div class="monto">' + esc(dinero(t.corriente)) + '</div></div>' +
      '<div class="saldo"><div class="etiqueta">Dinero ahorrado</div><div class="monto">' + esc(dinero(t.ahorro)) + '</div></div>' +
      '<div class="saldo"><div class="etiqueta">Préstamos por cobrar</div><div class="monto">' + esc(dinero(t.deuda)) + '</div></div>' +
      '</section>';
    const pendientes = estado.solicitudes.length;
    html += pestanas([
      ['estudiantes', 'Estudiantes'],
      ['solicitudes', 'Solicitudes de préstamo' + (pendientes ? ' (' + pendientes + ')' : '')],
      ['mes', 'Cerrar mes'],
      ['ajustes', 'Ajustes'],
    ]);
    html += ({ estudiantes: dEstudiantes, solicitudes: dSolicitudes, mes: dMes, ajustes: dAjustes }[ui.pestana] || dEstudiantes)();
    return html + '</main>' + pie();
  }

  function dEstudiantes() {
    let html = '';
    if (ui.nuevasCuentas) {
      html +=
        '<section class="tarjeta"><h2>Cuentas recién abiertas</h2><p class="nota">Entrega a cada estudiante su número de cuenta y su PIN. Puedes imprimir esta lista.</p>' +
        '<div class="tabla-envoltura"><table><thead><tr><th>Nombre</th><th>Cuenta</th><th>PIN</th></tr></thead><tbody>' +
        ui.nuevasCuentas.map((c) => '<tr><td>' + esc(c.nombre) + '</td><td>' + esc(c.numero) + '</td><td>' + esc(c.pin) + '</td></tr>').join('') +
        '</tbody></table></div><div class="acciones" style="margin-top:12px"><button class="btn secundario" data-accion="imprimir">Imprimir</button>' +
        '<button class="btn secundario" data-accion="cerrar-nuevas">Cerrar</button></div></section>';
    }

    const filas = estado.clientes
      .slice()
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
      .map((c) => {
        const activos = B.prestamosActivos(c);
        const deuda = activos.reduce((s, p) => s + B.resumenPrestamo(p).saldoPendiente, 0);
        const atrasadas = activos.reduce((s, p) => s + B.resumenPrestamo(p).cuotasAtrasadas, 0);
        return (
          '<tr><td>' + esc(c.numero) + '</td><td>' + esc(c.nombre) + (atrasadas ? ' <span class="insignia alerta">atrasado</span>' : '') + '</td><td>' + esc(c.pin) + '</td>' +
          '<td class="num">' + esc(dinero(c.saldos.corriente)) + '</td><td class="num">' + esc(dinero(c.saldos.ahorro)) + '</td><td class="num">' + esc(dinero(deuda)) + '</td>' +
          '<td><button class="btn chico secundario" data-accion="seleccionar" data-valor="' + esc(c.numero) + '">Ver</button></td></tr>'
        );
      });
    html +=
      '<section class="tarjeta"><h2>Estudiantes</h2>' +
      (filas.length
        ? '<div class="tabla-envoltura"><table><thead><tr><th>Cuenta</th><th>Nombre</th><th>PIN</th><th class="num">Corriente</th><th class="num">Ahorro</th><th class="num">Debe</th><th></th></tr></thead><tbody>' + filas.join('') + '</tbody></table></div>'
        : '<p class="vacio">Aún no hay cuentas. Ábrelas abajo.</p>') +
      '</section>';

    const sel = estado.clientes.find((c) => c.numero === ui.seleccion);
    if (sel) {
      html +=
        '<section class="tarjeta" id="detalle"><h2>' + esc(sel.nombre) + ' · ' + esc(sel.numero) + '</h2>' +
        '<div class="fila">' +
        '<form data-form="ajuste">' + campoMonto('monto', 'Ajuste de saldo', '(premio o multa)') +
        '<label>Motivo<input name="motivo" maxlength="60" placeholder="Ej.: premio por participación" /></label>' +
        '<div class="acciones"><button class="btn" name="tipo" value="sumar">Sumar</button><button class="btn peligro" name="tipo" value="restar">Restar</button></div></form>' +
        '<form data-form="cambiar-pin"><label>Nuevo PIN<input name="pin" inputmode="numeric" maxlength="4" required value="' + pinAleatorio() + '" /></label>' +
        '<button class="btn secundario">Cambiar PIN</button>' +
        '<button type="button" class="btn peligro" data-accion="eliminar" data-valor="' + esc(sel.numero) + '">Cerrar esta cuenta</button></form>' +
        '</div><h3 style="margin-top:16px">Movimientos</h3>' + tablaMovimientos(sel.movimientos) + '</section>';
    }

    html +=
      '<section class="tarjeta"><h2>Abrir cuentas</h2>' +
      '<p>Cada cuenta nueva recibe un depósito de apertura de <strong>' + esc(dinero(estado.config.saldoInicial)) + '</strong>.</p>' +
      '<div class="fila">' +
      '<form data-form="abrir-cuenta"><h3>Una cuenta</h3><label>Nombre del estudiante<input name="nombre" maxlength="40" required /></label>' +
      '<label>PIN <small>(4 números)</small><input name="pin" inputmode="numeric" maxlength="4" required value="' + pinAleatorio() + '" /></label>' +
      '<button class="btn">Abrir cuenta</button></form>' +
      '<form data-form="abrir-varias"><h3>Toda la lista</h3><label>Un nombre por línea <small>(el PIN se crea solo)</small><textarea name="nombres" rows="6" required placeholder="Ana Pérez&#10;Luis Gómez&#10;…"></textarea></label>' +
      '<button class="btn">Abrir todas</button></form>' +
      '</div></section>';
    return html;
  }

  function dSolicitudes() {
    if (!estado.solicitudes.length) return '<section class="tarjeta"><h2>Solicitudes de préstamo</h2><p class="vacio">No hay solicitudes pendientes.</p></section>';
    return (
      '<section class="tarjeta"><h2>Solicitudes de préstamo</h2>' +
      estado.solicitudes
        .map((s) => {
          const c = estado.clientes.find((x) => x.numero === s.numero);
          const tabla = B.tablaAmortizacion(s.monto, s.tasa, s.plazo);
          const total = tabla.reduce((t, f) => t + f.cuota, 0);
          return (
            '<div class="tarjeta"><h3>' + esc(c ? c.nombre : s.numero) + ' pide ' + esc(dinero(s.monto)) + '</h3>' +
            '<p>' + s.plazo + ' meses al ' + s.tasa + '% mensual · cuota de <strong>' + esc(dinero(tabla[0].cuota)) + '</strong> · total a pagar ' + esc(dinero(total)) +
            (s.motivo ? '<br>Motivo: «' + esc(s.motivo) + '»' : '') + '<br>Saldo actual: ' + esc(dinero(c ? c.saldos.corriente : 0)) + ' corriente, ' + esc(dinero(c ? c.saldos.ahorro : 0)) + ' ahorro</p>' +
            '<div class="acciones"><button class="btn" data-accion="aprobar" data-valor="' + esc(s.id) + '">Aprobar</button>' +
            '<button class="btn peligro" data-accion="rechazar" data-valor="' + esc(s.id) + '">Rechazar</button></div></div>'
          );
        })
        .join('') +
      '</section>'
    );
  }

  function dMes() {
    const cfg = estado.config;
    let html =
      '<section class="tarjeta"><h2>Estamos en el mes ' + estado.mes + '</h2>' +
      '<p>Al cerrar el mes, el banco hace automáticamente:</p><ul>' +
      '<li>Paga <strong>' + cfg.tasaAhorroMensual + '%</strong> de interés sobre el saldo de cada cuenta de ahorro.</li>' +
      '<li>Cobra la cuota de cada préstamo desde la cuenta corriente. Si no hay saldo, la cuota queda atrasada.</li></ul>' +
      '<button class="btn" data-accion="cerrar-mes">Cerrar el mes ' + estado.mes + '</button></section>';
    if (estado.historialMeses.length) {
      html +=
        '<section class="tarjeta"><h2>Meses cerrados</h2><div class="tabla-envoltura"><table><thead><tr><th>Mes</th><th class="num">Intereses pagados</th><th class="num">Cuotas cobradas</th><th>Cuotas sin pagar</th></tr></thead><tbody>' +
        estado.historialMeses
          .map((r) =>
            '<tr><td>' + r.mes + '</td><td class="num">' + esc(dinero(r.interesesPagados)) + '</td><td class="num">' + r.cuotasCobradas + '</td><td>' +
            (r.cuotasSinPagar.length ? r.cuotasSinPagar.map((x) => esc(x.nombre) + ' (' + x.atrasadas + ')').join(', ') : '—') + '</td></tr>'
          )
          .join('') +
        '</tbody></table></div></section>';
    }
    return html;
  }

  function dAjustes() {
    const cfg = estado.config;
    return (
      '<section class="tarjeta"><h2>Reglas del banco</h2><form data-form="config">' +
      '<div class="fila"><label>Nombre del banco<input name="nombreBanco" maxlength="30" required value="' + esc(cfg.nombreBanco) + '" /></label>' +
      '<label>Símbolo de la moneda<input name="simbolo" maxlength="4" required value="' + esc(cfg.simbolo) + '" /></label></div>' +
      '<div class="fila"><label>Depósito de apertura<input name="saldoInicial" type="number" min="0" step="0.01" required value="' + unidades(cfg.saldoInicial) + '" /></label>' +
      '<label>Préstamo máximo<input name="montoMaximoPrestamo" type="number" min="0" step="0.01" required value="' + unidades(cfg.montoMaximoPrestamo) + '" /></label></div>' +
      '<div class="fila"><label>Interés del ahorro <small>(% mensual)</small><input name="tasaAhorroMensual" type="number" min="0" max="100" step="0.01" required value="' + cfg.tasaAhorroMensual + '" /></label>' +
      '<label>Interés de préstamos <small>(% mensual)</small><input name="tasaPrestamoMensual" type="number" min="0" max="100" step="0.01" required value="' + cfg.tasaPrestamoMensual + '" /></label></div>' +
      '<div class="fila"><label>Plazos de préstamo <small>(meses, separados por coma)</small><input name="plazosPrestamo" required value="' + esc(cfg.plazosPrestamo.join(', ')) + '" /></label>' +
      '<label>PIN de docente<input name="pinDocente" inputmode="numeric" maxlength="4" required value="' + esc(cfg.pinDocente) + '" /></label></div>' +
      '<p class="nota">Los cambios de tasa aplican a préstamos nuevos. Los préstamos ya aprobados mantienen su tasa.</p>' +
      '<button class="btn">Guardar reglas</button></form></section>' +
      '<section class="tarjeta"><h2>Copia de seguridad</h2>' +
      '<p>Los datos se guardan solo en <strong>este navegador de esta computadora</strong>. Descarga una copia al final de cada clase para no perderlos o para pasarlos a otra computadora.</p>' +
      '<div class="acciones"><button class="btn" data-accion="exportar">Descargar copia</button>' +
      '<label class="btn secundario" style="display:inline-flex">Cargar copia<input type="file" accept=".json,application/json" data-accion="importar" hidden /></label></div></section>' +
      '<section class="tarjeta"><h2>Empezar de cero</h2><p>Borra todas las cuentas, movimientos y reglas. No se puede deshacer.</p>' +
      '<button class="btn peligro" data-accion="borrar-todo">Borrar todo</button></section>'
    );
  }

  // ---------- Pintar ----------

  function pintar() {
    if (ui.vista === 'estudiante') app.innerHTML = vistaEstudiante();
    else if (ui.vista === 'docente') app.innerHTML = vistaDocente();
    else app.innerHTML = vistaInicio();
    document.title = estado.config.nombreBanco + ' · Banco escolar de 4.º A';
  }

  /** Ejecuta una operación, guarda, vuelve a pintar y avisa. */
  function operar(fn, mensaje) {
    try {
      const r = fn();
      guardar();
      pintar();
      if (mensaje) mostrarAviso(typeof mensaje === 'function' ? mensaje(r) : mensaje);
      return true;
    } catch (e) {
      if (e instanceof B.ErrorBanco) mostrarAviso(e.message, true);
      else {
        console.error(e);
        mostrarAviso('Ocurrió un error inesperado.', true);
      }
      return false;
    }
  }

  // ---------- Formularios ----------

  const formularios = {
    'entrar-estudiante'(d) {
      operar(() => {
        const c = B.autenticar(estado, d.numero, d.pin);
        Object.assign(ui, { vista: 'estudiante', numero: c.numero, pestana: 'movimientos', simulacion: null, proyeccion: null });
        return c;
      }, (c) => '¡Hola, ' + c.nombre + '!');
    },
    'entrar-docente'(d) {
      if (String(d.pin).trim() !== estado.config.pinDocente) return mostrarAviso('PIN de docente incorrecto.', true);
      Object.assign(ui, { vista: 'docente', pestana: 'estudiantes', seleccion: null, nuevasCuentas: null });
      pintar();
    },
    depositar(d) {
      operar(() => B.depositar(estado, ui.numero, B.aCentavos(d.monto)), 'Depósito realizado.');
    },
    retirar(d) {
      operar(() => B.retirar(estado, ui.numero, B.aCentavos(d.monto)), 'Retiro realizado.');
    },
    transferir(d) {
      const destino = estado.clientes.find((c) => c.numero === d.destino);
      let monto;
      try {
        monto = B.aCentavos(d.monto);
      } catch (e) {
        return mostrarAviso(e.message, true);
      }
      if (destino && !confirm('¿Transferir ' + dinero(monto) + ' a ' + destino.nombre + '?')) return;
      operar(() => B.transferir(estado, ui.numero, d.destino, monto, d.concepto), 'Transferencia enviada.');
    },
    'guardar-ahorro'(d) {
      operar(() => B.guardarEnAhorro(estado, ui.numero, B.aCentavos(d.monto)), '¡Dinero guardado en tu ahorro!');
    },
    'sacar-ahorro'(d) {
      operar(() => B.sacarDeAhorro(estado, ui.numero, B.aCentavos(d.monto)), 'Dinero enviado a tu cuenta corriente.');
    },
    proyectar(d) {
      operar(() => {
        const capital = B.aCentavos(d.capital);
        const meses = Math.min(60, Math.max(1, parseInt(d.meses, 10) || 1));
        ui.proyeccion = { capital, meses, filas: B.proyeccionAhorro(capital, estado.config.tasaAhorroMensual, meses) };
      });
    },
    simular(d) {
      operar(() => {
        const monto = B.aCentavos(d.monto);
        if (monto <= 0) throw new B.ErrorBanco('El monto debe ser mayor que cero.');
        const plazo = Number(d.plazo);
        ui.simulacion = { monto, plazo, tabla: B.tablaAmortizacion(monto, estado.config.tasaPrestamoMensual, plazo) };
      });
    },
    solicitar(d) {
      operar(() => {
        B.solicitarPrestamo(estado, ui.numero, B.aCentavos(d.monto), d.plazo, d.motivo);
        ui.simulacion = null;
      }, 'Solicitud enviada a tu docente.');
    },
    'abrir-cuenta'(d) {
      operar(() => {
        const c = B.crearCliente(estado, d);
        ui.nuevasCuentas = [c];
        return c;
      }, (c) => 'Cuenta ' + c.numero + ' abierta para ' + c.nombre + '.');
    },
    'abrir-varias'(d) {
      const nombres = String(d.nombres).split('\n').map((n) => n.trim()).filter(Boolean);
      const creadas = [];
      const errores = [];
      nombres.forEach((nombre) => {
        try {
          creadas.push(B.crearCliente(estado, { nombre, pin: pinAleatorio() }));
        } catch (e) {
          errores.push(nombre + ': ' + e.message);
        }
      });
      guardar();
      ui.nuevasCuentas = creadas.length ? creadas : null;
      pintar();
      if (errores.length) mostrarAviso('Se abrieron ' + creadas.length + ' cuenta(s). Revisa: ' + errores.join(' · '), true);
      else mostrarAviso('Se abrieron ' + creadas.length + ' cuenta(s).');
    },
    ajuste(d, boton) {
      const tipo = boton && boton.value;
      operar(() => {
        const monto = B.aCentavos(d.monto);
        const motivo = 'Ajuste del docente' + (d.motivo ? ': ' + d.motivo.trim() : '');
        if (tipo === 'restar') B.retirar(estado, ui.seleccion, monto, motivo);
        else B.depositar(estado, ui.seleccion, monto, motivo);
      }, 'Saldo ajustado.');
    },
    'cambiar-pin'(d) {
      operar(() => B.cambiarPin(estado, ui.seleccion, d.pin), 'PIN actualizado.');
    },
    config(d) {
      operar(() =>
        B.actualizarConfig(estado, {
          nombreBanco: d.nombreBanco.trim(),
          simbolo: d.simbolo.trim(),
          saldoInicial: B.aCentavos(d.saldoInicial),
          montoMaximoPrestamo: B.aCentavos(d.montoMaximoPrestamo),
          tasaAhorroMensual: Number(d.tasaAhorroMensual),
          tasaPrestamoMensual: Number(d.tasaPrestamoMensual),
          plazosPrestamo: d.plazosPrestamo.split(/[,;\s]+/).filter(Boolean).map(Number).sort((a, b) => a - b),
          pinDocente: d.pinDocente,
        }), 'Reglas guardadas.');
    },
  };

  document.addEventListener('submit', (e) => {
    const form = e.target.closest('form[data-form]');
    if (!form) return;
    e.preventDefault();
    const datos = Object.fromEntries(new FormData(form).entries());
    formularios[form.dataset.form](datos, e.submitter);
  });

  // ---------- Botones ----------

  const acciones = {
    pestana(v) {
      ui.pestana = v;
      pintar();
    },
    salir() {
      Object.assign(ui, { vista: 'inicio', numero: null, pestana: null, seleccion: null, simulacion: null, proyeccion: null, nuevasCuentas: null });
      pintar();
    },
    seleccionar(v) {
      ui.seleccion = v;
      pintar();
      const det = document.getElementById('detalle');
      if (det) det.scrollIntoView({ behavior: 'smooth' });
    },
    'pagar-cuota'(v) {
      operar(() => B.pagarCuota(estado, ui.numero, v), 'Cuota pagada.');
    },
    aprobar(v) {
      operar(() => B.aprobarPrestamo(estado, v), 'Préstamo aprobado. El dinero ya está en la cuenta del estudiante.');
    },
    rechazar(v) {
      if (confirm('¿Rechazar esta solicitud?')) operar(() => B.rechazarPrestamo(estado, v), 'Solicitud rechazada.');
    },
    eliminar(v) {
      const c = estado.clientes.find((x) => x.numero === v);
      if (c && confirm('¿Cerrar la cuenta de ' + c.nombre + '? Se borrarán todos sus movimientos.')) {
        operar(() => {
          B.eliminarCliente(estado, v);
          ui.seleccion = null;
        }, 'Cuenta cerrada.');
      }
    },
    'cerrar-mes'() {
      if (!confirm('¿Cerrar el mes ' + estado.mes + '? Se pagarán intereses y se cobrarán las cuotas.')) return;
      operar(
        () => B.avanzarMes(estado),
        (r) => 'Mes ' + r.mes + ' cerrado: ' + dinero(r.interesesPagados) + ' en intereses, ' + r.cuotasCobradas + ' cuota(s) cobrada(s).'
      );
    },
    imprimir() {
      window.print();
    },
    'cerrar-nuevas'() {
      ui.nuevasCuentas = null;
      pintar();
    },
    exportar() {
      const blob = new Blob([B.exportar(estado)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'c4pital-copia-mes-' + estado.mes + '-' + new Date().toISOString().slice(0, 10) + '.json';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    },
    'borrar-todo'() {
      const r = prompt('Esto borrará TODO el banco. Escribe BORRAR para confirmar.');
      if (r && r.trim().toUpperCase() === 'BORRAR') {
        estado = B.estadoInicial();
        guardar();
        acciones.salir();
        mostrarAviso('El banco quedó vacío.');
      }
    },
  };

  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-accion]');
    if (!el || el.tagName === 'INPUT') return;
    const fn = acciones[el.dataset.accion];
    if (fn) fn(el.dataset.valor);
  });

  document.addEventListener('change', (e) => {
    if (e.target.dataset.accion !== 'importar' || !e.target.files[0]) return;
    const lector = new FileReader();
    lector.onload = () => {
      let nuevo;
      try {
        nuevo = B.importar(lector.result);
      } catch (err) {
        return mostrarAviso(err.message, true);
      }
      if (!confirm('¿Reemplazar los datos actuales con esta copia (' + nuevo.clientes.length + ' cuentas, mes ' + nuevo.mes + ')?')) return;
      estado = nuevo;
      Object.assign(ui, { seleccion: null, nuevasCuentas: null });
      guardar();
      pintar();
      mostrarAviso('Copia cargada.');
    };
    lector.readAsText(e.target.files[0]);
    e.target.value = '';
  });

  pintar();
})();
