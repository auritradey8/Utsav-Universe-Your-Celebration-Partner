import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
import express from 'express';
import session from 'express-session';
import { MongoClient, ObjectId } from 'mongodb';
import path from 'path';
import { fileURLToPath } from 'url';


dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const URI = process.env.MONGODB_URI;
const client = new MongoClient(URI);

let db, users;

async function connectDB() {
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    db = client.db('UtsavUniverse');
    users = db.collection('Users');
  } catch (err) {
    console.error('MongoDB connection failed:', err);
    throw err;
  }
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../public')));
app.use('/uploads', express.static('public/uploads'));

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../views'));

app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: true,
  cookie: {
    maxAge: 3600000,
    httpOnly: true,
    sameSite: 'lax',
    secure: false,
  },
}));

app.use((req, res, next) => {
  res.locals.userId = req.session.userId || null;
  next();
});

app.get('/', (req, res) => res.render('login'));

// ---------------- AUTH ----------------

app.post('/join', async (req, res) => {
  const {
    purpose, username, gender, dob, religion, country,
    joinEmail, mobile, joinPassword, joinConfirmPassword
  } = req.body;

  if ([purpose, username, gender, dob, religion, country, joinEmail, mobile, joinPassword, joinConfirmPassword].some(f => !f)) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  if (joinPassword !== joinConfirmPassword) {
    return res.status(400).json({ error: 'Passwords do not match' });
  }

  const existingUser = await users.findOne({ email: joinEmail });
  if (existingUser) {
    return res.status(400).json({ error: 'Email already registered' });
  }

  const hashedPassword = await bcrypt.hash(joinPassword, 10);
  await users.insertOne({
    purpose, username, gender, dob: new Date(dob), religion, country,
    email: joinEmail, mobile,
    password: hashedPassword,
    createdAt: new Date()
  });

  res.status(201).json({ message: 'User registered successfully!' });
});

app.post('/login', async (req, res) => {
  const { loginEmail, loginPassword } = req.body;

  try {
    const user = await users.findOne({ email: loginEmail });
    if (!user) return res.status(400).send('User not found.');

    const isMatch = await bcrypt.compare(loginPassword, user.password);
    if (!isMatch) return res.status(401).send('Incorrect password.');

    req.session.userId = user._id;
    res.redirect('/dashboard');
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).send('Server error.');
  }
});

app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/');
});

app.get('/dashboard', (req, res) => {
  if (!req.session.userId) return res.redirect('/');
  res.render("dashboard");
});

// ---------------- SHOP ----------------

app.get('/shop', async (req, res) => {
  if (!req.session.userId) return res.redirect('/login');

  try {
    const products = await db.collection('Shop').find().toArray();
    const cartDoc = await db.collection('Cart').findOne({ userId: req.session.userId });
    const cartCount = cartDoc?.items?.reduce((acc, item) => acc + item.quantity, 0) || 0;

    res.render('shop', { products, cartCount });
  } catch (err) {
    console.error('Error loading shop:', err);
    res.status(500).send('Something went wrong.');
  }
});

app.post('/add-to-cart', async (req, res) => {
  const { itemId, itemType, quantity } = req.body;
  const userId = req.session.userId; // Change to actual user ID handling
  const qty = Math.min(parseInt(quantity) || 1, 10);

  try {
    const item = await db.collection(itemType).findOne({ _id: new ObjectId(itemId) });
    if (!item) {
      return res.status(404).json({ message: 'Item not found' });
    }

    const cartCollection = db.collection('Cart');
    const userCart = await cartCollection.findOne({ userId });

    if (userCart) {
      const existingItemIndex = userCart.items.findIndex(
        (i) => i.itemId.toString() === itemId && i.itemType === itemType
      );

      if (existingItemIndex !== -1) {
        // Update quantity of existing item
        const currentQty = userCart.items[existingItemIndex].quantity;
        const newQty = Math.min(currentQty + qty, 10);
        userCart.items[existingItemIndex].quantity = newQty;
      } else {
        // Add new item
        userCart.items.push({
          itemId: new ObjectId(itemId),
          itemType,
          name: item.name,
          pricing: item.price,
          quantity: qty,
        });
      }

      await cartCollection.updateOne(
        { _id: userCart._id },
        { $set: { items: userCart.items } }
      );
    } else {
      // Create new cart
      await cartCollection.insertOne({
        userId,
        items: [{
          itemId: new ObjectId(itemId),
          itemType,
          name: item.name,
          pricing: item.price,
          quantity: qty
        }]
      });
    }

    // Count total items in cart (summed quantities)
    const updatedCart = await cartCollection.findOne({ userId });
    const cartCount = updatedCart.items.reduce((sum, i) => sum + i.quantity, 0);

    res.json({ cartCount });
  } catch (err) {
    console.error("Error adding to cart:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

app.post('/api/remove-from-cart', async (req, res) => {
  const userId = req.session.userId;
  const { itemId, itemType } = req.body;

  if (!userId) return res.status(401).json({ message: 'Not logged in' });

  try {
    await db.collection('Cart').updateOne(
      { userId },
      {
        $pull: {
          items: {
            itemId: new ObjectId(itemId),
            itemType
          }
        }
      }
    );

    const updatedCart = await db.collection('Cart').findOne({ userId });
    const cartCount = updatedCart?.items?.reduce((sum, i) => sum + i.quantity, 0) || 0;

    res.json({ message: 'Item removed', cartCount });
  } catch (err) {
    console.error('Error removing item from cart:', err);
    res.status(500).json({ message: 'Server error' });
  }
});


app.post('/update-cart', async (req, res) => {
  const userId = req.session.userId;
  const { itemId, itemType, quantity } = req.body;

  if (!userId) return res.status(401).json({ message: 'Not logged in' });

  const cartCollection = db.collection('Cart');
  const cart = await cartCollection.findOne({ userId });

  if (!cart) return res.status(400).json({ message: 'Cart not found' });

  const itemIndex = cart.items.findIndex(item =>
    item.itemId.toString() === itemId && item.itemType === itemType
  );

  if (itemIndex > -1) {
    cart.items[itemIndex].quantity = Number(quantity);
  } else {
    cart.items.push({
      itemId: new ObjectId(itemId),
      itemType,
      quantity: Number(quantity)
    });
  }

  await cartCollection.updateOne(
    { _id: cart._id },
    { $set: { items: cart.items } }
  );

  const totalCount = cart.items.reduce((sum, item) => sum + item.quantity, 0);

  res.json({ message: 'Cart updated', cartCount: totalCount });
});



app.get('/cart', async (req, res) => {
  if (!req.session.userId) return res.redirect('/login');

  try {
    const cartDoc = await db.collection('Cart').findOne({ userId: req.session.userId });
    const items = cartDoc?.items || [];

    const total = items.reduce((sum, item) => sum + (item.pricing || 0) * (item.quantity || 1), 0);

    res.render('cart', { items, total });
  } catch (err) {
    console.error('Error loading cart:', err);
    res.status(500).send('Server error');
  }
});

app.post('/remove-from-cart', async (req, res) => {
  const { itemId, itemType } = req.body;
  if (!req.session.userId) return res.redirect('/');

  try {
    await db.collection('Cart').updateOne(
      { userId: req.session.userId },
      {
        $pull: {
          items: {
            itemId: new ObjectId(itemId),
            itemType
          }
        }
      }
    );
    res.redirect('/cart');
  } catch (err) {
    console.error('Error removing from cart:', err);
    res.status(500).send('Error removing item');
  }
});

// ---------------- RATING ----------------

app.post('/rate', async (req, res) => {
  const { name, review, rating } = req.body;

  try {
    await db.collection('Ratings').insertOne({
      name, review, rating: Number(rating), date: new Date()
    });
    res.status(200).send("Rating submitted");
  } catch (err) {
    console.error('Error saving rating:', err);
    res.status(500).send('Something went wrong.');
  }
});

// ---------------- ADMIN PANEL ----------------

function getCollectionAndFilter(db, type, body) {
  const collections = {
    decorators: 'Decorators',
    halls: 'Halls',
    priests: 'Priests',
    caterers: 'Caterers'
  };
  return {
    collection: db.collection(collections[type]),
    filter: { name: body.name }
  };
}

app.get('/admin', async (req, res) => {
  try {
    const decorators = await db.collection('Decorators').find().toArray();
    const halls = await db.collection('Halls').find().toArray();
    const priests = await db.collection('Priests').find().toArray();
    const caterers = await db.collection('Caterers').find().toArray();
    res.render('admin', { decorators, halls, priests, caterers });
  } catch (error) {
    console.error(error);
    res.send('Error fetching admin data');
  }
});

app.post('/admin/decorators', async (req, res) => {
  const { action, name, avg_pricing, location, mob, services_involved, mail, avg_rating } = req.body;
  const { collection, filter } = getCollectionAndFilter(db, 'decorators', req.body);

  const data = {
    name,
    avg_pricing: Number(avg_pricing),
    location,
    mob,
    services_involved: services_involved?.split(',') || [],
    mail,
    avg_rating: Number(avg_rating)
  };

  try {
    if (action === 'add') await collection.insertOne(data);
    else if (action === 'update') await collection.updateOne(filter, { $set: data });
    else if (action === 'delete') await collection.deleteOne(filter);

    res.redirect('/admin');
  } catch (error) {
    console.error('Error handling decorators:', error);
    res.status(500).send('Error handling decorators');
  }
});

['halls', 'priests', 'caterers'].forEach(type => {
  app.post(`/admin/${type}`, async (req, res) => {
    const { action, name, location, mobno, pricing, avg_rating } = req.body;
    const { collection, filter } = getCollectionAndFilter(db, type, req.body);

    const data = {
      name,
      location,
      mobno,
      pricing: Number(pricing),
      avg_rating: Number(avg_rating)
    };

    try {
      if (action === 'add') await collection.insertOne(data);
      else if (action === 'update') await collection.updateOne(filter, { $set: data });
      else if (action === 'delete') await collection.deleteOne(filter);

      res.redirect('/admin');
    } catch (error) {
      console.error(`Error handling ${type}:`, error);
      res.status(500).send(`Error handling ${type}`);
    }
  });
});

[
  'about', 'blog', 'helpfultips', 'privacypolicy', 'termsofuse', 'submitexp',
  'template1', 'template2', 'template3', 'template4'
].forEach(page => {
  app.get(`/${page}`, (req, res) => res.render(page));
});

connectDB()
  .then(() => app.listen(PORT, () => console.log(`Server running on port ${PORT}`)))
  .catch(err => console.error('Startup error:', err));
