import express from 'express';
import fs from 'fs';
import dbConnect from './data.js';
import { ObjectId } from 'mongodb';
import path from 'path';
import url from 'url';



const router = express.Router();
const __dirname = path.dirname(url.fileURLToPath(import.meta.url)); // Correct way to get __dirname with ES modules


// Get all categories
router.get('/api/bill/category', async (req, res) => {
    const collection = await dbConnect('Category');
    const category = await collection.find({}).toArray();
    res.json(category);
});

// Get Products by Category
router.get('/api/bill/products/:categoryId', async (req, res) => {
    const { categoryId } = req.params;

    // Check if the categoryId is a valid ObjectId string
    if (!ObjectId.isValid(categoryId)) {
        return res.status(400).json({ message: 'Invalid category ID format' });
    }

    try {
        const collection = await dbConnect('Product');
        const products = await collection.find({ categoryId: new ObjectId(categoryId) }).toArray();
        res.json(products);
    } catch (error) {
        console.error("Error fetching products:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
});

// Add a bill item
router.post('/api/bill/item', async (req, res) => {
    const { product, category, price, quantity, total } = req.body;

    if (!product || !category || !price || !quantity || !total) {
        return res.status(400).json({ message: "Missing required fields" });
    }

    try {
        const collection = await dbConnect('Bill');

        // Check if the same product in the same category is already added
        const existingItem = await collection.findOne({ product, category });
        if (existingItem) {
            return res.status(409).json({ message: `Product ${product} in category ${category} already selected` });
        }

        const billItem = {
            product,
            category,
            price,
            quantity,
            total,
            generatedAt: new Date().toLocaleString(), // Local time for timestamp
        };

        // Save the new bill item
        await collection.insertOne(billItem);

        // Calculate the new total amount
        const totalAmount = await collection.aggregate([
            { $group: { _id: null, total: { $sum: "$total" } } }
        ]).toArray();


        res.status(201).json({ message: `Product ${product} added to bill successfully`, totalAmount: totalAmount[0]?.total || 0 });
    } catch (error) {
        console.error("Error saving bill item:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
});

// Get all bills and total amount
router.get('/api/bill', async (req, res) => {
    try {
        const collection = await dbConnect('Bill');
        const bills = await collection.find({}).toArray();

        // Calculate the totalAmount from all bill items
        const totalAmount = await collection.aggregate([
            { $group: { _id: null, total: { $sum: "$total" } } }
        ]).toArray();



        // Return both bills and totalAmount
        res.json({ items: bills, totalAmount: totalAmount[0]?.total || 0 });
    } catch (error) {
        console.error("Error fetching bills:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
});



// Delete a bill item
router.delete('/api/bill/item/:billId', async (req, res) => {
    const { billId } = req.params;

    try {
        const collection = await dbConnect('Bill');

        // Find the bill item by ID to get the product name
        const billItem = await collection.findOne({ _id: new ObjectId(billId) });

        if (!billItem) {
            return res.status(404).json({ message: "Bill item not found" });
        }

        const result = await collection.deleteOne({ _id: new ObjectId(billId) });

        if (result.deletedCount === 1) {
            // Recalculate the total amount after deletion
            const totalAmount = await collection.aggregate([
                { $group: { _id: null, total: { $sum: "$total" } } }
            ]).toArray();
            return res.status(200).json({
                message: `Product ${billItem.product} deleted from the bill successfully`,
                totalAmount: totalAmount[0]?.total || 0
            });
        } else {
            return res.status(404).json({ message: "Bill item not found" });
        }
    } catch (error) {
        console.error("Error deleting bill item:", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
});

router.delete('/api/bill/clear', async (req, res) => {
    try {
        const collection = await dbConnect('Bill'); // Connect to the Bill collection
        await collection.deleteMany({}); // Clear all documents in the Bill collection


        // Respond with different messages based on the action

        res.status(200).send({ message: 'Reset successfully' });

    } catch (error) {
        res.status(500).send({ error: 'Failed to clear Bill collection' });
    }
});







// Serve the 'bills' folder statically so the PDFs can be accessed by URL
//router.use('/bills', express.static(path.join(__dirname, 'bills')));

















import puppeteer from 'puppeteer';
import handlebars from 'handlebars';
router.post('/api/bill/generate', async (req, res) => {
    const { customerName, contactNumber, paymentMethod, items, totalBillAmount } = req.body;

    // Create a dynamic bill data object
    const billData = {
        customerName,
        contactNumber,
        paymentMethod,
        items,
        totalBillAmount,
        generatedAt: new Date().toLocaleString(),
    };

    try {
        // Insert bill data into MongoDB to generate the _id
        const collection = await dbConnect('NewBill');
        const result = await collection.insertOne(billData);
        const billId = result.insertedId.toString();  // Get the MongoDB _id

        // Define the PDF filename using the generated _id
        const pdfFileName = `bill_${billId}.pdf`;
        const billsDir = path.join(__dirname, 'bills');
        if (!fs.existsSync(billsDir)) {
            fs.mkdirSync(billsDir);
        }
        const pdfPath = path.join(billsDir, pdfFileName);

        // Path to your HTML template
        const htmlTemplatePath = path.join(__dirname, './HTML/bill-template.html');
        const htmlTemplate = fs.readFileSync(htmlTemplatePath, 'utf-8');

        // Compile the template using Handlebars
        const template = handlebars.compile(htmlTemplate);

        // Generate the final HTML content with dynamic data
        const htmlContent = template(billData);

        // Launch Puppeteer to generate the PDF
        const browser = await puppeteer.launch();
        const page = await browser.newPage();
        await page.setContent(htmlContent);

        // Generate the PDF and save it
        await page.pdf({ path: pdfPath, format: 'A4' });

        // Close Puppeteer browser instance
        await browser.close();

        // Return the relative URL for the generated PDF
        const relativePdfUrl = `/bills/${pdfFileName}`;

        res.status(201).json({
            message: 'Bill generated successfully',
            pdfPath: relativePdfUrl,
            billId: billId, // Return the MongoDB _id as billId
        });

    } catch (error) {
        console.error("Error generating bill PDF:", error);
        res.status(500).json({ message: "Error generating bill PDF" });
    }
});





// API to count the number of bills in the NewBill collection
router.get('/api/countBills', async (req, res) => {

    const collection = await dbConnect('NewBill');
    try {
        const count = await collection.countDocuments();
        res.json({ count }); // Send the count as a response
    } catch (err) {
        res.status(500).json({ error: 'Error connecting to MongoDB or counting bills', details: err });
    }
});

// Get total amount of all bills in NewBill collection
router.get('/api/bill/total', async (req, res) => {
    try {
        const collection = await dbConnect('NewBill');

        // Calculate the total amount of all bills
        const totalAmount = await collection.aggregate([
            { $group: { _id: null, total: { $sum: "$totalBillAmount" } } }
        ]).toArray();

        res.json({ totalAmount: totalAmount[0]?.total || 0 });
    } catch (error) {
        console.error("Error calculating total bill amount:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
});

// Get the most used payment method
router.get('/api/payment-stats', async (req, res) => {
    try {
        const collection = await dbConnect('NewBill');

        // Count occurrences of each payment method
        const paymentStats = await collection.aggregate([
            { $group: { _id: "$paymentMethod", count: { $sum: 1 } } }, // Group by paymentMethod and count occurrences
            { $sort: { count: -1 } } // Sort by count in descending order
        ]).toArray();

        if (paymentStats.length > 0) {
            const maxCount = paymentStats[0].count;
            // Filter to include all payment methods that have the highest count
            const mostUsedPaymentMethods = paymentStats.filter(stat => stat.count === maxCount);
            res.json({ mostUsedPaymentMethods });
        } else {
            res.status(404).json({ message: "No payment data found" });
        }
    } catch (error) {
        console.error("Error fetching payment method stats:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
});

router.get('/api/bill/most,least-used-product', async (req, res) => {
    try {
        const collection = await dbConnect('NewBill');

        // Use aggregation to sum up the quantity for each product
        const result = await collection.aggregate([
            { $unwind: "$items" }, // Flatten the items array
            {
                $group: {
                    _id: "$items.product", // Group by product name
                    totalQuantity: { $sum: "$items.quantity" } // Sum the quantity for each product
                }
            },
            {
                $sort: { totalQuantity: -1 } // Sort by total quantity in descending order for most popular
            }
        ]).toArray();

        if (result.length === 0) {
            return res.status(404).json({ message: "No products found in bills" });
        }

        // Find the maximum total quantity (most popular)
        const maxQuantity = result[0].totalQuantity;

        // Filter the products that have the maximum quantity (most popular)
        const mostUsedProducts = result.filter(product => product.totalQuantity === maxQuantity);

        // Sort by total quantity in ascending order for least popular
        const leastUsedProduct = result[result.length - 1];

        // Find the minimum total quantity (least popular)
        const minQuantity = leastUsedProduct.totalQuantity;

        // Filter the products that have the minimum quantity (least popular)
        const leastUsedProducts = result.filter(product => product.totalQuantity === minQuantity);

        res.json({ mostUsedProducts, leastUsedProducts }); // Return both most and least used products
    } catch (error) {
        console.error("Error fetching most used product:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
});

router.get('/api/bill/most-least-used-category', async (req, res) => {
    try {
        const collection = await dbConnect('NewBill');

        // Use aggregation to sum up the quantity for each category
        const result = await collection.aggregate([
            { $unwind: "$items" }, // Flatten the items array
            {
                $group: {
                    _id: "$items.category", // Group by category
                    totalQuantity: { $sum: "$items.quantity" } // Sum the quantity for each category
                }
            },
            {
                $sort: { totalQuantity: -1 } // Sort by total quantity in descending order for most popular
            }
        ]).toArray();

        if (result.length === 0) {
            return res.status(404).json({ message: "No categories found in bills" });
        }

        // Find the maximum total quantity (most popular category)
        const maxQuantity = result[0].totalQuantity;

        // Filter the categories that have the maximum quantity (most popular)
        const mostUsedCategories = result.filter(category => category.totalQuantity === maxQuantity);

        // Sort by total quantity in ascending order for least popular
        const leastUsedCategory = result[result.length - 1];

        // Find the minimum total quantity (least popular category)
        const minQuantity = leastUsedCategory.totalQuantity;

        // Filter the categories that have the minimum quantity (least popular)
        const leastUsedCategories = result.filter(category => category.totalQuantity === minQuantity);

        res.json({ mostUsedCategories, leastUsedCategories }); // Return both most and least used categories
    } catch (error) {
        console.error("Error fetching most used category:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
});






export default router;
