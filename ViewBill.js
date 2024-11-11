import express from 'express';
import fs from 'fs';
import dbConnect from './data.js';
import { ObjectId } from 'mongodb';
import path from 'path';
import url from 'url';

const router = express.Router();
const __dirname = path.dirname(url.fileURLToPath(import.meta.url)); // Correct way to get __dirname with ES modules

// Get all bills endpoint
router.get('/api/bill/all', async (req, res) => {
    try {
        const collection = await dbConnect('NewBill');
        const allBills = await collection.find().sort({ _id: -1 }).toArray(); // Sort to show newest first

        if (allBills.length > 0) {
            res.json(allBills);
        } else {
            res.status(404).json({ message: 'No bills found' });
        }
    } catch (error) {
        console.error("Error fetching all bills:", error);
        res.status(500).json({ message: 'Error fetching all bills' });
    }
});

// Assuming you're using Express.js
router.get('/api/bill/download/:billId', (req, res) => {
    const billId = req.params.billId;
    const pdfFileName = `bill_${billId}.pdf`;
    const pdfFilePath = path.join(__dirname, 'bills', pdfFileName);
    
    console.log('Attempting to download bill with ID:', billId);
    console.log('Checking file path:', pdfFilePath);
    
    if (fs.existsSync(pdfFilePath)) {
        console.log('PDF file found, starting download...');
        res.download(pdfFilePath, (err) => {
            if (err) {
                console.error('Download error:', err);
                res.status(500).json({ message: 'Failed to download bill' });
            }
        });
    } else {
        console.log('PDF file not found at path:', pdfFilePath);
        res.status(404).json({ message: 'PDF file not found' });
    }
});

// Delete bill by ID
router.delete('/api/bill/delete/:billId', async (req, res) => {
    const billId = req.params.billId;
    const pdfFileName = `bill_${billId}.pdf`;
    const pdfFilePath = path.join(__dirname, 'bills', pdfFileName);

    try {
        const collection = await dbConnect('NewBill');

        // Delete the bill document from the database
        const result = await collection.deleteOne({ _id: new ObjectId(billId) });
        if (result.deletedCount === 0) {
            return res.status(404).json({ message: 'Bill not found' });
        }

        // Delete the PDF file from the server if it exists
        if (fs.existsSync(pdfFilePath)) {
            fs.unlinkSync(pdfFilePath);
            console.log(`Deleted file at path: ${pdfFilePath}`);
        } else {
            console.log('File not found, only database entry deleted');
        }

        res.status(200).json({ message: 'Bill deleted successfully' });
    } catch (error) {
        console.error("Error deleting bill:", error);
        res.status(500).json({ message: 'Error deleting bill' });
    }
});


router.get('/api/bill/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const collection = await dbConnect('NewBill');
        const bill = await collection.findOne({ _id: new ObjectId(id) });
        console.log('Fetched bill data from database:', bill); // Debugging statement
        if (!bill) {
            res.status(404).json({ error: 'Bill not found' });
            return;
        }
        res.json(bill);
    } catch (error) {
        console.error('Error fetching bill:', error);
        res.status(500).json({ error: 'Failed to fetch bill' });
    }
});

router.delete('/api/bill/deleteAll', async (req, res) => {
    try {
        const collection = await dbConnect('NewBill');

        // Delete all documents in the collection
        await collection.deleteMany({});

        // Delete all PDF files in the 'bills' folder
        const billsFolder = path.join(__dirname, 'bills');
        fs.readdir(billsFolder, (err, files) => {
            if (err) {
                console.error("Error reading bills folder:", err);
                return res.status(500).json({ message: 'Error deleting bill files' });
            }

            files.forEach(file => {
                const filePath = path.join(billsFolder, file);
                fs.unlink(filePath, err => {
                    if (err) console.error("Error deleting file:", filePath, err);
                });
            });

            res.status(200).json({ message: 'All bills deleted successfully' });
        });
    } catch (error) {
        console.error("Error deleting all bills:", error);
        res.status(500).json({ message: 'Error deleting all bills' });
    }
});


export default router;
