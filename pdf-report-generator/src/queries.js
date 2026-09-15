// src/queries.js
// Boring SQL is 80% of reporting: aggregation turns rows into numbers.
const { db } = require('./db');

// One function → one report object with four sections:
//   totals, topProducts, ordersPerDay, and allOrders (the long table)
function getReport() {
  const totals = db.prepare(`
    SELECT COUNT(*) AS totalOrders,
           ROUND(SUM(amount), 2) AS totalRevenue,
           ROUND(AVG(amount), 2) AS avgOrder
    FROM orders
  `).get();

  const topProducts = db.prepare(`
    SELECT product,
           COUNT(*)  AS orders,
           ROUND(SUM(amount), 2) AS revenue
    FROM orders
    GROUP BY product
    ORDER BY revenue DESC
    LIMIT 5
  `).all();

  const ordersPerDay = db.prepare(`
    SELECT created_at AS day, COUNT(*) AS orders
    FROM orders
    WHERE created_at >= date('now', '-7 days')
    GROUP BY created_at
    ORDER BY created_at ASC
  `).all();

  const allOrders = db.prepare(`
    SELECT id, customer, product, amount, created_at
    FROM orders
    ORDER BY created_at DESC, id DESC
  `).all();

  return {
    generatedAt: new Date().toISOString(),
    totals,
    topProducts,
    ordersPerDay,
    allOrders,
  };
}

module.exports = { getReport };
