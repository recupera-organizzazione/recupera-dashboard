import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import apiRoutes from './routes/api.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// API versioning
app.use('/api/v1', apiRoutes);

// 404 Handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint non trovato' });
});

app.listen(PORT, () => {
  console.log(`ReCUPera Backend API in esecuzione sulla porta ${PORT}`);
});
