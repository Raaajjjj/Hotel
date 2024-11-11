import express from 'express';
import path from 'path';
import url from 'url';
import { Server } from 'socket.io'; // Import Socket.IO
import http from 'http'; // Import http to create an HTTP server
import CategoryRoutes from './Category.js'; // Import Category routes
import ProductRoutes from './Product.js'; // Import Product routes
import BillRoutes from './Bill.js'; // Import Bill routes
import ViewBillRoutes from './ViewBill.js'

const app = express();
const server = http.createServer(app); // Create HTTP server and attach Express to it
const io = new Server(server); // Initialize Socket.IO with the HTTP server

// Define directory paths
const filename = url.fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);
const HTMLpath = path.join(dirname, 'HTML');

// Middleware
app.use(express.static(HTMLpath));
app.use(express.json());
app.use('/bills', express.static(path.join(dirname, 'bills')));

// Routes
app.use(CategoryRoutes); // Mount Category routes
app.use(ProductRoutes); // Mount Product routes
app.use(BillRoutes); // Mount Bill routes
app.use(ViewBillRoutes)

// Serve HTML pages
app.get('/', (req, res) => {
    res.sendFile(`${HTMLpath}/Dashboard.html`);
});

app.get('/manage-category', (req, res) => {
    res.sendFile(`${HTMLpath}/Category.html`);
});

app.get('/manage-product', (req, res) => {
    res.sendFile(`${HTMLpath}/Product.html`);
});

app.get('/generate-bill', (req, res) => {
    res.sendFile(`${HTMLpath}/Bill.html`);
});

app.get('/view-bill', (req, res) => {
    res.sendFile(`${HTMLpath}/ViewBill.html`);
});


// Socket.IO setup
io.on('connection', (socket) => {
    console.log('User connected');
    socket.on('disconnect', () => {
        console.log('User disconnected');
    });
});

// Make Socket.IO available in routes if needed
app.set('socketio', io);

// Start the server
server.listen(4000, () => {
    console.log('Server running on http://localhost:4000');
});
