/*
 * C4pital — interfaz de la banca móvil escolar.
 * Los datos se guardan en el navegador (localStorage) de esta computadora.
 */
(function () {
  'use strict';

  const B = window.Banco;
  const I = window.icono;
  const CLAVE = 'c4pital-banco';
  const CLAVE_SESION = 'c4pital-sesion';
  const CLAVE_OCULTAR = 'c4pital-ocultar';
  const app = document.getElementById('app');

  let estado = cargar();
  const ui = {
    modo: 'acceso', // acceso | estudiante | docente
    accesoDocente: false,
    numero: null,
    desdeDocente: false,
    pantalla: 'inicio',
    producto: null,
    op: null, // operación en curso: { tipo, paso, datos, recibo, volver }
    filtroMov: 'todos',
    ocultar: leerPreferencia(CLAVE_OCULTAR) === '1',
    seccion: 'resumen', // panel docente
    seleccion: null,
    filtroClientes: '',
    nuevasCuentas: null,
    pila: [], // pantallas anteriores, para el botón de volver
    calc: 'simple', // calculadora elegida
  };
  restaurarSesion();

  // ==========================================================
  // Guardado
  // ==========================================================

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
      avisar('No se pudo guardar en este navegador. Descarga una copia de seguridad.', true);
    }
  }

  function leerPreferencia(clave) {
    try {
      return localStorage.getItem(clave);
    } catch (e) {
      return null;
    }
  }

  function guardarPreferencia(clave, valor) {
    try {
      localStorage.setItem(clave, valor);
    } catch (e) {
      /* sin almacenamiento: se ignora */
    }
  }

  function guardarSesion() {
    try {
      sessionStorage.setItem(CLAVE_SESION, JSON.stringify({ modo: ui.modo, numero: ui.numero, desdeDocente: ui.desdeDocente }));
    } catch (e) {
      /* sin almacenamiento: se ignora */
    }
  }

  function restaurarSesion() {
    try {
      const s = JSON.parse(sessionStorage.getItem(CLAVE_SESION) || 'null');
      if (s && s.modo === 'docente') ui.modo = 'docente';
      if (s && s.modo === 'estudiante' && estado.clientes.some((c) => c.numero === s.numero)) {
        Object.assign(ui, { modo: 'estudiante', numero: s.numero, desdeDocente: !!s.desdeDocente });
      }
    } catch (e) {
      /* sin almacenamiento: se ignora */
    }
  }

  window.addEventListener('storage', (e) => {
    if (e.key === CLAVE) {
      estado = cargar();
      pintar();
    }
  });

  // ==========================================================
  // Utilidades
  // ==========================================================

  function esc(texto) {
    return String(texto == null ? '' : texto).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  }

  function dinero(centavos) {
    return B.formatear(centavos, estado.config.simbolo);
  }

  /** Monto que respeta el botón de "ocultar saldos". */
  function saldo(centavos) {
    return ui.ocultar ? estado.config.simbolo + ' • • • • •' : esc(dinero(centavos));
  }

  function conSigno(centavos, cuenta) {
    const texto = cuenta === 'dolares' ? B.formatear(centavos, B.SIMBOLO_USD) : dinero(centavos);
    return '<span class="' + (centavos >= 0 ? 'positivo' : 'negativo') + '">' + (centavos > 0 ? '+' : '') + esc(texto) + '</span>';
  }

  function unidades(centavos) {
    return (centavos / 100).toFixed(2);
  }

  function iniciales(nombre) {
    return esc(
      String(nombre)
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((p) => p[0].toUpperCase())
        .join('')
    );
  }

  function primerNombre(nombre) {
    return esc(String(nombre).split(/\s+/)[0]);
  }

  function fechaCorta(iso) {
    const d = new Date(iso);
    return d.toLocaleDateString('es-DO', { day: '2-digit', month: 'short' }) + ', ' + d.toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit' });
  }

  function fechaLarga(iso) {
    const d = new Date(iso);
    return d.toLocaleDateString('es-DO', { day: '2-digit', month: 'long', year: 'numeric' }) + ' · ' + d.toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit' });
  }

  function mascara(numero) {
    return '•••• ' + esc(String(numero).slice(-3));
  }

  function saludoHora() {
    const h = new Date().getHours();
    return h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches';
  }

  function pinAleatorio() {
    return String(Math.floor(Math.random() * 10000)).padStart(4, '0');
  }

  function clienteActual() {
    return estado.clientes.find((c) => c.numero === ui.numero);
  }

  function referencia(c) {
    const m = c.movimientos[0];
    return 'C4-' + String(estado.mes).padStart(2, '0') + '-' + String(m ? m.id.replace(/\D/g, '') : 0).padStart(6, '0');
  }

  function nombreTipo(tipo) {
    return (B.TIPOS_PRESTAMO[tipo] || B.TIPOS_PRESTAMO.personal).nombre;
  }

  function resumenCliente(c) {
    const activos = B.prestamosActivos(c);
    const rt = B.resumenTarjeta(c);
    return {
      tarjetaMora: !!(rt && rt.saldoCorte > 0 && rt.minimoPendiente > 0 && c.movimientos.some((m) => m.tipo === 'mora' && m.cuenta === 'tarjeta' && m.mes === estado.mes - 1)),
      activos,
      deuda: activos.reduce((s, p) => s + B.resumenPrestamo(p).saldoPendiente, 0),
      atrasadas: activos.reduce((s, p) => s + B.resumenPrestamo(p).cuotasAtrasadas, 0),
      solicitud: estado.solicitudes.find((s) => s.numero === c.numero),
    };
  }

  let temporizador;
  function avisar(texto, esError) {
    let el = document.getElementById('aviso');
    if (!el) {
      el = document.createElement('div');
      el.id = 'aviso';
      el.setAttribute('role', 'status');
      document.body.appendChild(el);
    }
    el.className = 'aviso' + (esError ? ' error' : '');
    el.innerHTML = I(esError ? 'alerta' : 'check') + '<span>' + esc(texto) + '</span>';
    el.hidden = false;
    clearTimeout(temporizador);
    temporizador = setTimeout(() => (el.hidden = true), esError ? 4500 : 2800);
  }

  /** Hoja inferior de confirmación. Devuelve una promesa con true/false (o el texto escrito). */
  function hoja(op) {
    return new Promise((resolver) => {
      const velo = document.createElement('div');
      velo.className = 'velo';
      velo.innerHTML =
        '<div class="hoja" role="dialog" aria-modal="true"><div class="hoja-asa"></div>' +
        '<div class="hoja-icono' + (op.peligro ? ' rojo' : '') + '">' + I(op.icono || (op.peligro ? 'alerta' : 'info')) + '</div>' +
        '<h3>' + esc(op.titulo) + '</h3><p>' + op.texto + '</p>' +
        (op.entrada ? '<label class="campo" style="margin-bottom:18px"><span>' + esc(op.entrada) + '</span><div class="control"><input data-hoja-entrada autocomplete="off" /></div></label>' : '') +
        '<div class="botones dos"><button class="boton borde" data-r="no">' + esc(op.cancelar || 'Cancelar') + '</button>' +
        '<button class="boton' + (op.peligro ? ' peligro' : '') + '" data-r="si">' + esc(op.ok || 'Aceptar') + '</button></div></div>';
      function cerrar(valor) {
        velo.remove();
        document.removeEventListener('keydown', tecla);
        resolver(valor);
      }
      function tecla(e) {
        if (e.key === 'Escape') cerrar(false);
      }
      velo.addEventListener('click', (e) => {
        if (e.target === velo) return cerrar(false);
        const b = e.target.closest('[data-r]');
        if (!b) return;
        if (b.dataset.r === 'no') return cerrar(false);
        const entrada = velo.querySelector('[data-hoja-entrada]');
        cerrar(entrada ? entrada.value : true);
      });
      document.addEventListener('keydown', tecla);
      document.body.appendChild(velo);
      const foco = velo.querySelector('[data-hoja-entrada]') || velo.querySelector('[data-r="si"]');
      foco.focus();
    });
  }

  // ==========================================================
  // Piezas reutilizables
  // ==========================================================

  const ESTILO_MOV = {
    apertura: ['estrella', 'oro'],
    deposito: ['entrada', 'verde'],
    retiro: ['salida', 'rojo'],
    ahorro: ['alcancia', 'turquesa'],
    interes: ['porcentaje', 'verde'],
    prestamo: ['prestamo', 'morado'],
    cuota: ['pagos', 'morado'],
    pago: ['pagos', 'oro'],
    comision: ['porcentaje', 'rojo'],
    impuesto: ['pagos', 'rojo'],
    mora: ['alerta', 'rojo'],
    'interes-cobrado': ['porcentaje', 'rojo'],
    compra: ['tarjeta', 'morado'],
    avance: ['dinero', 'morado'],
    'pago-tarjeta': ['tarjeta', 'verde'],
    certificado: ['escudo', 'verde'],
    divisas: ['dolar', 'turquesa'],
  };

  const NOMBRE_CUENTA = { corriente: 'Corriente', ahorro: 'Ahorro', dolares: 'Dólares', tarjeta: 'Tarjeta' };

  /** Formatea según la moneda de la cuenta (dólares o la moneda del banco). */
  function dineroDe(cuenta, centavos) {
    return cuenta === 'dolares' ? B.formatear(centavos, B.SIMBOLO_USD) : dinero(centavos);
  }

  function usd(centavos) {
    return B.formatear(centavos, B.SIMBOLO_USD);
  }

  function itemMovimiento(m, nombre) {
    const estilo = m.tipo === 'transferencia' ? ['transferir', m.monto >= 0 ? 'verde' : 'rojo'] : ESTILO_MOV[m.tipo] || ['dinero', ''];
    return (
      '<li class="item"><span class="item-icono ' + estilo[1] + '">' + I(estilo[0]) + '</span>' +
      '<span class="item-texto"><strong>' + esc(m.descripcion) + '</strong><small>' + (nombre ? esc(nombre) + ' · ' : '') +
      (NOMBRE_CUENTA[m.cuenta] || 'Corriente') + ' · Mes ' + m.mes + ' · ' + esc(fechaCorta(m.fecha)) + '</small></span>' +
      '<span class="item-monto">' + conSigno(m.monto, m.cuenta) + '<small>' + (ui.ocultar && !nombre ? '' : (m.cuenta === 'tarjeta' ? 'Deuda ' + esc(dinero(-m.saldo)) : 'Saldo ' + esc(dineroDe(m.cuenta, m.saldo)))) + '</small></span></li>'
    );
  }

  function listaMovimientos(movs, vacio) {
    if (!movs.length) return '<div class="vacio">' + I('reloj') + '<p>' + (vacio || 'Todavía no hay movimientos.') + '</p></div>';
    return '<ul class="lista">' + movs.map((m) => itemMovimiento(m)).join('') + '</ul>';
  }

  function barraSuperior(titulo, accion, icono, clara) {
    return (
      '<header class="barra-superior' + (clara ? ' clara' : '') + '">' +
      '<button class="icono-boton" data-accion="' + (accion || 'volver') + '" aria-label="Volver">' + I(icono || 'atras') + '</button>' +
      '<h1>' + esc(titulo) + '</h1></header>'
    );
  }

  function tablaAmortizacion(tabla, pagadas) {
    return (
      '<div class="tabla-envoltura"><table><thead><tr><th>N.º</th><th class="num">Cuota</th><th class="num">Interés</th><th class="num">Capital</th><th class="num">Saldo</th></tr></thead><tbody>' +
      tabla
        .map(
          (f) =>
            '<tr class="' + (pagadas != null && f.numero <= pagadas ? 'pagada' : '') + '"><td>' + f.numero +
            (pagadas != null && f.numero <= pagadas ? ' <span class="etiqueta verde">' + I('check') + '</span>' : '') + '</td>' +
            '<td class="num">' + esc(dinero(f.cuota)) + '</td><td class="num">' + esc(dinero(f.interes)) + '</td>' +
            '<td class="num">' + esc(dinero(f.capital)) + '</td><td class="num">' + esc(dinero(f.saldo)) + '</td></tr>'
        )
        .join('') +
      '</tbody></table></div>'
    );
  }

  function campoMontoGrande(valor, disponible, simbolo) {
    simbolo = simbolo || estado.config.simbolo;
    return (
      '<div class="monto-grande"><span>' + esc(simbolo) + '</span>' +
      '<input name="monto" type="number" inputmode="decimal" min="0.01" step="0.01" placeholder="0.00" aria-label="Monto" required value="' + esc(valor || '') + '" /></div>' +
      (disponible != null ? '<p class="disponible">Disponible: <strong>' + esc(B.formatear(disponible, simbolo)) + '</strong></p>' : '') +
      '<div class="montos-rapidos">' + (simbolo === B.SIMBOLO_USD ? [5, 10, 20, 50] : [50, 100, 250, 500]).map((v) => '<button type="button" data-accion="monto-rapido" data-valor="' + v + '">' + esc(simbolo) + v + '</button>').join('') + '</div>'
    );
  }

  function campo(etiqueta, control, icono) {
    return '<label class="campo"><span>' + esc(etiqueta) + '</span><div class="control">' + (icono ? I(icono) : '') + control + '</div></label>';
  }

  function opcion(nombre, valor, marcado, contenido, texto) {
    const id = 'op-' + nombre + '-' + String(valor).replace(/\W/g, '');
    return (
      '<div class="opcion"' + (texto ? ' data-texto="' + esc(texto.toLowerCase()) + '"' : '') + '><input type="radio" id="' + id + '" name="' + nombre + '" value="' + esc(valor) + '"' + (marcado ? ' checked' : '') + ' />' +
      '<label for="' + id + '">' + contenido + '<span class="marca-check">' + I('check') + '</span></label></div>'
    );
  }

  function filaResumen(etiqueta, valor, clase) {
    return '<div class="resumen-fila' + (clase ? ' ' + clase : '') + '"><span>' + esc(etiqueta) + '</span><strong>' + valor + '</strong></div>';
  }

  // ==========================================================
  // Acceso
  // ==========================================================

  function vistaAcceso() {
    const nombres = estado.clientes.map((c) => '<option value="' + esc(c.nombre) + '">' + esc(c.numero) + '</option>').join('');
    let tarjeta;
    if (ui.accesoDocente) {
      tarjeta =
        '<div><h2>Acceso docente</h2><p class="ayuda">Administra las cuentas, aprueba préstamos y cierra el mes.</p></div>' +
        '<form class="formulario" data-form="entrar-docente">' +
        campo('Clave de docente', '<input class="pin" name="pin" type="password" inputmode="numeric" maxlength="4" autocomplete="off" required placeholder="••••" />', 'llave') +
        '<button class="boton">' + I('escudo') + 'Entrar al panel</button></form>' +
        (estado.config.pinDocente === B.CONFIG_INICIAL.pinDocente ? '<div class="aviso-banner azul">' + I('info') + '<span>La clave inicial es <strong>1234</strong>. Cámbiala en Ajustes.</span></div>' : '') +
        '<div class="acceso-pie"><button class="enlace" data-accion="acceso-estudiante">Volver al acceso de estudiantes</button></div>';
    } else {
      tarjeta =
        '<div><h2>Iniciar sesión</h2><p class="ayuda">Bienvenido a tu banca en línea.</p></div>' +
        (estado.clientes.length
          ? '<form class="formulario" data-form="entrar-estudiante">' +
            campo('Usuario', '<input name="usuario" list="lista-usuarios" autocomplete="off" required placeholder="Tu nombre o número de cuenta" />', 'usuario') +
            '<datalist id="lista-usuarios">' + nombres + '</datalist>' +
            campo('Clave', '<input class="pin" name="pin" type="password" inputmode="numeric" maxlength="4" autocomplete="off" required placeholder="••••" />', 'llave') +
            '<button class="boton">Iniciar sesión</button></form>'
          : '<div class="aviso-banner azul">' + I('info') + '<span>Aún no hay cuentas abiertas. Tu docente debe abrir tu cuenta desde el acceso docente.</span></div>') +
        '<div class="acceso-pie"><div>Nunca compartas tu clave con nadie.</div>' +
        '<button class="enlace" data-accion="acceso-docente">Soy docente</button>' +
        '<div>Dinero didáctico, sin valor real · Mes ' + estado.mes + '</div></div>';
    }
    return (
      '<div class="movil"><div class="acceso">' +
      '<div class="acceso-cabecera"><span class="marca-logo grande">C4</span><h1>' + esc(estado.config.nombreBanco) + '</h1>' +
      '<p class="lema">¡Multiplica tus ideas!</p><p>Banco escolar de 4.º A</p></div>' +
      '<div class="acceso-tarjeta">' + tarjeta + '</div></div></div>'
    );
  }

  // ==========================================================
  // Estudiante: pantallas
  // ==========================================================

  function vistaEstudiante() {
    const c = clienteActual();
    if (!c) {
      cerrarSesion();
      return vistaAcceso();
    }
    let cuerpo;
    let nav = true;
    if (ui.op) {
      cuerpo = pantallaOperacion(c);
      nav = false;
    } else {
      const pantallas = {
        inicio: pInicio,
        movimientos: pMovimientos,
        producto: pProducto,
        pagos: pPagos,
        productos: pProductos,
        prestamos: pPrestamos,
        certificados: pCertificados,
        divisas: pDivisas,
        calculadoras: pCalculadoras,
        tarifario: pTarifario,
        mas: pMas,
      };
      cuerpo = (pantallas[ui.pantalla] || pInicio)(c);
      if (SUBPANTALLAS.includes(ui.pantalla)) nav = false;
    }
    return '<div class="movil"><main class="contenido' + (nav ? '' : ' sin-nav') + '">' + cuerpo + '</main>' + (nav ? navInferior(c) : '') + '</div>';
  }

  /** Pantallas con botón de volver (sin menú inferior). */
  const SUBPANTALLAS = ['movimientos', 'producto', 'prestamos', 'certificados', 'divisas', 'calculadoras', 'tarifario'];

  function navInferior(c) {
    const r = resumenCliente(c);
    const items = [
      ['inicio', 'inicio', 'Inicio'],
      ['transferir', 'transferir', 'Transferir'],
      ['pagos', 'pagos', 'Pagos'],
      ['productos', 'billetera', 'Productos'],
      ['mas', 'mas', 'Más'],
    ];
    return (
      '<nav class="nav-inferior" aria-label="Menú principal">' +
      items
        .map(
          ([id, ico, txt]) =>
            '<button data-accion="ir" data-valor="' + id + '"' + (ui.pantalla === id ? ' aria-current="page"' : '') + '>' + I(ico) + txt +
            (id === 'productos' && (r.atrasadas || r.tarjetaMora) ? '<span class="punto-alerta"></span>' : '') + '</button>'
        )
        .join('') +
      '</nav>'
    );
  }

  function pInicio(c) {
    const r = resumenCliente(c);
    const total = c.saldos.corriente + c.saldos.ahorro;
    const rt = B.resumenTarjeta(c);
    const certs = B.certificadosActivos(c);
    let html =
      '<section class="cabecera"><div class="cabecera-fila"><span class="avatar">' + iniciales(c.nombre) + '</span>' +
      '<div class="saludo"><small>' + saludoHora() + ',</small><strong>' + esc(c.nombre) + '</strong></div>' +
      '<button class="icono-boton" data-accion="ocultar" aria-label="' + (ui.ocultar ? 'Mostrar saldos' : 'Ocultar saldos') + '">' + I(ui.ocultar ? 'ojoCerrado' : 'ojo') + '</button>' +
      '<button class="icono-boton" data-accion="salir" aria-label="Cerrar sesión">' + I('salir') + '</button></div>' +
      '<div class="total"><small>Saldo total disponible</small><div class="total-monto">' + saldo(total) + '</div>' +
      '<span class="chip">' + I('calendario') + 'Mes ' + estado.mes + '</span></div></section>';

    html += '<div class="carrusel" aria-label="Mis productos">';
    html +=
      '<button class="producto" data-accion="producto" data-valor="corriente"><span class="producto-tipo">' + I('tarjeta') + 'Cuenta Corriente<span class="producto-chip"></span></span>' +
      '<span class="producto-saldo">' + saldo(c.saldos.corriente) + '</span><span class="producto-pie"><span>Disponible</span><span>' + mascara(c.numero) + '</span></span></button>';
    html +=
      '<button class="producto ahorro" data-accion="producto" data-valor="ahorro"><span class="producto-tipo">' + I('alcancia') + 'Cuenta de Ahorro</span>' +
      '<span class="producto-saldo">' + saldo(c.saldos.ahorro) + '</span><span class="producto-pie"><span>Gana ' + estado.config.tasaAhorroMensual + '% mensual</span><span>' + mascara(c.numero) + '-A</span></span></button>';
    r.activos.forEach((p) => {
      const rp = B.resumenPrestamo(p);
      html +=
        '<button class="producto prestamo" data-accion="producto" data-valor="' + esc(p.id) + '"><span class="producto-tipo">' + I('prestamo') + 'Préstamo ' + esc(nombreTipo(p.tipo).toLowerCase()) + '</span>' +
        '<span class="producto-saldo">' + saldo(rp.saldoPendiente) + '</span><span class="producto-pie"><span>Saldo pendiente</span><span>' + p.cuotasPagadas + '/' + p.plazo + ' cuotas</span></span></button>';
    });
    if (rt) {
      html +=
        '<button class="producto credito" data-accion="producto" data-valor="tarjeta"><span class="producto-tipo">' + I('tarjeta') + 'Tarjeta de crédito<span class="producto-chip"></span></span>' +
        '<span class="producto-saldo">' + saldo(rt.disponible) + '</span><span class="producto-pie"><span>Disponible · debe ' + saldo(rt.deuda) + '</span><span>•••• ' + esc(c.tarjeta.numero.slice(-4)) + '</span></span></button>';
    }
    if (certs.length) {
      html +=
        '<button class="producto certificado" data-accion="ir" data-valor="certificados"><span class="producto-tipo">' + I('escudo') + 'Certificados</span>' +
        '<span class="producto-saldo">' + saldo(certs.reduce((t, x) => t + x.capital + x.interes, 0)) + '</span><span class="producto-pie"><span>' + certs.length + ' activo(s)</span><span>' + estado.config.tasaCertificadoMensual + '% mensual</span></span></button>';
    }
    if (c.saldos.dolares > 0) {
      html +=
        '<button class="producto dolares" data-accion="producto" data-valor="dolares"><span class="producto-tipo">' + I('dolar') + 'Cuenta en dólares</span>' +
        '<span class="producto-saldo">' + (ui.ocultar ? 'US$ • • • •' : esc(usd(c.saldos.dolares))) + '</span><span class="producto-pie"><span>≈ ' + saldo(Math.round(c.saldos.dolares * estado.config.tasaCompraUSD)) + '</span><span>' + mascara(c.numero) + '-D</span></span></button>';
    }
    if (!rt) html += '<button class="producto nuevo" data-accion="producto" data-valor="tarjeta">' + I('tarjeta') + 'Pide tu tarjeta de crédito</button>';
    else if (!r.activos.length) html += '<button class="producto nuevo" data-accion="operar" data-valor="solicitud">' + I('mas1') + 'Solicitar un préstamo</button>';
    html += '</div>';

    if (r.atrasadas) {
      html += '<div class="seccion"><div class="aviso-banner rojo">' + I('alerta') + '<span>Tienes <strong>' + r.atrasadas + ' cuota(s) atrasada(s)</strong>. Paga tu préstamo para ponerte al día. <button class="enlace" data-accion="operar" data-valor="cuota">Pagar ahora</button></span></div></div>';
    }
    if (r.solicitud) {
      html += '<div class="seccion"><div class="aviso-banner azul">' + I('reloj') + '<span>Tu solicitud de préstamo por <strong>' + esc(dinero(r.solicitud.monto)) + '</strong> está en revisión.</span></div></div>';
    }
    if (rt && rt.minimoPendiente > 0) {
      html +=
        '<div class="seccion"><div class="aviso-banner' + (r.tarjetaMora ? ' rojo' : '') + '">' + I('tarjeta') + '<span>Pago mínimo de tu tarjeta: <strong>' + esc(dinero(rt.minimoPendiente)) +
        '</strong> antes del cierre del mes ' + estado.mes + '. <button class="enlace" data-accion="operar" data-valor="pago-tarjeta">Pagar</button></span></div></div>';
    }

    const accesos = [
      ['operar', 'transferencia', 'transferir', 'Transferir'],
      ['operar', 'deposito', 'entrada', 'Depositar'],
      ['operar', 'retiro', 'salida', 'Retirar'],
      ['operar', 'servicio', 'pagos', 'Pagar servicios'],
      ['operar', 'mover', 'alcancia', 'Ahorrar'],
      ['producto', 'tarjeta', 'tarjeta', 'Tarjeta de crédito'],
      ['ir', 'prestamos', 'prestamo', 'Préstamos'],
      ['ir', 'certificados', 'escudo', 'Certificados'],
      ['ir', 'divisas', 'dolar', 'Divisas'],
      ['ir', 'calculadoras', 'calculadora', 'Calculadoras'],
      ['ir', 'tarifario', 'lista', 'Tarifario'],
      ['ir', 'mas', 'libro', 'Aprende'],
    ];
    html +=
      '<section class="seccion"><div class="seccion-titulo"><h2>¿Qué quieres hacer?</h2></div><div class="accesos">' +
      accesos.map(([a, v, ico, t]) => '<button class="acceso-rapido" data-accion="' + a + '" data-valor="' + v + '"><span class="burbuja">' + I(ico) + '</span>' + t + '</button>').join('') +
      '</div></section>';

    html +=
      '<section class="seccion"><div class="seccion-titulo"><h2>Últimos movimientos</h2>' +
      (c.movimientos.length > 5 ? '<button data-accion="ir" data-valor="movimientos">Ver todos</button>' : '') + '</div>' +
      '<div class="panel">' + listaMovimientos(c.movimientos.slice(0, 5)) + '</div></section>';
    return html;
  }

  function pMovimientos(c) {
    const filtro = ui.filtroMov;
    const movs = c.movimientos.filter((m) => filtro === 'todos' || (filtro === 'entradas' ? m.monto > 0 : m.monto < 0));
    let html = barraSuperior('Movimientos');
    html +=
      '<div class="seccion"><div class="segmentos" role="group">' +
      [['todos', 'Todos'], ['entradas', 'Entradas'], ['salidas', 'Salidas']]
        .map(([v, t]) => '<button data-accion="filtro-mov" data-valor="' + v + '" aria-pressed="' + (filtro === v) + '">' + t + '</button>')
        .join('') +
      '</div></div>';
    const porMes = {};
    movs.forEach((m) => (porMes[m.mes] = porMes[m.mes] || []).push(m));
    const meses = Object.keys(porMes).sort((a, b) => b - a);
    if (!meses.length) return html + '<div class="seccion"><div class="panel">' + listaMovimientos([]) + '</div></div>';
    meses.forEach((mes) => {
      html += '<section class="seccion"><div class="seccion-titulo"><h2>Mes ' + mes + '</h2></div><div class="panel">' + listaMovimientos(porMes[mes]) + '</div></section>';
    });
    return html;
  }

  function pProducto(c) {
    if (ui.producto === 'corriente') return productoCorriente(c);
    if (ui.producto === 'ahorro') return productoAhorro(c);
    if (ui.producto === 'dolares') return productoDolares(c);
    if (ui.producto === 'tarjeta') return productoTarjeta(c);
    const p = c.prestamos.find((x) => x.id === ui.producto);
    return p ? productoPrestamo(c, p) : pInicio(c);
  }

  function cabezaDetalle(clase, titulo, montoHtml, numero, acciones, extra, etiqueta) {
    return (
      barraSuperior(titulo).replace('barra-superior', 'barra-superior ' + clase) +
      '<section class="detalle-cabeza ' + clase + '"><small>' + (etiqueta || (clase === 'prestamo' ? 'Saldo pendiente' : 'Saldo disponible')) + '</small>' +
      '<div class="saldo">' + montoHtml + '</div>' +
      (numero ? '<button class="numero enlace" style="color:inherit" data-accion="copiar" data-valor="' + esc(numero) + '">Cuenta ' + esc(numero) + ' ' + I('copiar') + '</button>' : '') +
      (extra || '') +
      '<div class="detalle-acciones">' + acciones.map(([a, v, ico, t]) => '<button data-accion="' + a + '" data-valor="' + v + '">' + I(ico) + t + '</button>').join('') + '</div></section>'
    );
  }

  function datos(pares) {
    return '<div class="panel datos" style="display:grid">' + pares.map(([e, v]) => '<div><small>' + esc(e) + '</small><strong>' + v + '</strong></div>').join('') + '</div>';
  }

  function seccion(titulo, contenido, extra) {
    return '<section class="seccion"' + (extra || '') + '>' + (titulo ? '<div class="seccion-titulo"><h2>' + esc(titulo) + '</h2></div>' : '') + contenido + '</section>';
  }

  function productoCorriente(c) {
    const cfg = estado.config;
    let html = cabezaDetalle('', 'Cuenta Corriente', saldo(c.saldos.corriente), c.numero, [
      ['operar', 'transferencia', 'transferir', 'Transferir'],
      ['operar', 'deposito', 'entrada', 'Depositar'],
      ['operar', 'retiro', 'salida', 'Retirar'],
    ]);
    html += seccion(
      '',
      datos([
        ['Titular', esc(c.nombre)],
        ['Estado', '<span class="etiqueta verde">Activa</span>'],
        ['Saldo mínimo', esc(dinero(cfg.saldoMinimo))],
        ['Mantenimiento', esc(dinero(cfg.cargoMantenimiento)) + ' si bajas del mínimo'],
      ])
    );
    if (cfg.cargoMantenimiento > 0 && c.saldos.corriente < cfg.saldoMinimo) {
      html += '<div class="seccion"><div class="aviso-banner">' + I('alerta') + '<span>Tu saldo está por debajo de ' + esc(dinero(cfg.saldoMinimo)) + '. Al cerrar el mes se cobrará un cargo de mantenimiento de ' + esc(dinero(cfg.cargoMantenimiento)) + '.</span></div></div>';
    }
    html += seccion('Movimientos de la cuenta', '<div class="panel">' + listaMovimientos(c.movimientos.filter((m) => m.cuenta === 'corriente')) + '</div>');
    return html;
  }

  function productoAhorro(c) {
    const tasa = estado.config.tasaAhorroMensual;
    const ganado = c.movimientos.filter((m) => m.tipo === 'interes' && m.cuenta === 'ahorro').reduce((s, m) => s + m.monto, 0);
    let html = cabezaDetalle('ahorro', 'Cuenta de Ahorro', saldo(c.saldos.ahorro), c.numero + '-A', [
      ['operar', 'mover', 'entrada', 'Guardar'],
      ['operar', 'mover-sacar', 'salida', 'Sacar'],
      ['calc', 'compuesto', 'calculadora', 'Calcular'],
    ]);
    html += seccion(
      '',
      datos([
        ['Tasa de interés', tasa + '% mensual'],
        ['Tipo de interés', 'Compuesto'],
        ['Intereses ganados', '<span class="positivo">' + esc(dinero(ganado)) + '</span>'],
        ['Próximo interés', esc(dinero(Math.round((c.saldos.ahorro * tasa) / 100)))],
        ['Tasa anual equivalente', B.formulas.tasaAnualEquivalente(tasa).toFixed(2) + '%'],
        ['Comisiones', 'Ninguna'],
      ]) + '<p class="ayuda" style="margin-top:8px">El interés se paga cuando tu docente cierra el mes.</p>'
    );
    html += seccion('Movimientos del ahorro', '<div class="panel">' + listaMovimientos(c.movimientos.filter((m) => m.cuenta === 'ahorro'), 'Todavía no has ahorrado. ¡Empieza hoy!') + '</div>');
    return html;
  }

  function productoDolares(c) {
    const cfg = estado.config;
    let html = cabezaDetalle('dolares', 'Cuenta en dólares', ui.ocultar ? 'US$ • • • •' : esc(usd(c.saldos.dolares)), c.numero + '-D', [
      ['operar', 'divisas', 'entrada', 'Comprar US$'],
      ['operar', 'divisas-vender', 'salida', 'Vender US$'],
      ['ir', 'divisas', 'globo', 'Tasas'],
    ]);
    html += seccion(
      '',
      datos([
        ['Equivale a', esc(dinero(Math.round(c.saldos.dolares * cfg.tasaCompraUSD)))],
        ['Tasa de compra', esc(dinero(Math.round(cfg.tasaCompraUSD * 100)))],
        ['Tasa de venta', esc(dinero(Math.round(cfg.tasaVentaUSD * 100)))],
        ['Moneda', 'Dólar estadounidense'],
      ])
    );
    html += seccion('Movimientos', '<div class="panel">' + listaMovimientos(c.movimientos.filter((m) => m.cuenta === 'dolares'), 'Todavía no tienes dólares.') + '</div>');
    return html;
  }

  function tarjetaVisual(c) {
    const t = c.tarjeta;
    return (
      '<div class="plastico"><div class="plastico-fila"><span class="marca"><span class="marca-logo" style="width:34px;height:34px;font-size:.85rem">C4</span>' + esc(estado.config.nombreBanco) + '</span><span>Crédito</span></div>' +
      '<span class="producto-chip" style="margin:18px 0 10px"></span>' +
      '<div class="plastico-numero">' + (t ? esc(t.numero) : '•••• •••• •••• ••••') + '</div>' +
      '<div class="plastico-fila"><span>' + esc(c.nombre.toUpperCase()) + '</span><span>' + (t ? 'Desde mes ' + t.activadaMes : '') + '</span></div></div>'
    );
  }

  function productoTarjeta(c) {
    const cfg = estado.config;
    const r = B.resumenTarjeta(c);
    if (!r) {
      return (
        barraSuperior('Tarjeta de crédito') +
        '<section class="seccion">' + tarjetaVisual(c) + '</section>' +
        '<div class="paso-titulo"><h2>Pide tu tarjeta de crédito</h2><p>Compra ahora y paga después. Si pagas el total cada mes, no pagas intereses.</p></div>' +
        seccion(
          'Condiciones',
          '<div class="panel"><div class="panel-cuerpo resumen">' +
            filaResumen('Límite de crédito', esc(dinero(cfg.limiteTarjeta))) +
            filaResumen('Tasa de interés', cfg.tasaTarjetaMensual + '% mensual (' + B.formulas.tasaAnualEquivalente(cfg.tasaTarjetaMensual).toFixed(1) + '% anual)') +
            filaResumen('Pago mínimo', cfg.pagoMinimoPorcentaje + '% del saldo (mínimo ' + esc(dinero(cfg.pagoMinimoFijo)) + ')') +
            filaResumen('Cargo por mora', esc(dinero(cfg.cargoMoraTarjeta))) +
            filaResumen('Avance de efectivo', cfg.comisionAvance + '% de comisión') +
            filaResumen('Cuota de emisión', esc(dinero(cfg.cuotaEmisionTarjeta))) +
            '</div></div>'
        ) +
        '<section class="seccion"><button class="boton oro" data-accion="operar" data-valor="activar-tarjeta">' + I('tarjeta') + 'Solicitar mi tarjeta</button></section>'
      );
    }
    let html = cabezaDetalle(
      'credito',
      'Tarjeta de crédito',
      saldo(r.disponible),
      null,
      [
        ['operar', 'compra', 'bolsa', 'Comprar'],
        ['operar', 'avance', 'dinero', 'Avance'],
        ['operar', 'pago-tarjeta', 'pagos', 'Pagar'],
      ],
      '<div class="progreso"><span style="width:' + r.uso + '%"></span></div><small>Usaste ' + saldo(r.deuda) + ' de ' + esc(dinero(r.limite)) + ' (' + r.uso + '%)</small>',
      'Crédito disponible'
    );
    html += seccion(
      'Estado de cuenta',
      datos([
        ['Saldo al corte', esc(dinero(r.saldoCorte))],
        ['Pago mínimo', esc(dinero(r.pagoMinimo))],
        ['Pagado desde el corte', esc(dinero(r.pagosDesdeCorte))],
        ['Fecha límite', 'Cierre del mes ' + estado.mes],
        ['Deuda actual', esc(dinero(r.deuda))],
        ['Tasa', c.tarjeta.tasa + '% mensual'],
      ]) +
        (r.saldoCorte > 0
          ? '<div class="aviso-banner azul" style="margin-top:12px">' + I('info') + '<span>Si pagas <strong>' + esc(dinero(r.cortePendiente)) + '</strong> (saldo al corte) antes del cierre, no pagas intereses. Si solo pagas el mínimo, pagarás ' + c.tarjeta.tasa + '% de interés sobre el resto.</span></div>'
          : '<p class="ayuda" style="margin-top:8px">Tu primer estado de cuenta llegará al cerrar el mes.</p>')
    );
    html += seccion('Movimientos de la tarjeta', '<div class="panel">' + listaMovimientos(c.movimientos.filter((m) => m.cuenta === 'tarjeta'), 'Todavía no has usado tu tarjeta.') + '</div>');
    return html;
  }

  function productoPrestamo(c, p) {
    const r = B.resumenPrestamo(p);
    const avance = Math.round((p.cuotasPagadas / p.plazo) * 100);
    let html = cabezaDetalle(
      'prestamo',
      'Préstamo ' + nombreTipo(p.tipo).toLowerCase(),
      saldo(r.saldoPendiente),
      null,
      [
        ['operar', 'cuota', 'pagos', 'Pagar cuota'],
        ['calc', 'prestamo', 'calculadora', 'Simular'],
        ['ir', 'movimientos', 'reloj', 'Historial'],
      ],
      '<div class="progreso"><span style="width:' + avance + '%"></span></div><small>' + p.cuotasPagadas + ' de ' + p.plazo + ' cuotas pagadas</small>'
    );
    if (r.cuotasAtrasadas) {
      html += '<div class="seccion"><div class="aviso-banner rojo">' + I('alerta') + '<span>Tienes ' + r.cuotasAtrasadas + ' cuota(s) atrasada(s)' + (r.mora ? ' y ' + esc(dinero(r.mora)) + ' de mora' : '') + '.</span></div></div>';
    }
    html += seccion(
      '',
      datos([
        ['Monto prestado', esc(dinero(p.monto))],
        ['Tasa', p.tasa + '% mensual'],
        ['Sistema', esc(B.SISTEMAS[p.sistema])],
        ['Plazo', p.plazo + ' meses'],
        [p.sistema === 'aleman' ? 'Próxima cuota' : 'Cuota fija', esc(dinero(r.proximaCuota || r.cuota))],
        ['Mora pendiente', esc(dinero(r.mora))],
        ['Total a pagar', esc(dinero(r.totalPagar))],
        ['Total de intereses', '<span class="negativo">' + esc(dinero(r.totalIntereses)) + '</span>'],
      ]) + (p.motivo ? '<p class="ayuda" style="margin-top:8px">Motivo: «' + esc(p.motivo) + '»</p>' : '')
    );
    html += seccion('Tabla de amortización', '<div class="panel">' + tablaAmortizacion(p.tabla, p.cuotasPagadas) + '</div>');
    return html;
  }

  const SERVICIOS = [
    ['Energía eléctrica', 'rayo'],
    ['Agua potable', 'gota'],
    ['Internet', 'wifi'],
    ['Telefonía móvil', 'telefono'],
    ['Cantina escolar', 'cubiertos'],
    ['Transporte escolar', 'bus'],
    ['Materiales escolares', 'libro'],
  ];

  function pPagos(c) {
    const r = resumenCliente(c);
    const rt = B.resumenTarjeta(c);
    let html = '<header class="barra-superior"><h1 style="margin-right:0">Pagos</h1></header>';
    let propios = '';
    r.activos.forEach((p) => {
      const rp = B.resumenPrestamo(p);
      propios +=
        '<button class="item" data-accion="operar" data-valor="cuota"><span class="item-icono morado">' + I('prestamo') + '</span>' +
        '<span class="item-texto"><strong>Préstamo ' + esc(nombreTipo(p.tipo).toLowerCase()) + '</strong><small>Cuota ' + (p.cuotasPagadas + 1) + ' de ' + p.plazo + (rp.cuotasAtrasadas ? ' · <span class="negativo">' + rp.cuotasAtrasadas + ' atrasada(s)</span>' : '') + '</small></span>' +
        '<span class="item-monto">' + esc(dinero(rp.proximoPago)) + '</span>' + I('flecha') + '</button>';
    });
    if (rt && rt.deuda > 0) {
      propios +=
        '<button class="item" data-accion="operar" data-valor="pago-tarjeta"><span class="item-icono">' + I('tarjeta') + '</span>' +
        '<span class="item-texto"><strong>Tarjeta de crédito</strong><small>Mínimo ' + esc(dinero(rt.minimoPendiente)) + ' · Total ' + esc(dinero(rt.deuda)) + '</small></span>' + I('flecha') + '</button>';
    }
    html += seccion('Mis productos', '<div class="panel">' + (propios || '<div class="vacio">' + I('check') + '<p>No tienes pagos pendientes.</p></div>') + '</div>');
    html += seccion(
      'Pago de servicios',
      '<div class="panel">' +
        SERVICIOS.map(
          ([s, ico]) =>
            '<button class="item" data-accion="operar" data-valor="servicio" data-servicio="' + esc(s) + '"><span class="item-icono oro">' + I(ico) + '</span>' +
            '<span class="item-texto"><strong>' + esc(s) + '</strong><small>Pago simulado</small></span>' + I('flecha') + '</button>'
        ).join('') +
        '</div>'
    );
    return html;
  }

  function itemDepartamento(accion, valor, icono, color, titulo, detalle, derecha) {
    return (
      '<button class="item" data-accion="' + accion + '" data-valor="' + esc(valor) + '"><span class="item-icono ' + color + '">' + I(icono) + '</span>' +
      '<span class="item-texto"><strong>' + titulo + '</strong><small>' + detalle + '</small></span>' + (derecha ? '<span class="item-monto">' + derecha + '</span>' : '') + I('flecha') + '</button>'
    );
  }

  function pProductos(c) {
    const cfg = estado.config;
    const r = resumenCliente(c);
    const rt = B.resumenTarjeta(c);
    const certs = B.certificadosActivos(c);
    let html = '<header class="barra-superior"><h1 style="margin-right:0">Productos</h1></header>';
    html += seccion(
      'Cuentas',
      '<div class="panel">' +
        itemDepartamento('producto', 'corriente', 'tarjeta', '', 'Cuenta corriente', 'Para tus pagos y transferencias', saldo(c.saldos.corriente)) +
        itemDepartamento('producto', 'ahorro', 'alcancia', 'turquesa', 'Cuenta de ahorro', 'Gana ' + cfg.tasaAhorroMensual + '% mensual compuesto', saldo(c.saldos.ahorro)) +
        itemDepartamento('producto', 'dolares', 'dolar', 'turquesa', 'Cuenta en dólares', 'Ahorra en otra moneda', ui.ocultar ? 'US$ •••' : esc(usd(c.saldos.dolares))) +
        '</div>'
    );
    html += seccion(
      'Crédito',
      '<div class="panel">' +
        itemDepartamento('producto', 'tarjeta', 'tarjeta', 'morado', 'Tarjeta de crédito', rt ? 'Disponible ' + esc(dinero(rt.disponible)) : 'Límite de ' + esc(dinero(cfg.limiteTarjeta)) + ' · pídela aquí', rt ? saldo(rt.deuda) : '') +
        itemDepartamento('ir', 'prestamos', 'prestamo', 'morado', 'Préstamos', 'Personal, educativo y emprendimiento', r.activos.length ? saldo(r.deuda) : '') +
        '</div>'
    );
    html += seccion(
      'Inversión y divisas',
      '<div class="panel">' +
        itemDepartamento('ir', 'certificados', 'escudo', 'verde', 'Certificados de depósito', 'Plazo fijo al ' + cfg.tasaCertificadoMensual + '% mensual', certs.length ? saldo(certs.reduce((t, x) => t + x.capital, 0)) : '') +
        itemDepartamento('ir', 'divisas', 'globo', 'turquesa', 'Cambio de divisas', 'Compra ' + cfg.tasaCompraUSD + ' · Venta ' + cfg.tasaVentaUSD) +
        '</div>'
    );
    html += seccion(
      'Herramientas',
      '<div class="panel">' +
        itemDepartamento('ir', 'calculadoras', 'calculadora', 'oro', 'Calculadoras financieras', 'Interés simple, compuesto, anualidades y más') +
        itemDepartamento('ir', 'tarifario', 'lista', 'oro', 'Tarifario', 'Todas las tasas, comisiones e impuestos') +
        '</div>'
    );
    return html;
  }

  function pPrestamos(c) {
    const r = resumenCliente(c);
    const cfg = estado.config;
    let html = barraSuperior('Préstamos');
    if (r.solicitud) {
      html += '<div class="seccion"><div class="aviso-banner azul">' + I('reloj') + '<span>Tu solicitud por <strong>' + esc(dinero(r.solicitud.monto)) + '</strong> a ' + r.solicitud.plazo + ' meses está en revisión.</span></div></div>';
    }
    if (r.activos.length) {
      html += seccion(
        'Mis préstamos',
        '<div class="panel">' +
          r.activos
            .map((p) => {
              const rp = B.resumenPrestamo(p);
              return (
                '<button class="item" data-accion="producto" data-valor="' + esc(p.id) + '"><span class="item-icono morado">' + I('prestamo') + '</span>' +
                '<span class="item-texto"><strong>' + esc(nombreTipo(p.tipo)) + ' · ' + esc(dinero(p.monto)) + '</strong><small>' + p.cuotasPagadas + ' de ' + p.plazo + ' cuotas · ' + p.tasa + '% mensual</small>' +
                '<div class="progreso claro" style="margin:8px 0 0;height:6px"><span style="width:' + Math.round((p.cuotasPagadas / p.plazo) * 100) + '%;background:var(--morado)"></span></div></span>' +
                '<span class="item-monto">' + saldo(rp.saldoPendiente) + '<small>pendiente</small></span></button>'
              );
            })
            .join('') +
          '</div>'
      );
    }
    html += seccion(
      'Tipos de préstamo',
      '<div class="panel">' +
        Object.keys(B.TIPOS_PRESTAMO)
          .map((k) => {
            const tasa = cfg[B.TIPOS_PRESTAMO[k].tasa];
            return '<div class="item"><span class="item-icono morado">' + I(k === 'educativo' ? 'libro' : k === 'emprendimiento' ? 'grafica' : 'usuario') + '</span><span class="item-texto"><strong>' + esc(B.TIPOS_PRESTAMO[k].nombre) + '</strong><small>' + B.formulas.tasaAnualEquivalente(tasa).toFixed(1) + '% anual equivalente</small></span><span class="item-monto">' + tasa + '%<small>mensual</small></span></div>';
          })
          .join('') +
        '<div class="panel-cuerpo resumen">' +
        filaResumen('Monto máximo', esc(dinero(cfg.montoMaximoPrestamo))) +
        filaResumen('Plazos', cfg.plazosPrestamo.join(', ') + ' meses') +
        filaResumen('Comisión de apertura', cfg.comisionApertura + '% del monto') +
        filaResumen('Cargo por mora', esc(dinero(cfg.cargoMoraPrestamo)) + ' por mes atrasado') +
        filaResumen('Sistemas', 'Francés o alemán') +
        '</div>' +
        '<div class="panel-cuerpo" style="padding-top:0">' +
        (r.activos.length || r.solicitud
          ? '<p class="ayuda">Podrás pedir otro préstamo cuando termines de pagar el actual.</p>'
          : '<button class="boton" data-accion="operar" data-valor="solicitud">' + I('mas1') + 'Solicitar préstamo</button>') +
        '</div></div>'
    );
    const pagados = c.prestamos.filter((p) => B.resumenPrestamo(p).terminado);
    if (pagados.length) {
      html += seccion(
        'Préstamos pagados',
        '<div class="panel">' +
          pagados.map((p) => '<div class="item"><span class="item-icono verde">' + I('check') + '</span><span class="item-texto"><strong>' + esc(nombreTipo(p.tipo)) + ' · ' + esc(dinero(p.monto)) + '</strong><small>' + p.plazo + ' meses · Pagado</small></span></div>').join('') +
          '</div>'
      );
    }
    return html;
  }

  function pCertificados(c) {
    const cfg = estado.config;
    const activos = B.certificadosActivos(c);
    const otros = c.certificados.filter((x) => x.estado !== 'activo');
    let html = barraSuperior('Certificados de depósito');
    html +=
      '<div class="paso-titulo"><h2>Haz crecer tu dinero a plazo fijo</h2><p>Dejas tu dinero quieto un tiempo y el banco te paga más interés que en el ahorro.</p></div>' +
      seccion(
        '',
        datos([
          ['Tasa', cfg.tasaCertificadoMensual + '% mensual'],
          ['Plazos', cfg.plazosCertificado.join(', ') + ' meses'],
          ['Monto mínimo', esc(dinero(cfg.montoMinimoCertificado))],
          ['Cancelación anticipada', cfg.penalidadCertificado + '% de penalidad'],
        ]) + '<button class="boton" style="margin-top:14px" data-accion="operar" data-valor="certificado">' + I('mas1') + 'Abrir certificado</button>'
      );
    if (activos.length) {
      html += seccion(
        'Mis certificados',
        '<div class="panel">' +
          activos
            .map((x) => {
              const proy = B.proyeccionCertificado(x.capital, x.tasa, x.plazo, x.tipo);
              return (
                '<div class="panel-cuerpo" style="border-bottom:1px solid var(--borde)"><div class="cabecera-fila"><span class="item-icono verde">' + I('escudo') + '</span>' +
                '<div class="item-texto"><strong>' + esc(dinero(x.capital)) + ' a ' + x.plazo + ' meses</strong><small>Interés ' + x.tipo + ' · ' + x.tasa + '% mensual · desde el mes ' + x.mesInicio + '</small></div>' +
                '<span class="etiqueta verde">' + x.meses + '/' + x.plazo + '</span></div>' +
                '<div class="progreso claro" style="height:6px"><span style="width:' + Math.round((x.meses / x.plazo) * 100) + '%;background:var(--verde)"></span></div>' +
                '<div class="resumen">' +
                filaResumen('Intereses ganados hasta hoy', '<span class="positivo">' + esc(dinero(x.interes)) + '</span>') +
                filaResumen('Recibirás al vencer', esc(dinero(proy.final))) +
                '</div><button class="boton chico borde" style="color:var(--rojo)" data-accion="cancelar-certificado" data-valor="' + esc(x.id) + '">Cancelar antes de tiempo</button></div>'
              );
            })
            .join('') +
          '</div>'
      );
    }
    if (otros.length) {
      html += seccion(
        'Historial',
        '<div class="panel">' +
          otros
            .map((x) => '<div class="item"><span class="item-icono ' + (x.estado === 'vencido' ? 'verde' : 'rojo') + '">' + I(x.estado === 'vencido' ? 'check' : 'cerrar') + '</span><span class="item-texto"><strong>' + esc(dinero(x.capital)) + ' a ' + x.plazo + ' meses</strong><small>' + (x.estado === 'vencido' ? 'Vencido · ganó ' + esc(dinero(x.interes)) : 'Cancelado antes de tiempo') + '</small></span></div>')
            .join('') +
          '</div>'
      );
    }
    return html;
  }

  function pDivisas(c) {
    const cfg = estado.config;
    const diferencial = cfg.tasaVentaUSD - cfg.tasaCompraUSD;
    let html = barraSuperior('Cambio de divisas');
    html +=
      '<section class="seccion"><div class="panel"><div class="datos">' +
      '<div><small>El banco COMPRA a</small><strong>' + esc(dinero(Math.round(cfg.tasaCompraUSD * 100))) + '</strong></div>' +
      '<div><small>El banco VENDE a</small><strong>' + esc(dinero(Math.round(cfg.tasaVentaUSD * 100))) + '</strong></div></div>' +
      '<div class="panel-cuerpo"><div class="aviso-banner azul">' + I('info') + '<span>La diferencia entre venta y compra (<strong>' + esc(dinero(Math.round(diferencial * 100))) + '</strong> por dólar) es la ganancia del banco. Se llama <strong>diferencial cambiario</strong>.</span></div></div></div></section>';
    html += seccion(
      'Mis dólares',
      '<div class="panel">' + itemDepartamento('producto', 'dolares', 'dolar', 'turquesa', 'Cuenta en dólares', '≈ ' + esc(dinero(Math.round(c.saldos.dolares * cfg.tasaCompraUSD))), esc(usd(c.saldos.dolares))) + '</div>' +
        '<div class="botones dos" style="margin-top:14px"><button class="boton" data-accion="operar" data-valor="divisas">Comprar US$</button><button class="boton claro" data-accion="operar" data-valor="divisas-vender">Vender US$</button></div>'
    );
    html += seccion(
      'Ejemplo',
      '<div class="panel"><div class="panel-cuerpo resumen">' +
        filaResumen('Comprar US$100 te cuesta', esc(dinero(Math.round(10000 * cfg.tasaVentaUSD)))) +
        filaResumen('Vender US$100 te da', esc(dinero(Math.round(10000 * cfg.tasaCompraUSD)))) +
        filaResumen('Pierdes si compras y vendes', '<span class="negativo">' + esc(dinero(Math.round(10000 * diferencial))) + '</span>', 'total') +
        '</div></div>'
    );
    return html;
  }

  const CALCULADORAS = [
    ['simple', 'Interés simple'],
    ['compuesto', 'Interés compuesto'],
    ['anualidad', 'Ahorro programado'],
    ['tasas', 'Tasas equivalentes'],
    ['prestamo', 'Préstamos'],
  ];

  function pCalculadoras() {
    const tipo = ui.calc || 'simple';
    let html = barraSuperior('Calculadoras financieras');
    html +=
      '<div class="seccion"><div class="chips-desplazables">' +
      CALCULADORAS.map(([v, t]) => '<button data-accion="calc" data-valor="' + v + '" aria-pressed="' + (tipo === v) + '">' + t + '</button>').join('') +
      '</div></div>';
    html += '<section class="seccion"><div class="panel"><div class="panel-cuerpo formulario" data-calc="' + tipo + '">' + formularioCalculadora(tipo) + '<div data-resultado>' + resultadoCalculadora(tipo, valoresIniciales(tipo)) + '</div></div></div></section>';
    return html;
  }

  function valoresIniciales(tipo) {
    const cfg = estado.config;
    return {
      simple: { capital: 1000, tasa: 2, n: 6 },
      compuesto: { capital: 1000, tasa: cfg.tasaAhorroMensual, n: 12 },
      anualidad: { cuota: 100, tasa: cfg.tasaAhorroMensual, n: 12 },
      tasas: { mensual: cfg.tasaTarjetaMensual, anual: 12 },
      prestamo: { capital: 1000, tasa: cfg.tasaPrestamoMensual, n: 6 },
    }[tipo];
  }

  function formularioCalculadora(tipo) {
    const v = valoresIniciales(tipo);
    const num = (n, val, paso) => '<input name="' + n + '" type="number" min="0" step="' + (paso || 'any') + '" value="' + val + '" />';
    const formulas = {
      simple: 'I = C · i · n &nbsp;&nbsp; M = C + I',
      compuesto: 'M = C · (1 + i)<sup>n</sup>',
      anualidad: 'VF = A · [(1 + i)<sup>n</sup> − 1] ÷ i',
      tasas: 'i<sub>anual</sub> = (1 + i<sub>mensual</sub>)<sup>12</sup> − 1',
      prestamo: 'Francés: Cuota = P · i ÷ (1 − (1 + i)<sup>−n</sup>) &nbsp;·&nbsp; Alemán: Capital = P ÷ n',
    };
    const campos = {
      simple: campo('Capital (C)', num('capital', v.capital), 'dinero') + campo('Tasa mensual % (i)', num('tasa', v.tasa), 'porcentaje') + campo('Meses (n)', num('n', v.n, 1), 'calendario'),
      compuesto: campo('Capital (C)', num('capital', v.capital), 'dinero') + campo('Tasa mensual % (i)', num('tasa', v.tasa), 'porcentaje') + campo('Meses (n)', num('n', v.n, 1), 'calendario'),
      anualidad: campo('Depósito mensual (A)', num('cuota', v.cuota), 'dinero') + campo('Tasa mensual % (i)', num('tasa', v.tasa), 'porcentaje') + campo('Meses (n)', num('n', v.n, 1), 'calendario'),
      tasas: campo('Tasa mensual %', num('mensual', v.mensual), 'porcentaje') + campo('Tasa anual %', num('anual', v.anual), 'porcentaje'),
      prestamo: campo('Monto (P)', num('capital', v.capital), 'dinero') + campo('Tasa mensual % (i)', num('tasa', v.tasa), 'porcentaje') + campo('Meses (n)', num('n', v.n, 1), 'calendario'),
    };
    return '<p class="formula">' + formulas[tipo] + '</p><div class="fila-campos">' + campos[tipo] + '</div>';
  }

  function leerCalculadora(caja) {
    const v = {};
    caja.querySelectorAll('input').forEach((i) => (v[i.name] = Number(i.value)));
    return v;
  }

  function resultadoCalculadora(tipo, v) {
    const c = (x) => Math.round(x * 100);
    const n = Math.max(0, Math.min(120, Math.round(v.n || 0)));
    if (tipo === 'tasas') {
      return (
        '<div class="resumen">' +
        filaResumen(v.mensual + '% mensual equivale a', B.formulas.tasaAnualEquivalente(v.mensual || 0).toFixed(2) + '% anual', 'total') +
        filaResumen(v.anual + '% anual equivale a', B.formulas.tasaMensualEquivalente(v.anual || 0).toFixed(3) + '% mensual', 'total') +
        filaResumen('Ojo', 'No es lo mismo 2% mensual que 24% anual: con interés compuesto da ' + B.formulas.tasaAnualEquivalente(2).toFixed(2) + '%') +
        '</div>'
      );
    }
    if (!(n >= 1)) return '<p class="ayuda">Escribe una cantidad de meses mayor que cero.</p>';
    if (tipo === 'simple' || tipo === 'compuesto') {
      const r = B.formulas[tipo === 'simple' ? 'interesSimple' : 'interesCompuesto'](c(v.capital), v.tasa, n);
      const otro = B.formulas[tipo === 'simple' ? 'interesCompuesto' : 'interesSimple'](c(v.capital), v.tasa, n);
      return (
        '<div class="resumen">' +
        filaResumen('Capital', esc(dinero(c(v.capital)))) +
        filaResumen('Interés ganado', '<span class="positivo">+' + esc(dinero(r.interes)) + '</span>') +
        filaResumen('Monto final', esc(dinero(r.monto)), 'total') +
        filaResumen('Con interés ' + (tipo === 'simple' ? 'compuesto' : 'simple') + ' sería', esc(dinero(otro.monto))) +
        '</div>'
      );
    }
    if (tipo === 'anualidad') {
      const r = B.formulas.anualidad(c(v.cuota), v.tasa, n);
      return (
        '<div class="resumen">' +
        filaResumen('Depositaste en total', esc(dinero(r.aportado))) +
        filaResumen('Intereses ganados', '<span class="positivo">+' + esc(dinero(r.interes)) + '</span>') +
        filaResumen('Tendrás al final', esc(dinero(r.monto)), 'total') +
        '</div>'
      );
    }
    const capital = c(v.capital);
    if (!(capital > 0)) return '<p class="ayuda">Escribe el monto del préstamo.</p>';
    const fr = B.tablaAmortizacion(capital, v.tasa, n, 'frances');
    const al = B.tablaAmortizacion(capital, v.tasa, n, 'aleman');
    const total = (t) => t.reduce((s, f) => s + f.cuota, 0);
    return (
      '<div class="tabla-envoltura"><table><thead><tr><th></th><th class="num">Francés</th><th class="num">Alemán</th></tr></thead><tbody>' +
      '<tr><td>Primera cuota</td><td class="num">' + esc(dinero(fr[0].cuota)) + '</td><td class="num">' + esc(dinero(al[0].cuota)) + '</td></tr>' +
      '<tr><td>Última cuota</td><td class="num">' + esc(dinero(fr[n - 1].cuota)) + '</td><td class="num">' + esc(dinero(al[n - 1].cuota)) + '</td></tr>' +
      '<tr><td>Total de intereses</td><td class="num negativo">' + esc(dinero(total(fr) - capital)) + '</td><td class="num negativo">' + esc(dinero(total(al) - capital)) + '</td></tr>' +
      '<tr><td><strong>Total a pagar</strong></td><td class="num"><strong>' + esc(dinero(total(fr))) + '</strong></td><td class="num"><strong>' + esc(dinero(total(al))) + '</strong></td></tr>' +
      '</tbody></table></div>' +
      '<details class="acordeon"><summary class="enlace" style="padding:10px 0">Tabla francés</summary>' + tablaAmortizacion(fr) + '</details>' +
      '<details class="acordeon"><summary class="enlace" style="padding:10px 0">Tabla alemán</summary>' + tablaAmortizacion(al) + '</details>'
    );
  }

  function pTarifario() {
    const cfg = estado.config;
    const grupo = (titulo, icono, filas) =>
      seccion('', '<div class="panel"><div class="tarjeta-cabeza"><div class="cabecera-fila"><span class="item-icono oro">' + I(icono) + '</span><h2>' + titulo + '</h2></div></div><div class="panel-cuerpo resumen">' + filas.map(([e, v]) => filaResumen(e, v)).join('') + '</div></div>');
    const m = (x) => esc(dinero(x));
    return (
      barraSuperior('Tarifario') +
      '<div class="paso-titulo"><h2>Tasas, comisiones e impuestos</h2><p>Esto es lo que cobra (y lo que paga) ' + esc(cfg.nombreBanco) + '. Antes de usar un producto, revisa su costo.</p></div>' +
      grupo('Cuentas', 'tarjeta', [
        ['Interés del ahorro', cfg.tasaAhorroMensual + '% mensual'],
        ['Saldo mínimo en corriente', m(cfg.saldoMinimo)],
        ['Cargo por mantenimiento', m(cfg.cargoMantenimiento) + ' al mes'],
        ['Comisión por retiro', m(cfg.comisionRetiro)],
        ['Comisión por transferencia', m(cfg.comisionTransferencia)],
        ['Impuesto a transacciones', cfg.impuestoTransaccion + '% (retiros y transferencias)'],
        ['Depósitos y pago de servicios', 'Gratis'],
      ]) +
      grupo('Tarjeta de crédito', 'tarjeta', [
        ['Límite de crédito', m(cfg.limiteTarjeta)],
        ['Tasa de interés', cfg.tasaTarjetaMensual + '% mensual'],
        ['Pago mínimo', cfg.pagoMinimoPorcentaje + '% (mínimo ' + m(cfg.pagoMinimoFijo) + ')'],
        ['Cargo por mora', m(cfg.cargoMoraTarjeta)],
        ['Avance de efectivo', cfg.comisionAvance + '% de comisión'],
        ['Cuota de emisión', m(cfg.cuotaEmisionTarjeta)],
      ]) +
      grupo('Préstamos', 'prestamo', [
        ['Personal', cfg.tasaPrestamoMensual + '% mensual'],
        ['Educativo', cfg.tasaPrestamoEducativo + '% mensual'],
        ['Emprendimiento', cfg.tasaPrestamoEmprendimiento + '% mensual'],
        ['Comisión de apertura', cfg.comisionApertura + '%'],
        ['Cargo por mora', m(cfg.cargoMoraPrestamo) + ' por mes atrasado'],
      ]) +
      grupo('Certificados de depósito', 'escudo', [
        ['Tasa', cfg.tasaCertificadoMensual + '% mensual'],
        ['Monto mínimo', m(cfg.montoMinimoCertificado)],
        ['Penalidad por cancelar antes', cfg.penalidadCertificado + '% del capital'],
      ]) +
      grupo('Divisas', 'globo', [
        ['Compra de dólares (el banco compra)', m(Math.round(cfg.tasaCompraUSD * 100))],
        ['Venta de dólares (el banco vende)', m(Math.round(cfg.tasaVentaUSD * 100))],
      ])
    );
  }

  function pMas(c) {
    const cfg = estado.config;
    const aprende = [
      ['¿Qué es el interés?', 'porcentaje', 'El <strong>interés</strong> es el precio del dinero en el tiempo. Cuando ahorras, el banco te paga interés. Cuando pides prestado, tú le pagas interés al banco.'],
      ['Interés simple y compuesto', 'alcancia', 'Con interés <strong>simple</strong> ganas siempre sobre el capital inicial: <span class="formula" style="display:block;margin:6px 0">I = C · i · n</span>Con interés <strong>compuesto</strong> también ganas sobre los intereses anteriores: <span class="formula" style="display:block;margin-top:6px">M = C · (1 + i)<sup>n</sup></span>'],
      ['Sistemas de amortización', 'calculadora', 'En el sistema <strong>francés</strong> pagas la misma cuota todos los meses. En el <strong>alemán</strong> abonas lo mismo a capital cada mes, así que la cuota empieza alta y baja. El alemán paga menos intereses en total.'],
      ['La trampa del pago mínimo', 'tarjeta', 'Si solo pagas el <strong>mínimo</strong> de tu tarjeta, el resto genera ' + cfg.tasaTarjetaMensual + '% de interés al mes: ¡' + B.formulas.tasaAnualEquivalente(cfg.tasaTarjetaMensual).toFixed(0) + '% al año! Paga siempre el total del corte.'],
      ['Comisiones e impuestos', 'lista', 'Cada transferencia y retiro tiene costo. Retirar ' + esc(dinero(10000)) + ' te cuesta ' + esc(dinero(B.sumaCargos(B.cargosDe(estado, 'retiro', 10000)))) + ' en cargos. Agrupa tus operaciones para pagar menos.'],
      ['Diferencial cambiario', 'globo', 'El banco compra dólares más baratos de lo que los vende. Esa diferencia es su ganancia.'],
      ['Regla 50/30/20', 'grafica', 'Una forma sencilla de organizar tu dinero: <strong>50%</strong> para necesidades, <strong>30%</strong> para gustos y <strong>20%</strong> para ahorrar.'],
      ['Seguridad', 'escudo', 'Tu clave es personal. <strong>Nunca la compartas</strong>, ni siquiera con amigos. Un banco real nunca te pedirá tu clave por mensaje o llamada.'],
    ];
    let html =
      '<section class="perfil"><span class="avatar">' + iniciales(c.nombre) + '</span><div><strong style="font-size:1.1rem">' + esc(c.nombre) + '</strong><br><small>Cuenta ' + esc(c.numero) + ' · Cliente desde el mes ' + c.creadoMes + '</small></div></section>';
    html += seccion(
      'Mi cuenta',
      '<div class="panel">' +
        itemDepartamento('ir', 'movimientos', 'reloj', '', 'Historial de movimientos', 'Todas tus operaciones') +
        itemDepartamento('operar', 'clave', 'llave', '', 'Cambiar clave', 'Tu clave de 4 números') +
        itemDepartamento('ocultar', '', ui.ocultar ? 'ojoCerrado' : 'ojo', '', ui.ocultar ? 'Mostrar saldos' : 'Ocultar saldos', 'Privacidad en pantalla') +
        itemDepartamento('ir', 'tarifario', 'lista', '', 'Tarifario', 'Tasas, comisiones e impuestos') +
        itemDepartamento('ir', 'calculadoras', 'calculadora', '', 'Calculadoras financieras', 'Practica las fórmulas') +
        '</div>'
    );
    html += seccion(
      'Educación financiera',
      '<div class="panel">' +
        aprende.map(([t, ico, txt]) => '<details class="acordeon"><summary class="item"><span class="item-icono oro">' + I(ico) + '</span><span class="item-texto"><strong>' + t + '</strong></span>' + I('flecha') + '</summary><div class="acordeon-cuerpo"><p>' + txt + '</p></div></details>').join('') +
        '</div>'
    );
    html +=
      '<section class="seccion"><button class="boton borde" data-accion="salir">' + I('salir') + (ui.desdeDocente ? 'Volver al panel docente' : 'Cerrar sesión') + '</button>' +
      '<p class="ayuda" style="text-align:center;margin-top:14px">' + esc(cfg.nombreBanco) + ' · ¡Multiplica tus ideas! · Dinero didáctico, sin valor real</p></section>';
    return html;
  }

  // ==========================================================
  // Estudiante: operaciones paso a paso
  // ==========================================================

  function exigirSaldo(monto, disponible, texto) {
    if (monto > disponible) throw new B.ErrorBanco(texto || 'No tienes saldo suficiente. Disponible: ' + dinero(disponible) + '.');
  }

  function leerMonto(d) {
    const monto = B.aCentavos(d.monto);
    if (monto <= 0) throw new B.ErrorBanco('El monto debe ser mayor que cero.');
    return monto;
  }

  const COMERCIOS = [
    ['Supermercado escolar', 'bolsa'],
    ['Librería', 'libro'],
    ['Cafetería', 'cubiertos'],
    ['Tienda de tecnología', 'telefono'],
    ['Transporte', 'bus'],
  ];

  const ICONO_PRESTAMO = { personal: 'usuario', educativo: 'libro', emprendimiento: 'estrella' };
  const AYUDA_PRESTAMO = { personal: 'Para lo que necesites', educativo: 'Útiles, libros y cursos', emprendimiento: 'Para empezar tu negocio' };

  /** Monto escrito en un campo, en centavos, o 0 si todavía no es válido. */
  function montoSeguro(valor) {
    try {
      const c = B.aCentavos(valor);
      return c > 0 ? c : 0;
    } catch (e) {
      return 0;
    }
  }

  /** Muestra los cargos que tendrá una operación mientras se escribe el monto. */
  function vistaCargos(operacion, monto, destino) {
    const cargos = B.cargosDe(estado, operacion, monto || 10000);
    if (!cargos.length) return '';
    if (!monto) return '<div class="aviso-banner azul">' + I('porcentaje') + '<span>Esta operación tiene cargos: ' + esc(cargos.map((x) => x.concepto.replace(/ \(.*\)/, '')).join(' + ')) + '.</span></div>';
    return (
      '<div class="panel"><div class="panel-cuerpo resumen">' +
      cargos.map((x) => filaResumen(x.concepto, '<span class="negativo">' + esc(dinero(x.monto)) + '</span>')).join('') +
      filaResumen('Total ' + (destino ? 'que se carga ' + destino : 'a debitar'), esc(dinero(monto + B.sumaCargos(cargos))), 'total') +
      '</div></div>'
    );
  }

  function radiosSegmento(nombre, opciones, actual, etiqueta) {
    return (
      '<div class="campo"><span>' + esc(etiqueta) + '</span><div class="segmentos">' +
      opciones
        .map(([v, t]) => '<span><input type="radio" id="' + nombre + '-' + v + '" name="' + nombre + '" value="' + v + '"' + (String(v) === String(actual) ? ' checked' : '') + ' /><label for="' + nombre + '-' + v + '" style="display:block">' + esc(t) + '</label></span>')
        .join('') +
      '</div></div>'
    );
  }

  const OPS = {
    transferencia: {
      titulo: 'Transferir',
      pregunta: '¿A quién le envías dinero?',
      datos(c, d) {
        const otros = estado.clientes.filter((o) => o.numero !== c.numero).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
        if (!otros.length) return '<div class="vacio">' + I('usuarios') + '<p>Todavía no hay otras cuentas en el banco.</p></div>';
        return (
          segmentoTransferir('transferencia') +
          campo('Buscar', '<input data-filtro="destinos" placeholder="Nombre o número de cuenta" autocomplete="off" />', 'buscar') +
          '<div class="opciones" data-lista="destinos" style="max-height:260px;overflow-y:auto">' +
          otros
            .map((o) => opcion('destino', o.numero, d.destino === o.numero, '<span class="avatar chico azul">' + iniciales(o.nombre) + '</span><span class="item-texto"><strong>' + esc(o.nombre) + '</strong><small>Cuenta ' + esc(o.numero) + ' · ' + esc(estado.config.nombreBanco) + '</small></span>', o.nombre + ' ' + o.numero))
            .join('') +
          '</div>' +
          campoMontoGrande(d.monto, c.saldos.corriente) +
          '<div data-preview>' + this.preview(c, d) + '</div>' +
          campo('Concepto', '<input name="concepto" maxlength="60" placeholder="Ej.: pago de merienda" value="' + esc(d.concepto || '') + '" />', 'pagos')
        );
      },
      preview(c, d) {
        return vistaCargos('transferencia', montoSeguro(d.monto));
      },
      leer(c, d) {
        if (!d.destino) throw new B.ErrorBanco('Elige a quién le vas a transferir.');
        const monto = leerMonto(d);
        const cargos = B.sumaCargos(B.cargosDe(estado, 'transferencia', monto));
        exigirSaldo(monto + cargos, c.saldos.corriente, 'No te alcanza para enviar ' + dinero(monto) + ' y pagar ' + dinero(cargos) + ' de cargos. Disponible: ' + dinero(c.saldos.corriente) + '.');
        return { destino: d.destino, monto, concepto: (d.concepto || '').trim() };
      },
      resumen(c, d) {
        const para = B.buscarCliente(estado, d.destino);
        const cargos = B.cargosDe(estado, 'transferencia', d.monto);
        return [
          ['Desde', 'Cuenta Corriente ' + mascara(c.numero)],
          ['Para', esc(para.nombre) + '<br><small class="ayuda">Cuenta ' + esc(para.numero) + '</small>'],
          ['Concepto', esc(d.concepto || '—')],
          ['Monto a enviar', esc(dinero(d.monto))],
        ]
          .concat(cargos.map((x) => [esc(x.concepto), '<span class="negativo">' + esc(dinero(x.monto)) + '</span>']))
          .concat([['Total a debitar', esc(dinero(d.monto + B.sumaCargos(cargos))), 'total']]);
      },
      ejecutar(c, d) {
        const para = B.buscarCliente(estado, d.destino);
        const cargos = B.sumaCargos(B.cargosDe(estado, 'transferencia', d.monto));
        B.transferir(estado, c.numero, d.destino, d.monto, d.concepto);
        return { titulo: '¡Transferencia exitosa!', importe: d.monto, filas: [['Para', esc(para.nombre)], ['Cuenta destino', esc(para.numero)], ['Concepto', esc(d.concepto || '—')], ['Cargos cobrados', esc(dinero(cargos))]] };
      },
    },

    mover: {
      titulo: 'Entre mis cuentas',
      pregunta: '¿Hacia dónde mueves tu dinero?',
      datos(c, d) {
        const dir = d.direccion || (ui.op.inicial === 'sacar' ? 'a-corriente' : 'a-ahorro');
        return (
          segmentoTransferir('mover') +
          '<div class="opciones">' +
          opcion('direccion', 'a-ahorro', dir === 'a-ahorro', '<span class="item-icono turquesa">' + I('alcancia') + '</span><span class="item-texto"><strong>Guardar en mi ahorro</strong><small>Corriente → Ahorro · disponible ' + esc(dinero(c.saldos.corriente)) + '</small></span>') +
          opcion('direccion', 'a-corriente', dir === 'a-corriente', '<span class="item-icono">' + I('tarjeta') + '</span><span class="item-texto"><strong>Sacar de mi ahorro</strong><small>Ahorro → Corriente · disponible ' + esc(dinero(c.saldos.ahorro)) + '</small></span>') +
          '</div>' +
          campoMontoGrande(d.monto) +
          '<div class="aviso-banner azul">' + I('porcentaje') + '<span>Tu ahorro gana <strong>' + estado.config.tasaAhorroMensual + '% de interés compuesto</strong> cada mes.</span></div>'
        );
      },
      leer(c, d) {
        const monto = leerMonto(d);
        const aAhorro = d.direccion !== 'a-corriente';
        exigirSaldo(monto, aAhorro ? c.saldos.corriente : c.saldos.ahorro);
        return { direccion: aAhorro ? 'a-ahorro' : 'a-corriente', monto };
      },
      resumen(c, d) {
        const aAhorro = d.direccion === 'a-ahorro';
        return [
          ['Desde', aAhorro ? 'Cuenta Corriente' : 'Cuenta de Ahorro'],
          ['Hacia', aAhorro ? 'Cuenta de Ahorro' : 'Cuenta Corriente'],
          ['Monto', esc(dinero(d.monto)), 'total'],
        ];
      },
      ejecutar(c, d) {
        if (d.direccion === 'a-ahorro') B.guardarEnAhorro(estado, c.numero, d.monto);
        else B.sacarDeAhorro(estado, c.numero, d.monto);
        return {
          titulo: d.direccion === 'a-ahorro' ? '¡Dinero guardado!' : 'Dinero disponible',
          importe: d.monto,
          filas: [['Saldo corriente', esc(dinero(c.saldos.corriente))], ['Saldo de ahorro', esc(dinero(c.saldos.ahorro))]],
        };
      },
    },

    deposito: {
      titulo: 'Depositar',
      pregunta: '¿Cuánto vas a depositar?',
      sinClave: true,
      datos(c, d) {
        return (
          '<div class="aviso-banner azul">' + I('dinero') + '<span>Entrega tus billetes didácticos al cajero del aula y registra aquí la misma cantidad.</span></div>' +
          campoMontoGrande(d.monto)
        );
      },
      leer(c, d) {
        return { monto: leerMonto(d) };
      },
      resumen(c, d) {
        return [['Cuenta', 'Corriente ' + mascara(c.numero)], ['Forma', 'Efectivo (billetes didácticos)'], ['Monto', esc(dinero(d.monto)), 'total']];
      },
      ejecutar(c, d) {
        B.depositar(estado, c.numero, d.monto);
        return { titulo: '¡Depósito exitoso!', importe: d.monto, filas: [['Nuevo saldo', esc(dinero(c.saldos.corriente))]] };
      },
    },

    retiro: {
      titulo: 'Retirar',
      pregunta: '¿Cuánto vas a retirar?',
      datos(c, d) {
        return campoMontoGrande(d.monto, c.saldos.corriente) + '<div data-preview>' + this.preview(c, d) + '</div>';
      },
      preview(c, d) {
        return vistaCargos('retiro', montoSeguro(d.monto));
      },
      leer(c, d) {
        const monto = leerMonto(d);
        const cargos = B.sumaCargos(B.cargosDe(estado, 'retiro', monto));
        exigirSaldo(monto + cargos, c.saldos.corriente, 'No te alcanza para retirar ' + dinero(monto) + ' y pagar ' + dinero(cargos) + ' de cargos. Disponible: ' + dinero(c.saldos.corriente) + '.');
        return { monto };
      },
      resumen(c, d) {
        const cargos = B.cargosDe(estado, 'retiro', d.monto);
        const total = d.monto + B.sumaCargos(cargos);
        return [['Cuenta', 'Corriente ' + mascara(c.numero)], ['Monto a retirar', esc(dinero(d.monto))]]
          .concat(cargos.map((x) => [esc(x.concepto), '<span class="negativo">' + esc(dinero(x.monto)) + '</span>']))
          .concat([['Saldo después', esc(dinero(c.saldos.corriente - total))], ['Total a debitar', esc(dinero(total)), 'total']]);
      },
      ejecutar(c, d) {
        const cargos = B.sumaCargos(B.cargosDe(estado, 'retiro', d.monto));
        B.retirar(estado, c.numero, d.monto, null, true);
        return { titulo: '¡Retiro exitoso!', importe: d.monto, nota: 'Recibe tus billetes didácticos con el cajero del aula.', filas: [['Cargos cobrados', esc(dinero(cargos))], ['Nuevo saldo', esc(dinero(c.saldos.corriente))]] };
      },
    },

    servicio: {
      titulo: 'Pagar servicio',
      pregunta: '¿Qué servicio vas a pagar?',
      datos(c, d) {
        const elegido = d.servicio || ui.op.inicial || SERVICIOS[0][0];
        return (
          '<div class="opciones">' +
          SERVICIOS.map(([s, ico]) => opcion('servicio', s, elegido === s, '<span class="item-icono oro">' + I(ico) + '</span><span class="item-texto"><strong>' + esc(s) + '</strong></span>')).join('') +
          '</div>' +
          campo('Número de contrato', '<input name="contrato" inputmode="numeric" maxlength="12" placeholder="Ej.: 100245" value="' + esc(d.contrato || '') + '" />', 'pagos') +
          campoMontoGrande(d.monto, c.saldos.corriente)
        );
      },
      leer(c, d) {
        if (!d.servicio) throw new B.ErrorBanco('Elige el servicio que vas a pagar.');
        const monto = leerMonto(d);
        exigirSaldo(monto, c.saldos.corriente);
        return { servicio: d.servicio, contrato: (d.contrato || '').trim(), monto };
      },
      resumen(c, d) {
        return [['Servicio', esc(d.servicio)], ['Contrato', esc(d.contrato || '—')], ['Desde', 'Cuenta Corriente ' + mascara(c.numero)], ['Total a pagar', esc(dinero(d.monto)), 'total']];
      },
      ejecutar(c, d) {
        B.pagarServicio(estado, c.numero, d.monto, d.servicio, d.contrato);
        return { titulo: '¡Pago exitoso!', importe: d.monto, filas: [['Servicio', esc(d.servicio)], ['Contrato', esc(d.contrato || '—')]] };
      },
    },

    cuota: {
      titulo: 'Pagar préstamo',
      pregunta: 'Pago de cuota',
      datos(c) {
        const p = B.prestamosActivos(c)[0];
        if (!p) return '<div class="vacio">' + I('check') + '<p>No tienes préstamos por pagar.</p></div>';
        const r = B.resumenPrestamo(p);
        const fila = p.tabla[p.cuotasPagadas];
        return (
          '<input type="hidden" name="prestamo" value="' + esc(p.id) + '" />' +
          '<div class="panel"><div class="panel-cuerpo resumen">' +
          filaResumen('Cuota', (p.cuotasPagadas + 1) + ' de ' + p.plazo) +
          filaResumen('Abono a capital', esc(dinero(fila.capital))) +
          filaResumen('Interés', esc(dinero(fila.interes))) +
          filaResumen('Estado', r.cuotasAtrasadas ? '<span class="etiqueta rojo">' + r.cuotasAtrasadas + ' atrasada(s)</span>' : '<span class="etiqueta verde">Al día</span>') +
          (r.mora ? filaResumen('Cargo por mora', '<span class="negativo">' + esc(dinero(r.mora)) + '</span>') : '') +
          filaResumen('Total a pagar', esc(dinero(r.proximoPago)), 'total') +
          '</div></div><p class="disponible">Disponible en tu cuenta corriente: <strong>' + esc(dinero(c.saldos.corriente)) + '</strong></p>'
        );
      },
      leer(c, d) {
        const p = c.prestamos.find((x) => x.id === d.prestamo);
        if (!p) throw new B.ErrorBanco('No tienes préstamos por pagar.');
        exigirSaldo(B.resumenPrestamo(p).proximoPago, c.saldos.corriente);
        return { prestamo: p.id, monto: B.resumenPrestamo(p).proximoPago };
      },
      resumen(c, d) {
        const p = c.prestamos.find((x) => x.id === d.prestamo);
        return [['Préstamo', esc(nombreTipo(p.tipo)) + ' · ' + esc(dinero(p.monto))], ['Cuota', (p.cuotasPagadas + 1) + ' de ' + p.plazo], ['Desde', 'Cuenta Corriente ' + mascara(c.numero)], ['Total a pagar', esc(dinero(d.monto)), 'total']];
      },
      ejecutar(c, d) {
        const p = c.prestamos.find((x) => x.id === d.prestamo);
        B.pagarCuota(estado, c.numero, d.prestamo);
        const r = B.resumenPrestamo(p);
        return {
          titulo: r.terminado ? '¡Préstamo pagado por completo!' : '¡Cuota pagada!',
          importe: d.monto,
          filas: [['Cuotas pagadas', p.cuotasPagadas + ' de ' + p.plazo], ['Saldo pendiente', esc(dinero(r.saldoPendiente))]],
        };
      },
    },

    solicitud: {
      titulo: 'Solicitar préstamo',
      pregunta: '¿Qué préstamo necesitas?',
      datos(c, d) {
        const cfg = estado.config;
        const r = resumenCliente(c);
        if (r.activos.length) return '<div class="vacio">' + I('info') + '<p>Primero debes terminar de pagar tu préstamo actual.</p></div>';
        if (r.solicitud) return '<div class="vacio">' + I('reloj') + '<p>Ya tienes una solicitud esperando respuesta de tu docente.</p></div>';
        const v = this.valores(d);
        return (
          '<div class="opciones">' +
          Object.keys(B.TIPOS_PRESTAMO)
            .map((t) => opcion('tipo', t, v.tipo === t, '<span class="item-icono morado">' + I(ICONO_PRESTAMO[t]) + '</span><span class="item-texto"><strong>' + esc(B.TIPOS_PRESTAMO[t].nombre) + '</strong><small>' + esc(AYUDA_PRESTAMO[t]) + '</small></span><span class="item-monto">' + B.tasaDeTipo(estado, t) + '%<small>mensual</small></span>'))
            .join('') +
          '</div>' +
          campoMontoGrande(d.monto) +
          '<p class="disponible">Máximo: <strong>' + esc(dinero(cfg.montoMaximoPrestamo)) + '</strong> · Comisión de apertura ' + cfg.comisionApertura + '%</p>' +
          radiosSegmento('plazo', cfg.plazosPrestamo.map((p) => [p, p + ' meses']), v.plazo, 'Plazo') +
          radiosSegmento('sistema', [['frances', 'Francés: cuota fija'], ['aleman', 'Alemán: cuota baja']], v.sistema, 'Sistema de amortización') +
          '<div data-preview>' + this.preview(c, d) + '</div>' +
          campo('¿Para qué lo necesitas?', '<input name="motivo" maxlength="80" placeholder="Ej.: materiales para mi proyecto" value="' + esc(d.motivo || '') + '" />', 'info')
        );
      },
      valores(d) {
        const cfg = estado.config;
        return {
          tipo: B.TIPOS_PRESTAMO[d.tipo] ? d.tipo : 'personal',
          plazo: Number(d.plazo) || cfg.plazosPrestamo[Math.min(1, cfg.plazosPrestamo.length - 1)],
          sistema: d.sistema === 'aleman' ? 'aleman' : 'frances',
        };
      },
      preview(c, d) {
        const v = this.valores(d);
        return vistaPreviaPrestamo(montoSeguro(d.monto), v.plazo, B.tasaDeTipo(estado, v.tipo), v.sistema);
      },
      leer(c, d) {
        const r = resumenCliente(c);
        if (r.activos.length) throw new B.ErrorBanco('Primero debes terminar de pagar tu préstamo actual.');
        if (r.solicitud) throw new B.ErrorBanco('Ya tienes una solicitud esperando respuesta.');
        const monto = leerMonto(d);
        if (monto > estado.config.montoMaximoPrestamo) throw new B.ErrorBanco('El monto máximo es ' + dinero(estado.config.montoMaximoPrestamo) + '.');
        return Object.assign(this.valores(d), { monto, motivo: (d.motivo || '').trim() });
      },
      resumen(c, d) {
        const tasa = B.tasaDeTipo(estado, d.tipo);
        const tabla = B.tablaAmortizacion(d.monto, tasa, d.plazo, d.sistema);
        const total = tabla.reduce((s, f) => s + f.cuota, 0);
        const apertura = B.sumaCargos(B.cargosDe(estado, 'apertura-prestamo', d.monto));
        return [
          ['Tipo', 'Préstamo ' + esc(nombreTipo(d.tipo).toLowerCase())],
          ['Monto solicitado', esc(dinero(d.monto))],
          ['Plazo y tasa', d.plazo + ' meses al ' + tasa + '% mensual'],
          ['Sistema', esc(B.SISTEMAS[d.sistema])],
          ['Comisión de apertura', '<span class="negativo">' + esc(dinero(apertura)) + '</span>'],
          ['Recibirás en tu cuenta', esc(dinero(d.monto - apertura))],
          ['Total de intereses', '<span class="negativo">' + esc(dinero(total - d.monto)) + '</span>'],
          ['Total a pagar', esc(dinero(total))],
          [d.sistema === 'aleman' ? 'Primera cuota' : 'Cuota mensual', esc(dinero(tabla[0].cuota)), 'total'],
        ];
      },
      ejecutar(c, d) {
        B.solicitarPrestamo(estado, c.numero, d.monto, d.plazo, d.motivo, d.tipo, d.sistema);
        return {
          titulo: '¡Solicitud enviada!',
          azul: true,
          importe: d.monto,
          nota: 'Tu docente revisará la solicitud. Cuando la apruebe, el dinero llegará a tu cuenta corriente (menos la comisión de apertura).',
          filas: [['Tipo', esc(nombreTipo(d.tipo))], ['Plazo', d.plazo + ' meses'], ['Sistema', esc(B.SISTEMAS[d.sistema])], ['Motivo', esc(d.motivo || '—')]],
          sinReferencia: true,
          volverA: 'prestamos',
        };
      },
    },

    'activar-tarjeta': {
      titulo: 'Solicitar tarjeta',
      pregunta: 'Revisa las condiciones de tu tarjeta',
      datos(c) {
        const cfg = estado.config;
        if (c.tarjeta) return '<div class="vacio">' + I('check') + '<p>Ya tienes una tarjeta de crédito activa.</p></div>';
        return (
          tarjetaVisual(c) +
          '<div class="panel" style="margin-top:16px"><div class="panel-cuerpo resumen">' +
          filaResumen('Límite de crédito', esc(dinero(cfg.limiteTarjeta))) +
          filaResumen('Tasa de interés', cfg.tasaTarjetaMensual + '% mensual') +
          filaResumen('Pago mínimo', cfg.pagoMinimoPorcentaje + '% del saldo (mínimo ' + esc(dinero(cfg.pagoMinimoFijo)) + ')') +
          filaResumen('Cargo por mora', esc(dinero(cfg.cargoMoraTarjeta))) +
          filaResumen('Cuota de emisión', esc(dinero(cfg.cuotaEmisionTarjeta))) +
          '</div></div>' +
          '<label class="casilla"><input type="checkbox" name="acepto" value="si" /> <span>Entiendo que la tarjeta es un préstamo: lo que compro lo debo pagar.</span></label>'
        );
      },
      leer(c, d) {
        if (c.tarjeta) throw new B.ErrorBanco('Ya tienes una tarjeta de crédito activa.');
        if (d.acepto !== 'si') throw new B.ErrorBanco('Marca la casilla para aceptar las condiciones.');
        return {};
      },
      resumen() {
        const cfg = estado.config;
        return [['Producto', 'Tarjeta de crédito ' + esc(cfg.nombreBanco)], ['Límite', esc(dinero(cfg.limiteTarjeta))], ['Tasa', cfg.tasaTarjetaMensual + '% mensual'], ['Cuota de emisión (se carga a la tarjeta)', esc(dinero(cfg.cuotaEmisionTarjeta)), 'total']];
      },
      ejecutar(c) {
        const t = B.activarTarjeta(estado, c.numero);
        return { titulo: '¡Tu tarjeta está activa!', azul: true, filas: [['Número', esc(t.numero)], ['Límite', esc(dinero(t.limite))], ['Disponible', esc(dinero(B.resumenTarjeta(c).disponible))]], nota: 'Tu primer estado de cuenta llegará cuando tu docente cierre el mes.', volverA: 'producto' };
      },
    },

    compra: {
      titulo: 'Comprar con tarjeta',
      pregunta: '¿Dónde vas a comprar?',
      datos(c, d) {
        const r = B.resumenTarjeta(c);
        if (!r) return '<div class="vacio">' + I('tarjeta') + '<p>Primero solicita tu tarjeta de crédito.</p></div>';
        const elegido = d.comercio || COMERCIOS[0][0];
        return (
          '<div class="opciones">' + COMERCIOS.map(([n, ico]) => opcion('comercio', n, elegido === n, '<span class="item-icono oro">' + I(ico) + '</span><span class="item-texto"><strong>' + esc(n) + '</strong></span>')).join('') + '</div>' +
          campoMontoGrande(d.monto, r.disponible) +
          '<div class="aviso-banner azul">' + I('info') + '<span>Lo que compras con la tarjeta lo pagas después. Si pagas el total al corte, no pagas intereses.</span></div>'
        );
      },
      leer(c, d) {
        const r = B.resumenTarjeta(c);
        if (!r) throw new B.ErrorBanco('Primero solicita tu tarjeta de crédito.');
        const monto = leerMonto(d);
        exigirSaldo(monto, r.disponible, 'La compra supera tu crédito disponible (' + dinero(r.disponible) + ').');
        return { comercio: d.comercio || COMERCIOS[0][0], monto };
      },
      resumen(c, d) {
        const r = B.resumenTarjeta(c);
        return [['Comercio', esc(d.comercio)], ['Tarjeta', '•••• ' + esc(c.tarjeta.numero.slice(-4))], ['Disponible después', esc(dinero(r.disponible - d.monto))], ['Total de la compra', esc(dinero(d.monto)), 'total']];
      },
      ejecutar(c, d) {
        B.comprarConTarjeta(estado, c.numero, d.monto, d.comercio);
        const r = B.resumenTarjeta(c);
        return { titulo: '¡Compra aprobada!', importe: d.monto, filas: [['Comercio', esc(d.comercio)], ['Deuda de la tarjeta', esc(dinero(r.deuda))], ['Disponible', esc(dinero(r.disponible))]], volverA: 'producto' };
      },
    },

    avance: {
      titulo: 'Avance de efectivo',
      pregunta: '¿Cuánto efectivo necesitas?',
      datos(c, d) {
        const r = B.resumenTarjeta(c);
        if (!r) return '<div class="vacio">' + I('tarjeta') + '<p>Primero solicita tu tarjeta de crédito.</p></div>';
        return (
          campoMontoGrande(d.monto, r.disponible) +
          '<div data-preview>' + this.preview(c, d) + '</div>' +
          '<div class="aviso-banner">' + I('alerta') + '<span>El avance es el uso más caro de la tarjeta: pagas una comisión de ' + estado.config.comisionAvance + '% en el momento, además de los intereses.</span></div>'
        );
      },
      preview(c, d) {
        return vistaCargos('avance', montoSeguro(d.monto), 'a la tarjeta');
      },
      leer(c, d) {
        const r = B.resumenTarjeta(c);
        if (!r) throw new B.ErrorBanco('Primero solicita tu tarjeta de crédito.');
        const monto = leerMonto(d);
        const cargos = B.sumaCargos(B.cargosDe(estado, 'avance', monto));
        exigirSaldo(monto + cargos, r.disponible, 'El avance y su comisión superan tu crédito disponible (' + dinero(r.disponible) + ').');
        return { monto };
      },
      resumen(c, d) {
        const cargos = B.cargosDe(estado, 'avance', d.monto);
        return [['Recibes en tu cuenta corriente', esc(dinero(d.monto))]]
          .concat(cargos.map((x) => [esc(x.concepto), '<span class="negativo">' + esc(dinero(x.monto)) + '</span>']))
          .concat([['Se suma a tu deuda', esc(dinero(d.monto + B.sumaCargos(cargos))), 'total']]);
      },
      ejecutar(c, d) {
        B.avanceEfectivo(estado, c.numero, d.monto);
        const r = B.resumenTarjeta(c);
        return { titulo: '¡Avance listo!', importe: d.monto, filas: [['Nuevo saldo corriente', esc(dinero(c.saldos.corriente))], ['Deuda de la tarjeta', esc(dinero(r.deuda))]], volverA: 'producto' };
      },
    },

    'pago-tarjeta': {
      titulo: 'Pagar tarjeta',
      pregunta: '¿Cuánto vas a pagar?',
      datos(c, d) {
        const r = B.resumenTarjeta(c);
        if (!r) return '<div class="vacio">' + I('tarjeta') + '<p>Primero solicita tu tarjeta de crédito.</p></div>';
        if (!r.deuda) return '<div class="vacio">' + I('check') + '<p>Tu tarjeta no tiene deuda. ¡Muy bien!</p></div>';
        const opciones = [
          ['minimo', 'Pago mínimo', r.minimoPendiente, 'Evitas la mora, pero pagas intereses sobre el resto'],
          ['corte', 'Saldo al corte', r.cortePendiente, 'No pagas intereses este mes'],
          ['total', 'Deuda total', r.deuda, 'Dejas la tarjeta en cero'],
        ].filter((o) => o[2] > 0);
        const elegido = d.opcion || (opciones[0] ? opciones[0][0] : 'otro');
        return (
          '<div class="opciones">' +
          opciones.map(([v, t, m, ayuda]) => opcion('opcion', v, elegido === v, '<span class="item-texto"><strong>' + t + '</strong><small>' + ayuda + '</small></span><span class="item-monto">' + esc(dinero(m)) + '</span>')).join('') +
          opcion('opcion', 'otro', elegido === 'otro', '<span class="item-texto"><strong>Otro monto</strong><small>Escríbelo abajo</small></span>') +
          '</div>' +
          campoMontoGrande(d.monto, c.saldos.corriente).replace(' required', '')
        );
      },
      leer(c, d) {
        const r = B.resumenTarjeta(c);
        if (!r || !r.deuda) throw new B.ErrorBanco('Tu tarjeta no tiene deuda.');
        const fijo = { minimo: r.minimoPendiente, corte: r.cortePendiente, total: r.deuda }[d.opcion];
        const monto = d.opcion && d.opcion !== 'otro' && fijo > 0 ? fijo : leerMonto(d);
        if (monto > r.deuda) throw new B.ErrorBanco('Estás pagando más de lo que debes (' + dinero(r.deuda) + ').');
        exigirSaldo(monto, c.saldos.corriente);
        return { opcion: d.opcion, monto };
      },
      resumen(c, d) {
        const r = B.resumenTarjeta(c);
        return [['Desde', 'Cuenta Corriente ' + mascara(c.numero)], ['Tarjeta', '•••• ' + esc(c.tarjeta.numero.slice(-4))], ['Deuda después del pago', esc(dinero(r.deuda - d.monto))], ['Total a pagar', esc(dinero(d.monto)), 'total']];
      },
      ejecutar(c, d) {
        B.pagarTarjeta(estado, c.numero, d.monto);
        const r = B.resumenTarjeta(c);
        return {
          titulo: '¡Pago recibido!',
          importe: d.monto,
          filas: [['Deuda de la tarjeta', esc(dinero(r.deuda))], ['Disponible', esc(dinero(r.disponible))]],
          nota: r.minimoPendiente > 0 ? 'Todavía te falta ' + dinero(r.minimoPendiente) + ' para cubrir el pago mínimo.' : r.saldoCorte > 0 && r.cortePendiente === 0 ? 'Pagaste todo el saldo al corte: este mes no pagarás intereses.' : null,
          volverA: 'producto',
        };
      },
    },

    certificado: {
      titulo: 'Abrir certificado',
      pregunta: '¿Cuánto quieres invertir?',
      datos(c, d) {
        const cfg = estado.config;
        const plazo = Number(d.plazo) || cfg.plazosCertificado[Math.min(1, cfg.plazosCertificado.length - 1)];
        const tipo = d.tipo || 'compuesto';
        return (
          campoMontoGrande(d.monto, c.saldos.corriente) +
          '<p class="disponible">Mínimo: <strong>' + esc(dinero(cfg.montoMinimoCertificado)) + '</strong> · Tasa ' + cfg.tasaCertificadoMensual + '% mensual</p>' +
          radiosSegmento('plazo', cfg.plazosCertificado.map((p) => [p, p + ' meses']), plazo, 'Plazo') +
          radiosSegmento('tipo', [['simple', 'Interés simple'], ['compuesto', 'Interés compuesto']], tipo, 'Tipo de interés') +
          '<div data-preview>' + this.preview(c, d) + '</div>'
        );
      },
      preview(c, d) {
        const cfg = estado.config;
        const monto = montoSeguro(d.monto);
        const plazo = Number(d.plazo) || cfg.plazosCertificado[Math.min(1, cfg.plazosCertificado.length - 1)];
        if (!(monto > 0)) return '<div class="aviso-banner azul">' + I('calculadora') + '<span>Escribe un monto para ver cuánto ganarás.</span></div>';
        const s = B.proyeccionCertificado(monto, cfg.tasaCertificadoMensual, plazo, 'simple');
        const k = B.proyeccionCertificado(monto, cfg.tasaCertificadoMensual, plazo, 'compuesto');
        return (
          '<div class="panel"><div class="tabla-envoltura"><table><thead><tr><th></th><th class="num">Simple</th><th class="num">Compuesto</th></tr></thead><tbody>' +
          '<tr><td>Intereses</td><td class="num positivo">' + esc(dinero(s.interes)) + '</td><td class="num positivo">' + esc(dinero(k.interes)) + '</td></tr>' +
          '<tr><td><strong>Recibirás</strong></td><td class="num"><strong>' + esc(dinero(s.final)) + '</strong></td><td class="num"><strong>' + esc(dinero(k.final)) + '</strong></td></tr>' +
          '</tbody></table></div></div>'
        );
      },
      leer(c, d) {
        const cfg = estado.config;
        const monto = leerMonto(d);
        if (monto < cfg.montoMinimoCertificado) throw new B.ErrorBanco('El monto mínimo es ' + dinero(cfg.montoMinimoCertificado) + '.');
        exigirSaldo(monto, c.saldos.corriente);
        return { monto, plazo: Number(d.plazo), tipo: d.tipo === 'simple' ? 'simple' : 'compuesto' };
      },
      resumen(c, d) {
        const cfg = estado.config;
        const p = B.proyeccionCertificado(d.monto, cfg.tasaCertificadoMensual, d.plazo, d.tipo);
        return [
          ['Desde', 'Cuenta Corriente ' + mascara(c.numero)],
          ['Plazo', d.plazo + ' meses'],
          ['Tasa', cfg.tasaCertificadoMensual + '% mensual · interés ' + d.tipo],
          ['Intereses al vencer', '<span class="positivo">' + esc(dinero(p.interes)) + '</span>'],
          ['Recibirás al vencer', esc(dinero(p.final))],
          ['Monto a invertir', esc(dinero(d.monto)), 'total'],
        ];
      },
      ejecutar(c, d) {
        const cert = B.abrirCertificado(estado, c.numero, d.monto, d.plazo, d.tipo);
        return {
          titulo: '¡Certificado abierto!',
          importe: d.monto,
          filas: [['Plazo', d.plazo + ' meses'], ['Vence al cerrar el mes', String(cert.mesInicio + cert.plazo - 1)], ['Recibirás', esc(dinero(B.proyeccionCertificado(d.monto, cert.tasa, d.plazo, d.tipo).final))]],
          nota: 'Si lo cancelas antes de tiempo pierdes los intereses y pagas una penalidad de ' + estado.config.penalidadCertificado + '%.',
          volverA: 'certificados',
        };
      },
    },

    divisas: {
      titulo: 'Cambio de dólares',
      pregunta: '¿Cuántos dólares?',
      datos(c, d) {
        const op = d.operacion || ui.op.inicial || 'comprar';
        return (
          '<div class="segmentos">' +
          '<span><input type="radio" id="div-comprar" name="operacion" value="comprar"' + (op === 'comprar' ? ' checked' : '') + ' /><label for="div-comprar" style="display:block">Comprar US$</label></span>' +
          '<span><input type="radio" id="div-vender" name="operacion" value="vender"' + (op === 'vender' ? ' checked' : '') + ' /><label for="div-vender" style="display:block">Vender US$</label></span></div>' +
          campoMontoGrande(d.monto, null, B.SIMBOLO_USD) +
          '<p class="disponible">Tienes <strong>' + esc(usd(c.saldos.dolares)) + '</strong> y <strong>' + esc(dinero(c.saldos.corriente)) + '</strong> en corriente</p>' +
          '<div data-preview>' + this.preview(c, d) + '</div>'
        );
      },
      preview(c, d) {
        const op = d.operacion || ui.op.inicial || 'comprar';
        const cant = montoSeguro(d.monto);
        if (!(cant > 0)) return '<div class="aviso-banner azul">' + I('globo') + '<span>Compra: ' + esc(dinero(Math.round(estado.config.tasaVentaUSD * 100))) + ' por dólar · Venta: ' + esc(dinero(Math.round(estado.config.tasaCompraUSD * 100))) + ' por dólar.</span></div>';
        const q = B.cotizarDivisa(estado, op, cant);
        return '<div class="panel"><div class="panel-cuerpo resumen">' + filaResumen('Tasa', esc(dinero(Math.round(q.tasa * 100))) + ' por dólar') + filaResumen(op === 'comprar' ? 'Pagarás' : 'Recibirás', esc(dinero(q.pesos)), 'total') + '</div></div>';
      },
      leer(c, d) {
        const op = d.operacion === 'vender' ? 'vender' : 'comprar';
        const cant = leerMonto(d);
        const q = B.cotizarDivisa(estado, op, cant);
        if (op === 'comprar') exigirSaldo(q.pesos, c.saldos.corriente, 'Necesitas ' + dinero(q.pesos) + ' en tu cuenta corriente.');
        else exigirSaldo(cant, c.saldos.dolares, 'No tienes suficientes dólares. Tienes ' + usd(c.saldos.dolares) + '.');
        return { operacion: op, monto: cant };
      },
      resumen(c, d) {
        const q = B.cotizarDivisa(estado, d.operacion, d.monto);
        const compra = d.operacion === 'comprar';
        return [
          ['Operación', compra ? 'Compra de dólares' : 'Venta de dólares'],
          ['Dólares', esc(usd(d.monto))],
          ['Tasa', esc(dinero(Math.round(q.tasa * 100))) + ' por dólar'],
          [compra ? 'Se debita de tu corriente' : 'Se acredita a tu corriente', esc(dinero(q.pesos)), 'total'],
        ];
      },
      ejecutar(c, d) {
        const q = d.operacion === 'comprar' ? B.comprarDolares(estado, c.numero, d.monto) : B.venderDolares(estado, c.numero, d.monto);
        return {
          titulo: d.operacion === 'comprar' ? '¡Compraste dólares!' : '¡Vendiste dólares!',
          importe: q.pesos,
          filas: [['Dólares', esc(usd(d.monto))], ['Tasa', esc(dinero(Math.round(q.tasa * 100)))], ['Saldo en dólares', esc(usd(c.saldos.dolares))], ['Saldo corriente', esc(dinero(c.saldos.corriente))]],
        };
      },
    },

    clave: {
      titulo: 'Cambiar clave',
      pregunta: 'Crea una clave nueva',
      sinClave: true,
      datos() {
        const pin = '<input class="pin" type="password" inputmode="numeric" maxlength="4" autocomplete="off" required placeholder="••••" ';
        return (
          campo('Clave actual', pin + 'name="actual" />', 'llave') +
          campo('Clave nueva', pin + 'name="nueva" />', 'llave') +
          campo('Repite la clave nueva', pin + 'name="repetir" />', 'llave') +
          '<div class="aviso-banner azul">' + I('escudo') + '<span>Usa 4 números que puedas recordar, pero que otros no adivinen. Evita 1234 o tu fecha de cumpleaños.</span></div>'
        );
      },
      leer(c, d) {
        if (c.pin !== String(d.actual).trim()) throw new B.ErrorBanco('La clave actual no es correcta.');
        if (d.nueva !== d.repetir) throw new B.ErrorBanco('Las claves nuevas no coinciden.');
        return { nueva: d.nueva };
      },
      directo: true,
      ejecutar(c, d) {
        B.cambiarPin(estado, c.numero, d.nueva);
        return { titulo: 'Clave actualizada', azul: true, filas: [], sinReferencia: true, nota: 'Usa tu clave nueva la próxima vez que inicies sesión.' };
      },
    },
  };

  function segmentoTransferir(actual) {
    return (
      '<div class="segmentos">' +
      '<button type="button" data-accion="cambiar-op" data-valor="transferencia" aria-pressed="' + (actual === 'transferencia') + '">A otra persona</button>' +
      '<button type="button" data-accion="cambiar-op" data-valor="mover" aria-pressed="' + (actual === 'mover') + '">Entre mis cuentas</button></div>'
    );
  }

  function vistaPreviaPrestamo(monto, plazo, tasa, sistema) {
    if (!(monto > 0) || !plazo) return '<div class="aviso-banner azul">' + I('calculadora') + '<span>Escribe un monto para ver tu cuota mensual.</span></div>';
    const tabla = B.tablaAmortizacion(monto, tasa, plazo, sistema);
    const total = tabla.reduce((s, f) => s + f.cuota, 0);
    return (
      '<div class="panel"><div class="datos">' +
      '<div><small>' + (sistema === 'aleman' ? 'Primera cuota' : 'Cuota mensual') + '</small><strong>' + esc(dinero(tabla[0].cuota)) + '</strong></div>' +
      '<div><small>' + (sistema === 'aleman' ? 'Última cuota' : 'Total a pagar') + '</small><strong>' + esc(dinero(sistema === 'aleman' ? tabla[tabla.length - 1].cuota : total)) + '</strong></div>' +
      '<div><small>Intereses</small><strong class="negativo">' + esc(dinero(total - monto)) + '</strong></div>' +
      '<div><small>Comisión de apertura</small><strong class="negativo">' + esc(dinero(B.sumaCargos(B.cargosDe(estado, 'apertura-prestamo', monto)))) + '</strong></div></div>' +
      '<details class="acordeon"><summary class="enlace" style="padding:12px 16px">Ver tabla de amortización</summary>' + tablaAmortizacion(tabla) + '</details></div>'
    );
  }

  function pantallaOperacion(c) {
    const op = ui.op;
    const spec = OPS[op.tipo];
    const pasos = spec.directo ? 2 : 3;
    const indice = op.paso === 'datos' ? 1 : op.paso === 'confirmar' ? 2 : pasos;
    let html = op.paso === 'recibo' ? barraSuperior('Comprobante', 'terminar-op', 'cerrar', true) : barraSuperior(spec.titulo, 'atras-op');
    if (op.paso !== 'recibo') {
      html += '<div class="pasos">' + Array.from({ length: pasos }, (_, i) => '<span class="' + (i < indice ? 'hecho' : '') + '"></span>').join('') + '</div>';
    }

    if (op.paso === 'datos') {
      html +=
        '<div class="paso-titulo"><h2>' + esc(spec.pregunta) + '</h2></div>' +
        '<form class="formulario seccion" data-form="op-datos" novalidate>' + spec.datos(c, op.datos || {}) +
        '<button class="boton" style="margin-top:8px">' + (spec.directo ? 'Guardar' : 'Continuar') + '</button></form>';
    } else if (op.paso === 'confirmar') {
      html +=
        '<div class="paso-titulo"><h2>Confirma la operación</h2><p>Revisa que todo esté correcto antes de continuar.</p></div>' +
        '<section class="seccion"><div class="panel"><div class="panel-cuerpo resumen">' +
        spec.resumen(c, op.datos).map(([e, v, cl]) => filaResumen(e, v, cl)).join('') + '</div></div></section>' +
        '<form class="formulario seccion" data-form="op-confirmar">' +
        (spec.sinClave ? '' : campo('Escribe tu clave para autorizar', '<input class="pin" name="pin" type="password" inputmode="numeric" maxlength="4" autocomplete="off" required placeholder="••••" />', 'llave')) +
        '<button class="boton oro">' + I('check') + 'Confirmar</button>' +
        '<button type="button" class="boton borde" data-accion="atras-op">Modificar</button></form>';
    } else {
      const r = op.recibo;
      html +=
        '<div class="comprobante"><div class="comprobante-cabeza' + (r.azul ? ' azul' : '') + '"><div class="sello' + (r.azul ? ' azul' : '') + '">' + I('check') + '</div>' +
        '<h2>' + esc(r.titulo) + '</h2>' + (r.importe != null ? '<div class="importe">' + esc(dinero(r.importe)) + '</div>' : '') + '</div>' +
        '<div class="comprobante-cuerpo resumen">' +
        (r.sinReferencia ? '' : filaResumen('Referencia', esc(r.referencia))) +
        filaResumen('Fecha', esc(fechaLarga(r.fecha))) +
        filaResumen('Mes del banco', String(r.mes)) +
        filaResumen('Cliente', esc(c.nombre) + ' · ' + esc(c.numero)) +
        r.filas.map(([e, v]) => filaResumen(e, v)).join('') +
        '</div>' + (r.nota ? '<div style="padding:0 20px 20px"><div class="aviso-banner azul">' + I('info') + '<span>' + esc(r.nota) + '</span></div></div>' : '') +
        '</div>' +
        '<div class="seccion botones no-imprimir">' +
        (r.sinReferencia ? '' : '<button class="boton borde" data-accion="imprimir">' + I('imprimir') + 'Imprimir comprobante</button>') +
        '<button class="boton" data-accion="terminar-op">' + (r.volverA ? 'Listo' : 'Volver al inicio') + '</button></div>';
    }
    return html;
  }

  function abrirOperacion(tipo, inicial) {
    if (tipo === 'mover-sacar') {
      tipo = 'mover';
      inicial = 'sacar';
    }
    if (tipo === 'divisas-vender') {
      tipo = 'divisas';
      inicial = 'vender';
    }
    ui.op = { tipo, paso: 'datos', datos: {}, inicial, volver: ui.pantalla };
    pintar(true);
  }

  // ==========================================================
  // Panel docente
  // ==========================================================

  function vistaDocente() {
    const pendientes = estado.solicitudes.length;
    const secciones = [
      ['resumen', 'grafica', 'Resumen'],
      ['clientes', 'usuarios', 'Clientes'],
      ['solicitudes', 'prestamo', 'Solicitudes'],
      ['mes', 'calendario', 'Cierre de mes'],
      ['ajustes', 'ajustes', 'Ajustes'],
    ];
    const contenido = ({ resumen: dResumen, clientes: dClientes, solicitudes: dSolicitudes, mes: dMes, ajustes: dAjustes }[ui.seccion] || dResumen)();
    return (
      '<div class="docente"><nav class="lateral" aria-label="Panel docente">' +
      '<div class="marca"><span class="marca-logo">C4</span><div>' + esc(estado.config.nombreBanco) + '<small>Banca administrativa</small></div></div>' +
      secciones
        .map(
          ([id, ico, t]) =>
            '<button class="lateral-enlace" data-accion="seccion" data-valor="' + id + '"' + (ui.seccion === id ? ' aria-current="page"' : '') + '>' + I(ico) + '<span class="texto">' + t + '</span>' +
            (id === 'solicitudes' && pendientes ? '<span class="contador">' + pendientes + '</span>' : '') + '</button>'
        )
        .join('') +
      '<button class="lateral-enlace" data-accion="salir">' + I('salir') + '<span class="texto">Salir</span></button>' +
      '</nav><main class="escritorio">' + contenido + '</main></div>'
    );
  }

  function cabezaEscritorio(titulo, subtitulo, acciones) {
    return '<div class="escritorio-cabeza"><div><h1>' + esc(titulo) + '</h1><p>' + subtitulo + '</p></div>' + (acciones ? '<div class="acciones-fila">' + acciones + '</div>' : '') + '</div>';
  }

  function kpi(icono, color, etiqueta, valor) {
    return '<div class="kpi"><span class="item-icono ' + color + '">' + I(icono) + '</span><div><small>' + esc(etiqueta) + '</small><strong>' + valor + '</strong></div></div>';
  }

  function dResumen() {
    const t = B.totales(estado);
    const ing = B.ingresosBanco(estado);
    let html = cabezaEscritorio('Resumen del banco', 'Mes ' + estado.mes + ' · ' + t.clientes + ' cliente(s)', '<button class="boton chico" data-accion="seccion" data-valor="mes">' + I('calendario') + 'Cerrar el mes ' + estado.mes + '</button>');
    html +=
      '<div class="kpis">' +
      kpi('usuarios', '', 'Clientes', String(t.clientes)) +
      kpi('tarjeta', 'verde', 'En cuentas corrientes', esc(dinero(t.corriente))) +
      kpi('alcancia', 'turquesa', 'Ahorrado', esc(dinero(t.ahorro))) +
      kpi('prestamo', 'morado', 'Préstamos por cobrar', esc(dinero(t.deuda))) +
      kpi('tarjeta', '', 'Tarjetas por cobrar', esc(dinero(t.tarjetas))) +
      kpi('escudo', 'verde', 'En certificados', esc(dinero(t.certificados))) +
      kpi('dolar', 'turquesa', 'Dólares de clientes', esc(usd(t.dolares))) +
      kpi('grafica', 'oro', 'Ganancias del banco', esc(dinero(ing.total))) +
      '</div>';

    const atencion = [];
    estado.solicitudes.forEach((s) => {
      const c = estado.clientes.find((x) => x.numero === s.numero);
      atencion.push('<button class="item" data-accion="seccion" data-valor="solicitudes"><span class="item-icono oro">' + I('prestamo') + '</span><span class="item-texto"><strong>' + esc(c ? c.nombre : s.numero) + ' pide un préstamo ' + esc(nombreTipo(s.tipo).toLowerCase()) + '</strong><small>' + esc(dinero(s.monto)) + ' a ' + s.plazo + ' meses</small></span>' + I('flecha') + '</button>');
    });
    estado.clientes.forEach((c) => {
      const r = resumenCliente(c);
      if (r.tarjetaMora) atencion.push('<button class="item" data-accion="ver-cliente" data-valor="' + esc(c.numero) + '"><span class="item-icono rojo">' + I('tarjeta') + '</span><span class="item-texto"><strong>' + esc(c.nombre) + '</strong><small>No cubrió el pago mínimo de su tarjeta</small></span>' + I('flecha') + '</button>');
      if (r.atrasadas) atencion.push('<button class="item" data-accion="ver-cliente" data-valor="' + esc(c.numero) + '"><span class="item-icono rojo">' + I('alerta') + '</span><span class="item-texto"><strong>' + esc(c.nombre) + '</strong><small>' + r.atrasadas + ' cuota(s) atrasada(s)</small></span>' + I('flecha') + '</button>');
    });

    const actividad = [];
    estado.clientes.forEach((c) => c.movimientos.slice(0, 12).forEach((m) => actividad.push([m, c.nombre])));
    actividad.sort((a, b) => (a[0].fecha < b[0].fecha ? 1 : -1));

    const ranking = estado.clientes.slice().sort((a, b) => b.saldos.ahorro - a.saldos.ahorro).slice(0, 5).filter((c) => c.saldos.ahorro > 0);

    html +=
      '<div class="rejilla"><div>' +
      '<section class="tarjeta"><div class="tarjeta-cabeza"><h2>Requiere atención</h2></div>' +
      (atencion.length ? '<div class="lista">' + atencion.join('') + '</div>' : '<div class="vacio">' + I('check') + '<p>Todo al día.</p></div>') +
      '</section>' +
      '<section class="tarjeta"><div class="tarjeta-cabeza"><h2>¿Cómo gana dinero el banco?</h2><button class="boton chico claro" data-accion="seccion" data-valor="ajustes">' + I('ajustes') + 'Tarifas</button></div><div class="tarjeta-cuerpo resumen">' +
      filaResumen('Comisiones (retiros, transferencias, apertura, avances…)', esc(dinero(ing.comisiones))) +
      filaResumen('Impuesto a las transacciones (' + estado.config.impuestoTransaccion + '%)', esc(dinero(ing.impuestos))) +
      filaResumen('Cargos por mora', esc(dinero(ing.moras))) +
      filaResumen('Intereses de tarjetas', esc(dinero(ing.interesesTarjeta))) +
      filaResumen('Intereses de préstamos cobrados', esc(dinero(ing.interesesPrestamos))) +
      filaResumen('Total', esc(dinero(ing.total)), 'total') +
      '</div></section>' +
      '<section class="tarjeta"><div class="tarjeta-cabeza"><h2>Mejores ahorradores</h2></div>' +
      (ranking.length
        ? '<div class="lista">' + ranking.map((c, i) => '<div class="item"><span class="avatar chico' + (i ? ' azul' : '') + '">' + (i + 1) + '</span><span class="item-texto"><strong>' + esc(c.nombre) + '</strong><small>' + esc(c.numero) + '</small></span><span class="item-monto positivo">' + esc(dinero(c.saldos.ahorro)) + '</span></div>').join('') + '</div>'
        : '<div class="vacio">' + I('alcancia') + '<p>Nadie ha ahorrado todavía.</p></div>') +
      '</section></div>' +
      '<section class="tarjeta"><div class="tarjeta-cabeza"><h2>Actividad reciente</h2></div>' +
      (actividad.length ? '<ul class="lista">' + actividad.slice(0, 12).map(([m, n]) => itemMovimiento(m, n)).join('') + '</ul>' : '<div class="vacio">' + I('reloj') + '<p>Aún no hay movimientos. Empieza abriendo cuentas.</p><button class="boton chico" style="margin-top:12px" data-accion="seccion" data-valor="clientes">Abrir cuentas</button></div>') +
      '</section></div>';
    return html;
  }

  function dClientes() {
    let html = cabezaEscritorio('Clientes', 'Cuentas abiertas, saldos y claves de acceso.', '<button class="boton chico" data-accion="ir-apertura">' + I('mas1') + 'Abrir cuentas</button>');

    if (ui.nuevasCuentas) {
      html +=
        '<section class="tarjeta"><div class="tarjeta-cabeza"><h2>Cuentas recién abiertas</h2><div class="acciones-fila no-imprimir"><button class="boton chico borde" data-accion="imprimir">' + I('imprimir') + 'Imprimir</button><button class="boton chico claro" data-accion="cerrar-nuevas">Listo</button></div></div>' +
        '<div class="tabla-envoltura"><table><thead><tr><th>Nombre</th><th>Usuario / cuenta</th><th>Clave</th></tr></thead><tbody>' +
        ui.nuevasCuentas.map((c) => '<tr><td>' + esc(c.nombre) + '</td><td>' + esc(c.numero) + '</td><td><strong>' + esc(c.pin) + '</strong></td></tr>').join('') +
        '</tbody></table></div></section>';
    }

    const f = ui.filtroClientes.toLowerCase();
    const lista = estado.clientes
      .filter((c) => !f || c.nombre.toLowerCase().includes(f) || c.numero.toLowerCase().includes(f))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
    html +=
      '<section class="tarjeta"><div class="tarjeta-cabeza"><h2>' + estado.clientes.length + ' cuenta(s)</h2>' +
      '<div class="filtro">' + campo('', '<input data-filtro-clientes placeholder="Buscar cliente" value="' + esc(ui.filtroClientes) + '" />', 'buscar').replace('<span></span>', '') + '</div></div>' +
      (lista.length
        ? '<div class="tabla-envoltura"><table class="lista-cuentas"><thead><tr><th>Cliente</th><th>Cuenta</th><th>Clave</th><th class="num">Corriente</th><th class="num">Ahorro</th><th class="num">Debe</th><th>Estado</th></tr></thead><tbody>' +
          lista
            .map((c) => {
              const r = resumenCliente(c);
              return (
                '<tr data-accion="seleccionar" data-valor="' + esc(c.numero) + '" class="' + (ui.seleccion === c.numero ? 'seleccionada' : '') + '"><td><span class="avatar chico azul">' + iniciales(c.nombre) + '</span>' + esc(c.nombre) + '</td>' +
                '<td>' + esc(c.numero) + '</td><td>' + esc(c.pin) + '</td><td class="num">' + esc(dinero(c.saldos.corriente)) + '</td><td class="num">' + esc(dinero(c.saldos.ahorro)) + '</td><td class="num">' + esc(dinero(r.deuda)) + '</td>' +
                '<td>' + (r.atrasadas ? '<span class="etiqueta rojo">Atrasado</span>' : r.solicitud ? '<span class="etiqueta oro">Solicitud</span>' : '<span class="etiqueta verde">Al día</span>') + '</td></tr>'
              );
            })
            .join('') +
          '</tbody></table></div>'
        : '<div class="vacio">' + I('usuarios') + '<p>' + (estado.clientes.length ? 'Ningún cliente coincide con la búsqueda.' : 'Aún no hay cuentas. Ábrelas abajo.') + '</p></div>') +
      '</section>';

    const sel = estado.clientes.find((c) => c.numero === ui.seleccion);
    if (sel) {
      const r = resumenCliente(sel);
      html +=
        '<section class="tarjeta" id="detalle"><div class="tarjeta-cabeza"><div class="cabecera-fila"><span class="avatar">' + iniciales(sel.nombre) + '</span><div><h2>' + esc(sel.nombre) + '</h2><p class="ayuda">Cuenta ' + esc(sel.numero) + ' · Clave ' + esc(sel.pin) + ' · Cliente desde el mes ' + sel.creadoMes + '</p></div></div>' +
        '<div class="acciones-fila"><button class="boton chico claro" data-accion="ver-como" data-valor="' + esc(sel.numero) + '">' + I('telefono') + 'Ver su app</button>' +
        '<button class="boton chico borde" data-accion="cerrar-detalle">' + I('cerrar') + '</button></div></div>' +
        '<div class="datos" style="grid-template-columns:repeat(auto-fit,minmax(150px,1fr))">' +
        '<div><small>Corriente</small><strong>' + esc(dinero(sel.saldos.corriente)) + '</strong></div><div><small>Ahorro</small><strong>' + esc(dinero(sel.saldos.ahorro)) + '</strong></div>' +
        '<div><small>Debe (préstamos)</small><strong>' + esc(dinero(r.deuda)) + '</strong></div>' +
        '<div><small>Tarjeta</small><strong>' + (sel.tarjeta ? esc(dinero(B.resumenTarjeta(sel).deuda)) + ' de ' + esc(dinero(sel.tarjeta.limite)) : 'Sin tarjeta') + '</strong></div>' +
        '<div><small>Certificados</small><strong>' + esc(dinero(B.certificadosActivos(sel).reduce((x, k) => x + k.capital, 0))) + '</strong></div>' +
        '<div><small>Dólares</small><strong>' + esc(usd(sel.saldos.dolares)) + '</strong></div>' +
        '<div><small>Movimientos</small><strong>' + sel.movimientos.length + '</strong></div></div>' +
        '<div class="tarjeta-cuerpo rejilla">' +
        '<form class="formulario" data-form="ajuste"><h3>Premio o multa</h3>' +
        campo('Monto', '<input name="monto" type="number" min="0.01" step="0.01" required placeholder="0.00" />', 'dinero') +
        campo('Motivo', '<input name="motivo" maxlength="60" placeholder="Ej.: participación en clase" />', 'info') +
        '<div class="botones dos"><button class="boton" name="tipo" value="sumar">' + I('mas1') + 'Sumar</button><button class="boton peligro" name="tipo" value="restar">Restar</button></div></form>' +
        '<form class="formulario" data-form="cambiar-pin"><h3>Clave de acceso</h3>' +
        campo('Nueva clave', '<input class="pin" name="pin" inputmode="numeric" maxlength="4" required value="' + pinAleatorio() + '" />', 'llave') +
        '<button class="boton claro">Cambiar clave</button>' +
        '<button type="button" class="boton borde" style="color:var(--rojo)" data-accion="eliminar" data-valor="' + esc(sel.numero) + '">' + I('basura') + 'Cerrar esta cuenta</button></form>' +
        '</div><div class="tarjeta-cabeza"><h2>Movimientos</h2></div>' + listaMovimientos(sel.movimientos) + '</section>';
    }

    html +=
      '<section class="tarjeta" id="apertura"><div class="tarjeta-cabeza"><h2>Abrir cuentas</h2><span class="etiqueta">Depósito de apertura: ' + esc(dinero(estado.config.saldoInicial)) + '</span></div>' +
      '<div class="tarjeta-cuerpo rejilla">' +
      '<form class="formulario" data-form="abrir-cuenta"><h3>Una cuenta</h3>' +
      campo('Nombre completo', '<input name="nombre" maxlength="40" required placeholder="Ej.: Ana Pérez" />', 'usuario') +
      campo('Clave (4 números)', '<input class="pin" name="pin" inputmode="numeric" maxlength="4" required value="' + pinAleatorio() + '" />', 'llave') +
      '<button class="boton">Abrir cuenta</button></form>' +
      '<form class="formulario" data-form="abrir-varias"><h3>Toda la lista del curso</h3>' +
      '<label class="campo"><span>Un nombre por línea (la clave se crea sola)</span><div class="control"><textarea name="nombres" rows="6" required placeholder="Ana Pérez&#10;Luis Gómez&#10;María Rodríguez"></textarea></div></label>' +
      '<button class="boton">Abrir todas</button></form>' +
      '</div></section>';
    return html;
  }

  function dSolicitudes() {
    let html = cabezaEscritorio('Solicitudes de préstamo', 'Revisa cada solicitud antes de aprobarla: ¿podrá pagar la cuota?');
    if (!estado.solicitudes.length) return html + '<section class="tarjeta"><div class="vacio">' + I('check') + '<p>No hay solicitudes pendientes.</p></div></section>';
    html += '<div class="rejilla">';
    estado.solicitudes.forEach((s) => {
      const c = estado.clientes.find((x) => x.numero === s.numero);
      const tabla = B.tablaAmortizacion(s.monto, s.tasa, s.plazo, s.sistema);
      const total = tabla.reduce((t, f) => t + f.cuota, 0);
      const apertura = B.sumaCargos(B.cargosDe(estado, 'apertura-prestamo', s.monto));
      html +=
        '<section class="tarjeta"><div class="tarjeta-cabeza"><div class="cabecera-fila"><span class="avatar">' + iniciales(c ? c.nombre : '?') + '</span><div><h2>' + esc(c ? c.nombre : s.numero) + '</h2><p class="ayuda">Solicitado en el mes ' + s.mes + '</p></div></div><span class="etiqueta oro">Pendiente</span></div>' +
        '<div class="tarjeta-cuerpo resumen">' +
        filaResumen('Tipo', 'Préstamo ' + esc(nombreTipo(s.tipo).toLowerCase())) +
        filaResumen('Monto', esc(dinero(s.monto))) +
        filaResumen('Plazo y tasa', s.plazo + ' meses al ' + s.tasa + '%') +
        filaResumen('Sistema', esc(B.SISTEMAS[s.sistema || 'frances'])) +
        filaResumen(s.sistema === 'aleman' ? 'Primera cuota' : 'Cuota mensual', esc(dinero(tabla[0].cuota))) +
        filaResumen('Comisión de apertura', esc(dinero(apertura))) +
        filaResumen('Total a pagar', esc(dinero(total))) +
        filaResumen('Motivo', esc(s.motivo || '—')) +
        filaResumen('Saldo actual', esc(dinero(c ? c.saldos.corriente : 0)) + ' + ' + esc(dinero(c ? c.saldos.ahorro : 0)) + ' ahorro') +
        '</div><div class="tarjeta-cuerpo botones dos" style="padding-top:0"><button class="boton peligro" data-accion="rechazar" data-valor="' + esc(s.id) + '">Rechazar</button>' +
        '<button class="boton" data-accion="aprobar" data-valor="' + esc(s.id) + '">' + I('check') + 'Aprobar</button></div></section>';
    });
    return html + '</div>';
  }

  function dMes() {
    const cfg = estado.config;
    let html = cabezaEscritorio('Cierre de mes', 'Estamos en el mes ' + estado.mes + ' del banco.');
    html +=
      '<section class="tarjeta"><div class="tarjeta-cuerpo formulario"><p>Al cerrar el mes, el banco hace automáticamente:</p>' +
      '<div class="item"><span class="item-icono verde">' + I('porcentaje') + '</span><span class="item-texto"><strong>Paga ' + cfg.tasaAhorroMensual + '% de interés</strong><small>sobre el saldo de cada cuenta de ahorro (interés compuesto)</small></span></div>' +
      '<div class="item"><span class="item-icono verde">' + I('escudo') + '</span><span class="item-texto"><strong>Paga ' + cfg.tasaCertificadoMensual + '% a los certificados</strong><small>y devuelve capital + intereses de los que vencen</small></span></div>' +
      '<div class="item"><span class="item-icono">' + I('tarjeta') + '</span><span class="item-texto"><strong>Hace el corte de las tarjetas</strong><small>mora de ' + esc(dinero(cfg.cargoMoraTarjeta)) + ' si no cubrieron el mínimo e interés de ' + cfg.tasaTarjetaMensual + '% sobre lo no pagado</small></span></div>' +
      '<div class="item"><span class="item-icono morado">' + I('prestamo') + '</span><span class="item-texto"><strong>Cobra la cuota de cada préstamo</strong><small>desde la cuenta corriente; si no hay saldo, la cuota queda atrasada y se suma una mora de ' + esc(dinero(cfg.cargoMoraPrestamo)) + '</small></span></div>' +
      '<div class="item"><span class="item-icono rojo">' + I('alerta') + '</span><span class="item-texto"><strong>Cobra mantenimiento de ' + esc(dinero(cfg.cargoMantenimiento)) + '</strong><small>a las cuentas corrientes con menos de ' + esc(dinero(cfg.saldoMinimo)) + '</small></span></div>' +
      '<button class="boton" style="max-width:320px" data-accion="cerrar-mes">' + I('calendario') + 'Cerrar el mes ' + estado.mes + '</button></div></section>';
    if (estado.historialMeses.length) {
      html +=
        '<section class="tarjeta"><div class="tarjeta-cabeza"><h2>Meses cerrados</h2></div><div class="tabla-envoltura"><table><thead><tr><th>Mes</th><th class="num">Intereses pagados</th><th class="num">Ganancia del banco</th><th class="num">Cuotas cobradas</th><th>Cuotas sin pagar</th><th>Tarjetas en mora</th></tr></thead><tbody>' +
        estado.historialMeses
          .map(
            (r) =>
              '<tr><td>' + r.mes + '</td><td class="num">' + esc(dinero(r.interesesPagados)) + '</td><td class="num">' + esc(dinero(r.cargosCobrados || 0)) + '</td><td class="num">' + r.cuotasCobradas + '</td><td>' +
              (r.cuotasSinPagar.length ? r.cuotasSinPagar.map((x) => esc(x.nombre) + ' (' + x.atrasadas + ')').join(', ') : '—') + '</td><td>' +
              ((r.tarjetasEnMora || []).length ? r.tarjetasEnMora.map((x) => esc(x.nombre)).join(', ') : '—') + '</td></tr>'
          )
          .join('') +
        '</tbody></table></div></section>';
    }
    return html;
  }

  function dAjustes() {
    const cfg = estado.config;
    const num = (n, v, extra) => '<input name="' + n + '" type="number" required value="' + v + '" ' + (extra || '') + ' />';
    const m = (n, et, ico) => campo(et, num(n, unidades(cfg[n]), 'min="0" step="0.01"'), ico || 'dinero');
    const pct = (n, et) => campo(et, num(n, cfg[n], 'min="0" max="100" step="0.01"'), 'porcentaje');
    const grupo = (titulo, campos) => '<h3 style="margin-top:8px">' + titulo + '</h3><div class="fila-campos">' + campos + '</div>';
    return (
      cabezaEscritorio('Ajustes', 'Reglas del banco, tarifas y copias de seguridad.') +
      '<section class="tarjeta"><div class="tarjeta-cabeza"><h2>Reglas y tarifas del banco</h2></div><form class="tarjeta-cuerpo formulario" data-form="config">' +
      grupo(
        'General',
        campo('Nombre del banco', '<input name="nombreBanco" maxlength="30" required value="' + esc(cfg.nombreBanco) + '" />', 'prestamo') +
          campo('Símbolo de la moneda', '<input name="simbolo" maxlength="4" required value="' + esc(cfg.simbolo) + '" />', 'dinero') +
          campo('Clave de docente', '<input class="pin" name="pinDocente" inputmode="numeric" maxlength="4" required value="' + esc(cfg.pinDocente) + '" />', 'llave')
      ) +
      grupo(
        'Cuentas',
        m('saldoInicial', 'Depósito de apertura', 'estrella') +
          pct('tasaAhorroMensual', 'Interés del ahorro (% mensual)') +
          m('saldoMinimo', 'Saldo mínimo de la corriente') +
          m('cargoMantenimiento', 'Cargo por mantenimiento') +
          m('comisionRetiro', 'Comisión por retiro') +
          m('comisionTransferencia', 'Comisión por transferencia') +
          pct('impuestoTransaccion', 'Impuesto a transacciones (%)')
      ) +
      grupo(
        'Préstamos',
        pct('tasaPrestamoMensual', 'Personal (% mensual)') +
          pct('tasaPrestamoEducativo', 'Educativo (% mensual)') +
          pct('tasaPrestamoEmprendimiento', 'Emprendimiento (% mensual)') +
          m('montoMaximoPrestamo', 'Préstamo máximo', 'prestamo') +
          campo('Plazos (meses, separados por coma)', '<input name="plazosPrestamo" required value="' + esc(cfg.plazosPrestamo.join(', ')) + '" />', 'calendario') +
          pct('comisionApertura', 'Comisión de apertura (%)') +
          m('cargoMoraPrestamo', 'Mora por cuota atrasada')
      ) +
      grupo(
        'Tarjeta de crédito',
        m('limiteTarjeta', 'Límite de crédito', 'tarjeta') +
          pct('tasaTarjetaMensual', 'Interés (% mensual)') +
          pct('pagoMinimoPorcentaje', 'Pago mínimo (% del saldo)') +
          m('pagoMinimoFijo', 'Pago mínimo fijo') +
          m('cargoMoraTarjeta', 'Cargo por mora') +
          pct('comisionAvance', 'Comisión por avance (%)') +
          m('cuotaEmisionTarjeta', 'Cuota de emisión')
      ) +
      grupo(
        'Certificados y divisas',
        pct('tasaCertificadoMensual', 'Certificados (% mensual)') +
          campo('Plazos de certificados (meses)', '<input name="plazosCertificado" required value="' + esc(cfg.plazosCertificado.join(', ')) + '" />', 'calendario') +
          m('montoMinimoCertificado', 'Monto mínimo de certificado') +
          pct('penalidadCertificado', 'Penalidad por cancelar (%)') +
          campo('El banco compra el dólar a', num('tasaCompraUSD', cfg.tasaCompraUSD, 'min="0.01" step="0.01"'), 'dolar') +
          campo('El banco vende el dólar a', num('tasaVentaUSD', cfg.tasaVentaUSD, 'min="0.01" step="0.01"'), 'dolar')
      ) +
      '<div class="aviso-banner azul">' + I('info') + '<span>Los cambios de tasa aplican a productos nuevos. Los préstamos, tarjetas y certificados ya abiertos mantienen su tasa. Pon un cargo en 0 para no cobrarlo.</span></div>' +
      '<button class="boton" style="max-width:260px">Guardar reglas</button></form></section>' +
      '<div class="rejilla">' +
      '<section class="tarjeta"><div class="tarjeta-cabeza"><h2>Copia de seguridad</h2></div><div class="tarjeta-cuerpo formulario">' +
      '<p class="ayuda">Los datos se guardan solo en <strong>este navegador de esta computadora</strong>. Descarga una copia al final de cada clase para no perderlos o para pasarlos a otra computadora.</p>' +
      '<div class="botones dos"><button class="boton" data-accion="exportar">' + I('descargar') + 'Descargar</button>' +
      '<label class="boton claro">' + I('subir') + 'Cargar<input type="file" accept=".json,application/json" data-importar hidden /></label></div></div></section>' +
      '<section class="tarjeta"><div class="tarjeta-cabeza"><h2>Empezar de cero</h2></div><div class="tarjeta-cuerpo formulario">' +
      '<p class="ayuda">Borra todas las cuentas, movimientos y reglas. No se puede deshacer.</p>' +
      '<button class="boton peligro" data-accion="borrar-todo">' + I('basura') + 'Borrar todo el banco</button></div></section></div>'
    );
  }

  // ==========================================================
  // Pintar
  // ==========================================================

  function pintar(subir) {
    document.body.classList.toggle('modo-movil', ui.modo !== 'docente');
    if (ui.modo === 'estudiante') app.innerHTML = vistaEstudiante();
    else if (ui.modo === 'docente') app.innerHTML = vistaDocente();
    else app.innerHTML = vistaAcceso();
    document.title = estado.config.nombreBanco + ' · Banca escolar';
    if (subir) {
      window.scrollTo(0, 0);
      const aviso = document.getElementById('aviso');
      if (aviso && aviso.classList.contains('error')) aviso.hidden = true;
    }
  }

  function irA(pantalla) {
    if (!SUBPANTALLAS.includes(pantalla)) ui.pila = [];
    else if (pantalla !== ui.pantalla) ui.pila.push(ui.pantalla);
    ui.pantalla = pantalla;
    ui.op = null;
    pintar(true);
  }

  function cerrarSesion() {
    Object.assign(ui, { modo: 'acceso', numero: null, desdeDocente: false, pantalla: 'inicio', op: null, producto: null, accesoDocente: false, seleccion: null, nuevasCuentas: null });
    guardarSesion();
  }

  /** Ejecuta una operación, guarda, vuelve a pintar y avisa. */
  function operar(fn, mensaje) {
    try {
      const r = fn();
      guardar();
      pintar();
      if (mensaje) avisar(typeof mensaje === 'function' ? mensaje(r) : mensaje);
      return true;
    } catch (e) {
      if (e instanceof B.ErrorBanco) avisar(e.message, true);
      else {
        console.error(e);
        avisar('Ocurrió un error inesperado.', true);
      }
      return false;
    }
  }

  function manejarError(e) {
    if (e instanceof B.ErrorBanco) avisar(e.message, true);
    else {
      console.error(e);
      avisar('Ocurrió un error inesperado.', true);
    }
  }

  // ==========================================================
  // Formularios
  // ==========================================================

  const formularios = {
    'entrar-estudiante'(d) {
      const texto = String(d.usuario || '').trim().toLowerCase();
      const c = estado.clientes.find((x) => x.numero.toLowerCase() === texto || x.nombre.toLowerCase() === texto);
      if (!c || c.pin !== String(d.pin).trim()) return avisar('Usuario o clave incorrectos.', true);
      Object.assign(ui, { modo: 'estudiante', numero: c.numero, pantalla: 'inicio', op: null, desdeDocente: false });
      guardarSesion();
      pintar(true);
      avisar('¡Hola, ' + c.nombre.split(/\s+/)[0] + '!');
    },
    'entrar-docente'(d) {
      if (String(d.pin).trim() !== estado.config.pinDocente) return avisar('Clave de docente incorrecta.', true);
      Object.assign(ui, { modo: 'docente', seccion: 'resumen', seleccion: null, nuevasCuentas: null, accesoDocente: false });
      guardarSesion();
      pintar(true);
    },
    'op-datos'(d) {
      const c = clienteActual();
      const spec = OPS[ui.op.tipo];
      try {
        const datos = spec.leer(c, d);
        ui.op.datos = Object.assign({}, d, datos);
        if (spec.directo) return ejecutarOperacion(c, spec);
        ui.op.paso = 'confirmar';
        pintar(true);
      } catch (e) {
        ui.op.datos = d;
        manejarError(e);
      }
    },
    'op-confirmar'(d) {
      const c = clienteActual();
      const spec = OPS[ui.op.tipo];
      if (!spec.sinClave && c.pin !== String(d.pin || '').trim()) return avisar('La clave no es correcta.', true);
      ejecutarOperacion(c, spec);
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
      pintar(true);
      if (errores.length) avisar('Se abrieron ' + creadas.length + ' cuenta(s). Revisa: ' + errores.join(' · '), true);
      else avisar('Se abrieron ' + creadas.length + ' cuenta(s).');
    },
    ajuste(d, boton) {
      const tipo = boton && boton.value;
      operar(() => {
        const monto = B.aCentavos(d.monto);
        const motivo = (tipo === 'restar' ? 'Multa' : 'Premio') + ' del docente' + (d.motivo ? ': ' + d.motivo.trim() : '');
        if (tipo === 'restar') B.retirar(estado, ui.seleccion, monto, motivo);
        else B.depositar(estado, ui.seleccion, monto, motivo);
      }, 'Saldo ajustado.');
    },
    'cambiar-pin'(d) {
      operar(() => B.cambiarPin(estado, ui.seleccion, d.pin), 'Clave actualizada.');
    },
    config(d) {
      const plazos = (t) => String(t).split(/[,;\s]+/).filter(Boolean).map(Number).sort((a, b) => a - b);
      const cambios = { nombreBanco: d.nombreBanco.trim(), simbolo: d.simbolo.trim(), pinDocente: d.pinDocente, plazosPrestamo: plazos(d.plazosPrestamo), plazosCertificado: plazos(d.plazosCertificado) };
      operar(() => {
        CAMPOS_MONTO.forEach((k) => (cambios[k] = B.aCentavos(d[k])));
        CAMPOS_NUMERO.forEach((k) => (cambios[k] = Number(d[k])));
        B.actualizarConfig(estado, cambios);
      }, 'Reglas guardadas.');
    },
  };

  const CAMPOS_MONTO = ['saldoInicial', 'saldoMinimo', 'cargoMantenimiento', 'comisionRetiro', 'comisionTransferencia', 'montoMaximoPrestamo', 'cargoMoraPrestamo', 'limiteTarjeta', 'pagoMinimoFijo', 'cargoMoraTarjeta', 'cuotaEmisionTarjeta', 'montoMinimoCertificado'];
  const CAMPOS_NUMERO = ['tasaAhorroMensual', 'impuestoTransaccion', 'tasaPrestamoMensual', 'tasaPrestamoEducativo', 'tasaPrestamoEmprendimiento', 'comisionApertura', 'tasaTarjetaMensual', 'pagoMinimoPorcentaje', 'comisionAvance', 'tasaCertificadoMensual', 'penalidadCertificado', 'tasaCompraUSD', 'tasaVentaUSD'];

  function ejecutarOperacion(c, spec) {
    try {
      const recibo = spec.ejecutar(c, ui.op.datos);
      guardar();
      recibo.referencia = referencia(c);
      recibo.fecha = new Date().toISOString();
      recibo.mes = estado.mes;
      ui.op.recibo = recibo;
      ui.op.paso = 'recibo';
      pintar(true);
    } catch (e) {
      manejarError(e);
    }
  }

  document.addEventListener('submit', (e) => {
    const form = e.target.closest('form[data-form]');
    if (!form) return;
    e.preventDefault();
    const datos = Object.fromEntries(new FormData(form).entries());
    formularios[form.dataset.form](datos, e.submitter);
  });

  // ==========================================================
  // Botones
  // ==========================================================

  const acciones = {
    'acceso-docente'() {
      ui.accesoDocente = true;
      pintar();
    },
    'acceso-estudiante'() {
      ui.accesoDocente = false;
      pintar();
    },
    ir(v) {
      if (v === 'transferir') return abrirOperacion('transferencia');
      irA(v || 'inicio');
    },
    producto(v) {
      ui.producto = v;
      irA('producto');
    },
    operar(v, el) {
      abrirOperacion(v, el.dataset.servicio);
    },
    'cambiar-op'(v) {
      const volver = ui.op.volver;
      ui.op = { tipo: v, paso: 'datos', datos: {}, volver };
      pintar();
    },
    volver() {
      const anterior = ui.pila.pop() || 'inicio';
      ui.pantalla = anterior;
      ui.op = null;
      pintar(true);
    },
    calc(v) {
      ui.calc = v || 'simple';
      if (ui.pantalla === 'calculadoras') pintar();
      else irA('calculadoras');
    },
    async 'cancelar-certificado'(v) {
      const c = clienteActual();
      const cert = c && c.certificados.find((x) => x.id === v);
      if (!cert) return;
      const penalidad = Math.round((cert.capital * estado.config.penalidadCertificado) / 100);
      const ok = await hoja({
        peligro: true,
        icono: 'alerta',
        titulo: '¿Cancelar el certificado antes de tiempo?',
        texto: 'Recibirás ' + dinero(cert.capital - penalidad) + ': pierdes ' + dinero(cert.interes) + ' de intereses ganados y pagas una penalidad de ' + dinero(penalidad) + ' (' + estado.config.penalidadCertificado + '%).',
        ok: 'Sí, cancelarlo',
        cancelar: 'Mantenerlo',
      });
      if (ok) operar(() => B.cancelarCertificado(estado, c.numero, v), 'Certificado cancelado. El dinero está en tu cuenta corriente.');
    },
    'atras-op'() {
      if (ui.op.paso === 'confirmar') {
        ui.op.paso = 'datos';
        pintar(true);
      } else {
        irA(ui.op.volver || 'inicio');
      }
    },
    'terminar-op'() {
      const destino = ui.op && ui.op.recibo && ui.op.recibo.volverA;
      if (destino === 'producto') ui.producto = 'tarjeta';
      irA(destino || 'inicio');
    },
    'monto-rapido'(v, el) {
      const input = el.closest('form').querySelector('input[name=monto]');
      input.value = v;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    },
    'filtro-mov'(v) {
      ui.filtroMov = v;
      pintar();
    },
    'ir-calculadora'() {
      const el = document.getElementById('calculadora');
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    },
    ocultar() {
      ui.ocultar = !ui.ocultar;
      guardarPreferencia(CLAVE_OCULTAR, ui.ocultar ? '1' : '0');
      pintar();
    },
    copiar(v) {
      if (navigator.clipboard) navigator.clipboard.writeText(v).catch(() => {});
      avisar('Número de cuenta copiado: ' + v);
    },
    imprimir() {
      window.print();
    },
    async salir() {
      if (ui.modo === 'estudiante' && ui.desdeDocente) {
        Object.assign(ui, { modo: 'docente', numero: null, desdeDocente: false, op: null, pantalla: 'inicio' });
        guardarSesion();
        return pintar(true);
      }
      const ok = await hoja({ icono: 'salir', titulo: '¿Cerrar sesión?', texto: 'Tendrás que escribir tu clave para volver a entrar.', ok: 'Cerrar sesión' });
      if (!ok) return;
      cerrarSesion();
      pintar(true);
    },
    // ----- docente -----
    seccion(v) {
      ui.seccion = v;
      pintar(true);
    },
    seleccionar(v) {
      ui.seleccion = v;
      pintar();
      const det = document.getElementById('detalle');
      if (det) det.scrollIntoView({ behavior: 'smooth' });
    },
    'ver-cliente'(v) {
      ui.seccion = 'clientes';
      acciones.seleccionar(v);
    },
    'cerrar-detalle'() {
      ui.seleccion = null;
      pintar();
    },
    'ir-apertura'() {
      const el = document.getElementById('apertura');
      if (el) el.scrollIntoView({ behavior: 'smooth' });
      const input = el && el.querySelector('input[name=nombre]');
      if (input) input.focus({ preventScroll: true });
    },
    'ver-como'(v) {
      Object.assign(ui, { modo: 'estudiante', numero: v, desdeDocente: true, pantalla: 'inicio', op: null });
      guardarSesion();
      pintar(true);
    },
    'cerrar-nuevas'() {
      ui.nuevasCuentas = null;
      pintar();
    },
    aprobar(v) {
      operar(() => B.aprobarPrestamo(estado, v), 'Préstamo aprobado. El dinero ya está en la cuenta del estudiante.');
    },
    async rechazar(v) {
      const ok = await hoja({ peligro: true, titulo: '¿Rechazar la solicitud?', texto: 'El estudiante podrá hacer una nueva solicitud.', ok: 'Rechazar' });
      if (ok) operar(() => B.rechazarPrestamo(estado, v), 'Solicitud rechazada.');
    },
    async eliminar(v) {
      const c = estado.clientes.find((x) => x.numero === v);
      if (!c) return;
      const ok = await hoja({ peligro: true, icono: 'basura', titulo: '¿Cerrar la cuenta de ' + c.nombre + '?', texto: 'Se borrarán su saldo y todos sus movimientos. No se puede deshacer.', ok: 'Cerrar cuenta' });
      if (ok) {
        operar(() => {
          B.eliminarCliente(estado, v);
          ui.seleccion = null;
        }, 'Cuenta cerrada.');
      }
    },
    async 'cerrar-mes'() {
      const ok = await hoja({ icono: 'calendario', titulo: '¿Cerrar el mes ' + estado.mes + '?', texto: 'Se pagarán los intereses del ahorro y los certificados, se hará el corte de las tarjetas y se cobrarán cuotas, moras y mantenimiento.', ok: 'Cerrar mes' });
      if (!ok) return;
      operar(
        () => B.avanzarMes(estado),
        (r) => 'Mes ' + r.mes + ' cerrado: ' + dinero(r.interesesPagados) + ' en intereses pagados, ' + dinero(r.cargosCobrados) + ' de ganancia para el banco, ' + r.cuotasCobradas + ' cuota(s) cobrada(s).'
      );
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
    async 'borrar-todo'() {
      const r = await hoja({ peligro: true, icono: 'basura', titulo: '¿Borrar todo el banco?', texto: 'Se eliminarán todas las cuentas, movimientos y reglas.', entrada: 'Escribe BORRAR para confirmar', ok: 'Borrar todo' });
      if (typeof r === 'string' && r.trim().toUpperCase() === 'BORRAR') {
        estado = B.estadoInicial();
        guardar();
        cerrarSesion();
        pintar(true);
        avisar('El banco quedó vacío.');
      } else if (r !== false) {
        avisar('No se borró nada: escribe BORRAR para confirmar.', true);
      }
    },
  };

  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-accion]');
    if (!el) return;
    const fn = acciones[el.dataset.accion];
    if (fn) {
      e.preventDefault();
      fn(el.dataset.valor, el);
    }
  });

  // Campos que se actualizan mientras se escribe.
  document.addEventListener('input', (e) => {
    const t = e.target;
    if (t.dataset.filtro === 'destinos') {
      const q = t.value.trim().toLowerCase();
      document.querySelectorAll('[data-lista="destinos"] .opcion').forEach((o) => o.classList.toggle('oculto', !!q && !o.dataset.texto.includes(q)));
    }
    if (t.hasAttribute('data-filtro-clientes')) {
      ui.filtroClientes = t.value;
      const pos = t.selectionStart;
      pintar();
      const nuevo = document.querySelector('[data-filtro-clientes]');
      nuevo.focus();
      nuevo.setSelectionRange(pos, pos);
    }
    const calc = t.closest('[data-calc]');
    if (calc) calc.querySelector('[data-resultado]').innerHTML = resultadoCalculadora(calc.dataset.calc, leerCalculadora(calc));
  });

  document.addEventListener('change', (e) => {
    const t = e.target;
    if (t.form && t.form.dataset.form === 'op-datos') actualizarVistaPrevia(t.form);
    if (t.hasAttribute('data-importar') && t.files[0]) importarArchivo(t);
  });

  document.addEventListener('input', (e) => {
    const form = e.target.form;
    if (form && form.dataset.form === 'op-datos') actualizarVistaPrevia(form);
  });

  /** Vuelve a calcular la vista previa (cuota, cargos, intereses) de la operación en curso. */
  function actualizarVistaPrevia(form) {
    const caja = form.querySelector('[data-preview]');
    const spec = ui.op && OPS[ui.op.tipo];
    if (!caja || !spec || !spec.preview) return;
    const d = Object.fromEntries(new FormData(form).entries());
    caja.innerHTML = spec.preview(clienteActual(), d);
  }

  function importarArchivo(input) {
    const lector = new FileReader();
    lector.onload = async () => {
      let nuevo;
      try {
        nuevo = B.importar(lector.result);
      } catch (err) {
        return avisar(err.message, true);
      }
      const ok = await hoja({ icono: 'subir', titulo: '¿Cargar esta copia?', texto: 'Tiene ' + nuevo.clientes.length + ' cuenta(s) y está en el mes ' + nuevo.mes + '. Reemplazará los datos actuales.', ok: 'Cargar copia' });
      if (!ok) return;
      estado = nuevo;
      Object.assign(ui, { seleccion: null, nuevasCuentas: null });
      guardar();
      pintar();
      avisar('Copia cargada.');
    };
    lector.readAsText(input.files[0]);
    input.value = '';
  }

  pintar();
})();
