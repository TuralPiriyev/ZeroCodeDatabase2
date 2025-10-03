This sample uses sqlite for simplicity via knex. Update `src/models/knex.js` to use Postgres or MySQL by changing client and connection. Example PG connection:

module.exports = {
  knex: require('knex')({
    client: 'pg',
    connection: process.env.DATABASE_URL,
    pool: { min: 0, max: 10 }
  })
};
