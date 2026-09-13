require('dotenv').config();

if (!process.env.SESSION_SECRET) {
  console.error('SESSION_SECRET is not set. Copy .env.example to .env and fill it in.');
  process.exit(1);
}

const app = require('./app');

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Snake game listening on port ${PORT} (${process.env.NODE_ENV || 'development'})`);
});
