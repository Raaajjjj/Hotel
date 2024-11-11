import express from 'express';
import dbConnect from './data.js';
import { ObjectId } from 'mongodb';

const router = express.Router();

// Get all categories
router.get('/api/category', async (req, res) => {
    const collection = await dbConnect('Category'); // Use 'Category' collection
    const categories = await collection.find({}).toArray();
    res.json(categories);
});

// Add a new category
router.post('/api/add-category', async (req, res) => {
    const { categoryName } = req.body;
    const collection = await dbConnect('Category'); // Use 'Category' collection

    // Check if category already exists (case-insensitive)
    const existingCategory = await collection.findOne({
        categoryName: { $regex: new RegExp(`^${categoryName}$`, 'i') }
    });

    if (existingCategory) {
        return res.status(409).json({ message: `Category ${categoryName} already exists` });
    }

    const result = await collection.insertOne({ categoryName });
    // Emit category count update event
    const io = req.app.get('socketio');
    const count = await collection.countDocuments();
    io.emit('updateCategoryCount', { count });

    res.status(201).json({ result, message: `Category ${categoryName} added successfully` });
});

// Update an existing category by ID
router.post('/api/update-category/:id', async (req, res) => {
    const { id } = req.params;
    const { categoryName } = req.body;
    const collection = await dbConnect('Category'); // Use 'Category' collection

    // Check if the new category name already exists (case-insensitive)
    const existingCategory = await collection.findOne({
        categoryName: { $regex: new RegExp(`^${categoryName}$`, 'i') }
    });

    if (existingCategory) {
        return res.status(409).json({ message: `Category ${categoryName} already exists` });
    }

    const result = await collection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { categoryName } }
    );
    res.status(200).json({ result, message: `Category ${categoryName} updated successfully` });
});



// Delete a category and its associated products by ID
router.delete('/api/delete-category/:id', async (req, res) => {
    const { id } = req.params;
    const categoryCollection = await dbConnect('Category');
    const productCollection = await dbConnect('Product');

    try {
        // Retrieve the category name before deleting
        const category = await categoryCollection.findOne({ _id: new ObjectId(id) });

        if (!category) {
            return res.status(404).json({ message: 'Category not found' });
        }

        // Store category name before deletion for response
        const categoryName = category.categoryName;

        // Delete the category
        const categoryResult = await categoryCollection.deleteOne({ _id: new ObjectId(id) });

        if (categoryResult.deletedCount === 1) {
            // Delete all products associated with this category
            const productResult = await productCollection.deleteMany({ categoryId: new ObjectId(id) });

            // Emit category count update event
            const io = req.app.get('socketio');
            const count = await categoryCollection.countDocuments();
            io.emit('updateCategoryCount', { count });

            res.status(200).json({
                message: `Category ${categoryName} and its associated products deleted successfully.`,
                deletedCount: productResult.deletedCount // Return the count of deleted products
            });
        } else {
            res.status(404).json({ message: 'Category not found' });
        }
    } catch (error) {
        res.status(500).json({ message: 'An error occurred during deletion', error });
    }
});


// Get category count
router.get('/api/category-count', async (req, res) => {
    const collection = await dbConnect('Category'); // Use 'Category' collection
    try {
        const count = await collection.countDocuments();
        res.json({ count });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching category count', error });
    }
});



export default router;
