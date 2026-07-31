# 🚚 Plataforma Web de Gestión Financiera y Control Operativo para Repartidores de Última Milla

> **Proyecto**  
> Un sistema Full-Stack integral diseñado para optimizar el control financiero, desglose de ingresos por entregas/retiros y gestión de costos operativos en servicios de logística de última milla.

---

## 📋 Descripción del Proyecto

La **Plataforma Web de Gestión Financiera** resuelve la falta de herramientas especializadas para trabajadores y administradores del sector de reparto de última milla. Permite a los repartidores registrar ingresos desglosados (distinguiendo entre entregas efectivas, fallidas y valores unitarios con cálculo automático de IVA y montos líquidos) y controlar gastos operativos claves como combustible o mantenimiento. 

A nivel administrativo, ofrece un panel de control consolidado con métricas financieras dinámicas, análisis comparativo entre repartidores y gráficos de rendimiento en tiempo real.

---

## 🛠️ Stack Tecnológico

### Backend
* **Runtime:** Node.js (v20+ / v22+)
* **Framework Web:** Express.js
* **ORM:** Prisma ORM 7.9 (usando `@prisma/adapter-pg`)
* **Base de Datos:** PostgreSQL
* **Autenticación & Seguridad:** JSON Web Tokens (JWT) & bcrypt

### Frontend
* **Biblioteca UI:** React + Vite
* **Enrutamiento:** React Router Dom
* **Visualización de Datos:** Recharts
* **Cliente HTTP:** Axios (con interceptores para JWT)
* **Estilos:** System Design propio CSS3 "Asfalto & Ámbar" (UX/UI adaptado al contexto operativo)

---

## ✨ Características Principales

### 👨‍💻 Módulo Repartidor
* **Registro preciso de Ingresos:**
  * **Modo Paquetes:** Cálculo automático considerando entregas exitosas vs. fallidas, valor por paquete, desglose de IVA y monto líquido final.
  * **Modo Retiros:** Gestión simplificada por cantidad de retiros realizados.
* **Control de Gastos Operativos:**
  * Categorización en *Combustible*, *Mantenimiento* y *Otros*.
  * Trazabilidad de cupones de descuento en carga de bencina.
* **Filtros Temporales Dinámicos:** Consulta de ingresos, gastos y balance neto (*Esta semana*, *Este mes*, *Histórico total*).
* **Historial Interactivo:** Tabla con desglose expandible por movimiento.

### 🛡️ Módulo Administrador (Dashboard)
* **Métricas Consolidadas:** Visualización global de ingresos, costos operacionales y margen neto del equipo.
* **Visualización Gráfica:**
  * Gráficos de tendencias temporales (ingresos vs. gastos).
  * Comparativas de rendimiento y balance por repartidor.
* **Gestión de Registros:** Supervisión integral y auditoría de transacciones con capacidades de eliminación/corrección.

---

## ⚙️ Instalación y Ejecución Local

### Requisitos Previos
* Node.js (v20.19+ o v22+)
* PostgreSQL instalado y ejecutándose localmente

### 1. Clonar el repositorio
```bash
git clone [https://github.com/albertp07/plataforma-repartidores.git](https://github.com/albertp07/plataforma-repartidores.git)
cd plataforma-repartidores