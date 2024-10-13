import express from 'express';
import { MongoClient } from 'mongodb';
import path from 'path'; //module for managing paths to resources
import { fileURLToPath } from 'url'; //converts urls to paths

const __filename = fileURLToPath(import.meta.url); //get current filename
const __dirname = path.dirname(__filename); //get current wd

const app = express();
const PORT = process.env.PORT || 3000;
const URI = 'mongodb+srv://auritraBV:Tanaur19732002@clusterad.dhrip.mongodb.net/?retryWrites=true&w=majority&appName=clusterAD';
const CLIENT = new MongoClient(URI, { useNewUrlParser: true, useUnifiedTopology: true });
let users = undefined;
let db = undefined;

async function connectDB() {
  try {
    await CLIENT.connect();
    console.log('Connected to MongoDB');
    db = CLIENT.db('JodiJunction');
    users = db.collection('Users');
  } catch (err) {
    console.error('Could not connect to MongoDB', err);
  }
}

connectDB(); //connect to MongoDB
app.use(express.json()); //use metadata from express package json

// Serve static files from the "public" directory
app.use(express.static(path.join(__dirname, '../public')));

app.set('view engine', 'ejs'); //set EJS as a view engine for rendering templates 
app.set('views', path.join(__dirname, '../views')); //set the views directory to ../views

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

app.get('/', (req, res) => {
  res.render('login'); //render login.ejs
  users.insert_one({})
});

app.get('/about', (req, res) => {
  res.render('about'); //render login.ejs
});
app.get('/blog', (req, res) => {
  res.render('blog'); //render login.ejs
});
app.get('/tips', (req, res) => {
  res.render('helpfultips'); //render login.ejs
});
app.get('/privacy', (req, res) => {
  res.render('privacypolicy'); //render login.ejs
});
app.get('/terms', (req, res) => {
  res.render('termsofuse'); //render login.ejs
});
app.get('/shop', (req, res) => {
  res.render('shop'); 
});

