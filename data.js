import { MongoClient } from 'mongodb';

// MongoDB Atlas connection URL
const url = 'mongodb+srv://raj0402mehta:XN16LvFlmECZ5bTy@cluster0.lzc2e.mongodb.net/HOTEL?retryWrites=true&w=majority&appName=Cluster0';
const client = new MongoClient(url);

// Function to connect to MongoDB Atlas and return the specified collection
async function dbConnect(collectionName) {
    await client.connect();
    const db = client.db('HOTEL'); // Database name
    return db.collection(collectionName); // Collection name based on input
}

// Export the dbConnect function
export default dbConnect;
