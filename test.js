import { MongoClient } from 'mongodb';

const uri = 'mongodb+srv://auritradey:qjp0hpBwc2tzThFX@cluster0.v4z8lnw.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

const client = new MongoClient(uri);

const shopItems = [
  { name: "Imitation Wedding Ring", price: 4000, original: 4999, discount: "20%", image: "s1.jpg" },
  { name: "Bridal MakeUp Kit", price: 1999, original: 2499, discount: "20%", image: "s2.jpg" },
  { name: "Wedding Cake", price: 1499, original: 1875, discount: "20%", image: "s3.jpg" },
  { name: "Decoration Flowers", price: 1750, original: 2187, discount: "20%", image: "s4.jpg" },
  { name: "Birthday Balloons", price: 400, original: 499, discount: "20%", image: "s5.jpg" },
  { name: "Soft Teddy", price: 325, original: 499, discount: "35%", image: "s6.jpg" },
  { name: "Car Decoration", price: 4000, original: 4999, discount: "20%", image: "s7.jpg" },
  { name: "Mehendi", price: 400, original: 499, discount: "20%", image: "s8.jpg" }
];

async function seedShopItems() {
  try {
    await client.connect();
    console.log("Connected to MongoDB Atlas");

    const db = client.db('UtsavUniverse');
    const collection = db.collection('Shop');

    const result = await collection.insertMany(shopItems);
    console.log(`${result.insertedCount} items inserted into Shop collection.`);
  } catch (err) {
    console.error('Error inserting data:', err);
  } finally {
    await client.close();
    console.log("Connection closed");
  }
}

seedShopItems();
