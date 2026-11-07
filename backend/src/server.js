'use strict';
require('dotenv').config();
const { createApp } = require('./app');
const { realDeps } = require('./lib/firebase');

const { auth, db } = realDeps();
const app = createApp({ auth, db });
const port = Number(process.env.PORT) || 4000;
app.listen(port, () => {
  console.log(`FitTrack API listening on :${port} (payments: ${process.env.PAYMENT_GATEWAY || 'mock'})`);
});
