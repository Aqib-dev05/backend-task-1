// src/seed.js
// Seed data — invented rows for development. Safe to run twice: the script
// starts by deleting all rows, so re-running leaves exactly one clean copy.
const { db } = require('./db');

const PRODUCTS = ['Wireless Mouse', 'USB-C Hub', 'Mechanical Keyboard', 'Webcam 1080p', 'Laptop Stand', 'Noise-Cancelling Headphones'];
const CUSTOMERS = ['Ada Lovelace', 'Alan Turing', 'Grace Hopper', 'Edsger Dijkstra', 'Barbara Liskov', 'Donald Knuth', 'Radia Perlman', 'Linus Torvalds'];

const ORDER_COUNT = 200;
const DAYS = 30;

function randomDateInLast30Days() {
  const now = new Date();
  const past = new Date(now.getTime() - Math.floor(Math.random() * DAYS) * 24 * 60 * 60 * 1000);
  return past.toISOString().slice(0, 10); // YYYY-MM-DD
}

const deleteAll = db.prepare('DELETE FROM orders');
const insert = db.prepare(
  'INSERT INTO orders (customer, product, amount, created_at) VALUES (?, ?, ?, ?)'
);

const seed = db.transaction(() => {
  deleteAll.run(); // safe to run twice → exactly one clean copy
  for (let i = 0; i < ORDER_COUNT; i++) {
    insert.run(
      CUSTOMERS[Math.floor(Math.random() * CUSTOMERS.length)],
      PRODUCTS[Math.floor(Math.random() * PRODUCTS.length)],
      Math.round((5 + Math.random() * 195) * 100) / 100, // 5.00 – 200.00
      randomDateInLast30Days()
    );
  }
});

seed();

const { c } = db.prepare('SELECT COUNT(*) AS c FROM orders').get();
console.log(`Seeded ${c} orders into report.db`);
