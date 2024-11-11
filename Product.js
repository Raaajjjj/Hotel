import express from 'express';
import dbConnect from './data.js';
import { ObjectId } from 'mongodb';

const router = express.Router();

// Get all categories
router.get('/api/categories', async (req, res) => {
    const collection = await dbConnect('Category');
    const categories = await collection.find({}).toArray();
    res.json(categories);
});

// Get all products with category name
router.get('/api/products', async (req, res) => {
    const productCollection = await dbConnect('Product');
    const products = await productCollection.aggregate([
        {
            $lookup: {
                from: 'Category',
                localField: 'categoryId',
                foreignField: '_id',
                as: 'categoryDetails'
            }
        },
        {
            $unwind: {
                path: '$categoryDetails',
                preserveNullAndEmptyArrays: true
            }
        },
        {
            $project: {
                productName: 1,
                productPrice: 1,
                categoryName: '$categoryDetails.categoryName',
                categoryId: '$categoryId'
            }
        }
    ]).toArray();
    res.json(products);
});

// Add a new product
router.post('/api/products', async (req, res) => {
    const { productName, productPrice, categoryId } = req.body;
    const productCollection = await dbConnect('Product');
    const categoryCollection = await dbConnect('Category');

    const category = await categoryCollection.findOne({ _id: new ObjectId(categoryId) });
    const categoryName = category ? category.categoryName : 'Unknown Category';

    const existingProduct = await productCollection.findOne({
        productName,
        categoryId: new ObjectId(categoryId)
    });

    if (existingProduct) {
        return res.json({ success: false, message: `Product ${productName} already exists in Category ${categoryName}` });
    }

    const newProduct = {
        productName,
        productPrice,
        categoryId: new ObjectId(categoryId),
    };
    await productCollection.insertOne(newProduct);

    res.json({ success: true, message: `Product ${productName} added successfully in Category ${categoryName}` });
});


// Edit a product
router.put('/api/products/:productId', async (req, res) => {
    const { productName, productPrice, categoryId } = req.body;
    const productCollection = await dbConnect('Product');
    const categoryCollection = await dbConnect('Category');

    const category = await categoryCollection.findOne({ _id: new ObjectId(categoryId) });
    const categoryName = category ? category.categoryName : 'Unknown Category';

    // Check if the product with the same name already exists in the same category (excluding the current product)
    const existingProduct = await productCollection.findOne({
        productName,
        categoryId: new ObjectId(categoryId),
        _id: { $ne: new ObjectId(req.params.productId) }  // Exclude the current product
    });

    if (existingProduct) {
        return res.json({
            success: false,
            message: `Product ${productName} already exists in Category ${categoryName}`
        });
    }

    const updatedProduct = {
        productName,
        productPrice,
        categoryId: new ObjectId(categoryId),
    };

    await productCollection.updateOne(
        { _id: new ObjectId(req.params.productId) },
        { $set: updatedProduct }
    );

    res.json({ success: true, message: `Product ${productName} updated successfully in Category ${categoryName}` });
});


// Delete a product by ID
router.delete('/api/delete-product/:id', async (req, res) => {
    const { id } = req.params;
    const productCollection = await dbConnect('Product');

    try {
        // Retrieve the product name before deleting
        const product = await productCollection.findOne({ _id: new ObjectId(id) });

        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }

        // Store product name before deletion for response
        const productName = product.productName;

        // Delete the product
        const result = await productCollection.deleteOne({ _id: new ObjectId(id) });

        if (result.deletedCount === 1) {

            // Emit product count update event
            const io = req.app.get('socketio');
            const productCount = await productCollection.countDocuments();
            io.emit('updateProductCount', { count: productCount });


            res.status(200).json({
                message: `Product ${productName} deleted successfully.`
            });
        } else {
            res.status(404).json({ message: 'Product not found' });
        }
    } catch (error) {
        res.status(500).json({ message: 'An error occurred during deletion', error });
    }
});


// Get the total count of products
router.get('/api/product-count', async (req, res) => {
    const productCollection = await dbConnect('Product');
    const productCount = await productCollection.countDocuments();
    res.json({ count: productCount });
});




export default router;
