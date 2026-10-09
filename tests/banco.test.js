// Pruebas de la lógica del banco. Ejecutar con: node --test tests/
const test = require('node:test');
const assert = require('node:assert/strict');
const B = require('../js/banco.js');

function bancoConDos() {
  const e = B.estadoInicial();
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
