const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const bodyParser = require('body-parser');

const app = express();
const cors = require('cors');

const SECRETS = require('./secrets');

const accountSid = SECRETS.TWILIO_ACCOUNT_SID;
const authToken = SECRETS.TWILIO_AUTH_TOKEN;
const client = require('twilio')(accountSid, authToken);

app.use(cors());

app.use(bodyParser({ extended: true }));

let db;

MongoClient.connect(SECRETS.MONGO_CONNECTION_STRING,
  { useNewUrlParser: true }, (err, client) => {
    if (err) console.log(err);
    db = client.db('uofthacks');
    app.listen(3000, () => {
      console.log('Running on localhost:3000');
    });
  });

function getMatches(courseCode, buy) {
  const findBuy = !(buy == 'true');
  return new Promise((resolve, reject) => {
    const collection = db.collection('books');

    collection.find({
      course_code: courseCode,
      buy: findBuy,
    }).toArray((err, items) => {
      if (err) {
        reject(err);
      } else {
        resolve(items);
      }
    });
  });
}

app.post('/addition', (req, res) => {
  const findBuy = !(req.body.buy == 'true' || req.body.buy == true);
  console.log(findBuy);
  console.log(req.body.course_code);
  db.collection('books').insertOne(req.body, (err, result) => {
    if (err) return console.log(err);
    console.log('saved to database');
  });
  db.collection('books').find({
    course_code: req.body.course_code,
    buy: findBuy,
    'user.user_id': 1,
    date_sold: null
  }).toArray().then((arr) => {
    //   // res.send('arr.length');
    console.log(arr)
    if (arr.length) {
      client.messages
        .create({
          body: `You have a new Textbookify match for your ${arr[0].course_code} textbook!`,
          from: SECRETS.TWILIO_FROM_NUMBER,
          to: SECRETS.TWILIO_TO_NUMBER,
        })
        .then(message => console.log(message.sid))
        .done();
      res.send('notified');
    }
  });
  res.send('added book to database');
});

app.get('/books', (req, res) => {
  db.collection('books')
    .find({ 'user.user_id': 1, 'date_sold': null })
    .toArray()
    .then(arr => res.send(arr));
});

app.get('/match', (req, res) => {
  const courseCode = req.query.course_code;
  const { title } = req.query;
  const { edition } = req.query;
  const { buy } = req.query;
  getMatches(courseCode, buy).then((books) => {
    if (title) {
      if (edition) {
        books.filter(book => book.edition === edition);
      }
      books.filter(book => book.title === title);
    }
    res.send(books);
  });
});

app.post('/delete', (req, res) => {
  console.log(req.body);
  db.collection('books')
    .deleteOne({ _id: ObjectId(req.body.id) });
  console.log('done')
  res.send('deleted book');
});

app.post('/sold', (req, res) => {
  db.collection('books')
    .updateOne({ _id: ObjectId(req.body.id_1) }, { $set: { date_sold: new Date() } });
  db.collection('books')
    .updateOne({ _id: ObjectId(req.body.id_2) }, { $set: { date_sold: new Date() } });
  res.send('deleted books');
});

app.get('/analytics', async (req, res) => {
  const demand = await db.collection('books')
    .aggregate([
      { $match: { buy: true } },
      {
        $group: {
          _id: { course_code: '$course_code', title: '$title' },
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
    ])
    .limit(5)
    .toArray();
  const supply = await db.collection('books')
    .aggregate([
      { $match: { buy: false } },
      {
        $group: {
          _id: { course_code: '$course_code', title: '$title' },
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
    ])
    .limit(5)
    .toArray();
  res.send({ demand, supply });
});

function getBooksForAnalytics(courseCode, title, edition) {
  return new Promise((resolve, reject) => {
    const collection = db.collection('books');

    collection.find({
      course_code: courseCode,
      buy: false, // set true for testing
      title,
      edition,
    }).toArray((err, items) => {
      if (err) {
        reject(err);
      } else {
        resolve(items);
      }
    });
  });
}

app.get('/textbook/analytics', (req, res) => {
  const courseCode = req.query.course_code;
  const { title } = req.query;
  const { edition } = req.query;
  getBooksForAnalytics(courseCode, title, edition)
    .then((books) => {
      const prices = books.filter(book => book.date_sold).map(book => Number(book.price));
      const len = prices.length;
      const sum = prices.reduce((acc, elem) => acc + elem, 0);
      res.send(String(sum / len));
    });
});
