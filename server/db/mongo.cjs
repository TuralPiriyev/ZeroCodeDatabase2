const { MongoClient, ObjectId } = require('mongodb');
const EventEmitter = require('events');

const emitter = new EventEmitter();

let client;
let db;

async function connectWithRetry(uri, dbName) {
  const opts = { useNewUrlParser: true, useUnifiedTopology: true };
  client = new MongoClient(uri, opts);
  await client.connect();
  db = client.db(dbName);
  console.log('✅ MongoDB (native) connected to', dbName);

  // start change stream watcher for workspaces collection
  try {
    const coll = db.collection('workspaces');
    const changeStream = coll.watch([], { fullDocument: 'updateLookup' });
    changeStream.on('change', change => {
      try {
        const id = change.documentKey && change.documentKey._id && change.documentKey._id.toString();
        if (!id) return;
        if (change.operationType === 'delete') {
          emitter.emit('workspace:deleted', { workspaceId: id });
        } else {
          emitter.emit('workspace:full', { workspaceId: id, doc: change.fullDocument });
        }
      } catch (e) {
        console.error('changeStream handler error', e);
      }
    });
    changeStream.on('error', err => { console.error('ChangeStream error', err); });
    console.log('🔁 ChangeStream watching workspaces');
  } catch (e) {
    console.warn('ChangeStream not started', e.message);
  }

  return { client, db };
}

function getDb() { return db; }
function getCollection(name) { return db.collection(name); }

module.exports = { connectWithRetry, getDb, getCollection, ObjectId, emitter };
