import { exportarDashboardPdf } from '/'+process.argv[2]+'/src/utils/exportarPdf.js';
const mov=[
 {id:1,tipo:'INGRESO',fecha:'2026-01-05T12:00:00.000Z',monto:11900,montoLiquido:10000,montoIva:1900,turno:'AM',categoriaIngreso:'PAQUETES',cantidadPaquetes:10,paquetesFallidos:1,paquetesTotalSalida:11,repartidor:{usuario:{nombre:'Juan'}}},
 {id:2,tipo:'GASTO',fecha:'2026-01-06T12:00:00.000Z',monto:5000,descripcion:'Combustible',repartidor:{usuario:{nombre:'Juan'}}}];
exportarDashboardPdf({movimientos:mov,porFecha:[{fecha:'2026-01-05',ingresos:11900,gastos:0},{fecha:'2026-01-06',ingresos:0,gastos:5000}],totalIngresos:11900,totalGastos:5000,etiquetaPeriodo:'05-01-2026 al 20-01-2026',generadoPor:'Admin'});
