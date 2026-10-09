// Pruebas de la lógica del banco. Ejecutar con: node --test tests/
const test = require('node:test');
const assert = require('node:assert/strict');
const B = require('../js/banco.js');

const SIN_CARGOS = {
  cargoMantenimiento: 0,
  comisionRetiro: 0,
  comisionTransferencia: 0,
  impuestoTransaccion: 0,
  comisionApertura: 0,
  cargoMoraPrestamo: 0,
  cuotaEmisionTarjeta: 0,
};

/** Banco con dos clientes y sin comisiones, para probar las reglas básicas. */
function bancoConDos(conCargos) {
  const e = B.estadoInicial();
  if (!conCargos) Object.assign(e.config, SIN_CARGOS);
  const ana = B.crearCliente(e, { nombre: 'Ana', pin: '1111' });
  const luis = B.crearCliente(e, { nombre: 'Luis', pin: '2222' });
  return { e, ana, luis };
}

test('apertura de cuenta con número y saldo inicial', () => {
  const { e, ana, luis } = bancoConDos();
  assert.equal(ana.numero, '4A-001');
  assert.equal(luis.numero, '4A-002');
  assert.equal(ana.saldos.corriente, 100000);
  assert.equal(ana.movimientos[0].tipo, 'apertura');
  assert.throws(() => B.crearCliente(e, { nombre: 'ana', pin: '3333' }), /Ya existe/);
  assert.throws(() => B.crearCliente(e, { nombre: 'Eva', pin: '12' }), /PIN/);
});

test('autenticación', () => {
  const { e } = bancoConDos();
  assert.equal(B.autenticar(e, '4A-001', '1111').nombre, 'Ana');
  assert.throws(() => B.autenticar(e, '4A-001', '9999'), /incorrectos/);
});

test('aCentavos acepta punto o coma y rechaza texto', () => {
  assert.equal(B.aCentavos('150.50'), 15050);
  assert.equal(B.aCentavos('150,5'), 15050);
  assert.equal(B.aCentavos(0.1 + 0.2), 30);
  assert.throws(() => B.aCentavos('abc'));
  assert.throws(() => B.aCentavos(''));
});

test('depósitos y retiros', () => {
  const { e } = bancoConDos();
  B.depositar(e, '4A-001', 5000);
  assert.equal(B.buscarCliente(e, '4A-001').saldos.corriente, 105000);
  B.retirar(e, '4A-001', 105000);
  assert.equal(B.buscarCliente(e, '4A-001').saldos.corriente, 0);
  assert.throws(() => B.retirar(e, '4A-001', 1), /insuficiente/);
  assert.throws(() => B.depositar(e, '4A-001', -5), /mayor que cero/);
});

test('transferencias mueven el dinero entre cuentas', () => {
  const { e, ana, luis } = bancoConDos();
  B.transferir(e, ana.numero, luis.numero, 25000, 'merienda');
  assert.equal(ana.saldos.corriente, 75000);
  assert.equal(luis.saldos.corriente, 125000);
  assert.match(luis.movimientos[0].descripcion, /de Ana.*merienda/);
  assert.throws(() => B.transferir(e, ana.numero, ana.numero, 1), /propia/);
  assert.throws(() => B.transferir(e, ana.numero, luis.numero, 999999), /insuficiente/);
  assert.throws(() => B.transferir(e, ana.numero, '4A-999', 1), /No existe/);
});

test('ahorro con interés compuesto al cerrar el mes', () => {
  const { e, ana } = bancoConDos();
  B.guardarEnAhorro(e, ana.numero, 100000);
  assert.equal(ana.saldos.corriente, 0);
  B.avanzarMes(e); // 1% de 1000 = 10
  B.avanzarMes(e); // 1% de 1010 = 10.10
  assert.equal(ana.saldos.ahorro, 102010);
  assert.equal(e.mes, 3);
  const proy = B.proyeccionAhorro(100000, 1, 2);
  assert.equal(proy[1].saldo, 102010);
  B.sacarDeAhorro(e, ana.numero, 2010);
  assert.equal(ana.saldos.corriente, 2010);
  assert.throws(() => B.sacarDeAhorro(e, ana.numero, 999999), /ahorro/);
});

test('cuota fija y tabla de amortización cuadran', () => {
  // 1000 a 2% mensual en 6 meses → cuota 178.53
  assert.equal(B.cuotaFija(100000, 2, 6), 17853);
  assert.equal(B.cuotaFija(60000, 0, 6), 10000);
  const tabla = B.tablaAmortizacion(100000, 2, 6);
  assert.equal(tabla.length, 6);
  assert.equal(tabla[0].interes, 2000);
  assert.equal(tabla[5].saldo, 0);
  assert.equal(tabla.reduce((s, f) => s + f.capital, 0), 100000);
});

test('ciclo completo de préstamo: solicitud, aprobación y cobro mensual', () => {
  const { e, ana } = bancoConDos();
  assert.throws(() => B.solicitarPrestamo(e, ana.numero, 999999, 3), /máximo/);
  assert.throws(() => B.solicitarPrestamo(e, ana.numero, 30000, 5), /plazo/);
  const s = B.solicitarPrestamo(e, ana.numero, 30000, 3, 'bicicleta');
  assert.throws(() => B.solicitarPrestamo(e, ana.numero, 30000, 3), /esperando/);
  const p = B.aprobarPrestamo(e, s.id);
  assert.equal(ana.saldos.corriente, 130000);
  assert.equal(e.solicitudes.length, 0);
  assert.throws(() => B.solicitarPrestamo(e, ana.numero, 1000, 3), /terminar/);

  const totalPagar = B.resumenPrestamo(p).totalPagar;
  B.avanzarMes(e);
  B.avanzarMes(e);
  B.avanzarMes(e);
  B.avanzarMes(e); // un mes extra no cobra nada más
  const r = B.resumenPrestamo(p);
  assert.ok(r.terminado);
  assert.equal(r.saldoPendiente, 0);
  assert.equal(ana.saldos.corriente, 130000 - totalPagar);
});

test('cuotas atrasadas cuando no hay saldo y pago manual', () => {
  const { e, ana, luis } = bancoConDos();
  const p = B.aprobarPrestamo(e, B.solicitarPrestamo(e, ana.numero, 60000, 3).id);
  B.transferir(e, ana.numero, luis.numero, ana.saldos.corriente);
  const resumen = B.avanzarMes(e);
  assert.equal(resumen.cuotasSinPagar.length, 1);
  assert.equal(B.resumenPrestamo(p).cuotasAtrasadas, 1);
  assert.throws(() => B.pagarCuota(e, ana.numero, p.id), /saldo suficiente/);
  B.depositar(e, ana.numero, 100000);
  B.pagarCuota(e, ana.numero, p.id);
  assert.equal(B.resumenPrestamo(p).cuotasAtrasadas, 0);
  assert.equal(p.cuotasPagadas, 1);
});

test('pagar por adelantado no cobra doble el mes siguiente', () => {
  const { e, ana } = bancoConDos();
  const p = B.aprobarPrestamo(e, B.solicitarPrestamo(e, ana.numero, 30000, 3).id);
  B.pagarCuota(e, ana.numero, p.id);
  B.avanzarMes(e);
  assert.equal(p.cuotasPagadas, 1);
  B.avanzarMes(e);
  assert.equal(p.cuotasPagadas, 2);
});

test('rechazar préstamo y eliminar cliente', () => {
  const { e, ana } = bancoConDos();
  const s = B.solicitarPrestamo(e, ana.numero, 10000, 3);
  B.rechazarPrestamo(e, s.id);
  assert.equal(e.solicitudes.length, 0);
  B.solicitarPrestamo(e, ana.numero, 10000, 3);
  B.eliminarCliente(e, ana.numero);
  assert.equal(e.clientes.length, 1);
  assert.equal(e.solicitudes.length, 0);
});

test('configuración validada', () => {
  const e = B.estadoInicial();
  B.actualizarConfig(e, { tasaAhorroMensual: 1.5, pinDocente: '4321' });
  assert.throws(() => B.actualizarConfig(e, { tasaCompraUSD: 70 }), /compra/);
  assert.throws(() => B.actualizarConfig(e, { limiteTarjeta: -1 }), /negativos/);
  assert.equal(e.config.tasaAhorroMensual, 1.5);
  assert.throws(() => B.actualizarConfig(e, { tasaPrestamoMensual: -1 }), /tasas/);
  assert.throws(() => B.actualizarConfig(e, { pinDocente: 'abc' }), /PIN/);
  assert.throws(() => B.actualizarConfig(e, { plazosPrestamo: [] }), /plazos/);
  assert.equal(e.config.pinDocente, '4321');
});

test('exportar e importar copia de seguridad', () => {
  const { e } = bancoConDos();
  const copia = B.importar(B.exportar(e));
  assert.deepEqual(copia, e);
  assert.throws(() => B.importar('{"hola":1}'), /C4pital/);
  assert.throws(() => B.importar('no es json'), /válida/);
});

test('totales del banco', () => {
  const { e, ana } = bancoConDos();
  B.guardarEnAhorro(e, ana.numero, 40000);
  const t = B.totales(e);
  assert.equal(t.corriente, 160000);
  assert.equal(t.ahorro, 40000);
  assert.equal(t.clientes, 2);
});

test('pago de servicios', () => {
  const { e, ana } = bancoConDos();
  B.pagarServicio(e, ana.numero, 15000, 'Luz', '123');
  assert.equal(ana.saldos.corriente, 85000);
  assert.equal(ana.movimientos[0].tipo, 'pago');
  assert.match(ana.movimientos[0].descripcion, /Luz.*123/);
  assert.throws(() => B.pagarServicio(e, ana.numero, 999999, 'Agua'), /insuficiente/);
  assert.throws(() => B.pagarServicio(e, ana.numero, 100, ''), /servicio/);
});

test('comisiones e impuesto en transferencias y retiros', () => {
  const { e, ana, luis } = bancoConDos(true);
  const cargos = B.cargosDe(e, 'transferencia', 20000);
  assert.deepEqual(cargos.map((c) => c.monto), [500, 30]); // ₵5 + 0.15% de ₵200
  B.transferir(e, ana.numero, luis.numero, 20000);
  assert.equal(ana.saldos.corriente, 100000 - 20000 - 530);
  assert.equal(luis.saldos.corriente, 120000);
  B.retirar(e, luis.numero, 10000, null, true);
  assert.equal(luis.saldos.corriente, 120000 - 10000 - 1000 - 15);
  B.retirar(e, luis.numero, 10000, 'Multa del docente'); // sin cargos
  assert.equal(luis.saldos.corriente, 120000 - 21015);
  assert.throws(() => B.transferir(e, ana.numero, luis.numero, ana.saldos.corriente), /cargos/);
  const ing = B.ingresosBanco(e);
  assert.equal(ing.comisiones, 1500);
  assert.equal(ing.impuestos, 45);
});

test('mantenimiento de cuenta al cerrar el mes', () => {
  const { e, ana, luis } = bancoConDos(true);
  B.retirar(e, ana.numero, 70000); // queda ₵300 < ₵500
  const r = B.avanzarMes(e);
  assert.equal(ana.saldos.corriente, 30000 - 2500);
  assert.equal(luis.saldos.corriente, 100000);
  assert.equal(r.cargosCobrados, 2500);
});

test('préstamo con comisión de apertura, sistema alemán y mora', () => {
  const { e, ana } = bancoConDos(true);
  const s = B.solicitarPrestamo(e, ana.numero, 60000, 3, 'libros', 'educativo', 'aleman');
  assert.equal(s.tasa, 1.5);
  const p = B.aprobarPrestamo(e, s.id);
  assert.equal(ana.saldos.corriente, 100000 + 60000 - 1200);
  assert.deepEqual(p.tabla.map((f) => f.capital), [20000, 20000, 20000]);
  assert.deepEqual(p.tabla.map((f) => f.cuota), [20900, 20600, 20300]);
  // Sin saldo: la cuota queda atrasada y se acumula mora.
  B.retirar(e, ana.numero, ana.saldos.corriente);
  B.avanzarMes(e);
  assert.equal(B.resumenPrestamo(p).mora, 5000);
  assert.equal(B.resumenPrestamo(p).proximoPago, 20900 + 5000);
  B.depositar(e, ana.numero, 30000);
  B.pagarCuota(e, ana.numero, p.id);
  assert.equal(ana.saldos.corriente, 30000 - 25900);
  assert.equal(B.resumenPrestamo(p).mora, 0);
  assert.throws(() => B.solicitarPrestamo(e, ana.numero, 1000, 3, '', 'vacaciones'), /tipo/);
});

test('tarjeta de crédito: compras, corte, pago mínimo, intereses y mora', () => {
  const { e, ana } = bancoConDos(true);
  assert.throws(() => B.comprarConTarjeta(e, ana.numero, 1000, 'X'), /activar/);
  B.activarTarjeta(e, ana.numero);
  assert.throws(() => B.activarTarjeta(e, ana.numero), /Ya tienes/);
  assert.equal(B.resumenTarjeta(ana).deuda, 10000); // cuota de emisión
  B.comprarConTarjeta(e, ana.numero, 90000, 'Librería');
  assert.throws(() => B.comprarConTarjeta(e, ana.numero, 60000, 'Tienda'), /disponible/);
  B.avanzarMes(e); // primer corte: debe ₵1,000
  let r = B.resumenTarjeta(ana);
  assert.equal(r.saldoCorte, 100000);
  assert.equal(r.pagoMinimo, 5000); // 5% = ₵50
  // No paga nada: mora ₵100 + interés 4% de ₵1,000 = ₵40
  B.avanzarMes(e);
  r = B.resumenTarjeta(ana);
  assert.equal(r.deuda, 100000 + 10000 + 4000);
  assert.equal(r.saldoCorte, 114000);
  assert.equal(r.pagoMinimo, 5700);
  // Paga el total: no hay intereses ni mora en el siguiente corte
  B.depositar(e, ana.numero, 20000);
  B.pagarTarjeta(e, ana.numero, 114000);
  B.avanzarMes(e);
  r = B.resumenTarjeta(ana);
  assert.equal(r.deuda, 0);
  assert.equal(r.pagoMinimo, 0);
  assert.throws(() => B.pagarTarjeta(e, ana.numero, 100), /no tiene deuda/);
});

test('avance de efectivo con comisión', () => {
  const { e, ana } = bancoConDos(true);
  B.activarTarjeta(e, ana.numero);
  B.avanceEfectivo(e, ana.numero, 20000);
  assert.equal(ana.saldos.corriente, 120000);
  assert.equal(B.resumenTarjeta(ana).deuda, 10000 + 20000 + 1000);
});

test('certificados: interés simple vs compuesto, vencimiento y cancelación', () => {
  const { e, ana, luis } = bancoConDos(true);
  const simple = B.proyeccionCertificado(100000, 1.5, 3, 'simple');
  const compuesto = B.proyeccionCertificado(100000, 1.5, 3, 'compuesto');
  assert.equal(simple.interes, 4500);
  assert.equal(compuesto.interes, 1500 + 1523 + 1545);
  assert.throws(() => B.abrirCertificado(e, ana.numero, 1000, 3, 'simple'), /mínimo/);
  B.abrirCertificado(e, ana.numero, 100000, 3, 'compuesto');
  assert.equal(ana.saldos.corriente, 0);
  B.avanzarMes(e);
  B.avanzarMes(e);
  const r = B.avanzarMes(e);
  assert.equal(r.certificadosVencidos, 1);
  assert.equal(ana.saldos.corriente, 100000 + compuesto.interes);
  const c = B.abrirCertificado(e, luis.numero, 50000, 6, 'simple');
  B.avanzarMes(e);
  B.cancelarCertificado(e, luis.numero, c.id);
  assert.equal(luis.saldos.corriente, 100000 - 1000);
  assert.throws(() => B.cancelarCertificado(e, luis.numero, c.id), /activo/);
});

test('compra y venta de dólares con diferencial', () => {
  const { e, ana } = bancoConDos(true);
  B.comprarDolares(e, ana.numero, 1000); // US$10 a 60.50
  assert.equal(ana.saldos.corriente, 100000 - 60500);
  assert.equal(ana.saldos.dolares, 1000);
  B.venderDolares(e, ana.numero, 1000); // a 58.50
  assert.equal(ana.saldos.corriente, 100000 - 2000);
  assert.throws(() => B.venderDolares(e, ana.numero, 1), /dólares/);
});

test('fórmulas de matemática financiera', () => {
  assert.deepEqual(B.formulas.interesSimple(100000, 2, 6), { interes: 12000, monto: 112000 });
  assert.equal(B.formulas.interesCompuesto(100000, 2, 6).monto, 112616);
  assert.equal(B.formulas.anualidad(10000, 1, 12).monto, 126825);
  assert.ok(Math.abs(B.formulas.tasaAnualEquivalente(1) - 12.6825) < 0.001);
  assert.ok(Math.abs(B.formulas.tasaMensualEquivalente(12.6825) - 1) < 0.0001);
});

test('copias antiguas se completan con los datos nuevos', () => {
  const vieja = B.estadoInicial();
  vieja.clientes.push({ numero: '4A-001', nombre: 'Ana', pin: '1111', creadoMes: 1, saldos: { corriente: 100, ahorro: 0 }, prestamos: [], movimientos: [] });
  const e = B.importar(JSON.stringify(vieja));
  assert.equal(e.clientes[0].saldos.dolares, 0);
  assert.deepEqual(e.clientes[0].certificados, []);
  assert.equal(e.clientes[0].tarjeta, null);
  assert.equal(e.config.limiteTarjeta, 150000);
});
