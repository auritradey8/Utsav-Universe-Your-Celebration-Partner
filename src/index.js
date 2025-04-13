import bcrypt from 'bcrypt'; // For password hashing
import express from 'express';
import session from 'express-session'; // For managing user sessions
import { MongoClient } from 'mongodb';
import path from 'path'; // Module for managing paths to resources
import { fileURLToPath } from 'url'; // Converts URLs to paths

// Get current filename & directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// MongoDB connection URI
const URI = 'mongodb+srv://Auritra:FkfGvpeURjrpKpQ3@cluster0.xlizi.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';
const CLIENT = new MongoClient(URI, { useNewUrlParser: true, useUnifiedTopology: true });

// Database & collection references
let db, users;

// Connect to MongoDB
async function connectDB() {
  try {
    await CLIENT.connect();
    console.log('Connected to MongoDB');
    db = CLIENT.db('JodiJunction');
    users = db.collection('Users');
  } catch (err) {
    console.error('Could not connect to MongoDB:', err);
  }
}
connectDB();

// Middleware
app.use(express.json()); // Parse JSON requests
app.use(express.urlencoded({ extended: true })); // Parse form data
app.use(express.static(path.join(__dirname, '../public'))); // Serve static files

// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../views'));

// Session management
app.use(
  session({
    secret: 'yourSecretKey', // Change this to a strong secret in production
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 3600000 }, // Session expires in 1 hour
  })
);

// ===== ROUTES =====

// Render login page
app.get('/', (req, res) => {
  res.render('login');
});

// User registration (Sign Up)
app.post('/join', async (req, res) => {
  try {
    const { purpose, username, gender, dob, religion, country, joinEmail, mobile, joinPassword, joinConfirmPassword } = req.body;

    // Validate required fields
    if (!purpose || !username || !gender || !dob || !religion || !country || !joinEmail || !mobile || !joinPassword || !joinConfirmPassword) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Check if passwords match
    if (joinPassword !== joinConfirmPassword) {
      return res.status(400).json({ error: 'Passwords do not match' });
    }

    // Check if email is already registered
    const existingUser = await users.findOne({ email: joinEmail });
    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(joinPassword, 10);

    // Insert user into database
    await users.insertOne({
      purpose,
      username,
      gender,
      dob: new Date(dob),
      religion,
      country,
      email: joinEmail,
      mobile,
      password: hashedPassword,
      createdAt: new Date(),
    });

    res.status(201).json({ message: 'User registered successfully!' });
  } catch (error) {
    console.error('Error registering user:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// User login
app.post('/login', async (req, res) => {
  const { loginEmail, loginPassword } = req.body;

  try {
    const user = await users.findOne({ email: loginEmail });
    if (!user) {
      return res.status(400).send('User not found.');
    }

    // Verify password
    const isPasswordMatch = await bcrypt.compare(loginPassword, user.password);
    if (!isPasswordMatch) {
      return res.status(401).send('Incorrect password.');
    }

    // User authenticated, create session
    req.session.userId = user._id;
    res.redirect('/dashboard');
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).send('Server error.');
  }
});

// Protected route - Dashboard
app.get('/dashboard', (req, res) => {
  if (!req.session.userId) {
    console.log("no session")
    return res.redirect('/');
  }
  res.render("dashboard")
});

// User logout
app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/');
});

// Render additional pages
app.get('/about', (req, res) => res.render('about'));
app.get('/blog', (req, res) => res.render('blog'));
app.get('/tips', (req, res) => res.render('helpfultips'));
app.get('/privacy', (req, res) => res.render('privacypolicy'));
app.get('/terms', (req, res) => res.render('termsofuse'));
app.get('/shop', (req, res) => res.render('shop'));
app.get('/cart', (req, res) => res.render('cart')); // Render cart page

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
