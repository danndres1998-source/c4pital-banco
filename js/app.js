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

  function conSigno(centavos) {
    return '<span class="' + (centavos >= 0 ? 'positivo' : 'negativo') + '">' + (centavos > 0 ? '+' : '') + esc(dinero(centavos)) + '</span>';
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

  function resumenCliente(c) {
    const activos = B.prestamosActivos(c);
    return {
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
  };

  function itemMovimiento(m, nombre) {
    const estilo = m.tipo === 'transferencia' ? ['transferir', m.monto >= 0 ? 'verde' : 'rojo'] : ESTILO_MOV[m.tipo] || ['dinero', ''];
    return (
      '<li class="item"><span class="item-icono ' + estilo[1] + '">' + I(estilo[0]) + '</span>' +
      '<span class="item-texto"><strong>' + esc(m.descripcion) + '</strong><small>' + (nombre ? esc(nombre) + ' · ' : '') +
      (m.cuenta === 'ahorro' ? 'Ahorro' : 'Corriente') + ' · Mes ' + m.mes + ' · ' + esc(fechaCorta(m.fecha)) + '</small></span>' +
      '<span class="item-monto">' + conSigno(m.monto) + '<small>' + (ui.ocultar && !nombre ? '' : 'Saldo ' + esc(dinero(m.saldo))) + '</small></span></li>'
    );
  }

  function listaMovimientos(movs, vacio) {
    if (!movs.length) return '<div class="vacio">' + I('reloj') + '<p>' + (vacio || 'Todavía no hay movimientos.') + '</p></div>';
    return '<ul class="lista">' + movs.map((m) => itemMovimiento(m)).join('') + '</ul>';
  }

  function barraSuperior(titulo, accion, icono, clara) {
    return (
      '<header class="barra-superior' + (clara ? ' clara' : '') + '">' +
      '<button class="icono-boton" data-accion="' + (accion || 'atras') + '" aria-label="Volver">' + I(icono || 'atras') + '</button>' +
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

  function campoMontoGrande(valor, disponible) {
    return (
      '<div class="monto-grande"><span>' + esc(estado.config.simbolo) + '</span>' +
      '<input name="monto" type="number" inputmode="decimal" min="0.01" step="0.01" placeholder="0.00" aria-label="Monto" required value="' + esc(valor || '') + '" /></div>' +
      (disponible != null ? '<p class="disponible">Disponible: <strong>' + esc(dinero(disponible)) + '</strong></p>' : '') +
      '<div class="montos-rapidos">' + [50, 100, 250, 500].map((v) => '<button type="button" data-accion="monto-rapido" data-valor="' + v + '">' + esc(estado.config.simbolo) + v + '</button>').join('') + '</div>'
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
      cuerpo = ({ inicio: pInicio, movimientos: pMovimientos, producto: pProducto, pagos: pPagos, prestamos: pPrestamos, mas: pMas }[ui.pantalla] || pInicio)(c);
      if (ui.pantalla === 'movimientos' || ui.pantalla === 'producto') nav = false;
    }
    return '<div class="movil"><main class="contenido' + (nav ? '' : ' sin-nav') + '">' + cuerpo + '</main>' + (nav ? navInferior(c) : '') + '</div>';
  }

  function navInferior(c) {
    const r = resumenCliente(c);
    const items = [
      ['inicio', 'inicio', 'Inicio'],
      ['transferir', 'transferir', 'Transferir'],
      ['pagos', 'pagos', 'Pagos'],
      ['prestamos', 'prestamo', 'Préstamos'],
      ['mas', 'mas', 'Más'],
    ];
    return (
      '<nav class="nav-inferior" aria-label="Menú principal">' +
      items
        .map(
          ([id, ico, txt]) =>
            '<button data-accion="ir" data-valor="' + id + '"' + (ui.pantalla === id ? ' aria-current="page"' : '') + '>' + I(ico) + txt +
            (id === 'prestamos' && r.atrasadas ? '<span class="punto-alerta"></span>' : '') + '</button>'
        )
        .join('') +
      '</nav>'
    );
  }

  function pInicio(c) {
    const r = resumenCliente(c);
    const total = c.saldos.corriente + c.saldos.ahorro;
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
        '<button class="producto prestamo" data-accion="producto" data-valor="' + esc(p.id) + '"><span class="producto-tipo">' + I('prestamo') + 'Préstamo personal</span>' +
        '<span class="producto-saldo">' + saldo(rp.saldoPendiente) + '</span><span class="producto-pie"><span>Saldo pendiente</span><span>' + p.cuotasPagadas + '/' + p.plazo + ' cuotas</span></span></button>';
    });
    if (!r.activos.length) {
      html += '<button class="producto nuevo" data-accion="operar" data-valor="solicitud">' + I('mas1') + 'Solicitar un préstamo</button>';
    }
    html += '</div>';

    if (r.atrasadas) {
      html += '<div class="seccion"><div class="aviso-banner rojo">' + I('alerta') + '<span>Tienes <strong>' + r.atrasadas + ' cuota(s) atrasada(s)</strong>. Paga tu préstamo para ponerte al día. <button class="enlace" data-accion="operar" data-valor="cuota">Pagar ahora</button></span></div></div>';
    }
    if (r.solicitud) {
      html += '<div class="seccion"><div class="aviso-banner azul">' + I('reloj') + '<span>Tu solicitud de préstamo por <strong>' + esc(dinero(r.solicitud.monto)) + '</strong> está en revisión.</span></div></div>';
    }

    const accesos = [
      ['operar', 'transferencia', 'transferir', 'Transferir'],
      ['operar', 'deposito', 'entrada', 'Depositar'],
      ['operar', 'retiro', 'salida', 'Retirar'],
      ['operar', 'servicio', 'pagos', 'Pagar servicios'],
      ['operar', 'mover', 'alcancia', 'Ahorrar'],
      ['operar', 'solicitud', 'prestamo', 'Pedir préstamo'],
      ['operar', 'cuota', 'calendario', 'Pagar préstamo'],
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
    let html = barraSuperior('Movimientos', 'ir', 'atras') ;
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
    const p = c.prestamos.find((x) => x.id === ui.producto);
    return p ? productoPrestamo(c, p) : pInicio(c);
  }

  function cabezaDetalle(clase, titulo, montoHtml, numero, acciones, extra) {
    return (
      barraSuperior(titulo, 'ir', 'atras').replace('barra-superior', 'barra-superior ' + clase) +
      '<section class="detalle-cabeza ' + clase + '"><small>' + (clase === 'prestamo' ? 'Saldo pendiente' : 'Saldo disponible') + '</small>' +
      '<div class="saldo">' + montoHtml + '</div>' +
      (numero ? '<button class="numero enlace" style="color:inherit" data-accion="copiar" data-valor="' + esc(numero) + '">Cuenta ' + esc(numero) + ' ' + I('copiar') + '</button>' : '') +
      (extra || '') +
      '<div class="detalle-acciones">' + acciones.map(([a, v, ico, t]) => '<button data-accion="' + a + '" data-valor="' + v + '">' + I(ico) + t + '</button>').join('') + '</div></section>'
    );
  }

  function productoCorriente(c) {
    let html = cabezaDetalle('', 'Cuenta Corriente', saldo(c.saldos.corriente), c.numero, [
      ['operar', 'transferencia', 'transferir', 'Transferir'],
      ['operar', 'deposito', 'entrada', 'Depositar'],
      ['operar', 'retiro', 'salida', 'Retirar'],
    ]);
    html +=
      '<section class="seccion"><div class="panel datos" style="display:grid">' +
      '<div><small>Titular</small><strong>' + esc(c.nombre) + '</strong></div><div><small>Estado</small><strong><span class="etiqueta verde">Activa</span></strong></div>' +
      '<div><small>Moneda</small><strong>' + esc(estado.config.simbolo) + ' (didáctico)</strong></div><div><small>Abierta en</small><strong>Mes ' + c.creadoMes + '</strong></div></div></section>';
    html += '<section class="seccion"><div class="seccion-titulo"><h2>Movimientos de la cuenta</h2></div><div class="panel">' + listaMovimientos(c.movimientos.filter((m) => m.cuenta === 'corriente')) + '</div></section>';
    return html;
  }

  function productoAhorro(c) {
    const tasa = estado.config.tasaAhorroMensual;
    const ganado = c.movimientos.filter((m) => m.tipo === 'interes').reduce((s, m) => s + m.monto, 0);
    const proximo = Math.round((c.saldos.ahorro * tasa) / 100);
    let html = cabezaDetalle('ahorro', 'Cuenta de Ahorro', saldo(c.saldos.ahorro), c.numero + '-A', [
      ['operar', 'mover', 'entrada', 'Guardar'],
      ['operar', 'mover-sacar', 'salida', 'Sacar'],
      ['ir-calculadora', '', 'calculadora', 'Calcular'],
    ]);
    html +=
      '<section class="seccion"><div class="panel datos" style="display:grid">' +
      '<div><small>Tasa de interés</small><strong>' + tasa + '% mensual</strong></div><div><small>Tipo de interés</small><strong>Compuesto</strong></div>' +
      '<div><small>Intereses ganados</small><strong class="positivo">' + esc(dinero(ganado)) + '</strong></div><div><small>Próximo interés</small><strong>' + esc(dinero(proximo)) + '</strong></div></div>' +
      '<p class="ayuda" style="margin-top:8px">El interés se paga cuando tu docente cierra el mes.</p></section>';
    const capital = c.saldos.ahorro || 100000;
    html +=
      '<section class="seccion" id="calculadora"><div class="seccion-titulo"><h2>Calculadora de ahorro</h2></div><div class="panel"><div class="panel-cuerpo formulario" data-calculadora="ahorro">' +
      '<p class="formula">M = C · (1 + i)<sup>n</sup></p>' +
      '<div class="fila-campos">' +
      campo('Capital (C)', '<input name="capital" type="number" min="0" step="0.01" value="' + unidades(capital) + '" />', 'dinero') +
      campo('Meses (n)', '<input name="meses" type="number" min="1" max="60" step="1" value="6" />', 'calendario') +
      '</div><div data-resultado>' + resultadoAhorro(capital, 6) + '</div></div></div></section>';
    html += '<section class="seccion"><div class="seccion-titulo"><h2>Movimientos del ahorro</h2></div><div class="panel">' + listaMovimientos(c.movimientos.filter((m) => m.cuenta === 'ahorro'), 'Todavía no has ahorrado. ¡Empieza hoy!') + '</div></section>';
    return html;
  }

  function resultadoAhorro(capital, meses) {
    const tasa = estado.config.tasaAhorroMensual;
    if (!(capital > 0) || !(meses >= 1)) return '<p class="ayuda">Escribe un capital y una cantidad de meses.</p>';
    const filas = B.proyeccionAhorro(capital, tasa, meses);
    const final = filas[filas.length - 1].saldo;
    return (
      '<div class="resumen">' +
      filaResumen('Capital inicial', esc(dinero(capital))) +
      filaResumen('Intereses ganados', '<span class="positivo">+' + esc(dinero(final - capital)) + '</span>') +
      filaResumen('Tendrás en ' + meses + ' meses', esc(dinero(final)), 'total') +
      '</div><details class="acordeon"><summary class="enlace" style="padding:8px 0">Ver mes a mes</summary><div class="tabla-envoltura"><table><thead><tr><th>Mes</th><th class="num">Interés</th><th class="num">Saldo</th></tr></thead><tbody>' +
      filas.map((f) => '<tr><td>' + f.mes + '</td><td class="num">' + esc(dinero(f.interes)) + '</td><td class="num">' + esc(dinero(f.saldo)) + '</td></tr>').join('') +
      '</tbody></table></div></details>'
    );
  }

  function productoPrestamo(c, p) {
    const r = B.resumenPrestamo(p);
    const avance = Math.round((p.cuotasPagadas / p.plazo) * 100);
    let html = cabezaDetalle(
      'prestamo',
      'Préstamo personal',
      saldo(r.saldoPendiente),
      null,
      [
        ['operar', 'cuota', 'pagos', 'Pagar cuota'],
        ['operar', 'transferencia', 'transferir', 'Transferir'],
        ['ir', 'movimientos', 'reloj', 'Historial'],
      ],
      '<div class="progreso"><span style="width:' + avance + '%"></span></div><small>' + p.cuotasPagadas + ' de ' + p.plazo + ' cuotas pagadas</small>'
    );
    if (r.cuotasAtrasadas) html += '<div class="seccion"><div class="aviso-banner rojo">' + I('alerta') + '<span>Tienes ' + r.cuotasAtrasadas + ' cuota(s) atrasada(s).</span></div></div>';
    html +=
      '<section class="seccion"><div class="panel datos" style="display:grid">' +
      '<div><small>Monto prestado</small><strong>' + esc(dinero(p.monto)) + '</strong></div><div><small>Tasa</small><strong>' + p.tasa + '% mensual</strong></div>' +
      '<div><small>Cuota fija</small><strong>' + esc(dinero(r.cuota)) + '</strong></div><div><small>Plazo</small><strong>' + p.plazo + ' meses</strong></div>' +
      '<div><small>Total a pagar</small><strong>' + esc(dinero(r.totalPagar)) + '</strong></div><div><small>Total de intereses</small><strong class="negativo">' + esc(dinero(r.totalIntereses)) + '</strong></div>' +
      '</div>' + (p.motivo ? '<p class="ayuda" style="margin-top:8px">Motivo: «' + esc(p.motivo) + '»</p>' : '') + '</section>';
    html += '<section class="seccion"><div class="seccion-titulo"><h2>Tabla de amortización</h2></div><div class="panel">' + tablaAmortizacion(p.tabla, p.cuotasPagadas) + '</div></section>';
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
    let html = '<header class="barra-superior"><h1 style="margin-right:0">Pagos</h1></header>';
    html += '<section class="seccion"><div class="seccion-titulo"><h2>Mis préstamos</h2></div><div class="panel">';
    if (r.activos.length) {
      html += r.activos
        .map((p) => {
          const rp = B.resumenPrestamo(p);
          return (
            '<button class="item" data-accion="operar" data-valor="cuota"><span class="item-icono morado">' + I('prestamo') + '</span>' +
            '<span class="item-texto"><strong>Préstamo personal</strong><small>Cuota ' + (p.cuotasPagadas + 1) + ' de ' + p.plazo + (rp.cuotasAtrasadas ? ' · <span class="negativo">' + rp.cuotasAtrasadas + ' atrasada(s)</span>' : '') + '</small></span>' +
            '<span class="item-monto">' + esc(dinero(rp.proximaCuota)) + '</span>' + I('flecha') + '</button>'
          );
        })
        .join('');
    } else {
      html += '<div class="vacio">' + I('check') + '<p>No tienes préstamos por pagar.</p></div>';
    }
    html += '</div></section>';
    html +=
      '<section class="seccion"><div class="seccion-titulo"><h2>Pago de servicios</h2></div><div class="panel">' +
      SERVICIOS.map(
        ([s, ico]) =>
          '<button class="item" data-accion="operar" data-valor="servicio" data-servicio="' + esc(s) + '"><span class="item-icono oro">' + I(ico) + '</span>' +
          '<span class="item-texto"><strong>' + esc(s) + '</strong><small>Pago simulado</small></span>' + I('flecha') + '</button>'
      ).join('') +
      '</div></section>';
    return html;
  }

  function pPrestamos(c) {
    const r = resumenCliente(c);
    const cfg = estado.config;
    let html = '<header class="barra-superior"><h1 style="margin-right:0">Préstamos</h1></header>';
    if (r.solicitud) {
      html += '<div class="seccion"><div class="aviso-banner azul">' + I('reloj') + '<span>Tu solicitud por <strong>' + esc(dinero(r.solicitud.monto)) + '</strong> a ' + r.solicitud.plazo + ' meses está en revisión.</span></div></div>';
    }
    if (r.activos.length) {
      html += '<section class="seccion"><div class="seccion-titulo"><h2>Mis préstamos</h2></div><div class="panel">';
      html += r.activos
        .map((p) => {
          const rp = B.resumenPrestamo(p);
          return (
            '<button class="item" data-accion="producto" data-valor="' + esc(p.id) + '"><span class="item-icono morado">' + I('prestamo') + '</span>' +
            '<span class="item-texto"><strong>Préstamo de ' + esc(dinero(p.monto)) + '</strong><small>' + p.cuotasPagadas + ' de ' + p.plazo + ' cuotas · ' + p.tasa + '% mensual</small>' +
            '<div class="progreso claro" style="margin:8px 0 0;height:6px"><span style="width:' + Math.round((p.cuotasPagadas / p.plazo) * 100) + '%;background:var(--morado)"></span></div></span>' +
            '<span class="item-monto">' + saldo(rp.saldoPendiente) + '<small>pendiente</small></span></button>'
          );
        })
        .join('');
      html += '</div></section>';
    }
    const pagados = c.prestamos.filter((p) => B.resumenPrestamo(p).terminado);
    html +=
      '<section class="seccion"><div class="panel"><div class="panel-cuerpo formulario">' +
      '<div class="cabecera-fila"><span class="item-icono morado">' + I('calculadora') + '</span><div><h2 style="font-size:1.05rem">Préstamo personal</h2><p class="ayuda">Cuota fija mensual (sistema francés)</p></div></div>' +
      '<div class="datos" style="border-radius:14px;overflow:hidden;border:1px solid var(--borde)">' +
      '<div><small>Tasa</small><strong>' + cfg.tasaPrestamoMensual + '% mensual</strong></div><div><small>Hasta</small><strong>' + esc(dinero(cfg.montoMaximoPrestamo)) + '</strong></div>' +
      '<div><small>Plazos</small><strong>' + cfg.plazosPrestamo.join(', ') + ' meses</strong></div><div><small>Aprobación</small><strong>Docente</strong></div></div>' +
      (r.activos.length || r.solicitud
        ? '<p class="ayuda">Podrás pedir otro préstamo cuando termines de pagar el actual.</p>'
        : '<button class="boton" data-accion="operar" data-valor="solicitud">' + I('mas1') + 'Solicitar préstamo</button>') +
      '</div></div></section>';
    if (pagados.length) {
      html +=
        '<section class="seccion"><div class="seccion-titulo"><h2>Préstamos pagados</h2></div><div class="panel">' +
        pagados.map((p) => '<div class="item"><span class="item-icono verde">' + I('check') + '</span><span class="item-texto"><strong>Préstamo de ' + esc(dinero(p.monto)) + '</strong><small>' + p.plazo + ' meses · Pagado</small></span></div>').join('') +
        '</div></section>';
    }
    return html;
  }

  function pMas(c) {
    const cfg = estado.config;
    const aprende = [
      ['¿Qué es el interés?', 'porcentaje', 'El <strong>interés</strong> es el precio del dinero en el tiempo. Cuando ahorras, el banco te paga interés. Cuando pides prestado, tú le pagas interés al banco.'],
      ['Interés compuesto (ahorro)', 'alcancia', 'Cada mes ganas interés sobre tu saldo <strong>y también sobre los intereses anteriores</strong>. Fórmula: <span class="formula" style="display:block;margin-top:6px">M = C · (1 + i)<sup>n</sup></span>Ejemplo: ' + esc(dinero(100000)) + ' al ' + cfg.tasaAhorroMensual + '% por 12 meses = <strong>' + esc(dinero(B.proyeccionAhorro(100000, cfg.tasaAhorroMensual, 12)[11].saldo)) + '</strong>.'],
      ['Cuota fija (préstamos)', 'calculadora', 'En el sistema francés pagas <strong>la misma cuota todos los meses</strong>. Al principio pagas más interés y al final más capital. <span class="formula" style="display:block;margin-top:6px">Cuota = P · i ÷ (1 − (1 + i)<sup>−n</sup>)</span>'],
      ['Regla 50/30/20', 'grafica', 'Una forma sencilla de organizar tu dinero: <strong>50%</strong> para necesidades, <strong>30%</strong> para gustos y <strong>20%</strong> para ahorrar.'],
      ['Seguridad', 'escudo', 'Tu clave es personal. <strong>Nunca la compartas</strong>, ni siquiera con amigos. Un banco real nunca te pedirá tu clave por mensaje o llamada.'],
    ];
    let html =
      '<section class="perfil"><span class="avatar">' + iniciales(c.nombre) + '</span><div><strong style="font-size:1.1rem">' + esc(c.nombre) + '</strong><br><small>Cuenta ' + esc(c.numero) + ' · Cliente desde el mes ' + c.creadoMes + '</small></div></section>';
    html +=
      '<section class="seccion"><div class="seccion-titulo"><h2>Mi cuenta</h2></div><div class="panel">' +
      '<button class="item" data-accion="ir" data-valor="movimientos"><span class="item-icono">' + I('reloj') + '</span><span class="item-texto"><strong>Historial de movimientos</strong><small>Todas tus operaciones</small></span>' + I('flecha') + '</button>' +
      '<button class="item" data-accion="operar" data-valor="clave"><span class="item-icono">' + I('llave') + '</span><span class="item-texto"><strong>Cambiar clave</strong><small>Tu clave de 4 números</small></span>' + I('flecha') + '</button>' +
      '<button class="item" data-accion="ocultar"><span class="item-icono">' + I(ui.ocultar ? 'ojoCerrado' : 'ojo') + '</span><span class="item-texto"><strong>' + (ui.ocultar ? 'Mostrar saldos' : 'Ocultar saldos') + '</strong><small>Privacidad en pantalla</small></span>' + I('flecha') + '</button>' +
      '</div></section>';
    html +=
      '<section class="seccion"><div class="seccion-titulo"><h2>Educación financiera</h2></div><div class="panel">' +
      aprende.map(([t, ico, txt]) => '<details class="acordeon"><summary class="item"><span class="item-icono oro">' + I(ico) + '</span><span class="item-texto"><strong>' + t + '</strong></span>' + I('flecha') + '</summary><div class="acordeon-cuerpo"><p>' + txt + '</p></div></details>').join('') +
      '</div></section>';
    html +=
      '<section class="seccion"><div class="seccion-titulo"><h2>Tarifas y tasas</h2></div><div class="panel"><div class="panel-cuerpo resumen">' +
      filaResumen('Interés del ahorro', cfg.tasaAhorroMensual + '% mensual') +
      filaResumen('Interés de préstamos', cfg.tasaPrestamoMensual + '% mensual') +
      filaResumen('Préstamo máximo', esc(dinero(cfg.montoMaximoPrestamo))) +
      filaResumen('Comisión por transferencias', esc(dinero(0))) +
      '</div></div></section>';
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
          campo('Concepto', '<input name="concepto" maxlength="60" placeholder="Ej.: pago de merienda" value="' + esc(d.concepto || '') + '" />', 'pagos')
        );
      },
      leer(c, d) {
        if (!d.destino) throw new B.ErrorBanco('Elige a quién le vas a transferir.');
        const monto = leerMonto(d);
        exigirSaldo(monto, c.saldos.corriente);
        return { destino: d.destino, monto, concepto: (d.concepto || '').trim() };
      },
      resumen(c, d) {
        const para = B.buscarCliente(estado, d.destino);
        return [
          ['Desde', 'Cuenta Corriente ' + mascara(c.numero)],
          ['Para', esc(para.nombre) + '<br><small class="ayuda">Cuenta ' + esc(para.numero) + '</small>'],
          ['Concepto', esc(d.concepto || '—')],
          ['Comisión', esc(dinero(0))],
          ['Total a debitar', esc(dinero(d.monto)), 'total'],
        ];
      },
      ejecutar(c, d) {
        const para = B.buscarCliente(estado, d.destino);
        B.transferir(estado, c.numero, d.destino, d.monto, d.concepto);
        return { titulo: '¡Transferencia exitosa!', importe: d.monto, filas: [['Para', esc(para.nombre)], ['Cuenta destino', esc(para.numero)], ['Concepto', esc(d.concepto || '—')]] };
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
        return campoMontoGrande(d.monto, c.saldos.corriente);
      },
      leer(c, d) {
        const monto = leerMonto(d);
        exigirSaldo(monto, c.saldos.corriente);
        return { monto };
      },
      resumen(c, d) {
        return [['Cuenta', 'Corriente ' + mascara(c.numero)], ['Saldo después', esc(dinero(c.saldos.corriente - d.monto))], ['Monto', esc(dinero(d.monto)), 'total']];
      },
      ejecutar(c, d) {
        B.retirar(estado, c.numero, d.monto);
        return { titulo: '¡Retiro exitoso!', importe: d.monto, nota: 'Recibe tus billetes didácticos con el cajero del aula.', filas: [['Nuevo saldo', esc(dinero(c.saldos.corriente))]] };
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
          filaResumen('Total de la cuota', esc(dinero(fila.cuota)), 'total') +
          '</div></div><p class="disponible">Disponible en tu cuenta corriente: <strong>' + esc(dinero(c.saldos.corriente)) + '</strong></p>'
        );
      },
      leer(c, d) {
        const p = c.prestamos.find((x) => x.id === d.prestamo);
        if (!p) throw new B.ErrorBanco('No tienes préstamos por pagar.');
        exigirSaldo(B.resumenPrestamo(p).proximaCuota, c.saldos.corriente);
        return { prestamo: p.id, monto: B.resumenPrestamo(p).proximaCuota };
      },
      resumen(c, d) {
        const p = c.prestamos.find((x) => x.id === d.prestamo);
        return [['Préstamo', 'Personal · ' + esc(dinero(p.monto))], ['Cuota', (p.cuotasPagadas + 1) + ' de ' + p.plazo], ['Desde', 'Cuenta Corriente ' + mascara(c.numero)], ['Total a pagar', esc(dinero(d.monto)), 'total']];
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
      pregunta: '¿Cuánto dinero necesitas?',
      datos(c, d) {
        const cfg = estado.config;
        const r = resumenCliente(c);
        if (r.activos.length) return '<div class="vacio">' + I('info') + '<p>Primero debes terminar de pagar tu préstamo actual.</p></div>';
        if (r.solicitud) return '<div class="vacio">' + I('reloj') + '<p>Ya tienes una solicitud esperando respuesta de tu docente.</p></div>';
        const plazo = Number(d.plazo) || cfg.plazosPrestamo[Math.min(1, cfg.plazosPrestamo.length - 1)];
        return (
          campoMontoGrande(d.monto) +
          '<p class="disponible">Máximo: <strong>' + esc(dinero(cfg.montoMaximoPrestamo)) + '</strong> · Tasa ' + cfg.tasaPrestamoMensual + '% mensual</p>' +
          '<div class="campo"><span>Plazo</span><div class="segmentos">' +
          cfg.plazosPrestamo.map((p) => '<span><input type="radio" id="plazo-' + p + '" name="plazo" value="' + p + '"' + (p === plazo ? ' checked' : '') + ' /><label for="plazo-' + p + '" style="display:block">' + p + ' meses</label></span>').join('') +
          '</div></div>' +
          '<div data-preview="prestamo">' + vistaPreviaPrestamo(d.monto ? B.aCentavos(d.monto) : 0, plazo) + '</div>' +
          campo('¿Para qué lo necesitas?', '<input name="motivo" maxlength="80" placeholder="Ej.: materiales para mi proyecto" value="' + esc(d.motivo || '') + '" />', 'info')
        );
      },
      leer(c, d) {
        const r = resumenCliente(c);
        if (r.activos.length) throw new B.ErrorBanco('Primero debes terminar de pagar tu préstamo actual.');
        if (r.solicitud) throw new B.ErrorBanco('Ya tienes una solicitud esperando respuesta.');
        const monto = leerMonto(d);
        if (monto > estado.config.montoMaximoPrestamo) throw new B.ErrorBanco('El monto máximo es ' + dinero(estado.config.montoMaximoPrestamo) + '.');
        return { monto, plazo: Number(d.plazo), motivo: (d.motivo || '').trim() };
      },
      resumen(c, d) {
        const tabla = B.tablaAmortizacion(d.monto, estado.config.tasaPrestamoMensual, d.plazo);
        const total = tabla.reduce((s, f) => s + f.cuota, 0);
        return [
          ['Monto solicitado', esc(dinero(d.monto))],
          ['Plazo', d.plazo + ' meses'],
          ['Tasa', estado.config.tasaPrestamoMensual + '% mensual'],
          ['Total de intereses', '<span class="negativo">' + esc(dinero(total - d.monto)) + '</span>'],
          ['Total a pagar', esc(dinero(total))],
          ['Cuota mensual', esc(dinero(tabla[0].cuota)), 'total'],
        ];
      },
      ejecutar(c, d) {
        B.solicitarPrestamo(estado, c.numero, d.monto, d.plazo, d.motivo);
        return {
          titulo: '¡Solicitud enviada!',
          azul: true,
          importe: d.monto,
          nota: 'Tu docente revisará la solicitud. Cuando la apruebe, el dinero llegará a tu cuenta corriente.',
          filas: [['Plazo', d.plazo + ' meses'], ['Motivo', esc(d.motivo || '—')]],
          sinReferencia: true,
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

  function vistaPreviaPrestamo(monto, plazo) {
    const cfg = estado.config;
    if (!(monto > 0) || !plazo) return '<div class="aviso-banner azul">' + I('calculadora') + '<span>Escribe un monto para ver tu cuota mensual.</span></div>';
    const tabla = B.tablaAmortizacion(monto, cfg.tasaPrestamoMensual, plazo);
    const total = tabla.reduce((s, f) => s + f.cuota, 0);
    return (
      '<div class="panel"><div class="datos">' +
      '<div><small>Cuota mensual</small><strong>' + esc(dinero(tabla[0].cuota)) + '</strong></div>' +
      '<div><small>Total a pagar</small><strong>' + esc(dinero(total)) + '</strong></div>' +
      '<div><small>Intereses</small><strong class="negativo">' + esc(dinero(total - monto)) + '</strong></div>' +
      '<div><small>Plazo</small><strong>' + plazo + ' meses</strong></div></div>' +
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
        '<button class="boton" data-accion="terminar-op">Volver al inicio</button></div>';
    }
    return html;
  }

  function abrirOperacion(tipo, inicial) {
    if (tipo === 'mover-sacar') {
      tipo = 'mover';
      inicial = 'sacar';
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
    let html = cabezaEscritorio('Resumen del banco', 'Mes ' + estado.mes + ' · ' + t.clientes + ' cliente(s)', '<button class="boton chico" data-accion="seccion" data-valor="mes">' + I('calendario') + 'Cerrar el mes ' + estado.mes + '</button>');
    html +=
      '<div class="kpis">' +
      kpi('usuarios', '', 'Clientes', String(t.clientes)) +
      kpi('tarjeta', 'verde', 'En cuentas corrientes', esc(dinero(t.corriente))) +
      kpi('alcancia', 'turquesa', 'Ahorrado', esc(dinero(t.ahorro))) +
      kpi('prestamo', 'morado', 'Préstamos por cobrar', esc(dinero(t.deuda))) +
      '</div>';

    const atencion = [];
    estado.solicitudes.forEach((s) => {
      const c = estado.clientes.find((x) => x.numero === s.numero);
      atencion.push('<button class="item" data-accion="seccion" data-valor="solicitudes"><span class="item-icono oro">' + I('prestamo') + '</span><span class="item-texto"><strong>' + esc(c ? c.nombre : s.numero) + ' pide un préstamo</strong><small>' + esc(dinero(s.monto)) + ' a ' + s.plazo + ' meses</small></span>' + I('flecha') + '</button>');
    });
    estado.clientes.forEach((c) => {
      const r = resumenCliente(c);
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
        '<div><small>Debe</small><strong>' + esc(dinero(r.deuda)) + '</strong></div><div><small>Movimientos</small><strong>' + sel.movimientos.length + '</strong></div></div>' +
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
      const tabla = B.tablaAmortizacion(s.monto, s.tasa, s.plazo);
      const total = tabla.reduce((t, f) => t + f.cuota, 0);
      html +=
        '<section class="tarjeta"><div class="tarjeta-cabeza"><div class="cabecera-fila"><span class="avatar">' + iniciales(c ? c.nombre : '?') + '</span><div><h2>' + esc(c ? c.nombre : s.numero) + '</h2><p class="ayuda">Solicitado en el mes ' + s.mes + '</p></div></div><span class="etiqueta oro">Pendiente</span></div>' +
        '<div class="tarjeta-cuerpo resumen">' +
        filaResumen('Monto', esc(dinero(s.monto))) +
        filaResumen('Plazo y tasa', s.plazo + ' meses al ' + s.tasa + '%') +
        filaResumen('Cuota mensual', esc(dinero(tabla[0].cuota))) +
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
      '<div class="item"><span class="item-icono morado">' + I('prestamo') + '</span><span class="item-texto"><strong>Cobra la cuota de cada préstamo</strong><small>desde la cuenta corriente; si no hay saldo, la cuota queda atrasada</small></span></div>' +
      '<button class="boton" style="max-width:320px" data-accion="cerrar-mes">' + I('calendario') + 'Cerrar el mes ' + estado.mes + '</button></div></section>';
    if (estado.historialMeses.length) {
      html +=
        '<section class="tarjeta"><div class="tarjeta-cabeza"><h2>Meses cerrados</h2></div><div class="tabla-envoltura"><table><thead><tr><th>Mes</th><th class="num">Intereses pagados</th><th class="num">Cuotas cobradas</th><th>Cuotas sin pagar</th></tr></thead><tbody>' +
        estado.historialMeses
          .map((r) => '<tr><td>' + r.mes + '</td><td class="num">' + esc(dinero(r.interesesPagados)) + '</td><td class="num">' + r.cuotasCobradas + '</td><td>' + (r.cuotasSinPagar.length ? r.cuotasSinPagar.map((x) => esc(x.nombre) + ' (' + x.atrasadas + ')').join(', ') : '—') + '</td></tr>')
          .join('') +
        '</tbody></table></div></section>';
    }
    return html;
  }

  function dAjustes() {
    const cfg = estado.config;
    const num = (n, v, extra) => '<input name="' + n + '" type="number" required value="' + v + '" ' + (extra || '') + ' />';
    return (
      cabezaEscritorio('Ajustes', 'Reglas del banco y copias de seguridad.') +
      '<section class="tarjeta"><div class="tarjeta-cabeza"><h2>Reglas del banco</h2></div><form class="tarjeta-cuerpo formulario" data-form="config">' +
      '<div class="fila-campos">' +
      campo('Nombre del banco', '<input name="nombreBanco" maxlength="30" required value="' + esc(cfg.nombreBanco) + '" />', 'prestamo') +
      campo('Símbolo de la moneda', '<input name="simbolo" maxlength="4" required value="' + esc(cfg.simbolo) + '" />', 'dinero') +
      campo('Depósito de apertura', num('saldoInicial', unidades(cfg.saldoInicial), 'min="0" step="0.01"'), 'estrella') +
      campo('Préstamo máximo', num('montoMaximoPrestamo', unidades(cfg.montoMaximoPrestamo), 'min="0" step="0.01"'), 'prestamo') +
      campo('Interés del ahorro (% mensual)', num('tasaAhorroMensual', cfg.tasaAhorroMensual, 'min="0" max="100" step="0.01"'), 'porcentaje') +
      campo('Interés de préstamos (% mensual)', num('tasaPrestamoMensual', cfg.tasaPrestamoMensual, 'min="0" max="100" step="0.01"'), 'porcentaje') +
      campo('Plazos (meses, separados por coma)', '<input name="plazosPrestamo" required value="' + esc(cfg.plazosPrestamo.join(', ')) + '" />', 'calendario') +
      campo('Clave de docente', '<input class="pin" name="pinDocente" inputmode="numeric" maxlength="4" required value="' + esc(cfg.pinDocente) + '" />', 'llave') +
      '</div><div class="aviso-banner azul">' + I('info') + '<span>Los cambios de tasa aplican a préstamos nuevos. Los préstamos ya aprobados mantienen su tasa.</span></div>' +
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
      operar(
        () =>
          B.actualizarConfig(estado, {
            nombreBanco: d.nombreBanco.trim(),
            simbolo: d.simbolo.trim(),
            saldoInicial: B.aCentavos(d.saldoInicial),
            montoMaximoPrestamo: B.aCentavos(d.montoMaximoPrestamo),
            tasaAhorroMensual: Number(d.tasaAhorroMensual),
            tasaPrestamoMensual: Number(d.tasaPrestamoMensual),
            plazosPrestamo: d.plazosPrestamo.split(/[,;\s]+/).filter(Boolean).map(Number).sort((a, b) => a - b),
            pinDocente: d.pinDocente,
          }),
        'Reglas guardadas.'
      );
    },
  };

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
    'atras-op'() {
      if (ui.op.paso === 'confirmar') {
        ui.op.paso = 'datos';
        pintar(true);
      } else {
        irA(ui.op.volver || 'inicio');
      }
    },
    'terminar-op'() {
      irA('inicio');
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
      const ok = await hoja({ icono: 'calendario', titulo: '¿Cerrar el mes ' + estado.mes + '?', texto: 'Se pagarán los intereses del ahorro y se cobrarán las cuotas de los préstamos.', ok: 'Cerrar mes' });
      if (!ok) return;
      operar(
        () => B.avanzarMes(estado),
        (r) => 'Mes ' + r.mes + ' cerrado: ' + dinero(r.interesesPagados) + ' en intereses, ' + r.cuotasCobradas + ' cuota(s) cobrada(s).'
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
    const calc = t.closest('[data-calculadora="ahorro"]');
    if (calc) {
      let capital = 0;
      try {
        capital = B.aCentavos(calc.querySelector('[name=capital]').value);
      } catch (err) {
        capital = 0;
      }
      const meses = Math.min(60, parseInt(calc.querySelector('[name=meses]').value, 10) || 0);
      calc.querySelector('[data-resultado]').innerHTML = resultadoAhorro(capital, meses);
    }
  });

  document.addEventListener('change', (e) => {
    const t = e.target;
    if (t.closest('form[data-form="op-datos"]') && ui.op && ui.op.tipo === 'solicitud') actualizarVistaPrevia(t.form);
    if (t.hasAttribute('data-importar') && t.files[0]) importarArchivo(t);
  });

  document.addEventListener('input', (e) => {
    const form = e.target.form;
    if (form && form.dataset.form === 'op-datos' && ui.op && ui.op.tipo === 'solicitud') actualizarVistaPrevia(form);
  });

  function actualizarVistaPrevia(form) {
    const caja = form.querySelector('[data-preview="prestamo"]');
    if (!caja) return;
    let monto = 0;
    try {
      monto = B.aCentavos(form.monto.value);
    } catch (err) {
      monto = 0;
    }
    const plazo = Number((form.querySelector('input[name=plazo]:checked') || {}).value);
    caja.innerHTML = vistaPreviaPrestamo(monto, plazo);
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
