import bcrypt from 'bcrypt'; // For password hashing
import express from 'express';
import session from 'express-session'; // For managing user sessions
import { MongoClient } from 'mongodb';
import path from 'path'; // Module for managing paths to resources
import { fileURLToPath } from 'url'; // Converts URLs to paths

const __filename = fileURLToPath(import.meta.url); // Get current filename
const __dirname = path.dirname(__filename); // Get current working directory

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

connectDB(); // Connect to MongoDB
app.use(express.json()); // For handling JSON requests
app.use(express.urlencoded({ extended: true })); // For parsing form data

// Serve static files from the "public" directory
app.use(express.static(path.join(__dirname, '../public')));

app.set('view engine', 'ejs'); // Set EJS as the view engine for rendering templates
app.set('views', path.join(__dirname, '../views')); // Set the views directory

// Configure session management
app.use(session({
  secret: 'yourSecretKey', // Use a strong secret in production
  resave: false,
  saveUninitialized: true,
  cookie: { maxAge: 60000 } // Session expires in 1 hour
}));

// Render login page
app.get('/', (req, res) => {
  res.render('login');
});

// Render registration page
app.get('/join', (req, res) => {
  res.render('joinNow');
});

// User login route
app.post('/login', async (req, res) => {
  const { loginEmail, loginPassword } = req.body;

  try {
    const user = await users.findOne({ email: loginEmail });
    if (!user) {
      return res.status(400).send('User not found.');
    }

    const isPasswordMatch = await bcrypt.compare(loginPassword, user.password);
    if (!isPasswordMatch) {
      return res.status(401).send('Incorrect password.');
    }

    // User authenticated, create session
    req.session.userId = user._id;
    res.redirect('/dashboard');
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).send('Server error.');
  }
});

// User registration route
app.post('/join', async (req, res) => {
  const { joinEmail, mobile, joinPassword, joinConfirmPassword, purpose, gender, dob, religion, country } = req.body;

  if (joinPassword !== joinConfirmPassword) {
    return res.status(400).send('Passwords do not match.');
  }

  try {
    const hashedPassword = await bcrypt.hash(joinPassword, 10);

    const newUser = {
      email: joinEmail,
      mobile,
      password: hashedPassword,
      purpose,
      gender,
      dob,
      religion,
      country,
      createdAt: new Date()
    };

    await users.insertOne(newUser);
    res.redirect('/');
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).send('Server error.');
  }
});

// Protected route - dashboard (only accessible when logged in)
app.get('/dashboard', (req, res) => {
  if (!req.session.userId) {
    return res.redirect('/');
  }
  res.render('dashboard'); // Render a dashboard view
});

// User logout
app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/');
});

// Render other pages like 'about', 'privacy', etc.
app.get('/about', (req, res) => {
  res.render('about');
});

app.get('/blog', (req, res) => {
  res.render('blog');
});

app.get('/tips', (req, res) => {
  res.render('helpfultips');
});

app.get('/privacy', (req, res) => {
  res.render('privacypolicy');
});

app.get('/terms', (req, res) => {
  res.render('termsofuse');
});

app.get('/shop', (req, res) => {
  res.render('shop');
});



app.get('/cart', (req, res) => {
  res.render('cart'); // Render the cart page (your EJS cart template)
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});


